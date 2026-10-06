// ─────────────────────────────────────────────
// PRison Break Scoring Engine
// Deterministic · Auditable · Idempotent · No Direct TotalScore Edits
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type {
  FirestorePullRequest,
  FirestoreParticipant,
  FirestoreScoreEvent,
  FirestoreReview,
  PRProcessingState,
} from '../types';

// ── FINAL SCORING RULES CONFIGURATION ───────────────

export const SCORING_RULES = {
  CORRECT_PR: {
    key: 'correct_pr',
    points: 10,
    label: 'Correct PR',
  },
  DIFFICULT_ISSUE: {
    key: 'difficult_issue',
    points: 20,
    label: 'Difficult issue',
  },
  PR_REVIEWED: {
    key: 'pr_reviewed',
    points: 5,
    label: 'PR reviewed',
  },
  PR_MERGED: {
    key: 'pr_merged',
    points: 15,
    label: 'PR merged',
  },
  FIRST_SUCCESSFUL_PR: {
    key: 'first_successful_pr',
    points: 10,
    label: 'First successful PR',
  },
  DOCS_CONTRIBUTION: {
    key: 'docs_contribution',
    points: 10,
    label: 'Documentation contribution',
  },
  DIFFICULT_BUG_FIX: {
    key: 'difficult_bug_fix',
    points: 25,
    label: 'Fixing a difficult bug',
  },
} as const;

export interface ValidationSignals {
  participantRegistered: boolean;
  repositoryActive: boolean;
  validIssueLinked: boolean;
  testsPassed: boolean;
  filesAllowed: boolean;
  noSuspiciousDiff: boolean;
}

export interface PREvaluationContext {
  prNumber: number;
  repositoryId: string;
  repositoryFullName: string;
  githubUsername: string;
  title: string;
  body?: string;
  merged?: boolean;
  testsPassed?: boolean;
  reviewed?: boolean;
  issueNumber?: number;
  issueLabels?: string[];
  prLabels?: string[];
  changedFiles?: string[];
}

/**
 * Checks issue metadata / labels for difficulty
 */
export function isDifficultIssue(labels: string[] = []): boolean {
  const normalized = labels.map((l) => l.toLowerCase());
  return (
    normalized.includes('difficulty:hard') ||
    normalized.includes('difficulty:medium') ||
    normalized.includes('points:20')
  );
}

/**
 * Checks issue metadata for difficult bug fix (type:bug AND difficulty:hard or points:25)
 */
export function isDifficultBug(labels: string[] = []): boolean {
  const normalized = labels.map((l) => l.toLowerCase());
  const hasBug = normalized.includes('type:bug') || normalized.includes('bug');
  const isHard = normalized.includes('difficulty:hard');
  const isPoints25 = normalized.includes('points:25');
  return (hasBug && isHard) || isPoints25;
}

/**
 * Checks if PR or issue is a documentation contribution
 */
export function isDocumentationContribution(labels: string[] = [], changedFiles: string[] = []): boolean {
  const normalized = labels.map((l) => l.toLowerCase());
  if (
    normalized.includes('type:documentation') ||
    normalized.includes('documentation') ||
    normalized.includes('docs')
  ) {
    return true;
  }
  if (changedFiles.length > 0) {
    const onlyDocs = changedFiles.every(
      (f) =>
        f.endsWith('.md') ||
        f.startsWith('docs/') ||
        f.toLowerCase().includes('readme')
    );
    if (onlyDocs) return true;
  }
  return false;
}

/**
 * Evaluates whether a PR meets all deterministic criteria for AUTO_APPROVED state.
 */
