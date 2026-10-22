// ─────────────────────────────────────────────
// PRison Break Issue Service
// Manages competition issues, trusted difficulty parsing,
// and student-level issue assignments with duplicate detection.
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { FirestoreIssue, IssueDifficulty } from '../types';
import { ISSUE_DIFFICULTY_POINTS } from '../types';

export const initialMockIssues: FirestoreIssue[] = [
  // Squad 1 issues (squard_1)
  {
    id: 'issue_squard_1_1',
    repositoryId: 'squard_1',
    repositoryFullName: 'PRison-Break-2026/squard_1',
    issueNumber: 1,
    title: 'Easy: Implement matrix rotation algorithm in Java',
    difficulty: 'EASY',
    basePoints: 10,
    assignedStudentId: 's_alex_chen',
    assignedStudentUsername: 'alex_chen',
    teamId: 'team_squard_1',
    url: 'https://github.com/PRison-Break-2026/squard_1/issues/1',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:easy'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_1_2',
    repositoryId: 'squard_1',
    repositoryFullName: 'PRison-Break-2026/squard_1',
    issueNumber: 2,
    title: 'Medium: Concurrent worker thread pool optimization',
    difficulty: 'MEDIUM',
    basePoints: 20,
    assignedStudentId: 's_maya_lin',
    assignedStudentUsername: 'maya_lin',
    teamId: 'team_squard_1',
    url: 'https://github.com/PRison-Break-2026/squard_1/issues/2',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:medium'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_1_3',
    repositoryId: 'squard_1',
    repositoryFullName: 'PRison-Break-2026/squard_1',
    issueNumber: 3,
    title: 'Hard: Bytecode instrumented memory leak detector',
    difficulty: 'HARD',
    basePoints: 30,
    assignedStudentId: 's_devon_v',
    assignedStudentUsername: 'devon_v',
    teamId: 'team_squard_1',
    url: 'https://github.com/PRison-Break-2026/squard_1/issues/3',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_1_4',
    repositoryId: 'squard_1',
    repositoryFullName: 'PRison-Break-2026/squard_1',
    issueNumber: 4,
    title: 'Very Hard: Lock-free distributed consensus protocol',
    difficulty: 'VERY_HARD',
    basePoints: 40,
    assignedStudentId: 's_sara_k',
    assignedStudentUsername: 'sara_k',
    teamId: 'team_squard_1',
    url: 'https://github.com/PRison-Break-2026/squard_1/issues/4',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:very-hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },

  // Squad 2 issues (squard_2)
  {
    id: 'issue_squard_2_1',
    repositoryId: 'squard_2',
    repositoryFullName: 'PRison-Break-2026/squard_2',
    issueNumber: 1,
    title: 'Easy: String compression and dictionary encoder',
    difficulty: 'EASY',
    basePoints: 10,
    assignedStudentId: 's_marcus_r',
    assignedStudentUsername: 'marcus_r',
    teamId: 'team_squard_2',
    url: 'https://github.com/PRison-Break-2026/squard_2/issues/1',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:easy'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_2_2',
    repositoryId: 'squard_2',
    repositoryFullName: 'PRison-Break-2026/squard_2',
    issueNumber: 2,
    title: 'Medium: Graph shortest path with dynamic weights',
    difficulty: 'MEDIUM',
    basePoints: 20,
    assignedStudentId: 's_elena_p',
    assignedStudentUsername: 'elena_p',
    teamId: 'team_squard_2',
    url: 'https://github.com/PRison-Break-2026/squard_2/issues/2',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:medium'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_2_3',
    repositoryId: 'squard_2',
    repositoryFullName: 'PRison-Break-2026/squard_2',
    issueNumber: 3,
    title: 'Hard: Custom JVM garbage collector simulation',
    difficulty: 'HARD',
    basePoints: 30,
    assignedStudentId: 's_kai_tanaka',
    assignedStudentUsername: 'kai_tanaka',
    teamId: 'team_squard_2',
    url: 'https://github.com/PRison-Break-2026/squard_2/issues/3',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_2_4',
    repositoryId: 'squard_2',
    repositoryFullName: 'PRison-Break-2026/squard_2',
    issueNumber: 4,
    title: 'Very Hard: High-throughput async non-blocking NIO server',
    difficulty: 'VERY_HARD',
    basePoints: 40,
    assignedStudentId: 's_zara_j',
    assignedStudentUsername: 'zara_j',
    teamId: 'team_squard_2',
    url: 'https://github.com/PRison-Break-2026/squard_2/issues/4',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:very-hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },

  // Squad 3 issues (squard_3)
  {
    id: 'issue_squard_3_1',
    repositoryId: 'squard_3',
    repositoryFullName: 'PRison-Break-2026/squard_3',
    issueNumber: 1,
    title: 'Easy: JSON streaming tokenizer and parser',
    difficulty: 'EASY',
    basePoints: 10,
    assignedStudentId: 's_rohit_s',
    assignedStudentUsername: 'rohit_s',
    teamId: 'team_squard_3',
    url: 'https://github.com/PRison-Break-2026/squard_3/issues/1',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:easy'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_3_2',
    repositoryId: 'squard_3',
    repositoryFullName: 'PRison-Break-2026/squard_3',
    issueNumber: 2,
    title: 'Medium: AVL tree self-balancing index',
    difficulty: 'MEDIUM',
    basePoints: 20,
    assignedStudentId: 's_ananya_m',
    assignedStudentUsername: 'ananya_m',
    teamId: 'team_squard_3',
    url: 'https://github.com/PRison-Break-2026/squard_3/issues/2',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:medium'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_3_3',
    repositoryId: 'squard_3',
    repositoryFullName: 'PRison-Break-2026/squard_3',
    issueNumber: 3,
    title: 'Hard: Distributed transactional write-ahead log',
    difficulty: 'HARD',
    basePoints: 30,
    assignedStudentId: 's_vikram_n',
    assignedStudentUsername: 'vikram_n',
    teamId: 'team_squard_3',
    url: 'https://github.com/PRison-Break-2026/squard_3/issues/3',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_3_4',
    repositoryId: 'squard_3',
    repositoryFullName: 'PRison-Break-2026/squard_3',
    issueNumber: 4,
    title: 'Very Hard: Zero-copy packet filter with native JNI bridge',
    difficulty: 'VERY_HARD',
    basePoints: 40,
    assignedStudentId: 's_deepa_k',
    assignedStudentUsername: 'deepa_k',
    teamId: 'team_squard_3',
    url: 'https://github.com/PRison-Break-2026/squard_3/issues/4',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:very-hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },

  // Squad 4 issues (squard_4)
  {
    id: 'issue_squard_4_1',
    repositoryId: 'squard_4',
    repositoryFullName: 'PRison-Break-2026/squard_4',
    issueNumber: 1,
    title: 'Easy: Bitwise permission mask evaluator',
    difficulty: 'EASY',
    basePoints: 10,
    assignedStudentId: 's_lucas_b',
    assignedStudentUsername: 'lucas_b',
    teamId: 'team_squard_4',
    url: 'https://github.com/PRison-Break-2026/squard_4/issues/1',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:easy'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_4_2',
    repositoryId: 'squard_4',
    repositoryFullName: 'PRison-Break-2026/squard_4',
    issueNumber: 2,
    title: 'Medium: Consistent hashing ring with virtual nodes',
    difficulty: 'MEDIUM',
    basePoints: 20,
    assignedStudentId: 's_chloe_d',
    assignedStudentUsername: 'chloe_d',
    teamId: 'team_squard_4',
    url: 'https://github.com/PRison-Break-2026/squard_4/issues/2',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:medium'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_4_3',
    repositoryId: 'squard_4',
    repositoryFullName: 'PRison-Break-2026/squard_4',
    issueNumber: 3,
    title: 'Hard: Raft leader election state machine in Java',
    difficulty: 'HARD',
    basePoints: 30,
    assignedStudentId: 's_mateo_g',
    assignedStudentUsername: 'mateo_g',
    teamId: 'team_squard_4',
    url: 'https://github.com/PRison-Break-2026/squard_4/issues/3',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'issue_squard_4_4',
    repositoryId: 'squard_4',
    repositoryFullName: 'PRison-Break-2026/squard_4',
    issueNumber: 4,
    title: 'Very Hard: B-Tree database engine with ACID transactions',
    difficulty: 'VERY_HARD',
    basePoints: 40,
    assignedStudentId: 's_zoe_w',
    assignedStudentUsername: 'zoe_w',
    teamId: 'team_squard_4',
    url: 'https://github.com/PRison-Break-2026/squard_4/issues/4',
    active: true,
    gradingStatus: 'UNGRADED',
    labels: ['difficulty:very-hard'],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
  },
];

