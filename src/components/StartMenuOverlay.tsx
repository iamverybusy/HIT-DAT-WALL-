import type { User } from 'firebase/auth';
import {
  Check,
  Crown,
  LogIn,
  LogOut,
  Play,
  Power,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { formatCompact } from '../constants/gameData';
import type { LocalHighscoreEntry, PlayerProgression } from '../types/game';

interface StartMenuOverlayProps {
  user: User | null;
  progression: PlayerProgression;
  localHighscores: LocalHighscoreEntry[];
  onStartGame: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
  onOpenStore: () => void;
  onExitGame: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateDisplayName: (name: string) => void;
}

export function StartMenuOverlay({
  user,
  progression,
  localHighscores,
  onStartGame,
  onOpenLeaderboard,
  onOpenSettings,
  onOpenStore,
  onExitGame,
  onSignIn,
  onSignOut,
  onUpdateDisplayName,
}: StartMenuOverlayProps) {
  const [nameDraft, setNameDraft] = useState(progression.displayName);
  const [nameSaved, setNameSaved] = useState(false);

  const bestLocal = localHighscores[0] ?? null;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDisplayName(nameDraft);
    setNameSaved(true);
    window.setTimeout(() => setNameSaved(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-gradient-to-b from-black/70 via-black/45 to-black/80 p-4 sm:p-6">
      {/* Top Account & Player Name Bar */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-700/75 bg-[#12141A]/88 px-4 py-2.5 shadow-xl">
        <form onSubmit={handleSaveName} className="flex items-center gap-2">
          <label htmlFor="start-player-name" className="text-xs font-semibold text-zinc-400">
            Fighter:
          </label>
          <input
            id="start-player-name"
            type="text"
            maxLength={28}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your Name"
            className="w-36 rounded-lg border border-zinc-700 bg-[#1B1E26] px-2.5 py-1 text-sm font-semibold text-zinc-100 outline-none focus:border-amber-400 sm:w-44"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-[#1D2027] px-2.5 py-1 text-xs font-bold text-amber-300 hover:border-amber-400 hover:bg-amber-500/15"
          >
            {nameSaved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
            {nameSaved ? 'Saved' : 'Set'}
          </button>
        </form>

        <div className="flex items-center gap-2.5">
          {bestLocal && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-[#181B23] px-3 py-1 text-xs text-zinc-300">
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span>Best Run:</span>
              <strong className="font-mono-tabular text-amber-300">
                Stage {bestLocal.highestStage}
              </strong>
              <span className="text-zinc-500">({formatCompact(bestLocal.punchPower)} PWR)</span>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-emerald-500/35 bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {user.displayName?.split(' ')[0] || progression.displayName}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-[#1D2027] px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:border-amber-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400"
            >
              <LogIn className="h-3.5 w-3.5" />
              Account Sign In
            </button>
          )}
        </div>
      </div>

      {/* Center Hero Title & Menu Actions */}
      <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-[#151820]/90 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-amber-300 shadow">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          by LiveBetterGameS
        </div>

        <h1 className="font-display cartoony-outline text-5xl font-black uppercase tracking-wide text-amber-400 sm:text-7xl">
          HIT DAT WALL!
        </h1>
        <p className="mt-2 max-w-md text-sm font-medium text-zinc-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-base">
          Aim your fists, shatter brick &amp; obsidian vaults, survive Boss timers, and climb the
          rankings.
        </p>

        <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
          <button
            type="button"
            onClick={onStartGame}
            className="font-display cartoony-outline flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-amber-300 bg-amber-500 px-6 py-3.5 text-2xl font-black tracking-wide text-zinc-950 shadow-[0_6px_0_#92400E] transition-transform hover:bg-amber-400 active:translate-y-1 active:shadow-[0_2px_0_#92400E]"
          >
            <Play className="h-6 w-6 fill-zinc-950" />
            START GAME
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="font-display flex items-center justify-center gap-2 rounded-xl border border-zinc-600/80 bg-[#151820]/92 px-4 py-2.5 text-base font-bold text-zinc-100 shadow-lg hover:border-amber-400 hover:text-amber-300"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              Leaderboards
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="font-display flex items-center justify-center gap-2 rounded-xl border border-zinc-600/80 bg-[#151820]/92 px-4 py-2.5 text-base font-bold text-zinc-100 shadow-lg hover:border-amber-400 hover:text-amber-300"
            >
              <Settings className="h-4 w-4 text-sky-400" />
              Settings
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenStore}
              className="font-display flex items-center justify-center gap-2 rounded-xl border border-purple-500/45 bg-[#1B1526]/92 px-4 py-2.5 text-sm font-bold text-purple-200 shadow-lg hover:border-purple-400 hover:text-white"
            >
              <ShoppingBag className="h-4 w-4 text-purple-300" />
              Supporter Store
            </button>

            <button
              type="button"
              onClick={onExitGame}
              className="font-display flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-[#201418]/92 px-4 py-2.5 text-sm font-bold text-rose-200 shadow-lg hover:border-rose-400 hover:text-white"
            >
              <Power className="h-4 w-4 text-rose-400" />
              Exit Game
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-400">
          Each new game begins fresh at Wall 1 · Owned IRL Supporter items &amp; Settings stay saved.
        </p>
      </div>

      {/* Persistent Bottom Legal, Early Development, Feedback & Donations Footer */}
      <footer className="mx-auto w-full max-w-4xl rounded-xl border border-zinc-800/80 bg-[#0D0F14]/88 px-4 py-2.5 text-center text-[11px] leading-relaxed text-zinc-400 shadow-lg">
        <span className="font-semibold text-zinc-200">
          © 2025 LiveBetterGameS · HIT DAT WALL!
        </span>{' '}
        All trademarks &amp; assets owned by LiveBetterGameS.{' '}
        <span className="text-amber-300/95">
          This game is still in active development — features, balance &amp; progression are
          evolving.
        </span>{' '}
        Thank you all for playing! Feedback and donations are highly encouraged — enjoy!
      </footer>
    </div>
  );
}
