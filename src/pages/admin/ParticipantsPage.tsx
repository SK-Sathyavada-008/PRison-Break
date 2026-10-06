// ─────────────────────────────────────────────
// Admin Participants Page — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Users, UserPlus, X, AlertCircle, Search, CheckCircle2, Shield, Flame } from 'lucide-react';
import type { Participant } from '../../types';
import { participantService } from '../../services/participantService';
import ParticipantTable from '../../components/participants/ParticipantTable';
import ParticipantProfileModal from '../../components/participants/ParticipantProfileModal';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  // New Participant form state
  const [name, setName] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsub = participantService.subscribeToLeaderboard(
      (data) => {
        setParticipants(data);
        setLoading(false);
        setError(null);
        // If profile modal is open, keep selected participant in sync
        if (selectedParticipant) {
          const updated = data.find((p) => p.id === selectedParticipant.id);
          if (updated) setSelectedParticipant(updated);
        }
      },
      (err) => {
        console.error('[ParticipantsPage] Error:', err);
        setError('Failed to fetch participants from Firestore');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedParticipant?.id]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !githubUsername.trim()) {
      setFormError('Please enter both name and GitHub username');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const cleanUsername = githubUsername.trim().replace(/^@/, '');

      await participantService.saveParticipant({
        name: name.trim(),
        githubUsername: cleanUsername,
        totalScore: 0,
        prCount: 0,
        mergedPrCount: 0,
        escapedCells: 0,
        firstSuccessfulPr: null,
        active: true,
      });

      setSuccessMessage(`Prisoner "${name.trim()}" registered successfully!`);
      setName('');
      setGithubUsername('');
      setShowAddModal(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save prisoner to Firestore');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, active: boolean) => {
    try {
      setError(null);
      await participantService.toggleParticipantStatus(id, active);
      setSuccessMessage(`Participant ${active ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleQuickScore = async (p: Participant, delta: number) => {
    try {
      setError(null);
      await participantService.adjustParticipantScore(
        p.id,
        delta,
        `Quick dev test award (+${delta} XP)`
      );
      setSuccessMessage(`Awarded +${delta} XP to ${p.name}! Live leaderboard updated.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update score');
    }
  };

  // Filter participants by search query (name or githubUsername) and status
  const filteredParticipants = participants.filter((p) => {
    const isActive = p.active ?? (p.status !== 'inactive');
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'inactive' && isActive) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchGithub = p.githubUsername.toLowerCase().includes(q);
      if (!matchName && !matchGithub) return false;
    }

    return true;
  });

  const activeCount = participants.filter((p) => p.active ?? (p.status !== 'inactive')).length;
  const inactiveCount = participants.filter((p) => (p.active === false) || (p.status === 'inactive')).length;
  const escapedCount = participants.filter((p) => p.escapedCells > 0).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide mb-1">
            Participants
          </h1>
          <p className="font-mono text-xs text-slate-500">
            Registered event prisoners & real-time leaderboard telemetry
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={14} />
          Add Participant
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-emerald-300 font-mono text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-rose-300 font-mono text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dev Score Testing Banner */}
      <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs font-mono text-slate-400 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame size={15} className="text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300">Live Telemetry Testing:</strong> Use the <span className="text-emerald-400">+50 XP</span> buttons or open any prisoner's profile to test score updates and watch the public projector leaderboard update in real time without refreshing.
          </span>
        </div>
      </div>

      {/* Summary Pills & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Metric Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
              statusFilter === 'all'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="font-bold">{participants.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Total</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
              statusFilter === 'active'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="font-bold text-emerald-400">{activeCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Active</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
              statusFilter === 'inactive'
                ? 'border-slate-600 bg-slate-800 text-slate-200'
                : 'border-slate-800/80 bg-slate-900/40 text-slate-500 hover:bg-slate-800/60'
            }`}
          >
            <span className="font-bold text-slate-400">{inactiveCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Inactive</span>
          </button>

          <div className="px-3 py-1.5 rounded-lg border border-slate-800/80 bg-slate-900/40 text-xs font-mono flex items-center gap-2 text-cyan-400">
            <Shield size={12} />
            <span className="font-bold">{escapedCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Escaped</span>
          </div>
        </div>

        {/* Search by Name or GitHub Username */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or @github..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="prison-input pl-9 pr-3 py-1.5 text-xs font-mono w-full"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingState message="FETCHING CELL BLOCK INMATES..." />
          </div>
        ) : participants.length === 0 ? (
          <EmptyState
            title="No Prisoners In Custody"
            description="No prisoners have registered yet. Manually register a participant to get started."
            icon={<Users size={28} />}
            action={
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                <UserPlus size={14} /> Add Participant
              </button>
            }
          />
        ) : filteredParticipants.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-slate-500">
            No participants match the search query "{searchQuery}".
          </div>
        ) : (
          <ParticipantTable
            participants={filteredParticipants}
            onSelectParticipant={(p) => setSelectedParticipant(p)}
            onToggleStatus={handleToggleStatus}
            onQuickScore={handleQuickScore}
          />
        )}
      </div>

      {/* Participant Profile Modal */}
      <ParticipantProfileModal
        participant={selectedParticipant}
        isOpen={!!selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
        onStatusChanged={(id, active) => handleToggleStatus(id, active)}
        onScoreAdjusted={() => {
          // Score adjusted in real time
        }}
      />

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-100">
                    Register Participant
                  </h2>
                  <p className="font-mono text-[10px] text-slate-500">
                    Manually add a prisoner to PRison Control
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div>
                <label className="block font-mono text-[11px] text-slate-300 uppercase tracking-wider mb-1 font-semibold">
                  Prisoner Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="prison-input text-xs font-mono"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-slate-300 uppercase tracking-wider mb-1 font-semibold">
                  GitHub Username <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                    @
                  </span>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="github_handle"
                    className="prison-input text-xs font-mono pl-7"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !name.trim() || !githubUsername.trim()}
                >
                  {submitting ? 'Registering...' : 'Register Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
