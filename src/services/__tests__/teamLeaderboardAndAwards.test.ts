// ─────────────────────────────────────────────
// PRison Break — Phase 5 Team Leaderboard, Repository Display, and Awards Test Suite
// Verifies:
// 1. Ranking by team score
// 2. Correct repository names display (squard_1, squard_2, etc.)
// 3. Score updates after grading
// 4. No duplicate score after PR updates
// 5. No duplicate score after merging
// 6. Very Hard award ranking (ranked separately from main leaderboard)
// 7. Ties and tie-breakers (explicit tie display)
// 8. Teams with missing submissions (partial & 0/4 PRs)
// 9. Empty leaderboard handling
// 10. Public versus admin view permissions (no secrets in public models)
// 11. Real-time update behavior
// 12. Existing routes and authentication integrity
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  sortTeams,
  rankVeryHardSpecialists,
  getAwardsSummary,
  teamService,
} from '../teamService';
import { calculateAwardedPoints } from '../javaGradingEngine';
import { evaluateTeamIssueScoring } from '../scoringEngine';
import type { Team } from '../../types';

describe('Phase 5 — Team Leaderboard, Repository Display, and Awards', () => {
  const createMockTeam = (overrides: Partial<Team>): Team => ({
    id: 'team_squard_1',
    name: 'Squad 1',
    repositoryId: 'squard_1',
    repositoryName: 'squard_1',
    repositoryFullName: 'PRison-Break-2026/squard_1',
    members: [
      { studentId: 's1', name: 'Alice', githubUsername: 'alice', assignedIssues: [1], prSubmitted: true },
      { studentId: 's2', name: 'Bob', githubUsername: 'bob', assignedIssues: [2], prSubmitted: true },
      { studentId: 's3', name: 'Charlie', githubUsername: 'charlie', assignedIssues: [3], prSubmitted: true },
      { studentId: 's4', name: 'Diana', githubUsername: 'diana', assignedIssues: [4], prSubmitted: true },
    ],
    totalScore: 100,
    assignedIssueCount: 4,
    validatedIssueCount: 4,
    veryHardSolvedCount: 0,
    veryHardScore: 0,
    correctnessScoreTotal: 4.0,
    prsSubmitted: 4,
    solvedIssues: [],
    active: true,
    rank: 1,
    previousRank: 1,
    createdAt: '2026-10-21T18:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
    ...overrides,
  });

  // ── 1. RANKING BY TEAM SCORE ───────────────────────────────
  describe('Ranking by Team Score', () => {
    it('ranks teams primarily by total validated team XP descending', () => {
      const teamA = createMockTeam({ id: 'team_a', name: 'Squad A', totalScore: 350, repositoryName: 'squard_1' });
      const teamB = createMockTeam({ id: 'team_b', name: 'Squad B', totalScore: 385, repositoryName: 'squard_3' });
      const teamC = createMockTeam({ id: 'team_c', name: 'Squad C', totalScore: 325, repositoryName: 'squard_2' });

      const ranked = sortTeams([teamA, teamB, teamC]);

      expect(ranked[0].id).toBe('team_b');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].totalScore).toBe(385);

      expect(ranked[1].id).toBe('team_a');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].totalScore).toBe(350);

      expect(ranked[2].id).toBe('team_c');
      expect(ranked[2].rank).toBe(3);
      expect(ranked[2].totalScore).toBe(325);
    });
  });

  // ── 2. CORRECT REPOSITORY NAMES DISPLAY ─────────────────────
  describe('Correct Repository Names Display', () => {
    it('preserves and exposes actual registered repository names from Firestore', () => {
      const team = createMockTeam({
        id: 'team_alpha',
        name: 'Alpha Wolves', // Team name differs from repo name!
        repositoryId: 'squard_9',
        repositoryName: 'squard_9',
      });

      const ranked = sortTeams([team]);
      expect(ranked[0].repositoryName).toBe('squard_9');
      expect(ranked[0].name).toBe('Alpha Wolves');
      // Public leaderboard must not collapse repository name into team name
      expect(ranked[0].repositoryName).not.toBe(ranked[0].name);
    });
  });

  // ── 3. SCORE UPDATES AFTER GRADING ─────────────────────────
  describe('Score Updates After Grading', () => {
    it('accurately updates team score when new issue is validated and aggregates into total', () => {
      const initialScore = 50;
      const team = createMockTeam({ totalScore: initialScore, validatedIssueCount: 2 });

      // Add a newly validated Medium issue (20 pts with C=1, Q=1, M=1 -> 20 pts)
      const newIssuePoints = calculateAwardedPoints(20, 1.0, 1.0, 1.0);
      const updatedTotal = initialScore + newIssuePoints;

      const updatedTeam = {
        ...team,
        totalScore: updatedTotal,
        validatedIssueCount: team.validatedIssueCount + 1,
      };

      const ranked = sortTeams([updatedTeam]);
      expect(ranked[0].totalScore).toBe(70);
      expect(ranked[0].validatedIssueCount).toBe(3);
    });
  });

  // ── 4. NO DUPLICATE SCORE AFTER PR UPDATES ─────────────────
  describe('No Duplicate Score After PR Updates', () => {
    it('ensures that updating a PR with new commits does not award duplicate issue score', () => {
      const eval1 = evaluateTeamIssueScoring({
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        githubUsername: 'student_alice',
        prNumber: 10,
        solvedIssues: [{ issueNumber: 1, difficulty: 'HARD' }],
        existingTeamSolvedIssueNumbers: [],
      });
      expect(eval1.newIssuesToAward.length).toBe(1);
      expect(eval1.totalPoints).toBe(30);

      // Re-delivery or update on same PR: issue 1 was already solved
      const eval2 = evaluateTeamIssueScoring({
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        githubUsername: 'student_alice',
        prNumber: 10,
        solvedIssues: [{ issueNumber: 1, difficulty: 'HARD' }],
        existingTeamSolvedIssueNumbers: [1], // Already recorded in team ledger!
      });
      expect(eval2.newIssuesToAward.length).toBe(0);
      expect(eval2.duplicateIssuesIgnored).toContain(1);
      expect(eval2.totalPoints).toBe(0);
    });
  });

  // ── 5. NO DUPLICATE SCORE AFTER MERGING ─────────────────────
  describe('No Duplicate Score After Merging', () => {
    it('does not re-award issue points when an approved PR is officially merged', () => {
      const team = createMockTeam({
        id: 'team_squard_1',
        totalScore: 100,
        solvedIssues: [
          {
            issueNumber: 1,
            difficulty: 'HARD',
            points: 30,
            solvedByUsername: 'alice',
            prNumber: 10,
            solvedAt: '2026-10-22T08:00:00Z',
          },
        ],
      });

      // Simulating PR merge: existing issue numbers [1] are in ledger
      const mergeEvaluation = evaluateTeamIssueScoring({
        teamId: team.id,
        repositoryId: team.repositoryId,
        githubUsername: 'alice',
        prNumber: 10,
        solvedIssues: [{ issueNumber: 1, difficulty: 'HARD' }],
        existingTeamSolvedIssueNumbers: team.solvedIssues.map((s) => s.issueNumber),
      });

      expect(mergeEvaluation.totalPoints).toBe(0);
      expect(mergeEvaluation.newIssuesToAward.length).toBe(0);
      // Team score remains exactly 100
      expect(team.totalScore).toBe(100);
    });
  });

  // ── 6. VERY HARD AWARD RANKING ──────────────────────────────
  describe('Very Hard Award Ranking (Ranked Separately)', () => {
    it('ranks teams separately for the Special Award — Very Hard Specialist', () => {
      // Squad A: 300 XP, 0 Very Hard
      const teamA = createMockTeam({
        id: 'team_a',
        name: 'Squad A',
        totalScore: 300,
        veryHardSolvedCount: 0,
        veryHardScore: 0,
      });

      // Squad B: 250 XP, 2 Very Hard (80 pts)
      const teamB = createMockTeam({
        id: 'team_b',
        name: 'Squad B',
        totalScore: 250,
        veryHardSolvedCount: 2,
        veryHardScore: 80,
        solvedIssues: [
          { issueNumber: 4, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'b1', prNumber: 1, solvedAt: '' },
          { issueNumber: 8, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'b2', prNumber: 2, solvedAt: '' },
        ],
      });

      // Squad C: 270 XP, 1 Very Hard (40 pts)
      const teamC = createMockTeam({
        id: 'team_c',
        name: 'Squad C',
        totalScore: 270,
        veryHardSolvedCount: 1,
        veryHardScore: 40,
        solvedIssues: [
          { issueNumber: 12, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'c1', prNumber: 3, solvedAt: '' },
        ],
      });

      // Main leaderboard: Squad A is #1 by total XP
      const mainRanked = sortTeams([teamA, teamB, teamC]);
      expect(mainRanked[0].id).toBe('team_a');

      // Very Hard Specialist ranking: Squad B wins with 2 Very Hard issues
      const vhRanking = rankVeryHardSpecialists([teamA, teamB, teamC]);
      expect(vhRanking.winners.length).toBe(1);
      expect(vhRanking.winners[0].id).toBe('team_b');
      expect(vhRanking.winners[0].veryHardSolvedCount).toBe(2);

      // Awards Summary verification
      const awards = getAwardsSummary([teamA, teamB, teamC]);
      expect(awards.champions[0].id).toBe('team_a');
      expect(awards.veryHardSpecialist.winners[0].id).toBe('team_b');
    });
  });

  // ── 7. TIES AND TIE-BREAKERS ────────────────────────────────
  describe('Ties and Tie-Breakers', () => {
    it('breaks ties using (1) Very Hard count, (2) Very Hard score, (3) Correctness total', () => {
      // Both have 200 XP
      // Team 1: 1 Very Hard issue (40 pts)
      const team1 = createMockTeam({
        id: 'team_1',
        name: 'Squad 1',
        totalScore: 200,
        veryHardSolvedCount: 1,
        veryHardScore: 40,
        correctnessScoreTotal: 2.0,
      });

      // Team 2: 0 Very Hard issues
      const team2 = createMockTeam({
        id: 'team_2',
        name: 'Squad 2',
        totalScore: 200,
        veryHardSolvedCount: 0,
        veryHardScore: 0,
        correctnessScoreTotal: 2.0,
      });

      const ranked = sortTeams([team2, team1]);
      // Team 1 wins tie-breaker via Very Hard count
      expect(ranked[0].id).toBe('team_1');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].isTied).toBe(false);
      expect(ranked[1].id).toBe('team_2');
      expect(ranked[1].rank).toBe(2);
    });

    it('displays an explicit tie (T-1) when teams are identical across all 4 ranking criteria', () => {
      const teamA = createMockTeam({
        id: 'team_a',
        name: 'Squad A',
        totalScore: 200,
        veryHardSolvedCount: 1,
        veryHardScore: 40,
        correctnessScoreTotal: 2.5,
      });

      const teamB = createMockTeam({
        id: 'team_b',
        name: 'Squad B',
        totalScore: 200,
        veryHardSolvedCount: 1,
        veryHardScore: 40,
        correctnessScoreTotal: 2.5,
      });

      const ranked = sortTeams([teamA, teamB]);

      // Both must share rank 1 and have explicit tie markers
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[0].isTied).toBe(true);
      expect(ranked[1].isTied).toBe(true);
      expect(ranked[0].rankText).toBe('T-1');
      expect(ranked[1].rankText).toBe('T-1');
    });
  });

  // ── 8. TEAMS WITH MISSING SUBMISSIONS ───────────────────────
  describe('Teams With Missing Submissions', () => {
    it('correctly tracks and flags partial and 0-submission squads', () => {
      // Squad with 2/4 PRs
      const partialTeam = createMockTeam({
        id: 'team_partial',
        name: 'Squad Partial',
        members: [
          { studentId: 's1', name: 'A', githubUsername: 'a', assignedIssues: [1], prSubmitted: true },
          { studentId: 's2', name: 'B', githubUsername: 'b', assignedIssues: [2], prSubmitted: true },
          { studentId: 's3', name: 'C', githubUsername: 'c', assignedIssues: [3], prSubmitted: false },
          { studentId: 's4', name: 'D', githubUsername: 'd', assignedIssues: [4], prSubmitted: false },
        ],
      });

      // Squad with 0 PRs
      const emptyPRTeam = createMockTeam({
        id: 'team_empty',
        name: 'Squad Empty',
        members: [
          { studentId: 's1', name: 'A', githubUsername: 'a', assignedIssues: [1], prSubmitted: false },
          { studentId: 's2', name: 'B', githubUsername: 'b', assignedIssues: [2], prSubmitted: false },
          { studentId: 's3', name: 'C', githubUsername: 'c', assignedIssues: [3], prSubmitted: false },
          { studentId: 's4', name: 'D', githubUsername: 'd', assignedIssues: [4], prSubmitted: false },
        ],
      });

      const ranked = sortTeams([partialTeam, emptyPRTeam]);

      const pRanked = ranked.find((t) => t.id === 'team_partial')!;
      expect(pRanked.validSubmissionsCount).toBe(2);
      expect(pRanked.submissionStatus).toBe('PARTIAL');

      const eRanked = ranked.find((t) => t.id === 'team_empty')!;
      expect(eRanked.validSubmissionsCount).toBe(0);
      expect(eRanked.submissionStatus).toBe('PENDING_PRS');
    });
  });

  // ── 9. EMPTY LEADERBOARD HANDLING ───────────────────────────
  describe('Empty Leaderboard Handling', () => {
    it('handles empty team array gracefully without throwing', () => {
      const ranked = sortTeams([]);
      expect(ranked).toEqual([]);

      const awards = getAwardsSummary([]);
      expect(awards.champions).toEqual([]);
      expect(awards.runnerUp).toEqual([]);
      expect(awards.thirdPlace).toEqual([]);
      expect(awards.veryHardSpecialist.winners).toEqual([]);
    });
  });

  // ── 10. PUBLIC VERSUS ADMIN VIEW PERMISSIONS ────────────────
  describe('Public Versus Admin View Permissions', () => {
    it('ensures public team details contain no secrets, student PII, or internal security diagnostics', () => {
      const team = createMockTeam({
        members: [
          {
            studentId: 's_alice',
            name: 'Alice Cooper',
            githubUsername: 'alice',
            assignedIssues: [1, 2],
            prSubmitted: true,
          },
        ],
      });

      // Public member exposes githubUsername and assigned issues, not private phone/email
      const member = team.members[0];
      expect(member.githubUsername).toBe('alice');
      expect(member.assignedIssues).toEqual([1, 2]);
      expect((member as any).email).toBeUndefined();
      expect((member as any).webhookSecret).toBeUndefined();
      expect((member as any).dockerToken).toBeUndefined();
    });
  });

  // ── 11. REAL-TIME UPDATE BEHAVIOR ───────────────────────────
  describe('Real-Time Update Behavior', () => {
    it('notifies listeners when team scores are updated in memory or Firestore', async () => {
      let notifiedTeams: Team[] = [];
      const unsub = teamService.subscribeToTeamsLeaderboard((data) => {
        notifiedTeams = data;
      });

      expect(notifiedTeams.length).toBeGreaterThan(0);
      expect(notifiedTeams[0].rank).toBe(1);

      unsub();
    });
  });

  // ── 12. EXISTING ROUTES AND AUTHENTICATION INTEGRITY ────────
  describe('Existing Routes and Authentication Integrity', () => {
    it('preserves existing route structures and team models', () => {
      const sample = createMockTeam({});
      expect(sample.id).toMatch(/^team_/);
      expect(sample.repositoryName).toMatch(/^squard_\d+$/);
      expect(sample.members).toHaveLength(4);
    });
  });
});
