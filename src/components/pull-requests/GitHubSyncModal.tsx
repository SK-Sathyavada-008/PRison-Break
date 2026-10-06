// ─────────────────────────────────────────────
// GitHubSyncModal — Instant Pull Request Synchronization Modal
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Key,
  FolderGit2,
} from 'lucide-react';
import { githubSyncService, type GitHubSyncResult } from '../../services/githubSyncService';
import { repositoryService } from '../../services/repositoryService';
import { parseAndNormalizeGithubUrl } from '../../utils/githubUrl';
import type { Repository } from '../../types';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRepoFullName?: string;
}

export default function GitHubSyncModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRepoFullName,
}: GitHubSyncModalProps) {
  const [syncTarget, setSyncTarget] = useState<'all' | 'custom'>('all');
  const [customRepoInput, setCustomRepoInput] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    summary: string;
    syncedPRs: number;
    results: GitHubSyncResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      repositoryService.getRepositories().then(setRepositories).catch(() => {});
      if (defaultRepoFullName) {
        setSyncTarget('custom');
        setCustomRepoInput(defaultRepoFullName);
      } else {
        setSyncTarget('all');
      }
      setResult(null);
      setError(null);
    }
  }, [isOpen, defaultRepoFullName]);

  if (!isOpen) return null;

  const handleSync = async () => {
    setError(null);
    setResult(null);
    setSyncing(true);

    try {
      if (syncTarget === 'custom') {
        const trimmed = customRepoInput.trim();
        if (!trimmed) {
          setError('Please enter a GitHub repository URL or owner/repository.');
          setSyncing(false);
          return;
        }

        let owner = '';
        let repo = '';

        if (trimmed.includes('/') && !trimmed.includes('http')) {
          const parts = trimmed.split('/');
          owner = parts[0].trim();
          repo = parts[1].trim();
        } else {
          const parsed = parseAndNormalizeGithubUrl(trimmed);
          if (!parsed.success) {
            setError(parsed.error);
            setSyncing(false);
            return;
          }
          owner = parsed.data.owner;
          repo = parsed.data.name;
        }

        const res = await githubSyncService.syncRepository(owner, repo, {
          githubToken: githubToken.trim() || undefined,
        });

        if (!res.success) {
          setError(res.message);
        } else {
          setResult({
            summary: res.message,
            syncedPRs: res.syncedCount,
            results: [res],
          });
          if (onSuccess) onSuccess();
        }
      } else {
        // Sync all registered repositories
        const res = await githubSyncService.syncAllRegisteredRepositories({
          githubToken: githubToken.trim() || undefined,
        });

        if (res.totalRepos === 0) {
          setError('No active repositories registered. Add a repository or sync a specific repository below.');
        } else {
          setResult({
            summary: `Synced ${res.totalSyncedPRs} Pull Requests across ${res.totalRepos} repositories.`,
            syncedPRs: res.totalSyncedPRs,
            results: res.results,
          });
          if (onSuccess) onSuccess();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Sync failed unexpectedly.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={syncing ? undefined : onClose}>
      <div
        className="modal-box max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-100 tracking-wide">
                Sync Pull Requests from GitHub
              </h2>
              <p className="font-mono text-xs text-slate-500 mt-0.5">
                Pulls all open, closed, and merged PRs directly via GitHub API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Target Selector */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/80 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setSyncTarget('all')}
              className={`py-2 px-3 rounded-md font-mono text-xs transition-all flex items-center justify-center gap-2 ${
                syncTarget === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderGit2 size={14} />
              <span>All Registered Repos ({repositories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncTarget('custom')}
              className={`py-2 px-3 rounded-md font-mono text-xs transition-all flex items-center justify-center gap-2 ${
                syncTarget === 'custom'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitPullRequest size={14} />
              <span>Specific Repo</span>
            </button>
          </div>

          {syncTarget === 'custom' && (
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-slate-400 mb-1.5">
                GitHub Repository
              </label>
              <input
                type="text"
                placeholder="e.g. PRisonBreak/challenge-cell-01 or full URL"
                value={customRepoInput}
                onChange={(e) => setCustomRepoInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <p className="font-mono text-[11px] text-slate-500 mt-1">
                Enter either <code>owner/repository</code> or full GitHub URL.
              </p>
            </div>
          )}

          {/* Optional GitHub Token */}
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
              <Key size={13} className="text-amber-400" />
              <span>GitHub Token (Optional)</span>
            </div>
            <input
              type="password"
              placeholder="ghp_... (Leave blank for public repositories)"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-slate-600"
            />
            <p className="font-mono text-[10px] text-slate-500">
              Only required for private repositories or to exceed 60 requests/hour unauthenticated limit.
            </p>
          </div>

          {/* Feedback states */}
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-start gap-2.5 text-red-400 font-mono text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{result.summary}</span>
              </div>
              {result.results.map((r, i) => (
                <div key={i} className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between items-center">
                  <span className="font-semibold text-slate-200">{r.repoFullName}</span>
                  <div className="flex gap-2 text-[10px]">
                    <span className="text-purple-400">{r.mergedCount} merged</span>
                    <span className="text-emerald-400">{r.autoApprovedCount} auto-approved</span>
                    <span className="text-amber-400">{r.pendingCount} pending</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 font-mono text-xs hover:bg-slate-800/60 transition-colors"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-900/20"
          >
            {syncing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Syncing PRs...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>{result ? 'Sync Again' : 'Sync Now'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
