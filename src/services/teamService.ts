// ─────────────────────────────────────────────
// Team Service — Offline Hackathon Squads & Live Leaderboard
// Deterministic Team Scoring · 4-Student Squads · Non-Duplicated Issue Tracking
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Team, FirestoreTeam, FirestoreIssue, AdminAuditLog, AwardsSummary } from '../types';

const COLLECTION_NAME = 'teams';

// Initial Squad mock data for demo / offline preview mode
export const initialMockTeams: FirestoreTeam[] = [
  {
    id: 'team_squard_1',
    name: 'Squad 1',
    repositoryId: 'squard_1',
    repositoryName: 'squard_1',
    repositoryFullName: 'PRison-Break-2026/squard_1',
    members: [
      {
        studentId: 's_rahul',
        name: 'Rahul Sharma',
        githubUsername: 'rahul123',
        assignedIssues: [1, 2, 3],
        prSubmitted: true,
        prNumber: 42,
        score: 40,
      },
      {
        studentId: 's_ananya',
        name: 'Ananya Krishnan',
        githubUsername: 'ananya01',
        assignedIssues: [4, 5, 6],
        prSubmitted: true,
        prNumber: 43,
        score: 50,
      },
      {
        studentId: 's_arjun',
        name: 'Arjun Dev',
        githubUsername: 'arjun-dev',
        assignedIssues: [7, 8, 9],
        prSubmitted: true,
        prNumber: 44,
        score: 30,
      },
      {
        studentId: 's_priya',
        name: 'Priya Nair',
        githubUsername: 'priya-codes',
        assignedIssues: [10, 11, 12],
        prSubmitted: true,
        prNumber: 45,
        score: 30,
      },
    ],
    totalScore: 140,
    solvedIssues: [
      { issueNumber: 1, difficulty: 'EASY', points: 10, solvedByUsername: 'rahul123', prNumber: 42, solvedAt: '2026-10-22T08:00:00Z' },
      { issueNumber: 2, difficulty: 'HARD', points: 30, solvedByUsername: 'rahul123', prNumber: 42, solvedAt: '2026-10-22T08:00:00Z' },
      { issueNumber: 4, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'ananya01', prNumber: 43, solvedAt: '2026-10-22T08:15:00Z' },
      { issueNumber: 7, difficulty: 'HARD', points: 30, solvedByUsername: 'arjun-dev', prNumber: 44, solvedAt: '2026-10-22T08:20:00Z' },
      { issueNumber: 10, difficulty: 'HARD', points: 30, solvedByUsername: 'priya-codes', prNumber: 45, solvedAt: '2026-10-22T08:30:00Z' },
    ],
    assignedIssueCount: 4,
    validatedIssueCount: 5,
    correctlySolvedIssuesCount: 5,
    veryHardSolvedCount: 1,
    prsSubmitted: 4,
    lastMergedAt: '2026-10-22T08:30:00Z',
    active: true,
    createdAt: '2026-10-21T18:00:00Z',
    updatedAt: '2026-10-22T08:30:00Z',
  },
  {
    id: 'team_squard_2',
    name: 'Squad 2',
    repositoryId: 'squard_2',
    repositoryName: 'squard_2',
    repositoryFullName: 'PRison-Break-2026/squard_2',
    members: [
      {
        studentId: 's_vikram',
        name: 'Vikram Singh',
        githubUsername: 'vikramsingh42',
        assignedIssues: [1, 2, 3],
        prSubmitted: true,
        prNumber: 21,
        score: 30,
      },
      {
        studentId: 's_sneha',
        name: 'Sneha Patel',
        githubUsername: 'snehap',
        assignedIssues: [4, 5, 6],
        prSubmitted: true,
        prNumber: 22,
        score: 30,
      },
      {
        studentId: 's_dev',
        name: 'Dev Kumar',
        githubUsername: 'devk',
        assignedIssues: [7, 8, 9],
        prSubmitted: true,
        prNumber: 23,
        score: 20,
      },
      {
        studentId: 's_riya',
        name: 'Riya Sen',
        githubUsername: 'riya-sen',
        assignedIssues: [10, 11, 12],
        prSubmitted: true,
        prNumber: 24,
        score: 30,
      },
    ],
    totalScore: 110,
    solvedIssues: [
      { issueNumber: 1, difficulty: 'HARD', points: 30, solvedByUsername: 'vikramsingh42', prNumber: 21, solvedAt: '2026-10-22T08:10:00Z' },
      { issueNumber: 4, difficulty: 'HARD', points: 30, solvedByUsername: 'snehap', prNumber: 22, solvedAt: '2026-10-22T08:18:00Z' },
      { issueNumber: 7, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'devk', prNumber: 23, solvedAt: '2026-10-22T08:25:00Z' },
      { issueNumber: 10, difficulty: 'HARD', points: 30, solvedByUsername: 'riya-sen', prNumber: 24, solvedAt: '2026-10-22T08:45:00Z' },
    ],
    validatedIssueCount: 4,
    correctlySolvedIssuesCount: 4,
    assignedIssueCount: 4,
    veryHardSolvedCount: 0,
    prsSubmitted: 4,
    lastMergedAt: '2026-10-22T08:45:00Z',
    active: true,
    createdAt: '2026-10-21T18:00:00Z',
    updatedAt: '2026-10-22T08:45:00Z',
  },
  {
    id: 'team_squard_3',
    name: 'Squad 3',
    repositoryId: 'squard_3',
    repositoryName: 'squard_3',
    repositoryFullName: 'PRison-Break-2026/squard_3',
    members: [
      {
        studentId: 's_rohan',
        name: 'Rohan Gupta',
        githubUsername: 'rohan-g',
        assignedIssues: [1, 2, 3],
        prSubmitted: true,
        prNumber: 12,
        score: 40,
      },
      {
        studentId: 's_meera',
        name: 'Meera Iyer',
        githubUsername: 'meera-i',
        assignedIssues: [4, 5, 6],
        prSubmitted: true,
        prNumber: 13,
        score: 20,
      },
      {
        studentId: 's_aditya',
        name: 'Aditya Roy',
        githubUsername: 'adityaroy',
        assignedIssues: [7, 8, 9],
        prSubmitted: false,
      },
      {
        studentId: 's_pooja',
        name: 'Pooja Verma',
        githubUsername: 'pooja-v',
        assignedIssues: [10, 11, 12],
        prSubmitted: true,
        prNumber: 14,
        score: 20,
      },
    ],
    totalScore: 80,
    solvedIssues: [
      { issueNumber: 1, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'rohan-g', prNumber: 12, solvedAt: '2026-10-22T08:35:00Z' },
      { issueNumber: 4, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'meera-i', prNumber: 13, solvedAt: '2026-10-22T08:40:00Z' },
      { issueNumber: 10, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'pooja-v', prNumber: 14, solvedAt: '2026-10-22T08:50:00Z' },
    ],
    validatedIssueCount: 3,
    correctlySolvedIssuesCount: 3,
    assignedIssueCount: 4,
    veryHardSolvedCount: 1,
    prsSubmitted: 3,
    lastMergedAt: '2026-10-22T08:50:00Z',
    active: true,
    createdAt: '2026-10-21T18:00:00Z',
    updatedAt: '2026-10-22T08:50:00Z',
  },
  {
    id: 'team_squard_4',
    name: 'Squad 4',
    repositoryId: 'squard_4',
    repositoryName: 'squard_4',
    repositoryFullName: 'PRison-Break-2026/squard_4',
    members: [
      {
        studentId: 's_karan',
        name: 'Karan Mehra',
        githubUsername: 'karanm',
        assignedIssues: [1, 2, 3],
        prSubmitted: true,
        prNumber: 5,
        score: 30,
      },
      {
        studentId: 's_divya',
        name: 'Divya Sharma',
        githubUsername: 'divyas',
        assignedIssues: [4, 5, 6],
        prSubmitted: true,
        prNumber: 6,
        score: 20,
      },
      {
        studentId: 's_siddharth',
        name: 'Siddharth Rao',
        githubUsername: 'sidrao',
        assignedIssues: [7, 8, 9],
        prSubmitted: true,
        prNumber: 7,
        score: 20,
      },
      {
        studentId: 's_tanvi',
        name: 'Tanvi Joshi',
        githubUsername: 'tanvij',
        assignedIssues: [10, 11, 12],
        prSubmitted: false,
      },
    ],
    totalScore: 70,
    solvedIssues: [
      { issueNumber: 2, difficulty: 'HARD', points: 30, solvedByUsername: 'karanm', prNumber: 5, solvedAt: '2026-10-22T08:55:00Z' },
      { issueNumber: 5, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'divyas', prNumber: 6, solvedAt: '2026-10-22T09:00:00Z' },
      { issueNumber: 8, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'sidrao', prNumber: 7, solvedAt: '2026-10-22T09:05:00Z' },
    ],
    validatedIssueCount: 3,
    correctlySolvedIssuesCount: 3,
    assignedIssueCount: 4,
    veryHardSolvedCount: 0,
    prsSubmitted: 3,
    lastMergedAt: '2026-10-22T09:05:00Z',
    active: true,
    createdAt: '2026-10-21T18:00:00Z',
    updatedAt: '2026-10-22T09:05:00Z',
  },
];

