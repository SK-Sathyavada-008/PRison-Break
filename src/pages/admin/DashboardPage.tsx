// ─────────────────────────────────────────────
// Admin Dashboard Page — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  Users, Folder, GitPullRequest, GitMerge,
  Clock, AlertTriangle, Zap, Trophy
} from 'lucide-react';
import StatCard from '../../components/dashboard/StatCard';
import type { ScoreEvent, Participant, Repository, PullRequest } from '../../types';
import { participantService } from '../../services/participantService';
import { repositoryService } from '../../services/repositoryService';
import { pullRequestService } from '../../services/pullRequestService';
import { scoreEventService } from '../../services/scoreEventService';
import { Link } from 'react-router-dom';
import LoadingState from '../../components/ui/LoadingState';

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let count = 0;
    const markLoaded = () => {
      count++;
      if (count >= 2) setLoading(false);
    };

    const unsubParticipants = participantService.subscribeToLeaderboard((data) => {
      setParticipants(data);
      markLoaded();
    });

    const unsubRepos = repositoryService.subscribeToRepositories((data) => {
      setRepositories(data);
      markLoaded();
    });

    const unsubPRs = pullRequestService.subscribeToPullRequests((data) => {
      setPullRequests(data);
    });

    const unsubEvents = scoreEventService.subscribeToScoreEvents((data) => {
      setScoreEvents(data);
    });

    return () => {
      unsubParticipants();
      unsubRepos();
      unsubPRs();
      unsubEvents();
    };
  }, []);

  const totalParticipants = participants.length;
  const totalRepositories = repositories.length;
  const totalPRs = pullRequests.length;
  const mergedPRs = pullRequests.filter(p => p.status === 'merged' || p.merged).length;
  const pendingReviews = pullRequests.filter(p => p.status === 'pending').length;
  const flaggedPRs = pullRequests.filter(p => p.status === 'flagged').length;
  const totalXP = participants.reduce((sum, p) => sum + p.xp, 0);
  const topParticipant = participants[0]?.name ?? 'None';

  const recentEvents = scoreEvents.slice(0, 5);
  const topParticipants = participants.slice(0, 5);

  if (loading) {
    return (
      <div className="p-8">
        <LoadingState message="BOOTING DASHBOARD TELEMETRY..." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 stagger-children">
      {/* Page header */}
      <div>
        <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide mb-1">Dashboard</h1>
        <p className="font-mono text-xs text-slate-500">Event overview and live statistics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Participants"
          value={totalParticipants}
          icon={<Users size={16} />}
          accent="cyan"
          subtitle="registered"
        />
        <StatCard
          title="Repositories"
          value={totalRepositories}
          icon={<Folder size={16} />}
          accent="blue"
          subtitle="linked"
        />
        <StatCard
          title="Total PRs"
          value={totalPRs}
          icon={<GitPullRequest size={16} />}
          accent="purple"
          subtitle="attempts"
        />
        <StatCard
          title="Merged PRs"
          value={mergedPRs}
          icon={<GitMerge size={16} />}
          accent="green"
          subtitle="escapes"
        />
        <StatCard
          title="Pending Review"
          value={pendingReviews}
          icon={<Clock size={16} />}
          accent="amber"
          subtitle="awaiting"
        />
        <StatCard
          title="Flagged PRs"
          value={flaggedPRs}
          icon={<AlertTriangle size={16} />}
          accent="red"
          subtitle="needs attention"
        />
      </div>

      {/* Second row: Recent events + Top participants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Score Events */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="font-mono text-xs text-slate-400 tracking-wide font-semibold">Recent Score Events</span>
            </div>
            <Link
              to="/admin/score-events"
              className="font-mono text-[10px] text-slate-400 hover:text-[#FF5470] transition-colors"
            >
              View All →
            </Link>
          </div>

          <div className="divide-y divide-slate-800/40">
            {recentEvents.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-slate-600">
                No recent events recorded yet.
              </div>
            ) : (
              recentEvents.map((event: ScoreEvent) => (
                <div key={event.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-slate-300 font-semibold truncate">{event.participantName}</span>
                      <span className="font-mono text-[10px] text-slate-600 flex-shrink-0">@{event.githubUsername}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{event.event}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="font-mono text-sm font-bold text-emerald-400">+{event.points}</span>
                    <span className="font-mono text-[10px] text-slate-600">{formatTime(event.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Participants */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <span className="font-mono text-xs text-slate-400 tracking-wide font-semibold">Top Prisoners</span>
            </div>
            <Link
              to="/admin/leaderboard"
              className="font-mono text-[10px] text-slate-400 hover:text-[#FF5470] transition-colors"
            >
              Full Leaderboard →
            </Link>
          </div>

          <div className="divide-y divide-slate-800/40">
            {topParticipants.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-slate-600">
                No participants registered yet.
              </div>
            ) : (
              topParticipants.map((p: Participant) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/20 transition-colors">
                  <span
                    className={`font-mono text-xs font-bold w-6 text-center ${
                      p.rank === 1 ? 'text-amber-400' :
                      p.rank === 2 ? 'text-slate-400' :
                      p.rank === 3 ? 'text-amber-600' : 'text-slate-600'
                    }`}
                  >
                    #{p.rank}
                  </span>
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name} className="w-7 h-7 rounded-full border border-slate-700/50" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400 font-bold">
                      {p.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 font-semibold truncate">{p.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">@{p.githubUsername}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-emerald-400">{p.xp.toLocaleString()} XP</div>
                    <div className="font-mono text-[10px] text-slate-600">{p.mergedPRs} merged</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick status bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <span className="font-mono text-xs text-emerald-400 font-semibold tracking-widest">EVENT LIVE</span>
          </div>
          <div className="h-4 w-px bg-slate-700/50 hidden sm:block" />
          <span className="font-mono text-[11px] text-slate-500">
            Total XP distributed: <span className="text-amber-400 font-bold">{totalXP.toLocaleString()}</span>
          </span>
          <div className="h-4 w-px bg-slate-700/50 hidden sm:block" />
          <span className="font-mono text-[11px] text-slate-500">
            Leading prisoner: <span className="text-slate-300 font-semibold">{topParticipant}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
