import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  ACHIEVEMENTS,
  BAG_COLOR_PRESETS,
  BAG_DEFINITIONS,
  computeEffectiveCoinMultiplier,
  computeEffectivePunchPower,
  DEFAULT_PROGRESSION,
  DEFAULT_SETTINGS,
  GLOVE_COLOR_PRESETS,
  GLOVE_DEFINITIONS,
  PREMIUM_PRODUCTS,
  SKIN_TONE_PRESETS,
} from '../constants/gameData';
import type {
  GameSettings,
  LeaderboardEntry,
  LocalHighscoreEntry,
  OfflineRewardSummary,
  PlayerProgression,
} from '../types/game';
import { db, handleFirestoreError, OperationType } from './firebaseClient';

const LOCAL_STORAGE_KEY = 'punch_the_wall_progression_v1';
const LOCAL_HIGHSCORES_KEY = 'hit_dat_wall_highscores_v1';
const LOCAL_SETTINGS_KEY = 'hit_dat_wall_settings_v1';

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, num));
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  return Math.floor(clampNum(val, min, max, fallback));
}

function sanitizeDisplayName(name: string | null | undefined): string {
  const cleaned = (name ?? 'Breaker').trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, 40) : 'Breaker';
}

export function sanitizeProgression(raw: Partial<PlayerProgression>): PlayerProgression {
  const validGloveIds = new Set(GLOVE_DEFINITIONS.map((g) => g.id));
  const rawGloves = Array.isArray(raw.unlockedGloves) ? raw.unlockedGloves : ['wraps'];
  const unlockedGloves = Array.from(
    new Set(rawGloves.filter((id): id is string => typeof id === 'string' && validGloveIds.has(id)))
  );
  if (!unlockedGloves.includes('wraps')) {
    unlockedGloves.unshift('wraps');
  }

  const equippedGlove =
    typeof raw.equippedGlove === 'string' && unlockedGloves.includes(raw.equippedGlove)
      ? raw.equippedGlove
      : 'wraps';

  const validGloveColors = new Set(GLOVE_COLOR_PRESETS.map((c) => c.id));
  const equippedGloveColor =
    typeof raw.equippedGloveColor === 'string' && validGloveColors.has(raw.equippedGloveColor)
      ? raw.equippedGloveColor
      : 'default';

  const validSkinTones = new Set(SKIN_TONE_PRESETS.map((s) => s.id));
  const skinTone =
    typeof raw.skinTone === 'string' && validSkinTones.has(raw.skinTone) ? raw.skinTone : 'tan';

  const validBagIds = new Set(BAG_DEFINITIONS.map((b) => b.id));
  const rawBags = Array.isArray(raw.unlockedBags) ? raw.unlockedBags : ['leather'];
  const unlockedBags = Array.from(
    new Set(rawBags.filter((id): id is string => typeof id === 'string' && validBagIds.has(id)))
  );
  if (!unlockedBags.includes('leather')) {
    unlockedBags.unshift('leather');
  }

  const equippedBag =
    typeof raw.equippedBag === 'string' && unlockedBags.includes(raw.equippedBag)
      ? raw.equippedBag
      : 'leather';

  const validBagColors = new Set(BAG_COLOR_PRESETS.map((c) => c.id));
  const equippedBagColor =
    typeof raw.equippedBagColor === 'string' && validBagColors.has(raw.equippedBagColor)
      ? raw.equippedBagColor
      : 'default';

  const validAchIds = new Set(ACHIEVEMENTS.map((a) => a.id));
  const rawAchs = Array.isArray(raw.claimedAchievements) ? raw.claimedAchievements : [];
  const claimedAchievements = Array.from(
    new Set(rawAchs.filter((id): id is string => typeof id === 'string' && validAchIds.has(id)))
  ).slice(0, 80);

  const validPremiumIds = new Set<string>(PREMIUM_PRODUCTS.map((p) => p.id));
  const rawPremium = Array.isArray(raw.ownedPremiumItems) ? raw.ownedPremiumItems : [];
  const ownedPremiumItems = Array.from(
    new Set(rawPremium.filter((id): id is string => typeof id === 'string' && validPremiumIds.has(id)))
  ).slice(0, 30);

  return {
    displayName: sanitizeDisplayName(raw.displayName),
    coins: clampNum(raw.coins, 0, 999_999_999_999_999, 0),
    strength: clampNum(raw.strength, 1, 999_999_999_999_999, 5),
    wallsBroken: clampInt(raw.wallsBroken, 0, 10_000_000, 0),
    highestStage: clampInt(raw.highestStage, 1, 10_000_000, 1),
    highestBossStageCleared: clampInt(raw.highestBossStageCleared, 0, 10_000_000, 0),
    rebirths: clampInt(raw.rebirths, 0, 1_000_000, 0),
    goldenKnuckles: clampInt(raw.goldenKnuckles, 0, 100_000_000, 0),
    totalPunches: clampInt(raw.totalPunches, 0, 100_000_000, 0),
    weakSpotsHit: clampInt(raw.weakSpotsHit, 0, 10_000_000, 0),
    bossesDefeated: clampInt(raw.bossesDefeated, 0, 10_000_000, 0),
    bestCombo: clampInt(raw.bestCombo, 0, 1_000_000, 0),
    overdrivesUsed: clampInt(raw.overdrivesUsed, 0, 10_000_000, 0),
    upgrades: {
      power: clampInt(raw.upgrades?.power, 0, 25, 0),
      speed: clampInt(raw.upgrades?.speed, 0, 25, 0),
      crit: clampInt(raw.upgrades?.crit, 0, 25, 0),
      wealth: clampInt(raw.upgrades?.wealth, 0, 25, 0),
      splash: clampInt(raw.upgrades?.splash, 0, 25, 0),
      combo: clampInt(raw.upgrades?.combo, 0, 25, 0),
    },
    prestigeUpgrades: {
      titan: clampInt(raw.prestigeUpgrades?.titan, 0, 20, 0),
      midas: clampInt(raw.prestigeUpgrades?.midas, 0, 20, 0),
      idle: clampInt(raw.prestigeUpgrades?.idle, 0, 20, 0),
      overdrive: clampInt(raw.prestigeUpgrades?.overdrive, 0, 20, 0),
      shockwave: clampInt(raw.prestigeUpgrades?.shockwave, 0, 20, 0),
      weakspot: clampInt(raw.prestigeUpgrades?.weakspot, 0, 20, 0),
      bagmaster: clampInt(raw.prestigeUpgrades?.bagmaster, 0, 20, 0),
      starter: clampInt(raw.prestigeUpgrades?.starter, 0, 20, 0),
      chaincrit: clampInt(raw.prestigeUpgrades?.chaincrit, 0, 20, 0),
      combomaster: clampInt(raw.prestigeUpgrades?.combomaster, 0, 20, 0),
    },
    unlockedGloves: unlockedGloves.slice(0, 30),
    equippedGlove,
    equippedGloveColor,
    skinTone,
    unlockedBags: unlockedBags.slice(0, 25),
    equippedBag,
    equippedBagColor,
    claimedAchievements,
    ownedPremiumItems,
    lastActiveAt: clampInt(raw.lastActiveAt, 0, 99_999_999_999_999, Date.now()),
  };
}

