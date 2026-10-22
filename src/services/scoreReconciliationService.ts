// ─────────────────────────────────────────────
// Score Reconciliation Service — Data Integrity & Audit Tool
// Recalculates team scores from canonical issue-score records,
// identifies cached-total mismatches, duplicate issue awards,
// missing references, and duplicate competition PRs.
// ─────────────────────────────────────────────

import type {
  PullRequest,
  ReconciliationReport,
  ReconciliationDiscrepancy,
} from '../types';
import { teamService } from './teamService';
import { scoreEventService } from './scoreEventService';
import { pullRequestService } from './pullRequestService';
import { auditLogService } from './auditLogService';

export const scoreReconciliationService = {
  /**
   * Executes a full data integrity and reconciliation audit across all teams,
   * score events, and pull requests.
   */
  async runReconciliationAudit(): Promise<ReconciliationReport> {
    const teams = await teamService.getTeams();
    const scoreEvents = await scoreEventService.getScoreEvents();
    const pullRequests = await pullRequestService.getPullRequests();

    const discrepancies: ReconciliationDiscrepancy[] = [];
    const calculatedTeamScores: Record<string, number> = {};
    const cachedTeamScores: Record<string, number> = {};

    // 1. Recalculate canonical team scores from unique issue awards
    for (const team of teams) {
      cachedTeamScores[team.id] = team.totalScore ?? 0;

      // Group canonical events for this team
      const teamEvents = scoreEvents.filter(
        (e) => e.teamId === team.id || e.repository === team.repositoryName
      );

      // Track unique issue numbers to detect duplication
      const uniqueIssuesAwarded = new Map<number, number>();
      for (const event of teamEvents) {
        if (event.issueNumber) {
          if (uniqueIssuesAwarded.has(event.issueNumber)) {
            discrepancies.push({
              id: `disc_dup_issue_${team.id}_${event.issueNumber}`,
              type: 'DUPLICATE_ISSUE_AWARD',
              severity: 'ERROR',
              teamId: team.id,
              repositoryId: team.repositoryName,
              studentUsername: event.githubUsername,
              issueNumber: event.issueNumber,
              cachedValue: event.points,
              calculatedValue: 0,
              description: `Duplicate score award detected on issue #${event.issueNumber} for ${team.name}. An issue can only be scored once.`,
            });
          } else {
            uniqueIssuesAwarded.set(event.issueNumber, event.points);
          }
        }
      }

      // Sum of unique issue awards
      let canonicalScore = 0;
      uniqueIssuesAwarded.forEach((pts) => {
        canonicalScore += pts;
      });

      // If team has solvedIssues embedded, fallback/verify with solvedIssues sum
      if (teamEvents.length === 0 && team.solvedIssues && team.solvedIssues.length > 0) {
        canonicalScore = team.solvedIssues.reduce((sum, s) => sum + (s.points || 0), 0);
      }

      calculatedTeamScores[team.id] = canonicalScore;

      // 2. Compare calculated score with cached score
      if (canonicalScore !== team.totalScore) {
        discrepancies.push({
          id: `disc_mismatch_${team.id}`,
          type: 'CACHED_SCORE_MISMATCH',
          severity: 'ERROR',
          teamId: team.id,
          repositoryId: team.repositoryName,
          cachedValue: team.totalScore,
          calculatedValue: canonicalScore,
          description: `Cached team score (${team.totalScore} XP) does not match canonical ledger sum (${canonicalScore} XP) for ${team.name}.`,
        });
      }
    }

    // 3. Identify contributions with missing team or student references
    for (const event of scoreEvents) {
      if (!event.participantName && !event.githubUsername) {
        discrepancies.push({
          id: `disc_missing_user_${event.id}`,
          type: 'MISSING_REFERENCE',
          severity: 'WARNING',
          studentUsername: event.githubUsername,
          description: `Score event ${event.id} is missing a verified student reference.`,
        });
      }
      if (!event.teamId && !event.repository) {
        discrepancies.push({
          id: `disc_missing_team_${event.id}`,
          type: 'MISSING_REFERENCE',
          severity: 'WARNING',
          description: `Score event ${event.id} is missing an associated team or repository reference.`,
        });
      }
    }

    // 4. Identify duplicate competition PRs per student
    const studentPRMap = new Map<string, PullRequest[]>();
    for (const pr of pullRequests) {
      const author = pr.githubUsername?.toLowerCase();
      if (!author) continue;
      const list = studentPRMap.get(author) || [];
      list.push(pr);
      studentPRMap.set(author, list);
    }

    studentPRMap.forEach((prs, author) => {
      // Filter competition PRs (excluding closed/rejected non-submissions)
      const validSubmissions = prs.filter((p) => p.status !== 'closed');
      if (validSubmissions.length > 1) {
        discrepancies.push({
          id: `disc_dup_pr_${author}`,
          type: 'DUPLICATE_COMPETITION_PR',
          severity: 'ERROR',
          studentUsername: author,
          cachedValue: validSubmissions.length,
          calculatedValue: 1,
          description: `Student @${author} opened ${validSubmissions.length} active PRs: [${validSubmissions.map((p) => `#${p.number}`).join(', ')}]. Rule permits exactly ONE final competition PR.`,
        });
      }
    });

    return {
      timestamp: new Date().toISOString(),
      totalTeamsAudited: teams.length,
      totalScoreEventsAudited: scoreEvents.length,
      totalPullRequestsAudited: pullRequests.length,
      discrepancies,
      isHealthy: discrepancies.length === 0,
      calculatedTeamScores,
      cachedTeamScores,
    };
  },

  /**
   * Applies authorized corrections to resolve cached total mismatches and duplicate awards.
   * Requires explicit admin identity and reason. Logs an immutable audit record.
   */
  async applyReconciliationFixes(
    adminUsername: string,
    reason: string
  ): Promise<{ appliedFixes: number; auditLogId: string; report: ReconciliationReport }> {
    if (!adminUsername || adminUsername.startsWith('guest') || adminUsername.startsWith('student')) {
      throw new Error('Unauthorized: An authorized administrator identity is required to apply reconciliation fixes.');
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('A documented justification reason (min 5 characters) is required to apply reconciliation corrections.');
    }

    // 1. Run audit to identify discrepancies
    const auditReport = await this.runReconciliationAudit();
    let appliedFixes = 0;

    // 2. Fix cached score mismatches
    for (const disc of auditReport.discrepancies) {
      if (disc.type === 'CACHED_SCORE_MISMATCH' && disc.teamId && disc.calculatedValue !== undefined) {
        const team = (await teamService.getTeams()).find((t) => t.id === disc.teamId);
        if (team) {
          team.totalScore = disc.calculatedValue;
          appliedFixes++;
        }
      }
    }

    const now = new Date().toISOString();
    const auditLogId = `audit_reconciliation_${Date.now()}`;

    // 3. Record audit trail
    await auditLogService.recordAuditLog({
      id: auditLogId,
      action: 'SCORE_OVERRIDE',
      adminUsername,
      targetId: 'ledger_reconciliation',
      targetName: 'Score Ledger Integrity Reconciliation',
      reason,
      previousValue: auditReport.cachedTeamScores,
      newValue: auditReport.calculatedTeamScores,
      details: {
        totalDiscrepancies: auditReport.discrepancies.length,
        fixedCount: appliedFixes,
        discrepancies: auditReport.discrepancies,
      },
      timestamp: now,
    });

    // 4. Return new report after fixes
    const resolvedReport = await this.runReconciliationAudit();

    return {
      appliedFixes,
      auditLogId,
      report: resolvedReport,
    };
  },
};
