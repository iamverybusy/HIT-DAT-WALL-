export type TargetMode = 'WALL' | 'BAG';

export type WallMaterialKind =
  | 'drywall'
  | 'wood'
  | 'brick'
  | 'concrete'
  | 'steel'
  | 'obsidian'
  | 'diamond';

export interface WallSpec {
  stage: number;
  name: string;
  material: WallMaterialKind;
  maxHp: number;
  breakReward: number;
  strengthPerPunch: number;
  baseColor: string;
  accentColor: string;
}

export type GloveStyleVariant =
  | 'wraps'
  | 'boxing'
  | 'brass'
  | 'robot'
  | 'flaming'
  | 'diamond'
  | 'carbon'
  | 'titanium'
  | 'plasma'
  | 'celestial'
  | 'emerald'
  | 'frost'
  | 'obsidian_fist'
  | 'neon_synth'
  | 'samurai'
  | 'mecha_gold'
  | 'void_reaver'
  | 'crimson_demon'
  | 'quantum'
  | 'galaxian';

export interface GloveDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  multiplier: number;
  style: GloveStyleVariant;
  color: string;
  cuffColor: string;
  knuckleColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  emissiveIntensity: number;
}

export type BagStyleVariant =
  | 'leather'
  | 'canvas'
  | 'kevlar'
  | 'iron'
  | 'obsidian'
  | 'diamond'
  | 'chrome'
  | 'jade'
  | 'magma'
  | 'cyber'
  | 'titanium'
  | 'inferno'
  | 'void'
  | 'gold'
  | 'neon'
  | 'celestial';

export interface BagDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  strMultiplier: number;
  coinBonus: number;
  style: BagStyleVariant;
  bodyColor: string;
  strapColor: string;
  metalColor: string;
  roughness: number;
  metalness: number;
  emissiveColor: string;
  emissiveIntensity: number;
}

export interface ColorPreset {
  id: string;
  name: string;
  primaryHex: string;
  accentHex: string;
}

export interface SkinTonePreset {
  id: string;
  name: string;
  hex: string;
}

export type UpgradeKey = 'power' | 'speed' | 'crit' | 'wealth' | 'splash' | 'combo';

export interface UpgradeLevels {
  power: number;
  speed: number;
  crit: number;
  wealth: number;
  splash: number;
  combo: number;
}

export type PrestigeKey =
  | 'titan'
  | 'midas'
  | 'idle'
  | 'overdrive'
  | 'shockwave'
  | 'weakspot'
  | 'bagmaster'
  | 'starter'
  | 'chaincrit'
  | 'combomaster';

export interface PrestigeUpgrades {
  titan: number;
  midas: number;
  idle: number;
  overdrive: number;
  shockwave: number;
  weakspot: number;
  bagmaster: number;
  starter: number;
  chaincrit: number;
  combomaster: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  metric:
    | 'wallsBroken'
    | 'strength'
    | 'totalPunches'
    | 'weakSpotsHit'
    | 'unlockedGloves'
    | 'unlockedBags'
    | 'rebirths'
    | 'highestStage'
    | 'bossesDefeated'
    | 'bestCombo'
    | 'overdrivesUsed';
  target: number;
  rewardType: 'power' | 'coins' | 'speed' | 'crit' | 'bagStr' | 'splash';
  rewardValue: number;
  rewardLabel: string;
}

export type GameScreenState = 'START' | 'PLAYING' | 'PAUSED' | 'BOSS_FAILED' | 'EXITED';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type KeybindAction =
  | 'punch'
  | 'altPunch'
  | 'overdrive'
  | 'switchTarget'
  | 'autoPunch'
  | 'toggleDock'
  | 'pause';

export interface GameSettings {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  bgmEnabled: boolean;
  muted: boolean;
  graphicsQuality: GraphicsQuality;
  dofEnabled: boolean;
  showFloatingNumbers: boolean;
  shakeIntensity: number;
  keybinds: Record<KeybindAction, string>;
}

export type PremiumProductId =
  | 'starter_crate'
  | 'vip_pass'
  | 'galaxian_bundle'
  | 'titan_bag_pack'
  | 'rage_accelerator'
  | 'founder_crown';

export interface PremiumProductDef {
  id: PremiumProductId;
  name: string;
  tagline: string;
  description: string;
  priceLabel: string;
  perks: string[];
  grantsGloveId?: string;
  grantsBagId?: string;
  starterCoinsBonus?: number;
  starterStrengthBonus?: number;
  badgeColor: string;
}

export interface LocalHighscoreEntry {
  id: string;
  playerName: string;
  highestStage: number;
  wallsBroken: number;
  punchPower: number;
  bestCombo: number;
  rebirths: number;
  reason: 'Boss Failed' | 'Run Ended' | 'Active Best';
  recordedAt: number;
}

export interface PlayerProgression {
  displayName: string;
  coins: number;
  strength: number;
  wallsBroken: number;
  highestStage: number;
  highestBossStageCleared: number;
  rebirths: number;
  goldenKnuckles: number;
  totalPunches: number;
  weakSpotsHit: number;
  bossesDefeated: number;
  bestCombo: number;
  overdrivesUsed: number;
  upgrades: UpgradeLevels;
  prestigeUpgrades: PrestigeUpgrades;
  unlockedGloves: string[];
  equippedGlove: string;
  equippedGloveColor: string;
  skinTone: string;
  unlockedBags: string[];
  equippedBag: string;
  equippedBagColor: string;
  claimedAchievements: string[];
  ownedPremiumItems: string[];
  lastActiveAt: number;
}

export type BountyKind =
  | 'wall_punches'
  | 'bag_punches'
  | 'weak_spots'
  | 'break_walls'
  | 'crit_hits';

export interface BountyContract {
  id: number;
  kind: BountyKind;
  title: string;
  progress: number;
  target: number;
  rewardCoins: number;
  rewardStrength: number;
}

export interface FloatingHit {
  id: number;
  xPercent: number;
  yPercent: number;
  amount: string;
  isCrit: boolean;
  isWeakSpot?: boolean;
  isChunkBreak?: boolean;
  comicWord?: string;
  tiltDeg?: number;
  label?: string;
}

export interface OfflineRewardSummary {
  elapsedSeconds: number;
  coinsEarned: number;
  strengthEarned: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  highestStage: number;
  wallsBroken: number;
  punchPower: number;
  rebirths: number;
  gloveId: string;
  updatedAt?: unknown;
}
