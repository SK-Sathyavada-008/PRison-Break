// ─────────────────────────────────────────────
// Admin Score Events Page — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import type { ScoreEvent } from '../../types';
import { scoreEventService } from '../../services/scoreEventService';
import ScoreEventTable from '../../components/score-events/ScoreEventTable';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

export default function ScoreEventsPage() {
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = scoreEventService.subscribeToScoreEvents(
      (data) => {
        setEvents(data);
        setLoading(false);
        setError(null);
      },
      50,
      (err) => {
        console.error('[ScoreEventsPage] Error:', err);
        setError('Failed to fetch score events from Firestore');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const totalXP = events.reduce((sum, e) => sum + e.points, 0);
  const prMergeEvents = events.filter(e => (e.event && e.event.includes('Merge')) || e.type === 'MERGE_PR').length;
  const bonusEvents = events.filter(e => e.event && e.event.includes('Bonus')).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide mb-1">Score Events</h1>
        <p className="font-mono text-xs text-slate-500">History of all XP awarded during the event</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-400 font-mono text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total Events', value: events.length,    color: 'text-slate-400' },
          { label: 'Total XP',     value: `${totalXP}`,     color: 'text-emerald-400' },
          { label: 'PR Merges',    value: prMergeEvents,    color: 'text-purple-400' },
          { label: 'Bonuses',      value: bonusEvents,      color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="px-4 py-2.5 rounded-lg border border-slate-800/60 bg-slate-900/40 flex items-center gap-2">
            <span className={`font-display text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <span className="font-mono text-xs text-slate-400 tracking-wide">
            {events.length} Score Events — Most Recent First
          </span>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingState message="PARSING EVENT LEDGER..." />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No Score Events Logged"
            description="Score events will appear here as PRs are reviewed and merged."
            icon={<Zap size={28} />}
          />
        ) : (
          <ScoreEventTable events={events} />
        )}
      </div>
    </div>
  );
}
