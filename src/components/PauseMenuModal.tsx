import { LogOut, Play, Settings, ShoppingBag, Trophy } from 'lucide-react';
import { computeEffectivePunchPower, formatCompact } from '../constants/gameData';
import type { PlayerProgression } from '../types/game';

interface PauseMenuModalProps {
  currentStage: number;
  progression: PlayerProgression;
  onResume: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
  onOpenStore: () => void;
  onQuitToTitle: () => void;
}

export function PauseMenuModal({
  currentStage,
  progression,
  onResume,
  onOpenLeaderboard,
  onOpenSettings,
  onOpenStore,
  onQuitToTitle,
}: PauseMenuModalProps) {
  const power = computeEffectivePunchPower(progression);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-menu-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#13161D] p-6 text-center shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
          HIT DAT WALL! · LiveBetterGameS
        </div>
        <h2
          id="pause-menu-title"
          className="font-display cartoony-outline mt-1 text-4xl font-black uppercase text-zinc-100"
        >
          GAME PAUSED
        </h2>

        {/* Current Run Snapshot */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-[#0E1015] p-3 text-xs">
          <div>
            <div className="text-zinc-500">Stage</div>
            <div className="font-mono-tabular font-bold text-amber-300">#{currentStage}</div>
          </div>
          <div>
            <div className="text-zinc-500">Power</div>
            <div className="font-mono-tabular font-bold text-zinc-100">{formatCompact(power)}</div>
          </div>
          <div>
            <div className="text-zinc-500">Walls</div>
            <div className="font-mono-tabular font-bold text-emerald-300">
              {progression.wallsBroken.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="font-display cartoony-outline flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-500 px-5 py-3 text-xl font-black text-zinc-950 shadow-[0_4px_0_#92400E] hover:bg-amber-400 active:translate-y-0.5"
          >
            <Play className="h-5 w-5 fill-zinc-950" />
            RESUME RUN
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="font-display flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-[#1B1F29] px-4 py-2.5 text-base font-bold text-zinc-100 hover:border-amber-400 hover:text-amber-300"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            Leaderboards
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="font-display flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-[#1B1F29] px-4 py-2.5 text-base font-bold text-zinc-100 hover:border-amber-400 hover:text-amber-300"
          >
            <Settings className="h-4 w-4 text-sky-400" />
            Settings (Audio, Graphics, Keys)
          </button>

          <button
            type="button"
            onClick={onOpenStore}
            className="font-display flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-[#1B1526] px-4 py-2.5 text-base font-bold text-purple-200 hover:border-purple-400"
          >
            <ShoppingBag className="h-4 w-4 text-purple-300" />
            Supporter Store (Coming Soon)
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="font-display mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-[#221419] px-4 py-2.5 text-base font-bold text-rose-200 hover:border-rose-400 hover:bg-rose-950/60"
          >
            <LogOut className="h-4 w-4 text-rose-400" />
            Quit to Title Screen
          </button>
        </div>

        <p className="mt-3 text-[11px] text-zinc-500">
          Quitting saves your run to Highscores and ends the current session.
        </p>
      </div>
    </div>
  );
}
