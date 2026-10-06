// ─────────────────────────────────────────────
// Admin Pull Requests & Review Queue Page — Connected to Firestore
// Deterministic Scoring Signals · Auditable Manual Reviews
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { GitPullRequest, AlertCircle, ShieldAlert, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import type { PullRequest } from '../../types';
import { pullRequestService } from '../../services/pullRequestService';
import PullRequestTable from '../../components/pull-requests/PullRequestTable';
import PullRequestReviewModal from '../../components/pull-requests/PullRequestReviewModal';
import GitHubSyncModal from '../../components/pull-requests/GitHubSyncModal';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

import { autoSyncService, type AutoSyncState } from '../../services/autoSyncService';

type FilterType = 'all' | 'review_queue' | 'AUTO_APPROVED' | 'merged' | 'REJECTED' | 'open' | 'closed';

const FILTER_TABS: { label: string; value: FilterType; icon?: any }[] = [
  { label: 'All',           value: 'all' },
  { label: 'Review Queue',  value: 'review_queue', icon: ShieldAlert },
  { label: 'Auto-Approved', value: 'AUTO_APPROVED', icon: CheckCircle2 },
  { label: 'Merged',        value: 'merged' },
  { label: 'Rejected',      value: 'REJECTED' },
  { label: 'Open',          value: 'open' },
  { label: 'Closed',        value: 'closed' },
];

export default function PullRequestsPage() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [syncState, setSyncState] = useState<AutoSyncState>(autoSyncService.getState());

  // Inspection & Review Modal state
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    return autoSyncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = pullRequestService.subscribeToPullRequests(
      (data) => {
        setPrs(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[PullRequestsPage] Error:', err);
        setError('Failed to sync pull requests from Firestore');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const isPendingReview = (pr: PullRequest) =>
    pr.status === 'PENDING_REVIEW' ||
    pr.status === 'pending' ||
    pr.status === 'flagged' ||
    pr.processingState === 'PENDING_REVIEW';

  const isAutoApproved = (pr: PullRequest) =>
    pr.status === 'AUTO_APPROVED' || pr.processingState === 'AUTO_APPROVED';

  const isMerged = (pr: PullRequest) =>
    pr.status === 'merged' || pr.status === 'MERGED' || pr.merged;

  const isRejected = (pr: PullRequest) =>
    pr.status === 'REJECTED' || pr.processingState === 'REJECTED';

  const filtered = prs.filter((pr) => {
    if (filter === 'all') return true;
    if (filter === 'review_queue') return isPendingReview(pr);
    if (filter === 'AUTO_APPROVED') return isAutoApproved(pr);
    if (filter === 'merged') return isMerged(pr);
    if (filter === 'REJECTED') return isRejected(pr);
    if (filter === 'open') return pr.status === 'open' && !isPendingReview(pr) && !isAutoApproved(pr);
    if (filter === 'closed') return pr.status === 'closed';
    return true;
  });

  const reviewQueueCount = prs.filter(isPendingReview).length;
  const autoApprovedCount = prs.filter(isAutoApproved).length;
  const mergedCount = prs.filter(isMerged).length;
  const rejectedCount = prs.filter(isRejected).length;

  const handleInspect = (pr: PullRequest) => {
    setSelectedPR(pr);
    setIsReviewModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide mb-1 flex items-center gap-2">
            <span>Pull Requests & Review Queue</span>
          </h1>
          <p className="font-mono text-xs text-slate-500">
            Deterministic scoring engine, validation signals, and auditable warden reviews
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Live Background Auto-Sync Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono shadow-sm">
            <span className={`w-2 h-2 rounded-full ${syncState.isSyncing ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-slate-300 font-semibold">
              {syncState.isSyncing ? 'Auto-Syncing GH...' : `Live Auto-Sync (${syncState.intervalSeconds}s)`}
            </span>
          </div>

          {reviewQueueCount > 0 && (
            <button
              onClick={() => setFilter('review_queue')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs hover:bg-amber-500/20 transition-all"
            >
              <ShieldAlert size={14} className="animate-pulse" />
              <span>{reviewQueueCount} Awaiting Review</span>
            </button>
          )}

          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
            title="Fetch all PRs directly from GitHub repositories"
          >
            <RefreshCw size={13} className={syncState.isSyncing ? 'animate-spin' : ''} />
            <span>Force Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-400 font-mono text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total PRs',       value: prs.length,          color: 'text-slate-400' },
          { label: 'Review Queue',    value: reviewQueueCount,    color: reviewQueueCount > 0 ? 'text-amber-400' : 'text-slate-500', alert: reviewQueueCount > 0 },
          { label: 'Auto-Approved',   value: autoApprovedCount,   color: 'text-emerald-400' },
          { label: 'Merged',          value: mergedCount,         color: 'text-purple-400' },
          { label: 'Rejected',        value: rejectedCount,       color: 'text-rose-400' },
        ].map((s) => (
          <div
            key={s.label}
            className={`px-4 py-2.5 rounded-lg border bg-slate-900/40 flex items-center gap-3 ${
              s.alert ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800/60'
            }`}
          >
            <span className={`font-display text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((opt) => {
          const Icon = opt.icon;
          const count =
            opt.value === 'all' ? prs.length :
            opt.value === 'review_queue' ? reviewQueueCount :
            opt.value === 'AUTO_APPROVED' ? autoApprovedCount :
            opt.value === 'merged' ? mergedCount :
            opt.value === 'REJECTED' ? rejectedCount :
            prs.filter((p) => p.status === opt.value).length;

          const isSelected = filter === opt.value;

          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md font-mono text-[11px] tracking-wide border transition-all flex items-center gap-1.5 ${
                isSelected
                  ? opt.value === 'review_queue'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-transparent border-slate-800/50 text-slate-500 hover:border-slate-700 hover:text-slate-400'
              }`}
            >
              {Icon && <Icon size={12} />}
              <span>{opt.label}</span>
              <span className="opacity-60 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Review Queue Information Callout */}
      {filter === 'review_queue' && (
        <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 font-mono text-xs text-amber-300">
          <Clock size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-0.5">
            <div className="font-bold">Admin Review Queue Active</div>
            <p className="text-slate-300 text-[11px]">
              Pull requests shown here failed one or more deterministic auto-approval checks (e.g. tests failing, restricted files, unregistered participant). Click <strong>Review</strong> on any item to inspect validation signals, approve, reject, force merge, or adjust scores with mandatory audit logging.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest size={14} className="text-slate-500" />
            <span className="font-mono text-xs text-slate-400 tracking-wide">
              {filtered.length} Pull Request{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-600">
            Source of Truth: Firestore <code>scoreEvents</code>
          </span>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingState message="INTERCEPTING PULL REQUEST TRANSMISSIONS..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 flex flex-col items-center">
            <EmptyState
              title={filter === 'review_queue' ? 'Review Queue Clear' : 'No Pull Requests Found'}
              description={
                filter === 'review_queue'
                  ? 'All pending pull requests have been processed or auto-approved.'
                  : 'Pull requests created on GitHub are not appearing? Click "Sync from GitHub" to import all PRs directly from your repositories.'
              }
              icon={filter === 'review_queue' ? <CheckCircle2 size={28} className="text-emerald-400" /> : <GitPullRequest size={28} />}
            />
            {filter !== 'review_queue' && (
              <button
                onClick={() => setIsSyncModalOpen(true)}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-bold transition-all shadow-lg shadow-emerald-950/40"
              >
                <RefreshCw size={14} />
                <span>Sync Pull Requests from GitHub</span>
              </button>
            )}
          </div>
        ) : (
          <PullRequestTable pullRequests={filtered} onInspect={handleInspect} />
        )}
      </div>

      {/* Inspection & Review Modal */}
      <PullRequestReviewModal
        pr={selectedPR}
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedPR(null);
        }}
        onActionComplete={() => {
          // Real-time Firestore listener automatically updates `prs`
        }}
      />

      {/* GitHub Direct Sync Modal */}
      <GitHubSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
}
