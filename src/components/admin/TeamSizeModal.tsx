// ─────────────────────────────────────────────
// TeamSizeModal — Flexible Team Size Approval Modal (4 or 5 Students)
// Admin-Only · Mandatory Justification Reason · Audit Logging
// ─────────────────────────────────────────────

import { useState } from 'react';
import { X, Users, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Team, FirestoreTeam } from '../../types';
import { teamService } from '../../services/teamService';
import { useAuth } from '../../context/AuthContext';

interface TeamSizeModalProps {
  team: Team | FirestoreTeam | null;
  isOpen: boolean;
  onClose: () => void;
  onSizeChanged?: (team: any) => void;
  onSuccess?: () => void;
  adminUsername?: string;
}

export default function TeamSizeModal({
  team,
  isOpen,
  onClose,
  onSizeChanged,
  onSuccess,
  adminUsername,
}: TeamSizeModalProps) {
  const { currentUser } = useAuth();
  const adminName = adminUsername || currentUser?.displayName || currentUser?.email || 'admin_warden';

  const [selectedSize, setSelectedSize] = useState<4 | 5>(
    team?.configuredTeamSize === 5 ? 5 : 4
  );
  const [reason, setReason] = useState<string>(team?.sizeChangeReason || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !team) return null;

  const currentSize = team.configuredTeamSize || 4;
  const currentMembersCount = team.members ? team.members.length : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('A mandatory justification reason is required when modifying configured team size.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      await teamService.setTeamConfiguredSize(team.id, selectedSize, reason.trim(), adminName);

      setSuccessMsg(
        `Successfully updated configured team size for "${team.name}" to ${selectedSize} students.`
      );

      if (onSizeChanged) {
        onSizeChanged({
          ...team,
          configuredTeamSize: selectedSize,
          sizeChangeReason: reason.trim(),
          sizeApprovedBy: adminName,
        });
      }
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update team size.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#090B14] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-indigo-950/30 via-slate-900 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-mono">Configure Team Size</h2>
              <p className="text-xs font-mono text-slate-400">
                Squad: <span className="text-white font-bold">{team.name}</span> ({team.repositoryName})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 font-mono text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="text-slate-400">
              Current Registered Members: <strong className="text-white">{currentMembersCount}</strong>
            </div>
            <div className="text-slate-400">
              Configured Size: <strong className="text-indigo-400">{currentSize} students</strong>
            </div>
            {team.sizeApprovedBy && (
              <div className="text-[10px] text-slate-500">
                Previously approved by @{team.sizeApprovedBy}: "{team.sizeChangeReason}"
              </div>
            )}
          </div>

          {/* Size Selection */}
          <div>
            <label className="block text-slate-300 font-bold mb-2 uppercase text-[11px]">
              Allowed Competition Team Size *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedSize(4)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedSize === 4
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm text-white mb-1">4 Students</div>
                <div className="text-[11px] text-slate-400">Standard default offline hackathon squad size</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSize(5)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedSize === 5
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm text-white mb-1 flex items-center justify-between">
                  <span>5 Students</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 font-bold">
                    EXCEPTIONAL
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Approved exceptional 5-member team size</div>
              </button>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 uppercase text-[11px]">
              Administrative Justification Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved 5-member team due to odd participant count with mentor approval"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500/60 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-500">
              Admin: <strong className="text-slate-300">@{adminName}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <ShieldCheck size={14} />
                <span>{loading ? 'Saving...' : 'Approve Team Size'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