let inMemoryTeams: Team[] = sortTeams(initialMockTeams.map((t) => mapFirestoreToTeam(t)));
const listeners = new Set<(teams: Team[]) => void>();
const teamRankHistory = new Map<string, number>();

function notifyListeners() {
  const sorted = sortTeams(inMemoryTeams).map((t) => ({
    ...t,
    previousRank: teamRankHistory.get(t.id) ?? t.rank,
  }));
  sorted.forEach((t) => teamRankHistory.set(t.id, t.rank));
  listeners.forEach((fn) => fn(sorted));
}

export function getTeamVeryHardScore(team: Team | FirestoreTeam): number {
  if (team.veryHardScore !== undefined) return team.veryHardScore;
  return (team.solvedIssues || [])
    .filter((s) => s.difficulty === 'VERY_HARD')
    .reduce((sum, s) => sum + (s.points || 0), 0);
}

export function getTeamCorrectnessTotal(team: Team | FirestoreTeam): number {
  if (team.correctnessScoreTotal !== undefined) return team.correctnessScoreTotal;
  return (team.solvedIssues || []).reduce(
    (sum, s) => sum + (s.correctnessScore ?? 1.0),
    0
  );
}

/**
 * Phase 5 Deterministic Team Ranking Comparator:
 * 1. Total validated team XP, descending.
 * 2. Number of accurately solved Very Hard issues, descending.
 * 3. Total Very Hard issue score, descending.
 * 4. Total correctness score across validated issues, descending.
 * 5. If still tied, return 0 (display an explicit tie rather than inventing a winner).
 */
