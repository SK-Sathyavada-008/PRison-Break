// ─────────────────────────────────────────────
// ParticipantTable — Admin Participants List
// ─────────────────────────────────────────────

import { Zap, GitMerge, GitPullRequest, ExternalLink, Shield, User, Power, Plus } from 'lucide-react';
import type { Participant } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface ParticipantTableProps {
  participants: Participant[];
  onSelectParticipant?: (participant: Participant) => void;
  onToggleStatus?: (id: string, active: boolean) => void;
  onQuickScore?: (participant: Participant, delta: number) => void;
}

export default function ParticipantTable({
  participants,
  onSelectParticipant,
  onToggleStatus,
  onQuickScore,
}: ParticipantTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="prison-table w-full">
        <thead>
          <tr className="border-b border-slate-800/80">
            <th className="w-14 text-center font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-3">
              #
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Prisoner Name
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              GitHub
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              XP Score
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              PRs
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Merged
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Cells
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Status
            </th>
            <th className="text-right font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {participants.map((p, idx) => {
            const isActive = p.active ?? (p.status !== 'inactive');

            return (
              <tr
                key={p.id}
                className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                onClick={() => onSelectParticipant?.(p)}
              >
                {/* 1. Rank */}
                <td className="text-center font-mono py-3.5 px-3">
                  <span
                    className={`text-xs font-bold ${
                      idx === 0
                        ? 'text-amber-400'
                        : idx === 1
                        ? 'text-slate-300'
                        : idx === 2
                        ? 'text-amber-600'
                        : 'text-slate-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                </td>

                {/* 2. Prisoner Name */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name}
                        className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {p.name[0]}
                      </div>
                    )}
                    <span className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors truncate">
                      {p.name}
                    </span>
                  </div>
                </td>

                {/* 3. GitHub Username */}
                <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`https://github.com/${p.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    @{p.githubUsername}
                    <ExternalLink size={10} />
                  </a>
                </td>

                {/* 4. XP Score */}
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-sm font-bold">
                    <Zap size={12} className="fill-emerald-400/20" />
                    {(p.totalScore ?? p.xp).toLocaleString()}
                  </span>
                </td>

                {/* 5. PRs */}
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 text-blue-400 font-mono text-xs">
                    <GitPullRequest size={12} />
                    {p.prCount ?? p.prs}
                  </span>
                </td>

                {/* 6. Merged */}
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 text-purple-400 font-mono text-xs font-semibold">
                    <GitMerge size={12} />
                    {p.mergedPrCount ?? p.mergedPRs}
                  </span>
                </td>

                {/* 7. Cells */}
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 text-cyan-400 font-mono text-xs font-semibold">
                    <Shield size={12} />
                    {p.escapedCells}
                  </span>
                </td>

                {/* 8. Status */}
                <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={isActive ? 'active' : 'inactive'} />
                    {onToggleStatus && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        onClick={() => onToggleStatus(p.id, !isActive)}
                        title={`Click to ${isActive ? 'deactivate' : 'activate'}`}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isActive ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isActive ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </td>

                {/* 9. Actions */}
                <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    {/* View Profile Button */}
                    <button
                      type="button"
                      onClick={() => onSelectParticipant?.(p)}
                      className="p-1.5 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                      title="View Dossier & Score History"
                    >
                      <User size={13} />
                      <span className="hidden sm:inline">Profile</span>
                    </button>

                    {/* Quick Dev Test Score (+50 XP) */}
                    {onQuickScore && (
                      <button
                        type="button"
                        onClick={() => onQuickScore(p, 50)}
                        className="p-1.5 rounded text-xs font-mono text-emerald-400 hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1"
                        title="Dev Test: Award +50 XP (verify live leaderboard in real-time)"
                      >
                        <Plus size={12} />
                        <span>50 XP</span>
                      </button>
                    )}

                    {/* Deactivate/Activate toggle */}
                    {onToggleStatus && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(p.id, !isActive)}
                        className={`p-1.5 rounded transition-colors ${
                          isActive
                            ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={isActive ? 'Deactivate participant' : 'Activate participant'}
                      >
                        <Power size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
