// ─────────────────────────────────────────────
// RepositoryTable — Admin Repository List
// ─────────────────────────────────────────────

import { useState } from 'react';
import { ExternalLink, Trash2, Power, Code2, RefreshCw } from 'lucide-react';
import type { Repository } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface RepositoryTableProps {
  repositories: Repository[];
  onToggleStatus: (id: string, newActive: boolean) => Promise<void>;
  onDelete: (repo: Repository) => void;
  onSync?: (repo: Repository) => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function RepositoryTable({
  repositories,
  onToggleStatus,
  onDelete,
  onSync,
}: RepositoryTableProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (repo: Repository) => {
    const currentActive = repo.active ?? (repo.status === 'active');
    try {
      setTogglingId(repo.id);
      await onToggleStatus(repo.id, !currentActive);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-900/40">
      <table className="prison-table w-full">
        <thead>
          <tr className="border-b border-slate-800/80">
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Repository
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Owner
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              GitHub URL
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Status
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Created
            </th>
            <th className="text-right font-mono text-[11px] uppercase tracking-wider text-slate-400 py-3.5 px-4">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {repositories.map((repo) => {
            const isActive = repo.active ?? (repo.status === 'active');
            const isToggling = togglingId === repo.id;

            return (
              <tr
                key={repo.id}
                className="hover:bg-slate-800/30 transition-colors group"
              >
                {/* 1. Repository */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                      }`}
                    >
                      <Code2 size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-100 truncate group-hover:text-emerald-300 transition-colors">
                        {repo.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 truncate">
                        {repo.fullName ?? `${repo.owner}/${repo.name}`}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 2. Owner */}
                <td className="py-3.5 px-4">
                  <div className="font-mono text-xs text-slate-300">
                    {repo.owner}
                  </div>
                </td>

                {/* 3. GitHub URL */}
                <td className="py-3.5 px-4 max-w-xs">
                  <a
                    href={repo.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400 hover:text-emerald-400 truncate transition-colors"
                    title={repo.githubUrl}
                  >
                    <span className="truncate">{repo.githubUrl}</span>
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                </td>

                {/* 4. Status */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={isActive ? 'active' : 'inactive'} />
                    {/* Inline Status Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      disabled={isToggling}
                      onClick={() => handleToggle(repo)}
                      title={`Click to ${isActive ? 'deactivate' : 'activate'}`}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                        isActive ? 'bg-emerald-500' : 'bg-slate-700'
                      } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </td>

                {/* 5. Created */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-mono text-xs text-slate-400">
                    {formatDate(repo.createdAt ?? repo.addedAt)}
                  </span>
                </td>

                {/* 6. Actions */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Sync PRs Action */}
                    {onSync && (
                      <button
                        type="button"
                        onClick={() => onSync(repo)}
                        className="p-1.5 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1 text-xs font-mono"
                        title="Sync pull requests from this repository"
                      >
                        <RefreshCw size={13} />
                        <span className="hidden sm:inline">Sync PRs</span>
                      </button>
                    )}

                    {/* Open GitHub Action */}
                    <a
                      href={repo.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1 text-xs font-mono"
                      title="Open in GitHub"
                    >
                      <ExternalLink size={14} />
                      <span className="hidden sm:inline">GitHub</span>
                    </a>

                    {/* Activate / Deactivate Action */}
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggle(repo)}
                      className={`p-1.5 rounded-md transition-colors inline-flex items-center gap-1 text-xs font-mono ${
                        isActive
                          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                          : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10'
                      }`}
                      title={isActive ? 'Deactivate repository' : 'Activate repository'}
                    >
                      <Power size={14} />
                      <span className="hidden md:inline">
                        {isActive ? 'Deactivate' : 'Activate'}
                      </span>
                    </button>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={() => onDelete(repo)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors inline-flex items-center gap-1 text-xs font-mono"
                      title="Unregister repository from PRison Control"
                    >
                      <Trash2 size={14} />
                      <span className="hidden md:inline">Delete</span>
                    </button>
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
