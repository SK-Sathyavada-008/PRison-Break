// ─────────────────────────────────────────────
// Pull Request Service — Firestore Operations
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { PullRequest, FirestorePullRequest, PRStatus, TestStatus } from '../types';
import { mockPullRequests } from '../data/mockData';

const COLLECTION_NAME = 'pullRequests';

export function mapFirestoreToPullRequest(data: FirestorePullRequest): PullRequest {
  const statusStr = String(data.status || 'open');
  const prStatus: PRStatus =
    statusStr === 'AUTO_APPROVED' ? 'AUTO_APPROVED' :
    statusStr === 'PENDING_REVIEW' ? 'PENDING_REVIEW' :
    statusStr === 'REJECTED' ? 'REJECTED' :
    statusStr === 'MERGED' || statusStr === 'merged' ? 'merged' :
    statusStr === 'closed' ? 'closed' :
    statusStr === 'flagged' ? 'flagged' :
    statusStr === 'pending' ? 'pending' : 'open';

  const testStatus: TestStatus =
    data.testsPassed ? 'passing' : 'failing';

  return {
    id: data.id,
    number: data.prNumber,
    title: data.title,
    repository: data.repositoryFullName || data.repositoryId,
    repositoryId: data.repositoryId,
    repositoryFullName: data.repositoryFullName,
    author: data.githubUsername,
    githubUsername: data.githubUsername,
    issueNumber: data.issueNumber,
    status: prStatus,
    processingState: data.processingState || (
      prStatus === 'AUTO_APPROVED' ? 'AUTO_APPROVED' :
      prStatus === 'PENDING_REVIEW' ? 'PENDING_REVIEW' :
      prStatus === 'REJECTED' ? 'REJECTED' :
      prStatus === 'merged' ? 'MERGED' : undefined
    ),
    testStatus,
    testsPassed: data.testsPassed,
    correct: data.correct,
    merged: data.merged,
    score: data.score,
    labels: data.labels || [],
    issueLabels: data.issueLabels || [],
    url: data.url,
    validationChecks: data.validationChecks,
    validationReasons: data.validationReasons || [],
    validationSignals: data.validationSignals,
    reviewNotes: data.reviewNotes,
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt,
    aiValidation: data.aiValidation,
    baseBranch: data.baseBranch,
    headBranch: data.headBranch,
    baseCommitSha: data.baseCommitSha,
    headCommitSha: data.headCommitSha,
    commitShas: data.commitShas || [],
    commitMessages: data.commitMessages || [],
    commits: data.commits || [],
    changedFilesList: data.changedFilesList || [],
    associatedAssignedIssueIds: data.associatedAssignedIssueIds || data.issueNumbers || [],
    attributionWarnings: data.attributionWarnings || [],
    duplicateSubmissionWarning: data.duplicateSubmissionWarning || data.hasMultiplePRViolation,
    hasMultiplePRViolation: data.hasMultiplePRViolation,
    isDraft: data.isDraft,
    gradingRecords: data.gradingRecords || [],
    teamId: data.teamId,
    solvedIssueNumbers: data.solvedIssueNumbers || data.issueNumbers || (data.issueNumber ? [data.issueNumber] : []),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export const pullRequestService = {
  /**
   * Subscribes to pull requests in real time.
   */
  subscribeToPullRequests(
    onUpdate: (prs: PullRequest[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      onUpdate(mockPullRequests);
      return () => {};
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      return onSnapshot(
        colRef,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate([]);
            return;
          }

          const prs: PullRequest[] = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FirestorePullRequest))
            .filter((d) => Boolean(d.prNumber && d.title && d.title !== 'undefined'))
            .map(mapFirestoreToPullRequest);
          onUpdate(prs);
        },
        (error) => {
          console.error('[PullRequestService] Firestore subscription error:', error);
          if (onError) onError(error);
          else onUpdate(mockPullRequests);
        }
      );
    } catch (err) {
      console.warn('[PullRequestService] Failed to establish real-time listener:', err);
      onUpdate(mockPullRequests);
      return () => {};
    }
  },

  /**
   * Fetch all pull requests once.
   */
  async getPullRequests(): Promise<PullRequest[]> {
    if (!isFirebaseConfigured()) return mockPullRequests;

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FirestorePullRequest))
        .filter((d) => Boolean(d.prNumber && d.title && d.title !== 'undefined'))
        .map(mapFirestoreToPullRequest);
    } catch (error) {
      console.error('[PullRequestService] Error fetching PRs:', error);
      return mockPullRequests;
    }
  },

  /**
   * Adds or updates a pull request document.
   */
  async savePullRequest(pr: Partial<FirestorePullRequest> & { id?: string }): Promise<string> {
    const id = pr.id || `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const data: FirestorePullRequest = {
      id,
      repositoryId: pr.repositoryId ?? 'unknown-repo',
      prNumber: pr.prNumber ?? 1,
      githubUsername: pr.githubUsername ?? 'anonymous',
      issueNumber: pr.issueNumber ?? 0,
      title: pr.title ?? 'Untitled PR',
      status: pr.status ?? 'open',
      testsPassed: pr.testsPassed ?? false,
      correct: pr.correct ?? false,
      merged: pr.merged ?? false,
      score: pr.score ?? 0,
      createdAt: pr.createdAt ?? now,
      updatedAt: now,
    };

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await setDoc(docRef, data, { merge: true });
    }

    return id;
  },

  /**
   * Seed helper: populates mock PRs into Firestore.
   */
  async seedInitialPullRequests(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    for (const pr of mockPullRequests) {
      const firestoreData: FirestorePullRequest = {
        id: pr.id,
        repositoryId: pr.repository,
        prNumber: pr.number,
        githubUsername: pr.githubUsername,
        issueNumber: pr.issueNumber ?? 1,
        title: pr.title,
        status: pr.status,
        testsPassed: pr.testStatus === 'passing',
        correct: pr.status === 'merged',
        merged: pr.status === 'merged',
        score: pr.score,
        createdAt: pr.createdAt,
        updatedAt: pr.createdAt,
      };
      await setDoc(doc(db, COLLECTION_NAME, pr.id), firestoreData);
    }
  },
};
