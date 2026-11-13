import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Award,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Dumbbell,
  Flame,
  Hammer,
  Hand,
  LogIn,
  Medal,
  Pause,
  Repeat,
  RotateCcw,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { PunchAudioEngine } from './audio/PunchAudioEngine';
import { AchievementsModal } from './components/AchievementsModal';
import { BossFailedModal, type BossFailedSummary } from './components/BossFailedModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OfflineProgressModal } from './components/OfflineProgressModal';
import { PauseMenuModal } from './components/PauseMenuModal';
import { PremiumStoreModal } from './components/PremiumStoreModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopAndUpgradesModal, type ArmoryTab } from './components/ShopAndUpgradesModal';
import { StartMenuOverlay } from './components/StartMenuOverlay';
import {
  ACHIEVEMENTS,
  BAG_DEFINITIONS,
  computeChainCritMultiplier,
  computeComboDecayMs,
  computeComboFloor,
  computeComboPowerMultiplier,
  computeEffectiveBagCoins,
  computeEffectiveBagStrength,
  computeEffectiveCoinMultiplier,
  computeEffectiveCritChance,
  computeEffectivePunchPower,
  computeEffectiveSpeedMultiplier,
  computeEffectiveSplashRadius,
  computeGoldenKnucklesEarned,
  computeMaxUpgradePurchase,
  computeShatterBonusMultiplier,
  computeWeakSpotMultiplier,
  createBountyContract,
  DEFAULT_PROGRESSION,
  formatCompact,
  formatKeyCode,
  getAchievementProgress,
  getBagById,
  getBossKnuckleDrop,
  getGloveById,
  getPrestigeUpgradeCost,
  getRebirthStipulations,
  getUpgradeCost,
  getWallSpecForStage,
  GLOVE_DEFINITIONS,
  isBossStage,
  PRESTIGE_UPGRADE_DEFS,
  UPGRADE_DEFS,
} from './constants/gameData';
import { PunchWallScene } from './engine/PunchWallScene';
import { auth, signInWithGoogle, signOutUser } from './services/firebaseClient';
import {
  createFreshRunProgression,
  fetchTopLeaderboard,
  loadCloudProfile,
  loadGameSettings,
  loadLocalHighscores,
  loadLocalProgression,
  mergeProgressions,
  recordLocalHighscore,
  saveGameSettings,
  saveLocalProgression,
  submitLeaderboardEntry,
  syncCloudProfile,
} from './services/progressionService';
import type {
  BountyContract,
  FloatingHit,
  GameScreenState,
  GameSettings,
  LeaderboardEntry,
  LocalHighscoreEntry,
  OfflineRewardSummary,
  PlayerProgression,
  PrestigeKey,
  TargetMode,
  UpgradeKey,
} from './types/game';

interface StageClearBanner {
  stage: number;
  materialName: string;
  coins: number;
  bossKnuckles?: number;
}

interface MilestoneToast {
  id: string;
  title: string;
  description: string;
  rewardLabel: string;
}

const BOSS_TIME_LIMIT_SEC = 25;
const OVERDRIVE_DURATION_MS = 6500;
const OVERDRIVE_POWER_MULT = 2.2;
const OVERDRIVE_SPEED_MULT = 1.25;

const CRIT_WORDS = ['POW!', 'WHAM!', 'BAM!'];
const CHUNK_WORDS = ['CRACK!', 'CHIP!'];
const MULTI_CHUNK_WORDS = ['CRUNCH!', 'CARVED!', 'CHUNKED!'];
const WEAKSPOT_WORDS = ['BULLSEYE!', 'BREACH!', 'DIRECT HIT!'];
const HEAVY_WORDS = ['SMASH!', 'THUD!', 'KAPOW!'];

function pickWord(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length];
}

function pickTilt(seed: number): number {
  const angles = [-12, 9, -8, 13, -14, 7, -10, 11];
  return angles[Math.abs(seed) % angles.length];
}

