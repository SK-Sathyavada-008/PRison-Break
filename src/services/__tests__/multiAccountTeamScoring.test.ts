import { describe, it, expect } from 'vitest';
import { evaluateTeamIssueScoring } from '../scoringEngine';
import { sortTeams } from '../teamService';
import type { FirestoreTeam } from '../../types';

describe('Multi-Account Same-Repository Team Scoring', () => {
  it('identifies both accounts as teammates in the same team and aggregates their scores', () => {
    // Teammate 1 (Account 1: radheradhe-008) solves issue #1 (Easy, 10pts) and #57 (Very Hard, 40pts)
    const evalMember1 = evaluateTeamIssueScoring({
      repositoryId: 'veeresh4520/Squade_1_test',
      githubUsername: 'radheradhe-008',
      prNumber: 1,
      solvedIssues: [
        { issueNumber: 1, difficulty: 'EASY', basePoints: 10, correctnessScore: 1, codeQualityScore: 1, commitQualityScore: 1 },
        { issueNumber: 57, difficulty: 'VERY_HARD', basePoints: 40, correctnessScore: 1, codeQualityScore: 1, commitQualityScore: 1 },
      ],
      existingTeamSolvedIssueNumbers: [],
    });

    expect(evalMember1.totalPoints).toBe(50);
    expect(evalMember1.newIssuesToAward).toHaveLength(2);

    const teamSolvedIssues = evalMember1.newIssuesToAward.map((i) => ({
      issueNumber: i.issueNumber,
      difficulty: i.difficulty,
      points: i.points,
      solvedByUsername: 'radheradhe-008',
      prNumber: 1,
      solvedAt: new Date().toISOString(),
    }));

    // Teammate 2 (Account 2: SK-Sathyavada-008) solves issue #2 (Easy, 10pts) in the same repo
    const evalMember2 = evaluateTeamIssueScoring({
      repositoryId: 'veeresh4520/Squade_1_test',
      githubUsername: 'SK-Sathyavada-008',
      prNumber: 3,
      solvedIssues: [
        { issueNumber: 2, difficulty: 'EASY', basePoints: 10, correctnessScore: 1, codeQualityScore: 1, commitQualityScore: 1 },
      ],
      existingTeamSolvedIssueNumbers: teamSolvedIssues.map((s) => s.issueNumber),
    });

    expect(evalMember2.totalPoints).toBe(10);
    expect(evalMember2.newIssuesToAward).toHaveLength(1);

    teamSolvedIssues.push(...evalMember2.newIssuesToAward.map((i) => ({
      issueNumber: i.issueNumber,
      difficulty: i.difficulty,
      points: i.points,
      solvedByUsername: 'SK-Sathyavada-008',
      prNumber: 3,
      solvedAt: new Date().toISOString(),
    })));

    // Both members assembled into team
    const team: FirestoreTeam = {
      id: 'team_squade_1_test',
      name: 'Squade_1_test',
      repositoryId: 'repo_1792774425262_9afv',
      repositoryName: 'Squade_1_test',
      repositoryFullName: 'veeresh4520/Squade_1_test',
      members: [
        {
          studentId: 's_radheradhe-008',
          name: 'radheradhe-008',
          githubUsername: 'radheradhe-008',
          assignedIssues: [1, 57],
          prSubmitted: true,
          prNumber: 1,
          score: evalMember1.totalPoints,
        },
        {
          studentId: 's_sk-sathyavada-008',
          name: 'SK-Sathyavada-008',
          githubUsername: 'SK-Sathyavada-008',
          assignedIssues: [2],
          prSubmitted: true,
          prNumber: 3,
          score: evalMember2.totalPoints,
        },
      ],
      earnedXP: evalMember1.totalPoints + evalMember2.totalPoints,
      bonusXP: 0,
      totalXP: evalMember1.totalPoints + evalMember2.totalPoints,
      totalScore: evalMember1.totalPoints + evalMember2.totalPoints,
      solvedIssues: teamSolvedIssues,
      validatedIssueCount: teamSolvedIssues.length,
      correctlySolvedIssuesCount: teamSolvedIssues.length,
      assignedIssueCount: 4,
      veryHardSolvedCount: 1,
      prsSubmitted: 2,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Assertions
    expect(team.members).toHaveLength(2);
    expect(team.members[0].githubUsername).toBe('radheradhe-008');
    expect(team.members[0].score).toBe(50);
    expect(team.members[1].githubUsername).toBe('SK-Sathyavada-008');
    expect(team.members[1].score).toBe(10);
    expect(team.totalScore).toBe(60);
    expect(team.prsSubmitted).toBe(2);

    // Leaderboard sorting and ranking
    const sorted = sortTeams([team as any]);
    expect(sorted[0].totalXP).toBe(60);
    expect(sorted[0].members).toHaveLength(2);
    expect(sorted[0].validSubmissionsCount).toBe(2);
  });

  it('prevents teammate 2 from scoring an issue already solved by teammate 1', () => {
    // Teammate 1 solves issue #1
    const eval1 = evaluateTeamIssueScoring({
      repositoryId: 'veeresh4520/Squade_1_test',
      githubUsername: 'radheradhe-008',
      prNumber: 1,
      solvedIssues: [
        { issueNumber: 1, difficulty: 'EASY', basePoints: 10 },
      ],
      existingTeamSolvedIssueNumbers: [],
    });
    expect(eval1.totalPoints).toBe(10);

    // Teammate 2 tries to submit PR solving the SAME issue #1
    const eval2 = evaluateTeamIssueScoring({
      repositoryId: 'veeresh4520/Squade_1_test',
      githubUsername: 'SK-Sathyavada-008',
      prNumber: 3,
      solvedIssues: [
        { issueNumber: 1, difficulty: 'EASY', basePoints: 10 },
      ],
      existingTeamSolvedIssueNumbers: [1],
    });

    // Deduplication prevents double scoring across teammates
    expect(eval2.totalPoints).toBe(0);
    expect(eval2.newIssuesToAward).toHaveLength(0);
    expect(eval2.duplicateIssuesIgnored).toEqual([1]);
  });
});
