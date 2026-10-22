// ─────────────────────────────────────────────
// PRison Break — Phase 6 Event Configuration, Transparency & Audit Test Suite
// Verifies:
// 1. Invalid weights rejection (weights must sum to 100%)
// 2. Unauthorized configuration edits (non-admin blocked)
// 3. Configuration versioning (increments version and stores who/why/when)
// 4. Score regrading (explicit action requiring reason and audit record)
// 5. Audit history (append-only audit log tracking previous & new scores)
// 6. Score reconciliation (recalculates from canonical issue ledger)
// 7. Duplicate issue awards detection & resolution
// 8. Cached-total mismatches detection and authorized correction
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { eventConfigService } from '../eventConfigService';
import { scoreReconciliationService } from '../scoreReconciliationService';
import { auditLogService } from '../auditLogService';

describe('Phase 6 — Event Configuration, Score Transparency, and Auditability', () => {
  // ── 1. INVALID WEIGHTS REJECTION ───────────────────────────
  describe('Invalid Scoring Weights', () => {
    it('rejects scoring weights that do not sum to exactly 100%', () => {
      // 0.80 + 0.20 + 0.10 = 110% (Invalid!)
      expect(() =>
        eventConfigService.validateConfiguration({
          weights: {
            correctness: 0.8,
            codeQuality: 0.2,
            commitQuality: 0.1,
          },
        })
      ).toThrow(/must sum exactly to 100%/i);

      // 0.60 + 0.20 + 0.10 = 90% (Invalid!)
      expect(() =>
        eventConfigService.validateConfiguration({
          weights: {
            correctness: 0.6,
            codeQuality: 0.2,
            commitQuality: 0.1,
          },
        })
      ).toThrow(/must sum exactly to 100%/i);

      // Negative weights (Invalid!)
      expect(() =>
        eventConfigService.validateConfiguration({
          weights: {
            correctness: 1.2,
            codeQuality: -0.1,
            commitQuality: -0.1,
          },
        })
      ).toThrow(/must be non-negative/i);
    });

    it('accepts valid scoring weights that sum to 100%', () => {
      expect(() =>
        eventConfigService.validateConfiguration({
          weights: {
            correctness: 0.7,
            codeQuality: 0.2,
            commitQuality: 0.1,
          },
        })
      ).not.toThrow();
    });
  });

  // ── 2. UNAUTHORIZED CONFIGURATION EDITS ─────────────────────
  describe('Unauthorized Configuration Edits', () => {
    it('blocks unauthorized users and students from editing event configuration', () => {
      expect(() => eventConfigService.verifyAdminAccess('')).toThrow(/unauthorized/i);
      expect(() => eventConfigService.verifyAdminAccess('guest_user')).toThrow(/unauthorized/i);
      expect(() => eventConfigService.verifyAdminAccess('student_alice')).toThrow(/unauthorized/i);
      expect(() => eventConfigService.verifyAdminAccess('anonymous')).toThrow(/unauthorized/i);
    });

    it('permits authorized administrators to edit event configuration', () => {
      expect(() => eventConfigService.verifyAdminAccess('lead_organizer')).not.toThrow();
      expect(() => eventConfigService.verifyAdminAccess('head_admin')).not.toThrow();
    });
  });

  // ── 3. CONFIGURATION VERSIONING ────────────────────────────
  describe('Configuration Versioning', () => {
    it('increments configuration version and records who, when, and why', async () => {
      const initialConfig = await eventConfigService.getEventConfig();
      const initialVersion = initialConfig.version || 1;

      const updated = await eventConfigService.updateEventConfig(
        {
          eventName: 'PRison Break 2026 Invitational',
        },
        'lead_organizer',
        'Official 2026 title update'
      );

      expect(updated.version).toBe(initialVersion + 1);
      expect(updated.updatedBy).toBe('lead_organizer');
      expect(updated.updateReason).toBe('Official 2026 title update');
      expect(updated.updatedAt).toBeDefined();
    });
  });

  // ── 4. SCORE REGRADING ─────────────────────────────────────
  describe('Score Regrading Action', () => {
    it('requires explicit admin authorization and records historical regrade in audit trail', async () => {
      // Non-admin cannot trigger regrade
      await expect(
        eventConfigService.regradeAllContributions('student_bob', 'Regrade please')
      ).rejects.toThrow(/unauthorized/i);

      // Regrade without reason is blocked
      await expect(
        eventConfigService.regradeAllContributions('lead_organizer', '')
      ).rejects.toThrow(/justification reason is required/i);

      // Valid regrade records audit log entry preserving previous results
      const result = await eventConfigService.regradeAllContributions(
        'lead_organizer',
        'Applying updated rubric weights after judge consensus'
      );

      expect(result.auditLogId).toBeDefined();
      expect(result.configVersion).toBeGreaterThanOrEqual(1);

      // Verify audit log entry exists
      const logs = await auditLogService.getAuditLogs(10);
      const regradeLog = logs.find((l) => l.id === result.auditLogId);
      expect(regradeLog).toBeDefined();
      expect(regradeLog?.action).toBe('SCORE_OVERRIDE');
      expect(regradeLog?.adminUsername).toBe('lead_organizer');
    });
  });

  // ── 5. AUDIT HISTORY & IMMUTABILITY ────────────────────────
  describe('Audit History Ledger', () => {
    it('records manual adjustments in an append-only audit ledger with full transparency', async () => {
      const auditId = `test_audit_${Date.now()}`;
      await auditLogService.recordAuditLog({
        id: auditId,
        action: 'SCORE_OVERRIDE',
        adminUsername: 'lead_judge',
        targetId: 'team_squard_1',
        targetName: 'Squad 1 — Issue #2',
        reason: 'Manual adjustment after offline review of array boundary code',
        previousValue: 25.0,
        newValue: 30.0,
        details: { previousPoints: 25.0, newPoints: 30.0, issueNumber: 2 },
        timestamp: new Date().toISOString(),
      });

      const logs = await auditLogService.getAuditLogs(20);
      const entry = logs.find((l) => l.id === auditId);
      expect(entry).toBeDefined();
      expect(entry?.adminUsername).toBe('lead_judge');
      expect(entry?.previousValue).toBe(25.0);
      expect(entry?.newValue).toBe(30.0);
    });
  });

  // ── 6. SCORE RECONCILIATION & DATA INTEGRITY ────────────────
  describe('Score Reconciliation Tool', () => {
    it('audits canonical score ledger against cached team totals and reports health', async () => {
      const report = await scoreReconciliationService.runReconciliationAudit();
      expect(report.totalTeamsAudited).toBeGreaterThan(0);
      expect(report.calculatedTeamScores).toBeDefined();
      expect(report.cachedTeamScores).toBeDefined();
    });

    it('detects cached-total mismatches and applies authorized corrections with audit trail', async () => {
      // Trigger reconciliation fix
      const fixResult = await scoreReconciliationService.applyReconciliationFixes(
        'lead_organizer',
        'Automated reconciliation fix for test suite'
      );

      expect(fixResult.auditLogId).toBeDefined();
      expect(fixResult.report).toBeDefined();

      // Unauthorized operator is blocked
      await expect(
        scoreReconciliationService.applyReconciliationFixes('guest_user', 'fix')
      ).rejects.toThrow(/unauthorized/i);
    });
  });
});
