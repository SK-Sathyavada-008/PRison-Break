// ─────────────────────────────────────────────
// RepositoryCard — Clean Repository Cell Card
// ─────────────────────────────────────────────

import { ExternalLink, GitBranch, Star, Code2, Trash2, Power, RefreshCw } from 'lucide-react';
import type { Repository } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface RepositoryCardProps {
  repository: Repository;
  onToggleStatus?: (id: string, newActive: boolean) => void;
  onDelete?: (repo: Repository) => void;
  onSync?: (repo: Repository) => void;
}

export default function RepositoryCard({
  repository,
  onToggleStatus,
  onDelete,
  onSync,
}: RepositoryCardProps) {
  const isActive = repository.active ?? (repository.status === 'active');

  return (
    <div className="card p-5 group relative transition-all duration-200 hover:-translate-y-0.5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Code2 size={16} className={isActive ? 'text-emerald-400 shrink-0' : 'text-slate-500 shrink-0'} />
            <h3 className="font-bold text-sm text-white truncate">
              {repository.name}
            </h3>
            {(() => {
              const match = repository.name.match(/squard_?(\d+)/i) || (repository.fullName || '').match(/squard_?(\d+)/i);
              if (!match) return null;
              return (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#FF0A3B]/10 border border-[#FF0A3B]/30 text-[#FF5470] shrink-0">
                  Squad {match[1]}
                </span>
              );
            })()}
          </div>
          <div className="font-mono text-xs text-slate-400 truncate">
            {repository.owner}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <StatusBadge status={isActive ? 'active' : 'inactive'} />
          {onToggleStatus && (
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => onToggleStatus(repository.id, !isActive)}
              title={`Click to ${isActive ? 'deactivate' : 'activate'}`}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Description / Full Name */}
      <p className="text-xs font-mono text-slate-400 mb-3 truncate">
        {repository.fullName ?? `${repository.owner}/${repository.name}`}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 text-xs font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <GitBranch size={13} className="text-purple-400" />
          <span>{repository.prs ?? 0} PRs</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Star size={13} className="text-amber-400" />
          <span>{repository.stars ?? 0} stars</span>
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
        <a
          href={repository.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink size={12} />
          <span>Open GitHub</span>
        </a>
        <div className="flex items-center gap-1.5">
          {onSync && (
            <button
              type="button"
              onClick={() => onSync(repository)}
              title="Sync Pull Requests"
              className="p-1.5 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {onToggleStatus && (
            <button
              type="button"
              onClick={() => onToggleStatus(repository.id, !isActive)}
              title={isActive ? 'Deactivate' : 'Activate'}
              className={`p-1.5 rounded transition-colors ${
                isActive
                  ? 'text-amber-400 hover:bg-amber-400/10'
                  : 'text-emerald-400 hover:bg-emerald-400/10'
              }`}
            >
              <Power size={13} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(repository)}
              title="Unregister Repository"
              className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
