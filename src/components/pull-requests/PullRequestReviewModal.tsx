// ─────────────────────────────────────────────
// PullRequestReviewModal — Admin Review Queue & Audit Inspection
// Deterministic Signals · Score Engine Trigger · Audit Trail
// ─────────────────────────────────────────────

import { useState } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Award,
  GitMerge,
  Ban,
  Sliders,
  Hash,
  User,
  GitPullRequest,
  Check,
  Tag,
  Clock,
  FileCheck,
  Sparkles,
  Bot,
  Loader2,
} from 'lucide-react';
import type { PullRequest } from '../../types';
import { scoringEngine, SCORING_RULES } from '../../services/scoringEngine';
import { aiValidationService, type AIValidationResult } from '../../services/aiValidationService';
import StatusBadge from '../ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';

interface PullRequestReviewModalProps {
  pr: PullRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export default function PullRequestReviewModal({
  pr,
  isOpen,
  onClose,
  onActionComplete,
}: PullRequestReviewModalProps) {
  const { currentUser } = useAuth();
  const adminName = currentUser?.displayName || currentUser?.email || 'admin_warden';

  const [activeTab, setActiveTab] = useState<'inspect' | 'approve' | 'reject' | 'merge' | 'adjust'>('inspect');
  const [loading, setLoading] = useState(false);
  const [evaluatingAI, setEvaluatingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AIValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [approveNotes, setApproveNotes] = useState('Deterministic checks verified. Approved by administrator.');
  const [rejectReason, setRejectReason] = useState('');
  const [mergeReason, setMergeReason] = useState('Admin authorized force merge');
  const [scoreDelta, setScoreDelta] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState('');

  if (!isOpen || !pr) return null;

  const checks = pr.validationChecks || {
    participantRegistered: pr.validationSignals?.participantRegistered ?? true,
    repositoryRegistered: pr.validationSignals?.repositoryActive ?? true,
    issueValid: pr.validationSignals?.validIssueLinked ?? (!!pr.issueNumber && pr.issueNumber > 0),
    testsPassed: pr.validationSignals?.testsPassed ?? (pr.testStatus === 'passing' || !!pr.testsPassed),
    filesValid: pr.validationSignals?.filesAllowed ?? true,
  };

  const allPassed =
    checks.participantRegistered &&
    checks.repositoryRegistered &&
    checks.issueValid &&
    checks.testsPassed &&
    checks.filesValid;

  const reasons = pr.validationReasons && pr.validationReasons.length > 0
    ? pr.validationReasons
    : [
        checks.participantRegistered
          ? `Participant @${pr.githubUsername} is registered in PRison Control.`
          : `Participant @${pr.githubUsername} is not registered in PRison Control.`,
        checks.repositoryRegistered
          ? `Repository "${pr.repository}" is active and registered.`
          : `Repository "${pr.repository}" is not active or unregistered.`,
        checks.issueValid
          ? `Challenge issue #${pr.issueNumber || 'N/A'} is linked to this PR.`
          : 'No valid challenge issue linked in PR title or body.',
        checks.testsPassed
          ? 'Automated tests and check runs passed successfully.'
          : 'Automated tests are failing or pending.',
        checks.filesValid
          ? 'Modified files comply with repository security and challenge boundaries.'
          : 'Suspicious modifications or protected CI paths touched.',
      ];

  // Potential rules preview
  const issueLabels = pr.issueLabels || [];
  const prLabels = pr.labels || [];
  const allLabels = [...issueLabels, ...prLabels].map((l) => l.toLowerCase());

  const hasDifficultIssue =
    allLabels.includes('difficulty:hard') ||
    allLabels.includes('difficulty:medium') ||
    allLabels.includes('points:20');
  const hasBug = allLabels.includes('type:bug') || allLabels.includes('bug');
  const isHard = allLabels.includes('difficulty:hard');
  const hasDifficultBug = (hasBug && isHard) || allLabels.includes('points:25');
  const isDocs =
    allLabels.includes('type:documentation') ||
    allLabels.includes('documentation') ||
    allLabels.includes('docs');

  // Handle Approve
  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scoringEngine.approvePR(
        pr as any,
        adminName,
        approveNotes.trim() || 'Approved by administrator'
      );
      setSuccessMsg(`PR #${pr.number} approved successfully! Awarded +${res.pointsAwarded} XP with audit record.`);
      setTimeout(() => {
        onActionComplete?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[ReviewModal] Approve error:', err);
      setError(err?.message || 'Failed to approve PR');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('A rejection reason is strictly required for the audit record.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await scoringEngine.rejectPR(pr as any, adminName, rejectReason.trim());
      setSuccessMsg(`PR #${pr.number} rejected. Audit log recorded.`);
      setTimeout(() => {
        onActionComplete?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[ReviewModal] Reject error:', err);
      setError(err?.message || 'Failed to reject PR');
    } finally {
      setLoading(false);
    }
  };

  // Handle Force Merge
  const handleForceMerge = async () => {
    if (!mergeReason.trim()) {
      setError('A force merge justification is required for the audit log.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await scoringEngine.forceMergePR(pr as any, adminName, mergeReason.trim());
      setSuccessMsg(`PR #${pr.number} force merged! Awarded +${res.pointsAwarded} XP with audit record.`);
      setTimeout(() => {
        onActionComplete?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[ReviewModal] Force merge error:', err);
      setError(err?.message || 'Failed to force merge PR');
    } finally {
      setLoading(false);
    }
  };

  // Handle Adjust Score
  const handleAdjustScore = async () => {
    if (!adjustReason.trim()) {
      setError('Audit justification is required. Scores cannot be modified without audit trail.');
      return;
    }
    if (isNaN(scoreDelta) || scoreDelta === 0) {
      setError('Please provide a non-zero score adjustment value.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await scoringEngine.adjustScoreWithAudit(
        '',
        pr.githubUsername,
        Number(scoreDelta),
        adminName,
        adjustReason.trim(),
        pr.id,
        pr.number
      );
      setSuccessMsg(
        `Score adjusted (${scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} XP) for @${pr.githubUsername} with audit record.`
      );
      setTimeout(() => {
        onActionComplete?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[ReviewModal] Adjust score error:', err);
      setError(err?.message || 'Failed to adjust score');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAIJudge = async () => {
    if (!pr) return;
    try {
      setEvaluatingAI(true);
      setError(null);
      setSuccessMsg(null);

      const repoParts = (pr.repositoryFullName || pr.repository).split('/');
      const owner = repoParts.length > 1 ? repoParts[0] : 'SK-Sathyavada-008';
      const repo = repoParts.length > 1 ? repoParts[1] : pr.repository;

      const res = await aiValidationService.evaluateAndJudgePR(owner, repo, pr.number, {
        autoMergeIfApproved: true,
      });
      setAiResult(res);

      if (res.mergeResult?.merged) {
        setSuccessMsg(
          `PR #${pr.number} validated by AI Judge and automatically merged on GitHub! Score updated with +15 XP.`
        );
      } else if (res.verdict === 'APPROVED') {
        setSuccessMsg(
          `PR #${pr.number} verified by AI Judge (+10 XP awarded). ${res.autoMergeBlockedReason || ''}`
        );
      } else {
        setError(`AI Judge feedback: ${res.feedback}`);
      }
      onActionComplete?.();
    } catch (err: any) {
      console.error('[ReviewModal] AI Judge execution error:', err);
      setError(err?.message || 'AI evaluation failed');
    } finally {
      setEvaluatingAI(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-start justify-between bg-slate-950/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                PR #{pr.number}
              </span>
              <StatusBadge status={pr.status} />
              <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                <Award size={12} className="text-amber-400" />
                Score: <strong className="text-white">{pr.score} XP</strong>
              </span>
            </div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>{pr.title}</span>
              {pr.url && (
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-white transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <User size={12} className="text-slate-500" />
                Author: <strong className="text-slate-200">@{pr.githubUsername}</strong>
              </span>
              <span className="flex items-center gap-1">
                <GitPullRequest size={12} className="text-slate-500" />
                Repo: <span className="text-slate-300">{pr.repository}</span>
              </span>
              {pr.issueNumber && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Hash size={12} />
                  Issue #{pr.issueNumber}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 gap-1 font-mono text-xs">
          <button
            onClick={() => setActiveTab('inspect')}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'inspect'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield size={14} />
            Signals & Rules
          </button>
          <button
            onClick={() => setActiveTab('approve')}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'approve'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 size={14} />
            Approve PR
          </button>
          <button
            onClick={() => setActiveTab('reject')}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'reject'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ban size={14} />
            Reject PR
          </button>
          <button
            onClick={() => setActiveTab('merge')}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'merge'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitMerge size={14} />
            Force Merge
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'adjust'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders size={14} />
            Adjust Score
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-400 font-mono text-xs">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2 text-emerald-400 font-mono text-xs">
              <Check size={15} className="flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: INSPECT SIGNALS & RULES */}
          {activeTab === 'inspect' && (
            <div className="space-y-5">
              {/* AI Code Judge & Auto-Merge Engine */}
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                      <Bot size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs flex items-center gap-2">
                        <span>AI Code Judge & Auto-Merge Engine</span>
                        <span className="text-[10px] font-normal text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          {aiResult?.model || pr.aiValidation?.model || 'Gemma / Gemini'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Evaluates solution correctness and automatically merges into base branch
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleRunAIJudge}
                    disabled={evaluatingAI}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-950/40 disabled:opacity-50 self-start sm:self-auto"
                  >
                    {evaluatingAI ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Evaluating Code...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Run AI Evaluation & Auto-Merge</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Verdict summary */}
                {(aiResult || pr.aiValidation) && (
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold uppercase text-[10px]">AI Verdict:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          (aiResult?.verdict || pr.aiValidation?.verdict) === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {aiResult?.verdict || pr.aiValidation?.verdict}
                      </span>
                    </div>
                    <p className="text-slate-200">
                      {aiResult?.summary || pr.aiValidation?.summary}
                    </p>
                    {(aiResult?.feedback || pr.aiValidation?.feedback) && (
                      <p className="text-slate-400 border-t border-slate-800/80 pt-1 text-[10px]">
                        <strong>Feedback:</strong> {aiResult?.feedback || pr.aiValidation?.feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Phase 8: Deterministic Validation Checks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <FileCheck size={14} className="text-emerald-400" />
                    Deterministic Validation Checks
                  </h3>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      allPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {allPassed ? 'ALL 5 CHECKS PASSED (AUTO-APPROVED)' : 'FLAGGED / PENDING REVIEW'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs">
                  {[
                    { label: 'Registered Participant', passed: checks.participantRegistered },
                    { label: 'Registered Active Repository', passed: checks.repositoryRegistered },
                    { label: 'Valid Challenge Issue Linked', passed: checks.issueValid },
                    { label: 'Automated Tests Pass', passed: checks.testsPassed },
                    { label: 'Allowed Files Changed', passed: checks.filesValid },
                  ].map((sig) => (
                    <div
                      key={sig.label}
                      className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        sig.passed
                          ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                          : 'bg-red-950/20 border-red-500/30 text-red-300'
                      }`}
                    >
                      <span>{sig.label}</span>
                      {sig.passed ? (
                        <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle size={15} className="text-red-400 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Explainable Decision Log: WHY This PR Was Approved, Flagged or Rejected */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Shield size={14} className="text-cyan-400" />
                  Validation Decision Audit Log (Why PR Was Evaluated)
                </h3>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2">
                  {reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-2 font-mono text-xs text-slate-300">
                      <span className="text-emerald-400 font-bold mt-0.5">›</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto-Merge Policy Status */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40 font-mono text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                    Auto-Merge Policy Status:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      allPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {allPassed ? 'AUTO-MERGE PERMITTED' : 'AUTO-MERGE BLOCKED'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {allPassed
                    ? 'All deterministic safety checks passed. Eligible for automated merge execution.'
                    : 'Auto-merge blocked: Failing one or more required deterministic constraints (tests, participant registration, repository status, issue link, or file boundaries).'}
                </p>
              </div>

              {/* Labels & Metadata */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Tag size={14} className="text-blue-400" />
                  GitHub Labels & Issue Metadata
                </h3>
                {allLabels.length === 0 ? (
                  <p className="font-mono text-xs text-slate-500 italic bg-slate-900/40 p-3 rounded border border-slate-800">
                    No explicit issue or PR labels detected.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                    {allLabels.map((lbl, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Applicable Scoring Rules Preview */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Award size={14} className="text-amber-400" />
                  Scoring Rule Matrix Breakdown
                </h3>
                <div className="space-y-1.5 font-mono text-xs">
                  {[
                    { label: SCORING_RULES.CORRECT_PR.label, points: 10, applicable: pr.correct || allPassed },
                    { label: SCORING_RULES.DIFFICULT_ISSUE.label, points: 20, applicable: hasDifficultIssue },
                    { label: SCORING_RULES.PR_REVIEWED.label, points: 5, applicable: true },
                    { label: SCORING_RULES.PR_MERGED.label, points: 15, applicable: !!pr.merged },
                    { label: SCORING_RULES.FIRST_SUCCESSFUL_PR.label, points: 10, applicable: !pr.merged },
                    { label: SCORING_RULES.DOCS_CONTRIBUTION.label, points: 10, applicable: isDocs },
                    { label: SCORING_RULES.DIFFICULT_BUG_FIX.label, points: 25, applicable: hasDifficultBug },
                  ].map((rule) => (
                    <div
                      key={rule.label}
                      className="p-2 rounded border border-slate-800/80 bg-slate-900/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            rule.applicable ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-slate-600'
                          }`}
                        />
                        <span className={rule.applicable ? 'text-slate-200' : 'text-slate-500'}>
                          {rule.label}
                        </span>
                      </div>
                      <span className={`font-bold ${rule.applicable ? 'text-emerald-400' : 'text-slate-600'}`}>
                        +{rule.points} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit / Review Notes */}
              {pr.reviewNotes && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 font-mono text-xs space-y-1">
                  <div className="text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    <span>Prior Review Notes:</span>
                  </div>
                  <div className="text-slate-200 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                    {pr.reviewNotes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPROVE PR */}
          {activeTab === 'approve' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center gap-2 text-sm">
                  <CheckCircle2 size={16} />
                  Approve Pull Request
                </div>
                <p className="text-slate-300 text-xs">
                  Approving this PR marks it as <strong>AUTO_APPROVED</strong>, executes the deterministic scoring
                  engine to compute and award all applicable XP events into <code>scoreEvents</code>, and generates a
                  permanent audit log in the <code>reviews</code> collection.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Approval Notes / Audit Justification
                </label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="Notes explaining why this PR is approved..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('inspect')}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  {loading ? 'Approving & Scoring...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: REJECT PR */}
          {activeTab === 'reject' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-2">
                <div className="font-bold text-rose-400 flex items-center gap-2 text-sm">
                  <Ban size={16} />
                  Reject Pull Request
                </div>
                <p className="text-slate-300 text-xs">
                  Rejecting this PR marks it as <strong>REJECTED</strong>. No XP points will be awarded. A mandatory
                  rejection reason is required and will be preserved in the <code>reviews</code> audit trail.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Rejection Reason (Mandatory Audit Requirement) *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="E.g., Failed test suite, restricted files modified, or plagiarism detected..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('inspect')}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectReason.trim()}
                  className="px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <Ban size={15} />
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: FORCE MERGE */}
          {activeTab === 'merge' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/10 space-y-2">
                <div className="font-bold text-purple-400 flex items-center gap-2 text-sm">
                  <GitMerge size={16} />
                  Force Merge Pull Request
                </div>
                <p className="text-slate-300 text-xs">
                  Overrides review requirements and marks the PR as <strong>MERGED</strong>, awarding +15 XP (PR Merged)
                  and advancing the participant's escaped cells counter. An audit entry is registered in <code>reviews</code>.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Force Merge Justification *
                </label>
                <textarea
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  placeholder="Reason for administrator override..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('inspect')}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForceMerge}
                  disabled={loading || !mergeReason.trim()}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <GitMerge size={15} />
                  {loading ? 'Merging...' : 'Confirm Force Merge'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ADJUST SCORE */}
          {activeTab === 'adjust' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
                <div className="font-bold text-amber-400 flex items-center gap-2 text-sm">
                  <Sliders size={16} />
                  Adjust Participant Score
                </div>
                <p className="text-slate-300 text-xs">
                  Manually adjust points for @{pr.githubUsername}. <strong>IMPORTANT:</strong> The scoring engine never
                  silently edits scores; every point change generates an explicit, immutable record in{' '}
                  <code>scoreEvents</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    Points Adjustment (+/- XP)
                  </label>
                  <input
                    type="number"
                    value={scoreDelta}
                    onChange={(e) => setScoreDelta(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-bold focus:outline-none focus:border-amber-500"
                    placeholder="e.g. 10 or -5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    Auditor Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={adminName}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                  placeholder="Explain why this score adjustment is being made..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('inspect')}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustScore}
                  disabled={loading || !adjustReason.trim() || scoreDelta === 0}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <Sliders size={15} />
                  {loading ? 'Adjusting...' : 'Apply Audited Adjustment'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between font-mono text-[11px] text-slate-500">
          <span>Warden Audit Session: {adminName}</span>
          <span>Source of Truth: Firestore <code>scoreEvents</code></span>
        </div>
      </div>
    </div>
  );
}