function getComboRank(combo: number): { label: string; colorClass: string } | null {
  if (combo >= 100) return { label: 'GODLIKE FURY!', colorClass: 'text-fuchsia-300' };
  if (combo >= 60) return { label: 'DEMOLITION KING!', colorClass: 'text-rose-400' };
  if (combo >= 30) return { label: 'UNSTOPPABLE!', colorClass: 'text-amber-300' };
  if (combo >= 15) return { label: 'HEATED!', colorClass: 'text-orange-400' };
  if (combo >= 5) return { label: 'WARMING UP!', colorClass: 'text-emerald-300' };
  if (combo >= 2) return { label: 'COMBO', colorClass: 'text-amber-400' };
  return null;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PunchWallScene | null>(null);
  const audioRef = useRef<PunchAudioEngine | null>(null);
  const topHudRef = useRef<HTMLElement | null>(null);
  const bottomHudRef = useRef<HTMLDivElement | null>(null);

  const [screenState, setScreenState] = useState<GameScreenState>('START');
  const screenStateRef = useRef<GameScreenState>('START');
  screenStateRef.current = screenState;

  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());
  const settingsRef = useRef<GameSettings>(settings);
  settingsRef.current = settings;

  const [progression, setProgression] = useState<PlayerProgression>(() =>
    loadLocalProgression()
  );
  const progRef = useRef(progression);
  progRef.current = progression;

  const [localHighscores, setLocalHighscores] = useState<LocalHighscoreEntry[]>(() =>
    loadLocalHighscores()
  );

  const [stage, setStage] = useState<number>(1);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const [wallHp, setWallHp] = useState<number>(() => getWallSpecForStage(1).maxHp);
  const wallHpRef = useRef(wallHp);
  wallHpRef.current = wallHp;

  const [bossTimerSec, setBossTimerSec] = useState<number>(0);
  const [bossFailedSummary, setBossFailedSummary] = useState<BossFailedSummary | null>(null);

  const [targetMode, setTargetMode] = useState<TargetMode>('WALL');
  const targetModeRef = useRef(targetMode);
  targetModeRef.current = targetMode;

  const [autoPunch, setAutoPunch] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const [rage, setRage] = useState(0);
  const rageRef = useRef(0);
  const [overdriveMs, setOverdriveMs] = useState(0);
  const overdriveActiveRef = useRef(false);
  overdriveActiveRef.current = overdriveMs > 0;

  const [bounty, setBounty] = useState<BountyContract>(() =>
    createBountyContract(1, loadLocalProgression(), 1)
  );
  const bountyRef = useRef(bounty);
  bountyRef.current = bounty;

  const [combo, setCombo] = useState(0);
  const comboRef = useRef(combo);
  comboRef.current = combo;
  const comboTimerRef = useRef<number | null>(null);
  const [floatingHits, setFloatingHits] = useState<FloatingHit[]>([]);
  const nextHitId = useRef(1);

  const [stageBanner, setStageBanner] = useState<StageClearBanner | null>(null);
  const stageBannerTimerRef = useRef<number | null>(null);
  const [achQueue, setAchQueue] = useState<MilestoneToast[]>([]);

  const readyAchIdsRef = useRef<Set<string>>(
    new Set(
      ACHIEVEMENTS.filter(
        (a) =>
          !progRef.current.claimedAchievements.includes(a.id) &&
          getAchievementProgress(progRef.current, a) >= a.target
      ).map((a) => a.id)
    )
  );

  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const [shopTab, setShopTab] = useState<ArmoryTab | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [offlineReward, setOfflineReward] = useState<OfflineRewardSummary | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const wallBreakingRef = useRef(false);
  const cloudSyncTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const triggerStageBanner = useCallback(
    (clearedStage: number, materialName: string, coins: number, bossKnuckles?: number) => {
      setStageBanner({ stage: clearedStage, materialName, coins, bossKnuckles });
      if (stageBannerTimerRef.current) window.clearTimeout(stageBannerTimerRef.current);
      stageBannerTimerRef.current = window.setTimeout(() => {
        setStageBanner(null);
      }, 2600);
    },
    []
  );

  // Sync audio & graphics settings to engine & localStorage
  const handleUpdateSettings = useCallback((next: GameSettings) => {
    const saved = saveGameSettings(next);
    setSettings(saved);
    audioRef.current?.setAudioSettings({
      masterVolume: saved.masterVolume,
      bgmVolume: saved.bgmVolume,
      sfxVolume: saved.sfxVolume,
      bgmEnabled: saved.bgmEnabled,
      muted: saved.muted,
    });
    sceneRef.current?.setGraphicsQuality(saved.graphicsQuality);
    sceneRef.current?.setDofEnabled(saved.dofEnabled && saved.graphicsQuality !== 'low');
    sceneRef.current?.setShakeMultiplier(saved.shakeIntensity);
  }, []);

  // Detect newly earned achievements during active play and queue live Celebration Toasts
  useEffect(() => {
    if (screenState !== 'PLAYING') return;
    const newlyUnlocked: MilestoneToast[] = [];
    for (const ach of ACHIEVEMENTS) {
      const claimed = progression.claimedAchievements.includes(ach.id);
      if (claimed) {
        readyAchIdsRef.current.delete(ach.id);
        continue;
      }
      const met = getAchievementProgress(progression, ach) >= ach.target;
      if (met && !readyAchIdsRef.current.has(ach.id)) {
        readyAchIdsRef.current.add(ach.id);
        newlyUnlocked.push({
          id: ach.id,
          title: ach.title,
          description: ach.description,
          rewardLabel: ach.rewardLabel,
        });
      }
    }

    if (newlyUnlocked.length > 0) {
      setAchQueue((prev) => {
        const merged = [...prev];
        for (const item of newlyUnlocked) {
          if (!merged.some((m) => m.id === item.id)) {
            merged.push(item);
          }
        }
        return merged.slice(-3);
      });
      newlyUnlocked.forEach((item) => {
        window.setTimeout(() => {
          setAchQueue((prev) => prev.filter((t) => t.id !== item.id));
        }, 7500);
      });
    }
  }, [progression, screenState]);

  const scheduleCloudSync = useCallback((nextProg: PlayerProgression) => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    if (cloudSyncTimerRef.current) {
      window.clearTimeout(cloudSyncTimerRef.current);
    }
    cloudSyncTimerRef.current = window.setTimeout(() => {
      void syncCloudProfile(activeUser.uid, nextProg).catch(() => {});
      void submitLeaderboardEntry(activeUser.uid, nextProg).catch(() => {});
    }, 1200);
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const entries = await fetchTopLeaderboard(15);
      setLeaderboardEntries(entries);
    } catch {
      setLeaderboardError('Unable to load cloud rankings right now.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const handleUpdateDisplayName = useCallback(
    (name: string) => {
      const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 40) || 'Breaker';
      const updated = saveLocalProgression({
        ...progRef.current,
        displayName: cleaned,
      });
      setProgression(updated);
      scheduleCloudSync(updated);
      showNotice(`Fighter name set to "${updated.displayName}".`);
    },
    [scheduleCloudSync, showNotice]
  );

  // Auth listener & Cloud Merge (preserves IRL entitlements & account name)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const cloud = await loadCloudProfile(nextUser.uid);
          const merged = mergeProgressions(
            progRef.current,
            cloud,
            nextUser.displayName
          );
          const saved = saveLocalProgression(merged);
          setProgression(saved);
          void syncCloudProfile(nextUser.uid, saved);
          void submitLeaderboardEntry(nextUser.uid, saved);
        } catch {
          // Continue smoothly offline
        }
      }
    });
    return () => unsub();
  }, []);

  // Persist lastActiveAt when leaving or backgrounding tab
  useEffect(() => {
    const handleVisibilityOrUnload = () => {
      if (document.visibilityState === 'hidden') {
        saveLocalProgression(progRef.current);
      }
    };
    const handleBeforeUnload = () => {
      saveLocalProgression(progRef.current);
    };
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Sync scene pause & BGM ducking with screenState & open sub-modals
  useEffect(() => {
    const anySubModal = Boolean(
      shopTab || achievementsOpen || leaderboardOpen || settingsOpen || storeOpen || offlineReward
    );
    const activePlay = screenState === 'PLAYING' && !anySubModal;
    sceneRef.current?.setPaused(!activePlay);
    audioRef.current?.setBgmPaused(
      screenState === 'PAUSED' || screenState === 'EXITED' || screenState === 'BOSS_FAILED'
    );
  }, [
    screenState,
    shopTab,
    achievementsOpen,
    leaderboardOpen,
    settingsOpen,
    storeOpen,
    offlineReward,
  ]);

  // Reset cursor-dodging HUD transforms cleanly whenever leaving PLAYING
  useEffect(() => {
    if (screenState !== 'PLAYING') {
      if (topHudRef.current) {
        topHudRef.current.style.transform = '';
        topHudRef.current.style.opacity = '';
      }
      if (bottomHudRef.current) {
        bottomHudRef.current.style.transform = '';
        bottomHudRef.current.style.opacity = '';
      }
    }
  }, [screenState]);

  // Helper: start a clean run on Wall 1 (preserving account, highscores, settings, and IRL entitlements)
  const beginFreshRun = useCallback(
    (recordPreviousRun: boolean) => {
      if (recordPreviousRun && progRef.current.totalPunches > 0) {
        setLocalHighscores(recordLocalHighscore(progRef.current, 'Run Ended'));
      }
      const fresh = saveLocalProgression(createFreshRunProgression(progRef.current));
      progRef.current = fresh;
      setProgression(fresh);
      readyAchIdsRef.current = new Set();
      setAchQueue([]);

      const firstSpec = getWallSpecForStage(1);
      stageRef.current = 1;
      wallHpRef.current = firstSpec.maxHp;
      wallBreakingRef.current = false;
      setStage(1);
      setWallHp(firstSpec.maxHp);
      setBossTimerSec(0);
      setBossFailedSummary(null);
      setTargetMode('WALL');
      setAutoPunch(false);
      rageRef.current = 0;
      setRage(0);
      setOverdriveMs(0);
      overdriveActiveRef.current = false;
      const floor = computeComboFloor(fresh);
      comboRef.current = floor;
      setCombo(floor);
      const nextBounty = createBountyContract(1, fresh, 1);
      bountyRef.current = nextBounty;
      setBounty(nextBounty);

      sceneRef.current?.configureWall(1, 1);
      sceneRef.current?.resetWallCracks();
      sceneRef.current?.setBossMode(false);
      sceneRef.current?.setTargetMode('WALL');
      sceneRef.current?.setOverdriveMode(false);

      setShopTab(null);
      setAchievementsOpen(false);
      setLeaderboardOpen(false);
      setSettingsOpen(false);
      setStoreOpen(false);
      setOfflineReward(null);

      audioRef.current?.unlock();
      audioRef.current?.setBgmPaused(false);
      setScreenState('PLAYING');
      scheduleCloudSync(fresh);
    },
    [scheduleCloudSync]
  );

  // Quit active run back to Start Screen
  const handleQuitToTitle = useCallback(() => {
    if (progRef.current.totalPunches > 0) {
      setLocalHighscores(recordLocalHighscore(progRef.current, 'Run Ended'));
    }
    setAutoPunch(false);
    setShopTab(null);
    setAchievementsOpen(false);
    setLeaderboardOpen(false);
    setSettingsOpen(false);
    setStoreOpen(false);
    setScreenState('START');
  }, []);

  // Overdrive countdown timer
  useEffect(() => {
    if (overdriveMs <= 0 || screenState !== 'PLAYING') {
      sceneRef.current?.setOverdriveMode(false);
      return;
    }
    sceneRef.current?.setOverdriveMode(true);
    const id = window.setInterval(() => {
      setOverdriveMs((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => window.clearInterval(id);
  }, [overdriveMs > 0, screenState]);

  // Boss Stage countdown timer -> failing wipes run & shows "YOU'RE WEAK! GO PRACTICE!"
  useEffect(() => {
    const isBoss = isBossStage(stage);
    sceneRef.current?.setBossMode(isBoss);
    if (
      screenState !== 'PLAYING' ||
      !isBoss ||
      targetMode !== 'WALL' ||
      shopTab ||
      achievementsOpen ||
      leaderboardOpen ||
      settingsOpen ||
      storeOpen ||
      offlineReward
    ) {
      return;
    }
    const id = window.setInterval(() => {
      if (wallBreakingRef.current) return;
      setBossTimerSec((prev) => {
        if (prev <= 1) {
          const failedProg = progRef.current;
          const summary: BossFailedSummary = {
            stageReached: stageRef.current,
            wallsBroken: failedProg.wallsBroken,
            punchPower: computeEffectivePunchPower(failedProg),
            bestCombo: failedProg.bestCombo,
          };

          audioRef.current?.playBossFail();
          setLocalHighscores(recordLocalHighscore(failedProg, 'Boss Failed'));

          const wiped = saveLocalProgression(createFreshRunProgression(failedProg));
          progRef.current = wiped;
          setProgression(wiped);
          readyAchIdsRef.current = new Set();
          setAchQueue([]);

          const firstSpec = getWallSpecForStage(1);
          stageRef.current = 1;
          wallHpRef.current = firstSpec.maxHp;
          setStage(1);
          setWallHp(firstSpec.maxHp);
          setAutoPunch(false);
          setRage(0);
          rageRef.current = 0;
          setOverdriveMs(0);
          setCombo(0);
          comboRef.current = 0;
          setBounty(createBountyContract(1, wiped, 1));

          sceneRef.current?.configureWall(1, 1);
          sceneRef.current?.resetWallCracks();
          sceneRef.current?.setBossMode(false);
          sceneRef.current?.setOverdriveMode(false);

          setBossFailedSummary(summary);
          setScreenState('BOSS_FAILED');
          scheduleCloudSync(wiped);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    screenState,
    stage,
    targetMode,
    shopTab,
    achievementsOpen,
    leaderboardOpen,
    settingsOpen,
    storeOpen,
    offlineReward,
    scheduleCloudSync,
  ]);

  const spawnFloatingHit = useCallback(
    (
      xPercent: number,
      yPercent: number,
      amount: string,
      isCrit: boolean,
      options?: {
        isWeakSpot?: boolean;
        isChunkBreak?: boolean;
        comicWord?: string;
        tiltDeg?: number;
        label?: string;
        forceShow?: boolean;
      }
    ) => {
      if (!settingsRef.current.showFloatingNumbers && !options?.forceShow) return;
      const id = nextHitId.current++;
      const clampedX = Math.max(16, Math.min(84, xPercent));
      const clampedY = Math.max(22, Math.min(72, yPercent));
      setFloatingHits((prev) => [
        ...prev.slice(-11),
        {
          id,
          xPercent: clampedX,
          yPercent: clampedY,
          amount,
          isCrit,
          isWeakSpot: options?.isWeakSpot,
          isChunkBreak: options?.isChunkBreak,
          comicWord: options?.comicWord,
          tiltDeg: options?.tiltDeg,
          label: options?.label,
        },
      ]);
      window.setTimeout(() => {
        setFloatingHits((prev) => prev.filter((item) => item.id !== id));
      }, 780);
    },
    []
  );

  const activateOverdrive = useCallback(() => {
    if (screenStateRef.current !== 'PLAYING') return;
    if (overdriveActiveRef.current || rageRef.current < 100) return;
    audioRef.current?.unlock();
    audioRef.current?.playOverdriveActivate();
    rageRef.current = 0;
    setRage(0);
    const hasRageAccel = progRef.current.ownedPremiumItems.includes('rage_accelerator');
    setOverdriveMs(OVERDRIVE_DURATION_MS + (hasRageAccel ? 1500 : 0));
    overdriveActiveRef.current = true;
    sceneRef.current?.setOverdriveMode(true);

    const current = progRef.current;
    const updated = saveLocalProgression({
      ...current,
      overdrivesUsed: current.overdrivesUsed + 1,
    });
    setProgression(updated);
    scheduleCloudSync(updated);
    spawnFloatingHit(50, 48, `${OVERDRIVE_POWER_MULT}X OVERDRIVE!`, true, {
      isWeakSpot: true,
      comicWord: 'LIMIT BREAK!',
      tiltDeg: -6,
      forceShow: true,
    });
  }, [scheduleCloudSync, spawnFloatingHit]);

  const handleSelectStage = useCallback((nextStage: number) => {
    if (wallBreakingRef.current || screenStateRef.current !== 'PLAYING') return;
    const clamped = Math.max(1, Math.min(progRef.current.highestStage, nextStage));
    if (clamped === stageRef.current) return;
    const spec = getWallSpecForStage(clamped);
    stageRef.current = clamped;
    wallHpRef.current = spec.maxHp;
    setStage(clamped);
    setWallHp(spec.maxHp);
    setBossTimerSec(isBossStage(clamped) ? BOSS_TIME_LIMIT_SEC : 0);
    sceneRef.current?.configureWall(clamped, 1);
    sceneRef.current?.resetWallCracks();
    sceneRef.current?.setBossMode(isBossStage(clamped));
    if (isBossStage(clamped)) {
      audioRef.current?.playBossSpawn();
    }
  }, []);

  // Impact handler fired by Three.js POV animation right when fist connects!
  const handlePunchHit = useCallback(
    (
      hitTarget: TargetMode,
      isCrit: boolean,
      sx: number,
      sy: number,
      isWeakSpot: boolean,
      chunksBroken: number
    ) => {
      if (screenStateRef.current !== 'PLAYING') return;
      const prog = progRef.current;
      const currentStage = stageRef.current;
      const spec = getWallSpecForStage(currentStage);
      const vipMult = prog.ownedPremiumItems.includes('vip_pass') ? 1.5 : 1;
      const coinMult = computeEffectiveCoinMultiplier(prog) * vipMult;
      const critMult = isCrit ? 2.0 : 1;
      const weakSpotMult = isWeakSpot ? computeWeakSpotMultiplier(prog) : 1;
      const chainMult = isCrit || isWeakSpot ? computeChainCritMultiplier(prog) : 1;
      const overdrivePowerMult = overdriveActiveRef.current ? OVERDRIVE_POWER_MULT : 1;
      const totalPunches = prog.totalPunches + 1;
      const weakSpotsHit = prog.weakSpotsHit + (isWeakSpot ? 1 : 0);

      // Update combo with Fury Retention floor, Combo Momentum decay extension & Combo Milestones
      const floor = computeComboFloor(prog);
      const nextCombo = Math.max(floor, comboRef.current + 1);
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      if (
        nextCombo === 10 ||
        nextCombo === 25 ||
        nextCombo === 50 ||
        nextCombo === 100 ||
        nextCombo === 200
      ) {
        audioRef.current?.playComboMilestone(nextCombo);
      }
      if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
      comboTimerRef.current = window.setTimeout(() => {
        comboRef.current = floor;
        setCombo(floor);
      }, computeComboDecayMs(prog));

      const bestCombo = Math.max(prog.bestCombo, nextCombo);

      // Build Overdrive Adrenaline slowly so Rage feels earned
      if (!overdriveActiveRef.current) {
        const baseRageGain = isWeakSpot
          ? 2.8
          : isCrit
            ? 1.5
            : hitTarget === 'WALL'
              ? 0.75
              : 0.45;
        const rageMult = prog.ownedPremiumItems.includes('rage_accelerator') ? 1.35 : 1;
        const nextRage = Math.min(100, rageRef.current + baseRageGain * rageMult);
        rageRef.current = nextRage;
        setRage(nextRage);
      }

      // Advance active Bounty Contract & evaluate completion
      let bountyBonusCoins = 0;
      let bountyBonusStr = 0;
      const activeBounty = bountyRef.current;
      let delta = 0;
      if (activeBounty.kind === 'wall_punches' && hitTarget === 'WALL') delta = 1;
      else if (activeBounty.kind === 'bag_punches' && hitTarget === 'BAG') delta = 1;
      else if (activeBounty.kind === 'weak_spots' && isWeakSpot) delta = 1;
      else if (activeBounty.kind === 'crit_hits' && isCrit) delta = 1;

      if (hitTarget === 'BAG') {
        if (delta > 0) {
          const nextProgVal = activeBounty.progress + delta;
          if (nextProgVal >= activeBounty.target) {
            bountyBonusCoins = activeBounty.rewardCoins;
            bountyBonusStr = activeBounty.rewardStrength;
            const nextBounty = createBountyContract(activeBounty.id + 1, prog, currentStage);
            bountyRef.current = nextBounty;
            setBounty(nextBounty);
            audioRef.current?.playAchievementClaim();
            showNotice(
              `Contract Complete! +${formatCompact(bountyBonusCoins)} Coins${
                bountyBonusStr > 0 ? ` & +${formatCompact(bountyBonusStr)} STR` : ''
              }`
            );
          } else {
            const updatedBounty = { ...activeBounty, progress: nextProgVal };
            bountyRef.current = updatedBounty;
            setBounty(updatedBounty);
          }
        }

        const bagStr = computeEffectiveBagStrength(prog, spec.strengthPerPunch) * vipMult;
        const gainStr = Math.max(1, Math.round(bagStr * critMult * overdrivePowerMult));
        const gainCoins = Math.round(computeEffectiveBagCoins(prog, currentStage) * vipMult);
        const updated = saveLocalProgression({
          ...prog,
          strength: prog.strength + gainStr + bountyBonusStr,
          coins: prog.coins + gainCoins + bountyBonusCoins,
          totalPunches,
          bestCombo,
        });
        setProgression(updated);
        scheduleCloudSync(updated);
        spawnFloatingHit(sx, sy, `+${formatCompact(gainStr)} STR`, isCrit, {
          comicWord: isCrit ? 'PUMPED!' : totalPunches % 5 === 0 ? 'TRAIN!' : undefined,
          tiltDeg: pickTilt(totalPunches),
        });
        return;
      }

      // WALL hit: awards balanced Coins & carves 3D wall chunks
      if (wallBreakingRef.current) return;
      const basePower = computeEffectivePunchPower(prog);
      const comboMult = computeComboPowerMultiplier(prog, nextCombo);
      const damage = Math.max(
        1,
        Math.round(
          basePower * comboMult * critMult * weakSpotMult * chainMult * overdrivePowerMult
        )
      );
      const nextHp = Math.max(0, wallHpRef.current - damage);

      const baseHitCoins = Math.max(
        1,
        Math.round(
          Math.pow(1.36, currentStage - 1) *
            coinMult *
            (isWeakSpot ? 2.1 : isCrit ? 1.4 : 1)
        )
      );
      const chunkBonusCoins =
        chunksBroken > 0
          ? chunksBroken * Math.max(1, Math.round(Math.pow(1.26, currentStage - 1) * coinMult))
          : 0;
      const hitCoins = baseHitCoins + chunkBonusCoins;

      if (activeBounty.kind === 'break_walls' && nextHp <= 0) {
        delta = 1;
      }
      if (delta > 0) {
        const nextProgVal = activeBounty.progress + delta;
        if (nextProgVal >= activeBounty.target) {
          bountyBonusCoins = activeBounty.rewardCoins;
          bountyBonusStr = activeBounty.rewardStrength;
          const nextBounty = createBountyContract(activeBounty.id + 1, prog, currentStage);
          bountyRef.current = nextBounty;
          setBounty(nextBounty);
          audioRef.current?.playAchievementClaim();
          showNotice(
            `Contract Complete! +${formatCompact(bountyBonusCoins)} Coins${
              bountyBonusStr > 0 ? ` & +${formatCompact(bountyBonusStr)} STR` : ''
            }`
          );
        } else {
          const updatedBounty = { ...activeBounty, progress: nextProgVal };
          bountyRef.current = updatedBounty;
          setBounty(updatedBounty);
        }
      }

      let comicWord: string | undefined;
      if (isWeakSpot) {
        comicWord = pickWord(WEAKSPOT_WORDS, totalPunches);
      } else if (chunksBroken >= 2) {
        comicWord = pickWord(MULTI_CHUNK_WORDS, totalPunches);
      } else if (chunksBroken === 1) {
        comicWord = pickWord(CHUNK_WORDS, totalPunches);
      } else if (isCrit) {
        comicWord = pickWord(CRIT_WORDS, totalPunches);
      } else if (totalPunches % 4 === 0) {
        comicWord = pickWord(HEAVY_WORDS, totalPunches);
      }

      spawnFloatingHit(sx, sy, `-${formatCompact(damage)}`, isCrit || isWeakSpot, {
        isWeakSpot,
        isChunkBreak: chunksBroken > 0,
        comicWord,
        tiltDeg: pickTilt(totalPunches),
        label: isWeakSpot
          ? `${weakSpotMult.toFixed(1)}X WEAK SPOT`
          : chunksBroken > 0
            ? `+${chunksBroken} CHUNK${chunksBroken > 1 ? 'S' : ''}`
            : undefined,
      });

      if (nextHp <= 0) {
        wallBreakingRef.current = true;
        const shatterMult = computeShatterBonusMultiplier(prog);
        const breakCoins =
          Math.round(spec.breakReward * coinMult * shatterMult) + hitCoins + bountyBonusCoins;
        const shatterStr =
          Math.max(1, Math.floor(spec.strengthPerPunch * 0.2 * vipMult)) + bountyBonusStr;
        const nextStage = currentStage + 1;
        // Prevent Boss GK re-drop farming when navigating back to already-cleared boss stages
        const rawBossDrop = getBossKnuckleDrop(currentStage);
        const bossDrop =
          rawBossDrop > 0 && currentStage > prog.highestBossStageCleared ? rawBossDrop : 0;

        const updated = saveLocalProgression({
          ...prog,
          coins: prog.coins + breakCoins,
          strength: prog.strength + shatterStr,
          wallsBroken: prog.wallsBroken + 1,
          highestStage: Math.max(prog.highestStage, nextStage),
          highestBossStageCleared:
            bossDrop > 0
              ? Math.max(prog.highestBossStageCleared, currentStage)
              : prog.highestBossStageCleared,
          bossesDefeated: prog.bossesDefeated + (rawBossDrop > 0 ? 1 : 0),
          goldenKnuckles: prog.goldenKnuckles + bossDrop,
          bestCombo,
          totalPunches,
          weakSpotsHit,
        });
        setProgression(updated);
        setWallHp(0);
        scheduleCloudSync(updated);

        spawnFloatingHit(50, 42, `+${formatCompact(breakCoins)} COINS`, true, {
          isChunkBreak: true,
          comicWord: rawBossDrop > 0 ? 'BOSS SHATTERED!' : 'OBLITERATED!',
          tiltDeg: -5,
          forceShow: true,
        });
        triggerStageBanner(
          currentStage,
          spec.name,
          breakCoins,
          bossDrop > 0 ? bossDrop : undefined
        );
        sceneRef.current?.triggerWallShatter(spec.material);
      } else {
        wallHpRef.current = nextHp;
        setWallHp(nextHp);
        const updated = saveLocalProgression({
          ...prog,
          coins: prog.coins + hitCoins + bountyBonusCoins,
          strength: prog.strength + bountyBonusStr,
          totalPunches,
          weakSpotsHit,
          bestCombo,
        });
        setProgression(updated);
        scheduleCloudSync(updated);
      }
    },
    [scheduleCloudSync, showNotice, spawnFloatingHit, triggerStageBanner]
  );

  const handleWallBreakTransitionComplete = useCallback(() => {
    const nextStage = stageRef.current + 1;
    const nextSpec = getWallSpecForStage(nextStage);
    stageRef.current = nextStage;
    wallHpRef.current = nextSpec.maxHp;
    wallBreakingRef.current = false;
    setStage(nextStage);
    setWallHp(nextSpec.maxHp);
    const boss = isBossStage(nextStage);
    setBossTimerSec(boss ? BOSS_TIME_LIMIT_SEC : 0);
    sceneRef.current?.configureWall(nextStage, 1);
    sceneRef.current?.resetWallCracks();
    sceneRef.current?.setBossMode(boss);
    if (boss) {
      audioRef.current?.playBossSpawn();
    }
  }, []);

  // Mount Three.js scene once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new PunchAudioEngine();
    audioRef.current = audio;
    const initSettings = settingsRef.current;
    audio.setAudioSettings({
      masterVolume: initSettings.masterVolume,
      bgmVolume: initSettings.bgmVolume,
      sfxVolume: initSettings.sfxVolume,
      bgmEnabled: initSettings.bgmEnabled,
      muted: initSettings.muted,
    });

    const scene = new PunchWallScene(mount, audio, {
      onPunchHit: handlePunchHit,
      onWallBreakTransitionComplete: handleWallBreakTransitionComplete,
    });
    sceneRef.current = scene;

    const initProg = progRef.current;
    const initSpec = getWallSpecForStage(stageRef.current);
    scene.applyGlove(
      initProg.equippedGlove,
      initProg.equippedGloveColor,
      initProg.skinTone
    );
    scene.applyHeavyBag(initProg.equippedBag, initProg.equippedBagColor);
    scene.setSplashRadius(computeEffectiveSplashRadius(initProg));
    scene.setPunchSpeedMultiplier(computeEffectiveSpeedMultiplier(initProg));
    scene.setPrestigeModifiers(initProg.prestigeUpgrades.weakspot * 1.0);
    scene.setEstimatedPunchPower(
      computeEffectivePunchPower(initProg),
      computeWeakSpotMultiplier(initProg) * computeChainCritMultiplier(initProg)
    );
    scene.setGraphicsQuality(initSettings.graphicsQuality);
    scene.setDofEnabled(initSettings.dofEnabled && initSettings.graphicsQuality !== 'low');
    scene.setShakeMultiplier(initSettings.shakeIntensity);
    scene.configureWall(stageRef.current, wallHpRef.current / initSpec.maxHp);
    scene.setBossMode(isBossStage(stageRef.current));
    scene.setPaused(screenStateRef.current !== 'PLAYING');

    return () => {
      scene.dispose();
      audio.stopBgm();
      sceneRef.current = null;
    };
  }, [handlePunchHit, handleWallBreakTransitionComplete]);

  // Keep 3D scene synced with equipped glove, paint, skin tone, bag, splash radius, speed & Overdrive
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const overdriveSpeedBoost = overdriveMs > 0 ? OVERDRIVE_SPEED_MULT : 1;
    const overdrivePowerBoost = overdriveMs > 0 ? OVERDRIVE_POWER_MULT : 1;
    scene.applyGlove(
      progression.equippedGlove,
      progression.equippedGloveColor,
      progression.skinTone
    );
    scene.applyHeavyBag(progression.equippedBag, progression.equippedBagColor);
    scene.setSplashRadius(computeEffectiveSplashRadius(progression));
    scene.setPunchSpeedMultiplier(
      computeEffectiveSpeedMultiplier(progression) * overdriveSpeedBoost
    );
    scene.setPrestigeModifiers(progression.prestigeUpgrades.weakspot * 1.0);
    scene.setEstimatedPunchPower(
      computeEffectivePunchPower(progression) * overdrivePowerBoost,
      computeWeakSpotMultiplier(progression) * computeChainCritMultiplier(progression)
    );
  }, [progression, overdriveMs > 0]);

  useEffect(() => {
    const spec = getWallSpecForStage(stage);
    sceneRef.current?.configureWall(stage, wallHp / spec.maxHp);
  }, [stage, wallHp]);

  useEffect(() => {
    sceneRef.current?.setTargetMode(targetMode);
  }, [targetMode]);

  useEffect(() => {
    sceneRef.current?.setAutoPunch(autoPunch);
  }, [autoPunch]);

  const performManualPunch = useCallback(() => {
    if (screenStateRef.current !== 'PLAYING') return;
    if (wallBreakingRef.current && targetModeRef.current === 'WALL') return;
    const critChance = computeEffectiveCritChance(progRef.current);
    const isCrit = Math.random() < critChance;
    sceneRef.current?.triggerPunch(isCrit, false);
  }, []);

  // Cursor aiming + Sleek cursor-dodging translucent HUD parallax (direct DOM updates, 0 re-renders)
  const handleCanvasPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (screenStateRef.current !== 'PLAYING') return;
    sceneRef.current?.aimAtPointer(e.clientX, e.clientY);

    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const nx = e.clientX / w;
    const ny = e.clientY / h;
    const dx = (0.5 - nx) * 14;

    if (topHudRef.current) {
      const nearTop = ny < 0.36;
      const topY = nearTop ? -((0.36 - ny) / 0.36) * 26 : 0;
      const topOpacity = nearTop ? 0.34 + (ny / 0.36) * 0.62 : 0.94;
      topHudRef.current.style.transform = `translate3d(${dx.toFixed(1)}px, ${topY.toFixed(1)}px, 0)`;
      topHudRef.current.style.opacity = topOpacity.toFixed(2);
    }

    if (bottomHudRef.current) {
      const nearBot = ny > 0.64;
      const botY = nearBot ? ((ny - 0.64) / 0.36) * 24 : 0;
      const botOpacity = nearBot ? 0.36 + ((1 - ny) / 0.36) * 0.6 : 0.94;
      bottomHudRef.current.style.transform = `translate3d(${(dx * 0.7).toFixed(1)}px, ${botY.toFixed(1)}px, 0)`;
      bottomHudRef.current.style.opacity = botOpacity.toFixed(2);
    }
  }, []);

  const handleCanvasPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    audioRef.current?.unlock();
    if (screenStateRef.current !== 'PLAYING') return;
    if (wallBreakingRef.current && targetModeRef.current === 'WALL') return;
    const critChance = computeEffectiveCritChance(progRef.current);
    const isCrit = Math.random() < critChance;
    sceneRef.current?.punchAtPointer(e.clientX, e.clientY, isCrit);
  }, []);

  // Customizable keyboard shortcuts + Escape / Pause handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (settingsOpen) {
        if (e.code === 'Escape') setSettingsOpen(false);
        return;
      }
      if (storeOpen) {
        if (e.code === 'Escape') setStoreOpen(false);
        return;
      }
      if (shopTab || leaderboardOpen || achievementsOpen || offlineReward) {
        if (e.code === 'Escape') {
          setShopTab(null);
          setLeaderboardOpen(false);
          setAchievementsOpen(false);
        }
        return;
      }

      const kb = settingsRef.current.keybinds;

      if (e.code === 'Escape' || e.code === kb.pause) {
        if (screenStateRef.current === 'PLAYING') {
          e.preventDefault();
          setScreenState('PAUSED');
        } else if (screenStateRef.current === 'PAUSED') {
          e.preventDefault();
          setScreenState('PLAYING');
        }
        return;
      }

      if (screenStateRef.current !== 'PLAYING') return;

      if (e.code === kb.punch || e.code === kb.altPunch) {
        e.preventDefault();
        if (!e.repeat) performManualPunch();
      } else if (e.code === kb.overdrive) {
        e.preventDefault();
        if (!e.repeat) activateOverdrive();
      } else if (e.code === kb.switchTarget) {
        e.preventDefault();
        setTargetMode((prev) => (prev === 'WALL' ? 'BAG' : 'WALL'));
      } else if (e.code === kb.autoPunch) {
        e.preventDefault();
        setAutoPunch((prev) => !prev);
      } else if (e.code === kb.toggleDock) {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    performManualPunch,
    activateOverdrive,
    shopTab,
    leaderboardOpen,
    achievementsOpen,
    settingsOpen,
    storeOpen,
    offlineReward,
  ]);

  const handleToggleMute = () => {
    audioRef.current?.unlock();
    handleUpdateSettings({ ...settings, muted: !settings.muted });
  };

  const handleBuyOrEquipGlove = (gloveId: string) => {
    const glove = GLOVE_DEFINITIONS.find((g) => g.id === gloveId);
    if (!glove) return;
    const current = progRef.current;
    const owned = current.unlockedGloves.includes(gloveId);

    if (owned) {
      audioRef.current?.unlock();
      audioRef.current?.playPurchase();
      const updated = saveLocalProgression({ ...current, equippedGlove: gloveId });
      setProgression(updated);
      scheduleCloudSync(updated);
      return;
    }

    if (current.coins < glove.cost) return;
    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...current,
      coins: current.coins - glove.cost,
      unlockedGloves: [...current.unlockedGloves, gloveId],
      equippedGlove: gloveId,
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleSelectGloveColor = (colorId: string) => {
    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...progRef.current,
      equippedGloveColor: colorId,
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleSelectSkinTone = (toneId: string) => {
    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...progRef.current,
      skinTone: toneId,
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleBuyOrEquipBag = (bagId: string) => {
    const bag = BAG_DEFINITIONS.find((b) => b.id === bagId);
    if (!bag) return;
    const current = progRef.current;
    const owned = current.unlockedBags.includes(bagId);

    if (owned) {
      audioRef.current?.unlock();
      audioRef.current?.playPurchase();
      const updated = saveLocalProgression({ ...current, equippedBag: bagId });
      setProgression(updated);
      scheduleCloudSync(updated);
      return;
    }

    if (current.coins < bag.cost) return;
    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...current,
      coins: current.coins - bag.cost,
      unlockedBags: [...current.unlockedBags, bagId],
      equippedBag: bagId,
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleSelectBagColor = (colorId: string) => {
    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...progRef.current,
      equippedBagColor: colorId,
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleBuyUpgrade = (key: UpgradeKey) => {
    const def = UPGRADE_DEFS.find((u) => u.key === key);
    if (!def) return;
    const current = progRef.current;
    const lvl = current.upgrades[key];
    if (lvl >= def.maxLevel) return;
    const cost = getUpgradeCost(def, lvl);
    if (current.coins < cost) return;

    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...current,
      coins: current.coins - cost,
      upgrades: { ...current.upgrades, [key]: lvl + 1 },
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleBuyMaxUpgrade = (key: UpgradeKey) => {
    const def = UPGRADE_DEFS.find((u) => u.key === key);
    if (!def) return;
    const current = progRef.current;
    const lvl = current.upgrades[key];
    const { levelsToBuy, totalCost } = computeMaxUpgradePurchase(def, lvl, current.coins);
    if (levelsToBuy <= 0) return;

    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...current,
      coins: current.coins - totalCost,
      upgrades: { ...current.upgrades, [key]: lvl + levelsToBuy },
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleBuyPrestigeUpgrade = (key: PrestigeKey) => {
    const def = PRESTIGE_UPGRADE_DEFS.find((p) => p.key === key);
    if (!def) return;
    const current = progRef.current;
    const lvl = current.prestigeUpgrades[key];
    if (lvl >= def.maxLevel) return;
    const cost = getPrestigeUpgradeCost(def, lvl);
    if (current.goldenKnuckles < cost) return;

    audioRef.current?.unlock();
    audioRef.current?.playAchievementClaim();
    const updated = saveLocalProgression({
      ...current,
      goldenKnuckles: current.goldenKnuckles - cost,
      prestigeUpgrades: { ...current.prestigeUpgrades, [key]: lvl + 1 },
    });
    setProgression(updated);
    scheduleCloudSync(updated);
  };

  const handleRebirth = () => {
    const current = progRef.current;
    const currentStage = stageRef.current;
    const stipulations = getRebirthStipulations(current, currentStage);
    if (!stipulations.allMet) return;

    const earnedKnuckles = computeGoldenKnucklesEarned(currentStage, current.rebirths);
    const starterCoins = current.prestigeUpgrades.starter * 150;
    const starterStrength = DEFAULT_PROGRESSION.strength + current.prestigeUpgrades.starter * 10;

    audioRef.current?.unlock();
    audioRef.current?.playWallShatter('diamond');

    const updated = saveLocalProgression({
      ...current,
      coins: starterCoins,
      strength: starterStrength,
      highestBossStageCleared: 0,
      upgrades: { ...DEFAULT_PROGRESSION.upgrades },
      rebirths: current.rebirths + 1,
      goldenKnuckles: current.goldenKnuckles + earnedKnuckles,
    });
    setProgression(updated);
    setStage(1);
    const firstSpec = getWallSpecForStage(1);
    stageRef.current = 1;
    wallHpRef.current = firstSpec.maxHp;
    setWallHp(firstSpec.maxHp);
    setBossTimerSec(0);
    sceneRef.current?.configureWall(1, 1);
    sceneRef.current?.resetWallCracks();
    sceneRef.current?.setBossMode(false);
    setShopTab(null);
    showNotice(
      `Rebirth Tier ${updated.rebirths}! Earned +${earnedKnuckles} GK (${(
        1 +
        updated.rebirths * 0.6
      ).toFixed(1)}x Power).`
    );
    scheduleCloudSync(updated);
  };

  const handleClaimAchievement = (id: string) => {
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return;
    const current = progRef.current;
    if (current.claimedAchievements.includes(id)) return;
    if (getAchievementProgress(current, ach) < ach.target) return;

    audioRef.current?.unlock();
    audioRef.current?.playAchievementClaim();
    const updated = saveLocalProgression({
      ...current,
      claimedAchievements: [...current.claimedAchievements, id],
    });
    setProgression(updated);
    setAchQueue((prev) => prev.filter((item) => item.id !== id));
    showNotice(`Claimed "${ach.title}" (${ach.rewardLabel})!`);
    scheduleCloudSync(updated);
  };

  const handleClaimAllAchievements = () => {
    const current = progRef.current;
    const readyIds = ACHIEVEMENTS.filter(
      (a) =>
        !current.claimedAchievements.includes(a.id) &&
        getAchievementProgress(current, a) >= a.target
    ).map((a) => a.id);
    if (readyIds.length === 0) return;

    audioRef.current?.unlock();
    audioRef.current?.playAchievementClaim();
    const updated = saveLocalProgression({
      ...current,
      claimedAchievements: [...current.claimedAchievements, ...readyIds],
    });
    setProgression(updated);
    setAchQueue((prev) => prev.filter((item) => !readyIds.includes(item.id)));
    showNotice(`Claimed ${readyIds.length} milestone bonus${readyIds.length > 1 ? 'es' : ''}!`);
    scheduleCloudSync(updated);
  };

  const handleClaimOfflineReward = () => {
    if (!offlineReward) return;
    const current = progRef.current;
    audioRef.current?.unlock();
    audioRef.current?.playPurchase();
    const updated = saveLocalProgression({
      ...current,
      coins: current.coins + offlineReward.coinsEarned,
      strength: current.strength + offlineReward.strengthEarned,
    });
    setProgression(updated);
    setOfflineReward(null);
    scheduleCloudSync(updated);
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      showNotice('Signed in and synced to cloud rankings.');
      if (leaderboardOpen) void refreshLeaderboard();
    } catch {
      showNotice('Sign-in was cancelled or blocked by popup settings.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    showNotice('Signed out. Local progress remains saved.');
  };

  const wallSpec = getWallSpecForStage(stage);
  const isBoss = isBossStage(stage);
  const hpPercent = Math.max(0, Math.min(100, (wallHp / wallSpec.maxHp) * 100));
  const isOverdrive = overdriveMs > 0;
  const speedMult =
    computeEffectiveSpeedMultiplier(progression) * (isOverdrive ? OVERDRIVE_SPEED_MULT : 1);
  const punchPower = Math.round(
    computeEffectivePunchPower(progression) * (isOverdrive ? OVERDRIVE_POWER_MULT : 1)
  );
  const autoHitsPerSec = 1 / Math.max(0.13, 0.32 / speedMult);
  const effectiveDps = Math.round(
    punchPower * autoHitsPerSec * (1 + computeEffectiveCritChance(progression))
  );
  const effectiveBagStr = Math.round(
    computeEffectiveBagStrength(progression, wallSpec.strengthPerPunch) *
      (isOverdrive ? OVERDRIVE_POWER_MULT : 1)
  );
  const equippedGlove = getGloveById(progression.equippedGlove);
  const equippedBag = getBagById(progression.equippedBag);
  const splashRadius = computeEffectiveSplashRadius(progression);
  const comboRank = getComboRank(combo);

  const unclaimedAchievements = ACHIEVEMENTS.filter(
    (a) =>
      !progression.claimedAchievements.includes(a.id) &&
      getAchievementProgress(progression, a) >= a.target
  ).length;

  const affordableGloves = GLOVE_DEFINITIONS.filter(
    (g) => !progression.unlockedGloves.includes(g.id) && progression.coins >= g.cost
  ).length;

  const affordableBags = BAG_DEFINITIONS.filter(
    (b) => !progression.unlockedBags.includes(b.id) && progression.coins >= b.cost
  ).length;

  const affordableUpgrades = UPGRADE_DEFS.filter((def) => {
    const lvl = progression.upgrades[def.key];
    return lvl < def.maxLevel && progression.coins >= getUpgradeCost(def, lvl);
  }).length;

  const canRebirthNow = getRebirthStipulations(progression, stage).allMet;
  const affordablePrestige = PRESTIGE_UPGRADE_DEFS.filter((def) => {
    const lvl = progression.prestigeUpgrades[def.key];
    return lvl < def.maxLevel && progression.goldenKnuckles >= getPrestigeUpgradeCost(def, lvl);
  }).length;

  const bossDropPreview =
    isBoss && stage > progression.highestBossStageCleared ? getBossKnuckleDrop(stage) : 0;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0E0F12]">
      {/* Isolated WebGL Three.js Canvas Mount */}
      <div
        ref={canvasMountRef}
        onPointerMove={handleCanvasPointerMove}
        onPointerDown={handleCanvasPointerDown}
        className="absolute inset-0 cursor-crosshair touch-none"
      />

      {/* Subtle Overdrive Fury Border Frame */}
      {screenState === 'PLAYING' && isOverdrive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border-4 border-orange-500/55 shadow-[inset_0_0_75px_rgba(249,115,22,0.28)]"
        />
      )}

      {/* Floating Screen-Space Comic Words, Damage & Coin Numbers */}
      {screenState === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {floatingHits.map((hit) => {
            const hasComic = Boolean(hit.comicWord);
            const tiltStyle = hasComic
              ? ({
                  left: `${hit.xPercent}%`,
                  top: `${hit.yPercent}%`,
                  '--tilt': `${hit.tiltDeg ?? -8}deg`,
                } as CSSProperties)
              : { left: `${hit.xPercent}%`, top: `${hit.yPercent}%` };

            return (
              <div
                key={hit.id}
                style={tiltStyle}
                className={`absolute select-none text-center ${
                  hasComic ? 'animate-comic-pop' : 'animate-float-damage'
                }`}
              >
                {hit.comicWord && (
                  <div
                    className={`font-display cartoony-outline text-lg font-black uppercase tracking-wider sm:text-xl ${
                      hit.isWeakSpot
                        ? 'text-rose-300'
                        : hit.isChunkBreak
                          ? 'text-amber-300'
                          : 'text-yellow-300'
                    }`}
                  >
                    {hit.comicWord}
                  </div>
                )}
                {hit.label && (
                  <div
                    className={`font-display text-xs font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${
                      hit.isWeakSpot ? 'text-rose-200' : 'text-amber-200'
                    }`}
                  >
                    {hit.label}
                  </div>
                )}
                <div
                  className={`font-display cartoony-outline font-extrabold ${
                    hit.isWeakSpot
                      ? 'text-3xl text-rose-400 sm:text-4xl'
                      : hit.isCrit
                        ? 'text-2xl text-amber-400 sm:text-3xl'
                        : hit.isChunkBreak
                          ? 'text-xl text-amber-200 sm:text-2xl'
                          : 'text-lg text-white sm:text-xl'
                  }`}
                >
                  {hit.amount}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Game HUD (Minimal, Translucent & Cursor-Dodging) */}
      {screenState === 'PLAYING' && (
        <>
          <header
            ref={topHudRef}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-2.5 transition-[transform,opacity] duration-150 ease-out md:p-4"
          >
            <div className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-xl border border-zinc-500/35 bg-[#0B0D12]/52 px-3.5 py-2 shadow-lg">
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-200">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <strong className="font-display text-sm tracking-wide text-amber-300">
                    {formatCompact(progression.coins)}
                  </strong>
                </span>
                <span className="text-zinc-500" aria-hidden="true">
                  ·
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Dumbbell className="h-3.5 w-3.5 text-emerald-400" />
                  <strong className="font-display text-sm tracking-wide text-zinc-100">
                    {formatCompact(progression.strength)} STR
                  </strong>
                </span>
                <span className="hidden sm:inline text-zinc-500" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline whitespace-nowrap">
                  Power{' '}
                  <strong className="font-display text-sm text-amber-400">
                    {formatCompact(punchPower)}
                  </strong>
                </span>
                <span className="hidden md:inline text-zinc-500" aria-hidden="true">
                  ·
                </span>
                <span className="hidden md:inline whitespace-nowrap text-zinc-300">
                  DPS{' '}
                  <strong className="font-mono-tabular text-orange-300">
                    {formatCompact(effectiveDps)}
                  </strong>
                </span>
                {(progression.rebirths > 0 || progression.goldenKnuckles > 0) && (
                  <>
                    <span className="text-zinc-500" aria-hidden="true">
                      ·
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Award className="h-3.5 w-3.5 text-yellow-400" />
                      <strong className="font-mono-tabular text-yellow-300">
                        {formatCompact(progression.goldenKnuckles)} GK
                      </strong>
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setScreenState('PAUSED')}
                  title={`Pause (${formatKeyCode(settings.keybinds.pause)} / ESC)`}
                  aria-label="Pause game"
                  className="flex h-8 items-center gap-1 rounded-lg border border-zinc-500/45 bg-[#12151C]/75 px-2.5 text-xs font-bold text-zinc-100 hover:border-amber-400 hover:text-amber-300"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline font-display">Pause</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings (Audio, Graphics, Keys)"
                  aria-label="Open settings"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-500/45 bg-[#12151C]/75 text-zinc-200 hover:border-amber-400 hover:text-amber-300"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-500/45 bg-[#12151C]/75 text-zinc-200 hover:border-amber-400 hover:text-amber-300"
                >
                  {settings.muted ? (
                    <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>

                {!user ? (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="hidden sm:flex items-center gap-1 rounded-lg border border-amber-500/40 bg-[#12151C]/75 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-400 whitespace-nowrap shrink-0"
                  >
                    <LogIn className="h-3.5 w-3.5 text-amber-400" />
                    Sign In
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLeaderboardOpen(true);
                      void refreshLeaderboard();
                    }}
                    className="hidden sm:block rounded-lg border border-emerald-500/35 bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-300 whitespace-nowrap shrink-0"
                  >
                    {user.displayName?.split(' ')[0] || progression.displayName}
                  </button>
                )}
              </div>
            </div>

            {/* Center Target Status Bar (Wall HP + Stage Nav + Boss Timer / Heavy Bag Training) */}
            <div
              className={`pointer-events-auto w-full max-w-md rounded-xl border bg-[#0B0D12]/52 px-3.5 py-2 shadow-lg ${
                isBoss && targetMode === 'WALL'
                  ? 'border-rose-500/75'
                  : 'border-zinc-500/35'
              }`}
            >
              {targetMode === 'WALL' ? (
                <>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        disabled={stage <= 1}
                        onClick={() => handleSelectStage(stage - 1)}
                        aria-label="Previous stage"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-500/45 bg-[#12151C]/80 text-zinc-200 hover:border-amber-400 disabled:opacity-35"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span
                        className={`font-display text-sm font-bold truncate ${
                          isBoss ? 'text-rose-300' : 'text-zinc-100'
                        }`}
                      >
                        {isBoss && <Skull className="mr-1 inline h-3.5 w-3.5 text-rose-400" />}
                        Stage {stage} · {wallSpec.name}
                      </span>
                      <button
                        type="button"
                        disabled={stage >= progression.highestStage}
                        onClick={() => handleSelectStage(stage + 1)}
                        aria-label="Next stage"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-500/45 bg-[#12151C]/80 text-zinc-200 hover:border-amber-400 disabled:opacity-35"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <span className="font-mono-tabular font-semibold text-amber-300 whitespace-nowrap shrink-0">
                      {formatCompact(wallHp)} / {formatCompact(wallSpec.maxHp)} HP
                    </span>
                  </div>

                  <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/85">
                    <div
                      className="absolute inset-y-0 left-0 bg-rose-400/75 transition-[width] duration-300 ease-out"
                      style={{ width: `${hpPercent}%` }}
                    />
                    <div
                      className={`relative h-full transition-[width] duration-100 ease-out ${
                        isBoss ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-300">
                    {isBoss ? (
                      <span className="flex items-center gap-1 font-mono-tabular font-bold text-rose-300">
                        <Clock className="h-3 w-3" />
                        {bossTimerSec}s Left ·{' '}
                        {bossDropPreview > 0
                          ? `+${bossDropPreview} GK Drop`
                          : 'Boss Cleared'}
                      </span>
                    ) : (
                      <span>Splash Area: {splashRadius.toFixed(2)}m radius</span>
                    )}
                    <span className="font-mono-tabular text-zinc-200">
                      {equippedGlove.name}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display text-sm font-bold text-emerald-300">
                    {equippedBag.name} · +{formatCompact(effectiveBagStr)} STR / Hit
                  </span>
                  <span className="font-mono-tabular text-zinc-200">
                    Power: {formatCompact(punchPower)}
                  </span>
                </div>
              )}
            </div>

            {/* Compact Top-Corner Live Bounty Contract & Overdrive Meter */}
            <div className="flex w-full max-w-5xl items-start justify-between gap-2 px-1">
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-zinc-500/35 bg-[#0B0D12]/52 px-3 py-1.5 text-xs shadow">
                <Target className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="font-medium text-zinc-100 whitespace-nowrap">{bounty.title}</span>
                <span className="font-mono-tabular font-bold text-emerald-300 whitespace-nowrap">
                  {bounty.progress}/{bounty.target}
                </span>
                <span className="hidden sm:inline font-mono-tabular text-[11px] text-amber-300 whitespace-nowrap">
                  (+{formatCompact(bounty.rewardCoins)}c)
                </span>
              </div>

              <button
                type="button"
                onClick={activateOverdrive}
                disabled={!isOverdrive && rage < 100}
                className={`pointer-events-auto font-display flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  isOverdrive
                    ? 'border-orange-400 bg-orange-500/35 text-orange-100'
                    : rage >= 100
                      ? 'border-amber-300 bg-amber-500 text-zinc-950 hover:bg-amber-400'
                      : 'border-zinc-500/35 bg-[#0B0D12]/52 text-zinc-200'
                }`}
              >
                <Zap
                  className={`h-3.5 w-3.5 ${
                    isOverdrive
                      ? 'text-orange-300'
                      : rage >= 100
                        ? 'text-zinc-950'
                        : 'text-amber-400'
                  }`}
                />
                {isOverdrive ? (
                  <span className="font-mono-tabular">
                    OVERDRIVE {(overdriveMs / 1000).toFixed(1)}s · {OVERDRIVE_POWER_MULT}X
                  </span>
                ) : rage >= 100 ? (
                  <span>OVERDRIVE READY ({formatKeyCode(settings.keybinds.overdrive)})</span>
                ) : (
                  <span className="font-mono-tabular">RAGE {Math.floor(rage)}%</span>
                )}
              </button>
            </div>

            {/* Dynamic Combo Rank Meter */}
            {comboRank && (
              <div
                className={`font-display cartoony-outline text-base font-extrabold tracking-wider ${comboRank.colorClass}`}
              >
                {combo} HIT {comboRank.label}
              </div>
            )}

            {/* Stage Clear Celebration Banner */}
            {stageBanner && (
              <div className="animate-banner-pop rounded-xl border border-amber-400/75 bg-[#12151C]/88 px-5 py-2 text-center shadow-2xl">
                <div className="font-display cartoony-outline text-base font-black uppercase tracking-wider text-amber-300">
                  Stage {stageBanner.stage} Cleared! · {stageBanner.materialName}
                </div>
                <div className="font-mono-tabular text-xs font-bold text-emerald-300">
                  +{formatCompact(stageBanner.coins)} Coins Awarded
                  {stageBanner.bossKnuckles
                    ? ` · +${stageBanner.bossKnuckles} Golden Knuckle Drop!`
                    : ''}
                </div>
              </div>
            )}
          </header>

          {/* Live Stacked Achievement Earned Notification UI */}
          {achQueue.length > 0 && (
            <div
              aria-live="polite"
              className="fixed right-4 top-20 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5"
            >
              {achQueue.map((toast) => (
                <div
                  key={toast.id}
                  className="animate-banner-pop rounded-xl border border-amber-400/80 bg-[#151820]/94 p-3.5 shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/20 text-amber-300">
                        <Medal className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-display text-[11px] font-bold uppercase tracking-wider text-amber-300">
                          Achievement Unlocked!
                        </div>
                        <div className="font-display text-sm font-bold text-zinc-100">
                          {toast.title}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss achievement notification"
                      onClick={() =>
                        setAchQueue((prev) => prev.filter((item) => item.id !== toast.id))
                      }
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-300">{toast.description}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-semibold text-emerald-300">
                      {toast.rewardLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClaimAchievement(toast.id)}
                      className="font-display rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-zinc-950 hover:bg-amber-400 whitespace-nowrap"
                    >
                      Claim Bonus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Collapsible, Translucent & Cursor-Dodging Bottom Control Dock */}
          <div
            ref={bottomHudRef}
            className="pointer-events-none fixed inset-x-0 bottom-7 z-20 flex flex-col items-center px-4 transition-[transform,opacity] duration-150 ease-out"
          >
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="pointer-events-auto font-display mb-1 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-zinc-500/40 bg-[#0B0D12]/62 px-3 py-0.5 text-[11px] font-semibold text-zinc-200 hover:text-amber-300"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Show Controls ({formatKeyCode(settings.keybinds.toggleDock)})
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Hide Controls ({formatKeyCode(settings.keybinds.toggleDock)})
                </>
              )}
            </button>

            {!dockCollapsed && (
              <div className="pointer-events-auto flex max-w-[94vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-zinc-500/35 bg-[#0B0D12]/55 p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={performManualPunch}
                  className="font-display flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 active:scale-95 whitespace-nowrap shrink-0"
                >
                  <Hammer className="h-4 w-4" />
                  Punch ({formatKeyCode(settings.keybinds.punch)})
                </button>

                <button
                  type="button"
                  onClick={() => setTargetMode((m) => (m === 'WALL' ? 'BAG' : 'WALL'))}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    targetMode === 'BAG'
                      ? 'border-emerald-500/65 bg-emerald-950/65 text-emerald-300'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-amber-400'
                  }`}
                >
                  <Dumbbell className="h-4 w-4" />
                  {targetMode === 'WALL'
                    ? `Train Bag (${formatKeyCode(settings.keybinds.switchTarget)})`
                    : `Face Wall (${formatKeyCode(settings.keybinds.switchTarget)})`}
                </button>

                <button
                  type="button"
                  onClick={() => setAutoPunch((a) => !a)}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    autoPunch
                      ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-amber-400'
                  }`}
                >
                  <Repeat className="h-4 w-4" />
                  Auto: {autoPunch ? 'On' : 'Off'}
                </button>

                <div className="hidden h-7 w-px bg-zinc-600/60 sm:block" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => setShopTab('gloves')}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    affordableGloves > 0
                      ? 'border-amber-400/75 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-amber-400'
                  }`}
                >
                  <Hand className="h-4 w-4 text-amber-400" />
                  <span>Gloves{affordableGloves > 0 ? ` (${affordableGloves})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShopTab('bags')}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    affordableBags > 0
                      ? 'border-emerald-400/75 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-emerald-400'
                  }`}
                >
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span>Bags{affordableBags > 0 ? ` (${affordableBags})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShopTab('upgrades')}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    affordableUpgrades > 0
                      ? 'border-amber-400/75 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-amber-400'
                  }`}
                >
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span>Upgrades{affordableUpgrades > 0 ? ` (${affordableUpgrades})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShopTab('rebirth')}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    canRebirthNow || affordablePrestige > 0
                      ? 'border-yellow-400/75 bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-yellow-400'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  <span>
                    Prestige
                    {canRebirthNow
                      ? ' (Ready)'
                      : affordablePrestige > 0
                        ? ` (${affordablePrestige})`
                        : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAchievementsOpen(true)}
                  className={`font-display flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    unclaimedAchievements > 0
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                      : 'border-zinc-500/45 bg-[#12151C]/75 text-zinc-100 hover:border-amber-400'
                  }`}
                >
                  <Medal className="h-4 w-4 text-amber-400" />
                  <span>
                    Milestones{unclaimedAchievements > 0 ? ` (${unclaimedAchievements})` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLeaderboardOpen(true);
                    void refreshLeaderboard();
                  }}
                  className="font-display flex items-center gap-1.5 rounded-xl border border-zinc-500/45 bg-[#12151C]/75 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-amber-400 whitespace-nowrap shrink-0"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Rankings
                </button>
              </div>
            )}
          </div>

          {/* Live Game Bottom Legal / Early-Development / Feedback Notice */}
          <footer className="pointer-events-none fixed inset-x-0 bottom-1 z-10 px-4 text-center text-[10px] leading-tight text-zinc-400/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            © 2025 LiveBetterGameS · HIT DAT WALL! (In Active Development) — Thank you all for
            playing! Feedback &amp; donations are highly encouraged — enjoy!
          </footer>
        </>
      )}

      {/* Start Screen Overlay */}
      {screenState === 'START' && (
        <StartMenuOverlay
          user={user}
          progression={progression}
          localHighscores={localHighscores}
          onStartGame={() => beginFreshRun(false)}
          onOpenLeaderboard={() => {
            setLeaderboardOpen(true);
            void refreshLeaderboard();
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStore={() => setStoreOpen(true)}
          onExitGame={() => setScreenState('EXITED')}
          onSignIn={handleSignIn}
          onSignOut={() => void handleSignOut()}
          onUpdateDisplayName={handleUpdateDisplayName}
        />
      )}

      {/* Pause Screen Overlay */}
      {screenState === 'PAUSED' && (
        <PauseMenuModal
          currentStage={stage}
          progression={progression}
          onResume={() => setScreenState('PLAYING')}
          onOpenLeaderboard={() => {
            setLeaderboardOpen(true);
            void refreshLeaderboard();
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStore={() => setStoreOpen(true)}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {/* Boss Defeat / Character Wipe Overlay */}
      {screenState === 'BOSS_FAILED' && bossFailedSummary && (
        <BossFailedModal
          summary={bossFailedSummary}
          onRetryFromWallOne={() => beginFreshRun(false)}
          onReturnToTitle={() => {
            setBossFailedSummary(null);
            setScreenState('START');
          }}
        />
      )}

      {/* Exited Game Screen */}
      {screenState === 'EXITED' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0B0D12]/95 p-6 text-center">
          <div />
          <div className="max-w-md rounded-2xl border border-zinc-700/80 bg-[#14171F] p-8 shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
              LiveBetterGameS
            </div>
            <h2 className="font-display cartoony-outline mt-2 text-4xl font-black uppercase text-zinc-100">
              THANKS FOR PLAYING!
            </h2>
            <p className="mt-3 text-sm text-zinc-300">
              You exited HIT DAT WALL! Your settings, highscores, and permanent supporter
              entitlements remain safely stored.
            </p>
            <button
              type="button"
              onClick={() => setScreenState('START')}
              className="font-display cartoony-outline mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-500 px-6 py-3 text-lg font-black text-zinc-950 shadow-[0_4px_0_#92400E] hover:bg-amber-400"
            >
              <RotateCcw className="h-5 w-5" />
              Return to Title Screen
            </button>
          </div>
          <footer className="text-[11px] text-zinc-400">
            © 2025 LiveBetterGameS · HIT DAT WALL! is still in active development. Thank you all
            for playing! Feedback and donations are highly encouraged — enjoy!
          </footer>
        </div>
      )}

      {/* Armory / Bags / Upgrades / Rebirth Modal */}
      {shopTab && (
        <ShopAndUpgradesModal
          initialTab={shopTab}
          currentStage={stage}
          progression={progression}
          onClose={() => setShopTab(null)}
          onBuyOrEquipGlove={handleBuyOrEquipGlove}
          onSelectGloveColor={handleSelectGloveColor}
          onSelectSkinTone={handleSelectSkinTone}
          onBuyOrEquipBag={handleBuyOrEquipBag}
          onSelectBagColor={handleSelectBagColor}
          onBuyUpgrade={handleBuyUpgrade}
          onBuyMaxUpgrade={handleBuyMaxUpgrade}
          onBuyPrestigeUpgrade={handleBuyPrestigeUpgrade}
          onRebirth={handleRebirth}
        />
      )}

      {/* Milestones & Achievements Modal */}
      {achievementsOpen && (
        <AchievementsModal
          progression={progression}
          onClaimAchievement={handleClaimAchievement}
          onClaimAllAchievements={handleClaimAllAchievements}
          onClose={() => setAchievementsOpen(false)}
        />
      )}

      {/* Settings Modal (Audio, Graphics, Keymapping) */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={handleUpdateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Supporter / IRL Currency Store Placeholder */}
      {storeOpen && (
        <PremiumStoreModal progression={progression} onClose={() => setStoreOpen(false)} />
      )}

      {/* Offline Progress Modal */}
      {offlineReward && (
        <OfflineProgressModal summary={offlineReward} onClaim={handleClaimOfflineReward} />
      )}

      {/* Local Highscores & Global Leaderboard Modal */}
      {leaderboardOpen && (
        <LeaderboardModal
          entries={leaderboardEntries}
          localHighscores={localHighscores}
          loading={leaderboardLoading}
          error={leaderboardError}
          user={user}
          progression={progression}
          onClose={() => setLeaderboardOpen(false)}
          onRefresh={() => void refreshLeaderboard()}
          onSignIn={handleSignIn}
          onSignOut={() => void handleSignOut()}
          onUpdateDisplayName={handleUpdateDisplayName}
        />
      )}

      {/* Status Notice */}
      {notice && (
        <div
          role="status"
          className="font-display fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-amber-500/45 bg-[#14161B]/95 px-4 py-2 text-xs font-bold tracking-wide text-amber-200 shadow-lg"
        >
          {notice}
        </div>
      )}
    </main>
  );
}
