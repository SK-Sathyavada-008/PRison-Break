// ─────────────────────────────────────────────
// BonusXPModal — Admin Manage Team Bonus XP Modal
// Positive Only · Mandatory Reason · Live Preview · Transaction Ledger
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { X, Zap, Award, History, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Team, FirestoreTeam, BonusTransaction } from '../../types';
import { bonusService, type BonusAwardPreview } from '../../services/bonusService';
import { useAuth } from '../../context/AuthContext';

interface BonusXPModalProps {
  team: Team | FirestoreTeam | null;
  isOpen: boolean;
  onClose: () => void;
  onBonusAwarded?: (team: any) => void;
  onSuccess?: () => void;
  adminUsername?: string;
}

export default function BonusXPModal({
  team,
  isOpen,
  onClose,
  onBonusAwarded,
  onSuccess,
  adminUsername,
}: BonusXPModalProps) {
  const { currentUser } = useAuth();
  const adminName = adminUsername || currentUser?.displayName || currentUser?.email || 'admin_warden';

  const [amountStr, setAmountStr] = useState<string>('10');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [preview, setPreview] = useState<BonusAwardPreview | null>(null);

  // Load team transactions on open
  useEffect(() => {
    if (!isOpen || !team) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    setReason('');
    setAmountStr('10');

    // Fetch existing bonus history
    bonusService.getTeamBonusTransactions(team.id).then((txs) => {
      setTransactions(txs);
    });

    // Generate initial preview
    bonusService.previewBonusAward(team.id, 10).then((prev) => {
      setPreview(prev);
    }).catch(() => {
      setPreview(null);
    });
  }, [isOpen, team]);

  // Recalculate preview when amount changes
  useEffect(() => {
    if (!team) return;
    const num = parseFloat(amountStr);
    if (!isNaN(num) && num > 0) {
      bonusService.previewBonusAward(team.id, num).then((prev) => {
        setPreview(prev);
        setErrorMsg(null);
      }).catch((err) => {
        setPreview(null);
        setErrorMsg(err.message);
      });
    } else {
      setPreview(null);
      if (amountStr && num <= 0) {
        setErrorMsg('Bonus amount must be a positive number greater than 0.');
      }
    }
  }, [amountStr, team]);

  if (!isOpen || !team) return null;

  const currentEarned = team.earnedXP ?? (
    team.totalScore !== undefined && team.bonusXP !== undefined
      ? Math.max(0, team.totalScore - (team.bonusXP || 0))
      : (team.totalScore ?? 0)
  );
  const currentBonus = team.bonusXP ?? 0;
  const currentTotal = team.totalXP ?? (team.totalScore ?? (currentEarned + currentBonus));

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountStr);

    if (isNaN(num) || num <= 0) {
      setErrorMsg('Bonus amount must be a positive number greater than 0.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('A mandatory justification reason is required to award bonus XP.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const result = await bonusService.awardBonus({
        teamId: team.id,
        amount: num,
        reason: reason.trim(),
        adminUsername: adminName,
      });

      setSuccessMsg(`Successfully awarded +${num} Bonus XP to ${team.name}!`);
      setTransactions((prev) => [result.transaction, ...prev]);
      setReason('');

      if (onBonusAwarded) {
        const updatedTeam: any = {
          ...team,
          bonusXP: (team.bonusXP || 0) + num,
          totalXP: result.newTotalXP,
          totalScore: result.newTotalXP,
        };
        onBonusAwarded(updatedTeam);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to award bonus XP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-[#090B14] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-mono flex items-center gap-2">
                <span>Manage Team Bonus XP</span>
              </h2>
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 font-mono text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Team Score Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Earned XP</div>
              <div className="text-lg font-black text-slate-200">{currentEarned.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">from solved issues</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-center">
              <div className="text-[10px] text-amber-400 uppercase font-bold mb-1">Bonus XP</div>
              <div className="text-lg font-black text-amber-400">+{currentBonus.toLocaleString()}</div>
              <div className="text-[10px] text-amber-500/70 mt-0.5">manual awards</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-center">
              <div className="text-[10px] text-emerald-400 uppercase font-bold mb-1">Total XP</div>
              <div className="text-lg font-black text-emerald-400">{currentTotal.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-500/70 mt-0.5">leaderboard rank</div>
            </div>
          </div>

          {/* Award Form */}
          <form onSubmit={handleAward} className="space-y-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Award size={15} className="text-amber-400" />
              <span>Award Positive Bonus Points</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5 font-bold">
                  Bonus Amount (XP) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold focus:border-amber-500/60 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[11px]">XP</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1.5 font-bold">
                  Mandatory Reason & Audit Justification *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Outstanding collaboration & hackathon mentor award"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:border-amber-500/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Calculation Preview */}
            {preview && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Preview: </span>
                  <span>Earned: <strong>{preview.earnedXP}</strong> + New Bonus: <strong className="text-amber-400">+{preview.newBonusXP}</strong></span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">New Combined Total: </span>
                  <span className="text-emerald-400 font-black text-sm">{preview.newTotalXP} XP</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Audited as <strong className="text-slate-300">@{adminName}</strong>
              </span>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Zap size={13} />
                <span>{loading ? 'Validating & Awarding...' : 'Confirm Bonus Award'}</span>
              </button>
            </div>
          </form>

          {/* Past Bonus Transactions History */}
          <div>
            <h4 className="font-bold text-slate-300 text-xs mb-2.5 flex items-center gap-2">
              <History size={13} className="text-slate-400" />
              <span>Team Bonus Transaction History ({transactions.length})</span>
            </h4>

            {transactions.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                No bonus XP transactions have been awarded to this squad yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-black text-amber-400 bg-amber-500/10 border border-amber-500/30">
                          +{tx.amount} XP
                        </span>
                        <span className="text-white font-medium">{tx.reason}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        By @{tx.adminUsername} · {new Date(tx.timestamp).toLocaleString()} · ID: {tx.id.substring(0, 16)}...
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">{tx.newTotalXP ?? ''} XP Total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
