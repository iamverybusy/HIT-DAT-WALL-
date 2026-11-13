import { Keyboard, Monitor, RotateCcw, Settings, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, formatKeyCode } from '../constants/gameData';
import type { GameSettings, GraphicsQuality, KeybindAction } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

const KEYBIND_LABELS: Array<{ action: KeybindAction; label: string; hint: string }> = [
  { action: 'punch', label: 'Primary Punch', hint: 'Throw aimed punch' },
  { action: 'altPunch', label: 'Alternate Punch', hint: 'Secondary punch key' },
  { action: 'overdrive', label: 'Overdrive Limit Break', hint: 'Unleash Fury Surge at 100% Rage' },
  { action: 'switchTarget', label: 'Switch Wall / Heavy Bag', hint: 'Swap between Wall & Bag' },
  { action: 'autoPunch', label: 'Toggle Auto-Punch', hint: 'Hands-free punch loop' },
  { action: 'toggleDock', label: 'Hide / Show Control Dock', hint: 'Minimize bottom buttons' },
  { action: 'pause', label: 'Pause Menu', hint: 'Also works with ESC' },
];

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<'audio' | 'graphics' | 'keybinds'>('audio');
  const [rebindingAction, setRebindingAction] = useState<KeybindAction | null>(null);

  useEffect(() => {
    if (!rebindingAction) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRebindingAction(null);
        return;
      }
      onChange({
        ...settings,
        keybinds: {
          ...settings.keybinds,
          [rebindingAction]: e.code,
        },
      });
      setRebindingAction(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [rebindingAction, settings, onChange]);

  const updateQuality = (q: GraphicsQuality) => {
    onChange({
      ...settings,
      graphicsQuality: q,
      dofEnabled: q === 'low' ? false : settings.dofEnabled,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#14161D] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/35 bg-[#1D2027] text-sky-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 id="settings-title" className="font-display text-2xl font-bold text-zinc-100">
                Game Settings
              </h2>
              <p className="text-xs text-zinc-400">
                Customize audio mix, 3D visual effects, and keyboard controls.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-[#1D2027] text-zinc-300 hover:border-amber-400 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 border-b border-zinc-800 bg-[#101218] px-6 py-3">
          <button
            type="button"
            onClick={() => setTab('audio')}
            className={`font-display flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === 'audio'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-700 bg-[#1A1D25] text-zinc-300 hover:border-amber-400/50'
            }`}
          >
            <Volume2 className="h-4 w-4" />
            Audio
          </button>
          <button
            type="button"
            onClick={() => setTab('graphics')}
            className={`font-display flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === 'graphics'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-700 bg-[#1A1D25] text-zinc-300 hover:border-amber-400/50'
            }`}
          >
            <Monitor className="h-4 w-4" />
            Graphics
          </button>
          <button
            type="button"
            onClick={() => setTab('keybinds')}
            className={`font-display flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === 'keybinds'
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-700 bg-[#1A1D25] text-zinc-300 hover:border-amber-400/50'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            Keymapping
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {tab === 'audio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div>
                  <div className="font-bold text-zinc-100">Master Audio Mute</div>
                  <div className="text-xs text-zinc-400">
                    Silence all soundtrack music, punches, and glove aura swooshes.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, muted: !settings.muted })}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                    settings.muted
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-500 text-zinc-950'
                  }`}
                >
                  {settings.muted ? 'MUTED' : 'ACTIVE'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div>
                  <div className="font-bold text-zinc-100">Cozy Lo-Poly Forever Loop Music</div>
                  <div className="text-xs text-zinc-400">
                    Smooth hype-yet-chill instrumental groove while training &amp; breaking walls.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, bgmEnabled: !settings.bgmEnabled })}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                    settings.bgmEnabled
                      ? 'bg-amber-500 text-zinc-950'
                      : 'border border-zinc-700 bg-[#12141A] text-zinc-400'
                  }`}
                >
                  {settings.bgmEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-zinc-200">
                    <span>Master Volume</span>
                    <span className="font-mono-tabular text-amber-300">
                      {Math.round(settings.masterVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.masterVolume * 100)}
                    onChange={(e) =>
                      onChange({ ...settings, masterVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-zinc-200">
                    <span>Soundtrack Music Volume</span>
                    <span className="font-mono-tabular text-amber-300">
                      {Math.round(settings.bgmVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.bgmVolume * 100)}
                    onChange={(e) =>
                      onChange({ ...settings, bgmVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-zinc-200">
                    <span>Punch, Shatter &amp; Glove Aura SFX</span>
                    <span className="font-mono-tabular text-amber-300">
                      {Math.round(settings.sfxVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.sfxVolume * 100)}
                    onChange={(e) =>
                      onChange({ ...settings, sfxVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'graphics' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div className="font-bold text-zinc-100">Render Quality Preset</div>
                <div className="mt-0.5 text-xs text-zinc-400">
                  Controls resolution scale, shadows, and Depth of Field blur.
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as GraphicsQuality[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateQuality(preset)}
                      className={`font-display rounded-xl border py-2 text-sm font-bold uppercase ${
                        settings.graphicsQuality === preset
                          ? 'border-amber-400 bg-amber-500 text-zinc-950'
                          : 'border-zinc-700 bg-[#12141A] text-zinc-300 hover:border-amber-400/50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div>
                  <div className="font-bold text-zinc-100">Depth of Field (Bokeh)</div>
                  <div className="text-xs text-zinc-400">
                    Cinema focus blur around foreground gloves &amp; background arena.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={settings.graphicsQuality === 'low'}
                  onClick={() => onChange({ ...settings, dofEnabled: !settings.dofEnabled })}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-40 ${
                    settings.dofEnabled && settings.graphicsQuality !== 'low'
                      ? 'bg-amber-500 text-zinc-950'
                      : 'border border-zinc-700 bg-[#12141A] text-zinc-400'
                  }`}
                >
                  {settings.dofEnabled && settings.graphicsQuality !== 'low' ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div>
                  <div className="font-bold text-zinc-100">Floating Comic Words &amp; Numbers</div>
                  <div className="text-xs text-zinc-400">
                    Show POW!, CRUNCH!, and damage numbers popping off impacts.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...settings, showFloatingNumbers: !settings.showFloatingNumbers })
                  }
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                    settings.showFloatingNumbers
                      ? 'bg-amber-500 text-zinc-950'
                      : 'border border-zinc-700 bg-[#12141A] text-zinc-400'
                  }`}
                >
                  {settings.showFloatingNumbers ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#191C24] p-4">
                <div className="mb-1 flex justify-between text-xs font-semibold text-zinc-200">
                  <span>Camera Hit-Shake Intensity</span>
                  <span className="font-mono-tabular text-amber-300">
                    {Math.round(settings.shakeIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={Math.round(settings.shakeIntensity * 100)}
                  onChange={(e) =>
                    onChange({ ...settings, shakeIntensity: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          )}

          {tab === 'keybinds' && (
            <div className="space-y-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Click a key button, then press any key to rebind. Press ESC to cancel.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...settings, keybinds: { ...DEFAULT_SETTINGS.keybinds } })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#1D2027] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-amber-400"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Defaults
                </button>
              </div>

              {KEYBIND_LABELS.map((item) => {
                const isListening = rebindingAction === item.action;
                return (
                  <div
                    key={item.action}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#191C24] px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-zinc-100">{item.label}</div>
                      <div className="text-xs text-zinc-400">{item.hint}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRebindingAction(item.action)}
                      className={`font-mono-tabular min-w-[92px] rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                        isListening
                          ? 'border-amber-400 bg-amber-500 text-zinc-950'
                          : 'border-zinc-700 bg-[#12141A] text-amber-300 hover:border-amber-400'
                      }`}
                    >
                      {isListening ? 'Press Key...' : formatKeyCode(settings.keybinds[item.action])}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-800 bg-[#101218] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="font-display rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
