// ─────────────────────────────────────────────
// AwardsShowcase — Official PRison Break Competition Awards
// 1st Place: PRison Break Champions
// 2nd Place: Runner-Up
// 3rd Place: Third Place
// Special Award: Very Hard Specialist (ranked separately by accurately solved Very Hard issues)
// ─────────────────────────────────────────────

import { Trophy, Medal, Award, Flame, Sparkles, FolderGit2, ArrowRight } from 'lucide-react';
import type { Team, AwardsSummary } from '../../types';
import { getAwardsSummary, getTeamVeryHardScore } from '../../services/teamService';

interface AwardsShowcaseProps {
  teams: Team[];
  onSelectTeam?: (team: Team) => void;
}

export default function AwardsShowcase({ teams, onSelectTeam }: AwardsShowcaseProps) {
  if (!teams || teams.length === 0) return null;

  const awards: AwardsSummary = getAwardsSummary(teams);
  const { champions, runnerUp, thirdPlace, veryHardSpecialist } = awards;

  const primaryChamp = champions[0];
  const primaryRunner = runnerUp[0];
  const primaryThird = thirdPlace[0];
  const vhWinner = veryHardSpecialist.winners[0];

  return (
    <section className="w-full space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[#FF1E46]">
            <Trophy size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Official Competition Awards
            </h2>
            <p className="text-xs text-slate-500">Authoritative deterministic standings across 4-student squads</p>
          </div>
        </div>
      </div>

      {/* 4 Awards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. 1st Place — PRison Break Champions */}
        <div
          onClick={() => primaryChamp && onSelectTeam && onSelectTeam(primaryChamp)}
          className={`group relative rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between ${
            primaryChamp ? 'cursor-pointer hover:-translate-y-1 hover:border-rose-500/60 hover:shadow-rose-950/20' : ''
          } bg-gradient-to-b from-rose-950/20 via-slate-900/60 to-slate-950/80 border-rose-500/30 shadow-lg`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-[#FF5470]">
                <Trophy size={13} />
                <span>1st Place</span>
              </span>
              <span className="text-xs font-medium text-slate-500">Apex Winner</span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">PRison Break Champions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Highest total validated team XP</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/[0.06] space-y-2">
              {primaryChamp ? (
                <>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-base font-bold text-white truncate" title={primaryChamp.name}>
                      {primaryChamp.name}
                    </span>
                    {champions.length > 1 && (
                      <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                        TIED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-medium truncate">
                    <FolderGit2 size={13} className="shrink-0 text-slate-500" />
                    <span className="truncate">{primaryChamp.repositoryName}</span>
                  </div>
                  <div className="pt-1 text-2xl font-black font-mono text-emerald-400 tracking-tight">
                    {primaryChamp.totalScore.toLocaleString()} <span className="text-xs font-medium text-slate-500">XP</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-2">Awaiting submissions...</div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
            <span>Tournament Leader</span>
            {primaryChamp && (
              <span className="text-rose-400 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Details <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>

        {/* 2. 2nd Place — Runner-Up */}
        <div
          onClick={() => primaryRunner && onSelectTeam && onSelectTeam(primaryRunner)}
          className={`group relative rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between ${
            primaryRunner ? 'cursor-pointer hover:-translate-y-1 hover:border-slate-500/60' : ''
          } bg-gradient-to-b from-slate-800/20 via-slate-900/60 to-slate-950/80 border-slate-700/50 shadow-lg`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-600/50 text-slate-200">
                <Medal size={13} />
                <span>2nd Place</span>
              </span>
              <span className="text-xs font-medium text-slate-500">Runner-Up</span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Runner-Up</h3>
              <p className="text-xs text-slate-400 mt-0.5">Second-highest total validated team XP</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/[0.06] space-y-2">
              {primaryRunner ? (
                <>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-base font-bold text-white truncate" title={primaryRunner.name}>
                      {primaryRunner.name}
                    </span>
                    {runnerUp.length > 1 && (
                      <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                        TIED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono font-medium truncate">
                    <FolderGit2 size={13} className="shrink-0 text-slate-500" />
                    <span className="truncate">{primaryRunner.repositoryName}</span>
                  </div>
                  <div className="pt-1 text-2xl font-black font-mono text-slate-200 tracking-tight">
                    {primaryRunner.totalScore.toLocaleString()} <span className="text-xs font-medium text-slate-500">XP</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-2">Awaiting submissions...</div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
            <span>2nd Position</span>
            {primaryRunner && (
              <span className="text-slate-300 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Details <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>

        {/* 3. 3rd Place — Third Place */}
        <div
          onClick={() => primaryThird && onSelectTeam && onSelectTeam(primaryThird)}
          className={`group relative rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between ${
            primaryThird ? 'cursor-pointer hover:-translate-y-1 hover:border-amber-500/60' : ''
          } bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-950/80 border-amber-600/30 shadow-lg`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/40 border border-amber-600/40 text-amber-400">
                <Award size={13} />
                <span>3rd Place</span>
              </span>
              <span className="text-xs font-medium text-slate-500">Podium</span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Third Place</h3>
              <p className="text-xs text-slate-400 mt-0.5">Third-highest total validated team XP</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/[0.06] space-y-2">
              {primaryThird ? (
                <>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-base font-bold text-white truncate" title={primaryThird.name}>
                      {primaryThird.name}
                    </span>
                    {thirdPlace.length > 1 && (
                      <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                        TIED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-mono font-medium truncate">
                    <FolderGit2 size={13} className="shrink-0 text-slate-500" />
                    <span className="truncate">{primaryThird.repositoryName}</span>
                  </div>
                  <div className="pt-1 text-2xl font-black font-mono text-amber-400 tracking-tight">
                    {primaryThird.totalScore.toLocaleString()} <span className="text-xs font-medium text-slate-500">XP</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-2">Awaiting submissions...</div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
            <span>3rd Position</span>
            {primaryThird && (
              <span className="text-amber-400 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Details <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>

        {/* 4. Special Award — Very Hard Specialist */}
        <div
          onClick={() => vhWinner && onSelectTeam && onSelectTeam(vhWinner)}
          className={`group relative rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between ${
            vhWinner ? 'cursor-pointer hover:-translate-y-1 hover:border-purple-500/60' : ''
          } bg-gradient-to-b from-purple-950/20 via-slate-900/60 to-slate-950/80 border-purple-500/30 shadow-lg`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/50 border border-purple-500/40 text-purple-300">
                <Sparkles size={12} className="text-purple-400" />
                <span>Special Award</span>
              </span>
              <Flame size={16} className="text-purple-400" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Very Hard Specialist</h3>
              <p className="text-xs text-slate-400 mt-0.5">Most Very Hard issues solved (acc ≥95%)</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/[0.06] space-y-2">
              {vhWinner ? (
                <>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-base font-bold text-white truncate" title={vhWinner.name}>
                      {vhWinner.name}
                    </span>
                    {veryHardSpecialist.isTied && (
                      <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                        TIED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono font-medium truncate">
                    <FolderGit2 size={13} className="shrink-0 text-slate-500" />
                    <span className="truncate">{vhWinner.repositoryName}</span>
                  </div>
                  <div className="pt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black font-mono text-purple-400 tracking-tight">
                      {vhWinner.veryHardSolvedCount} <span className="text-xs font-medium text-slate-500">VH</span>
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ({getTeamVeryHardScore(vhWinner)} XP)
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-2">No Very Hard issues validated yet</div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
            <span>Special Category</span>
            {vhWinner && (
              <span className="text-purple-400 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Details <ArrowRight size={12} />
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
