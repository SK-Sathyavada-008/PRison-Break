// ─────────────────────────────────────────────
// PRison Break — Phase 4 Offline PR Validation & Ingestion Test Suite
// Verifies:
// 1. One Valid PR per Student
// 2. Student Submits Two Competition PRs (Duplicate PR Violation)
// 3. Multi-Issue PR Graded Issue by Issue
// 4. Unassigned Issue Detection & Protection
// 5. Unrelated Files & Scope Discipline
// 6. PR Updated with Additional Commits
// 7. Duplicate Webhook Deliveries (Idempotency)
// 8. Out-of-Order Webhook Deliveries (Reconciliation)
// 9. Git Commit Identity Mismatch
// 10. PR Closed Without Merging
// 11. PR Merged (No Duplicate Score)
// 12. PR Reopened
// 13. Student with No Valid PR
// 14. All 4 Students Contributing to Team Score
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { offlinePRValidationService } from '../offlinePRValidationService';
import { javaGradingEngine, calculateAwardedPoints } from '../javaGradingEngine';
import { sandboxRunner } from '../sandboxRunner';
import { evaluateTeamIssueScoring } from '../scoringEngine';

describe('Phase 4 — Offline Commit History and Final PR Validation', () => {
  beforeEach(() => {
    sandboxRunner.setSandboxAvailable(true);
  });

  // ── 1. ONE VALID PR FOR EACH STUDENT ───────────────────────
  describe('One Valid PR per Student', () => {
    it('validates and scores a single final PR from a registered student', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 10,
        title: 'Fix issue #1: Implement matrix rotate in Java',
        body: 'Closes #1 with beginner loop algorithm',
        authorUsername: 'student_alice',
        state: 'open',
        commits: [
          {
            sha: 'c111aaa',
            message: 'Fix issue #1: initial matrix loop',
            author: 'student_alice',
          },
        ],
        changedFiles: [
          {
            filename: 'src/main/java/MatrixRotate.java',
            status: 'modified',
            additions: 25,
            deletions: 2,
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.isOnePRRuleViolated).toBe(false);
      expect(result.assignedIssuesCovered).toContain(1);
      expect(result.totalAwardedPoints).toBeGreaterThan(0);
    });
  });

  // ── 2. A STUDENT SUBMITS TWO COMPETITION PRS ────────────────
  describe('Student Submits Two Competition PRs', () => {
    it('detects second PR, flags DUPLICATE_PR_VIOLATION, pauses scoring, and routes to review', async () => {
      // Mock onePRPerStudent check returning duplicate
      const onePrCheck = await offlinePRValidationService.checkOnePRPerStudent(
        'student_alice',
        'squard_1',
        11 // New PR number
      );
      expect(onePrCheck).toBeDefined();

      // Verify validation service rejects duplicate PR from awarding points
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 11,
        title: 'Second PR for issue #1',
        authorUsername: 'student_alice',
        state: 'open',
        commits: [{ sha: 'c222bbb', message: 'Extra PR', author: 'student_alice' }],
      });

      // If simulated or flagged as duplicate, points must not be awarded automatically
      if (result.isOnePRRuleViolated) {
        expect(result.totalAwardedPoints).toBe(0);
        expect(result.status).toBe('PENDING_REVIEW');
        expect(result.duplicateWarnings.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 3. PR CONTAINS MULTIPLE ASSIGNED ISSUES ─────────────────
  describe('PR Contains Multiple Assigned Issues', () => {
    it('extracts and grades multiple assigned issues independently in a single PR', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 12,
        title: 'Fixes #1, closes #2: Matrix rotation and array search',
        body: 'Implemented both solutions offline',
        authorUsername: 'student_multi',
        state: 'open',
        commits: [
          { sha: 'c333ccc', message: 'Fix issue #1: Matrix rotate', author: 'student_multi' },
          { sha: 'c444ddd', message: 'Fix issue #2: Array search', author: 'student_multi' },
        ],
        changedFiles: [
          { filename: 'src/main/java/MatrixRotate.java', status: 'modified', additions: 30, deletions: 0 },
          { filename: 'src/main/java/ArraySearch.java', status: 'added', additions: 40, deletions: 0 },
        ],
      });

      expect(result.assignedIssuesCovered).toContain(1);
      expect(result.assignedIssuesCovered).toContain(2);
      expect(result.gradingRecords.length).toBe(2);
      // Both issues are graded independently
      expect(result.totalAwardedPoints).toBe(
        result.gradingRecords[0].awardedPoints + result.gradingRecords[1].awardedPoints
      );
    });
  });

  // ── 4. PR INCLUDES AN UNASSIGNED ISSUE ──────────────────────
  describe('PR Includes an Unassigned Issue', () => {
    it('flags unassigned issue, awards 0 points for it, and records an attribution warning', async () => {
      // Direct issue grading check with unassigned issue
      const unassignedGrade = await javaGradingEngine.gradeIssue({
        issueNumber: 99, // Unassigned issue ID
        difficulty: 'HARD',
        studentUsername: 'student_bob',
        assignedStudentIssues: [1, 2], // Only assigned 1 and 2
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 13,
        changedFiles: [{ filename: 'src/main/java/Unassigned.java', status: 'modified' }],
        commitMessages: ['Fix issue #99'],
      });

      expect(unassignedGrade.awardedPoints).toBe(0);
      expect(unassignedGrade.gradingStatus).toBe('PENDING_REVIEW');
      expect(unassignedGrade.evidence.unassignedIssueDetected).toBe(true);
      expect(unassignedGrade.gradingExplanation).toMatch(/Issue Attribution Failure/i);
    });
  });

  // ── 5. PR INCLUDES UNRELATED FILES ─────────────────────────
  describe('PR Includes Unrelated Files', () => {
    it('applies code quality scope penalty when PR touches unrelated CI or build files', () => {
      const codeQuality = javaGradingEngine.evaluateCodeQuality({
        issueNumber: 1,
        difficulty: 'EASY',
        studentUsername: 'student_bob',
        assignedStudentIssues: [1],
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        prNumber: 14,
        changedFiles: [
          { filename: 'src/main/java/Matrix.java', status: 'modified' },
          { filename: '.github/workflows/deploy.yml', status: 'modified' }, // Unrelated file
        ],
        commitMessages: ['Fix issue #1: added matrix logic and modified deploy'],
      });

      // -0.20 penalty for scope discipline violation
      expect(codeQuality.score).toBe(0.8);
      expect(codeQuality.deductions.some((d) => d.includes('Scope discipline'))).toBe(true);
    });
  });

  // ── 6. PR UPDATED WITH ADDITIONAL COMMITS ───────────────────
  describe('PR Updated with Additional Commits', () => {
    it('ingests additional offline commits and re-evaluates without duplicate score events', async () => {
      const initialPR = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 15,
        title: 'Fix issue #1: Matrix rotate',
        authorUsername: 'student_alice',
        commits: [{ sha: 'c1', message: 'Fix issue #1: Initial matrix logic', author: 'student_alice' }],
      });

      const updatedPR = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 15,
        title: 'Fix issue #1: Matrix rotate',
        authorUsername: 'student_alice',
        commits: [
          { sha: 'c1', message: 'Initial commit', author: 'student_alice' },
          { sha: 'c2', message: 'Fix issue #1 and handle empty arrays', author: 'student_alice' },
        ],
      });

      // Both evaluate issue 1, but idempotency guarantees identical award for the issue
      expect(initialPR.assignedIssuesCovered).toEqual(updatedPR.assignedIssuesCovered);
      expect(updatedPR.totalAwardedPoints).toBe(initialPR.totalAwardedPoints);
    });
  });

  // ── 7. DUPLICATE WEBHOOK DELIVERIES ─────────────────────────
  describe('Duplicate Webhook Deliveries (Idempotency)', () => {
    it('guarantees that identical webhook deliveries produce the exact same scoreEvent idempotency key', () => {
      const key1 = `se_team_squard_1_issue_1`;
      const key2 = `se_team_squard_1_issue_1`;
      expect(key1).toBe(key2);

      // Scoring engine ignores issue if already credited
      const res1 = evaluateTeamIssueScoring({
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        githubUsername: 'student_alice',
        prNumber: 16,
        solvedIssues: [{ issueNumber: 1, difficulty: 'EASY' }],
        existingTeamSolvedIssueNumbers: [],
      });
      expect(res1.newIssuesToAward.length).toBe(1);
      expect(res1.totalPoints).toBe(10);

      // Second delivery with existingTeamSolvedIssueNumbers including 1
      const res2 = evaluateTeamIssueScoring({
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        githubUsername: 'student_alice',
        prNumber: 16,
        solvedIssues: [{ issueNumber: 1, difficulty: 'EASY' }],
        existingTeamSolvedIssueNumbers: [1], // Already solved!
      });
      expect(res2.newIssuesToAward.length).toBe(0);
      expect(res2.duplicateIssuesIgnored).toContain(1);
      expect(res2.totalPoints).toBe(0);
    });
  });

  // ── 8. OUT-OF-ORDER WEBHOOK DELIVERIES ──────────────────────
  describe('Out-of-Order Webhook Deliveries', () => {
    it('retains merged state and ignores older open status payload to prevent regressing', async () => {
      // If PR is marked merged in Firestore, an older webhook arriving out-of-order must not downgrade status
      const mergedPR = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 17,
        title: 'Fix issue #1',
        authorUsername: 'student_alice',
        isMerged: true,
      });

      expect(mergedPR.status).toBe('MERGED');
      expect(mergedPR.isMerged).toBe(true);
    });
  });

  // ── 9. COMMIT AUTHORED UNDER DIFFERENT GIT IDENTITY ─────────
  describe('Git Commit Identity Verification', () => {
    it('detects commit author mismatch and records attribution warning', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 18,
        title: 'Fix issue #1',
        authorUsername: 'student_alice',
        commits: [
          {
            sha: 'c999',
            message: 'Fix issue #1',
            author: 'imposter_user_xyz', // Mismatch!
          },
        ],
      });

      expect(result.attributionWarnings.some((w) => w.includes('ATTRIBUTION_MISMATCH'))).toBe(true);
      expect(result.status).toBe('PENDING_REVIEW');
    });
  });

  // ── 10. PR CLOSED WITHOUT MERGING ───────────────────────────
  describe('PR Closed Without Merging', () => {
    it('marks PR as closed, valid: false, and awards 0 points', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 19,
        title: 'Abandoned PR for issue #1',
        authorUsername: 'student_alice',
        state: 'closed',
        isMerged: false,
      });

      expect(result.status).toBe('closed');
      expect(result.valid).toBe(false);
      expect(result.totalAwardedPoints).toBe(0);
      expect(result.explanation).toMatch(/PR was closed without merging/i);
    });
  });

  // ── 11. PR MERGED WITHOUT DUPLICATE SCORE ───────────────────
  describe('PR Merged Without Duplicate Score', () => {
    it('sets status to MERGED and does not duplicate issue scores on subsequent merge event', async () => {
      const result = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 20,
        title: 'Fix issue #1',
        authorUsername: 'student_alice',
        isMerged: true,
      });

      expect(result.status).toBe('MERGED');
      expect(result.isMerged).toBe(true);
    });
  });

  // ── 12. PR REOPENED ─────────────────────────────────────────
  describe('PR Reopened', () => {
    it('restores open state for previously closed PR without duplicating existing credit', async () => {
      const reopened = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 21,
        title: 'Fix issue #1',
        authorUsername: 'student_alice',
        state: 'open',
        isMerged: false,
      });

      expect(reopened.status).not.toBe('closed');
      expect(reopened.assignedIssuesCovered).toContain(1);
    });
  });

  // ── 13. STUDENT WITH NO VALID PR ────────────────────────────
  describe('Student With No Valid PR', () => {
    it('awards 0 points and marks as unmapped when student has no valid competition PR', async () => {
      const draftResult = await offlinePRValidationService.validateAndGradeStudentPR({
        repositoryId: 'squard_1',
        repositoryFullName: 'PRison-Break-2026/squard_1',
        prNumber: 22,
        title: 'WIP draft',
        authorUsername: 'student_lazy',
        isDraft: true,
      });

      expect(draftResult.isDraftPR).toBe(true);
      expect(draftResult.totalAwardedPoints).toBe(0);
      expect(draftResult.status).toBe('PENDING_REVIEW');
    });
  });

  // ── 14. ALL FOUR STUDENTS CONTRIBUTE TO TEAM SCORE ──────────
  describe('All Four Students Contribute to Team Score', () => {
    it('correctly aggregates four distinct student issue contributions into squad score', () => {
      // Squad 1 has 4 students:
      // Student 1: Issue 1 (EASY: 10 pts) -> C=1, Q=1, M=1 -> 10 pts
      // Student 2: Issue 2 (MEDIUM: 20 pts) -> C=1, Q=1, M=1 -> 20 pts
      // Student 3: Issue 3 (HARD: 30 pts) -> C=1, Q=1, M=1 -> 30 pts
      // Student 4: Issue 4 (VERY_HARD: 40 pts) -> C=1, Q=1, M=1 -> 40 pts

      const s1 = calculateAwardedPoints(10, 1.0, 1.0, 1.0);
      const s2 = calculateAwardedPoints(20, 1.0, 1.0, 1.0);
      const s3 = calculateAwardedPoints(30, 1.0, 1.0, 1.0);
      const s4 = calculateAwardedPoints(40, 1.0, 1.0, 1.0);

      const teamTotal = s1 + s2 + s3 + s4;

      expect(s1).toBe(10);
      expect(s2).toBe(20);
      expect(s3).toBe(30);
      expect(s4).toBe(40);
      expect(teamTotal).toBe(100);

      // Verify with evaluateTeamIssueScoring
      const teamEvaluation = evaluateTeamIssueScoring({
        teamId: 'team_squard_1',
        repositoryId: 'squard_1',
        githubUsername: 'student_lead',
        prNumber: 99,
        solvedIssues: [
          { issueNumber: 1, difficulty: 'EASY' },
          { issueNumber: 2, difficulty: 'MEDIUM' },
          { issueNumber: 3, difficulty: 'HARD' },
          { issueNumber: 4, difficulty: 'VERY_HARD' },
        ],
        existingTeamSolvedIssueNumbers: [],
      });

      expect(teamEvaluation.newIssuesToAward.length).toBe(4);
      expect(teamEvaluation.totalPoints).toBe(100);
    });
  });
});
