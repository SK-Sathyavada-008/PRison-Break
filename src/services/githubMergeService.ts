// ─────────────────────────────────────────────
// GitHub Auto-Merge Service
// Merges approved pull requests directly via GitHub REST API
// Updates Firestore status and triggers scoring engine
// ─────────────────────────────────────────────

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { scoringEngine } from './scoringEngine';

export interface MergeResult {
  success: boolean;
  merged: boolean;
  message: string;
  sha?: string;
  isConflict?: boolean;
}

export const githubMergeService = {
  /**
   * Merges an approved Pull Request on GitHub.
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    options?: {
      commitTitle?: string;
      commitMessage?: string;
      githubToken?: string;
    }
  ): Promise<MergeResult> {
    const fullName = `${owner}/${repo}`;
    const token =
      options?.githubToken ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) ||
      '';

    if (!token) {
      return {
        success: false,
        merged: false,
        message: 'No GitHub Token configured. Add GITHUB_TOKEN to .env to allow auto-merging.',
      };
    }

    const headers: Record<string, string> = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'PRison-Break-AutoMerge',
    };

    // 1. Verify PR mergeability first
    try {
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers,
      });

      if (!prRes.ok) {
        throw new Error(`Failed to check PR #${prNumber} on GitHub: HTTP ${prRes.status}`);
      }

      const prData = await prRes.json();

      if (prData.merged) {
        return {
          success: true,
          merged: true,
          message: `PR #${prNumber} is already merged on GitHub.`,
        };
      }

      if (prData.state === 'closed') {
        return {
          success: false,
          merged: false,
          message: `PR #${prNumber} is closed on GitHub and cannot be merged.`,
        };
      }

      if (prData.mergeable_state === 'dirty' || prData.mergeable === false) {
        return {
          success: false,
          merged: false,
          isConflict: true,
          message: `PR #${prNumber} has merge conflicts with the base branch. Conflicts must be resolved before merging.`,
        };
      }
    } catch (err: any) {
      console.warn(`[GitHubMerge] Pre-check warning for PR #${prNumber}:`, err);
    }

    // 2. Execute GitHub merge API
    try {
      const mergeUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`;
      const mergeRes = await fetch(mergeUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          commit_title: options?.commitTitle || `Auto-merged by PRison Control AI Warden (PR #${prNumber})`,
          commit_message: options?.commitMessage || 'Validated and approved by automated code evaluation.',
          merge_method: 'merge',
        }),
      });

      const data = await mergeRes.json().catch(() => ({}));

      if (!mergeRes.ok) {
        if (mergeRes.status === 405) {
          return {
            success: false,
            merged: false,
            isConflict: true,
            message: data.message || `PR #${prNumber} cannot be merged (branch conflicts or protection rules).`,
          };
        }
        if (mergeRes.status === 409) {
          return {
            success: false,
            merged: false,
            isConflict: true,
            message: 'Conflict occurred while attempting to merge base branch.',
          };
        }
        return {
          success: false,
          merged: false,
          message: `GitHub API error (${mergeRes.status}): ${data.message || 'Unknown merge error'}`,
        };
      }

      // Merge successful on GitHub
      const sha = data.sha;
      const now = new Date().toISOString();

      // 3. Update Firestore Pull Request record & trigger scoring
      if (isFirebaseConfigured()) {
        try {
          // Find the PR document ID
          const repoId = repo;
          const prId = `pr_${repoId}_${prNumber}`;
          const prDocRef = doc(db, 'pullRequests', prId);
          const prSnap = await getDoc(prDocRef);

          let author = 'unknown';
          let title = `PR #${prNumber}`;
          let issueNumber = 0;
          let prLabels: string[] = [];

          if (prSnap.exists()) {
            const existing = prSnap.data();
            author = existing.githubUsername || author;
            title = existing.title || title;
            issueNumber = existing.issueNumber || issueNumber;
            prLabels = existing.labels || prLabels;

            await setDoc(
              prDocRef,
              {
                status: 'merged',
                processingState: 'MERGED',
                merged: true,
                correct: true,
                score: (existing.score || 0) + 15,
                updatedAt: now,
              },
              { merge: true }
            );
          }

          // Trigger deterministic scoring engine for merged state (+15 XP, +10 XP correct, first PR bonus)
          await scoringEngine.processPRScoring({
            prNumber,
            repositoryId: repoId,
            repositoryFullName: fullName,
            githubUsername: author,
            title,
            testsPassed: true,
            reviewed: true,
            merged: true,
            issueNumber,
            prLabels,
          });

          console.log(`[GitHubMerge] Auto-merged PR #${prNumber} and updated scoring engine for @${author}.`);
        } catch (dbErr) {
          console.error('[GitHubMerge] Error updating Firestore after merge:', dbErr);
        }
      }

      return {
        success: true,
        merged: true,
        sha,
        message: `PR #${prNumber} successfully auto-merged on GitHub and scored!`,
      };
    } catch (err: any) {
      console.error(`[GitHubMerge] Error merging PR #${prNumber}:`, err);
      return {
        success: false,
        merged: false,
        message: err.message || 'Network error executing GitHub merge',
      };
    }
  },
};
