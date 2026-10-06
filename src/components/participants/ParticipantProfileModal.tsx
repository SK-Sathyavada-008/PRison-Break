// ─────────────────────────────────────────────
// ParticipantProfileModal — Prisoner Dossier & Score History
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Zap,
  GitPullRequest,
  GitMerge,
  Shield,
  Clock,
  Power,
  Flame,
  Plus,
  Minus,
  Loader2,
  Calendar,
  Award,
} from 'lucide-react';
import type { Participant, ScoreEvent } from '../../types';
import { participantService } from '../../services/participantService';
import StatusBadge from '../ui/StatusBadge';

interface ParticipantProfileModalProps {
  participant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (id: string, active: boolean) => void;
  onScoreAdjusted?: (newScore: number) => void;
}

export default function ParticipantProfileModal({
  participant,
  isOpen,
  onClose,
  onStatusChanged,
  onScoreAdjusted,
}: ParticipantProfileModalProps) {
  const [scoreHistory, setScoreHistory] = useState<ScoreEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [customDelta, setCustomDelta] = useState('50');
  const [reason, setReason] = useState('Admin test score adjustment');
  const [adjustingScore, setAdjustingScore] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!participant || !isOpen) return;

    let mounted = true;
    setLoadingHistory(true);
    participantService
      .getParticipantScoreHistory(participant.id)
      .then((history) => {
        if (mounted) {
          setScoreHistory(history);
          setLoadingHistory(false);
        }
      })
      .catch((err) => {
        console.error('[ParticipantProfileModal] Error fetching score history:', err);
        if (mounted) setLoadingHistory(false);
      });

    return () => {
      mounted = false;
    };
  }, [participant, isOpen]);

  if (!isOpen || !participant) return null;

  const isActive = participant.active ?? (participant.status !== 'inactive');

  const handleAdjustScore = async (delta: number, customReason?: string) => {
    try {
      setAdjustingScore(true);
      setFeedback(null);
      const newScore = await participantService.adjustParticipantScore(
        participant.id,
        delta,
        customReason || reason
      );

      // Refresh score history
      const updatedHistory = await participantService.getParticipantScoreHistory(participant.id);
      setScoreHistory(updatedHistory);

      setFeedback(`Score updated! New total: ${newScore.toLocaleString()} XP`);
      if (onScoreAdjusted) onScoreAdjusted(newScore);
    } catch (err: any) {
      console.error('[ParticipantProfileModal] Score adjustment failed:', err);
      setFeedback(err?.message || 'Failed to adjust score');
    } finally {
      setAdjustingScore(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      setTogglingStatus(true);
      await participantService.toggleParticipantStatus(participant.id, !isActive);
      if (onStatusChanged) onStatusChanged(participant.id, !isActive);
      setFeedback(`Participant marked as ${!isActive ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      console.error('[ParticipantProfileModal] Status toggle failed:', err);
      setFeedback(err?.message || 'Failed to toggle status');
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            {participant.avatarUrl ? (
              <img
                src={participant.avatarUrl}
                alt={participant.name}
                className="w-14 h-14 rounded-full border-2 border-emerald-500/40 bg-slate-900 object-cover shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center text-lg font-bold text-white">
                {participant.name[0]}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-white tracking-wide">
                  {participant.name}
                </h2>
                <StatusBadge status={isActive ? 'active' : 'inactive'} />
              </div>
              <a
                href={`https://github.com/${participant.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400 hover:text-emerald-400 transition-colors mt-0.5"
              >
                @{participant.githubUsername}
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-mono text-xs text-emerald-300 flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-emerald-200">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-slate-400 uppercase mb-1">
              <Zap size={13} className="text-emerald-400" />
              <span>Total XP</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {(participant.totalScore ?? participant.xp).toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-slate-400 uppercase mb-1">
              <GitPullRequest size={13} className="text-blue-400" />
              <span>Pull Requests</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {participant.prCount ?? participant.prs}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-slate-400 uppercase mb-1">
              <GitMerge size={13} className="text-purple-400" />
              <span>Merged PRs</span>
            </div>
            <div className="text-xl font-bold font-mono text-purple-300">
              {participant.mergedPrCount ?? participant.mergedPRs}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-slate-400 uppercase mb-1">
              <Shield size={13} className="text-cyan-400" />
              <span>Escaped Cells</span>
            </div>
            <div className="text-xl font-bold font-mono text-cyan-300">
              {participant.escapedCells}
            </div>
          </div>
        </div>

        {/* Timeline Details */}
        <div className="space-y-2 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono text-xs text-slate-300 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Award size={13} className="text-amber-400" /> First Successful PR:
            </span>
            <span className="text-slate-200">
              {participant.firstSuccessfulPr
                ? new Date(participant.firstSuccessfulPr).toLocaleString()
                : 'No successful PRs yet'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" /> Registration Date:
            </span>
            <span className="text-slate-200">
              {participant.createdAt ? new Date(participant.createdAt).toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Deactivation / Activation Control */}
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/40 border border-slate-800 mb-5">
          <div>
            <div className="font-semibold text-xs text-slate-200 font-mono">
              Participant Status
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              {isActive
                ? 'Active in the event. Click to deactivate and suspend participation.'
                : 'Deactivated. Excluded from active leaderboard rankings.'}
            </p>
          </div>
          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className={`btn text-xs font-mono ${
              isActive
                ? 'btn-danger bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                : 'btn-primary'
            }`}
          >
            {togglingStatus ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Power size={13} />
            )}
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>

        {/* Dev Testing Score Modifier */}
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
            <Flame size={14} />
            <span>Admin Dev Function: Real-Time Score Modifier</span>
          </div>
          <p className="font-mono text-[11px] text-slate-400 leading-relaxed">
            Modify this participant's score in Firestore to test and verify that the public leaderboard and projector display update instantly in real time without refreshing.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAdjustScore(50, 'Dev Test: +50 XP award')}
              disabled={adjustingScore}
              className="btn btn-ghost border border-slate-700 text-xs font-mono text-emerald-400 hover:bg-emerald-500/10"
            >
              <Plus size={12} /> +50 XP
            </button>
            <button
              onClick={() => handleAdjustScore(100, 'Dev Test: +100 XP award')}
              disabled={adjustingScore}
              className="btn btn-ghost border border-slate-700 text-xs font-mono text-emerald-400 hover:bg-emerald-500/10"
            >
              <Plus size={12} /> +100 XP
            </button>
            <button
              onClick={() => handleAdjustScore(-50, 'Dev Test: -50 XP penalty')}
              disabled={adjustingScore}
              className="btn btn-ghost border border-slate-700 text-xs font-mono text-rose-400 hover:bg-rose-500/10"
            >
              <Minus size={12} /> -50 XP
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="number"
              value={customDelta}
              onChange={(e) => setCustomDelta(e.target.value)}
              placeholder="XP Delta"
              className="prison-input py-1.5 px-3 text-xs font-mono w-28"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for score adjustment"
              className="prison-input py-1.5 px-3 text-xs font-mono flex-1"
            />
            <button
              onClick={() => {
                const delta = parseInt(customDelta, 10);
                if (!isNaN(delta) && delta !== 0) {
                  handleAdjustScore(delta, reason);
                }
              }}
              disabled={adjustingScore}
              className="btn btn-primary text-xs font-mono"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Score History Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span>Score History</span>
            </h3>
            <span className="font-mono text-[11px] text-slate-500">
              {scoreHistory.length} Recorded Events
            </span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
            {loadingHistory ? (
              <div className="p-4 text-center font-mono text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 size={13} className="animate-spin" />
                <span>Loading score events...</span>
              </div>
            ) : scoreHistory.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-slate-600">
                No score events recorded yet.
              </div>
            ) : (
              scoreHistory.map((event) => (
                <div key={event.id} className="p-3 flex items-center justify-between text-xs font-mono">
                  <div>
                    <div className="text-slate-200 font-semibold">{event.event}</div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`font-bold ${
                      event.points >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {event.points >= 0 ? `+${event.points}` : event.points} XP
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