let inMemoryIssues = [...initialMockIssues];

export const issueService = {
  /**
   * Reads difficulty strictly from trusted GitHub labels.
   * Rejects untrusted PR descriptions or titles.
   */
  parseDifficultyFromLabels(labels: string[] = []): IssueDifficulty | null {
    const normalized = labels.map((l) => l.toLowerCase().trim());
    if (
      normalized.includes('difficulty:very-hard') ||
      normalized.includes('difficulty:very_hard') ||
      normalized.includes('points:40')
    ) {
      return 'VERY_HARD';
    }
    if (
      normalized.includes('difficulty:hard') ||
      normalized.includes('points:30')
    ) {
      return 'HARD';
    }
    if (
      normalized.includes('difficulty:medium') ||
      normalized.includes('points:20')
    ) {
      return 'MEDIUM';
    }
    if (
      normalized.includes('difficulty:easy') ||
      normalized.includes('points:10')
    ) {
      return 'EASY';
    }
    return null;
  },

  /**
   * Fetches all registered issues.
   */
  async getIssues(): Promise<FirestoreIssue[]> {
    if (!isFirebaseConfigured()) {
      return [...inMemoryIssues];
    }
    try {
      const q = query(collection(db, 'issues'));
      const snap = await getDocs(q);
      if (snap.empty) {
        return [...inMemoryIssues];
      }
      return snap.docs.map((d) => d.data() as FirestoreIssue);
    } catch (err) {
      console.warn('[issueService] Firestore read failed, using memory issues:', err);
      return [...inMemoryIssues];
    }
  },

  /**
   * Subscribes to real-time issues collection.
   */
  subscribeToIssues(
    onUpdate: (issues: FirestoreIssue[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!isFirebaseConfigured()) {
      onUpdate([...inMemoryIssues]);
      return () => {};
    }

    try {
      const issuesRef = collection(db, 'issues');
      const unsubscribe = onSnapshot(
        issuesRef,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate([...inMemoryIssues]);
          } else {
            const list = snapshot.docs.map((d) => d.data() as FirestoreIssue);
            onUpdate(list);
          }
        },
        (error) => {
          console.error('[issueService] Snapshot error:', error);
          onError?.(error);
          onUpdate([...inMemoryIssues]);
        }
      );
      return unsubscribe;
    } catch (err: any) {
      console.error('[issueService] Subscription init error:', err);
      onError?.(err);
      onUpdate([...inMemoryIssues]);
      return () => {};
    }
  },

  /**
   * Saves or creates a competition issue with server-side validation.
   */
  async saveIssue(issue: Partial<FirestoreIssue> & { repositoryId: string; issueNumber: number }): Promise<FirestoreIssue> {
    const now = new Date().toISOString();
    const id = issue.id || `issue_${issue.repositoryId}_${issue.issueNumber}`;
    
    // Strict difficulty verification
    const difficulty: IssueDifficulty = issue.difficulty || 'EASY';
    const basePoints = ISSUE_DIFFICULTY_POINTS[difficulty] ?? 10;

    const fullIssue: FirestoreIssue = {
      id,
      repositoryId: issue.repositoryId,
      repositoryFullName: issue.repositoryFullName || issue.repositoryId,
      issueNumber: issue.issueNumber,
      title: issue.title || `Issue #${issue.issueNumber}`,
      difficulty,
      basePoints,
      assignedStudentId: issue.assignedStudentId,
      assignedStudentUsername: issue.assignedStudentUsername,
      teamId: issue.teamId,
      url: issue.url || `https://github.com/${issue.repositoryFullName || issue.repositoryId}/issues/${issue.issueNumber}`,
      active: issue.active ?? true,
      gradingStatus: issue.gradingStatus || 'UNGRADED',
      correctnessScore: issue.correctnessScore,
      qualityScore: issue.qualityScore,
      commitQualityScore: issue.commitQualityScore,
      finalScore: issue.finalScore,
      labels: issue.labels || [`difficulty:${difficulty.toLowerCase().replace('_', '-')}`],
      createdAt: issue.createdAt || now,
      updatedAt: now,
    };

    // Update in-memory
    const idx = inMemoryIssues.findIndex((i) => i.id === id);
    if (idx >= 0) {
      inMemoryIssues[idx] = fullIssue;
    } else {
      inMemoryIssues.push(fullIssue);
    }

    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'issues', id), fullIssue);
    }

    return fullIssue;
  },

  /**
   * Batch seeds issues into Firestore.
   */
  async seedIssues(): Promise<void> {
    if (!isFirebaseConfigured()) return;
    for (const issue of initialMockIssues) {
      await setDoc(doc(db, 'issues', issue.id), issue);
    }
  },

  /**
   * Detects duplicate issue assignments within the issue inventory.
   * Flags any issue number assigned to multiple students or squads.
   */
  validateIssueAssignments(issues: FirestoreIssue[]): {
    duplicates: Array<{
      issueNumber: number;
      repositoryId: string;
      assignedStudents: string[];
      teamIds: string[];
    }>;
    unassignedCount: number;
  } {
    const repoIssueMap = new Map<string, { assignedStudents: string[]; teamIds: string[] }>();
    let unassignedCount = 0;

    for (const issue of issues) {
      if (!issue.active) continue;
      if (!issue.assignedStudentUsername && !issue.assignedStudentId) {
        unassignedCount++;
        continue;
      }

      const key = `${issue.repositoryId}#${issue.issueNumber}`;
      const entry = repoIssueMap.get(key) || { assignedStudents: [], teamIds: [] };

      const student = issue.assignedStudentUsername || issue.assignedStudentId || 'unknown';
      if (!entry.assignedStudents.includes(student)) {
        entry.assignedStudents.push(student);
      }
      if (issue.teamId && !entry.teamIds.includes(issue.teamId)) {
        entry.teamIds.push(issue.teamId);
      }
      repoIssueMap.set(key, entry);
    }

    const duplicates: Array<{
      issueNumber: number;
      repositoryId: string;
      assignedStudents: string[];
      teamIds: string[];
    }> = [];

    repoIssueMap.forEach((val, key) => {
      if (val.assignedStudents.length > 1 || val.teamIds.length > 1) {
        const [repositoryId, numStr] = key.split('#');
        duplicates.push({
          repositoryId,
          issueNumber: parseInt(numStr, 10),
          assignedStudents: val.assignedStudents,
          teamIds: val.teamIds,
        });
      }
    });

    return { duplicates, unassignedCount };
  },

  /**
   * Deletes an issue.
   */
  async deleteIssue(issueId: string): Promise<void> {
    inMemoryIssues = inMemoryIssues.filter((i) => i.id !== issueId);
    if (isFirebaseConfigured()) {
      await deleteDoc(doc(db, 'issues', issueId));
    }
  },
};
