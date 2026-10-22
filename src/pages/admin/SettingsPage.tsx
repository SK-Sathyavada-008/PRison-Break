// ─────────────────────────────────────────────
// Admin Settings Page — Phase 6 Event Configuration & Data Integrity Console
// Full competition settings, weight sum validation, version tracking,
// auditable regrading, and data integrity reconciliation tool.
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  Sliders,
  Flag,
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Shield,
  Zap,
  Activity,
  History,
  Lock,
  GitBranch,
} from 'lucide-react';
import { eventConfigService, DEFAULT_CONFIG } from '../../services/eventConfigService';
import { scoreReconciliationService } from '../../services/scoreReconciliationService';
import { seedService } from '../../services/seedService';
import { isFirebaseConfigured } from '../../config/firebase';
import type { FirestoreEventConfig, ReconciliationReport } from '../../types';

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-400">
            {icon}
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-200">{title}</div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5">{description}</div>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const isFirebaseReady = isFirebaseConfigured();
  const [config, setConfig] = useState<FirestoreEventConfig>({ ...DEFAULT_CONFIG });
  const [adminUsername, setAdminUsername] = useState('lead_organizer');
  const [updateReason, setUpdateReason] = useState('Competition rule alignment');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reconciliation State
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationReport, setReconciliationReport] = useState<ReconciliationReport | null>(null);
  const [applyingFixes, setApplyingFixes] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  // Regrading State
  const [regrading, setRegrading] = useState(false);
  const [regradeMessage, setRegradeMessage] = useState<string | null>(null);

  // Database Seed State
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const unsub = eventConfigService.subscribeToEventConfig((data) => {
      if (data) setConfig(data);
    });

    return () => unsub();
  }, []);

  // Real-time calculation of scoring weights sum
  const currentWeights = config.weights || DEFAULT_CONFIG.weights;
  const weightsSum = Math.round(
    ((currentWeights.correctness || 0) +
      (currentWeights.codeQuality || 0) +
      (currentWeights.commitQuality || 0)) *
      100
  );
  const isWeightsValid = weightsSum === 100;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isWeightsValid) {
      setErrorMessage(`Scoring weights must sum to exactly 100% (currently ${weightsSum}%).`);
      return;
    }

    try {
      setSaving(true);
      const updated = await eventConfigService.updateEventConfig(
        config,
        adminUsername,
        updateReason
      );
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating competition configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunReconciliation = async () => {
    try {
      setReconciling(true);
      setFixSuccessMessage(null);
      const report = await scoreReconciliationService.runReconciliationAudit();
      setReconciliationReport(report);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error running reconciliation audit.');
    } finally {
      setReconciling(false);
    }
  };

  const handleApplyFixes = async () => {
    if (!window.confirm('Apply authorized corrections to reconcile team scores and eliminate duplicates?')) {
      return;
    }

    try {
      setApplyingFixes(true);
      const res = await scoreReconciliationService.applyReconciliationFixes(
        adminUsername,
        'Authorized administrative score reconciliation audit fix'
      );
      setReconciliationReport(res.report);
      setFixSuccessMessage(`Successfully applied ${res.appliedFixes} score reconciliation fix(es). Audit record logged.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to apply reconciliation fixes.');
    } finally {
      setApplyingFixes(false);
    }
  };

  const handleRegradeAll = async () => {
    const reason = window.prompt(
      'Enter the administrative justification reason for regrading historical contributions under active config v' +
        config.version +
        ':'
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid justification reason (min 5 characters) is required.');
      return;
    }

    try {
      setRegrading(true);
      setRegradeMessage(null);
      const res = await eventConfigService.regradeAllContributions(adminUsername, reason);
      setRegradeMessage(
        `Regrade executed successfully under Config v${res.configVersion} (${res.regradedCount} contributions evaluated). Audit Log #${res.auditLogId} created.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Regrade execution failed.');
    } finally {
      setRegrading(false);
    }
  };

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      setSeedResult(null);
      const res = await seedService.seedAll();
      setSeedResult(res);
    } catch (err: any) {
      setSeedResult({ success: false, message: err?.message || 'Seeding failed' });
    } finally {
      setSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to completely purge all competition records from Firestore?')) {
      return;
    }
    try {
      setClearing(true);
      setSeedResult(null);
      const res = await seedService.clearAll();
      setSeedResult(res);
    } catch (err: any) {
      setSeedResult({ success: false, message: err?.message || 'Purge failed' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100 tracking-wide mb-1 flex items-center gap-3">
            <span>Event Settings & Scoring Governance</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FF1E46]/10 text-[#FF5470] border border-[#FF1E46]/40">
              CONFIG v{config.version || 1}
            </span>
          </h1>
          <p className="font-mono text-xs text-slate-400">
            Authoritative competition rules, difficulty points, rubric weights, and audit tools
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRegradeAll}
            disabled={regrading}
            className="btn btn-secondary flex items-center gap-1.5 text-xs font-mono"
            title="Explicitly regrade contributions with active configuration version"
          >
            <RefreshCw size={13} className={regrading ? 'animate-spin' : ''} />
            <span>Regrade Historical Scores</span>
          </button>
        </div>
      </div>

      {/* Version & Governance Banner */}
      <div className="card p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF1E46]/10 border border-[#FF1E46]/30 flex items-center justify-center text-[#FF5470]">
            <History size={16} />
          </div>
          <div>
            <span className="text-white font-bold">Active Configuration Version: v{config.version || 1}</span>
            <span className="text-slate-500 ml-2">
              (Updated {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'N/A'} by @{config.updatedBy || 'admin'})
            </span>
            <p className="text-slate-400 text-[11px] mt-0.5 italic">
              "{config.updateReason || 'Official baseline settings'}"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
              isWeightsValid
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-400'
            }`}
          >
            Weights Sum: {weightsSum}% {isWeightsValid ? '(Valid)' : '(Must be 100%)'}
          </span>
        </div>
      </div>

      {/* Status Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-xs font-mono text-emerald-300 flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0 text-emerald-400" />
          <span>Competition configuration v{config.version} saved and logged to audit trail.</span>
        </div>
      )}
      {regradeMessage && (
        <div className="p-4 rounded-xl bg-purple-950/60 border border-purple-500/60 text-xs font-mono text-purple-300 flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0 text-purple-400" />
          <span>{regradeMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* Section 1: Event Identity & Team Size */}
        <SettingsSection
          title="Event Identity & Competition Policies"
          description="Basic event name, active status, required team size, and submission limits"
          icon={<Flag size={16} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Event Name</label>
              <input
                type="text"
                value={config.eventName}
                onChange={(e) => setConfig({ ...config, eventName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Tagline</label>
              <input
                type="text"
                value={config.tagline || ''}
                onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Required Team Size</label>
              <input
                type="number"
                value={config.requiredTeamSize || 4}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed"
                title="Fixed at 4 students per squad"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Fixed: 4 students/squad</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Max PRs per Student</label>
              <input
                type="number"
                value={config.maxCompetitionPRsPerStudent || 1}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed"
                title="Fixed at 1 final competition PR"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Fixed: 1 final PR rule</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800/80 text-xs font-mono">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="activeEvent"
                checked={config.active !== false}
                onChange={(e) => setConfig({ ...config, active: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-[#FF1E46] focus:ring-0"
              />
              <label htmlFor="activeEvent" className="text-slate-200 cursor-pointer">
                Active Event Ingestion Enabled
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="gradingFreeze"
                checked={config.gradingFreeze === true}
                onChange={(e) => setConfig({ ...config, gradingFreeze: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
              />
              <label htmlFor="gradingFreeze" className="text-slate-200 cursor-pointer flex items-center gap-1.5">
                <Lock size={13} className="text-amber-400" />
                <span>Grading Freeze (Pause Leaderboard Score Changes)</span>
              </label>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Manual Review Policy</label>
              <select
                value={config.manualReviewPolicy || 'FLAGGED_ONLY'}
                onChange={(e) => setConfig({ ...config, manualReviewPolicy: e.target.value as any })}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
              >
                <option value="FLAGGED_ONLY">Flagged Only (Suspicious PRs)</option>
                <option value="ANOMALIES_ONLY">Anomalies & Duplicate PRs</option>
                <option value="ALL">All Submissions</option>
              </select>
            </div>
          </div>
        </SettingsSection>

        {/* Section 2: Difficulty Base Points */}
        <SettingsSection
          title="Difficulty Base Points"
          description="Maximum available points for each issue difficulty level"
          icon={<Zap size={16} />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="text-emerald-400 font-bold block mb-1">EASY Points</label>
              <input
                type="number"
                min="1"
                value={config.difficultyPoints?.EASY ?? 10}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    difficultyPoints: {
                      ...config.difficultyPoints,
                      EASY: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-cyan-400 font-bold block mb-1">MEDIUM Points</label>
              <input
                type="number"
                min="1"
                value={config.difficultyPoints?.MEDIUM ?? 20}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    difficultyPoints: {
                      ...config.difficultyPoints,
                      MEDIUM: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="text-purple-400 font-bold block mb-1">HARD Points</label>
              <input
                type="number"
                min="1"
                value={config.difficultyPoints?.HARD ?? 30}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    difficultyPoints: {
                      ...config.difficultyPoints,
                      HARD: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="text-rose-400 font-bold block mb-1">VERY HARD Points</label>
              <input
                type="number"
                min="1"
                value={config.difficultyPoints?.VERY_HARD ?? 40}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    difficultyPoints: {
                      ...config.difficultyPoints,
                      VERY_HARD: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>
          </div>
        </SettingsSection>

        {/* Section 3: Rubric Component Weights & Accuracy */}
        <SettingsSection
          title="Scoring Rubric Weights (Must Sum to 100%)"
          description="Proportional weighting for Correctness (C), Code Quality (Q), and Commit Quality (M)"
          icon={<Sliders size={16} />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="text-emerald-400 font-bold block mb-1">
                Correctness Weight (0.70)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={currentWeights.correctness ?? 0.7}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    weights: {
                      ...currentWeights,
                      correctness: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {Math.round((currentWeights.correctness ?? 0.7) * 100)}% of issue points
              </span>
            </div>

            <div>
              <label className="text-cyan-400 font-bold block mb-1">
                Code Quality Weight (0.20)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={currentWeights.codeQuality ?? 0.2}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    weights: {
                      ...currentWeights,
                      codeQuality: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {Math.round((currentWeights.codeQuality ?? 0.2) * 100)}% of issue points
              </span>
            </div>

            <div>
              <label className="text-purple-400 font-bold block mb-1">
                Commit Quality Weight (0.10)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={currentWeights.commitQuality ?? 0.1}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    weights: {
                      ...currentWeights,
                      commitQuality: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {Math.round((currentWeights.commitQuality ?? 0.1) * 100)}% of issue points
              </span>
            </div>

            <div>
              <label className="text-rose-400 font-bold block mb-1">
                Very Hard Accuracy Threshold
              </label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="1.0"
                value={config.veryHardAccuracyThreshold ?? 0.95}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    veryHardAccuracyThreshold: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {Math.round((config.veryHardAccuracyThreshold ?? 0.95) * 100)}% correctness to qualify
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* Section 4: Repository & Git Rules */}
        <SettingsSection
          title="Git Branch & Source File Patterns"
          description="Approved target branches and scope discipline patterns"
          icon={<GitBranch size={16} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Base Target Branch</label>
              <input
                type="text"
                value={config.baseBranch || 'main'}
                onChange={(e) => setConfig({ ...config, baseBranch: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Permitted File Patterns</label>
              <input
                type="text"
                value={(config.permittedSourceFilePatterns || ['src/**/*.java']).join(', ')}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    permittedSourceFilePatterns: e.target.value.split(',').map((s) => s.trim()),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
              />
            </div>
          </div>
        </SettingsSection>

        {/* Section 5: Authorization & Save */}
        <SettingsSection
          title="Administrative Authorization & Justification"
          description="Record identity and mandatory reason for configuration versioning audit trail"
          icon={<Shield size={16} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Administrator Identity</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Justification Reason</label>
              <input
                type="text"
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
                placeholder="Reason for changing configuration..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-[#FF1E46]"
                required
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving || !isWeightsValid}
              className="btn btn-primary px-6 py-2.5 text-xs font-mono flex items-center gap-2"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <SaveIcon />}
              <span>Save & Publish Config v{(config.version || 1) + 1}</span>
            </button>
          </div>
        </SettingsSection>
      </form>

      {/* Section 6: Data Integrity & Score Reconciliation Tool */}
      <SettingsSection
        title="Score Integrity & Canonical Ledger Reconciliation"
        description="Recalculates team scores from canonical issue records, audits discrepancies, and applies corrections"
        icon={<Activity size={16} />}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-mono text-slate-400">
              Audits the append-only score ledger against cached team totals, checks for duplicate issue awards, missing student references, and multiple competition PRs.
            </p>
            <button
              type="button"
              onClick={handleRunReconciliation}
              disabled={reconciling}
              className="btn btn-secondary flex items-center gap-1.5 text-xs font-mono"
            >
              <RefreshCw size={13} className={reconciling ? 'animate-spin' : ''} />
              <span>{reconciling ? 'Auditing Ledger...' : 'Run Reconciliation Audit'}</span>
            </button>
          </div>

          {fixSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs font-mono text-emerald-300">
              {fixSuccessMessage}
            </div>
          )}

          {reconciliationReport && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">
                  Audit Summary ({new Date(reconciliationReport.timestamp).toLocaleTimeString()}):
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold ${
                    reconciliationReport.isHealthy
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-950/60 text-rose-400 border border-rose-500/50'
                  }`}
                >
                  {reconciliationReport.isHealthy
                    ? 'All Scores Reconciled & Healthy'
                    : `${reconciliationReport.discrepancies.length} Discrepancies Found`}
                </span>
              </div>

              {reconciliationReport.discrepancies.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Target</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {reconciliationReport.discrepancies.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-bold text-slate-300">{d.type}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.severity === 'ERROR'
                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                                  : 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                              }`}
                            >
                              {d.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {d.teamId || d.studentUsername || 'Ledger'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{d.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-slate-900/40 flex justify-end border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleApplyFixes}
                      disabled={applyingFixes}
                      className="btn btn-primary text-xs font-mono"
                    >
                      {applyingFixes ? 'Applying Corrections...' : 'Apply Authorized Reconciliation Corrections'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-mono text-emerald-400 bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/20">
                  ✓ Canonical score ledger matches cached totals across all squads. Zero duplicate PRs or orphan score events detected.
                </p>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Database Diagnostics & Seed */}
      <SettingsSection
        title="Database Environment & Seeding"
        description="Firestore operational state and seed initialization"
        icon={<Database size={16} />}
      >
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-400">
            {isFirebaseReady
              ? 'Connected to configured Firestore instance.'
              : 'Running in offline in-memory mode. Demo data is served safely without external network dependencies.'}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSeedData}
              disabled={seeding}
              className="btn btn-secondary text-xs font-mono"
            >
              {seeding ? 'Seeding...' : 'Seed Sample Hackathon Data'}
            </button>
            <button
              type="button"
              onClick={handleClearData}
              disabled={clearing}
              className="btn btn-danger text-xs font-mono"
            >
              {clearing ? 'Purging...' : 'Purge All Database Records'}
            </button>
          </div>

          {seedResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono ${
                seedResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {seedResult.message}
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

function SaveIcon() {
  return <CheckCircle size={14} />;
}