export function loadLocalProgression(): PlayerProgression {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return sanitizeProgression({ ...DEFAULT_PROGRESSION, lastActiveAt: Date.now() });
    }
    return sanitizeProgression(JSON.parse(raw) as Partial<PlayerProgression>);
  } catch {
    return sanitizeProgression({ ...DEFAULT_PROGRESSION, lastActiveAt: Date.now() });
  }
}

export function saveLocalProgression(prog: PlayerProgression): PlayerProgression {
  const clean = sanitizeProgression({ ...prog, lastActiveAt: Date.now() });
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
  return clean;
}

export function calculateOfflineProgress(prog: PlayerProgression): OfflineRewardSummary | null {
  if (!prog.lastActiveAt || prog.totalPunches < 1) return null;
  const elapsedMs = Date.now() - prog.lastActiveAt;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 45) return null;

  const cappedSeconds = Math.min(elapsedSeconds, 12 * 3600);
  const effectivePower = computeEffectivePunchPower(prog);
  const coinMult = computeEffectiveCoinMultiplier(prog);
  const idleMult = 1 + prog.prestigeUpgrades.idle * 0.4;

  const coinsPerSec = Math.max(
    0.25,
    (prog.highestStage * 0.45 + Math.log10(effectivePower + 1) * 1.1) * coinMult * idleMult * 0.25
  );
  const strPerSec = Math.max(
    0.15,
    (prog.highestStage * 0.3 + Math.pow(effectivePower, 0.2)) * idleMult * 0.18
  );

  const coinsEarned = Math.max(5, Math.round(coinsPerSec * cappedSeconds));
  const strengthEarned = Math.max(1, Math.round(strPerSec * cappedSeconds));

  return {
    elapsedSeconds: cappedSeconds,
    coinsEarned,
    strengthEarned,
  };
}

