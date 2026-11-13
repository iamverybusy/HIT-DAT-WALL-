import { useState } from 'react';
import { Check, Medal, Sparkles, X } from 'lucide-react';
import {
  ACHIEVEMENTS,
  formatCompact,
  getAchievementBonuses,
  getAchievementProgress,
} from '../constants/gameData';
import type { PlayerProgression } from '../types/game';

interface AchievementsModalProps {
  progression: PlayerProgression;
  onClaimAchievement: (id: string) => void;
  onClaimAllAchievements: () => void;
  onClose: () => void;
}

type AchievementFilter = 'all' | 'ready' | 'progress' | 'claimed';

export function AchievementsModal({
  progression,
  onClaimAchievement,
  onClaimAllAchievements,
  onClose,
}: AchievementsModalProps) {
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const bonuses = getAchievementBonuses(progression);
  const claimedCount = progression.claimedAchievements.length;
  const claimableCount = ACHIEVEMENTS.filter(
    (a) =>
      !progression.claimedAchievements.includes(a.id) &&
      getAchievementProgress(progression, a) >= a.target
  ).length;

  const filteredAchievements = ACHIEVEMENTS.filter((ach) => {
    const isClaimed = progression.claimedAchievements.includes(ach.id);
    const canClaim = !isClaimed && getAchievementProgress(progression, ach) >= ach.target;
    if (filter === 'ready') return canClaim;
    if (filter === 'claimed') return isClaimed;
    if (filter === 'progress') return !isClaimed && !canClaim;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievements-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#14161B] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Medal className="h-6 w-6 text-amber-400" />
              <h2 id="achievements-title" className="font-display text-2xl font-bold text-zinc-100">
                Milestones &amp; Achievements
              </h2>
            </div>
            <p className="mt-0.5 text-sm text-zinc-400">
              {claimedCount} / {ACHIEVEMENTS.length} unlocked · Claimed bonuses stay active forever.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {claimableCount > 0 && (
              <button
                type="button"
                onClick={onClaimAllAchievements}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                Claim All ({claimableCount})
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close achievements"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-[#1D2027] text-zinc-300 hover:border-amber-500/50 hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Active Permanent Bonus Summary */}
        <div className="grid grid-cols-2 gap-2 border-b border-zinc-800 bg-[#101216] px-6 py-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-zinc-800 bg-[#181B22] px-3 py-2">
            <div className="text-[11px] font-medium text-zinc-400">Power Bonus</div>
            <div className="font-mono-tabular text-sm font-bold text-amber-300">
              +{Math.round(bonuses.powerBonus * 100)}%
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-[#181B22] px-3 py-2">
            <div className="text-[11px] font-medium text-zinc-400">Coin Bonus</div>
            <div className="font-mono-tabular text-sm font-bold text-yellow-300">
              +{Math.round(bonuses.coinBonus * 100)}%
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-[#181B22] px-3 py-2">
            <div className="text-[11px] font-medium text-zinc-400">Speed Bonus</div>
            <div className="font-mono-tabular text-sm font-bold text-emerald-300">
              +{Math.round(bonuses.speedBonus * 100)}%
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-[#181B22] px-3 py-2">
            <div className="text-[11px] font-medium text-zinc-400">Crit Bonus</div>
            <div className="font-mono-tabular text-sm font-bold text-rose-300">
              +{Math.round(bonuses.critBonus * 100)}%
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-[#181B22] px-3 py-2">
            <div className="text-[11px] font-medium text-zinc-400">Bag STR Bonus</div>
            <div className="font-mono-tabular text-sm font-bold text-teal-300">
              +{Math.round(bonuses.bagStrBonus * 100)}%
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-[#181B22] px-3 py-2">
            <div className="text-[11px] font-medium text-zinc-400">Splash Area</div>
            <div className="font-mono-tabular text-sm font-bold text-cyan-300">
              +{bonuses.splashBonus.toFixed(2)}m
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-[#12141A] px-6 py-2.5">
          {([
            { id: 'all', label: `All (${ACHIEVEMENTS.length})` },
            { id: 'ready', label: `Ready (${claimableCount})` },
            {
              id: 'progress',
              label: `In Progress (${ACHIEVEMENTS.length - claimedCount - claimableCount})`,
            },
            { id: 'claimed', label: `Claimed (${claimedCount})` },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === item.id
                  ? 'bg-amber-500 text-zinc-950'
                  : 'border border-zinc-700 bg-[#181B22] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Achievement List */}
        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredAchievements.map((ach) => {
              const rawProgress = getAchievementProgress(progression, ach);
              const clampedProgress = Math.min(rawProgress, ach.target);
              const pct = Math.min(100, (clampedProgress / ach.target) * 100);
              const isClaimed = progression.claimedAchievements.includes(ach.id);
              const canClaim = !isClaimed && rawProgress >= ach.target;

              return (
                <div
                  key={ach.id}
                  className={`flex flex-col justify-between rounded-xl border p-5 ${
                    isClaimed
                      ? 'border-emerald-500/35 bg-[#171E1C]'
                      : canClaim
                        ? 'border-amber-400/70 bg-[#1F222A]'
                        : 'border-zinc-800 bg-[#181B22]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-zinc-100">{ach.title}</h3>
                      <span className="font-mono-tabular text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
                        {ach.rewardLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-400">{ach.description}</p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Progress</span>
                        <span className="font-mono-tabular font-semibold text-zinc-200">
                          {formatCompact(clampedProgress)} / {formatCompact(ach.target)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full transition-[width] duration-150 ${
                            isClaimed ? 'bg-emerald-400' : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={!canClaim}
                      onClick={() => onClaimAchievement(ach.id)}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                        isClaimed
                          ? 'border border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                          : canClaim
                            ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                            : 'border border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {isClaimed ? (
                        <>
                          <Check className="h-4 w-4" />
                          Claimed
                        </>
                      ) : canClaim ? (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Claim Bonus
                        </>
                      ) : (
                        'In Progress'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
