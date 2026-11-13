import { useState } from 'react';
import {
  Activity,
  Award,
  Check,
  Clock,
  Coins,
  Crosshair,
  Crown,
  Dumbbell,
  Flame,
  Hammer,
  Lock,
  Palette,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import {
  BAG_COLOR_PRESETS,
  BAG_DEFINITIONS,
  computeGoldenKnucklesEarned,
  computeMaxUpgradePurchase,
  formatCompact,
  getPrestigeUpgradeCost,
  getRebirthStipulations,
  getUpgradeCost,
  GLOVE_COLOR_PRESETS,
  GLOVE_DEFINITIONS,
  PRESTIGE_UPGRADE_DEFS,
  SKIN_TONE_PRESETS,
  UPGRADE_DEFS,
} from '../constants/gameData';
import type { PlayerProgression, PrestigeKey, UpgradeKey } from '../types/game';

export type ArmoryTab = 'gloves' | 'bags' | 'upgrades' | 'rebirth';
type CatalogFilter = 'all' | 'affordable' | 'owned';

interface ShopAndUpgradesModalProps {
  initialTab: ArmoryTab;
  currentStage: number;
  progression: PlayerProgression;
  onClose: () => void;
  onBuyOrEquipGlove: (gloveId: string) => void;
  onSelectGloveColor: (colorId: string) => void;
  onSelectSkinTone: (toneId: string) => void;
  onBuyOrEquipBag: (bagId: string) => void;
  onSelectBagColor: (colorId: string) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onBuyMaxUpgrade: (key: UpgradeKey) => void;
  onBuyPrestigeUpgrade: (key: PrestigeKey) => void;
  onRebirth: () => void;
}

const UPGRADE_ICONS: Record<UpgradeKey, typeof Dumbbell> = {
  power: Dumbbell,
  speed: Zap,
  crit: Flame,
  wealth: Coins,
  splash: Target,
  combo: Activity,
};

const PRESTIGE_ICONS: Record<PrestigeKey, typeof Crown> = {
  titan: Dumbbell,
  midas: Coins,
  bagmaster: Shield,
  starter: Crown,
  shockwave: Hammer,
  weakspot: Crosshair,
  chaincrit: Flame,
  combomaster: Activity,
  overdrive: Zap,
  idle: Clock,
};

export function ShopAndUpgradesModal({
  initialTab,
  currentStage,
  progression,
  onClose,
  onBuyOrEquipGlove,
  onSelectGloveColor,
  onSelectSkinTone,
  onBuyOrEquipBag,
  onSelectBagColor,
  onBuyUpgrade,
  onBuyMaxUpgrade,
  onBuyPrestigeUpgrade,
  onRebirth,
}: ShopAndUpgradesModalProps) {
  const [tab, setTab] = useState<ArmoryTab>(initialTab);
  const [gloveFilter, setGloveFilter] = useState<CatalogFilter>('all');
  const [bagFilter, setBagFilter] = useState<CatalogFilter>('all');
  const stipulations = getRebirthStipulations(progression, currentStage);
  const canRebirth = stipulations.allMet;
  const knucklesPreview = computeGoldenKnucklesEarned(currentStage, progression.rebirths);

  const filteredGloves = GLOVE_DEFINITIONS.filter((g) => {
    const owned = progression.unlockedGloves.includes(g.id);
    if (gloveFilter === 'owned') return owned;
    if (gloveFilter === 'affordable') return !owned && progression.coins >= g.cost;
    return true;
  });

  const filteredBags = BAG_DEFINITIONS.filter((b) => {
    const owned = progression.unlockedBags.includes(b.id);
    if (bagFilter === 'owned') return owned;
    if (bagFilter === 'affordable') return !owned && progression.coins >= b.cost;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="armory-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#14161B] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 id="armory-title" className="font-display text-2xl font-bold text-zinc-100">
              Armory &amp; Training
            </h2>
            <p className="mt-0.5 text-sm text-zinc-400">
              Customize 3D gauntlets &amp; heavy bags, upgrade striking stats, or rebirth.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-[#1D2027] px-3 py-2"
              title="Coins"
            >
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-mono-tabular text-sm font-bold text-amber-300">
                {formatCompact(progression.coins)}
              </span>
            </div>
            <div
              className="flex items-center gap-2 rounded-lg border border-yellow-400/35 bg-[#1D2027] px-3 py-2"
              title="Golden Knuckles (Prestige Currency)"
            >
              <Award className="h-4 w-4 text-yellow-400" />
              <span className="font-mono-tabular text-sm font-bold text-yellow-300">
                {formatCompact(progression.goldenKnuckles)} GK
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close armory"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-[#1D2027] text-zinc-300 hover:border-amber-500/50 hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-[#101216] px-6 py-3">
          {(['gloves', 'bags', 'upgrades', 'rebirth'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                tab === t
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              {t === 'gloves'
                ? '3D Gloves & Style'
                : t === 'bags'
                  ? 'Heavy Bags'
                  : t === 'upgrades'
                    ? 'Stat Upgrades'
                    : 'Prestige & Rebirth'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          {tab === 'gloves' && (
            <div className="space-y-5">
              {/* Custom Paint & Skin Tone Customizer */}
              <div className="grid gap-4 rounded-xl border border-zinc-800 bg-[#181B22] p-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    <Palette className="h-3.5 w-3.5 text-amber-400" />
                    <span>Glove Paint Finish</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {GLOVE_COLOR_PRESETS.map((preset) => {
                      const active = progression.equippedGloveColor === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onSelectGloveColor(preset.id)}
                          title={preset.name}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                              : 'border-zinc-700 bg-[#121419] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{
                              background: preset.primaryHex
                                ? `linear-gradient(135deg, ${preset.primaryHex} 55%, ${preset.accentHex} 55%)`
                                : 'linear-gradient(135deg, #52525b 55%, #f59e0b 55%)',
                            }}
                          />
                          <span>{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    <Palette className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Arm Skin / Cyber Sleeve</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_TONE_PRESETS.map((tone) => {
                      const active = progression.skinTone === tone.id;
                      return (
                        <button
                          key={tone.id}
                          type="button"
                          onClick={() => onSelectSkinTone(tone.id)}
                          title={tone.name}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                              : 'border-zinc-700 bg-[#121419] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{ backgroundColor: tone.hex }}
                          />
                          <span>{tone.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 20 Unlockable 3D Gloves Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-400">
                  Unlocked {progression.unlockedGloves.length} / {GLOVE_DEFINITIONS.length} 3D Gloves
                </div>
                <div className="flex items-center gap-1.5">
                  {(['all', 'affordable', 'owned'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setGloveFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        gloveFilter === f
                          ? 'bg-amber-500 text-zinc-950'
                          : 'border border-zinc-700 bg-[#181B22] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'affordable' ? 'Can Buy' : 'Owned'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {filteredGloves.map((g) => {
                  const owned = progression.unlockedGloves.includes(g.id);
                  const equipped = progression.equippedGlove === g.id;
                  const canAfford = progression.coins >= g.cost;

                  return (
                    <div
                      key={g.id}
                      className={`flex flex-col justify-between rounded-xl border p-5 ${
                        equipped
                          ? 'border-amber-400/70 bg-[#1E222B]'
                          : 'border-zinc-800 bg-[#181B22]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-600/50"
                              style={{ backgroundColor: g.color }}
                            >
                              <div
                                className="h-4 w-6 rounded-sm"
                                style={{ backgroundColor: g.knuckleColor }}
                              />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-zinc-100">{g.name}</h3>
                              <div className="font-mono-tabular text-xs font-semibold text-amber-400">
                                {g.multiplier}x Punch Power
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                          {g.description}
                        </p>
                      </div>

                      <div className="mt-5">
                        <button
                          type="button"
                          disabled={!owned && !canAfford}
                          onClick={() => onBuyOrEquipGlove(g.id)}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                            equipped
                              ? 'border border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                              : owned
                                ? 'border border-amber-500/40 bg-[#232730] text-amber-200 hover:bg-amber-500 hover:text-zinc-950'
                                : canAfford
                                  ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                                  : 'border border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {equipped ? (
                            <>
                              <Check className="h-4 w-4" />
                              Equipped
                            </>
                          ) : owned ? (
                            'Equip Gloves'
                          ) : (
                            <>
                              <Lock className="h-4 w-4" />
                              <span>Buy · {formatCompact(g.cost)}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'bags' && (
            <div className="space-y-5">
              {/* Heavy Bag Paint Customizer */}
              <div className="rounded-xl border border-zinc-800 bg-[#181B22] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  <Palette className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Heavy Bag Wrap Finish</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BAG_COLOR_PRESETS.map((preset) => {
                    const active = progression.equippedBagColor === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectBagColor(preset.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                            : 'border-zinc-700 bg-[#121419] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-sm border border-white/25"
                          style={{
                            background: preset.primaryHex
                              ? `linear-gradient(135deg, ${preset.primaryHex} 55%, ${preset.accentHex} 55%)`
                              : 'linear-gradient(135deg, #991b1b 55%, #94a3b8 55%)',
                          }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 16 Unlockable Heavy Bags Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-400">
                  Unlocked {progression.unlockedBags.length} / {BAG_DEFINITIONS.length} Heavy Bags
                </div>
                <div className="flex items-center gap-1.5">
                  {(['all', 'affordable', 'owned'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setBagFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        bagFilter === f
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'border border-zinc-700 bg-[#181B22] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'affordable' ? 'Can Buy' : 'Owned'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {filteredBags.map((bag) => {
                  const owned = progression.unlockedBags.includes(bag.id);
                  const equipped = progression.equippedBag === bag.id;
                  const canAfford = progression.coins >= bag.cost;

                  return (
                    <div
                      key={bag.id}
                      className={`flex flex-col justify-between rounded-xl border p-5 ${
                        equipped
                          ? 'border-emerald-400/70 bg-[#17211E]'
                          : 'border-zinc-800 bg-[#181B22]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-600/50"
                            style={{ backgroundColor: bag.bodyColor }}
                          >
                            <div
                              className="h-2.5 w-8 rounded-sm"
                              style={{ backgroundColor: bag.metalColor }}
                            />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-zinc-100">{bag.name}</h3>
                            <div className="font-mono-tabular text-xs font-semibold text-emerald-400">
                              {bag.strMultiplier.toFixed(1)}x Bag STR
                              {bag.coinBonus > 0
                                ? ` · +${Math.round(bag.coinBonus * 100)}% Coins`
                                : ''}
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                          {bag.description}
                        </p>
                      </div>

                      <div className="mt-5">
                        <button
                          type="button"
                          disabled={!owned && !canAfford}
                          onClick={() => onBuyOrEquipBag(bag.id)}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                            equipped
                              ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                              : owned
                                ? 'border border-emerald-500/40 bg-[#20272B] text-emerald-200 hover:bg-emerald-500 hover:text-zinc-950'
                                : canAfford
                                  ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                                  : 'border border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {equipped ? (
                            <>
                              <Check className="h-4 w-4" />
                              Equipped Bag
                            </>
                          ) : owned ? (
                            'Equip Bag'
                          ) : (
                            <>
                              <Lock className="h-4 w-4" />
                              <span>Buy · {formatCompact(bag.cost)}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'upgrades' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {UPGRADE_DEFS.map((def) => {
                const level = progression.upgrades[def.key];
                const isMax = level >= def.maxLevel;
                const cost = getUpgradeCost(def, level);
                const canAfford = progression.coins >= cost;
                const maxPurchase = computeMaxUpgradePurchase(def, level, progression.coins);
                const Icon = UPGRADE_ICONS[def.key];

                return (
                  <div
                    key={def.key}
                    className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#181B22] p-5"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-[#222630] text-amber-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-zinc-100">{def.name}</h3>
                          <div className="font-mono-tabular text-xs text-zinc-400">
                            Rank {level} / {def.maxLevel} ·{' '}
                            <span className="text-emerald-400">{def.effectText(level)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        {def.description}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isMax || !canAfford}
                        onClick={() => onBuyUpgrade(def.key)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                          isMax
                            ? 'border border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                            : canAfford
                              ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                              : 'border border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? (
                          <>
                            <Check className="h-4 w-4" />
                            Max Rank
                          </>
                        ) : (
                          <>
                            <Coins className="h-4 w-4" />
                            <span>Upgrade · {formatCompact(cost)}</span>
                          </>
                        )}
                      </button>

                      {!isMax && maxPurchase.levelsToBuy >= 2 && (
                        <button
                          type="button"
                          onClick={() => onBuyMaxUpgrade(def.key)}
                          className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500 hover:text-zinc-950 whitespace-nowrap shrink-0 transition-colors"
                        >
                          Buy +{maxPurchase.levelsToBuy}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'rebirth' && (
            <div className="space-y-6">
              {/* Rebirth Ascension & Stipulations Card */}
              <div className="rounded-xl border border-amber-500/25 bg-[#181B22] p-6">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-400">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 font-display text-2xl font-bold text-zinc-100">
                    Rebirth Ascension · Tier {progression.rebirths}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
                    Reset current stage, coins, strength, and rank upgrades to Stage 1 for a
                    permanent <strong className="text-amber-300">+60% Power Multiplier</strong>{' '}
                    (currently{' '}
                    <span className="font-mono-tabular text-emerald-400">
                      {(1 + progression.rebirths * 0.6).toFixed(1)}x
                    </span>
                    ), <strong className="text-emerald-300">+45% Bag STR</strong>, and{' '}
                    <strong className="text-yellow-300">Golden Knuckles</strong>. Your 3D gloves,
                    heavy bags, skins, Golden Knuckles, Prestige perks, and Achievements stay
                    forever.
                  </p>

                  {progression.prestigeUpgrades.starter > 0 && (
                    <p className="mt-2 text-xs font-medium text-emerald-300">
                      Vault Inheritance active: Next Rebirth starts with{' '}
                      {formatCompact(progression.prestigeUpgrades.starter * 150)} Coins &amp; +
                      {formatCompact(progression.prestigeUpgrades.starter * 10)} Strength.
                    </p>
                  )}
                </div>

                {/* Stipulations Checklist */}
                <div className="mx-auto mt-5 max-w-xl space-y-2.5 rounded-xl border border-zinc-800 bg-[#121419] p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    <span>Rebirth Stipulations ({stipulations.items.filter((s) => s.met).length} / {stipulations.items.length})</span>
                  </div>
                  {stipulations.items.map((item) => {
                    const pct = Math.min(100, (item.current / item.target) * 100);
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`flex items-center gap-1.5 font-medium ${
                              item.met ? 'text-emerald-300' : 'text-zinc-300'
                            }`}
                          >
                            {item.met ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Lock className="h-3.5 w-3.5 text-zinc-500" />
                            )}
                            {item.label}
                          </span>
                          <span className="font-mono-tabular text-zinc-400">
                            {formatCompact(Math.min(item.current, item.target))} /{' '}
                            {formatCompact(item.target)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full transition-[width] duration-150 ${
                              item.met ? 'bg-emerald-400' : 'bg-amber-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 text-center">
                  <button
                    type="button"
                    disabled={!canRebirth}
                    onClick={onRebirth}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors ${
                      canRebirth
                        ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Award className="h-4 w-4" />
                    {canRebirth
                      ? `Rebirth Now (+${knucklesPreview} Golden Knuckle${knucklesPreview === 1 ? '' : 's'})`
                      : 'Complete All Stipulations to Rebirth'}
                  </button>
                </div>
              </div>

              {/* Permanent Prestige Shop */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-display text-lg font-bold text-zinc-100">
                      Golden Knuckles Prestige Shop
                    </h4>
                    <p className="text-xs text-zinc-400">
                      10 permanent passives and crater-carving abilities (up to Rank 20) that never
                      reset on Rebirth.
                    </p>
                  </div>
                  <div className="font-mono-tabular text-sm font-bold text-yellow-300 whitespace-nowrap shrink-0">
                    {formatCompact(progression.goldenKnuckles)} GK Available
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {PRESTIGE_UPGRADE_DEFS.map((def) => {
                    const level = progression.prestigeUpgrades[def.key];
                    const isMax = level >= def.maxLevel;
                    const cost = getPrestigeUpgradeCost(def, level);
                    const canAfford = progression.goldenKnuckles >= cost;
                    const Icon = PRESTIGE_ICONS[def.key];

                    return (
                      <div
                        key={def.key}
                        className="flex flex-col justify-between rounded-xl border border-yellow-500/20 bg-[#181B22] p-5"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-yellow-500/35 bg-yellow-500/10 text-yellow-400">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h5 className="truncate text-base font-semibold text-zinc-100">
                                  {def.name}
                                </h5>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                    def.category === 'Ability' ? 'text-cyan-300' : 'text-amber-300'
                                  }`}
                                >
                                  {def.category}
                                </span>
                              </div>
                              <div className="font-mono-tabular text-xs text-zinc-400">
                                Rank {level} / {def.maxLevel} ·{' '}
                                <span className="text-yellow-300">{def.effectText(level)}</span>
                              </div>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                            {def.description}
                          </p>
                        </div>

                        <div className="mt-5">
                          <button
                            type="button"
                            disabled={isMax || !canAfford}
                            onClick={() => onBuyPrestigeUpgrade(def.key)}
                            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                              isMax
                                ? 'border border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                                : canAfford
                                  ? 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300'
                                  : 'border border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {isMax ? (
                              <>
                                <Check className="h-4 w-4" />
                                Max Rank
                              </>
                            ) : (
                              <>
                                <Award className="h-4 w-4" />
                                <span>
                                  {level === 0 ? 'Unlock' : 'Upgrade'} · {formatCompact(cost)} GK
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