export function mergeProgressions(
  localProg: PlayerProgression,
  cloudProg: Partial<PlayerProgression> | null,
  fallbackName?: string | null
): PlayerProgression {
  if (!cloudProg) {
    return sanitizeProgression({
      ...localProg,
      displayName: fallbackName ? sanitizeDisplayName(fallbackName) : localProg.displayName,
    });
  }
  const cleanCloud = sanitizeProgression(cloudProg);
  const mergedGloves = Array.from(
    new Set([...localProg.unlockedGloves, ...cleanCloud.unlockedGloves])
  );
  const mergedBags = Array.from(
    new Set([...localProg.unlockedBags, ...cleanCloud.unlockedBags])
  );
  const mergedAchs = Array.from(
    new Set([...localProg.claimedAchievements, ...cleanCloud.claimedAchievements])
  );
  const mergedPremium = Array.from(
    new Set([...localProg.ownedPremiumItems, ...cleanCloud.ownedPremiumItems])
  );

  return sanitizeProgression({
    displayName: sanitizeDisplayName(fallbackName || cleanCloud.displayName || localProg.displayName),
    coins: Math.max(localProg.coins, cleanCloud.coins),
    strength: Math.max(localProg.strength, cleanCloud.strength),
    wallsBroken: Math.max(localProg.wallsBroken, cleanCloud.wallsBroken),
    highestStage: Math.max(localProg.highestStage, cleanCloud.highestStage),
    highestBossStageCleared: Math.max(
      localProg.highestBossStageCleared,
      cleanCloud.highestBossStageCleared
    ),
    rebirths: Math.max(localProg.rebirths, cleanCloud.rebirths),
    goldenKnuckles: Math.max(localProg.goldenKnuckles, cleanCloud.goldenKnuckles),
    totalPunches: Math.max(localProg.totalPunches, cleanCloud.totalPunches),
    weakSpotsHit: Math.max(localProg.weakSpotsHit, cleanCloud.weakSpotsHit),
    bossesDefeated: Math.max(localProg.bossesDefeated, cleanCloud.bossesDefeated),
    bestCombo: Math.max(localProg.bestCombo, cleanCloud.bestCombo),
    overdrivesUsed: Math.max(localProg.overdrivesUsed, cleanCloud.overdrivesUsed),
    upgrades: {
      power: Math.max(localProg.upgrades.power, cleanCloud.upgrades.power),
      speed: Math.max(localProg.upgrades.speed, cleanCloud.upgrades.speed),
      crit: Math.max(localProg.upgrades.crit, cleanCloud.upgrades.crit),
      wealth: Math.max(localProg.upgrades.wealth, cleanCloud.upgrades.wealth),
      splash: Math.max(localProg.upgrades.splash, cleanCloud.upgrades.splash),
      combo: Math.max(localProg.upgrades.combo, cleanCloud.upgrades.combo),
    },
    prestigeUpgrades: {
      titan: Math.max(localProg.prestigeUpgrades.titan, cleanCloud.prestigeUpgrades.titan),
      midas: Math.max(localProg.prestigeUpgrades.midas, cleanCloud.prestigeUpgrades.midas),
      idle: Math.max(localProg.prestigeUpgrades.idle, cleanCloud.prestigeUpgrades.idle),
      overdrive: Math.max(
        localProg.prestigeUpgrades.overdrive,
        cleanCloud.prestigeUpgrades.overdrive
      ),
      shockwave: Math.max(
        localProg.prestigeUpgrades.shockwave,
        cleanCloud.prestigeUpgrades.shockwave
      ),
      weakspot: Math.max(
        localProg.prestigeUpgrades.weakspot,
        cleanCloud.prestigeUpgrades.weakspot
      ),
      bagmaster: Math.max(
        localProg.prestigeUpgrades.bagmaster,
        cleanCloud.prestigeUpgrades.bagmaster
      ),
      starter: Math.max(
        localProg.prestigeUpgrades.starter,
        cleanCloud.prestigeUpgrades.starter
      ),
      chaincrit: Math.max(
        localProg.prestigeUpgrades.chaincrit,
        cleanCloud.prestigeUpgrades.chaincrit
      ),
      combomaster: Math.max(
        localProg.prestigeUpgrades.combomaster,
        cleanCloud.prestigeUpgrades.combomaster
      ),
    },
    unlockedGloves: mergedGloves,
    equippedGlove: mergedGloves.includes(cleanCloud.equippedGlove)
      ? cleanCloud.equippedGlove
      : localProg.equippedGlove,
    equippedGloveColor: cleanCloud.equippedGloveColor || localProg.equippedGloveColor,
    skinTone: cleanCloud.skinTone || localProg.skinTone,
    unlockedBags: mergedBags,
    equippedBag: mergedBags.includes(cleanCloud.equippedBag)
      ? cleanCloud.equippedBag
      : localProg.equippedBag,
    equippedBagColor: cleanCloud.equippedBagColor || localProg.equippedBagColor,
    claimedAchievements: mergedAchs,
    ownedPremiumItems: mergedPremium,
    lastActiveAt: Math.max(localProg.lastActiveAt, cleanCloud.lastActiveAt),
  });
}

