// ─────────────────────────────────────────────
// ScoreEventTable — Clean Score Events History
// ─────────────────────────────────────────────

import { Hash, Clock } from 'lucide-react';
import type { ScoreEvent } from '../../types';

interface ScoreEventTableProps {
  events: ScoreEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  'PR Merged':          'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  'PR Opened':          'text-blue-300 bg-blue-500/15 border-blue-500/30',
  'PR Review':          'text-purple-300 bg-purple-500/15 border-purple-500/30',
  'Issue Reported':     'text-amber-300 bg-amber-500/15 border-amber-500/30',
  'Documentation PR':   'text-slate-300 bg-slate-500/15 border-slate-500/30',
  'First Escape Bonus': 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
};

function EventBadge({ event }: { event: string }) {
  const color = EVENT_COLORS[event] ?? 'text-slate-300 bg-slate-500/15 border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      {event}
    </span>
  );
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ScoreEventTable({ events }: ScoreEventTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="prison-table">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Event Action</th>
            <th>Points Awarded</th>
            <th>PR</th>
            <th>Issue</th>
            <th>Repository</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {events.map((e) => (
            <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
              {/* Participant */}
              <td>
                <div>
                  <div className="text-sm font-semibold text-white">{e.participantName}</div>
                  <div className="font-mono text-xs text-slate-400">@{e.githubUsername}</div>
                </div>
              </td>

              {/* Event */}
              <td>
                <EventBadge event={e.event} />
              </td>

              {/* Points */}
              <td>
                <span className={`font-mono text-sm font-bold ${e.points > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {e.points > 0 ? `+${e.points} XP` : `${e.points} XP`}
                </span>
              </td>

              {/* PR */}
              <td>
                {e.prNumber ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-blue-400">
                    <Hash size={11} /> {e.prNumber}
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </td>

              {/* Issue */}
              <td>
                {e.issueNumber ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400">
                    <Hash size={11} /> {e.issueNumber}
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </td>

              {/* Repository */}
              <td>
                {e.repository ? (
                  <span className="font-mono text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    {e.repository}
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </td>

              {/* Timestamp */}
              <td>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400">
                  <Clock size={11} className="text-slate-500" />
                  {formatTime(e.timestamp)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
