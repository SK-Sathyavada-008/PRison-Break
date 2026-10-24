import { test, expect, describe } from 'vitest';
import { extractLinkedIssue, extractAllLinkedIssues, validateChangedFiles } from '../prValidationPipeline';
import {
  isDifficultIssue,
  isDifficultBug,
  isDocumentationContribution,
  calculateApplicableRules,
  evaluateTeamIssueScoring,
} from '../scoringEngine';

describe('Scoring & Validation Regression Suite', () => {
  test('extractLinkedIssue extracts single linked issue from text', () => {
    expect(extractLinkedIssue('Fixes #42')).toBe(42);
    expect(extractLinkedIssue('Closes issue #105')).toBe(105);
    expect(extractLinkedIssue('Resolves #7')).toBe(7);
    expect(extractLinkedIssue('feat: some work #99')).toBe(99);
    expect(extractLinkedIssue('no issue here')).toBe(0);
  });

  test('difficulty label detection conforms to existing rules', () => {
    expect(isDifficultIssue(['difficulty:hard'])).toBe(true);
    expect(isDifficultIssue(['difficulty:medium'])).toBe(true);
    expect(isDifficultIssue(['points:20'])).toBe(true);
    expect(isDifficultIssue(['difficulty:easy'])).toBe(false);

    expect(isDifficultBug(['type:bug', 'difficulty:hard'])).toBe(true);
    expect(isDifficultBug(['points:25'])).toBe(true);
    expect(isDifficultBug(['type:bug', 'difficulty:easy'])).toBe(false);

    expect(isDocumentationContribution(['type:documentation'])).toBe(true);
    expect(isDocumentationContribution([], ['docs/README.md'])).toBe(true);
  });

  test('validateChangedFiles enforces bounds and system paths', () => {
    expect(validateChangedFiles(['src/App.tsx'], 100, 50).filesValid).toBe(true);
    expect(validateChangedFiles(['.github/workflows/ci.yml'], 10, 10).filesValid).toBe(false);
    expect(validateChangedFiles(['app.exe'], 10, 10).filesValid).toBe(false);
    expect(validateChangedFiles(['large.ts'], 6000, 10).filesValid).toBe(false);
  });

  test('calculateApplicableRules enforces issue-only scoring (PR bonuses disabled)', () => {
    const rules = calculateApplicableRules(
      {
        prNumber: 1,
        repositoryId: 'repo1',
        repositoryFullName: 'org/repo1',
        githubUsername: 'student1',
        title: 'Fix issue #10',
        testsPassed: true,
        merged: true,
        issueNumber: 10,
        issueLabels: ['difficulty:hard'],
      },
      false
    );

    // PRison Break Event Rules: XP is strictly for issues, PR bonuses disabled
    expect(rules).toEqual([]);
  });

  test('extractAllLinkedIssues extracts multiple issues from single student PR', () => {
    const issues1 = extractAllLinkedIssues('fixes #12, closes #14 and resolves #16');
    expect(issues1).toEqual([12, 14, 16]);

    const issues2 = extractAllLinkedIssues('feat: solve challenge https://github.com/org/repo/issues/101 and fixes #202');
    expect(issues2).toEqual([101, 202]);

    const issues3 = extractAllLinkedIssues('task #5, #7, #9');
    expect(issues3).toEqual([5, 7, 9]);

    const issuesEmpty = extractAllLinkedIssues('Just general refactoring without issue keyword');
    expect(issuesEmpty).toEqual([]);
  });

  test('evaluateTeamIssueScoring awards standard difficulty points and prevents duplication', () => {
    // Standard difficulties: Easy=10, Medium=20, Hard=30, Very Hard=50
    const evalResult = evaluateTeamIssueScoring({
      teamId: 'team_squard_1',
      repositoryId: 'squard_1',
      githubUsername: 'student_alice',
      prNumber: 42,
      solvedIssues: [
        { issueNumber: 1, difficulty: 'EASY' },
        { issueNumber: 2, difficulty: 'MEDIUM' },
        { issueNumber: 3, difficulty: 'HARD' },
        { issueNumber: 4, difficulty: 'VERY_HARD' },
      ],
      existingTeamSolvedIssueNumbers: [2], // Issue 2 already solved!
    });

    // Issue 2 must be ignored as duplicate
    expect(evalResult.duplicateIssuesIgnored).toEqual([2]);

    // Issues 1, 3, 4 should be awarded
    expect(evalResult.newIssuesToAward.map((i) => i.issueNumber)).toEqual([1, 3, 4]);

    // Points calculation: Easy(10) + Hard(30) + Very Hard(40) = 80
    expect(evalResult.totalPoints).toBe(80);
  });

  test('determineIssueDifficulty strictly validates trusted labels and rejects untrusted text', async () => {
    const { determineIssueDifficulty } = await import('../prValidationPipeline');
    expect(determineIssueDifficulty(1, ['difficulty:easy'])).toBe('EASY');
    expect(determineIssueDifficulty(2, ['difficulty:medium'])).toBe('MEDIUM');
    expect(determineIssueDifficulty(3, ['difficulty:hard'])).toBe('HARD');
    expect(determineIssueDifficulty(4, ['difficulty:very-hard'])).toBe('VERY_HARD');
    expect(determineIssueDifficulty(5, ['difficulty:very_hard'])).toBe('VERY_HARD');
    expect(determineIssueDifficulty(6, ['points:40'])).toBe('VERY_HARD');
    expect(determineIssueDifficulty(7, ['points:30'])).toBe('HARD');
    expect(determineIssueDifficulty(8, ['points:20'])).toBe('MEDIUM');
    expect(determineIssueDifficulty(9, ['points:10'])).toBe('EASY');

    // Invalid labels or PR title inflation attempts must default safely to EASY
    expect(determineIssueDifficulty(10, ['invalid:label', 'random'])).toBe('EASY');
    expect(determineIssueDifficulty(11, [], 'PR title says very hard 40 points')).toBe('EASY');
  });

  test('validateTeamForActivation enforces exactly four students and unique repository', async () => {
    const { teamService } = await import('../teamService');
    const existingActiveTeams = [
      {
        id: 'team_squad_1',
        name: 'Squad 1',
        repositoryId: 'squard_1',
        repositoryName: 'squard_1',
        members: [
          { studentId: 's1', name: 'Student 1', githubUsername: 'student1', assignedIssues: [1] },
          { studentId: 's2', name: 'Student 2', githubUsername: 'student2', assignedIssues: [2] },
          { studentId: 's3', name: 'Student 3', githubUsername: 'student3', assignedIssues: [3] },
          { studentId: 's4', name: 'Student 4', githubUsername: 'student4', assignedIssues: [4] },
        ],
        totalScore: 0,
        assignedIssueCount: 4,
        validatedIssueCount: 0,
        veryHardSolvedCount: 0,
        prsSubmitted: 0,
        solvedIssues: [],
        active: true,
        createdAt: '2026-10-22T00:00:00Z',
        updatedAt: '2026-10-22T00:00:00Z',
      },
    ];

    // 1. Valid team with exactly 4 students and unique repo
    const validTeam = {
      id: 'team_squad_2',
      name: 'Squad 2',
      repositoryId: 'squard_2',
      repositoryName: 'squard_2',
      members: [
        { studentId: 's5', name: 'Student 5', githubUsername: 'student5', assignedIssues: [1] },
        { studentId: 's6', name: 'Student 6', githubUsername: 'student6', assignedIssues: [2] },
        { studentId: 's7', name: 'Student 7', githubUsername: 'student7', assignedIssues: [3] },
        { studentId: 's8', name: 'Student 8', githubUsername: 'student8', assignedIssues: [4] },
      ],
    };
    const validRes = teamService.validateTeamForActivation(validTeam as any, existingActiveTeams as any);
    expect(validRes.valid).toBe(true);
    expect(validRes.errors).toHaveLength(0);

    // 2. Team with fewer than 4 students (3 students)
    const teamThree = {
      ...validTeam,
      members: validTeam.members.slice(0, 3),
    };
    const resThree = teamService.validateTeamForActivation(teamThree as any, existingActiveTeams as any);
    expect(resThree.valid).toBe(false);
    expect(resThree.errors[0]).toMatch(/must have exactly 4 registered members/i);

    // 3. Team with more than 4 students (5 students)
    const teamFive = {
      ...validTeam,
      members: [
        ...validTeam.members,
        { studentId: 's9', name: 'Student 9', githubUsername: 'student9', assignedIssues: [5] },
      ],
    };
    const resFive = teamService.validateTeamForActivation(teamFive as any, existingActiveTeams as any);
    expect(resFive.valid).toBe(false);
    expect(resFive.errors[0]).toMatch(/must have exactly 4 registered members/i);

    // 4. Duplicate student membership: student1 already active in Squad 1
    const duplicateStudentTeam = {
      ...validTeam,
      members: [
        { studentId: 's1', name: 'Student 1', githubUsername: 'student1', assignedIssues: [1] }, // duplicate!
        { studentId: 's6', name: 'Student 6', githubUsername: 'student6', assignedIssues: [2] },
        { studentId: 's7', name: 'Student 7', githubUsername: 'student7', assignedIssues: [3] },
        { studentId: 's8', name: 'Student 8', githubUsername: 'student8', assignedIssues: [4] },
      ],
    };
    const resDupStudent = teamService.validateTeamForActivation(duplicateStudentTeam as any, existingActiveTeams as any);
    expect(resDupStudent.valid).toBe(false);
    expect(resDupStudent.errors.some((e) => e.includes('@student1'))).toBe(true);

    // 5. Duplicate repository assignment: squard_1 already assigned to Squad 1
    const duplicateRepoTeam = {
      ...validTeam,
      repositoryId: 'squard_1',
    };
    const resDupRepo = teamService.validateTeamForActivation(duplicateRepoTeam as any, existingActiveTeams as any);
    expect(resDupRepo.valid).toBe(false);
    expect(resDupRepo.errors.some((e) => e.includes('already assigned'))).toBe(true);
  });

  test('issueService detects duplicate issue assignments and validates trusted difficulty', async () => {
    const { issueService } = await import('../issueService');

    // Trusted label parsing
    expect(issueService.parseDifficultyFromLabels(['difficulty:easy'])).toBe('EASY');
    expect(issueService.parseDifficultyFromLabels(['difficulty:medium'])).toBe('MEDIUM');
    expect(issueService.parseDifficultyFromLabels(['difficulty:hard'])).toBe('HARD');
    expect(issueService.parseDifficultyFromLabels(['difficulty:very-hard'])).toBe('VERY_HARD');
    expect(issueService.parseDifficultyFromLabels(['invalid:label'])).toBeNull();

    // Duplicate assignment detection
    const issuesList = [
      {
        id: 'i1',
        repositoryId: 'squard_1',
        issueNumber: 1,
        title: 'Task 1',
        difficulty: 'EASY' as const,
        basePoints: 10,
        assignedStudentUsername: 'alice',
        teamId: 'team1',
        url: 'https://github.com/PRison-Break-2026/squard_1/issues/1',
        active: true,
        gradingStatus: 'UNGRADED' as const,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'i2',
        repositoryId: 'squard_1',
        issueNumber: 1, // Duplicate issue #1 on same repository assigned to bob!
        title: 'Task 1 Duplicate',
        difficulty: 'EASY' as const,
        basePoints: 10,
        assignedStudentUsername: 'bob',
        teamId: 'team1',
        url: 'https://github.com/PRison-Break-2026/squard_1/issues/1',
        active: true,
        gradingStatus: 'UNGRADED' as const,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'i3',
        repositoryId: 'squard_1',
        issueNumber: 2,
        title: 'Task 2',
        difficulty: 'MEDIUM' as const,
        basePoints: 20,
        assignedStudentUsername: 'charlie',
        teamId: 'team1',
        url: 'https://github.com/PRison-Break-2026/squard_1/issues/2',
        active: true,
        gradingStatus: 'UNGRADED' as const,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const diag = issueService.validateIssueAssignments(issuesList);
    expect(diag.duplicates).toHaveLength(1);
    expect(diag.duplicates[0].issueNumber).toBe(1);
    expect(diag.duplicates[0].assignedStudents).toContain('alice');
    expect(diag.duplicates[0].assignedStudents).toContain('bob');
  });

  test('auditable participant replacement and repository reassignment integrity', async () => {
    const { teamService } = await import('../teamService');

    // Attempting replacement without documented reason must throw error
    await expect(
      teamService.replaceParticipantWithAudit('team_squard_1', 'rahul123', { name: 'New Student', githubUsername: 'newstudent' }, 'admin', '')
    ).rejects.toThrow(/documented justification reason is required/i);

    // Attempting repository reassignment without reason must throw error
    await expect(
      teamService.reassignRepositoryWithAudit('team_squard_1', { id: 'squard_99', name: 'squard_99' }, 'admin', '')
    ).rejects.toThrow(/documented justification is required/i);
  });

  test('existing records remain accessible and compliant after migration', async () => {
    const { teamService } = await import('../teamService');
    const teams = await teamService.getTeams();
    expect(teams.length).toBeGreaterThanOrEqual(4);

    for (const team of teams) {
      expect(team.id).toBeDefined();
      expect(team.repositoryName).toMatch(/^squard_\d+$/);
      expect(team.members).toHaveLength(4);
      expect(team.assignedIssueCount).toBeGreaterThanOrEqual(0);
      expect(team.totalScore).toBeGreaterThanOrEqual(0);
    }
  });
});

