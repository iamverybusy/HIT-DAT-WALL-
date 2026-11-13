import type { User } from 'firebase/auth';
import { Check, Globe, HardDrive, LogIn, LogOut, RefreshCw, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import {
  computeEffectivePunchPower,
  formatCompact,
  getGloveById,
} from '../constants/gameData';
import type { LeaderboardEntry, LocalHighscoreEntry, PlayerProgression } from '../types/game';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  localHighscores: LocalHighscoreEntry[];
  loading: boolean;
  error: string | null;
  user: User | null;
  progression: PlayerProgression;
  onClose: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateDisplayName: (name: string) => void;
}

export function LeaderboardModal({
  entries,
  localHighscores,
  loading,
  error,
  user,
  progression,
  onClose,
  onRefresh,
  onSignIn,
  onSignOut,
  onUpdateDisplayName,
}: LeaderboardModalProps) {
  const [tab, setTab] = useState<'local' | 'global'>(user ? 'global' : 'local');
  const [nameDraft, setNameDraft] = useState(progression.displayName);
  const [savedFlag, setSavedFlag] = useState(false);

  const myPower = computeEffectivePunchPower(progression);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDisplayName(nameDraft);
    setSavedFlag(true);
    window.setTimeout(() => setSavedFlag(false), 1600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rankings-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#14161B] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-[#1D2027] text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 id="rankings-title" className="font-display text-2xl font-bold text-zinc-100">
                HIT DAT WALL! Leaderboards
              </h2>
              <p className="text-sm text-zinc-400">
                Track your local best runs and global cloud wall-breaker rankings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh leaderboard"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-[#1D2027] text-zinc-300 hover:border-amber-500/50 hover:text-zinc-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close leaderboard"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-[#1D2027] text-zinc-300 hover:border-amber-500/50 hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Account, Display Name Editor & Personal Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-[#101216] px-6 py-3.5">
          <form onSubmit={handleSaveName} className="flex items-center gap-2">
            <input
              type="text"
              maxLength={28}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              aria-label="Fighter display name"
              className="w-36 rounded-lg border border-zinc-700 bg-[#181B22] px-2.5 py-1.5 text-xs font-semibold text-zinc-100 outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-[#1D2027] px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:border-amber-400"
            >
              {savedFlag ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
              {savedFlag ? 'Saved' : 'Save Name'}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span>
              <span className="text-zinc-400">Current Best: </span>
              <strong className="font-mono-tabular text-amber-300">
                Stage #{progression.highestStage}
              </strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">
              ·
            </span>
            <span>
              <strong className="font-mono-tabular text-zinc-100">
                {formatCompact(myPower)} PWR
              </strong>
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-400">
                Synced · {user.displayName || progression.displayName}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#1D2027] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-amber-500/40 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 whitespace-nowrap"
            >
              <LogIn className="h-3.5 w-3.5" />
              Account Sign In
            </button>
          )}
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex gap-2 border-b border-zinc-800 bg-[#12141A] px-6 py-2.5">
          <button
            type="button"
            onClick={() => setTab('local')}
            className={`font-display flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${
              tab === 'local'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-700 bg-[#1A1D25] text-zinc-300 hover:border-amber-400/50'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            Local Highscores ({localHighscores.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('global');
              onRefresh();
            }}
            className={`font-display flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${
              tab === 'global'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-700 bg-[#1A1D25] text-zinc-300 hover:border-amber-400/50'
            }`}
          >
            <Globe className="h-4 w-4" />
            Global Cloud Rankings
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-y-auto p-6">
          {tab === 'local' ? (
            localHighscores.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-[#181B22] py-10 text-center text-sm text-zinc-400">
                No completed runs recorded yet. Start punching walls to set your first local
                highscore!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-400">
                      <th className="pb-3 pr-3">Rank</th>
                      <th className="pb-3 pr-3">Fighter</th>
                      <th className="pb-3 pr-3 text-right">Stage</th>
                      <th className="pb-3 pr-3 text-right">Walls</th>
                      <th className="pb-3 pr-3 text-right">Power</th>
                      <th className="pb-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {localHighscores.map((entry, idx) => (
                      <tr key={entry.id} className={idx === 0 ? 'bg-amber-500/10' : ''}>
                        <td className="py-3 pr-3 font-mono-tabular font-bold text-amber-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3 pr-3 font-medium text-zinc-100">
                          {entry.playerName}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono-tabular font-bold text-amber-300">
                          Stage {entry.highestStage}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono-tabular text-zinc-300">
                          {entry.wallsBroken.toLocaleString()}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono-tabular text-zinc-200">
                          {formatCompact(entry.punchPower)}
                        </td>
                        <td className="py-3 text-right text-xs">
                          <span
                            className={
                              entry.reason === 'Boss Failed'
                                ? 'font-semibold text-rose-400'
                                : 'font-semibold text-zinc-400'
                            }
                          >
                            {entry.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : loading && entries.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">
              Loading cloud rankings...
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-[#181B22] py-10 text-center text-sm text-zinc-400">
              No cloud rankings yet. Sign in with an account and smash a wall to claim Rank 1!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-400">
                    <th className="pb-3 pr-4">Rank</th>
                    <th className="pb-3 pr-4">Player</th>
                    <th className="pb-3 pr-4 text-right">Wall Stage</th>
                    <th className="pb-3 pr-4 text-right">Walls Broken</th>
                    <th className="pb-3 text-right">Power</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {entries.map((entry, idx) => {
                    const isSelf = user?.uid === entry.uid;
                    const glove = getGloveById(entry.gloveId);
                    return (
                      <tr key={entry.uid} className={isSelf ? 'bg-amber-500/10' : ''}>
                        <td className="py-3 pr-4 font-mono-tabular font-bold text-amber-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="inline-block h-3 w-3 shrink-0 rounded-sm border border-zinc-600"
                              style={{ backgroundColor: glove.knuckleColor }}
                              aria-hidden="true"
                            />
                            <span className="font-medium text-zinc-100">
                              {entry.displayName}
                              {isSelf ? ' (You)' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-tabular font-bold text-amber-300">
                          Stage {entry.highestStage}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-tabular text-zinc-300">
                          {entry.wallsBroken.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono-tabular text-zinc-200">
                          {formatCompact(entry.punchPower)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