export function evaluateAutoApprovalConditions(
  signals: ValidationSignals
): { status: PRProcessingState; reason?: string } {
  if (!signals.participantRegistered) {
    return { status: 'PENDING_REVIEW', reason: 'Participant not registered in PRison Control' };
  }
  if (!signals.repositoryActive) {
    return { status: 'PENDING_REVIEW', reason: 'Repository is inactive or unverified' };
  }
  if (!signals.validIssueLinked) {
    return { status: 'PENDING_REVIEW', reason: 'No valid linked issue found' };
  }
  if (!signals.testsPassed) {
    return { status: 'PENDING_REVIEW', reason: 'Automated test suite has not passed' };
  }
  if (!signals.filesAllowed) {
    return { status: 'PENDING_REVIEW', reason: 'Modifications found in restricted or system files' };
  }
  if (!signals.noSuspiciousDiff) {
    return { status: 'PENDING_REVIEW', reason: 'Diff contains irregular or suspicious modifications' };
  }

  return { status: 'AUTO_APPROVED' };
}

/**
 * Scoring Engine Core:
 * Evaluates all applicable scoring rules for a PR deterministically.
 */
export function calculateApplicableRules(
  context: PREvaluationContext,
  hasPriorSuccessfulPR: boolean
): Array<{ ruleKey: string; points: number; label: string; idempotencyKey: string }> {
  const results: Array<{ ruleKey: string; points: number; label: string; idempotencyKey: string }> = [];
  const repoSlug = context.repositoryId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prNum = context.prNumber;
  const allLabels = [...(context.issueLabels || []), ...(context.prLabels || [])];

  // 1. Correct PR (+10) — awarded if tests pass and PR is verified / correct / merged
  if (context.testsPassed || context.merged) {
    results.push({
      ruleKey: SCORING_RULES.CORRECT_PR.key,
      points: SCORING_RULES.CORRECT_PR.points,
      label: SCORING_RULES.CORRECT_PR.label,
      idempotencyKey: `se_${repoSlug}_pr_${prNum}_correct`,
    });
  }

  // 2. Difficult issue (+20)
  if (isDifficultIssue(allLabels)) {
    results.push({
      ruleKey: SCORING_RULES.DIFFICULT_ISSUE.key,
      points: SCORING_RULES.DIFFICULT_ISSUE.points,
      label: SCORING_RULES.DIFFICULT_ISSUE.label,
      idempotencyKey: `se_${repoSlug}_pr_${prNum}_difficult_issue`,
    });
  }

  // 3. PR reviewed (+5)
  if (context.reviewed) {
    results.push({
      ruleKey: SCORING_RULES.PR_REVIEWED.key,
      points: SCORING_RULES.PR_REVIEWED.points,
      label: SCORING_RULES.PR_REVIEWED.label,
      idempotencyKey: `se_${repoSlug}_pr_${prNum}_reviewed`,
    });
  }

  // 4. PR merged (+15)
  if (context.merged) {
    results.push({
      ruleKey: SCORING_RULES.PR_MERGED.key,
      points: SCORING_RULES.PR_MERGED.points,
      label: SCORING_RULES.PR_MERGED.label,
      idempotencyKey: `se_${repoSlug}_pr_${prNum}_merged`,
    });
  }

  // 5. First successful PR (+10) — only awarded once per participant
  if ((context.testsPassed || context.merged) && !hasPriorSuccessfulPR) {
    results.push({
      ruleKey: SCORING_RULES.FIRST_SUCCESSFUL_PR.key,
      points: SCORING_RULES.FIRST_SUCCESSFUL_PR.points,
      label: SCORING_RULES.FIRST_SUCCESSFUL_PR.label,
      idempotencyKey: `se_${context.githubUsername.toLowerCase()}_first_pr`,
    });
  }

  // 6. Documentation contribution (+10)
  if (isDocumentationContribution(allLabels, context.changedFiles)) {
    results.push({
      ruleKey: SCORING_RULES.DOCS_CONTRIBUTION.key,
      points: SCORING_RULES.DOCS_CONTRIBUTION.points,
      label: SCORING_RULES.DOCS_CONTRIBUTION.label,
      idempotencyKey: `se_${repoSlug}_pr_${prNum}_docs`,
    });
  }

  // 7. Fixing a difficult bug (+25)
  if (isDifficultBug(allLabels)) {
    results.push({
      ruleKey: SCORING_RULES.DIFFICULT_BUG_FIX.key,
      points: SCORING_RULES.DIFFICULT_BUG_FIX.points,
      label: SCORING_RULES.DIFFICULT_BUG_FIX.label,
      idempotencyKey: `se_${repoSlug}_pr_${prNum}_difficult_bug`,
    });
  }

  return results;
}

