// ─────────────────────────────────────────────
// Admin Webhook Events Page — Real-Time Telemetry & Debugging
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  Radio,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Eye,
  GitPullRequest,
  GitCommit,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  Terminal,
  Play,
  Loader2,
  X,
  Code2,
} from 'lucide-react';
import type { WebhookEvent, WebhookProcessingStatus } from '../../types';
import { webhookEventService } from '../../services/webhookEventService';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';

export default function WebhookEventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WebhookProcessingStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Inspector & Simulation Modals
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Simulation execution state
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = webhookEventService.subscribeToWebhookEvents(
      (data) => {
        setEvents(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[WebhookEventsPage] Subscription error:', err);
        setError('Error synchronizing webhook events from Firestore');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulateWebhook = async (scenario: 'valid_pr' | 'invalid_sig' | 'duplicate' | 'unregistered_repo' | 'inactive_repo') => {
    try {
      setSimulationRunning(true);
      setSimulationResult(null);

      let payload: any = {};
      let headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      const now = new Date().toISOString();
      const testDelivery = `test_del_${Date.now()}`;

      switch (scenario) {
        case 'valid_pr':
          headers['x-github-delivery'] = testDelivery;
          headers['x-github-event'] = 'pull_request';
          payload = {
            action: 'opened',
            repository: {
              name: 'java-cell-01',
              full_name: 'PRisonBreak/java-cell-01',
              owner: { login: 'PRisonBreak' },
            },
            pull_request: {
              number: 101,
              title: 'Fix: Escape algorithm bypass test',
              html_url: 'https://github.com/PRisonBreak/java-cell-01/pull/101',
              user: { login: 'octocat', id: 583231 },
              head: { ref: 'patch-1' },
              base: { ref: 'main' },
              created_at: now,
              updated_at: now,
            },
          };
          break;

        case 'invalid_sig':
          headers['x-github-delivery'] = `test_bad_sig_${Date.now()}`;
          headers['x-github-event'] = 'pull_request';
          headers['x-hub-signature-256'] = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
          payload = {
            action: 'opened',
            repository: { name: 'java-cell-01', full_name: 'PRisonBreak/java-cell-01' },
          };
          break;

        case 'duplicate':
          // Re-use an existing delivery if available
          const existingDelivery = events[0]?.deliveryId || `duplicate_key_12345`;
          headers['x-github-delivery'] = existingDelivery;
          headers['x-github-event'] = 'pull_request';
          payload = {
            action: 'opened',
            repository: { name: 'java-cell-01', full_name: 'PRisonBreak/java-cell-01' },
            pull_request: { number: 99, title: 'Duplicate test' },
          };
          break;

        case 'unregistered_repo':
          headers['x-github-delivery'] = `test_unregistered_${Date.now()}`;
          headers['x-github-event'] = 'pull_request';
          payload = {
            action: 'opened',
            repository: {
              name: 'unknown-repo-xyz',
              full_name: 'RandomOrg/unknown-repo-xyz',
            },
            pull_request: { number: 1, title: 'PR in unregistered repo' },
          };
          break;

        case 'inactive_repo':
          headers['x-github-delivery'] = `test_inactive_${Date.now()}`;
          headers['x-github-event'] = 'pull_request';
          payload = {
            action: 'opened',
            repository: {
              name: 'inactive-cell-demo',
              full_name: 'PRisonBreak/inactive-cell-demo',
            },
            pull_request: { number: 42, title: 'PR in inactive repo' },
          };
          break;
      }

      const response = await fetch('/api/github/webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ status: response.status }));
      setSimulationResult({
        scenario,
        httpStatus: response.status,
        response: data,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setSimulationResult({
        scenario,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSimulationRunning(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'pull_request':
        return <GitPullRequest size={13} className="text-purple-400" />;
      case 'pull_request_review':
        return <CheckSquare size={13} className="text-emerald-400" />;
      case 'issues':
        return <AlertCircle size={13} className="text-amber-400" />;
      case 'check_run':
      case 'check_suite':
        return <GitCommit size={13} className="text-blue-400" />;
      default:
        return <Radio size={13} className="text-slate-400" />;
    }
  };

  // Filter and search
  const filteredEvents = events.filter((ev) => {
    if (statusFilter !== 'ALL' && ev.processingStatus !== statusFilter) return false;
    if (typeFilter !== 'ALL' && ev.eventType !== typeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDelivery = ev.deliveryId?.toLowerCase().includes(q);
      const matchRepo = (ev.repositoryFullName || ev.repositoryId || '').toLowerCase().includes(q);
      const matchEvent = ev.eventType?.toLowerCase().includes(q);
      const matchAction = ev.action?.toLowerCase().includes(q);
      if (!matchDelivery && !matchRepo && !matchEvent && !matchAction) return false;
    }

    return true;
  });

  const totalCount = events.length;
  const processedCount = events.filter((e) => e.processingStatus === 'PROCESSED').length;
  const ignoredCount = events.filter((e) => e.processingStatus === 'IGNORED').length;
  const failedCount = events.filter((e) => e.processingStatus === 'FAILED').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio size={20} className="text-emerald-400" />
            <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide">
              Webhook Events
            </h1>
          </div>
          <p className="font-mono text-xs text-slate-500">
            Real-time GitHub App delivery audit, signature verification, and event intake stream
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSimulateModal(true)}
            className="btn btn-ghost border border-slate-700 hover:border-slate-600 text-xs font-mono text-slate-200"
          >
            <Play size={13} className="text-emerald-400" />
            Test Webhook Scenarios
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 flex items-center gap-2 text-rose-300 font-mono text-xs">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Counters */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-4 py-2.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2.5 ${
            statusFilter === 'ALL'
              ? 'border-emerald-500/50 bg-emerald-500/10 text-white shadow-sm'
              : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <span className="font-display text-lg font-bold">{totalCount}</span>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            Total Deliveries
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('PROCESSED')}
          className={`px-4 py-2.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2.5 ${
            statusFilter === 'PROCESSED'
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm'
              : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <span className="font-display text-lg font-bold text-emerald-400">{processedCount}</span>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            PROCESSED
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('IGNORED')}
          className={`px-4 py-2.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2.5 ${
            statusFilter === 'IGNORED'
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-sm'
              : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <span className="font-display text-lg font-bold text-amber-400">{ignoredCount}</span>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            IGNORED
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('FAILED')}
          className={`px-4 py-2.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2.5 ${
            statusFilter === 'FAILED'
              ? 'border-rose-500/50 bg-rose-500/15 text-rose-300 shadow-sm'
              : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <span className="font-display text-lg font-bold text-rose-400">{failedCount}</span>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            FAILED
          </span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by delivery ID, repo, event type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="prison-input pl-9 pr-3 py-1.5 text-xs font-mono w-full"
          />
        </div>

        {/* Event Type Filter */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-500">Event:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="prison-input py-1.5 px-3 text-xs font-mono bg-slate-900 border-slate-800 text-slate-300"
          >
            <option value="ALL">All Event Types</option>
            <option value="pull_request">pull_request</option>
            <option value="pull_request_review">pull_request_review</option>
            <option value="issues">issues</option>
            <option value="check_run">check_run</option>
            <option value="check_suite">check_suite</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingState message="SUBSCRIBING TO GITHUB WEBHOOK TELEMETRY STREAM..." />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No Webhook Events Recorded"
            description="When GitHub triggers webhook events for your cell repositories, normalized deliveries will appear here live."
            icon={<Radio size={32} />}
            action={
              <button
                onClick={() => setShowSimulateModal(true)}
                className="btn btn-primary"
              >
                <Play size={13} />
                Send Test Webhook
              </button>
            }
          />
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-slate-500">
            No webhook deliveries match the current filter or search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="prison-table w-full">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60">
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Delivery ID
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Event Type
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Action
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Repository
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Status
                  </th>
                  <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Received At
                  </th>
                  <th className="text-right font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEvents.map((ev) => {
                  const shortId = ev.deliveryId.length > 14
                    ? `${ev.deliveryId.slice(0, 10)}...${ev.deliveryId.slice(-4)}`
                    : ev.deliveryId;

                  return (
                    <tr
                      key={ev.deliveryId}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedEvent(ev)}
                    >
                      {/* 1. Delivery ID */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-semibold">{shortId}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(ev.deliveryId, ev.deliveryId);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-1 rounded"
                            title="Copy full delivery ID"
                          >
                            {copiedId === ev.deliveryId ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 2. Event Type */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60 text-slate-200">
                          {getEventIcon(ev.eventType)}
                          <span>{ev.eventType}</span>
                        </div>
                      </td>

                      {/* 3. Action */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="text-slate-300 font-medium">
                          {ev.action || '—'}
                        </span>
                      </td>

                      {/* 4. Repository */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="text-slate-300 truncate max-w-xs block">
                          {ev.repositoryFullName || ev.repositoryId || '—'}
                        </span>
                      </td>

                      {/* 5. Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={ev.processingStatus} />
                      </td>

                      {/* 6. Received At */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {new Date(ev.receivedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}{' '}
                        <span className="text-[11px] text-slate-500">
                          ({new Date(ev.receivedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                        </span>
                      </td>

                      {/* 7. Details / Inspect */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(ev)}
                          className="btn btn-ghost py-1 px-2.5 text-xs font-mono text-slate-300 hover:text-white"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspector Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div
            className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="font-display text-base font-bold text-white tracking-wide">
                    Delivery Inspection
                  </h2>
                  <StatusBadge status={selectedEvent.processingStatus} />
                </div>
                <div className="font-mono text-xs text-slate-400 flex items-center gap-2">
                  <span>ID: {selectedEvent.deliveryId}</span>
                  <button
                    onClick={() => handleCopy(selectedEvent.deliveryId, 'modal_id')}
                    className="p-0.5 text-slate-500 hover:text-slate-300"
                    title="Copy delivery ID"
                  >
                    {copiedId === 'modal_id' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error or Ignored banner */}
            {selectedEvent.error && (
              <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 font-mono text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Processing Notice:</div>
                  <div>{selectedEvent.error}</div>
                </div>
              </div>
            )}

            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Event Type</span>
                <span className="font-bold text-white">{selectedEvent.eventType}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Action</span>
                <span className="font-bold text-white">{selectedEvent.action || '—'}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Repository</span>
                <span className="font-bold text-white truncate block" title={selectedEvent.repositoryFullName}>
                  {selectedEvent.repositoryFullName || '—'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Received At</span>
                <span className="font-bold text-slate-300">
                  {new Date(selectedEvent.receivedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Normalized Data View */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                    <Code2 size={14} className="text-emerald-400" />
                    <span>Normalized Event Data</span>
                  </h3>
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(selectedEvent.normalizedData, null, 2), 'normalized_copy')
                    }
                    className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedId === 'normalized_copy' ? (
                      <>
                        <Check size={12} className="text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy Normalized JSON
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto max-h-56 leading-relaxed">
                  {JSON.stringify(selectedEvent.normalizedData || {}, null, 2)}
                </pre>
              </div>

              {/* Raw Payload Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                    <Terminal size={14} className="text-blue-400" />
                    <span>Raw Webhook Payload</span>
                  </h3>
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(selectedEvent.rawPayload, null, 2), 'raw_copy')
                    }
                    className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedId === 'raw_copy' ? (
                      <>
                        <Check size={12} className="text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy Raw JSON
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                  {JSON.stringify(selectedEvent.rawPayload || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test & Simulation Modal */}
      {showSimulateModal && (
        <div className="modal-overlay" onClick={() => setShowSimulateModal(false)}>
          <div
            className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Terminal size={16} />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-white">
                    Test Webhook Scenarios
                  </h2>
                  <p className="font-mono text-[10px] text-slate-500">
                    Verify idempotency, signature checking, and repository filtering
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="my-5 space-y-3">
              <p className="font-mono text-xs text-slate-400 leading-relaxed">
                Click any scenario below to send an event directly through the backend webhook handler (`/api/github/webhook`) and verify the resulting Firestore status:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={simulationRunning}
                  onClick={() => handleSimulateWebhook('valid_pr')}
                  className="p-3 text-left rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 transition-all font-mono text-xs group"
                >
                  <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>1. Valid Webhook</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Test PR opened in a registered repository. Should record as `PROCESSED`.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={simulationRunning}
                  onClick={() => handleSimulateWebhook('invalid_sig')}
                  className="p-3 text-left rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/60 transition-all font-mono text-xs group"
                >
                  <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                    <XCircle size={13} />
                    <span>2. Invalid Signature</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Webhook with tampered HMAC digest. Should return 401 Unauthorized.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={simulationRunning}
                  onClick={() => handleSimulateWebhook('duplicate')}
                  className="p-3 text-left rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all font-mono text-xs group"
                >
                  <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                    <RefreshCw size={13} />
                    <span>3. Duplicate Delivery</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Re-delivers an existing delivery ID. Idempotency must safely ignore it.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={simulationRunning}
                  onClick={() => handleSimulateWebhook('unregistered_repo')}
                  className="p-3 text-left rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/60 transition-all font-mono text-xs group"
                >
                  <div className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    <span>4. Unregistered Repo</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Webhook from repository not linked to event. Should record as `IGNORED`.
                  </div>
                </button>

                <button
                  type="button"
                  disabled={simulationRunning}
                  onClick={() => handleSimulateWebhook('inactive_repo')}
                  className="p-3 text-left rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/60 transition-all font-mono text-xs group sm:col-span-2"
                >
                  <div className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    <span>5. Inactive Repo</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-normal">
                    Webhook from an inactive repository. Should record as `IGNORED`.
                  </div>
                </button>
              </div>

              {/* Simulation Result Output */}
              {simulationRunning && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center gap-2 font-mono text-xs text-slate-400">
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                  <span>Dispatching simulated webhook...</span>
                </div>
              )}

              {simulationResult && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span>Result: Scenario "{simulationResult.scenario}"</span>
                    <span
                      className={
                        simulationResult.httpStatus === 200 || simulationResult.httpStatus === 201
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      HTTP {simulationResult.httpStatus || 'ERROR'}
                    </span>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-300 text-[11px] overflow-x-auto max-h-40">
                    {JSON.stringify(simulationResult.response || simulationResult.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="btn btn-ghost text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