function roundToTwoDecimals(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getTeamTotalXP(team: Team | FirestoreTeam): number {
  if (team.totalXP !== undefined) return team.totalXP;
  if (team.earnedXP !== undefined || team.bonusXP !== undefined) {
    const earned = team.earnedXP ?? (team.totalScore ?? 0);
    const bonus = team.bonusXP ?? 0;
    return roundToTwoDecimals(earned + bonus);
  }
  return team.totalScore ?? 0;
}

export function getTeamEarnedXP(team: Team | FirestoreTeam): number {
  if (team.earnedXP !== undefined) return team.earnedXP;
  if (team.totalScore !== undefined && team.bonusXP !== undefined) {
    return Math.max(0, roundToTwoDecimals(team.totalScore - team.bonusXP));
  }
  return team.totalScore ?? 0;
}

export function getTeamBonusXP(team: Team | FirestoreTeam): number {
  return team.bonusXP ?? 0;
}

/**
 * Phase 5 Deterministic Team Ranking Comparator:
 * 1. Total validated team XP (earnedXP + bonusXP), descending.
 * 2. Number of accurately solved Very Hard issues, descending.
 * 3. Total Very Hard issue score, descending.
 * 4. Total correctness score across validated issues, descending.
 * 5. If still tied, return 0 (display an explicit tie rather than inventing a winner).
 */
export function compareTeamsPhase5(a: Team, b: Team): number {
  // 1. Total validated team XP (totalXP = earnedXP + bonusXP), descending
  const aTotal = getTeamTotalXP(a);
  const bTotal = getTeamTotalXP(b);
  const scoreDiff = bTotal - aTotal;
  if (scoreDiff !== 0) return scoreDiff;

  // 2. Number of accurately solved Very Hard issues, descending
  const vhCountDiff = (b.veryHardSolvedCount ?? 0) - (a.veryHardSolvedCount ?? 0);
  if (vhCountDiff !== 0) return vhCountDiff;

  // 3. Total Very Hard issue score, descending
  const vhScoreDiff = getTeamVeryHardScore(b) - getTeamVeryHardScore(a);
  if (vhScoreDiff !== 0) return vhScoreDiff;

  // 4. Total correctness score across validated issues, descending
  const correctnessDiff = getTeamCorrectnessTotal(b) - getTeamCorrectnessTotal(a);
  if (correctnessDiff !== 0) return correctnessDiff;

  // 5. Explicit tie
  return 0;
}

/**
 * Deterministic sorting and rank assignment for team leaderboard.
 * Preserves explicit ties (e.g. rankText 'T-1', isTied: true) when teams are tied across all 4 criteria.
 * Supports configurable team sizes (4 or 5 students).
 */
export function sortTeams(teams: Team[]): Team[] {
  const sorted = [...teams].sort(compareTeamsPhase5);
  const ranked: Team[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const raw = sorted[i];
    const earnedXP = getTeamEarnedXP(raw);
    const bonusXP = getTeamBonusXP(raw);
    const totalXP = getTeamTotalXP(raw);
    const targetSize = raw.configuredTeamSize || 4;
    const validCount = (raw.members || []).filter((m) => m.prSubmitted).length;

    const current: Team = {
      ...raw,
      earnedXP,
      bonusXP,
      totalXP,
      totalScore: totalXP, // Backward compatibility
      configuredTeamSize: targetSize,
      veryHardScore: getTeamVeryHardScore(raw),
      correctnessScoreTotal: getTeamCorrectnessTotal(raw),
      validSubmissionsCount: validCount,
      submissionStatus:
        validCount === targetSize
          ? 'ALL_VALID'
          : validCount > 0
          ? 'PARTIAL'
          : 'PENDING_PRS',
    };

    if (i > 0) {
      const prev = ranked[i - 1];
      if (compareTeamsPhase5(prev, current) === 0) {
        // True tie!
        current.rank = prev.rank;
        current.isTied = true;
        prev.isTied = true;
        current.rankText = `T-${prev.rank}`;
        prev.rankText = `T-${prev.rank}`;
      } else {
        const actualRank = i + 1;
        current.rank = actualRank;
        current.isTied = false;
        current.rankText = `#${actualRank}`;
      }
    } else {
      current.rank = 1;
      current.isTied = false;
      current.rankText = '#1';
    }
    ranked.push(current);
  }

  return ranked;
}

/**
 * Special Award — Very Hard Specialist ranking.
 * Ranked separately from the main leaderboard:
 * 1. Number of accurately solved unique Very Hard issues (descending)
 * 2. Total Very Hard issue score (descending)
 * 3. Total Very Hard correctness score (descending)
 * 4. Transparent ties if equal.
 */
export function rankVeryHardSpecialists(teams: Team[]): {
  rankedTeams: Team[];
  winners: Team[];
  isTied: boolean;
} {
  const sorted = [...teams].sort((a, b) => {
    const countDiff = (b.veryHardSolvedCount ?? 0) - (a.veryHardSolvedCount ?? 0);
    if (countDiff !== 0) return countDiff;

    const vhScoreDiff = getTeamVeryHardScore(b) - getTeamVeryHardScore(a);
    if (vhScoreDiff !== 0) return vhScoreDiff;

    const vhCorrectnessA = (a.solvedIssues || [])
      .filter((s) => s.difficulty === 'VERY_HARD')
      .reduce((sum, s) => sum + (s.correctnessScore ?? 1.0), 0);
    const vhCorrectnessB = (b.solvedIssues || [])
      .filter((s) => s.difficulty === 'VERY_HARD')
      .reduce((sum, s) => sum + (s.correctnessScore ?? 1.0), 0);
    if (vhCorrectnessB !== vhCorrectnessA) return vhCorrectnessB - vhCorrectnessA;

    return 0;
  });

  const validVHTeams = sorted.filter((t) => (t.veryHardSolvedCount ?? 0) > 0);
  if (validVHTeams.length === 0) {
    return { rankedTeams: sorted, winners: [], isTied: false };
  }

  const topVH = validVHTeams[0];
  const winners = validVHTeams.filter(
    (t) =>
      (t.veryHardSolvedCount ?? 0) === (topVH.veryHardSolvedCount ?? 0) &&
      getTeamVeryHardScore(t) === getTeamVeryHardScore(topVH)
  );

  return {
    rankedTeams: sorted,
    winners,
    isTied: winners.length > 1,
  };
}

/**
 * Computes all 4 official awards for display on the leaderboard:
 * 1st Place — PRison Break Champions
 * 2nd Place — Runner-Up
 * 3rd Place — Third Place
 * Special Award — Very Hard Specialist
 */
export function getAwardsSummary(teams: Team[]): AwardsSummary {
  const sorted = sortTeams(teams);
  const champions = sorted.filter((t) => t.rank === 1);
  const runnerUp = sorted.filter((t) => t.rank === 2);
  const thirdPlace = sorted.filter((t) => t.rank === 3);

  const vhRanking = rankVeryHardSpecialists(teams);

  return {
    champions,
    runnerUp,
    thirdPlace,
    veryHardSpecialist: {
      winners: vhRanking.winners,
      highestCount: vhRanking.winners[0]?.veryHardSolvedCount ?? 0,
      highestScore: vhRanking.winners[0] ? getTeamVeryHardScore(vhRanking.winners[0]) : 0,
      isTied: vhRanking.isTied,
    },
  };
}

export function mapFirestoreToTeam(data: FirestoreTeam, rank: number = 0, prevRank: number = 0): Team {
  const earnedXP = getTeamEarnedXP(data);
  const bonusXP = getTeamBonusXP(data);
  const totalXP = getTeamTotalXP(data);
  const configuredTeamSize = data.configuredTeamSize || 4;

  return {
    ...data,
    earnedXP,
    bonusXP,
    totalXP,
    totalScore: totalXP,
    configuredTeamSize,
    rank: rank || 1,
    previousRank: prevRank || rank || 1,
  };
}

export const teamService = {
  /**
   * Subscribes to the live Teams leaderboard in real time.
   */
  subscribeToTeamsLeaderboard(
    onUpdate: (teams: Team[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured()) {
      listeners.add(onUpdate);
      const sorted = sortTeams(inMemoryTeams).map((t, index) => ({
        ...t,
        rank: index + 1,
        previousRank: teamRankHistory.get(t.id) ?? index + 1,
      }));
      onUpdate(sorted);
      return () => {
        listeners.delete(onUpdate);
      };
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

          const rawTeams: Team[] = snapshot.docs.map((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as FirestoreTeam;
            return mapFirestoreToTeam(data);
          });

          const sorted = sortTeams(rawTeams);
          const ranked: Team[] = sorted.map((t, index) => {
            const currentRank = index + 1;
            const previousRank = teamRankHistory.get(t.id) ?? currentRank;
            return {
              ...t,
              rank: currentRank,
              previousRank,
            };
          });

          ranked.forEach((t) => teamRankHistory.set(t.id, t.rank));
          onUpdate(ranked);
        },
        (error) => {
          console.error('[TeamService] Firestore subscription error:', error);
          if (onError) onError(error);
          else {
            const fallback = sortTeams(inMemoryTeams).map((t, i) => ({
              ...t,
              rank: i + 1,
            }));
            onUpdate(fallback);
          }
        }
      );
    } catch (err) {
      console.warn('[TeamService] Failed to establish real-time listener:', err);
      const fallback = sortTeams(inMemoryTeams).map((t, i) => ({
        ...t,
        rank: i + 1,
      }));
      onUpdate(fallback);
      return () => {};
    }
  },

  /**
   * Fetches all teams once.
   */
  async getTeams(): Promise<Team[]> {
    if (!isFirebaseConfigured()) {
      return sortTeams(inMemoryTeams).map((t, i) => ({
        ...t,
        rank: i + 1,
      }));
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        return [];
      }

      const raw = snapshot.docs.map((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as FirestoreTeam;
        return mapFirestoreToTeam(data);
      });

      return sortTeams(raw).map((t, index) => ({
        ...t,
        rank: index + 1,
      }));
    } catch (error) {
      console.error('[TeamService] Error fetching teams:', error);
      return sortTeams(inMemoryTeams).map((t, i) => ({
        ...t,
        rank: i + 1,
      }));
    }
  },

  /**
   * Fetches a team by its ID.
   */
  async getTeamById(teamId: string): Promise<Team | null> {
    if (!isFirebaseConfigured()) {
      const found = inMemoryTeams.find((t) => t.id === teamId || t.repositoryId === teamId);
      return found ?? null;
    }
    try {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, teamId));
      if (!docSnap.exists()) return null;
      return mapFirestoreToTeam({ id: docSnap.id, ...docSnap.data() } as FirestoreTeam);
    } catch {
      const found = inMemoryTeams.find((t) => t.id === teamId || t.repositoryId === teamId);
      return found ?? null;
    }
  },

  /**
   * Updates partial fields of a team document.
   */
  async updateTeam(teamId: string, updates: Partial<FirestoreTeam>): Promise<void> {
    if (isFirebaseConfigured()) {
      await updateDoc(doc(db, COLLECTION_NAME, teamId), updates);
    } else {
      inMemoryTeams = inMemoryTeams.map((t) => (t.id === teamId ? { ...t, ...updates } : t));
      notifyListeners();
    }
  },

  /**
   * Fetches a team by ID or by repository name (e.g. "squard_1").
   */
  async getTeamByRepository(repoNameOrId: string): Promise<Team | null> {
    const clean = repoNameOrId.trim().toLowerCase().replace(/^repo_/, '');

    if (!isFirebaseConfigured()) {
      const found = inMemoryTeams.find(
        (t) =>
          t.repositoryId.toLowerCase() === clean ||
          t.repositoryName.toLowerCase() === clean ||
          t.id.toLowerCase() === `team_${clean}`
      );
      return found ?? null;
    }

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      const matched = snapshot.docs.find((d) => {
        const data = d.data() as FirestoreTeam;
        return (
          data.repositoryId.toLowerCase() === clean ||
          data.repositoryName?.toLowerCase() === clean ||
          d.id.toLowerCase() === `team_${clean}`
        );
      });

      if (!matched) return null;
      return mapFirestoreToTeam({ id: matched.id, ...matched.data() } as FirestoreTeam);
    } catch (error) {
      console.error('[TeamService] Error finding team by repo:', error);
      return null;
    }
  },

  /**
   * Registers or updates a team.
   */
  async saveTeam(team: Partial<FirestoreTeam> & { name: string; repositoryId: string }): Promise<string> {
    const cleanRepo = team.repositoryId.trim().replace(/^repo_/, '');
    const id = team.id || `team_${cleanRepo.toLowerCase()}`;
    const now = new Date().toISOString();

    const teamDoc: FirestoreTeam = {
      id,
      name: team.name.trim(),
      repositoryId: team.repositoryId.trim(),
      repositoryName: team.repositoryName || cleanRepo,
      repositoryFullName: team.repositoryFullName || cleanRepo,
      members: team.members || [],
      totalScore: team.totalScore ?? 0,
      solvedIssues: team.solvedIssues || [],
      validatedIssueCount: team.validatedIssueCount ?? (team.solvedIssues?.length || 0),
      assignedIssueCount: team.assignedIssueCount ?? (team.members?.reduce((acc, m) => acc + (m.assignedIssues?.length || 0), 0) || 4),
      correctlySolvedIssuesCount: team.correctlySolvedIssuesCount ?? team.validatedIssueCount ?? (team.solvedIssues?.length || 0),
      veryHardSolvedCount: team.veryHardSolvedCount ?? (team.solvedIssues?.filter((s) => s.difficulty === 'VERY_HARD').length || 0),
      prsSubmitted: team.prsSubmitted ?? 0,
      lastMergedAt: team.lastMergedAt ?? null,
      active: team.active ?? true,
      createdAt: team.createdAt ?? now,
      updatedAt: now,
    };

    if (isFirebaseConfigured()) {
      const docRef = doc(db, COLLECTION_NAME, id);
      await setDoc(docRef, teamDoc, { merge: true });
    } else {
      const mapped = mapFirestoreToTeam(teamDoc);
      inMemoryTeams = [mapped, ...inMemoryTeams.filter((t) => t.id !== id)];
      notifyListeners();
    }

    return id;
  },

  /**
   * Deletes a team.
   */
  async deleteTeam(teamId: string): Promise<void> {
    if (isFirebaseConfigured()) {
      await deleteDoc(doc(db, COLLECTION_NAME, teamId));
    } else {
      inMemoryTeams = inMemoryTeams.filter((t) => t.id !== teamId);
      notifyListeners();
    }
  },

  /**
   * Approves a 5-member team with an administrative justification reason.
   */
  async approveFiveMemberTeam(
    teamId: string,
    reason: string,
    adminUsername: string
  ): Promise<AdminAuditLog> {
    return this.setTeamConfiguredSize(teamId, 5, reason, adminUsername);
  },

  /**
   * Sets the configured team size (4 or 5) for a team with mandatory reason and audit logging.
   */
  async setTeamConfiguredSize(
    teamId: string,
    size: 4 | 5,
    reason: string,
    adminUsername: string
  ): Promise<AdminAuditLog> {
    if (size !== 4 && size !== 5) {
      throw new Error('Configurable allowed team sizes are strictly 4 or 5 members.');
    }
    if (!reason || !reason.trim()) {
      throw new Error("A mandatory justification reason is required when changing a team's configured size.");
    }
    if (!adminUsername || !adminUsername.trim()) {
      throw new Error('Unauthorized: Admin username is required to change team size.');
    }

    const now = new Date().toISOString();
    const auditId = `audit_team_size_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error(`Team with ID "${teamId}" not found.`);
    }

    const previousSize = team.configuredTeamSize || 4;

    const auditLog: AdminAuditLog = {
      id: auditId,
      action: 'TEAM_SIZE_CHANGED',
      teamId,
      performedBy: adminUsername.trim(),
      adminUsername: adminUsername.trim(),
      targetId: teamId,
      targetName: team.name,
      previousValue: { configuredTeamSize: previousSize },
      newValue: { configuredTeamSize: size },
      details: {
        previousSize,
        newSize: size,
        reason: reason.trim(),
      },
      reason: reason.trim(),
      timestamp: now,
    };

    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'auditLogs', auditId), auditLog);
      await updateDoc(doc(db, COLLECTION_NAME, teamId), {
        configuredTeamSize: size,
        sizeChangeReason: reason.trim(),
        sizeApprovedBy: adminUsername.trim(),
        updatedAt: now,
      });
    }

    await this.updateTeam(teamId, {
      configuredTeamSize: size,
      sizeChangeReason: reason.trim(),
      sizeApprovedBy: adminUsername.trim(),
      updatedAt: now,
    });

    return auditLog;
  },

  /**
   * Server-side validation for team activation:
   * Prevents activation unless the team has its configured number of registered members (default 4, or approved 5),
   * a valid repository, no duplicate repository assignment, and no duplicate student memberships.
   */
  validateTeamForActivation(
    team: Partial<FirestoreTeam>,
    allTeams: FirestoreTeam[] = []
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Configured registered members check (default 4, or approved 5)
    const targetSize = team.configuredTeamSize || 4;
    if (targetSize !== 4 && targetSize !== 5) {
      errors.push(`Configured team size must be either 4 or 5 students (received ${targetSize}).`);
    }

    const memberCount = team.members ? team.members.length : 0;
    if (memberCount !== targetSize) {
      if (targetSize === 4) {
        errors.push(`A competition team must have exactly 4 registered members (currently has ${memberCount}).`);
      } else {
        errors.push(`A competition team must have its configured ${targetSize} registered members (currently has ${memberCount}).`);
      }
    }

    // 2. Exactly one assigned repository
    if (!team.repositoryId || !team.repositoryId.trim()) {
      errors.push('A competition team must have an assigned repository.');
    }

    // 3. Repository must not be assigned to multiple active teams
    if (team.repositoryId) {
      const cleanRepo = team.repositoryId.trim().toLowerCase();
      const duplicateRepoTeam = allTeams.find(
        (t) =>
          t.id !== team.id &&
          t.active !== false &&
          (t.repositoryId.toLowerCase() === cleanRepo || (t.repositoryName || '').toLowerCase() === cleanRepo)
      );
      if (duplicateRepoTeam) {
        errors.push(
          `Repository "${team.repositoryId}" is already assigned to active team "${duplicateRepoTeam.name}". A repository cannot be assigned to multiple active teams.`
        );
      }
    }

    // 4. A student may belong to only one active team
    if (team.members && team.members.length > 0) {
      for (const member of team.members) {
        const cleanUser = member.githubUsername.trim().toLowerCase();
        const duplicateStudentTeam = allTeams.find(
          (t) =>
            t.id !== team.id &&
            t.active !== false &&
            t.members.some(
              (m) =>
                m.studentId === member.studentId ||
                m.githubUsername.trim().toLowerCase() === cleanUser
            )
        );
        if (duplicateStudentTeam) {
          errors.push(
            `Student @${member.githubUsername} is already registered in active team "${duplicateStudentTeam.name}". A student may belong to only one active team.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Auditable replacement of a team member:
   * Replaces a student member with a documented admin reason and writes an immutable audit record.
   */
  async replaceParticipantWithAudit(
    teamId: string,
    oldUsername: string,
    newMember: { name: string; githubUsername: string; studentId?: string },
    adminName: string,
    reason: string
  ): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new Error('A documented justification reason is required for participant replacement.');
    }

    const cleanOld = oldUsername.trim().toLowerCase();
    const cleanNew = newMember.githubUsername.trim().toLowerCase();
    const now = new Date().toISOString();

    // Check if new student is already in an active team
    const allTeams = await this.getTeams();
    const duplicateTeam = allTeams.find(
      (t) =>
        t.active !== false &&
        t.members.some((m) => m.githubUsername.toLowerCase() === cleanNew)
    );
    if (duplicateTeam) {
      throw new Error(
        `Replacement student @${newMember.githubUsername} is already active in team "${duplicateTeam.name}".`
      );
    }

    const targetTeam = allTeams.find((t) => t.id === teamId);
    if (!targetTeam) {
      throw new Error(`Team with ID "${teamId}" not found.`);
    }

    const memberIdx = targetTeam.members.findIndex(
      (m) => m.githubUsername.toLowerCase() === cleanOld
    );
    if (memberIdx < 0) {
      throw new Error(`Student @${oldUsername} was not found in team "${targetTeam.name}".`);
    }

    const oldMemberData = targetTeam.members[memberIdx];
    const newStudentId = newMember.studentId || `s_${cleanNew.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // Update team member
    const updatedMembers = [...targetTeam.members];
    updatedMembers[memberIdx] = {
      ...oldMemberData,
      studentId: newStudentId,
      name: newMember.name.trim(),
      githubUsername: newMember.githubUsername.trim(),
      validationStatus: `Audited replacement for @${oldUsername}`,
    };

    // 1. Write audit log
    const auditId = `audit_rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: AdminAuditLog = {
      id: auditId,
      action: 'PARTICIPANT_REPLACEMENT',
      teamId,
      repositoryId: targetTeam.repositoryId,
      performedBy: adminName,
      details: {
        oldMember: oldMemberData,
        newMember: {
          studentId: newStudentId,
          name: newMember.name,
          githubUsername: newMember.githubUsername,
        },
      },
      reason: reason.trim(),
      timestamp: now,
    };

    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'auditLogs', auditId), auditLog);
      await updateDoc(doc(db, COLLECTION_NAME, teamId), {
        members: updatedMembers,
        updatedAt: now,
      });
    } else {
      targetTeam.members = updatedMembers;
      targetTeam.updatedAt = now;
      notifyListeners();
    }
  },

  /**
   * Auditable repository reassignment:
   * Validates that the new repository is not assigned to another active squad.
   */
  async reassignRepositoryWithAudit(
    teamId: string,
    newRepository: { id: string; name: string; fullName?: string },
    adminName: string,
    reason: string
  ): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new Error('A documented justification is required for repository reassignment.');
    }

    const allTeams = await this.getTeams();
    const cleanRepo = newRepository.id.trim().toLowerCase();

    const otherActive = allTeams.find(
      (t) =>
        t.id !== teamId &&
        t.active !== false &&
        (t.repositoryId.toLowerCase() === cleanRepo || t.repositoryName.toLowerCase() === cleanRepo)
    );
    if (otherActive) {
      throw new Error(
        `Repository "${newRepository.name}" is already assigned to active team "${otherActive.name}".`
      );
    }

    const now = new Date().toISOString();
    const auditId = `audit_repo_${Date.now()}`;
    const auditLog: AdminAuditLog = {
      id: auditId,
      action: 'REPOSITORY_REASSIGNMENT',
      teamId,
      repositoryId: newRepository.id,
      performedBy: adminName,
      details: { newRepository },
      reason: reason.trim(),
      timestamp: now,
    };

    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'auditLogs', auditId), auditLog);
      await updateDoc(doc(db, COLLECTION_NAME, teamId), {
        repositoryId: newRepository.id,
        repositoryName: newRepository.name,
        repositoryFullName: newRepository.fullName || newRepository.name,
        updatedAt: now,
      });
    } else {
      const t = inMemoryTeams.find((item) => item.id === teamId);
      if (t) {
        t.repositoryId = newRepository.id;
        t.repositoryName = newRepository.name;
        t.repositoryFullName = newRepository.fullName || newRepository.name;
        t.updatedAt = now;
        notifyListeners();
      }
    }
  },

  /**
   * Comprehensive integrity diagnostics across teams, repositories, and issue assignments:
   * Detects duplicate students, duplicate repos, duplicate issues, and team size anomalies.
   */
  detectConfigurationErrors(
    teams: FirestoreTeam[],
    _repositories: any[] = [],
    issues: FirestoreIssue[] = []
  ): {
    invalidMemberCounts: Array<{ teamId: string; teamName: string; count: number }>;
    duplicateRepositories: Array<{ repository: string; teamNames: string[] }>;
    duplicateStudents: Array<{ username: string; teamNames: string[] }>;
    duplicateIssues: Array<{ issueNumber: number; repositoryId: string; assignedTo: string[] }>;
    teamsWithoutRepo: Array<{ teamId: string; teamName: string }>;
    studentsWithoutIssues: Array<{ username: string; teamName: string }>;
  } {
    const invalidMemberCounts: Array<{ teamId: string; teamName: string; count: number }> = [];
    const duplicateRepositories: Array<{ repository: string; teamNames: string[] }> = [];
    const duplicateStudents: Array<{ username: string; teamNames: string[] }> = [];
    const teamsWithoutRepo: Array<{ teamId: string; teamName: string }> = [];
    const studentsWithoutIssues: Array<{ username: string; teamName: string }> = [];

    // Track repository usage
    const repoUsage = new Map<string, string[]>();
    // Track student usage
    const studentUsage = new Map<string, string[]>();

    for (const t of teams) {
      if (t.active !== false) {
        // 1. Member count check (respects configuredTeamSize: 4 or 5)
        const targetSize = t.configuredTeamSize || 4;
        const count = t.members ? t.members.length : 0;
        if (count !== targetSize) {
          invalidMemberCounts.push({ teamId: t.id, teamName: t.name, count });
        }

        // 2. Repo check
        if (!t.repositoryId || !t.repositoryId.trim()) {
          teamsWithoutRepo.push({ teamId: t.id, teamName: t.name });
        } else {
          const rKey = (t.repositoryName || t.repositoryId).toLowerCase();
          const list = repoUsage.get(rKey) || [];
          list.push(t.name);
          repoUsage.set(rKey, list);
        }

        // 3. Student uniqueness & issue check
        if (t.members) {
          for (const m of t.members) {
            const uKey = m.githubUsername.toLowerCase().trim();
            const list = studentUsage.get(uKey) || [];
            list.push(t.name);
            studentUsage.set(uKey, list);

            if (!m.assignedIssues || m.assignedIssues.length === 0) {
              studentsWithoutIssues.push({ username: m.githubUsername, teamName: t.name });
            }
          }
        }
      }
    }

    repoUsage.forEach((teamNames, repository) => {
      if (teamNames.length > 1) {
        duplicateRepositories.push({ repository, teamNames });
      }
    });

    studentUsage.forEach((teamNames, username) => {
      if (teamNames.length > 1) {
        duplicateStudents.push({ username, teamNames });
      }
    });

    // 4. Duplicate issue assignments
    const issueMap = new Map<string, string[]>();
    for (const issue of issues) {
      if (issue.active && (issue.assignedStudentUsername || issue.assignedStudentId)) {
        const key = `${issue.repositoryId}#${issue.issueNumber}`;
        const list = issueMap.get(key) || [];
        const student = issue.assignedStudentUsername || issue.assignedStudentId || 'unknown';
        if (!list.includes(student)) list.push(student);
        issueMap.set(key, list);
      }
    }

    const duplicateIssues: Array<{ issueNumber: number; repositoryId: string; assignedTo: string[] }> = [];
    issueMap.forEach((assignedTo, key) => {
      if (assignedTo.length > 1) {
        const [repositoryId, numStr] = key.split('#');
        duplicateIssues.push({
          repositoryId,
          issueNumber: parseInt(numStr, 10),
          assignedTo,
        });
      }
    });

    return {
      invalidMemberCounts,
      duplicateRepositories,
      duplicateStudents,
      duplicateIssues,
      teamsWithoutRepo,
      studentsWithoutIssues,
    };
  },

  /**
   * Exports team assignments to JSON or CSV format.
   */
  exportTeamAssignments(
    teams: FirestoreTeam[],
    issues: FirestoreIssue[] = [],
    format: 'json' | 'csv' = 'json'
  ): string {
    if (format === 'json') {
      const data = teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        repositoryName: t.repositoryName,
        repositoryFullName: t.repositoryFullName,
        active: t.active,
        totalScore: t.totalScore,
        assignedIssueCount: t.assignedIssueCount || t.members.reduce((acc, m) => acc + (m.assignedIssues?.length || 0), 0),
        solvedIssueCount: t.validatedIssueCount || t.solvedIssues?.length || 0,
        veryHardSolvedCount: t.veryHardSolvedCount || 0,
        members: t.members.map((m) => {
          const studentIssues = issues.filter(
            (i) =>
              (i.assignedStudentUsername?.toLowerCase() === m.githubUsername.toLowerCase() ||
                m.assignedIssues?.includes(i.issueNumber)) &&
              i.repositoryId === t.repositoryId
          );
          return {
            name: m.name,
            githubUsername: m.githubUsername,
            assignedIssues: m.assignedIssues || [],
            issueDetails: studentIssues.map((i) => ({
              number: i.issueNumber,
              title: i.title,
              difficulty: i.difficulty,
              points: i.basePoints,
            })),
            prSubmitted: !!m.prSubmitted,
            score: m.score || 0,
          };
        }),
      }));
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    const rows = [
      ['Team ID', 'Team Name', 'Repository', 'Student Name', 'GitHub Username', 'Assigned Issues', 'PR Submitted', 'Score'].join(','),
    ];

    for (const t of teams) {
      for (const m of t.members) {
        rows.push([
          `"${t.id}"`,
          `"${t.name}"`,
          `"${t.repositoryName}"`,
          `"${m.name}"`,
          `"${m.githubUsername}"`,
          `"${(m.assignedIssues || []).join(';')}"`,
          `"${m.prSubmitted ? 'YES' : 'NO'}"`,
          `"${m.score || 0}"`,
        ].join(','));
      }
    }

    return rows.join('\n');
  },

  /**
   * Seeds initial squads into Firestore if empty.
   */
  async seedInitialTeams(): Promise<void> {
    if (!isFirebaseConfigured()) return;

    for (const t of initialMockTeams) {
      await setDoc(doc(db, COLLECTION_NAME, t.id), t, { merge: true });
    }
  },
};