export async function loadCloudProfile(uid: string): Promise<Partial<PlayerProgression> | null> {
  const path = `players/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'players', uid));
    if (!snap.exists()) return null;
    return snap.data() as Partial<PlayerProgression>;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncCloudProfile(uid: string, prog: PlayerProgression): Promise<void> {
  const clean = sanitizeProgression(prog);
  const path = `players/${uid}`;
  try {
    await setDoc(
      doc(db, 'players', uid),
      {
        uid,
        displayName: clean.displayName,
        coins: clean.coins,
        strength: clean.strength,
        wallsBroken: clean.wallsBroken,
        highestStage: clean.highestStage,
        highestBossStageCleared: clean.highestBossStageCleared,
        rebirths: clean.rebirths,
        goldenKnuckles: clean.goldenKnuckles,
        totalPunches: clean.totalPunches,
        weakSpotsHit: clean.weakSpotsHit,
        bossesDefeated: clean.bossesDefeated,
        bestCombo: clean.bestCombo,
        overdrivesUsed: clean.overdrivesUsed,
        upgrades: clean.upgrades,
        prestigeUpgrades: clean.prestigeUpgrades,
        unlockedGloves: clean.unlockedGloves,
        equippedGlove: clean.equippedGlove,
        equippedGloveColor: clean.equippedGloveColor,
        skinTone: clean.skinTone,
        unlockedBags: clean.unlockedBags,
        equippedBag: clean.equippedBag,
        equippedBagColor: clean.equippedBagColor,
        claimedAchievements: clean.claimedAchievements,
        ownedPremiumItems: clean.ownedPremiumItems,
        lastActiveAt: clean.lastActiveAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitLeaderboardEntry(
  uid: string,
  prog: PlayerProgression
): Promise<void> {
  const clean = sanitizeProgression(prog);
  const path = `leaderboard/${uid}`;
  try {
    await setDoc(doc(db, 'leaderboard', uid), {
      uid,
      displayName: clean.displayName,
      highestStage: clean.highestStage,
      wallsBroken: clean.wallsBroken,
      punchPower: computeEffectivePunchPower(clean),
      rebirths: clean.rebirths,
      gloveId: clean.equippedGlove,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchTopLeaderboard(maxResults = 15): Promise<LeaderboardEntry[]> {
  const path = 'leaderboard';
  try {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('highestStage', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Resets run state to Wall 1 while preserving player identity & any IRL currency entitlements.
 */
export function createFreshRunProgression(prevProg: PlayerProgression): PlayerProgression {
  const ownedIds = new Set(prevProg.ownedPremiumItems || []);
  const unlockedGloves = ['wraps'];
  const unlockedBags = ['leather'];
  let starterCoins = 0;
  let starterStrength = DEFAULT_PROGRESSION.strength;

  for (const prod of PREMIUM_PRODUCTS) {
    if (!ownedIds.has(prod.id)) continue;
    if (prod.grantsGloveId && !unlockedGloves.includes(prod.grantsGloveId)) {
      unlockedGloves.push(prod.grantsGloveId);
    }
    if (prod.id === 'galaxian_bundle' && !unlockedGloves.includes('brass')) {
      unlockedGloves.push('brass');
    }
    if (prod.grantsBagId && !unlockedBags.includes(prod.grantsBagId)) {
      unlockedBags.push(prod.grantsBagId);
    }
    if (prod.starterCoinsBonus) starterCoins += prod.starterCoinsBonus;
    if (prod.starterStrengthBonus) starterStrength += prod.starterStrengthBonus;
  }

  return sanitizeProgression({
    ...DEFAULT_PROGRESSION,
    displayName: prevProg.displayName,
    skinTone: prevProg.skinTone,
    ownedPremiumItems: Array.from(ownedIds),
    coins: starterCoins,
    strength: starterStrength,
    unlockedGloves,
    equippedGlove: unlockedGloves[unlockedGloves.length - 1] ?? 'wraps',
    unlockedBags,
    equippedBag: unlockedBags[unlockedBags.length - 1] ?? 'leather',
    lastActiveAt: Date.now(),
  });
}

export function loadLocalHighscores(): LocalHighscoreEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is LocalHighscoreEntry => Boolean(item && typeof item.id === 'string'))
      .slice(0, 15);
  } catch {
    return [];
  }
}

export function recordLocalHighscore(
  prog: PlayerProgression,
  reason: LocalHighscoreEntry['reason']
): LocalHighscoreEntry[] {
  if (prog.totalPunches < 1 && prog.highestStage <= 1 && prog.wallsBroken < 1) {
    return loadLocalHighscores();
  }
  const existing = loadLocalHighscores();
  const entry: LocalHighscoreEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    playerName: sanitizeDisplayName(prog.displayName),
    highestStage: prog.highestStage,
    wallsBroken: prog.wallsBroken,
    punchPower: computeEffectivePunchPower(prog),
    bestCombo: prog.bestCombo,
    rebirths: prog.rebirths,
    reason,
    recordedAt: Date.now(),
  };

  const merged = [entry, ...existing]
    .sort((a, b) => {
      if (b.highestStage !== a.highestStage) return b.highestStage - a.highestStage;
      if (b.punchPower !== a.punchPower) return b.punchPower - a.punchPower;
      return b.wallsBroken - a.wallsBroken;
    })
    .slice(0, 12);

  try {
    localStorage.setItem(LOCAL_HIGHSCORES_KEY, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }
  return merged;
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      masterVolume: clampNum(parsed.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
      bgmVolume: clampNum(parsed.bgmVolume, 0, 1, DEFAULT_SETTINGS.bgmVolume),
      sfxVolume: clampNum(parsed.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
      bgmEnabled: typeof parsed.bgmEnabled === 'boolean' ? parsed.bgmEnabled : DEFAULT_SETTINGS.bgmEnabled,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      graphicsQuality:
        parsed.graphicsQuality === 'low' ||
        parsed.graphicsQuality === 'medium' ||
        parsed.graphicsQuality === 'high'
          ? parsed.graphicsQuality
          : DEFAULT_SETTINGS.graphicsQuality,
      dofEnabled: typeof parsed.dofEnabled === 'boolean' ? parsed.dofEnabled : DEFAULT_SETTINGS.dofEnabled,
      showFloatingNumbers:
        typeof parsed.showFloatingNumbers === 'boolean'
          ? parsed.showFloatingNumbers
          : DEFAULT_SETTINGS.showFloatingNumbers,
      shakeIntensity: clampNum(parsed.shakeIntensity, 0, 1.5, DEFAULT_SETTINGS.shakeIntensity),
      keybinds: {
        ...DEFAULT_SETTINGS.keybinds,
        ...(parsed.keybinds && typeof parsed.keybinds === 'object' ? parsed.keybinds : {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveGameSettings(settings: GameSettings): GameSettings {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
  return settings;
}
