// ─────────────────────────────────────────────
// PRison Control — Comprehensive Reference-Aware Grading, Manual Bonus XP,
// Flexible Team Sizes, and Challenge Importer Test Suite
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { challengeImportService } from '../challengeImportService';
import { javaGradingEngine, calculateAwardedPoints } from '../javaGradingEngine';
import { bonusService } from '../bonusService';
import { teamService, compareTeamsPhase5 } from '../teamService';
import { sandboxRunner } from '../sandboxRunner';
import type { Team, FirestoreTeam } from '../../types';

describe('PRison Control — Complete Competition Engine Verification', () => {
  beforeEach(() => {
    sandboxRunner.setSandboxAvailable(true);
  });

  // ─────────────────────────────────────────────
  // 1. REPOISSIES IMPORT & VALIDATION
  // ─────────────────────────────────────────────
  describe('Challenge Repository & Solution Importer', () => {
    it('discovers all 35 real challenge repositories and 3,080 issues', () => {
      const report = challengeImportService.discoverAndValidateAll();

      expect(report.totalRepositories).toBe(35);
      expect(report.totalIssuesMapped).toBe(3080);
      expect(report.totalSolutionsMatched).toBe(3080);
      expect(report.totalMissingSolutions).toBe(0);
      expect(report.isReadyForGrading).toBe(true);
      expect(report.repoSummaries.length).toBe(35);

      // Verify specific repository names found in filesystem
      expect(report.repoSummaries.some((r) => r.repositoryName === 'Squade_1')).toBe(true);
      expect(report.repoSummaries.some((r) => r.repositoryName === 'Squade_35')).toBe(true);
    });

    it('flags missing packaged test suites across challenge repos for issue-output grading', () => {
      const report = challengeImportService.discoverAndValidateAll();
      // All 35 repositories lack src/test unit tests, relying on deterministic expected output
      expect(report.totalMissingTests).toBe(3080);
      expect(report.warnings.some((w) => w.includes('lack packaged unit tests'))).toBe(true);
    });

    it('verifies correct difficulty distribution and base points', () => {
      const report = challengeImportService.discoverAndValidateAll();
      const sq1 = report.repoSummaries.find((r) => r.repositoryName === 'Squade_1');
      expect(sq1).toBeDefined();
      expect(sq1?.issuesFound).toBe(88);
      expect(sq1?.solutionsFound).toBe(88);
    });

    it('prevents accidental overwrite on re-import without explicit confirmation', async () => {
      // First import creates records
      await challengeImportService.importChallengeMappings({
        adminUsername: 'lead_organizer',
        confirmOverwrite: true,
        selectedRepos: ['Squade_1'],
      });

      // Second import without confirmOverwrite must throw
      await expect(
        challengeImportService.importChallengeMappings({
          adminUsername: 'lead_organizer',
          confirmOverwrite: false,
          selectedRepos: ['Squade_1'],
        })
      ).rejects.toThrow(/Existing production mappings detected/i);
    });

    it('is safe to run multiple times with explicit confirmation without duplicating mappings', async () => {
      const res1 = await challengeImportService.importChallengeMappings({
        adminUsername: 'lead_organizer',
        confirmOverwrite: true,
        selectedRepos: ['Squade_1'],
      });

      const res2 = await challengeImportService.importChallengeMappings({
        adminUsername: 'lead_organizer',
        confirmOverwrite: true,
        selectedRepos: ['Squade_1'],
      });

      expect(res1.importedCount).toBe(88);
      expect(res2.importedCount).toBe(88);
    });
  });

  // ─────────────────────────────────────────────
  // 2. REFERENCE SOLUTION CONFIDENTIALITY
  // ─────────────────────────────────────────────
  describe('Reference Solution Privacy & Security', () => {
    it('verifies 0 reference solutions leaked into public challenge directories', () => {
      const report = challengeImportService.discoverAndValidateAll();
      expect(report.publicLeakWarnings.length).toBe(0);
    });

    it('restricts reference solution access to authenticated administrators only', async () => {
      // First ensure mappings and solutions are imported
      await challengeImportService.importChallengeMappings({
        adminUsername: 'lead_organizer',
        confirmOverwrite: true,
        selectedRepos: ['Squade_1'],
      });

      // Authorized admin can fetch
      const adminSol = await challengeImportService.getPrivateSolution(
        'Squade_1',
        1,
        'super_admin'
      );
      expect(adminSol).not.toBeNull();
      expect(adminSol?.repositoryName).toBe('Squade_1');

      // Unauthorized request is rejected
      await expect(
        challengeImportService.getPrivateSolution('Squade_1', 1, '')
      ).rejects.toThrow(/Access Denied|strictly confidential/i);
    });
  });

  // ─────────────────────────────────────────────
  // 3. REFERENCE-AWARE GRADING ENGINE
  // ─────────────────────────────────────────────
  describe('Reference-Aware Java Grading Engine', () => {
    it('calculates awarded points using weighted formula (0.70*C + 0.20*Q + 0.10*M)', () => {
      // EASY: 10 base points
      // C = 1.0, Q = 0.9, M = 1.0 => 10 * (0.70 + 0.18 + 0.10) = 10 * 0.98 = 9.80 pts
      const easyPts = calculateAwardedPoints(10, 1.0, 0.9, 1.0);
      expect(easyPts).toBe(9.8);

      // MEDIUM: 20 base points
      // C = 1.0, Q = 1.0, M = 1.0 => 20 * 1.0 = 20.00 pts
      const medPts = calculateAwardedPoints(20, 1.0, 1.0, 1.0);
      expect(medPts).toBe(20.0);

      // VERY_HARD: 40 base points
      // C = 0.5 (partial), Q = 0.8, M = 1.0 => 40 * (0.35 + 0.16 + 0.10) = 40 * 0.61 = 24.40 pts
      const vhPts = calculateAwardedPoints(40, 0.5, 0.8, 1.0);
      expect(vhPts).toBe(24.4);
    });

    it('awards full correctness marks for structurally alternative beginner code (e.g. while vs for loop)', async () => {
      const grading = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student_bob',
        assignedStudentIssues: [1],
        prNumber: 42,
        changedFiles: [
          {
            filename: 'src/main/java/hackathon/RotateMatrix.java',
            status: 'modified',
            patch: 'while (i < n) { ... }',
          },
        ],
        commits: [
          {
            sha: 'commit_valid_while',
            message: 'Fix issue #1: solve matrix rotation using while loops',
            author: 'student_bob',
          },
        ],
        testExecutionResult: {
          compilationPassed: true,
          outputMatchesExpected: true,
          normalInputsPassed: true,
          edgeCasesPassed: true,
        },
        codeAnalysis: {
          isStructurallyAlternative: true, // while loop instead of reference for loop
        },
      });

      expect(grading.rawComponentScores.correctness).toBe(1.0);
      expect(grading.awardedPoints).toBe(10); // Full marks for EASY
      expect(grading.evidence.isStructurallyAlternative).toBe(true);
    });

    it('assigns low marks to code resembling reference solution but broken on edge cases', async () => {
      const grading = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 2,
        difficulty: 'EASY',
        studentUsername: 'student_charlie',
        assignedStudentIssues: [2],
        prNumber: 43,
        changedFiles: [
          {
            filename: 'src/main/java/hackathon/ArraySum.java',
            status: 'modified',
            patch: 'for (int i = 0; i <= n; i++) { sum += arr[i]; }', // Off-by-one / resembling reference
          },
        ],
        commits: [
          {
            sha: 'commit_resembling_broken',
            message: 'Fix issue #2: array sum',
            author: 'student_charlie',
          },
        ],
        testExecutionResult: {
          compilationPassed: true,
          normalInputsPassed: false,
          edgeCasesPassed: false, // Fails boundary
          testsPassed: 1,
          totalTests: 4,
        },
        codeAnalysis: {
          resemblesReferenceButBroken: true,
        },
      });

      expect(grading.rawComponentScores.correctness).toBeLessThan(0.4);
      expect(grading.awardedPoints).toBeLessThan(10);
    });

    it('penalizes hardcoded output attempts', async () => {
      const grading = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 3,
        difficulty: 'EASY',
        studentUsername: 'spammer_dan',
        assignedStudentIssues: [3],
        prNumber: 44,
        changedFiles: [
          {
            filename: 'src/main/java/hackathon/Solver.java',
            status: 'modified',
            patch: 'System.out.println("42"); // Hardcoded output',
          },
        ],
        commits: [
          {
            sha: 'commit_hardcoded',
            message: 'Fix issue #3: return 42',
            author: 'spammer_dan',
          },
        ],
        codeAnalysis: {
          hardcodedOutputDetected: true,
        },
      });

      expect(grading.rawComponentScores.correctness).toBeLessThanOrEqual(0.1);
      expect(grading.deductions.correctness.some((d) => d.includes('Hardcoded output'))).toBe(true);
    });

    it('penalizes algorithm/concept bypass (e.g. calling built-in sort when BubbleSort required)', async () => {
      const grading = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 4,
        difficulty: 'EASY',
        studentUsername: 'shortcut_sam',
        assignedStudentIssues: [4],
        prNumber: 45,
        changedFiles: [
          {
            filename: 'src/main/java/hackathon/BubbleSort.java',
            status: 'modified',
            patch: 'Arrays.sort(arr); // Bypassing required bubble sort algorithm',
          },
        ],
        commits: [
          {
            sha: 'commit_bypass',
            message: 'Fix issue #4: sorting',
            author: 'shortcut_sam',
          },
        ],
        codeAnalysis: {
          bypassedRequiredConcept: true,
        },
      });

      expect(grading.deductions.codeQuality.some((d) => d.includes('Bypassed required concept'))).toBe(true);
    });

    it('evaluates compilation failure independently with 0 correctness but quality preserved', async () => {
      const grading = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 5,
        difficulty: 'EASY',
        studentUsername: 'student_eva',
        assignedStudentIssues: [5],
        prNumber: 46,
        changedFiles: [
          {
            filename: 'src/main/java/hackathon/BrokenSyntax.java',
            status: 'modified',
            patch: 'int x = ; // syntax error',
          },
        ],
        commits: [
          {
            sha: 'commit_compile_fail',
            message: 'Fix issue #5: attempt syntax',
            author: 'student_eva',
          },
        ],
        testExecutionResult: {
          compilationPassed: false,
        },
      });

      expect(grading.rawComponentScores.correctness).toBe(0);
      expect(grading.rawComponentScores.commitQuality).toBeGreaterThan(0);
    });

    it('penalizes empty and duplicate commits without penalizing single legitimate commits', async () => {
      // Multiple empty commits penalized
      const emptyGrade = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 6,
        difficulty: 'EASY',
        studentUsername: 'inflater_ian',
        assignedStudentIssues: [6],
        prNumber: 47,
        changedFiles: [],
        commits: [
          { sha: 'e1', message: 'commit 1', author: 'inflater_ian' },
          { sha: 'e2', message: 'commit 2', author: 'inflater_ian' },
        ],
        codeAnalysis: {
          emptyCommitsDetected: true,
        },
      });
      expect(emptyGrade.deductions.commitQuality.some((d) => d.includes('Empty commits'))).toBe(true);

      // One meaningful offline commit receives full commit marks
      const singleCommitGrade = await javaGradingEngine.gradeIssue({
        repositoryId: 'Squade_1',
        issueNumber: 6,
        difficulty: 'EASY',
        studentUsername: 'offline_olivia',
        assignedStudentIssues: [6],
        prNumber: 48,
        changedFiles: [{ filename: 'src/main/java/hackathon/Solver.java', status: 'modified' }],
        commits: [
          {
            sha: 'clean_offline',
            message: 'Fix issue #6: complete offline implementation',
            author: 'offline_olivia',
          },
        ],
      });
      expect(singleCommitGrade.rawComponentScores.commitQuality).toBe(1.0);
    });
  });

  // ─────────────────────────────────────────────
  // 4. MANUAL BONUS XP (SECTION 10)
  // ─────────────────────────────────────────────
  describe('Manual Bonus XP & Audit Ledger', () => {
    it('awards strictly positive bonus XP and updates totalXP = earnedXP + bonusXP', async () => {
      const team: FirestoreTeam = {
        id: 'team_squade_10',
        name: 'Squad 10',
        repositoryId: 'Squade_10',
        repositoryName: 'Squade_10',
        members: [],
        earnedXP: 50,
        bonusXP: 0,
        totalXP: 50,
        totalScore: 50,
        assignedIssueCount: 4,
        validatedIssueCount: 2,
        veryHardSolvedCount: 0,
        prsSubmitted: 0,
        solvedIssues: [],
        active: true,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };
      await teamService.saveTeam(team);

      // Preview
      const preview = await bonusService.previewBonusAward('team_squade_10', 25);
      expect(preview.earnedXP).toBe(50);
      expect(preview.currentBonusXP).toBe(0);
      expect(preview.bonusAmount).toBe(25);
      expect(preview.newTotalXP).toBe(75);

      // Award Bonus
      const res = await bonusService.awardBonus({
        teamId: 'team_squade_10',
        amount: 25,
        reason: 'Outstanding offline mentoring and sportsmanship',
        adminUsername: 'lead_organizer',
      });

      expect(res.success).toBe(true);
      expect(res.bonusAmount).toBe(25);
      expect(res.newTotalXP).toBe(75);
      expect(res.transaction.adminUsername).toBe('lead_organizer');
      expect(res.transaction.reason).toBe('Outstanding offline mentoring and sportsmanship');

      // Verify earnedXP was NOT modified
      const updatedTeam = await teamService.getTeamById('team_squade_10');
      expect(updatedTeam?.earnedXP).toBe(50);
      expect(updatedTeam?.bonusXP).toBe(25);
      expect(updatedTeam?.totalXP).toBe(75);
    });

    it('strictly rejects negative or zero bonus XP amounts', async () => {
      await expect(
        bonusService.awardBonus({
          teamId: 'team_squade_10',
          amount: -10,
          reason: 'Penalty attempt',
          adminUsername: 'lead_organizer',
        })
      ).rejects.toThrow(/strictly positive/i);

      await expect(
        bonusService.awardBonus({
          teamId: 'team_squade_10',
          amount: 0,
          reason: 'Zero bonus',
          adminUsername: 'lead_organizer',
        })
      ).rejects.toThrow(/strictly positive/i);
    });

    it('rejects bonus award without mandatory justification reason', async () => {
      await expect(
        bonusService.awardBonus({
          teamId: 'team_squade_10',
          amount: 15,
          reason: '',
          adminUsername: 'lead_organizer',
        })
      ).rejects.toThrow(/mandatory reason/i);
    });

    it('rejects unauthorized bonus requests without admin identity', async () => {
      await expect(
        bonusService.awardBonus({
          teamId: 'team_squade_10',
          amount: 15,
          reason: 'Some reason',
          adminUsername: '',
        })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('provides idempotency protection to prevent duplicate bonus awards', async () => {
      const idempotencyKey = 'bonus_txn_duplicate_test_key_123';

      const res1 = await bonusService.awardBonus({
        teamId: 'team_squade_10',
        amount: 10,
        reason: 'Participation prize',
        adminUsername: 'lead_organizer',
        idempotencyKey,
      });

      const res2 = await bonusService.awardBonus({
        teamId: 'team_squade_10',
        amount: 10,
        reason: 'Participation prize',
        adminUsername: 'lead_organizer',
        idempotencyKey,
      });

      expect(res1.transaction.id).toBe(res2.transaction.id);
      expect(res2.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 5. FLEXIBLE TEAM SIZES (4 OR 5 MEMBERS)
  // ─────────────────────────────────────────────
  describe('Flexible Team Size Support (4 or 5 Students)', () => {
    it('supports 4-member teams by default and enforces configured size', () => {
      const team4: FirestoreTeam = {
        id: 'team_sq_4',
        name: 'Squad 4 Default',
        repositoryId: 'Squade_4',
        repositoryName: 'Squade_4',
        members: [
          { studentId: 's1', name: 'Member 1', githubUsername: 'm1', assignedIssues: [] },
          { studentId: 's2', name: 'Member 2', githubUsername: 'm2', assignedIssues: [] },
          { studentId: 's3', name: 'Member 3', githubUsername: 'm3', assignedIssues: [] },
          { studentId: 's4', name: 'Member 4', githubUsername: 'm4', assignedIssues: [] },
        ],
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        veryHardSolvedCount: 0,
        totalScore: 0,
        prsSubmitted: 0,
        solvedIssues: [],
        active: true,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      const val = teamService.validateTeamForActivation(team4, []);
      expect(val.valid).toBe(true);
    });

    it('approves a 5-member team with administrative justification and audit record', async () => {
      const team5: FirestoreTeam = {
        id: 'team_sq_5_flex',
        name: 'Squad 5 Flex',
        repositoryId: 'Squade_5',
        repositoryName: 'Squade_5',
        members: [
          { studentId: 'm1', name: 'Student 1', githubUsername: 's1', assignedIssues: [] },
          { studentId: 'm2', name: 'Student 2', githubUsername: 's2', assignedIssues: [] },
          { studentId: 'm3', name: 'Student 3', githubUsername: 's3', assignedIssues: [] },
          { studentId: 'm4', name: 'Student 4', githubUsername: 's4', assignedIssues: [] },
          { studentId: 'm5', name: 'Student 5', githubUsername: 's5', assignedIssues: [] },
        ],
        assignedIssueCount: 5,
        validatedIssueCount: 0,
        veryHardSolvedCount: 0,
        totalScore: 0,
        prsSubmitted: 0,
        solvedIssues: [],
        active: true,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };
      await teamService.saveTeam(team5);

      // Approve 5th student
      const audit = await teamService.approveFiveMemberTeam(
        'team_sq_5_flex',
        'Official accommodation approved by organizing committee due to odd enrollment count.',
        'super_admin'
      );

      expect(audit.action).toBe('TEAM_SIZE_CHANGED');
      expect(audit.details?.newSize).toBe(5);

      const updated = await teamService.getTeamById('team_sq_5_flex');
      expect(updated?.configuredTeamSize).toBe(5);
      expect(updated?.sizeChangeReason).toContain('Official accommodation');

      const val = teamService.validateTeamForActivation(updated as any, []);
      expect(val.valid).toBe(true);
    });

    it('prevents registering the same student across multiple squads', () => {
      const existingTeam: FirestoreTeam = {
        id: 'team_a',
        name: 'Squad A',
        repositoryId: 'Squade_1',
        repositoryName: 'Squade_1',
        members: [
          { studentId: 's_common', name: 'Shared', githubUsername: 'shared_student', assignedIssues: [] },
          { studentId: 's_a2', name: 'A2', githubUsername: 'a2', assignedIssues: [] },
          { studentId: 's_a3', name: 'A3', githubUsername: 'a3', assignedIssues: [] },
          { studentId: 's_a4', name: 'A4', githubUsername: 'a4', assignedIssues: [] },
        ],
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        veryHardSolvedCount: 0,
        totalScore: 0,
        prsSubmitted: 0,
        solvedIssues: [],
        active: true,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      const newTeam: FirestoreTeam = {
        id: 'team_b',
        name: 'Squad B',
        repositoryId: 'Squade_2',
        repositoryName: 'Squade_2',
        members: [
          { studentId: 's_common_2', name: 'Shared', githubUsername: 'shared_student', assignedIssues: [] }, // Duplicate
          { studentId: 's_b2', name: 'B2', githubUsername: 'b2', assignedIssues: [] },
          { studentId: 's_b3', name: 'B3', githubUsername: 'b3', assignedIssues: [] },
          { studentId: 's_b4', name: 'B4', githubUsername: 'b4', assignedIssues: [] },
        ],
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        veryHardSolvedCount: 0,
        totalScore: 0,
        prsSubmitted: 0,
        solvedIssues: [],
        active: true,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      const val = teamService.validateTeamForActivation(newTeam, [existingTeam]);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('already registered in active team'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 6. LEADERBOARD RANKING & AWARDS (SECTION 12)
  // ─────────────────────────────────────────────
  describe('Leaderboard Ranking by totalXP and Very Hard Specialist Award', () => {
    it('ranks teams by totalXP (earnedXP + bonusXP) descending', () => {
      const teamA: Team = {
        id: 'team_a',
        name: 'Team Alpha',
        repositoryId: 'Squade_1',
        repositoryName: 'Squade_1',
        members: [],
        earnedXP: 100,
        bonusXP: 20, // totalXP = 120
        totalXP: 120,
        totalScore: 120,
        assignedIssueCount: 4,
        validatedIssueCount: 5,
        veryHardSolvedCount: 1,
        prsSubmitted: 4,
        solvedIssues: [],
        active: true,
        rank: 1,
        previousRank: 1,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      const teamB: Team = {
        id: 'team_b',
        name: 'Team Beta',
        repositoryId: 'Squade_2',
        repositoryName: 'Squade_2',
        members: [],
        earnedXP: 110,
        bonusXP: 0, // totalXP = 110
        totalXP: 110,
        totalScore: 110,
        assignedIssueCount: 4,
        validatedIssueCount: 5,
        veryHardSolvedCount: 2,
        prsSubmitted: 4,
        solvedIssues: [],
        active: true,
        rank: 2,
        previousRank: 2,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      // Team Alpha has higher totalXP (120 vs 110) despite lower earnedXP
      const cmp = compareTeamsPhase5(teamA, teamB);
      expect(cmp).toBeLessThan(0); // Team A ranks higher
    });

    it('resolves Very Hard Specialist award with unique accurately solved count and score tiebreaker', () => {
      const team1: Team = {
        id: 't1',
        name: 'Squad 1',
        repositoryId: 'Squade_1',
        repositoryName: 'Squade_1',
        members: [],
        totalXP: 100,
        totalScore: 100,
        assignedIssueCount: 4,
        validatedIssueCount: 4,
        veryHardSolvedCount: 3,
        veryHardScore: 120,
        prsSubmitted: 4,
        solvedIssues: [],
        active: true,
        rank: 1,
        previousRank: 1,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      const team2: Team = {
        id: 't2',
        name: 'Squad 2',
        repositoryId: 'Squade_2',
        repositoryName: 'Squade_2',
        members: [],
        totalXP: 100,
        totalScore: 100,
        assignedIssueCount: 4,
        validatedIssueCount: 4,
        veryHardSolvedCount: 2,
        veryHardScore: 80,
        prsSubmitted: 4,
        solvedIssues: [],
        active: true,
        rank: 2,
        previousRank: 2,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      };

      const cmp = compareTeamsPhase5(team1, team2);
      expect(cmp).toBeLessThan(0); // Team 1 has 3 Very Hard solved vs 2
    });
  });
});