export const scoringEngine = {
  /**
   * Applies the scoring engine to a PR idempotently in Firestore.
   * Ensures scoreEvents is the single source of truth.
   * Never modifies participant totalScore without writing score events.
   */
  async processPRScoring(context: PREvaluationContext): Promise<{
    newPointsAwarded: number;
    eventsCreated: FirestoreScoreEvent[];
    participantUpdated: boolean;
  }> {
    if (!isFirebaseConfigured()) {
      return { newPointsAwarded: 0, eventsCreated: [], participantUpdated: false };
    }

    const now = new Date().toISOString();
    const username = context.githubUsername.trim().toLowerCase();

    // 1. Locate Participant
    const pRef = collection(db, 'participants');
    const pSnap = await getDocs(query(pRef, where('githubUsername', '==', context.githubUsername)));

    let participantId = `p_${username}`;
    let participantData: FirestoreParticipant | null = null;

    if (!pSnap.empty) {
      const pDoc = pSnap.docs[0];
      participantId = pDoc.id;
      participantData = pDoc.data() as FirestoreParticipant;
    } else {
      // Auto-register prisoner if missing
      participantData = {
        id: participantId,
        name: context.githubUsername,
        githubUsername: context.githubUsername,
        totalScore: 0,
        prCount: 1,
        mergedPrCount: 0,
        escapedCells: 0,
        firstSuccessfulPr: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'participants', participantId), participantData);
    }

    const hasPriorSuccessfulPR = !!participantData?.firstSuccessfulPr;

    // 2. Evaluate all applicable rules
    const applicableRules = calculateApplicableRules(context, hasPriorSuccessfulPR);

    let newPointsAwarded = 0;
    const eventsCreated: FirestoreScoreEvent[] = [];
    let isFirstPRAwarded = false;

    // 3. Award each score event with strict idempotency
    for (const rule of applicableRules) {
      const eventDocRef = doc(db, 'scoreEvents', rule.idempotencyKey);
      const existingSnap = await getDoc(eventDocRef);

      // Idempotency: Never award points twice
      if (existingSnap.exists()) {
        continue;
      }

      const scoreEventDoc: FirestoreScoreEvent = {
        id: rule.idempotencyKey,
        participantId,
        participantName: participantData?.name || context.githubUsername,
        githubUsername: context.githubUsername,
        type: rule.ruleKey.toUpperCase(),
        points: rule.points,
        prNumber: context.prNumber,
        prId: `pr_${context.repositoryId}_${context.prNumber}`,
        repositoryId: context.repositoryId,
        repositoryFullName: context.repositoryFullName,
        reason: rule.label,
        idempotencyKey: rule.idempotencyKey,
        timestamp: now,
      };

      await setDoc(eventDocRef, scoreEventDoc);
      eventsCreated.push(scoreEventDoc);
      newPointsAwarded += rule.points;

      if (rule.ruleKey === SCORING_RULES.FIRST_SUCCESSFUL_PR.key) {
        isFirstPRAwarded = true;
      }
    }

    // 4. Update Participant denormalized cached stats if points or PRs were awarded
    let participantUpdated = false;
    if (newPointsAwarded > 0 || context.merged) {
      const currentScore = participantData?.totalScore || 0;
      const newScore = currentScore + newPointsAwarded;
      const currentMerged = participantData?.mergedPrCount || 0;
      const newMerged = context.merged ? currentMerged + 1 : currentMerged;
      const currentEscaped = participantData?.escapedCells || 0;
      const newEscaped = context.merged ? currentEscaped + 1 : currentEscaped;

      const updates: Partial<FirestoreParticipant> = {
        totalScore: newScore,
        mergedPrCount: newMerged,
        escapedCells: newEscaped,
        updatedAt: now,
      };

      if ((isFirstPRAwarded || (context.merged && !hasPriorSuccessfulPR))) {
        updates.firstSuccessfulPr = participantData?.firstSuccessfulPr || now;
      }

      await updateDoc(doc(db, 'participants', participantId), updates);
      participantUpdated = true;
    }

    // 5. Update PullRequest document score in Firestore
    const prDocId = `pr_${context.repositoryId}_${context.prNumber}`;
    const prDocRef = doc(db, 'pullRequests', prDocId);
    const prSnap = await getDoc(prDocRef);

    if (prSnap.exists()) {
      const existingPRScore = prSnap.data()?.score || 0;
      await updateDoc(prDocRef, {
        score: existingPRScore + newPointsAwarded,
        correct: true,
        updatedAt: now,
      });
    }

    return {
      newPointsAwarded,
      eventsCreated,
      participantUpdated,
    };
  },

  /**
   * Admin Review Queue Action: APPROVE PR
   * Approves PR, runs scoring engine, and logs an auditable review record.
   */
  async approvePR(
    pr: FirestorePullRequest,
    adminUsername: string,
    notes: string = 'Approved by administrator'
  ): Promise<{ pointsAwarded: number }> {
    if (!isFirebaseConfigured()) return { pointsAwarded: 10 };

    const now = new Date().toISOString();

    // 1. Process scoring engine
    const scoringResult = await this.processPRScoring({
      prNumber: pr.prNumber,
      repositoryId: pr.repositoryId,
      repositoryFullName: pr.repositoryFullName || pr.repositoryId,
      githubUsername: pr.githubUsername,
      title: pr.title,
      testsPassed: true,
      reviewed: true,
      merged: pr.merged,
      issueNumber: pr.issueNumber,
      issueLabels: pr.issueLabels,
      prLabels: pr.labels,
    });

    // 2. Update PR state to AUTO_APPROVED / APPROVED
    await updateDoc(doc(db, 'pullRequests', pr.id), {
      status: 'AUTO_APPROVED',
      testsPassed: true,
      correct: true,
      reviewNotes: notes,
      updatedAt: now,
    });

    // 3. Create mandatory audit record in reviews collection
    const reviewId = `rev_${Date.now()}_${pr.prNumber}`;
    const reviewDoc: FirestoreReview = {
      id: reviewId,
      prId: pr.id,
      prNumber: pr.prNumber,
      repositoryId: pr.repositoryId,
      status: 'APPROVED',
      reason: notes,
      reviewedBy: adminUsername,
      pointsAwarded: scoringResult.newPointsAwarded,
      createdAt: now,
    };
    await setDoc(doc(db, 'reviews', reviewId), reviewDoc);

    return { pointsAwarded: scoringResult.newPointsAwarded };
  },

  /**
   * Admin Review Queue Action: REJECT PR
   * Marks PR as REJECTED and creates an auditable review record. No points awarded.
   */
  async rejectPR(
    pr: FirestorePullRequest,
    adminUsername: string,
    rejectionReason: string
  ): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const now = new Date().toISOString();

    // 1. Update PR state to REJECTED
    await updateDoc(doc(db, 'pullRequests', pr.id), {
      status: 'REJECTED',
      reviewNotes: rejectionReason,
      updatedAt: now,
    });

    // 2. Create mandatory audit record in reviews collection
    const reviewId = `rev_${Date.now()}_${pr.prNumber}`;
    const reviewDoc: FirestoreReview = {
      id: reviewId,
      prId: pr.id,
      prNumber: pr.prNumber,
      repositoryId: pr.repositoryId,
      status: 'REJECTED',
      reason: rejectionReason,
      reviewedBy: adminUsername,
      pointsAwarded: 0,
      createdAt: now,
    };
    await setDoc(doc(db, 'reviews', reviewId), reviewDoc);
  },

  /**
   * Admin Review Queue Action: FORCE MERGE PR
   * Marks PR as MERGED, awards PR_MERGED points, and creates audit records.
   */
  async forceMergePR(
    pr: FirestorePullRequest,
    adminUsername: string,
    mergeReason: string = 'Admin force merge'
  ): Promise<{ pointsAwarded: number }> {
    if (!isFirebaseConfigured()) return { pointsAwarded: 15 };

    const now = new Date().toISOString();

    // 1. Process scoring engine with merged: true
    const scoringResult = await this.processPRScoring({
      prNumber: pr.prNumber,
      repositoryId: pr.repositoryId,
      repositoryFullName: pr.repositoryFullName || pr.repositoryId,
      githubUsername: pr.githubUsername,
      title: pr.title,
      testsPassed: true,
      reviewed: true,
      merged: true,
      issueNumber: pr.issueNumber,
      issueLabels: pr.issueLabels,
      prLabels: pr.labels,
    });

    // 2. Update PR state to MERGED
    await updateDoc(doc(db, 'pullRequests', pr.id), {
      status: 'MERGED',
      merged: true,
      correct: true,
      reviewNotes: mergeReason,
      updatedAt: now,
    });

    // 3. Create mandatory audit record in reviews collection
    const reviewId = `rev_${Date.now()}_${pr.prNumber}`;
    const reviewDoc: FirestoreReview = {
      id: reviewId,
      prId: pr.id,
      prNumber: pr.prNumber,
      repositoryId: pr.repositoryId,
      status: 'FORCE_MERGED',
      reason: mergeReason,
      reviewedBy: adminUsername,
      pointsAwarded: scoringResult.newPointsAwarded,
      createdAt: now,
    };
    await setDoc(doc(db, 'reviews', reviewId), reviewDoc);

    return { pointsAwarded: scoringResult.newPointsAwarded };
  },

  /**
   * Admin Action: ADJUST SCORE
   * Creates an auditable scoreEvent and updates participant totalScore.
   * Never silently alters score without an audit record.
   */
  async adjustScoreWithAudit(
    participantId: string,
    githubUsername: string,
    deltaPoints: number,
    adminUsername: string,
    auditReason: string,
    prId?: string,
    prNumber?: number
  ): Promise<number> {
    if (!isFirebaseConfigured()) return deltaPoints;

    const now = new Date().toISOString();
    const eventId = `se_audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let pId = participantId;
    if (!pId && githubUsername) {
      const q = query(collection(db, 'participants'), where('githubUsername', '==', githubUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        pId = snap.docs[0].id;
      }
    }

    // 1. Create auditable scoreEvent
    const auditEvent: FirestoreScoreEvent = {
      id: eventId,
      participantId: pId || githubUsername,
      githubUsername,
      type: deltaPoints >= 0 ? 'ADMIN_SCORE_AWARD' : 'ADMIN_SCORE_PENALTY',
      points: deltaPoints,
      prId,
      prNumber,
      reason: `[Audited by ${adminUsername}]: ${auditReason}`,
      idempotencyKey: eventId,
      timestamp: now,
    };
    await setDoc(doc(db, 'scoreEvents', eventId), auditEvent);

    // 2. Update Participant denormalized cache
    let newScore = deltaPoints;
    if (pId) {
      const pRef = doc(db, 'participants', pId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const currentScore = pSnap.data()?.totalScore || 0;
        newScore = Math.max(0, currentScore + deltaPoints);
        await updateDoc(pRef, {
          totalScore: newScore,
          updatedAt: now,
        });
      }
    }

    // 3. Also log review record if associated with a PR
    if (prId) {
      const reviewId = `rev_adj_${Date.now()}`;
      await setDoc(doc(db, 'reviews', reviewId), {
        id: reviewId,
        prId,
        prNumber,
        status: 'SCORE_ADJUSTED',
        reason: auditReason,
        reviewedBy: adminUsername,
        pointsAwarded: deltaPoints,
        createdAt: now,
      });
    }

    return newScore;
  },
};
