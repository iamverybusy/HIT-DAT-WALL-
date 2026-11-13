import { Home, RotateCcw, Skull, Trophy } from 'lucide-react';
import { formatCompact } from '../constants/gameData';

export interface BossFailedSummary {
  stageReached: number;
  wallsBroken: number;
  punchPower: number;
  bestCombo: number;
}

interface BossFailedModalProps {
  summary: BossFailedSummary;
  onRetryFromWallOne: () => void;
  onReturnToTitle: () => void;
}

export function BossFailedModal({
  summary,
  onRetryFromWallOne,
  onReturnToTitle,
}: BossFailedModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boss-failed-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-rose-500/75 bg-[#161115] p-6 text-center shadow-[0_0_60px_rgba(244,63,94,0.28)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/50 bg-rose-950/60 text-rose-400">
          <Skull className="h-8 w-8" />
        </div>

        <div className="mt-3 text-xs font-bold uppercase tracking-widest text-rose-400">
          Boss Vault Timer Expired!
        </div>
        <h2
          id="boss-failed-title"
          className="font-display cartoony-outline mt-1 text-3xl font-black uppercase text-rose-300 sm:text-4xl"
        >
          YOU&apos;RE WEAK! GO PRACTICE!
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          You failed to shatter the Stage {summary.stageReached} Boss Vault in time. Your run has
          been wiped back to Wall 1 — train harder on the Heavy Bag next time!
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-rose-900/60 bg-[#0E0B0E] p-3.5 text-xs">
          <div>
            <div className="text-zinc-500">Stage Reached</div>
            <div className="font-mono-tabular text-base font-bold text-amber-300">
              Stage #{summary.stageReached}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Walls Shattered</div>
            <div className="font-mono-tabular text-base font-bold text-zinc-100">
              {summary.wallsBroken.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Peak Power</div>
            <div className="font-mono-tabular text-base font-bold text-rose-300">
              {formatCompact(summary.punchPower)}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Best Combo</div>
            <div className="font-mono-tabular text-base font-bold text-emerald-300">
              {summary.bestCombo}x
            </div>
          </div>
        </div>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-1 text-xs font-medium text-amber-200">
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          Run saved to Local Highscores · Owned IRL Supporter items kept!
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRetryFromWallOne}
            className="font-display cartoony-outline flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-500 px-5 py-3 text-xl font-black text-zinc-950 shadow-[0_4px_0_#92400E] hover:bg-amber-400 active:translate-y-0.5"
          >
            <RotateCcw className="h-5 w-5" />
            WIPE &amp; BACK TO WALL 1
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="font-display flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-[#1B1F29] px-4 py-2.5 text-base font-bold text-zinc-200 hover:border-amber-400"
          >
            <Home className="h-4 w-4 text-zinc-400" />
            Return to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
