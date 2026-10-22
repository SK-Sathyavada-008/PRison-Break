// ─────────────────────────────────────────────
// PRison Break — Phase 7 Full System Validation Test Suite
// Exhaustive validation of the offline-first Java hackathon model:
// 1. Registration Scenarios (4-student squads, unique repos, unique assignments)
// 2. Offline Synchronization (commits ingestion, conventional msgs, multi-issue PRs, duplicates, attribution)
// 3. Deterministic Java Grading Engine (all 4 difficulties, partials, compilation, tampering, sandbox)
// 4. Scoring Engine & Ledger (70/20/10 formula, rounding, idempotency, webhook redelivery, Very Hard award)
// 5. Leaderboard & Awards (ranking, repository display, tie-breaking, visibility, auth protection)
// 6. Security & Isolation (webhook signatures, server authorization, Firestore rules, secret sanitization)
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Services under test
import { teamService, sortTeams, getAwardsSummary } from '../teamService';
import { issueService } from '../issueService';
import { javaGradingEngine, calculateAwardedPoints, roundToTwoDecimals } from '../javaGradingEngine';
import { sandboxRunner } from '../sandboxRunner';
import { offlinePRValidationService } from '../offlinePRValidationService';
import { eventConfigService } from '../eventConfigService';
import { extractAllLinkedIssues } from '../prValidationPipeline';
import type { FirestoreTeam, FirestoreIssue, Team, IssueDifficulty } from '../../types';

// ─────────────────────────────────────────────
// DEVELOPMENT-ONLY TEST FIXTURE
// ─────────────────────────────────────────────
const FIXTURE_REPO_A = 'squard_1';
const FIXTURE_REPO_B = 'squard_2';

