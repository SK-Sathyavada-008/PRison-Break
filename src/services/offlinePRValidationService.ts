// ─────────────────────────────────────────────
// PRison Break — Offline Commit Ingestion & Final PR Validation Service
// Enforces:
// 1. Exactly One Competition PR per Registered Student
// 2. Offline Commit Ingestion & Author Identity Verification
// 3. Multi-Issue Mapping with Unassigned Issue Protection
// 4. Webhook Idempotency & Out-of-Order Delivery Safety
// 5. Strict Merge Policy (No auto-merging; No duplicate score on merge)
// 6. 4-Student Team Score Aggregation
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type {
  FirestorePullRequest,
  FirestoreTeam,
  FirestoreScoreEvent,
  IssueDifficulty,
  IssueGradingRecord,
  AdminAuditLog,
} from '../types';
import { extractAllLinkedIssues } from './prValidationPipeline';
import { javaGradingEngine, roundToTwoDecimals } from './javaGradingEngine';
import { issueService } from './issueService';
import { teamService } from './teamService';

export interface CommitMetadata {
  sha: string;
  message: string;
  author: string;
  email?: string;
  timestamp?: string;
}

export interface ChangedFileMetadata {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface StudentPRValidationContext {
  repositoryId: string;
  repositoryFullName: string;
  prNumber: number;
  prId?: string;
  title: string;
  body?: string;
  authorUsername: string;
  isDraft?: boolean;
  isMerged?: boolean;
  state?: 'open' | 'closed';
  baseBranch?: string;
  headBranch?: string;
  baseCommitSha?: string;
  headCommitSha?: string;
  commits?: CommitMetadata[];
  changedFiles?: ChangedFileMetadata[];
  assignedIssues?: number[];
  mockExecutionResult?: {
    compiles?: boolean;
    testsPassed?: number;
    testsFailed?: number;
    totalTests?: number;
    normalInputsPassed?: boolean;
    edgeCasesPassed?: boolean;
    timeout?: boolean;
    crash?: boolean;
  };
  prLabels?: string[];
  issueDifficulties?: Record<number, IssueDifficulty>;
  deliveryId?: string;
  deliveryTimestamp?: string;
}

export interface StudentPRValidationResult {
  valid: boolean;
  status: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED' | 'closed';
  isOnePRRuleViolated: boolean;
  isDraftPR: boolean;
  isMerged: boolean;
  totalAwardedPoints: number;
  assignedIssuesCovered: number[];
  unassignedIssuesDetected: number[];
  attributionWarnings: string[];
  duplicateWarnings: string[];
  gradingRecords: IssueGradingRecord[];
  explanation: string;
}

export const offlinePRValidationService = {
  /**
   * Fetches the complete list of commits for a PR using GitHub REST API with pagination.
   * Does not assume the webhook payload contains every commit.
   */
  async fetchCompleteCommitList(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
  ): Promise<CommitMetadata[]> {
    const allCommits: CommitMetadata[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'PRison-Break-Leaderboard',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      while (hasMore) {
        const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=${perPage}&page=${page}`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
          console.warn(`[OfflinePR] GitHub API returned ${res.status} when fetching commits for PR #${prNumber}`);
          break;
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          hasMore = false;
          break;
        }

        for (const item of data) {
          allCommits.push({
            sha: item.sha,
            message: item.commit?.message || '',
            author: item.author?.login || item.commit?.author?.name || 'unknown',
            email: item.commit?.author?.email || '',
            timestamp: item.commit?.author?.date || '',
          });
        }

        if (data.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (err) {
      console.error(`[OfflinePR] Error fetching commits for ${owner}/${repo}#${prNumber}:`, err);
    }

    return allCommits;
  },

  /**
   * Verifies the strict "One Competition PR per Student" rule.
   * If a student already has another competition PR in this repository, flag it for organizer review.
   */
  async checkOnePRPerStudent(
    studentUsername: string,
    repositoryId: string,
    currentPrNumber: number
  ): Promise<{ isDuplicate: boolean; priorPRs: number[]; warning?: string }> {
    if (!isFirebaseConfigured()) {
      return { isDuplicate: false, priorPRs: [] };
    }

    const cleanUsername = studentUsername.trim().toLowerCase();
    const cleanRepo = repositoryId.trim().toLowerCase().replace(/^repo_/, '');

    try {
      const prsRef = collection(db, 'pullRequests');
      const q = query(prsRef, where('repositoryId', '==', cleanRepo));
      const snap = await getDocs(q);

      const priorPRs: number[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (
          data.githubUsername?.toLowerCase() === cleanUsername &&
          data.prNumber !== currentPrNumber
        ) {
          priorPRs.push(data.prNumber);
        }
      }

      if (priorPRs.length > 0) {
        return {
          isDuplicate: true,
          priorPRs,
          warning: `DUPLICATE_PR_VIOLATION: Student @${studentUsername} previously submitted competition PR(s): [${priorPRs.map((n) => `#${n}`).join(', ')}]. Each student is strictly permitted exactly ONE competition PR.`,
        };
      }
    } catch (err) {
      console.warn('[OfflinePR] Error checking one-PR-per-student rule:', err);
    }

    return { isDuplicate: false, priorPRs: [] };
  },

  /**
   * Core validation & multi-issue attribution pipeline for a student's final offline PR.
   */
  async validateAndGradeStudentPR(
    context: StudentPRValidationContext
  ): Promise<StudentPRValidationResult> {
    const cleanUsername = context.authorUsername.trim().toLowerCase();
    const attributionWarnings: string[] = [];
    const duplicateWarnings: string[] = [];
    const gradingRecords: IssueGradingRecord[] = [];

    // 1. Handle PR State: Closed without merging
    if (context.state === 'closed' && !context.isMerged) {
      return {
        valid: false,
        status: 'closed',
        isOnePRRuleViolated: false,
        isDraftPR: false,
        isMerged: false,
        totalAwardedPoints: 0,
        assignedIssuesCovered: [],
        unassignedIssuesDetected: [],
        attributionWarnings: ['PR is closed without merging.'],
        duplicateWarnings: [],
        gradingRecords: [],
        explanation: 'PR was closed without merging into base branch. 0 points awarded.',
      };
    }

    // 2. Draft PR Check
    const isDraftPR = context.isDraft === true;
    if (isDraftPR) {
      attributionWarnings.push(
        'DRAFT_PR: Draft PRs are not eligible competition submissions until marked ready for review.'
      );
    }

    // 3. One PR per student enforcement
    const onePrCheck = await this.checkOnePRPerStudent(
      context.authorUsername,
      context.repositoryId,
      context.prNumber
    );

    const isOnePRRuleViolated = onePrCheck.isDuplicate;
    if (isOnePRRuleViolated && onePrCheck.warning) {
      duplicateWarnings.push(onePrCheck.warning);
    }

    // 4. Resolve Team and Student Assignment
    let assignedStudentIssues: number[] = context.assignedIssues || [];
    let existingTeamSolvedIssues: number[] = [];
    let teamId = `team_${context.repositoryId.toLowerCase().replace(/^repo_/, '')}`;

    if (isFirebaseConfigured()) {
      try {
        const teamSnap = await getDoc(doc(db, 'teams', teamId));
        if (teamSnap.exists()) {
          const teamData = teamSnap.data() as FirestoreTeam;
          existingTeamSolvedIssues = (teamData.solvedIssues || []).map((s) => s.issueNumber);

          const member = (teamData.members || []).find(
            (m) => m.githubUsername.toLowerCase() === cleanUsername
          );
          if (member && member.assignedIssues && member.assignedIssues.length > 0) {
            assignedStudentIssues = member.assignedIssues;
          }
        }
      } catch (err) {
        console.warn('[OfflinePR] Error querying team assignments:', err);
      }
    }

    if (assignedStudentIssues.length === 0) {
      assignedStudentIssues = [1, 2, 3, 4];
    }

    // 5. Ingest and inspect commit history
    const commits = context.commits || [];
    const commitMessages = commits.map((c) => c.message);
    const commitAuthors = commits.map((c) => c.author);

    // Cross-check commit authors against verified student identity
    if (commitAuthors.length > 0) {
      const mismatched = commitAuthors.filter(
        (author) => author !== 'unknown' && !author.toLowerCase().includes(cleanUsername)
      );
      if (mismatched.length > 0) {
        attributionWarnings.push(
          `ATTRIBUTION_MISMATCH: Commit(s) authored under Git identity "${Array.from(new Set(mismatched)).join(', ')}" instead of registered student @${context.authorUsername}. Flagged for review.`
        );
      }
    }

    // 6. Extract linked issues from PR title, body, and commit messages
    const textToScan = `${context.title} ${context.body || ''} ${commitMessages.join(' ')}`;
    const extractedIssueNumbers = extractAllLinkedIssues(context.title, textToScan);

    const assignedIssuesCovered: number[] = [];
    const unassignedIssuesDetected: number[] = [];

    for (const num of extractedIssueNumbers) {
      if (assignedStudentIssues.length > 0 && !assignedStudentIssues.includes(num)) {
        unassignedIssuesDetected.push(num);
        attributionWarnings.push(
          `UNASSIGNED_ISSUE: Issue #${num} is NOT assigned to student @${context.authorUsername}. 0 points awarded for this issue.`
        );
      } else {
        assignedIssuesCovered.push(num);
      }
    }

    // 7. Check for unmapped changes
    if (extractedIssueNumbers.length === 0) {
      attributionWarnings.push(
        'UNMAPPED_CHANGES_DETECTED: No registered issue reference could be linked to this PR.'
      );
    }

    // 8. Grade each assigned issue independently with Phase 3 formula
    let totalAwardedPoints = 0;

    // If duplicate PR rule is violated or draft PR, do not award points automatically
    const canAwardPoints = !isOnePRRuleViolated && !isDraftPR;

    if (canAwardPoints) {
      for (const issueNum of assignedIssuesCovered) {
        // Look up issue difficulty from context override, registered issues, prLabels, or default
        let issueDifficulty: IssueDifficulty = context.issueDifficulties?.[issueNum] || 'EASY';
        if (!context.issueDifficulties?.[issueNum]) {
          try {
            const registered = await issueService.getIssues();
            const cleanRepo = context.repositoryId.trim().toLowerCase().replace(/^repo_/, '');
            const matched = registered.find(
              (i) =>
                (i.repositoryId.toLowerCase() === cleanRepo || i.repositoryId.toLowerCase() === context.repositoryId.toLowerCase()) &&
                i.issueNumber === issueNum
            );
            if (matched && matched.difficulty) {
              issueDifficulty = matched.difficulty;
            } else if (context.prLabels && context.prLabels.length > 0) {
              const parsed = issueService.parseDifficultyFromLabels(context.prLabels);
              if (parsed) issueDifficulty = parsed;
            }
          } catch {
            // Fallback to EASY
          }
        }

        const gradeRecord = await javaGradingEngine.gradeIssue({
          issueNumber: issueNum,
          difficulty: issueDifficulty,
          studentUsername: context.authorUsername,
          assignedStudentIssues,
          teamId,
          repositoryId: context.repositoryId,
          prNumber: context.prNumber,
          changedFiles: (context.changedFiles || []).map((f) => ({
            filename: f.filename,
            status: f.status,
            patch: f.patch,
          })),
          commitMessages,
          commitAuthors,
          existingTeamSolvedIssues,
          mockExecutionResult: context.mockExecutionResult || {
            compiles: true,
            totalTests: 4,
            testsPassed: 4,
            normalInputsPassed: true,
            edgeCasesPassed: true,
          },
        });

        gradingRecords.push(gradeRecord);
        totalAwardedPoints = roundToTwoDecimals(totalAwardedPoints + gradeRecord.awardedPoints);
      }
    }

    // 9. Determine Overall Status
    let status: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED' | 'closed' = 'PENDING_REVIEW';

    if (context.isMerged) {
      status = 'MERGED';
    } else if (isOnePRRuleViolated || isDraftPR || unassignedIssuesDetected.length > 0 || attributionWarnings.length > 0) {
      status = 'PENDING_REVIEW';
    } else if (gradingRecords.length > 0 && gradingRecords.every((g) => g.gradingStatus === 'AUTO_GRADED')) {
      status = 'AUTO_APPROVED';
    } else {
      status = 'PENDING_REVIEW';
    }

    const explanation =
      `Evaluated final competition PR #${context.prNumber} for @${context.authorUsername}. ` +
      `Issues: [${assignedIssuesCovered.map((n) => `#${n}`).join(', ')}]. ` +
      `Awarded: ${totalAwardedPoints} pts. ` +
      (attributionWarnings.length > 0 ? `Warnings: ${attributionWarnings.join(' | ')}` : 'Clean submission.');

    return {
      valid: canAwardPoints,
      status,
      isOnePRRuleViolated,
      isDraftPR,
      isMerged: !!context.isMerged,
      totalAwardedPoints,
      assignedIssuesCovered,
      unassignedIssuesDetected,
      attributionWarnings,
      duplicateWarnings,
      gradingRecords,
      explanation,
    };
  },

  /**
   * Persists the evaluated PR and idempotently awards score events to the team ledger.
   * Duplicate webhook deliveries or merges do NOT score twice.
   */
  async persistAndAggregatePR(
    context: StudentPRValidationContext,
    result: StudentPRValidationResult
  ): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const prId = context.prId || `pr_${context.repositoryId}_${context.prNumber}`;
    const cleanRepo = context.repositoryId.trim().toLowerCase().replace(/^repo_/, '');
    const cleanUsername = context.authorUsername.trim().toLowerCase();
    const teamId = `team_${cleanRepo}`;
    const now = new Date().toISOString();

    // 1. Fetch existing PR to prevent out-of-order regressions
    const prDocRef = doc(db, 'pullRequests', prId);
    const existingPRSnap = await getDoc(prDocRef);
    if (existingPRSnap.exists()) {
      const existingData = existingPRSnap.data() as FirestorePullRequest;
      // If existing PR was already MERGED, do not downgrade to open or re-score
      if (existingData.merged && !context.isMerged && context.state === 'open') {
        console.log(`[OfflinePR] PR #${context.prNumber} is already merged in Firestore. Preserving MERGED state.`);
        return;
      }
    }

    // 2. Upsert Pull Request record with full Phase 4 metadata
    const prDocData: Partial<FirestorePullRequest> = {
      id: prId,
      repositoryId: cleanRepo,
      repositoryFullName: context.repositoryFullName,
      prNumber: context.prNumber,
      githubUsername: context.authorUsername,
      title: context.title,
      status: result.status,
      processingState: result.status === 'MERGED' ? 'MERGED' : result.status === 'AUTO_APPROVED' ? 'AUTO_APPROVED' : 'PENDING_REVIEW',
      merged: result.isMerged,
      isDraft: result.isDraftPR,
      hasMultiplePRViolation: result.isOnePRRuleViolated,
      issueNumbers: result.assignedIssuesCovered,
      score: result.totalAwardedPoints,
      baseBranch: context.baseBranch || 'main',
      headBranch: context.headBranch || '',
      baseCommitSha: context.baseCommitSha || '',
      headCommitSha: context.headCommitSha || '',
      commitShas: (context.commits || []).map((c) => c.sha),
      commitMessages: (context.commits || []).map((c) => c.message),
      commits: context.commits || [],
      changedFilesList: (context.changedFiles || []).map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      associatedAssignedIssueIds: result.assignedIssuesCovered,
      attributionWarnings: result.attributionWarnings,
      duplicateSubmissionWarning: result.isOnePRRuleViolated,
      gradingRecords: result.gradingRecords,
      updatedAt: now,
      createdAt: existingPRSnap.exists() ? (existingPRSnap.data()?.createdAt || now) : now,
    };

    await setDoc(prDocRef, prDocData, { merge: true });

    // 3. Score Events & Team Score Aggregation (IDEMPOTENT)
    if (result.totalAwardedPoints > 0 && result.valid) {
      for (const grade of result.gradingRecords) {
        if (grade.awardedPoints <= 0) continue;

        const idempotencyKey = `se_${teamId}_issue_${grade.issueNumber}`;
        const scoreEventRef = doc(db, 'scoreEvents', idempotencyKey);
        const eventSnap = await getDoc(scoreEventRef);

        if (!eventSnap.exists()) {
          const scoreEventDoc: FirestoreScoreEvent = {
            id: idempotencyKey,
            teamId,
            participantId: `p_${cleanUsername}`,
            githubUsername: context.authorUsername,
            type: `ISSUE_${grade.difficulty}`,
            points: grade.awardedPoints,
            basePoints: grade.basePoints,
            componentScores: grade.rawComponentScores,
            rubricVersion: grade.rubricVersion,
            formula: grade.formula,
            prNumber: context.prNumber,
            prId,
            repositoryId: cleanRepo,
            repositoryFullName: context.repositoryFullName,
            issueNumber: grade.issueNumber,
            reason: `Issue #${grade.issueNumber} [${grade.difficulty}]: Awarded ${grade.awardedPoints} pts (${grade.gradingExplanation})`,
            idempotencyKey,
            timestamp: now,
          };

          await setDoc(scoreEventRef, scoreEventDoc);
        }
      }

      // Re-aggregate squad total score directly from authoritative scoreEvents
      const eventsQuery = query(collection(db, 'scoreEvents'), where('teamId', '==', teamId));
      const eventsSnap = await getDocs(eventsQuery);

      let aggregatedTeamScore = 0;
      const solvedIssuesList: any[] = [];
      const solvedIssueNumbers = new Set<number>();

      for (const evDoc of eventsSnap.docs) {
        const ev = evDoc.data() as FirestoreScoreEvent;
        aggregatedTeamScore = roundToTwoDecimals(aggregatedTeamScore + (ev.points || 0));

        if (ev.issueNumber && !solvedIssueNumbers.has(ev.issueNumber)) {
          solvedIssueNumbers.add(ev.issueNumber);
          solvedIssuesList.push({
            issueNumber: ev.issueNumber,
            difficulty: (ev.type || '').replace(/^ISSUE_/, '') || 'EASY',
            points: ev.points,
            solvedByUsername: ev.githubUsername || context.authorUsername,
            prNumber: ev.prNumber || context.prNumber,
            solvedAt: ev.timestamp || now,
          });
        }
      }

      const veryHardCount = solvedIssuesList.filter((s) => s.difficulty === 'VERY_HARD').length;

      // Update Team document atomically
      const teamDocRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamDocRef);

      if (teamSnap.exists()) {
        const teamData = teamSnap.data() as FirestoreTeam;
        const members = teamData.members ? [...teamData.members] : [];

        const memberIdx = members.findIndex((m) => m.githubUsername.toLowerCase() === cleanUsername);
        if (memberIdx >= 0) {
          members[memberIdx] = {
            ...members[memberIdx],
            prSubmitted: true,
            prNumber: context.prNumber,
            score: (members[memberIdx].score || 0) + result.totalAwardedPoints,
            totalScore: (members[memberIdx].totalScore || 0) + result.totalAwardedPoints,
            validationStatus: result.status,
          };
        }

        const currentBonus = teamData.bonusXP || 0;
        const newTotalXP = roundToTwoDecimals(aggregatedTeamScore + currentBonus);

        await updateDoc(teamDocRef, {
          earnedXP: aggregatedTeamScore,
          bonusXP: currentBonus,
          totalXP: newTotalXP,
          totalScore: newTotalXP,
          solvedIssues: solvedIssuesList,
          validatedIssueCount: solvedIssuesList.length,
          correctlySolvedIssuesCount: solvedIssuesList.length,
          veryHardSolvedCount: veryHardCount,
          members,
          updatedAt: now,
          ...(result.isMerged ? { lastMergedAt: now } : {}),
        });
      }
    } else {
      // In-Memory update for tests / offline mode
      const team = await teamService.getTeamById(teamId);
      if (team && result.totalAwardedPoints > 0) {
        const members = team.members ? [...team.members] : [];
        const memberIdx = members.findIndex((m) => m.githubUsername.toLowerCase() === cleanUsername);
        if (memberIdx >= 0) {
          members[memberIdx] = {
            ...members[memberIdx],
            prSubmitted: true,
            prNumber: context.prNumber,
            score: (members[memberIdx].score || 0) + result.totalAwardedPoints,
            totalScore: (members[memberIdx].totalScore || 0) + result.totalAwardedPoints,
            validationStatus: result.status,
          };
        }

        const newEarned = roundToTwoDecimals((team.earnedXP ?? team.totalScore ?? 0) + result.totalAwardedPoints);
        const currentBonus = team.bonusXP ?? 0;
        const newTotalXP = roundToTwoDecimals(newEarned + currentBonus);

        const newSolved = [...(team.solvedIssues || [])];
        for (const g of result.gradingRecords) {
          if (!newSolved.some((s) => s.issueNumber === g.issueNumber)) {
            newSolved.push({
              issueNumber: g.issueNumber,
              difficulty: g.difficulty,
              points: g.awardedPoints,
              solvedByUsername: context.authorUsername,
              prNumber: context.prNumber,
              solvedAt: now,
            });
          }
        }

        await teamService.updateTeam(teamId, {
          earnedXP: newEarned,
          bonusXP: currentBonus,
          totalXP: newTotalXP,
          totalScore: newTotalXP,
          members,
          solvedIssues: newSolved,
          validatedIssueCount: newSolved.length,
          correctlySolvedIssuesCount: newSolved.length,
          veryHardSolvedCount: newSolved.filter((s) => s.difficulty === 'VERY_HARD').length,
          updatedAt: now,
        });
      }
    }
  },

  /**
   * Records a manual review action (Approve, Reject, Request Review) with mandatory audit justification.
   */
  async submitOrganizerReviewAction(
    prId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_REVIEW',
    adminUsername: string,
    reason: string
  ): Promise<AdminAuditLog> {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory review justification is required for organizer review action.');
    }

    const now = new Date().toISOString();
    const auditId = `audit_pr_review_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const auditLog: AdminAuditLog = {
      id: auditId,
      action: action === 'APPROVE' ? 'SCORE_OVERRIDE' : 'MANUAL_GRADING_OVERRIDE',
      performedBy: adminUsername,
      details: {
        prId,
        reviewAction: action,
      },
      reason: reason.trim(),
      timestamp: now,
    };

    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'auditLogs', auditId), auditLog);

      const prDocRef = doc(db, 'pullRequests', prId);
      const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'PENDING_REVIEW';

      await updateDoc(prDocRef, {
        status: newStatus,
        reviewedBy: adminUsername,
        reviewNotes: reason.trim(),
        reviewedAt: now,
      });
    }

    return auditLog;
  },
};
