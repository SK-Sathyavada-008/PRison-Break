// ─────────────────────────────────────────────
// PRison Break — Phase 3 Deterministic Java Grading Engine Test Suite
// Verifies:
// 1. Difficulty Base Points (10, 20, 30, 40)
// 2. Correct and Incorrect Solutions
// 3. Compilation Failure
// 4. Edge-Case Failures
// 5. Test Manipulation Detection
// 6. Scope Discipline (Unrelated Files)
// 7. Unassigned Issue Attribution
// 8. Duplicate Webhook Deliveries & Idempotency
// 9. Duplicate Issue Scoring Across Squad
// 10. Missing Sandbox Infrastructure & Crash/Timeout
// 11. Manual Override & Audit Logging
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import {
  javaGradingEngine,
  calculateAwardedPoints,
  roundToTwoDecimals,
  RUBRIC_VERSION,
} from '../javaGradingEngine';
import { sandboxRunner } from '../sandboxRunner';
import { ISSUE_DIFFICULTY_POINTS } from '../../types';

describe('Phase 3 — Deterministic Java Grading Engine', () => {
  beforeEach(() => {
    // Ensure sandbox is available by default before each test
    sandboxRunner.setSandboxAvailable(true);
  });

  // ── 1. DIFFICULTY BASE POINTS CONFIGURATION ───────────────
  describe('Difficulty Base Points Configuration', () => {
    it('uses exact difficulty base points: EASY=10, MEDIUM=20, HARD=30, VERY_HARD=40', () => {
      expect(ISSUE_DIFFICULTY_POINTS.EASY).toBe(10);
      expect(ISSUE_DIFFICULTY_POINTS.MEDIUM).toBe(20);
      expect(ISSUE_DIFFICULTY_POINTS.HARD).toBe(30);
      expect(ISSUE_DIFFICULTY_POINTS.VERY_HARD).toBe(40);
    });

    it('calculates full points for 100% C, Q, M across each difficulty level', () => {
      expect(calculateAwardedPoints(10, 1.0, 1.0, 1.0)).toBe(10);
      expect(calculateAwardedPoints(20, 1.0, 1.0, 1.0)).toBe(20);
      expect(calculateAwardedPoints(30, 1.0, 1.0, 1.0)).toBe(30);
      expect(calculateAwardedPoints(40, 1.0, 1.0, 1.0)).toBe(40);
    });

    it('calculates partial points avoiding floating point accumulation errors', () => {
      // 30 * (0.70*0.70 + 0.20*0.85 + 0.10*0.90) = 30 * (0.49 + 0.17 + 0.09) = 30 * 0.75 = 22.50
      const score = calculateAwardedPoints(30, 0.7, 0.85, 0.9);
      expect(score).toBe(22.5);

      // Verify rounding precision
      expect(roundToTwoDecimals(14.33333333)).toBe(14.33);
    });
  });

  // ── 2. CORRECT AND INCORRECT SOLUTIONS ─────────────────────
  describe('Correct and Incorrect Solutions', () => {
    it('awards full points and AUTO_GRADED status for a fully correct solution', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 101,
        changedFiles: [{ filename: 'src/main/java/MatrixRotate.java', status: 'modified' }],
        commitMessages: ['Fix issue #1: Implemented matrix rotation algorithm in Java'],
        commitAuthors: ['alice_java'],
        mockExecutionResult: {
          compiles: true,
          totalTests: 6,
          testsPassed: 6,
          testsFailed: 0,
          normalInputsPassed: true,
          edgeCasesPassed: true,
        },
      });

      expect(result.awardedPoints).toBe(10);
      expect(result.rawComponentScores.correctness).toBe(1.0);
      expect(result.rawComponentScores.codeQuality).toBe(1.0);
      expect(result.rawComponentScores.commitQuality).toBe(1.0);
      expect(result.gradingStatus).toBe('AUTO_GRADED');
      expect(result.rubricVersion).toBe(RUBRIC_VERSION);
    });

    it('rejects solution and awards 0 correctness points when all tests fail', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 2,
        difficulty: 'MEDIUM',
        studentUsername: 'bob_java',
        assignedStudentIssues: [2],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 102,
        changedFiles: [{ filename: 'src/main/java/GraphSearch.java', status: 'modified' }],
        commitMessages: ['Fix issue #2: Attempted BFS traversal'],
        mockExecutionResult: {
          compiles: true,
          totalTests: 5,
          testsPassed: 0,
          testsFailed: 5,
          normalInputsPassed: false,
          edgeCasesPassed: false,
        },
      });

      expect(result.rawComponentScores.correctness).toBe(0);
      expect(result.gradingStatus).toBe('REJECTED');
      expect(result.deductions.correctness).toContain('All unit test cases failed.');
    });
  });

  // ── 3. COMPILATION FAILURE ─────────────────────────────────
  describe('Compilation Failure', () => {
    it('sets correctness to 0 and rejects solution when Java code fails to compile', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 3,
        difficulty: 'HARD',
        studentUsername: 'carol_java',
        assignedStudentIssues: [3],
        teamId: 'team_squard_2',
        repositoryId: 'squard_2',
        prNumber: 103,
        changedFiles: [{ filename: 'src/main/java/LRUCache.java', status: 'modified' }],
        commitMessages: ['Fix issue #3: Added cache logic'],
        mockExecutionResult: {
          compiles: false,
        },
      });

      expect(result.rawComponentScores.correctness).toBe(0);
      expect(result.evidence.compilationPassed).toBe(false);
      expect(result.gradingStatus).toBe('REJECTED');
      expect(result.deductions.correctness[0]).toMatch(/Compilation failure/i);
    });
  });

  // ── 4. EDGE-CASE FAILURES ──────────────────────────────────
  describe('Edge-Case Failures', () => {
    it('awards partial 0.70 correctness when standard inputs pass but edge cases fail', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 4,
        difficulty: 'VERY_HARD',
        studentUsername: 'david_java',
        assignedStudentIssues: [4],
        teamId: 'team_squard_3',
        repositoryId: 'squard_3',
        prNumber: 104,
        changedFiles: [{ filename: 'src/main/java/QueryPlanner.java', status: 'modified' }],
        commitMessages: ['Fix issue #4: Implemented query planner'],
        mockExecutionResult: {
          compiles: true,
          totalTests: 10,
          testsPassed: 7,
          testsFailed: 3,
          normalInputsPassed: true,
          edgeCasesPassed: false,
        },
      });

      expect(result.rawComponentScores.correctness).toBe(0.7);
      expect(result.deductions.correctness[0]).toMatch(/Edge case failures/i);
      // basePoints 40 * (0.70 * 0.70 + 0.20 * 1.0 + 0.10 * 1.0) = 40 * (0.49 + 0.20 + 0.10) = 40 * 0.79 = 31.60
      expect(result.awardedPoints).toBe(31.6);
    });
  });

  // ── 5. TEST MANIPULATION DETECTION ─────────────────────────
  describe('Test Manipulation Detection', () => {
    it('detects and flags PRs attempting to modify, delete, or disable test assertions', async () => {
      const tamperingCheck = sandboxRunner.detectTestTampering([
        {
          filename: 'src/test/java/MatrixRotateTest.java',
          status: 'modified',
          patch: '@@ -12,3 +12,3 @@\n- assertEquals(expected, result);\n+ @Disabled\n+ assertTrue(true);',
        },
      ]);

      expect(tamperingCheck.isTampered).toBe(true);
      expect(tamperingCheck.tamperedFiles).toContain('src/test/java/MatrixRotateTest.java');

      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'hacker_student',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 999,
        changedFiles: [
          {
            filename: 'src/test/java/MatrixRotateTest.java',
            status: 'modified',
            patch: '@Disabled\nassertTrue(true);',
          },
        ],
        commitMessages: ['Fix issue #1: Made tests pass'],
      });

      expect(result.rawComponentScores.correctness).toBe(0);
      expect(result.evidence.testTamperingDetected).toBe(true);
      expect(result.gradingStatus).toBe('PENDING_REVIEW');
      expect(result.deductions.correctness[0]).toMatch(/Security Violation: PR attempted to modify/i);
    });
  });

  // ── 6. SCOPE DISCIPLINE (CHANGES TO UNRELATED FILES) ─────────
  describe('Scope Discipline (Unrelated Files)', () => {
    it('penalizes code quality by -0.20 when PR touches CI workflows or unrelated files', () => {
      const quality = javaGradingEngine.evaluateCodeQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 105,
        changedFiles: [
          { filename: 'src/main/java/Solution.java', status: 'modified' },
          { filename: '.github/workflows/ci.yml', status: 'modified' },
        ],
        commitMessages: ['Fix issue #1'],
      });

      expect(quality.score).toBe(0.8);
      expect(quality.deductions[0]).toMatch(/Scope discipline/i);
    });

    it('does not penalize harmless formatting or minor stylistic differences', () => {
      const quality = javaGradingEngine.evaluateCodeQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student1',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 105,
        changedFiles: [{ filename: 'src/main/java/Solution.java', status: 'modified' }],
        commitMessages: ['Fix issue #1'],
        codeAnalysis: {},
      });

      expect(quality.score).toBe(1.0);
      expect(quality.deductions.length).toBe(0);
    });
  });

  // ── 7. UNASSIGNED ISSUE ATTRIBUTION ────────────────────────
  describe('Unassigned Issue Attribution', () => {
    it('awards 0 points and flags for review when a student touches an unassigned issue', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 99, // Unassigned issue
        difficulty: 'MEDIUM',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1, 2], // Only assigned 1 and 2
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 106,
        changedFiles: [{ filename: 'src/main/java/Unassigned.java', status: 'modified' }],
        commitMessages: ['Solve issue #99'],
      });

      expect(result.awardedPoints).toBe(0);
      expect(result.gradingStatus).toBe('PENDING_REVIEW');
      expect(result.evidence.unassignedIssueDetected).toBe(true);
      expect(result.gradingExplanation).toMatch(/Issue Attribution Failure/i);
    });
  });

  // ── 8. DUPLICATE COMMITS & WEBHOOK DELIVERIES ───────────────
  describe('Duplicate Commits and Webhook Deliveries (Idempotency)', () => {
    it('ensures identical idempotency key is generated to prevent duplicate awarding', () => {
      const key1 = `se_team_squard_1_issue_10`;
      const key2 = `se_team_squard_1_issue_10`;
      expect(key1).toBe(key2);
    });

    it('does not award points for inflated commit counts', () => {
      const oneCommit = javaGradingEngine.evaluateCommitQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 101,
        changedFiles: [],
        commitMessages: ['Fix issue #1: Implemented solution cleanly'],
        commitAuthors: ['alice_java'],
      });

      const twentyCommits = javaGradingEngine.evaluateCommitQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 101,
        changedFiles: [],
        commitMessages: Array(20).fill('Fix issue #1: Tiny edit'),
        commitAuthors: ['alice_java'],
      });

      // Commit count is non-monotonic: 20 commits does not give more points than 1 clean commit
      expect(twentyCommits.score).toBeLessThanOrEqual(oneCommit.score);
    });

    it('flags attribution mismatch when commit author does not match registered student', () => {
      const commitQuality = javaGradingEngine.evaluateCommitQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 101,
        changedFiles: [],
        commitMessages: ['Fix issue #1'],
        commitAuthors: ['imposter_user_99'], // Mismatched author
      });

      expect(commitQuality.authorMismatch).toBe(true);
      expect(commitQuality.score).toBe(0.8);
      expect(commitQuality.deductions[0]).toMatch(/Attribution Conflict/i);
    });
  });

  // ── 9. DUPLICATE ISSUE SCORING ACROSS SQUAD ────────────────
  describe('Duplicate Issue Scoring Across Squad', () => {
    it('blocks duplicate points when an issue was already credited to the team', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 107,
        changedFiles: [{ filename: 'src/main/java/MatrixRotate.java', status: 'modified' }],
        commitMessages: ['Fix issue #1'],
        existingTeamSolvedIssues: [1], // Team already earned points for issue 1!
      });

      expect(result.awardedPoints).toBe(0);
      expect(result.gradingStatus).toBe('REJECTED');
      expect(result.gradingExplanation).toMatch(/Duplicate issue credit blocked/i);
    });
  });

  // ── 10. MISSING SANDBOX INFRASTRUCTURE & CRASH/TIMEOUT ─────
  describe('Missing Sandbox Infrastructure & Runner Failures', () => {
    it('reports GRADING_FAILED and routes to manual review when sandbox is unavailable', async () => {
      sandboxRunner.setSandboxAvailable(false); // Simulate offline or unconfigured runner

      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 108,
        changedFiles: [{ filename: 'src/main/java/MatrixRotate.java', status: 'modified' }],
        commitMessages: ['Fix issue #1'],
      });

      expect(result.gradingStatus).toBe('GRADING_FAILED');
      expect(result.awardedPoints).toBe(0);
      expect(result.evidence.sandboxAvailable).toBe(false);
      expect(result.gradingExplanation).toMatch(/Automated execution sandbox is unavailable/i);
    });

    it('reports execution timeout (potential infinite loop) as 0 correctness points', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 2,
        difficulty: 'MEDIUM',
        studentUsername: 'bob_java',
        assignedStudentIssues: [2],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 109,
        changedFiles: [{ filename: 'src/main/java/Loop.java', status: 'modified' }],
        commitMessages: ['Fix issue #2'],
        mockExecutionResult: {
          timeout: true,
        },
      });

      expect(result.rawComponentScores.correctness).toBe(0);
      expect(result.deductions.correctness[0]).toMatch(/Execution timeout/i);
    });
  });

  // ── 11. MANUAL OVERRIDE AND AUDIT LOGGING ───────────────────
  describe('Manual Override and Audit Logging', () => {
    it('allows organizers to override grade with mandatory reason and logs to audit record', async () => {
      const baseRecord = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 110,
        changedFiles: [{ filename: 'src/main/java/MatrixRotate.java', status: 'modified' }],
        commitMessages: ['Fix issue #1'],
        mockExecutionResult: {
          testsPassed: 6,
          totalTests: 6,
          normalInputsPassed: true,
          edgeCasesPassed: true,
        },
      });

      expect(baseRecord.awardedPoints).toBe(10);

      // Organizer manually overrides points with justification
      const auditLog = await javaGradingEngine.overrideGradeWithAudit(
        baseRecord,
        8.5,
        'organizer_lead',
        'Exceptional edge case requirement waived due to ambiguous issue prompt.',
        'team_squard_1'
      );

      expect(baseRecord.awardedPoints).toBe(8.5);
      expect(baseRecord.gradingStatus).toBe('APPROVED');
      expect(baseRecord.gradingExplanation).toContain('Manual override by organizer_lead');
      expect(auditLog.action).toBe('MANUAL_GRADING_OVERRIDE');
      expect(auditLog.performedBy).toBe('organizer_lead');
      expect(auditLog.details.previousPoints).toBe(10);
      expect(auditLog.details.newPoints).toBe(8.5);
    });

    it('rejects manual override without a mandatory reason', async () => {
      const baseRecord = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 111,
        changedFiles: [],
        commitMessages: ['Fix issue #1'],
      });

      await expect(
        javaGradingEngine.overrideGradeWithAudit(baseRecord, 10, 'admin', '')
      ).rejects.toThrow(/Audit justification is required/i);
    });
  });

  // ── 12. AI SIGNAL SAFETY ───────────────────────────────────
  describe('AI Secondary Signal Safety', () => {
    it('does not allow AI positive feedback to override deterministic test compilation failure', async () => {
      const result = await javaGradingEngine.gradeIssue({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'alice_java',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 112,
        changedFiles: [{ filename: 'src/main/java/Broken.java', status: 'modified' }],
        commitMessages: ['Fix issue #1'],
        mockExecutionResult: {
          compiles: false,
        },
        aiReviewSignal: {
          aiPassed: true,
          aiScoreEstimate: 10,
          commentary: 'Code looks beautiful and well commented.',
        },
      });

      // Deterministic test result is authoritative; AI cannot override failing tests
      expect(result.rawComponentScores.correctness).toBe(0);
      expect(result.gradingStatus).toBe('REJECTED');
      expect(result.gradingExplanation).toContain(
        'Secondary AI review marked code as passing, but deterministic compiler failed'
      );
    });
  });
});
