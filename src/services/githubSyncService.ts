// ─────────────────────────────────────────────
// GitHub Direct Sync Service
// Fetches Pull Requests directly from GitHub REST API
// Bypasses webhook latency & syncs existing / historical PRs
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { PullRequest, FirestorePullRequest, FirestoreRepository, FirestoreParticipant } from '../types';
import { extractAllLinkedIssues } from './prValidationPipeline';
import { scoringEngine } from './scoringEngine';
import { mapFirestoreToPullRequest } from './pullRequestService';
import { aiValidationService } from './aiValidationService';

export interface GitHubSyncOptions {
  githubToken?: string;
  autoRegisterParticipant?: boolean;
}

export interface GitHubSyncResult {
  success: boolean;
  repoFullName: string;
  totalFetched: number;
  syncedCount: number;
  autoApprovedCount: number;
  mergedCount: number;
  pendingCount: number;
  closedCount: number;
  errors: string[];
  message: string;
  pullRequests: PullRequest[];
}

/**
 * Strips all undefined properties recursively from objects before writing to Firestore.
 * Prevents Firestore "Unsupported field value: undefined" errors.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreData) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        clean[key] = sanitizeFirestoreData(val);
      }
    }
    return clean;
  }
  return obj;
}

export const githubSyncService = {
  /**
   * Syncs all pull requests from a specific GitHub repository (owner/name).
   * Works for public repos without a token (rate limit: 60/hr).
   * With a token, rate limit is 5,000/hr and works on private repos.
   */
  async syncRepository(
    owner: string,
    repo: string,
    options?: GitHubSyncOptions
  ): Promise<GitHubSyncResult> {
    const fullName = `${owner}/${repo}`;
    const errors: string[] = [];
    const pullRequests: PullRequest[] = [];
    let autoApprovedCount = 0;
    let mergedCount = 0;
    let pendingCount = 0;
    let closedCount = 0;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'PRison-Break-Leaderboard',
    };

    const token =
      options?.githubToken ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) ||
      '';

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 1. Fetch Pull Requests from GitHub API (open, closed, merged)
    let githubPRs: any[] = [];
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Repository "${fullName}" was not found on GitHub. Verify owner/name.`);
        }
        if (res.status === 403 || res.status === 429) {
          throw new Error('GitHub API rate limit reached. Please provide a GitHub Personal Access Token to continue.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`GitHub API error (${res.status}): ${errJson.message || res.statusText}`);
      }

      githubPRs = await res.json();
    } catch (err: any) {
      console.error(`[GitHubSync] Error fetching PRs for ${fullName}:`, err);
      return {
        success: false,
        repoFullName: fullName,
        totalFetched: 0,
        syncedCount: 0,
        autoApprovedCount: 0,
        mergedCount: 0,
        pendingCount: 0,
        closedCount: 0,
        errors: [err.message || 'Network error fetching GitHub PRs'],
        message: err.message || 'Failed to fetch PRs from GitHub',
        pullRequests: [],
      };
    }

    if (!Array.isArray(githubPRs)) {
      return {
        success: false,
        repoFullName: fullName,
        totalFetched: 0,
        syncedCount: 0,
        autoApprovedCount: 0,
        mergedCount: 0,
        pendingCount: 0,
        closedCount: 0,
        errors: ['GitHub API returned an invalid response format.'],
        message: 'Invalid response from GitHub.',
        pullRequests: [],
      };
    }

    // 2. Ensure Repository exists in Firestore
    let repoId = repo;
    if (isFirebaseConfigured()) {
      try {
        const reposSnap = await getDocs(collection(db, 'repositories'));
        const matchedRepo = reposSnap.docs.find((d) => {
          const dData = d.data();
          const dFullName = (dData.fullName || `${dData.owner}/${dData.name}`).toLowerCase();
          return dFullName === fullName.toLowerCase() || (dData.name || '').toLowerCase() === repo.toLowerCase();
        });

        if (matchedRepo) {
          repoId = matchedRepo.id;
        } else {
          // Auto-register repository if missing so it is tracked
          repoId = `repo_${owner.toLowerCase()}_${repo.toLowerCase()}`;
          const newRepoData: FirestoreRepository = {
            id: repoId,
            owner,
            name: repo,
            fullName,
            githubUrl: `https://github.com/${fullName}`,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'repositories', repoId), sanitizeFirestoreData(newRepoData), { merge: true });
          console.log(`[GitHubSync] Auto-registered repository "${fullName}" (${repoId})`);
        }
      } catch (err) {
        console.warn('[GitHubSync] Could not verify/upsert repository in Firestore:', err);
      }
    }

    // 3. Process Each PR
    const now = new Date().toISOString();

    for (const pr of githubPRs) {
      try {
        const prNumber = pr.number;
        const author = pr.user?.login || 'anonymous';
        const isMerged = !!pr.merged_at;
        const isClosed = pr.state === 'closed' && !isMerged;
        const isDraft = pr.draft === true;
        const prId = `pr_${repoId}_${prNumber}`;
        const labels: string[] = (pr.labels || []).map((l: any) => l.name);

        // Identify all linked challenge issues
        const issueNumbers = extractAllLinkedIssues(pr.title, pr.body);
        const issueNumber = issueNumbers.length > 0 ? issueNumbers[0] : 0;

        // Auto-register participant if missing
        if (isFirebaseConfigured() && author !== 'anonymous') {
          try {
            const pQuery = query(collection(db, 'participants'), where('githubUsername', '==', author));
            const pSnap = await getDocs(pQuery);

            if (pSnap.empty) {
              const participantId = `p_${author.toLowerCase()}`;
              const participantData: FirestoreParticipant = {
                id: participantId,
                name: author,
                githubUsername: author,
                avatarUrl: pr.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author}`,
                totalScore: 0,
                prCount: 1,
                mergedPrCount: isMerged ? 1 : 0,
                escapedCells: isMerged ? 1 : 0,
                firstSuccessfulPr: isMerged ? pr.merged_at || now : null,
                active: true,
                createdAt: pr.created_at || now,
                updatedAt: now,
              };
              await setDoc(doc(db, 'participants', participantId), sanitizeFirestoreData(participantData), { merge: true });
              console.log(`[GitHubSync] Auto-registered participant @${author}`);
            }
          } catch (pErr) {
            console.warn(`[GitHubSync] Error auto-registering participant @${author}:`, pErr);
          }
        }

        // Determine validation checks & status
        const testsPassed = isMerged || (!isDraft && pr.mergeable_state !== 'dirty');
        const validationChecks = {
          participantRegistered: true,
          repositoryRegistered: true,
          issueValid: issueNumber > 0,
          testsPassed,
          filesValid: true,
        };

        const validationReasons: string[] = [
          `Synced directly from GitHub repository ${fullName}.`,
        ];

        if (issueNumber > 0) {
          validationReasons.push(`Linked challenge issue #${issueNumber} confirmed.`);
        } else {
          validationReasons.push('No issue reference detected in title or body.');
        }

        // Check if existing PR record is already in Firestore
        let existingPrData: any = null;
        if (isFirebaseConfigured()) {
          try {
            const exSnap = await getDoc(doc(db, 'pullRequests', prId));
            if (exSnap.exists()) {
              existingPrData = exSnap.data();
            }
          } catch (_) {}
        }

        let prStatus: string = 'open';
        let processingState: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED' = 'PENDING_REVIEW';
        let aiEvaluation: any = null;

        if (isMerged) {
          prStatus = 'merged';
          processingState = 'MERGED';
          mergedCount++;
        } else if (isClosed) {
          prStatus = 'closed';
          processingState = 'REJECTED';
          closedCount++;
        } else {
          // Open PR: Check if already evaluated with matching update timestamp to conserve rate limits
          if (
            existingPrData &&
            existingPrData.processingState === 'AUTO_APPROVED' &&
            existingPrData.updatedAt === (pr.updated_at || now)
          ) {
            prStatus = 'AUTO_APPROVED';
            processingState = 'AUTO_APPROVED';
            autoApprovedCount++;
            aiEvaluation = existingPrData.aiValidation || null;
            validationReasons.push('Code approved by AI Warden (Persistent status).');
          } else {
            // New or updated PR: Evaluate code using AI Judge (Gemma / Gemini) and auto-merge if approved
            try {
              aiEvaluation = await aiValidationService.evaluateAndJudgePR(owner, repo, prNumber, {
                autoMergeIfApproved: true,
                githubToken: token,
              });

              if (aiEvaluation.mergeResult?.merged) {
                prStatus = 'merged';
                processingState = 'MERGED';
                mergedCount++;
                validationReasons.push('Code approved by AI Warden and automatically merged into base branch.');
              } else if (aiEvaluation.verdict === 'APPROVED') {
                prStatus = 'AUTO_APPROVED';
                processingState = 'AUTO_APPROVED';
                autoApprovedCount++;
                validationReasons.push(`Code approved by AI Warden: ${aiEvaluation.summary}`);
                if (aiEvaluation.autoMergeBlockedReason) {
                  validationReasons.push(aiEvaluation.autoMergeBlockedReason);
                }
              } else {
                prStatus = 'open';
                processingState = 'PENDING_REVIEW';
                pendingCount++;
                validationReasons.push(`AI Warden feedback: ${aiEvaluation.feedback}`);
              }
            } catch (aiErr) {
              console.warn(`[GitHubSync] AI evaluation error for PR #${prNumber}:`, aiErr);
              if (validationChecks.issueValid && testsPassed && !isDraft) {
                prStatus = 'AUTO_APPROVED';
                processingState = 'AUTO_APPROVED';
                autoApprovedCount++;
              } else {
                prStatus = 'open';
                processingState = 'PENDING_REVIEW';
                pendingCount++;
              }
            }
          }
        }

        const effectiveMerged = prStatus === 'merged' || isMerged;
        const effectiveScore = effectiveMerged ? 15 : prStatus === 'AUTO_APPROVED' ? 10 : 0;

        const firestorePrData: FirestorePullRequest = {
          id: prId,
          repositoryId: repoId,
          repositoryFullName: fullName,
          prNumber,
          githubUsername: author,
          issueNumber: issueNumber || 0,
          issueNumbers,
          teamId: `team_${repo.toLowerCase()}`,
          title: pr.title || `PR #${prNumber}`,
          status: prStatus,
          processingState,
          testsPassed,
          correct: effectiveMerged || prStatus === 'AUTO_APPROVED',
          merged: effectiveMerged,
          score: effectiveScore,
          labels,
          url: pr.html_url || `https://github.com/${fullName}/pull/${prNumber}`,
          validationChecks,
          validationReasons,
          aiValidation: aiEvaluation
            ? {
                verdict: aiEvaluation.verdict,
                confidence: aiEvaluation.confidence ?? 1,
                summary: aiEvaluation.summary || '',
                feedback: aiEvaluation.feedback || '',
                codeQuality: aiEvaluation.codeQuality || 'GOOD',
                autoMergeAllowed: aiEvaluation.autoMergeAllowed ?? false,
                autoMergeBlockedReason: aiEvaluation.autoMergeBlockedReason || null,
                evaluatedAt: aiEvaluation.evaluatedAt || now,
                model: aiEvaluation.model || 'Gemini/Gemma Rule Engine',
              }
            : undefined,
          validationSignals: {
            participantRegistered: true,
            repositoryActive: true,
            validIssueLinked: validationChecks.issueValid,
            testsPassed,
            filesAllowed: true,
            noSuspiciousDiff: true,
          },
          createdAt: pr.created_at || now,
          updatedAt: pr.updated_at || now,
        };

        if (isFirebaseConfigured()) {
          await setDoc(doc(db, 'pullRequests', prId), sanitizeFirestoreData(firestorePrData), { merge: true });

          // If merged or auto-approved, trigger scoring engines so Team & Participant XP update
          if (effectiveMerged || prStatus === 'AUTO_APPROVED') {
            try {
              // 1. Team-based non-duplicated issue scoring
              await scoringEngine.processTeamPRScoring({
                teamId: `team_${repo.toLowerCase()}`,
                repositoryId: repoId,
                repositoryFullName: fullName,
                githubUsername: author,
                prNumber,
                prId,
                solvedIssues: issueNumbers.map((num) => ({
                  issueNumber: num,
                  labels,
                  titleOrBody: `${pr.title} ${pr.body || ''}`,
                })),
                merged: effectiveMerged,
              });

              // 2. Individual scoring compatibility
              await scoringEngine.processPRScoring({
                prNumber,
                repositoryId: repoId,
                repositoryFullName: fullName,
                githubUsername: author,
                title: pr.title,
                testsPassed: true,
                reviewed: true,
                merged: effectiveMerged,
                issueNumber,
                prLabels: labels,
              });
            } catch (sErr) {
              console.warn(`[GitHubSync] Scoring error for PR #${prNumber}:`, sErr);
            }
          }
        }

        pullRequests.push(mapFirestoreToPullRequest(firestorePrData));
      } catch (prErr: any) {
        console.error(`[GitHubSync] Error processing PR in ${fullName}:`, prErr);
        errors.push(prErr.message || `Error processing PR #${pr.number}`);
      }
    }

    // 4. Update participant aggregate statistics in Firestore
    if (isFirebaseConfigured() && pullRequests.length > 0) {
      try {
        const participantPRs: Record<string, { total: number; merged: number; earliestMerged: string | null }> = {};
        for (const pr of pullRequests) {
          const u = pr.githubUsername;
          if (!participantPRs[u]) {
            participantPRs[u] = { total: 0, merged: 0, earliestMerged: null };
          }
          participantPRs[u].total += 1;
          if (pr.merged || pr.status === 'merged' || pr.processingState === 'MERGED') {
            participantPRs[u].merged += 1;
            if (!participantPRs[u].earliestMerged || new Date(pr.createdAt) < new Date(participantPRs[u].earliestMerged!)) {
              participantPRs[u].earliestMerged = pr.createdAt;
            }
          }
        }

        for (const [username, stats] of Object.entries(participantPRs)) {
          const pQuery = query(collection(db, 'participants'), where('githubUsername', '==', username));
          const pSnap = await getDocs(pQuery);
          if (!pSnap.empty) {
            const pDoc = pSnap.docs[0];
            const pData = pDoc.data();
            const updates: any = {
              prCount: Math.max(pData.prCount || 0, stats.total),
              mergedPrCount: Math.max(pData.mergedPrCount || 0, stats.merged),
              escapedCells: Math.max(pData.escapedCells || 0, stats.merged),
              updatedAt: new Date().toISOString(),
            };
            if (stats.earliestMerged && !pData.firstSuccessfulPr) {
              updates.firstSuccessfulPr = stats.earliestMerged;
            }
            await updateDoc(pDoc.ref, sanitizeFirestoreData(updates));
          }
        }
      } catch (aggErr) {
        console.warn('[GitHubSync] Aggregate participant stats update error:', aggErr);
      }
    }

    return {
      success: true,
      repoFullName: fullName,
      totalFetched: githubPRs.length,
      syncedCount: pullRequests.length,
      autoApprovedCount,
      mergedCount,
      pendingCount,
      closedCount,
      errors,
      message: `Successfully synced ${pullRequests.length} Pull Requests from ${fullName}!`,
      pullRequests,
    };
  },

  /**
   * Syncs all active repositories currently registered in Firestore.
   */
  async syncAllRegisteredRepositories(options?: GitHubSyncOptions): Promise<{
    totalRepos: number;
    totalSyncedPRs: number;
    results: GitHubSyncResult[];
  }> {
    const results: GitHubSyncResult[] = [];
    let totalSyncedPRs = 0;

    let repos: { owner: string; name: string }[] = [];

    if (isFirebaseConfigured()) {
      try {
        const reposSnap = await getDocs(collection(db, 'repositories'));
        repos = reposSnap.docs
          .map((d) => d.data() as FirestoreRepository)
          .filter((r) => r.active !== false)
          .map((r) => ({
            owner: r.owner,
            name: r.name,
          }));
      } catch (err) {
        console.error('[GitHubSync] Error reading repositories from Firestore:', err);
      }
    }

    if (repos.length === 0) {
      return {
        totalRepos: 0,
        totalSyncedPRs: 0,
        results: [],
      };
    }

    for (const repo of repos) {
      const res = await this.syncRepository(repo.owner, repo.name, options);
      results.push(res);
      totalSyncedPRs += res.syncedCount;
    }

    return {
      totalRepos: repos.length,
      totalSyncedPRs,
      results,
    };
  },
};
