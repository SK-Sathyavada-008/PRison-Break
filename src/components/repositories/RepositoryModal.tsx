// ─────────────────────────────────────────────
// RepositoryModal — Add Repository Modal
// ─────────────────────────────────────────────

import { useState } from 'react';
import { X, Plus, AlertCircle, Loader2, GitBranch, CheckCircle2, RefreshCw } from 'lucide-react';
import { parseAndNormalizeGithubUrl } from '../../utils/githubUrl';
import { repositoryService } from '../../services/repositoryService';
import { githubSyncService } from '../../services/githubSyncService';
import type { FirestoreRepository } from '../../types';

function GithubIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

interface RepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newRepo: FirestoreRepository) => void;
}

export default function RepositoryModal({ isOpen, onClose, onSuccess }: RepositoryModalProps) {
  const [url, setUrl] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time preview parse
  const parsedPreview = url.trim() ? parseAndNormalizeGithubUrl(url) : null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    // 1. Validate & Parse URL
    const parseResult = parseAndNormalizeGithubUrl(url);
    if (!parseResult.success) {
      setError(parseResult.error);
      return;
    }

    const { owner, name, fullName, githubUrl } = parseResult.data;

    try {
      setSubmitting(true);

      // 2. Check Firestore and add repository
      const createdRepo = await repositoryService.addRepository({
        owner,
        name,
        fullName,
        githubUrl,
        active: true,
      });

      // 3. Automatically sync PRs if enabled
      if (autoSync) {
        setStatusMessage(`Syncing Pull Requests from ${fullName}...`);
        try {
          await githubSyncService.syncRepository(owner, name);
        } catch (syncErr) {
          console.warn('[RepositoryModal] Initial PR sync warning:', syncErr);
        }
      }

      // 4. Reset and notify parent
      setUrl('');
      setError(null);
      setStatusMessage(null);
      onSuccess(createdRepo);
      onClose();
    } catch (err: any) {
      console.error('[RepositoryModal] Error adding repository:', err);
      setError(err?.message || 'Failed to register repository. Please try again.');
    } finally {
      setSubmitting(false);
      setStatusMessage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !submitting) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={submitting ? undefined : onClose} onKeyDown={handleKeyDown}>
      <div
        className="modal-box max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-repo-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <GithubIcon size={18} />
            </div>
            <div>
              <h2 id="add-repo-title" className="font-display text-base font-bold text-slate-100 tracking-wide">
                Add Repository
              </h2>
              <p className="font-mono text-xs text-slate-500 mt-0.5">
                Register an existing GitHub repository for event tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informational notice */}
        <div className="p-3 mb-5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 font-mono flex items-start gap-2.5">
          <GitBranch size={15} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">Organizer Notice:</strong> Repositories must be created separately on GitHub by organizers. PRison Control does not create GitHub repositories; it only monitors registered repositories.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="github-url-input" className="block font-mono text-xs text-slate-300 uppercase tracking-wider mb-2 font-semibold">
              GitHub Repository URL <span className="text-emerald-400">*</span>
            </label>
            <input
              id="github-url-input"
              type="text"
              className="prison-input w-full font-mono text-xs"
              placeholder="https://github.com/PRisonBreak/java-cell-01"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              disabled={submitting}
            />

            <p className="mt-2 font-mono text-[11px] text-slate-500">
              Example: <span className="text-slate-400">https://github.com/PRisonBreak/java-cell-01</span>
            </p>
          </div>

          {/* Real-time Parsed Preview */}
          {parsedPreview?.success && (
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-medium">
                <CheckCircle2 size={13} />
                <span>Detected Repository</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-slate-500">Owner:</span>{' '}
                  <span className="text-slate-200 font-semibold">{parsedPreview.data.owner}</span>
                </div>
                <div>
                  <span className="text-slate-500">Repository:</span>{' '}
                  <span className="text-slate-200 font-semibold">{parsedPreview.data.name}</span>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate pt-0.5">
                <span className="text-slate-500">Normalized:</span> {parsedPreview.data.githubUrl}
              </div>
            </div>
          )}

          {/* Auto-Sync Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20"
            />
            <div className="text-xs font-mono">
              <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                <RefreshCw size={12} className="text-emerald-400" />
                <span>Automatically sync existing Pull Requests</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Immediately imports and validates all existing open & merged PRs from this repository.
              </p>
            </div>
          </label>

          {/* Status Progress Indicator */}
          {statusMessage && (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2 text-emerald-300 font-mono text-xs">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 flex items-start gap-2 text-rose-300 font-mono text-xs leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="btn btn-primary"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Add Repository
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
