import { Clock, Coins, Dumbbell, Sparkles } from 'lucide-react';
import { formatCompact } from '../constants/gameData';
import type { OfflineRewardSummary } from '../types/game';

interface OfflineProgressModalProps {
  summary: OfflineRewardSummary;
  onClaim: () => void;
}

function formatAwayDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function OfflineProgressModal({ summary, onClaim }: OfflineProgressModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#14161B] p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-400">
          <Clock className="h-6 w-6" />
        </div>

        <h2 id="offline-title" className="mt-4 font-display text-2xl font-bold text-zinc-100">
          Welcome Back!
        </h2>
        <p className="mt-1.5 text-sm text-zinc-400">
          Your crew kept training for{' '}
          <strong className="font-mono-tabular text-zinc-200">
            {formatAwayDuration(summary.elapsedSeconds)}
          </strong>{' '}
          while you were away.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-[#181B22] p-4">
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400">
              <Coins className="h-4 w-4 text-amber-400" />
              Coins Earned
            </div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-amber-300">
              +{formatCompact(summary.coinsEarned)}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-[#181B22] p-4">
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400">
              <Dumbbell className="h-4 w-4 text-emerald-400" />
              Strength Gained
            </div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-emerald-300">
              +{formatCompact(summary.strengthEarned)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClaim}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-400"
        >
          <Sparkles className="h-4 w-4" />
          Claim Rewards
        </button>
      </div>
    </div>
  );
}