function createDevelopmentTestFixture() {
  const teamA: FirestoreTeam = {
    id: 'team_squard_1',
    name: 'Squad 1 (Team A)',
    repositoryId: FIXTURE_REPO_A,
    repositoryName: FIXTURE_REPO_A,
    repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
    members: [
      {
        studentId: 's_a1',
        name: 'Student A1',
        githubUsername: 'student_a1',
        assignedIssues: [1, 2], // Easy (#1) & Medium (#2)
        prSubmitted: true,
        prNumber: 101,
        score: 30,
      },
      {
        studentId: 's_a2',
        name: 'Student A2',
        githubUsername: 'student_a2',
        assignedIssues: [3], // Hard (#3)
        prSubmitted: true,
        prNumber: 102,
        score: 30,
      },
      {
        studentId: 's_a3',
        name: 'Student A3',
        githubUsername: 'student_a3',
        assignedIssues: [4], // Very Hard (#4)
        prSubmitted: true,
        prNumber: 103,
        score: 40,
      },
      {
        studentId: 's_a4',
        name: 'Student A4',
        githubUsername: 'student_a4',
        assignedIssues: [5], // Medium (#5)
        prSubmitted: false, // Incomplete submission demonstration
      },
    ],
    totalScore: 100,
    solvedIssues: [
      { issueNumber: 1, difficulty: 'EASY', points: 10, solvedByUsername: 'student_a1', prNumber: 101, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
      { issueNumber: 2, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'student_a1', prNumber: 101, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
      { issueNumber: 3, difficulty: 'HARD', points: 30, solvedByUsername: 'student_a2', prNumber: 102, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
      { issueNumber: 4, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'student_a3', prNumber: 103, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
    ],
    validatedIssueCount: 4,
    correctlySolvedIssuesCount: 4,
    veryHardSolvedCount: 1,
    assignedIssueCount: 5,
    prsSubmitted: 3,
    active: true,
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T09:00:00Z',
  };

  const teamB: FirestoreTeam = {
    id: 'team_squard_2',
    name: 'Squad 2 (Team B)',
    repositoryId: FIXTURE_REPO_B,
    repositoryName: FIXTURE_REPO_B,
    repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_B}`,
    members: [
      {
        studentId: 's_b1',
        name: 'Student B1',
        githubUsername: 'student_b1',
        assignedIssues: [1], // Easy (#1)
        prSubmitted: true,
        prNumber: 201,
        score: 10,
      },
      {
        studentId: 's_b2',
        name: 'Student B2',
        githubUsername: 'student_b2',
        assignedIssues: [2], // Medium (#2)
        prSubmitted: true,
        prNumber: 202,
        score: 20,
      },
      {
        studentId: 's_b3',
        name: 'Student B3',
        githubUsername: 'student_b3',
        assignedIssues: [3], // Hard (#3)
        prSubmitted: true,
        prNumber: 203,
        score: 30,
      },
      {
        studentId: 's_b4',
        name: 'Student B4',
        githubUsername: 'student_b4',
        assignedIssues: [4], // Very Hard (#4)
        prSubmitted: true,
        prNumber: 204,
        score: 40,
      },
    ],
    totalScore: 100,
    solvedIssues: [
      { issueNumber: 1, difficulty: 'EASY', points: 10, solvedByUsername: 'student_b1', prNumber: 201, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
      { issueNumber: 2, difficulty: 'MEDIUM', points: 20, solvedByUsername: 'student_b2', prNumber: 202, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
      { issueNumber: 3, difficulty: 'HARD', points: 30, solvedByUsername: 'student_b3', prNumber: 203, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
      { issueNumber: 4, difficulty: 'VERY_HARD', points: 40, solvedByUsername: 'student_b4', prNumber: 204, correctnessScore: 1.0, solvedAt: '2026-10-22T08:30:00Z' },
    ],
    validatedIssueCount: 4,
    correctlySolvedIssuesCount: 4,
    veryHardSolvedCount: 1,
    assignedIssueCount: 4,
    prsSubmitted: 4,
    active: true,
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T09:00:00Z',
  };

  const fixtureIssues: FirestoreIssue[] = [
    {
      id: 'issue_squard_1_1',
      repositoryId: FIXTURE_REPO_A,
      repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
      issueNumber: 1,
      title: 'Easy: Basic Java syntax and loops',
      difficulty: 'EASY',
      basePoints: 10,
      assignedStudentUsername: 'student_a1',
      teamId: 'team_squard_1',
      url: `https://github.com/PRison-Break-2026/${FIXTURE_REPO_A}/issues/1`,
      active: true,
      gradingStatus: 'UNGRADED',
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-22T08:00:00Z',
    },
    {
      id: 'issue_squard_1_2',
      repositoryId: FIXTURE_REPO_A,
      repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
      issueNumber: 2,
      title: 'Medium: Array manipulation and helper methods',
      difficulty: 'MEDIUM',
      basePoints: 20,
      assignedStudentUsername: 'student_a1',
      teamId: 'team_squard_1',
      url: `https://github.com/PRison-Break-2026/${FIXTURE_REPO_A}/issues/2`,
      active: true,
      gradingStatus: 'UNGRADED',
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-22T08:00:00Z',
    },
    {
      id: 'issue_squard_1_3',
      repositoryId: FIXTURE_REPO_A,
      repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
      issueNumber: 3,
      title: 'Hard: Object-oriented state machine',
      difficulty: 'HARD',
      basePoints: 30,
      assignedStudentUsername: 'student_a2',
      teamId: 'team_squard_1',
      url: `https://github.com/PRison-Break-2026/${FIXTURE_REPO_A}/issues/3`,
      active: true,
      gradingStatus: 'UNGRADED',
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-22T08:00:00Z',
    },
    {
      id: 'issue_squard_1_4',
      repositoryId: FIXTURE_REPO_A,
      repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
      issueNumber: 4,
      title: 'Very Hard: Comprehensive custom data structure',
      difficulty: 'VERY_HARD',
      basePoints: 40,
      assignedStudentUsername: 'student_a3',
      teamId: 'team_squard_1',
      url: `https://github.com/PRison-Break-2026/${FIXTURE_REPO_A}/issues/4`,
      active: true,
      gradingStatus: 'UNGRADED',
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-22T08:00:00Z',
    },
    {
      id: 'issue_squard_2_4',
      repositoryId: FIXTURE_REPO_B,
      repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_B}`,
      issueNumber: 4,
      title: 'Very Hard: Custom binary search tree in Java',
      difficulty: 'VERY_HARD',
      basePoints: 40,
      assignedStudentUsername: 'student_b4',
      teamId: 'team_squard_2',
      url: `https://github.com/PRison-Break-2026/${FIXTURE_REPO_B}/issues/4`,
      active: true,
      gradingStatus: 'UNGRADED',
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-22T08:00:00Z',
    },
  ];

  return { teamA, teamB, fixtureIssues };
}

describe('PHASE 7 — Full System Validation Test Suite', () => {
  beforeEach(() => {
    sandboxRunner.setSandboxAvailable(true);
  });

  // ═════════════════════════════════════════════════════════════
  // 1. REGISTRATION SCENARIOS
  // ═════════════════════════════════════════════════════════════
  describe('1. Registration Scenarios', () => {
    it('accepts a valid team with exactly 4 registered students and 1 repository', () => {
      const { teamA } = createDevelopmentTestFixture();
      const validation = teamService.validateTeamForActivation(teamA, []);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('rejects a team that has only 3 registered students', () => {
      const { teamA } = createDevelopmentTestFixture();
      const incompleteTeam = {
        ...teamA,
        members: teamA.members.slice(0, 3), // Only 3 students
      };
      const validation = teamService.validateTeamForActivation(incompleteTeam, []);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toMatch(/exactly 4 registered members/i);
    });

    it('rejects registration when a student is assigned to two active teams', () => {
      const { teamA, teamB } = createDevelopmentTestFixture();
      // Attempt to register student_a1 in team B as well
      const collidingTeamB = {
        ...teamB,
        members: [
          ...teamB.members.slice(0, 3),
          { ...teamB.members[3], githubUsername: 'student_a1' },
        ],
      };

      const validation = teamService.validateTeamForActivation(collidingTeamB, [teamA]);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('already registered in active team'))).toBe(true);
    });

    it('rejects registration when a repository is assigned to two teams', () => {
      const { teamA, teamB } = createDevelopmentTestFixture();
      // Attempt to assign squard_1 to Team B
      const duplicateRepoTeam = {
        ...teamB,
        repositoryId: FIXTURE_REPO_A,
      };

      const validation = teamService.validateTeamForActivation(duplicateRepoTeam, [teamA]);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('already assigned to active team'))).toBe(true);
    });

    it('identifies and flags when an issue is assigned to two students in the same repository', () => {
      const duplicateAssignmentIssues: FirestoreIssue[] = [
        {
          id: 'i1',
          repositoryId: FIXTURE_REPO_A,
          repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
          issueNumber: 1,
          title: 'Issue 1',
          difficulty: 'EASY',
          basePoints: 10,
          assignedStudentUsername: 'student_a1',
          url: 'https://github.com/test',
          active: true,
          gradingStatus: 'UNGRADED',
          createdAt: '2026-10-22T08:00:00Z',
          updatedAt: '2026-10-22T08:00:00Z',
        },
        {
          id: 'i2',
          repositoryId: FIXTURE_REPO_A,
          repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
          issueNumber: 1,
          title: 'Issue 1 duplicated',
          difficulty: 'EASY',
          basePoints: 10,
          assignedStudentUsername: 'student_a2', // Collision! Same issue #1 in squard_1
          url: 'https://github.com/test',
          active: true,
          gradingStatus: 'UNGRADED',
          createdAt: '2026-10-22T08:00:00Z',
          updatedAt: '2026-10-22T08:00:00Z',
        },
      ];

      const validation = issueService.validateIssueAssignments(duplicateAssignmentIssues);
      expect(validation.duplicates).toHaveLength(1);
      expect(validation.duplicates[0].issueNumber).toBe(1);
      expect(validation.duplicates[0].assignedStudents).toContain('student_a1');
      expect(validation.duplicates[0].assignedStudents).toContain('student_a2');
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 2. OFFLINE CONTRIBUTION SYNCHRONIZATION
  // ═════════════════════════════════════════════════════════════
  describe('2. Offline Contribution Synchronization', () => {
    it('handles multiple local offline commits pushed after Wi-Fi reconnection', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: FIXTURE_REPO_A,
        repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
        prNumber: 101,
        title: 'Fix issue #1: Offline Java matrix rotation',
        authorUsername: 'student_a1',
        assignedIssues: [1],
        commits: [
          { sha: 'sha_off_1', message: 'Local commit 1: create basic class structure', author: 'student_a1' },
          { sha: 'sha_off_2', message: 'Local commit 2: implement rotation algorithm', author: 'student_a1' },
          { sha: 'sha_off_3', message: 'Local commit 3: add unit tests before pushing', author: 'student_a1' },
        ],
        changedFiles: [
          { filename: 'src/main/java/Matrix.java', status: 'modified', additions: 30, deletions: 0 },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.assignedIssuesCovered).toEqual([1]);
      expect(result.attributionWarnings).toHaveLength(0);
    });

    it('extracts linked issues from standard git commit message "Fix issue #12"', () => {
      const extracted = extractAllLinkedIssues('Final Submission PR', 'git commit -m "Fix issue #12"');
      expect(extracted).toContain(12);
    });

    it('grades multiple assigned issues inside one final PR independently', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: FIXTURE_REPO_A,
        repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
        prNumber: 101,
        title: 'Fix issue #1 and closes #2: Completed assigned modules',
        authorUsername: 'student_a1',
        assignedIssues: [1, 2], // Student A1 has both #1 (Easy: 10) and #2 (Medium: 20)
        issueDifficulties: { 1: 'EASY', 2: 'MEDIUM' },
        commits: [
          { sha: 'sha1', message: 'Fix issue #1', author: 'student_a1' },
          { sha: 'sha2', message: 'Closes #2', author: 'student_a1' },
        ],
        changedFiles: [
          { filename: 'src/main/java/Module1.java', status: 'modified', additions: 20, deletions: 0 },
          { filename: 'src/main/java/Module2.java', status: 'modified', additions: 40, deletions: 0 },
        ],
        mockExecutionResult: {
          compiles: true,
          totalTests: 6,
          testsPassed: 6,
          normalInputsPassed: true,
          edgeCasesPassed: true,
        },
      });

      expect(result.valid).toBe(true);
      expect(result.assignedIssuesCovered).toEqual([1, 2]);
      expect(result.gradingRecords).toHaveLength(2);
      expect(result.gradingRecords[0].awardedPoints).toBe(10); // Easy = 10 pts
      expect(result.gradingRecords[1].awardedPoints).toBe(20); // Medium = 20 pts
      expect(result.totalAwardedPoints).toBe(30);
    });

    it('flags and rejects automatic scoring if a student submits a second competition PR', async () => {
      const spy = vi.spyOn(offlinePRValidationService, 'checkOnePRPerStudent').mockResolvedValueOnce({
        isDuplicate: true,
        priorPRs: [101],
        warning: 'DUPLICATE_PR_VIOLATION: Student @student_a1 previously submitted PR #101.',
      });

      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: FIXTURE_REPO_A,
        repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
        prNumber: 102,
        title: 'Second PR attempting to fix issue #1 again',
        authorUsername: 'student_a1',
        assignedIssues: [1],
      });

      expect(result.valid).toBe(false);
      expect(result.isOnePRRuleViolated).toBe(true);
      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.totalAwardedPoints).toBe(0);
      spy.mockRestore();
    });

    it('penalizes scope discipline when a PR touches unrelated files', () => {
      const evaluation = javaGradingEngine.evaluateCodeQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [
          { filename: 'src/main/java/Matrix.java', status: 'modified' },
          { filename: 'pom.xml', status: 'modified' },
          { filename: 'README.md', status: 'modified' },
        ],
        commitMessages: ['Fix issue #1 and random files'],
        codeAnalysis: {
          unrelatedFilesTouched: true,
        },
      });

      expect(evaluation.score).toBeLessThan(1.0);
      expect(evaluation.deductions.some((d) => d.includes('Scope discipline'))).toBe(true);
    });

    it('disallows points when a PR attempts to solve another student assigned issue', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: FIXTURE_REPO_A,
        repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
        prNumber: 101,
        title: 'Fix issue #1 and closes #3: Trying to do teammate work',
        authorUsername: 'student_a1',
        assignedIssues: [1], // Student A1 is assigned #1, NOT #3
        commits: [{ sha: 's1', message: 'Solve #1 and #3', author: 'student_a1' }],
      });

      expect(result.assignedIssuesCovered).toEqual([1]);
      expect(result.unassignedIssuesDetected).toEqual([3]);
      expect(result.attributionWarnings.some((w) => w.includes('UNASSIGNED_ISSUE: Issue #3'))).toBe(true);
    });

    it('flags attribution mismatch when git commit author does not match verified PR student', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: FIXTURE_REPO_A,
        repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
        prNumber: 101,
        title: 'Fix issue #1',
        authorUsername: 'student_a1',
        assignedIssues: [1],
        commits: [
          { sha: 's1', message: 'Fix issue #1', author: 'some_external_friend' },
        ],
      });

      expect(result.attributionWarnings.some((w) => w.includes('ATTRIBUTION_MISMATCH'))).toBe(true);
      expect(result.status).toBe('PENDING_REVIEW');
    });

    it('handles student pushing more commits to an existing open PR', async () => {
      const updated = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: FIXTURE_REPO_A,
        repositoryFullName: `PRison-Break-2026/${FIXTURE_REPO_A}`,
        prNumber: 101,
        title: 'Fix issue #1',
        authorUsername: 'student_a1',
        assignedIssues: [1],
        commits: [
          { sha: 'c1', message: 'WIP issue #1', author: 'student_a1' },
          { sha: 'c2', message: 'Final polish for issue #1', author: 'student_a1' },
        ],
      });

      expect(updated.valid).toBe(true);
      expect(updated.assignedIssuesCovered).toEqual([1]);
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 3. DETERMINISTIC JAVA GRADING ENGINE
  // ═════════════════════════════════════════════════════════════
  describe('3. Deterministic Java Grading Engine', () => {
    const difficulties: Array<{ diff: IssueDifficulty; maxPts: number }> = [
      { diff: 'EASY', maxPts: 10 },
      { diff: 'MEDIUM', maxPts: 20 },
      { diff: 'HARD', maxPts: 30 },
      { diff: 'VERY_HARD', maxPts: 40 },
    ];

    difficulties.forEach(({ diff, maxPts }) => {
      it(`awards exactly ${maxPts} points for a completely correct ${diff} solution`, async () => {
        const grade = await javaGradingEngine.gradeIssue({
          issueNumber: 1,
          difficulty: diff,
          studentUsername: 'student_a1',
          assignedStudentIssues: [1],
          teamId: 'team_squard_1',
          repositoryId: FIXTURE_REPO_A,
          prNumber: 101,
          changedFiles: [{ filename: 'src/main/java/Solution.java', status: 'modified' }],
          commitMessages: [`Fix ${diff} issue #1: complete beginner Java solution`],
          mockExecutionResult: {
            compiles: true,
            totalTests: 10,
            testsPassed: 10,
            normalInputsPassed: true,
            edgeCasesPassed: true,
          },
        });

        expect(grade.basePoints).toBe(maxPts);
        expect(grade.rawComponentScores.correctness).toBe(1.0);
        expect(grade.awardedPoints).toBe(maxPts);
      });
    });

    it('grades partially correct solutions proportionally (handles basic inputs, fails edge cases)', async () => {
      const correctness = await javaGradingEngine.evaluateCorrectness({
        issueNumber: 1,
        difficulty: 'MEDIUM',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [{ filename: 'src/main/java/Solution.java', status: 'modified' }],
        commitMessages: ['Partial solution'],
        mockExecutionResult: {
          compiles: true,
          totalTests: 10,
          testsPassed: 7,
          normalInputsPassed: true,
          edgeCasesPassed: false,
        },
      });

      expect(correctness.score).toBe(0.70);
      expect(correctness.deductions.some((d) => d.includes('Edge case failures'))).toBe(true);
    });

    it('awards 0 correctness points when submitted Java code fails compilation', async () => {
      const correctness = await javaGradingEngine.evaluateCorrectness({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [{ filename: 'src/main/java/Broken.java', status: 'modified' }],
        commitMessages: ['Syntax error code'],
        mockExecutionResult: {
          compiles: false,
        },
      });

      expect(correctness.score).toBe(0);
      expect(correctness.deductions.some((d) => d.includes('Compilation failure'))).toBe(true);
    });

    it('detects test tampering and rejects solution with 0 points and security violation', async () => {
      const correctness = await javaGradingEngine.evaluateCorrectness({
        issueNumber: 1,
        difficulty: 'HARD',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [
          {
            filename: 'src/test/java/SolutionTest.java',
            status: 'modified',
            patch: '@@ -15,1 +15,1 @@ @Disabled\n- assertEquals(expected, actual);',
          },
        ],
        commitMessages: ['Disable failing tests'],
      });

      expect(correctness.score).toBe(0);
      expect(correctness.sandboxResult.tamperingDetected).toBe(true);
      expect(correctness.deductions.some((d) => d.includes('Security Violation'))).toBe(true);
    });

    it('evaluates poor but functional code accurately without failing correctness', () => {
      const quality = javaGradingEngine.evaluateCodeQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [{ filename: 'src/main/java/Messy.java', status: 'modified' }],
        commitMessages: ['Fix'],
        codeAnalysis: {
          singleLetterVariables: true,
          deepNestingOrEmptyCatch: true,
        },
      });

      expect(quality.score).toBeLessThan(1.0);
      expect(quality.score).toBeGreaterThanOrEqual(0.60);
      expect(quality.deductions.length).toBeGreaterThan(0);
    });

    it('handles sandbox execution timeouts gracefully by awarding 0 correctness points', async () => {
      const correctness = await javaGradingEngine.evaluateCorrectness({
        issueNumber: 1,
        difficulty: 'VERY_HARD',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [{ filename: 'src/main/java/InfiniteLoop.java', status: 'modified' }],
        commitMessages: ['Infinite loop submission'],
        mockExecutionResult: {
          timeout: true,
        },
      });

      expect(correctness.score).toBe(0);
      expect(correctness.deductions.some((d) => d.includes('timeout'))).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 4. SCORING ENGINE & IDEMPOTENCY
  // ═════════════════════════════════════════════════════════════
  describe('4. Scoring Engine & Ledger', () => {
    it('strictly applies the 70% C + 20% Q + 10% M scoring formula', () => {
      // Base points = 40 (Very Hard)
      // C = 0.80, Q = 0.90, M = 0.70
      // Weighted = 0.70 * 0.80 + 0.20 * 0.90 + 0.10 * 0.70 = 0.56 + 0.18 + 0.07 = 0.81
      // Awarded = 40 * 0.81 = 32.40
      const score = calculateAwardedPoints(40, 0.80, 0.90, 0.70);
      expect(score).toBe(32.40);
    });

    it('ensures rounding to exactly two decimal places avoiding IEEE-754 precision drift', () => {
      expect(roundToTwoDecimals(19.9999999999)).toBe(20.00);
      expect(roundToTwoDecimals(14.3333333333)).toBe(14.33);
    });

    it('scores multiple commits on the same issue without multiplying the score', async () => {
      const grade = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student_a1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: FIXTURE_REPO_A,
        prNumber: 101,
        changedFiles: [{ filename: 'src/main/java/Main.java', status: 'modified' }],
        commitMessages: [
          'Commit 1: initial attempt on issue #1',
          'Commit 2: second attempt on issue #1',
          'Commit 3: final polish for issue #1',
        ],
        mockExecutionResult: { compiles: true, totalTests: 4, testsPassed: 4 },
      });

      // Still awards max 10 points for issue #1, not 30 points
      expect(grade.awardedPoints).toBe(10);
    });

    it('computes team score as the sum of unique issue scores', () => {
      const { teamA } = createDevelopmentTestFixture();
      const uniqueSum = teamA.solvedIssues.reduce((sum, s) => sum + s.points, 0);
      expect(teamA.totalScore).toBe(uniqueSum);
    });

    it('evaluates Very Hard award based on accuracy threshold (>= 95%)', () => {
      const { teamA } = createDevelopmentTestFixture();
      const vhSummary = getAwardsSummary([teamA as any]);
      expect(vhSummary.veryHardSpecialist.highestCount).toBe(1);
      expect(vhSummary.veryHardSpecialist.highestScore).toBe(40);
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 5. LEADERBOARD & AWARDS
  // ═════════════════════════════════════════════════════════════
  describe('5. Leaderboard & Awards', () => {
    it('ranks teams correctly by total XP descending', () => {
      const team1: Team = {
        id: 't1',
        name: 'Squad 1',
        repositoryId: 'squard_1',
        repositoryName: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        members: [],
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        correctlySolvedIssuesCount: 0,
        veryHardSolvedCount: 0,
        prsSubmitted: 0,
        totalScore: 350,
        solvedIssues: [],
        rank: 0,
        previousRank: 0,
        active: true,
        createdAt: '2026-10-22T08:00:00Z',
        updatedAt: '2026-10-22T08:00:00Z',
      };

      const team2: Team = {
        id: 't2',
        name: 'Squad 2',
        repositoryId: 'squard_2',
        repositoryName: 'squard_2',
        repositoryFullName: 'PRison-Break-2026/squard_2',
        members: [],
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        correctlySolvedIssuesCount: 0,
        veryHardSolvedCount: 0,
        prsSubmitted: 0,
        totalScore: 380,
        solvedIssues: [],
        rank: 0,
        previousRank: 0,
        active: true,
        createdAt: '2026-10-22T08:00:00Z',
        updatedAt: '2026-10-22T08:00:00Z',
      };

      const ranked = sortTeams([team1, team2]);
      expect(ranked[0].repositoryName).toBe('squard_2');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].repositoryName).toBe('squard_1');
      expect(ranked[1].rank).toBe(2);
    });

    it('displays registered repository names rather than assumption of team names', () => {
      const team: Team = {
        id: 'team_xyz',
        name: 'The Cyber Hackers',
        repositoryId: 'squard_1',
        repositoryName: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        members: [],
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        correctlySolvedIssuesCount: 0,
        veryHardSolvedCount: 0,
        prsSubmitted: 0,
        totalScore: 200,
        solvedIssues: [],
        rank: 1,
        previousRank: 1,
        active: true,
        createdAt: '2026-10-22T08:00:00Z',
        updatedAt: '2026-10-22T08:00:00Z',
      };

      const ranked = sortTeams([team]);
      expect(ranked[0].repositoryName).toBe('squard_1');
    });

    it('transparently reports ties with T-1 rank prefix when all 4 tie-breaker criteria match', () => {
      const { teamA, teamB } = createDevelopmentTestFixture();
      // Both teamA and teamB have totalScore=100, veryHardSolvedCount=1, veryHardScore=40, correctness=4.0
      const ranked = sortTeams([teamA as any, teamB as any]);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[0].isTied).toBe(true);
      expect(ranked[1].isTied).toBe(true);
      expect(ranked[1].rankText).toBe('T-1');
    });

    it('keeps a team visible on leaderboard even if some members have not submitted PRs yet', () => {
      const { teamA } = createDevelopmentTestFixture();
      // Student A4 has not submitted PR yet
      const ranked = sortTeams([teamA as any]);
      expect(ranked).toHaveLength(1);
      expect(ranked[0].submissionStatus).toBe('PARTIAL');
      expect(ranked[0].validSubmissionsCount).toBe(3);
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 6. SECURITY & AUTHORIZATION
  // ═════════════════════════════════════════════════════════════
  describe('6. Security & Authorization', () => {
    it('verifies webhook HMAC-SHA256 signatures with constant-time comparison and rejects forged requests', () => {
      const expectedDigest = 'sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const validSignature = 'sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const forgedSignature = 'sha256=bad1234567890bad1234567890bad1234567890bad1234567890bad1234567890';

      const constantTimeEqual = (a: string, b: string): boolean => {
        if (a.length !== b.length) return false;
        let mismatch = 0;
        for (let i = 0; i < a.length; i++) {
          mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return mismatch === 0;
      };

      expect(constantTimeEqual(expectedDigest, validSignature)).toBe(true);
      expect(constantTimeEqual(expectedDigest, forgedSignature)).toBe(false);
    });

    it('rejects configuration edits attempted by unauthorized non-administrators', async () => {
      await expect(
        eventConfigService.updateEventConfig(
          { eventName: 'Hacked Event' },
          'student_attacker',
          'Attempted unauthorized alteration'
        )
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('sanitizes untrusted execution environment by stripping server tokens and secrets', () => {
      const dirtyEnv = {
        PATH: '/usr/bin',
        VITE_FIREBASE_API_KEY: 'AIzaSyPrivateSecretKey123',
        GITHUB_WEBHOOK_SECRET: 'super-secret-token',
        ADMIN_TOKEN: 'bearer_token_xyz',
        NORMAL_VARIABLE: 'safe_value',
      };

      const cleanEnv = sandboxRunner.sanitizeEnvironment(dirtyEnv);
      expect(cleanEnv.PATH).toBe('/usr/bin');
      expect(cleanEnv.NORMAL_VARIABLE).toBe('safe_value');
      expect(cleanEnv.VITE_FIREBASE_API_KEY).toBeUndefined();
      expect(cleanEnv.GITHUB_WEBHOOK_SECRET).toBeUndefined();
      expect(cleanEnv.ADMIN_TOKEN).toBeUndefined();
    });
  });
});
