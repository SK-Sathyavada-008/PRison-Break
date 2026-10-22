// ─────────────────────────────────────────────
// Admin Repositories Page — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  Folder,
  Plus,
  AlertCircle,
  CheckCircle2,
  Search,
  LayoutList,
  LayoutGrid,
  X,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { Repository, FirestoreRepository } from '../../types';
import { repositoryService } from '../../services/repositoryService';
import RepositoryTable from '../../components/repositories/RepositoryTable';
import RepositoryCard from '../../components/repositories/RepositoryCard';
import RepositoryModal from '../../components/repositories/RepositoryModal';
import GitHubSyncModal from '../../components/pull-requests/GitHubSyncModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal & Dialog state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRepoForDelete, setSelectedRepoForDelete] = useState<Repository | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncRepoTarget, setSyncRepoTarget] = useState<string | undefined>(undefined);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    setLoading(true);
    const unsub = repositoryService.subscribeToRepositories(
      (data) => {
        setRepos(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[RepositoriesPage] Subscription error:', err);
        setError('Error synchronizing repositories from Firestore');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleRepositoryAdded = (newRepo: FirestoreRepository) => {
    setSuccessMessage(`Repository "${newRepo.fullName}" registered successfully!`);
    // Pre-prompt sync for the new repo
    setSyncRepoTarget(newRepo.fullName);
    setIsSyncModalOpen(true);
  };

  const handleToggleStatus = async (id: string, newActive: boolean) => {
    try {
      setError(null);
      await repositoryService.toggleRepositoryStatus(id, newActive);
    } catch (err: any) {
      console.error('[RepositoriesPage] Toggle status failed:', err);
      setError(err?.message || 'Failed to update repository status.');
    }
  };

  const handleDeleteClick = (repo: Repository) => {
    setSelectedRepoForDelete(repo);
  };

  const confirmDelete = async () => {
    if (!selectedRepoForDelete) return;
    try {
      setActionLoading(true);
      await repositoryService.deleteRepository(selectedRepoForDelete.id);
      setSuccessMessage(
        `Repository "${selectedRepoForDelete.fullName ?? selectedRepoForDelete.name}" was unregistered from PRison Control.`
      );
      setSelectedRepoForDelete(null);
    } catch (err: any) {
      console.error('[RepositoriesPage] Delete failed:', err);
      setError(err?.message || 'Failed to remove repository.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter repositories
  const filteredRepos = repos.filter((r) => {
    const isActive = r.active ?? (r.status === 'active');
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'inactive' && isActive) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchOwner = r.owner.toLowerCase().includes(q);
      const matchFullName = (r.fullName ?? '').toLowerCase().includes(q);
      const matchUrl = r.githubUrl.toLowerCase().includes(q);
      if (!matchName && !matchOwner && !matchFullName && !matchUrl) return false;
    }

    return true;
  });

  const totalCount = repos.length;
  const activeCount = repos.filter((r) => r.active ?? (r.status === 'active')).length;
  const inactiveCount = repos.filter((r) => (r.active === false) || (r.status === 'inactive')).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">
            Repositories
          </h1>
          <p className="text-sm text-slate-400">
            GitHub repositories registered for event challenge tracking
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setSyncRepoTarget(undefined);
              setIsSyncModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-all shadow-sm"
            title="Sync all pull requests from registered GitHub repositories"
          >
            <RefreshCw size={14} className="text-cyan-400" />
            <span>Sync PRs from GitHub</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold transition-all shadow-lg shadow-rose-900/30"
          >
            <Plus size={15} />
            <span>Add Repository</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-emerald-300 text-xs animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 transition-colors p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 transition-colors p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Organizer Context Banner */}
      <div className="p-4 rounded-xl border border-white/[0.06] bg-slate-900/40 flex items-start gap-3 text-xs text-slate-400">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="text-slate-200 font-semibold">Organizers create GitHub repositories separately.</span> PRison Control does not create GitHub repositories. It stores and manages repositories that organizers register for competition squads. Inactive repositories remain saved in Firestore but are excluded from event automation.
        </div>
      </div>

      {/* Summary Pills & Controls Bar */}
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
            <span className="font-bold">{totalCount}</span>
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
        </div>

        {/* Search & View Mode Switch */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="prison-input pl-9 pr-3 py-1.5 text-xs font-mono w-full"
            />
          </div>

          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Table View"
            >
              <LayoutList size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Grid View"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card p-10">
          <LoadingState message="FETCHING REGISTERED REPOSITORIES FROM FIRESTORE..." />
        </div>
      ) : repos.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No Repositories Registered"
            description="Organizers must register existing GitHub repositories before tracking challenge attempts."
            icon={<Folder size={32} />}
            action={
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                <Plus size={14} /> Add Repository
              </button>
            }
          />
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="card p-8 text-center font-mono text-xs text-slate-500">
          No repositories match the current filter or search criteria.
        </div>
      ) : viewMode === 'table' ? (
        /* Repository List Table */
        <RepositoryTable
          repositories={filteredRepos}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteClick}
          onSync={(repo) => {
            setSyncRepoTarget(repo.fullName || `${repo.owner}/${repo.name}`);
            setIsSyncModalOpen(true);
          }}
        />
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRepos.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repository={repo}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteClick}
              onSync={(repo) => {
                setSyncRepoTarget(repo.fullName || `${repo.owner}/${repo.name}`);
                setIsSyncModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Add Repository Modal */}
      <RepositoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleRepositoryAdded}
      />

      {/* GitHub Direct Sync Modal */}
      <GitHubSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => {
          setIsSyncModalOpen(false);
          setSyncRepoTarget(undefined);
        }}
        defaultRepoFullName={syncRepoTarget}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!selectedRepoForDelete}
        title="Unregister Repository"
        message={`Are you sure you want to unregister "${selectedRepoForDelete?.fullName ?? selectedRepoForDelete?.name}" from PRison Control?

NOTE: This will only remove the repository document from PRison Control Firestore. It will NOT delete or alter the actual GitHub repository.`}
        confirmLabel={actionLoading ? 'Unregistering...' : 'Unregister Repository'}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setSelectedRepoForDelete(null)}
      />
    </div>
  );
}
