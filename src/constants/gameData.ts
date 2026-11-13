import type {
  AchievementDef,
  BagDefinition,
  ColorPreset,
  GameSettings,
  GloveDefinition,
  PlayerProgression,
  PremiumProductDef,
  PrestigeKey,
  SkinTonePreset,
  UpgradeKey,
  WallMaterialKind,
  WallSpec,
} from '../types/game';

interface BaseWallTemplate {
  name: string;
  material: WallMaterialKind;
  baseColor: string;
  accentColor: string;
}

const WALL_TEMPLATES: BaseWallTemplate[] = [
  {
    name: 'Drywall Partition',
    material: 'drywall',
    baseColor: '#D6CEC2',
    accentColor: '#9CA3AF',
  },
  {
    name: 'Timber Plank Wall',
    material: 'wood',
    baseColor: '#8B5A2B',
    accentColor: '#5C3A1B',
  },
  {
    name: 'Red Clay Brick',
    material: 'brick',
    baseColor: '#9B3E2B',
    accentColor: '#D6CFC7',
  },
  {
    name: 'Reinforced Concrete',
    material: 'concrete',
    baseColor: '#737982',
    accentColor: '#4B5563',
  },
  {
    name: 'Riveted Steel Plate',
    material: 'steel',
    baseColor: '#6B7A8C',
    accentColor: '#CBD5E1',
  },
  {
    name: 'Obsidian Monolith',
    material: 'obsidian',
    baseColor: '#231D29',
    accentColor: '#F97316',
  },
  {
    name: 'Diamond Vault',
    material: 'diamond',
    baseColor: '#38BDF8',
    accentColor: '#E0F2FE',
  },
];

export function isBossStage(stage: number): boolean {
  const s = Math.max(1, Math.floor(stage));
  return s >= 5 && s % 5 === 0;
}

export function getBossKnuckleDrop(stage: number): number {
  if (!isBossStage(stage)) return 0;
  return 1 + Math.floor(stage / 25);
}

export function getWallSpecForStage(stage: number): WallSpec {
  const s = Math.max(1, Math.floor(stage));
  const template = WALL_TEMPLATES[(s - 1) % WALL_TEMPLATES.length];
  const tierCycle = Math.floor((s - 1) / WALL_TEMPLATES.length);
  const boss = isBossStage(s);

  const baseMaxHp = Math.round(80 * Math.pow(2.04, s - 1));
  const maxHp = boss ? Math.round(baseMaxHp * 1.85) : baseMaxHp;
  const baseReward = Math.round(14 * Math.pow(1.48, s - 1));
  const breakReward = boss ? Math.round(baseReward * 2.15) : baseReward;
  const strengthPerPunch = Math.max(1, Math.round(1 * Math.pow(1.22, s - 1)));

  const prefix = tierCycle > 0 ? `Tier ${tierCycle + 1} ` : '';
  return {
    stage: s,
    name: boss ? `BOSS · ${prefix}${template.name}` : `${prefix}${template.name}`,
    material: template.material,
    maxHp,
    breakReward,
    strengthPerPunch,
    baseColor: template.baseColor,
    accentColor: template.accentColor,
  };
}

export const GLOVE_DEFINITIONS: GloveDefinition[] = [
  {
    id: 'wraps',
    name: 'Taped Wraps',
    description: 'Layered athletic hand wraps built for breaking drywall and timber.',
    cost: 0,
    multiplier: 1,
    style: 'wraps',
    color: '#E5E0D8',
    cuffColor: '#52525B',
    knuckleColor: '#F4F4F5',
    metalness: 0.06,
    roughness: 0.84,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
  },
  {
    id: 'leather',
    name: 'Crimson Boxers',
    description: 'Stitched crimson leather boxing gloves that pack 60% harder wall punches.',
    cost: 65,
    multiplier: 1.6,
    style: 'boxing',
    color: '#B91C1C',
    cuffColor: '#18181B',
    knuckleColor: '#EF4444',
    metalness: 0.14,
    roughness: 0.36,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
  },
  {
    id: 'brass',
    name: 'Brass Gauntlets',
    description: 'Burnished bronze knuckle dusters with spiked strike plates.',
    cost: 280,
    multiplier: 2.6,
    style: 'brass',
    color: '#B45309',
    cuffColor: '#292524',
    knuckleColor: '#F59E0B',
    metalness: 0.9,
    roughness: 0.2,
    emissiveColor: '#451A03',
    emissiveIntensity: 0.15,
  },
  {
    id: 'iron',
    name: 'Cyber-Mech Fists',
    description: 'Articulated hydraulic robot gauntlets with reciprocating wrist pistons.',
    cost: 1150,
    multiplier: 4.2,
    style: 'robot',
    color: '#475569',
    cuffColor: '#0F172A',
    knuckleColor: '#38BDF8',
    metalness: 0.94,
    roughness: 0.18,
    emissiveColor: '#0284C7',
    emissiveIntensity: 0.55,
  },
  {
    id: 'magma',
    name: 'Flaming Gauntlets',
    description: 'Volcanic obsidian fists radiating molten heat and live rising embers.',
    cost: 4800,
    multiplier: 7.0,
    style: 'flaming',
    color: '#1C1917',
    cuffColor: '#431407',
    knuckleColor: '#F97316',
    metalness: 0.45,
    roughness: 0.44,
    emissiveColor: '#EA580C',
    emissiveIntensity: 0.85,
  },
  {
    id: 'diamond',
    name: 'Diamond Breakers',
    description: 'Prismatic crystalline fists with razor diamond knuckle shards.',
    cost: 22000,
    multiplier: 12.0,
    style: 'diamond',
    color: '#0284C7',
    cuffColor: '#0C4A6E',
    knuckleColor: '#E0F2FE',
    metalness: 0.72,
    roughness: 0.1,
    emissiveColor: '#38BDF8',
    emissiveIntensity: 0.5,
  },
  {
    id: 'carbon',
    name: 'Carbon Tactical',
    description: 'Matte carbon-weave tactical brawlers with reinforced emerald knuckle bars.',
    cost: 85000,
    multiplier: 18.5,
    style: 'carbon',
    color: '#18181B',
    cuffColor: '#09090B',
    knuckleColor: '#10B981',
    metalness: 0.62,
    roughness: 0.34,
    emissiveColor: '#059669',
    emissiveIntensity: 0.32,
  },
  {
    id: 'titanium',
    name: 'Titanium Hydraulic',
    description: 'Aerospace brushed titanium exosuit fists with dual recoil actuators.',
    cost: 320000,
    multiplier: 28.0,
    style: 'titanium',
    color: '#CBD5E1',
    cuffColor: '#334155',
    knuckleColor: '#F8FAFC',
    metalness: 0.96,
    roughness: 0.14,
    emissiveColor: '#0EA5E9',
    emissiveIntensity: 0.28,
  },
  {
    id: 'plasma',
    name: 'Plasma Reactor',
    description: 'Anodized containment gauntlets channeling high-voltage violet arc spikes.',
    cost: 1250000,
    multiplier: 44.0,
    style: 'plasma',
    color: '#1E1B4B',
    cuffColor: '#0F172A',
    knuckleColor: '#C084FC',
    metalness: 0.82,
    roughness: 0.18,
    emissiveColor: '#9333EA',
    emissiveIntensity: 0.92,
  },
  {
    id: 'celestial',
    name: 'Solar Sovereign',
    description: 'Royal forged-gold war gauntlets crowned with radiant prism strike shards.',
    cost: 5500000,
    multiplier: 72.0,
    style: 'celestial',
    color: '#D97706',
    cuffColor: '#451A03',
    knuckleColor: '#FEF08A',
    metalness: 0.95,
    roughness: 0.12,
    emissiveColor: '#F59E0B',
    emissiveIntensity: 0.7,
  },
  {
    id: 'emerald',
    name: 'Emerald Viper',
    description: 'Razor-edged viridian alloy gauntlets with toxic emerald dorsal vents.',
    cost: 18000000,
    multiplier: 110.0,
    style: 'emerald',
    color: '#064E3B',
    cuffColor: '#022C22',
    knuckleColor: '#34D399',
    metalness: 0.76,
    roughness: 0.22,
    emissiveColor: '#10B981',
    emissiveIntensity: 0.62,
  },
  {
    id: 'frost',
    name: 'Glacial Cryo',
    description: 'Sub-zero crystalline gauntlets tipped with jagged permafrost lance shards.',
    cost: 60000000,
    multiplier: 165.0,
    style: 'frost',
    color: '#0E7490',
    cuffColor: '#164E63',
    knuckleColor: '#E0F7FA',
    metalness: 0.65,
    roughness: 0.08,
    emissiveColor: '#22D3EE',
    emissiveIntensity: 0.68,
  },
  {
    id: 'obsidian_fist',
    name: 'Obsidian Cleaver',
    description: 'Volcanic basalt knuckle-breakers spiked with superheated tungsten claws.',
    cost: 210000000,
    multiplier: 245.0,
    style: 'obsidian_fist',
    color: '#1C1917',
    cuffColor: '#0C0A09',
    knuckleColor: '#FB923C',
    metalness: 0.55,
    roughness: 0.36,
    emissiveColor: '#EA580C',
    emissiveIntensity: 0.78,
  },
  {
    id: 'neon_synth',
    name: 'Neon Cyber-Volt',
    description: 'Synthwave hyper-coil gauntlets pulsing with twin magenta and cyan arcs.',
    cost: 750000000,
    multiplier: 360.0,
    style: 'neon_synth',
    color: '#3B0764',
    cuffColor: '#09090B',
    knuckleColor: '#F472B6',
    metalness: 0.85,
    roughness: 0.16,
    emissiveColor: '#EC4899',
    emissiveIntensity: 0.95,
  },
  {
    id: 'samurai',
    name: 'Shogun Oni',
    description: 'Lacquered crimson-and-gold warlord gauntlets forged for siege-breaker strikes.',
    cost: 2600000000,
    multiplier: 540.0,
    style: 'samurai',
    color: '#7F1D1D',
    cuffColor: '#18181B',
    knuckleColor: '#FACC15',
    metalness: 0.88,
    roughness: 0.2,
    emissiveColor: '#DC2626',
    emissiveIntensity: 0.45,
  },
  {
    id: 'mecha_gold',
    name: 'Aegis Mk-IX',
    description: 'Gold-plated titan exoskeleton fists driven by triple hydraulic pile-drivers.',
    cost: 9500000000,
    multiplier: 820.0,
    style: 'mecha_gold',
    color: '#CA8A04',
    cuffColor: '#1E293B',
    knuckleColor: '#FEF08A',
    metalness: 0.96,
    roughness: 0.14,
    emissiveColor: '#38BDF8',
    emissiveIntensity: 0.55,
  },
  {
    id: 'void_reaver',
    name: 'Void Abyssal',
    description: 'Antimatter-forged war fists wrapped in collapsing violet gravity rings.',
    cost: 35000000000,
    multiplier: 1250.0,
    style: 'void_reaver',
    color: '#09090B',
    cuffColor: '#1E1B4B',
    knuckleColor: '#A855F7',
    metalness: 0.78,
    roughness: 0.2,
    emissiveColor: '#7E22CE',
    emissiveIntensity: 1.05,
  },
  {
    id: 'crimson_demon',
    name: 'Hellfire Ravager',
    description: 'Infernal ruby demon gauntlets with blazing spiked brass-hell knuckles.',
    cost: 130000000000,
    multiplier: 1900.0,
    style: 'crimson_demon',
    color: '#450A0A',
    cuffColor: '#1C1917',
    knuckleColor: '#F87171',
    metalness: 0.72,
    roughness: 0.24,
    emissiveColor: '#EF4444',
    emissiveIntensity: 1.0,
  },
  {
    id: 'quantum',
    name: 'Quantum Singularity',
    description: 'Zero-point containment fists channeling crystalline subatomic shockwaves.',
    cost: 500000000000,
    multiplier: 2950.0,
    style: 'quantum',
    color: '#0F172A',
    cuffColor: '#020617',
    knuckleColor: '#22D3EE',
    metalness: 0.9,
    roughness: 0.1,
    emissiveColor: '#06B6D4',
    emissiveIntensity: 1.15,
  },
  {
    id: 'galaxian',
    name: 'Galaxian Omega',
    description: 'Mythic starlight-forged breaker gauntlets uniting solar crown, plasma & crystal.',
    cost: 2000000000000,
    multiplier: 4800.0,
    style: 'galaxian',
    color: '#312E81',
    cuffColor: '#09090B',
    knuckleColor: '#FDE047',
    metalness: 0.94,
    roughness: 0.09,
    emissiveColor: '#A855F7',
    emissiveIntensity: 1.1,
  },
];

export const GLOVE_COLOR_PRESETS: ColorPreset[] = [
  { id: 'default', name: 'Original', primaryHex: '', accentHex: '' },
  { id: 'stealth', name: 'Stealth Matte', primaryHex: '#18181B', accentHex: '#71717A' },
  { id: 'crimson', name: 'Crimson Fury', primaryHex: '#991B1B', accentHex: '#F87171' },
  { id: 'cobalt', name: 'Cobalt Volt', primaryHex: '#1D4ED8', accentHex: '#38BDF8' },
  { id: 'emerald', name: 'Emerald Venom', primaryHex: '#065F46', accentHex: '#34D399' },
  { id: 'gold', name: 'Royal Gold', primaryHex: '#B45309', accentHex: '#FACC15' },
  { id: 'rose', name: 'Neon Rose', primaryHex: '#9D174D', accentHex: '#FB7185' },
  { id: 'frost', name: 'Arctic Frost', primaryHex: '#E2E8F0', accentHex: '#7DD3FC' },
  { id: 'violet', name: 'Abyss Violet', primaryHex: '#4C1D95', accentHex: '#C084FC' },
  { id: 'inferno', name: 'Solar Magma', primaryHex: '#7C2D12', accentHex: '#FB923C' },
  { id: 'mint', name: 'Cyber Mint', primaryHex: '#115E59', accentHex: '#2DD4BF' },
  { id: 'obsidian', name: 'Void Chrome', primaryHex: '#09090B', accentHex: '#FDE047' },
];

export const SKIN_TONE_PRESETS: SkinTonePreset[] = [
  { id: 'fair', name: 'Fair', hex: '#E8BE9E' },
  { id: 'tan', name: 'Warm Tan', hex: '#D6A37A' },
  { id: 'bronze', name: 'Bronze', hex: '#B5784E' },
  { id: 'umber', name: 'Deep Umber', hex: '#7A492C' },
  { id: 'slate', name: 'Cyber Sleeve', hex: '#27272A' },
  { id: 'golden', name: 'Gilded Alloy', hex: '#D97706' },
  { id: 'void', name: 'Shadow Wrap', hex: '#18181B' },
];

export const BAG_DEFINITIONS: BagDefinition[] = [
  {
    id: 'leather',
    name: 'Gym Leather Bag',
    description: 'Classic stitched crimson heavy bag hung from steel links.',
    cost: 0,
    strMultiplier: 1.0,
    coinBonus: 0,
    style: 'leather',
    bodyColor: '#991B1B',
    strapColor: '#18181B',
    metalColor: '#94A3B8',
    roughness: 0.44,
    metalness: 0.14,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
  },
  {
    id: 'canvas',
    name: 'Vintage Sandbag',
    description: 'Packed canvas army sandbag built for +40% denser Strength conditioning.',
    cost: 140,
    strMultiplier: 1.4,
    coinBonus: 0.1,
    style: 'canvas',
    bodyColor: '#A18867',
    strapColor: '#443322',
    metalColor: '#78716C',
    roughness: 0.86,
    metalness: 0.05,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
  },
  {
    id: 'kevlar',
    name: 'Kevlar Tactical Bag',
    description: 'Ballistic-weave combat bag yielding 2.0x Heavy Bag Strength & +20% Coins.',
    cost: 850,
    strMultiplier: 2.0,
    coinBonus: 0.2,
    style: 'kevlar',
    bodyColor: '#1E293B',
    strapColor: '#0F172A',
    metalColor: '#38BDF8',
    roughness: 0.56,
    metalness: 0.3,
    emissiveColor: '#0284C7',
    emissiveIntensity: 0.15,
  },
  {
    id: 'iron',
    name: 'Iron-Core Drum',
    description: 'Riveted cast-iron striker drum delivering 3.0x Bag Strength & +35% Coins.',
    cost: 5200,
    strMultiplier: 3.0,
    coinBonus: 0.35,
    style: 'iron',
    bodyColor: '#475569',
    strapColor: '#1E293B',
    metalColor: '#CBD5E1',
    roughness: 0.28,
    metalness: 0.88,
    emissiveColor: '#000000',
    emissiveIntensity: 0,
  },
  {
    id: 'obsidian',
    name: 'Volcanic Pillar',
    description: 'Magma-veined basalt training column yielding 4.5x Bag Strength & +55% Coins.',
    cost: 34000,
    strMultiplier: 4.5,
    coinBonus: 0.55,
    style: 'obsidian',
    bodyColor: '#1C1917',
    strapColor: '#431407',
    metalColor: '#F97316',
    roughness: 0.38,
    metalness: 0.35,
    emissiveColor: '#EA580C',
    emissiveIntensity: 0.65,
  },
  {
    id: 'diamond',
    name: 'Diamond Vault Bag',
    description: 'Faceted crystalline powerhouse yielding 7.0x Bag Strength & +85% Coins.',
    cost: 195000,
    strMultiplier: 7.0,
    coinBonus: 0.85,
    style: 'diamond',
    bodyColor: '#0284C7',
    strapColor: '#0C4A6E',
    metalColor: '#E0F2FE',
    roughness: 0.12,
    metalness: 0.65,
    emissiveColor: '#38BDF8',
    emissiveIntensity: 0.45,
  },
  {
    id: 'chrome',
    name: 'Chrome Mirror Cylinder',
    description: 'Mirror-polished tungsten alloy cylinder built for 10.5x Bag Strength & +115% Coins.',
    cost: 950000,
    strMultiplier: 10.5,
    coinBonus: 1.15,
    style: 'chrome',
    bodyColor: '#E2E8F0',
    strapColor: '#334155',
    metalColor: '#FFFFFF',
    roughness: 0.08,
    metalness: 0.98,
    emissiveColor: '#64748B',
    emissiveIntensity: 0.12,
  },
  {
    id: 'jade',
    name: 'Jade Temple Pillar',
    description: 'Carved imperial nephrite stone bag yielding 16.0x Bag Strength & +150% Coins.',
    cost: 4500000,
    strMultiplier: 16.0,
    coinBonus: 1.5,
    style: 'jade',
    bodyColor: '#047857',
    strapColor: '#064E3B',
    metalColor: '#FACC15',
    roughness: 0.22,
    metalness: 0.32,
    emissiveColor: '#10B981',
    emissiveIntensity: 0.42,
  },
  {
    id: 'magma',
    name: 'Magma Core Drum',
    description: 'Incandescent forge drum radiating 24.0x Bag Strength & +190% Coins.',
    cost: 22000000,
    strMultiplier: 24.0,
    coinBonus: 1.9,
    style: 'magma',
    bodyColor: '#7C2D12',
    strapColor: '#292524',
    metalColor: '#FDBA74',
    roughness: 0.34,
    metalness: 0.55,
    emissiveColor: '#F97316',
    emissiveIntensity: 0.85,
  },
  {
    id: 'cyber',
    name: 'Cyber-Grid Matrix',
    description: 'Holographic hex-shield training pod yielding 36.0x Bag Strength & +240% Coins.',
    cost: 110000000,
    strMultiplier: 36.0,
    coinBonus: 2.4,
    style: 'cyber',
    bodyColor: '#0F172A',
    strapColor: '#020617',
    metalColor: '#22D3EE',
    roughness: 0.24,
    metalness: 0.82,
    emissiveColor: '#06B6D4',
    emissiveIntensity: 0.9,
  },
  {
    id: 'titanium',
    name: 'Titanium Reactor Bag',
    description: 'Heavy aerospace reactor core yielding 55.0x Bag Strength & +300% Coins.',
    cost: 520000000,
    strMultiplier: 55.0,
    coinBonus: 3.0,
    style: 'titanium',
    bodyColor: '#94A3B8',
    strapColor: '#1E293B',
    metalColor: '#38BDF8',
    roughness: 0.16,
    metalness: 0.94,
    emissiveColor: '#0EA5E9',
    emissiveIntensity: 0.5,
  },
  {
    id: 'inferno',
    name: 'Inferno Forged Bell',
    description: 'Superheated demon-iron foundry bell yielding 84.0x Bag Strength & +380% Coins.',
    cost: 2400000000,
    strMultiplier: 84.0,
    coinBonus: 3.8,
    style: 'inferno',
    bodyColor: '#7F1D1D',
    strapColor: '#1C1917',
    metalColor: '#FDE047',
    roughness: 0.3,
    metalness: 0.72,
    emissiveColor: '#EF4444',
    emissiveIntensity: 0.95,
  },
  {
    id: 'void',
    name: 'Void Gravity Cylinder',
    description: 'Dark-matter containment drum yielding 130.0x Bag Strength & +480% Coins.',
    cost: 12000000000,
    strMultiplier: 130.0,
    coinBonus: 4.8,
    style: 'void',
    bodyColor: '#1E1B4B',
    strapColor: '#09090B',
    metalColor: '#C084FC',
    roughness: 0.18,
    metalness: 0.8,
    emissiveColor: '#9333EA',
    emissiveIntensity: 1.0,
  },
  {
    id: 'gold',
    name: 'Solid Bullion Vault',
    description: '24-karat treasury ingot heavy bag yielding 200.0x Bag Strength & +600% Coins.',
    cost: 60000000000,
    strMultiplier: 200.0,
    coinBonus: 6.0,
    style: 'gold',
    bodyColor: '#D97706',
    strapColor: '#451A03',
    metalColor: '#FEF08A',
    roughness: 0.12,
    metalness: 0.97,
    emissiveColor: '#F59E0B',
    emissiveIntensity: 0.55,
  },
  {
    id: 'neon',
    name: 'Synthwave Prism Bag',
    description: 'Laser-etched retro-volt heavy bag yielding 310.0x Bag Strength & +750% Coins.',
    cost: 300000000000,
    strMultiplier: 310.0,
    coinBonus: 7.5,
    style: 'neon',
    bodyColor: '#701A75',
    strapColor: '#09090B',
    metalColor: '#22D3EE',
    roughness: 0.18,
    metalness: 0.76,
    emissiveColor: '#EC4899',
    emissiveIntensity: 0.95,
  },
  {
    id: 'celestial',
    name: 'Celestial Star-Core',
    description: 'Orbiting astral monolith cylinder yielding 500.0x Bag Strength & +950% Coins.',
    cost: 1500000000000,
    strMultiplier: 500.0,
    coinBonus: 9.5,
    style: 'celestial',
    bodyColor: '#312E81',
    strapColor: '#1E1B4B',
    metalColor: '#FDE047',
    roughness: 0.1,
    metalness: 0.92,
    emissiveColor: '#A855F7',
    emissiveIntensity: 1.05,
  },
];

export const BAG_COLOR_PRESETS: ColorPreset[] = [
  { id: 'default', name: 'Original', primaryHex: '', accentHex: '' },
  { id: 'red', name: 'Arena Red', primaryHex: '#991B1B', accentHex: '#F59E0B' },
  { id: 'black', name: 'Shadow Gym', primaryHex: '#18181B', accentHex: '#A1A1AA' },
  { id: 'gold', name: 'Champ Gold', primaryHex: '#B45309', accentHex: '#FDE047' },
  { id: 'cobalt', name: 'Cobalt Steel', primaryHex: '#1E40AF', accentHex: '#38BDF8' },
  { id: 'lime', name: 'Toxic Strike', primaryHex: '#14532D', accentHex: '#4ADE80' },
  { id: 'violet', name: 'Void Neon', primaryHex: '#581C87', accentHex: '#E879F9' },
  { id: 'cyan', name: 'Cryo Cyber', primaryHex: '#155E75', accentHex: '#22D3EE' },
  { id: 'chrome', name: 'Silver Alloy', primaryHex: '#CBD5E1', accentHex: '#F8FAFC' },
  { id: 'ember', name: 'Molten Core', primaryHex: '#7C2D12', accentHex: '#FB923C' },
];

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costScale: number;
  effectText: (level: number) => string;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: 'power',
    name: 'Heavy Impact',
    description: 'Increases base punch force by +15% per rank.',
    maxLevel: 25,
    baseCost: 35,
    costScale: 1.75,
    effectText: (lvl) => `+${lvl * 15}% Power`,
  },
  {
    key: 'speed',
    name: 'Rapid Jab',
    description: 'Increases punch animation speed and auto-punch rate.',
    maxLevel: 25,
    baseCost: 45,
    costScale: 1.72,
    effectText: (lvl) => `${(1 + lvl * 0.1).toFixed(2)}x Speed`,
  },
  {
    key: 'crit',
    name: 'Knuckle Crits',
    description: 'Chance for 2.0x critical hits with heavy screen shake.',
    maxLevel: 25,
    baseCost: 60,
    costScale: 1.78,
    effectText: (lvl) => `${Math.min(75, 5 + lvl * 2.5).toFixed(1)}% Crit`,
  },
  {
    key: 'wealth',
    name: 'Bounty Payout',
    description: 'Increases coins earned from hits and shattered walls by +15%.',
    maxLevel: 25,
    baseCost: 50,
    costScale: 1.75,
    effectText: (lvl) => `+${lvl * 15}% Coins`,
  },
  {
    key: 'splash',
    name: 'Shockwave Spread',
    description: 'Expands your 3D wall splash-damage reticle & grants +8% chunk break coins.',
    maxLevel: 20,
    baseCost: 75,
    costScale: 1.82,
    effectText: (lvl) => `+${(lvl * 0.05).toFixed(2)}m Area / +${lvl * 8}%`,
  },
  {
    key: 'combo',
    name: 'Combo Momentum',
    description: 'Longer combo chains ramp punch power faster and extend combo duration.',
    maxLevel: 20,
    baseCost: 90,
    costScale: 1.84,
    effectText: (lvl) => `+${(lvl * 0.18).toFixed(2)}%/Hit · +${(lvl * 0.085).toFixed(1)}s`,
  },
];

export interface PrestigeUpgradeDef {
  key: PrestigeKey;
  name: string;
  description: string;
  category: 'Passive' | 'Ability';
  maxLevel: number;
  baseCost: number;
  costStep: number;
  effectText: (level: number) => string;
}

export const PRESTIGE_UPGRADE_DEFS: PrestigeUpgradeDef[] = [
  {
    key: 'titan',
    name: 'Titan Bloodline',
    description: 'Permanently boosts all punch power by +25% per rank across rebirths.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 4,
    costStep: 3,
    effectText: (lvl) => `+${lvl * 25}% Perm Power`,
  },
  {
    key: 'midas',
    name: 'Midas Knuckles',
    description: 'Permanently boosts all coin drops by +20% per rank.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 4,
    costStep: 3,
    effectText: (lvl) => `+${lvl * 20}% Perm Coins`,
  },
  {
    key: 'bagmaster',
    name: 'Iron Conditioning',
    description: 'Heavy Bag training pumps +35% more Strength per hit per rank.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 3,
    costStep: 2,
    effectText: (lvl) => `+${lvl * 35}% Bag STR`,
  },
  {
    key: 'starter',
    name: 'Vault Inheritance',
    description: 'Begin every Rebirth immediately with +150 Coins & +10 Strength per rank.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 3,
    costStep: 2,
    effectText: (lvl) => `${lvl * 150} Coins / +${lvl * 10} STR`,
  },
  {
    key: 'shockwave',
    name: 'Seismic Crater',
    description: 'Widens 3D splash-damage reticle & grants +15% Wall Shatter bonus coins.',
    category: 'Ability',
    maxLevel: 20,
    baseCost: 6,
    costStep: 4,
    effectText: (lvl) => `+${(lvl * 0.12).toFixed(2)}m / +${lvl * 15}% Shatter`,
  },
  {
    key: 'weakspot',
    name: 'Vital Precision',
    description: 'Weak Spots spawn faster (-1s cooldown) and hit +0.5x harder per rank.',
    category: 'Ability',
    maxLevel: 20,
    baseCost: 6,
    costStep: 4,
    effectText: (lvl) => `${(3.5 + lvl * 0.5).toFixed(1)}x Weak Spot`,
  },
  {
    key: 'chaincrit',
    name: 'Chain Fracture',
    description: 'Critical & Weak Spot hits trigger +15% bonus devastation damage per rank.',
    category: 'Ability',
    maxLevel: 20,
    baseCost: 7,
    costStep: 4,
    effectText: (lvl) => `+${lvl * 15}% Crit Impact`,
  },
  {
    key: 'combomaster',
    name: 'Fury Retention',
    description: 'Combo floor starts +2 higher and scales +0.25%/hit stronger per rank.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 5,
    costStep: 3,
    effectText: (lvl) => `Floor ${lvl * 2} / +${(lvl * 0.25).toFixed(2)}%/Hit`,
  },
  {
    key: 'overdrive',
    name: 'Auto-Overdrive',
    description: 'Boosts punch speed and auto-punch cadence by +10% per rank permanently.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 6,
    costStep: 4,
    effectText: (lvl) => `+${lvl * 10}% Speed`,
  },
  {
    key: 'idle',
    name: 'Offline Mastery',
    description: 'Increases idle coin & strength generation while away by +40% per rank.',
    category: 'Passive',
    maxLevel: 20,
    baseCost: 5,
    costStep: 3,
    effectText: (lvl) => `+${lvl * 40}% Offline Yield`,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  // Walls Broken (8)
  {
    id: 'first_blood',
    title: 'First Breakthrough',
    description: 'Shatter your very first wall.',
    metric: 'wallsBroken',
    target: 1,
    rewardType: 'power',
    rewardValue: 0.08,
    rewardLabel: '+8% Perm Power',
  },
  {
    id: 'wall_wrecker',
    title: 'Wall Wrecker',
    description: 'Shatter 10 total walls.',
    metric: 'wallsBroken',
    target: 10,
    rewardType: 'power',
    rewardValue: 0.12,
    rewardLabel: '+12% Perm Power',
  },
  {
    id: 'demolition_expert',
    title: 'Demolition Legend',
    description: 'Shatter 30 total walls.',
    metric: 'wallsBroken',
    target: 30,
    rewardType: 'coins',
    rewardValue: 0.15,
    rewardLabel: '+15% Perm Coins',
  },
  {
    id: 'siege_titan',
    title: 'Siege Titan',
    description: 'Shatter 75 total walls.',
    metric: 'wallsBroken',
    target: 75,
    rewardType: 'splash',
    rewardValue: 0.12,
    rewardLabel: '+0.12m Splash Area',
  },
  {
    id: 'world_breaker',
    title: 'World Breaker',
    description: 'Shatter 150 total walls.',
    metric: 'wallsBroken',
    target: 150,
    rewardType: 'power',
    rewardValue: 0.25,
    rewardLabel: '+25% Perm Power',
  },
  {
    id: 'fortress_ruin',
    title: 'Fortress Ruin',
    description: 'Shatter 350 total walls.',
    metric: 'wallsBroken',
    target: 350,
    rewardType: 'coins',
    rewardValue: 0.28,
    rewardLabel: '+28% Perm Coins',
  },
  {
    id: 'tectonic_fist',
    title: 'Tectonic Fist',
    description: 'Shatter 750 total walls.',
    metric: 'wallsBroken',
    target: 750,
    rewardType: 'power',
    rewardValue: 0.35,
    rewardLabel: '+35% Perm Power',
  },
  {
    id: 'planetary_shatter',
    title: 'Planetary Shatter',
    description: 'Shatter 1,500 total walls.',
    metric: 'wallsBroken',
    target: 1500,
    rewardType: 'power',
    rewardValue: 0.5,
    rewardLabel: '+50% Perm Power',
  },

  // Lifetime Punches (7)
  {
    id: 'knuckle_duster',
    title: 'Relentless Striker',
    description: 'Throw 250 lifetime punches.',
    metric: 'totalPunches',
    target: 250,
    rewardType: 'speed',
    rewardValue: 0.08,
    rewardLabel: '+8% Punch Speed',
  },
  {
    id: 'iron_fists',
    title: 'Machine Gun Jabs',
    description: 'Throw 1,500 lifetime punches.',
    metric: 'totalPunches',
    target: 1500,
    rewardType: 'speed',
    rewardValue: 0.12,
    rewardLabel: '+12% Punch Speed',
  },
  {
    id: 'endless_flurry',
    title: 'Endless Flurry',
    description: 'Throw 5,000 lifetime punches.',
    metric: 'totalPunches',
    target: 5000,
    rewardType: 'crit',
    rewardValue: 0.04,
    rewardLabel: '+4% Crit Chance',
  },
  {
    id: 'sonic_barrage',
    title: 'Sonic Barrage',
    description: 'Throw 15,000 lifetime punches.',
    metric: 'totalPunches',
    target: 15000,
    rewardType: 'speed',
    rewardValue: 0.15,
    rewardLabel: '+15% Punch Speed',
  },
  {
    id: 'hurricane_hands',
    title: 'Hurricane Hands',
    description: 'Throw 35,000 lifetime punches.',
    metric: 'totalPunches',
    target: 35000,
    rewardType: 'coins',
    rewardValue: 0.25,
    rewardLabel: '+25% Perm Coins',
  },
  {
    id: 'phantom_boxer',
    title: 'Phantom Striker',
    description: 'Throw 75,000 lifetime punches.',
    metric: 'totalPunches',
    target: 75000,
    rewardType: 'crit',
    rewardValue: 0.06,
    rewardLabel: '+6% Crit Chance',
  },
  {
    id: 'eternal_brawler',
    title: 'Eternal Brawler',
    description: 'Throw 150,000 lifetime punches.',
    metric: 'totalPunches',
    target: 150000,
    rewardType: 'speed',
    rewardValue: 0.2,
    rewardLabel: '+20% Punch Speed',
  },

  // Strength Mastery (7)
  {
    id: 'iron_will',
    title: 'Heavy Bag Regular',
    description: 'Train up to 250 Strength.',
    metric: 'strength',
    target: 250,
    rewardType: 'power',
    rewardValue: 0.12,
    rewardLabel: '+12% Perm Power',
  },
  {
    id: 'gym_monster',
    title: 'Iron Gym Monster',
    description: 'Train up to 2,500 Strength.',
    metric: 'strength',
    target: 2500,
    rewardType: 'bagStr',
    rewardValue: 0.2,
    rewardLabel: '+20% Bag STR',
  },
  {
    id: 'colossus_str',
    title: 'Colossus Physique',
    description: 'Train up to 25,000 Strength.',
    metric: 'strength',
    target: 25000,
    rewardType: 'power',
    rewardValue: 0.22,
    rewardLabel: '+22% Perm Power',
  },
  {
    id: 'herculean_grip',
    title: 'Herculean Core',
    description: 'Train up to 250,000 Strength.',
    metric: 'strength',
    target: 250000,
    rewardType: 'bagStr',
    rewardValue: 0.3,
    rewardLabel: '+30% Bag STR',
  },
  {
    id: 'mountain_mover',
    title: 'Mountain Mover',
    description: 'Train up to 2.5M Strength.',
    metric: 'strength',
    target: 2500000,
    rewardType: 'power',
    rewardValue: 0.35,
    rewardLabel: '+35% Perm Power',
  },
  {
    id: 'gravity_crusher',
    title: 'Gravity Crusher',
    description: 'Train up to 25M Strength.',
    metric: 'strength',
    target: 25000000,
    rewardType: 'bagStr',
    rewardValue: 0.45,
    rewardLabel: '+45% Bag STR',
  },
  {
    id: 'supernova_muscle',
    title: 'Supernova Physique',
    description: 'Train up to 250M Strength.',
    metric: 'strength',
    target: 250000000,
    rewardType: 'power',
    rewardValue: 0.5,
    rewardLabel: '+50% Perm Power',
  },

  // Weak Spot Precision (6)
  {
    id: 'sharpshooter',
    title: 'Weak Spot Sniper',
    description: 'Strike 10 glowing Weak Spots on walls.',
    metric: 'weakSpotsHit',
    target: 10,
    rewardType: 'crit',
    rewardValue: 0.04,
    rewardLabel: '+4% Crit Chance',
  },
  {
    id: 'precision_ace',
    title: 'Precision Master',
    description: 'Strike 45 glowing Weak Spots on walls.',
    metric: 'weakSpotsHit',
    target: 45,
    rewardType: 'splash',
    rewardValue: 0.14,
    rewardLabel: '+0.14m Splash Area',
  },
  {
    id: 'fault_finder',
    title: 'Fault-Line Hunter',
    description: 'Strike 120 glowing Weak Spots on walls.',
    metric: 'weakSpotsHit',
    target: 120,
    rewardType: 'power',
    rewardValue: 0.2,
    rewardLabel: '+20% Perm Power',
  },
  {
    id: 'surgical_striker',
    title: 'Surgical Striker',
    description: 'Strike 300 glowing Weak Spots on walls.',
    metric: 'weakSpotsHit',
    target: 300,
    rewardType: 'crit',
    rewardValue: 0.06,
    rewardLabel: '+6% Crit Chance',
  },
  {
    id: 'fracture_virtuoso',
    title: 'Fracture Virtuoso',
    description: 'Strike 650 glowing Weak Spots on walls.',
    metric: 'weakSpotsHit',
    target: 650,
    rewardType: 'splash',
    rewardValue: 0.18,
    rewardLabel: '+0.18m Splash Area',
  },
  {
    id: 'apex_marksman',
    title: 'Apex Weak-Spot Legend',
    description: 'Strike 1,200 glowing Weak Spots on walls.',
    metric: 'weakSpotsHit',
    target: 1200,
    rewardType: 'power',
    rewardValue: 0.4,
    rewardLabel: '+40% Perm Power',
  },

  // Gloves Collected (5)
  {
    id: 'glove_pair',
    title: 'Fresh Knuckles',
    description: 'Unlock 2 different 3D gloves.',
    metric: 'unlockedGloves',
    target: 2,
    rewardType: 'coins',
    rewardValue: 0.1,
    rewardLabel: '+10% Perm Coins',
  },
  {
    id: 'collector',
    title: 'Gauntlet Arsenal',
    description: 'Unlock 4 different 3D gloves.',
    metric: 'unlockedGloves',
    target: 4,
    rewardType: 'coins',
    rewardValue: 0.15,
    rewardLabel: '+15% Perm Coins',
  },
  {
    id: 'armory_king',
    title: 'Armory Curator',
    description: 'Unlock 8 different 3D gloves.',
    metric: 'unlockedGloves',
    target: 8,
    rewardType: 'power',
    rewardValue: 0.2,
    rewardLabel: '+20% Perm Power',
  },
  {
    id: 'grand_armory',
    title: 'Grand Armory Baron',
    description: 'Unlock 14 different 3D gloves.',
    metric: 'unlockedGloves',
    target: 14,
    rewardType: 'power',
    rewardValue: 0.35,
    rewardLabel: '+35% Perm Power',
  },
  {
    id: 'complete_gauntlets',
    title: 'Galaxian Armory God',
    description: 'Unlock all 20 different 3D gloves.',
    metric: 'unlockedGloves',
    target: 20,
    rewardType: 'power',
    rewardValue: 0.65,
    rewardLabel: '+65% Perm Power',
  },

  // Heavy Bags Collected (5)
  {
    id: 'bag_starter',
    title: 'Sandbag Sparring',
    description: 'Unlock 2 different Heavy Bags.',
    metric: 'unlockedBags',
    target: 2,
    rewardType: 'bagStr',
    rewardValue: 0.15,
    rewardLabel: '+15% Bag STR',
  },
  {
    id: 'bag_collector',
    title: 'Heavy Bag Collector',
    description: 'Unlock 4 different Heavy Bags.',
    metric: 'unlockedBags',
    target: 4,
    rewardType: 'bagStr',
    rewardValue: 0.25,
    rewardLabel: '+25% Bag STR',
  },
  {
    id: 'gym_tycoon',
    title: 'Gym Equipment Tycoon',
    description: 'Unlock 8 different Heavy Bags.',
    metric: 'unlockedBags',
    target: 8,
    rewardType: 'coins',
    rewardValue: 0.25,
    rewardLabel: '+25% Perm Coins',
  },
  {
    id: 'iron_gym_master',
    title: 'Reactor Conditioning',
    description: 'Unlock 12 different Heavy Bags.',
    metric: 'unlockedBags',
    target: 12,
    rewardType: 'bagStr',
    rewardValue: 0.45,
    rewardLabel: '+45% Bag STR',
  },
  {
    id: 'cosmic_gym',
    title: 'Celestial Gym Owner',
    description: 'Unlock all 16 different Heavy Bags.',
    metric: 'unlockedBags',
    target: 16,
    rewardType: 'bagStr',
    rewardValue: 0.75,
    rewardLabel: '+75% Bag STR',
  },

  // Stage Progression (6)
  {
    id: 'stage_apprentice',
    title: 'Steel Door Buster',
    description: 'Reach Wall Stage 5.',
    metric: 'highestStage',
    target: 5,
    rewardType: 'coins',
    rewardValue: 0.12,
    rewardLabel: '+12% Perm Coins',
  },
  {
    id: 'stage_climber',
    title: 'Vault Breacher',
    description: 'Reach Wall Stage 10.',
    metric: 'highestStage',
    target: 10,
    rewardType: 'coins',
    rewardValue: 0.18,
    rewardLabel: '+18% Perm Coins',
  },
  {
    id: 'stage_legend',
    title: 'Citadel Crusher',
    description: 'Reach Wall Stage 20.',
    metric: 'highestStage',
    target: 20,
    rewardType: 'coins',
    rewardValue: 0.28,
    rewardLabel: '+28% Perm Coins',
  },
  {
    id: 'stage_apex',
    title: 'Monolith Ravager',
    description: 'Reach Wall Stage 35.',
    metric: 'highestStage',
    target: 35,
    rewardType: 'power',
    rewardValue: 0.35,
    rewardLabel: '+35% Perm Power',
  },
  {
    id: 'stage_mythic',
    title: 'Dimension Piercer',
    description: 'Reach Wall Stage 50.',
    metric: 'highestStage',
    target: 50,
    rewardType: 'coins',
    rewardValue: 0.45,
    rewardLabel: '+45% Perm Coins',
  },
  {
    id: 'stage_immortal',
    title: 'Omega Horizon',
    description: 'Reach Wall Stage 75.',
    metric: 'highestStage',
    target: 75,
    rewardType: 'power',
    rewardValue: 0.6,
    rewardLabel: '+60% Perm Power',
  },

  // Rebirth Ascension (5)
  {
    id: 'ascended',
    title: 'Golden Rebirth',
    description: 'Complete your first Rebirth ascension.',
    metric: 'rebirths',
    target: 1,
    rewardType: 'power',
    rewardValue: 0.15,
    rewardLabel: '+15% Perm Power',
  },
  {
    id: 'prestige_veteran',
    title: 'Ascended Striker',
    description: 'Complete 3 Rebirth ascensions.',
    metric: 'rebirths',
    target: 3,
    rewardType: 'speed',
    rewardValue: 0.12,
    rewardLabel: '+12% Punch Speed',
  },
  {
    id: 'rebirth_champion',
    title: 'Phoenix Champion',
    description: 'Complete 6 Rebirth ascensions.',
    metric: 'rebirths',
    target: 6,
    rewardType: 'coins',
    rewardValue: 0.3,
    rewardLabel: '+30% Perm Coins',
  },
  {
    id: 'rebirth_sovereign',
    title: 'Golden Sovereign',
    description: 'Complete 10 Rebirth ascensions.',
    metric: 'rebirths',
    target: 10,
    rewardType: 'power',
    rewardValue: 0.45,
    rewardLabel: '+45% Perm Power',
  },
  {
    id: 'rebirth_eternal',
    title: 'Immortal Paragon',
    description: 'Complete 15 Rebirth ascensions.',
    metric: 'rebirths',
    target: 15,
    rewardType: 'power',
    rewardValue: 0.75,
    rewardLabel: '+75% Perm Power',
  },

  // Timed Boss Walls Shattered (4)
  {
    id: 'boss_slayer_1',
    title: 'Vault Boss Slayer',
    description: 'Shatter 1 Timed Boss Wall before the timer expires.',
    metric: 'bossesDefeated',
    target: 1,
    rewardType: 'power',
    rewardValue: 0.14,
    rewardLabel: '+14% Perm Power',
  },
  {
    id: 'boss_slayer_5',
    title: 'Guardian Hunter',
    description: 'Shatter 5 Timed Boss Walls.',
    metric: 'bossesDefeated',
    target: 5,
    rewardType: 'coins',
    rewardValue: 0.22,
    rewardLabel: '+22% Perm Coins',
  },
  {
    id: 'boss_slayer_15',
    title: 'Siege Executioner',
    description: 'Shatter 15 Timed Boss Walls.',
    metric: 'bossesDefeated',
    target: 15,
    rewardType: 'power',
    rewardValue: 0.32,
    rewardLabel: '+32% Perm Power',
  },
  {
    id: 'boss_slayer_35',
    title: 'Apex Boss Conqueror',
    description: 'Shatter 35 Timed Boss Walls.',
    metric: 'bossesDefeated',
    target: 35,
    rewardType: 'coins',
    rewardValue: 0.5,
    rewardLabel: '+50% Perm Coins',
  },

  // Peak Combo Chain (4)
  {
    id: 'combo_25',
    title: 'Rhythm Boxer',
    description: 'Reach a 25 Hit Combo chain.',
    metric: 'bestCombo',
    target: 25,
    rewardType: 'speed',
    rewardValue: 0.08,
    rewardLabel: '+8% Punch Speed',
  },
  {
    id: 'combo_75',
    title: 'Adrenaline Rush',
    description: 'Reach a 75 Hit Combo chain.',
    metric: 'bestCombo',
    target: 75,
    rewardType: 'crit',
    rewardValue: 0.05,
    rewardLabel: '+5% Crit Chance',
  },
  {
    id: 'combo_150',
    title: 'Relentless Tempest',
    description: 'Reach a 150 Hit Combo chain.',
    metric: 'bestCombo',
    target: 150,
    rewardType: 'power',
    rewardValue: 0.25,
    rewardLabel: '+25% Perm Power',
  },
  {
    id: 'combo_300',
    title: 'Infinite Momentum',
    description: 'Reach a 300 Hit Combo chain.',
    metric: 'bestCombo',
    target: 300,
    rewardType: 'speed',
    rewardValue: 0.2,
    rewardLabel: '+20% Punch Speed',
  },

  // Overdrive Activations (3)
  {
    id: 'overdrive_1',
    title: 'Limit Break',
    description: 'Unleash your first Overdrive Fury Burst.',
    metric: 'overdrivesUsed',
    target: 1,
    rewardType: 'power',
    rewardValue: 0.12,
    rewardLabel: '+12% Perm Power',
  },
  {
    id: 'overdrive_10',
    title: 'Rage Conduit',
    description: 'Unleash 10 Overdrive Fury Bursts.',
    metric: 'overdrivesUsed',
    target: 10,
    rewardType: 'splash',
    rewardValue: 0.15,
    rewardLabel: '+0.15m Splash Area',
  },
  {
    id: 'overdrive_30',
    title: 'Supernova Berserker',
    description: 'Unleash 30 Overdrive Fury Bursts.',
    metric: 'overdrivesUsed',
    target: 30,
    rewardType: 'power',
    rewardValue: 0.38,
    rewardLabel: '+38% Perm Power',
  },
];

export function getAchievementProgress(prog: PlayerProgression, def: AchievementDef): number {
  switch (def.metric) {
    case 'wallsBroken':
      return prog.wallsBroken;
    case 'strength':
      return prog.strength;
    case 'totalPunches':
      return prog.totalPunches;
    case 'weakSpotsHit':
      return prog.weakSpotsHit;
    case 'unlockedGloves':
      return prog.unlockedGloves.length;
    case 'unlockedBags':
      return prog.unlockedBags.length;
    case 'rebirths':
      return prog.rebirths;
    case 'highestStage':
      return prog.highestStage;
    case 'bossesDefeated':
      return prog.bossesDefeated;
    case 'bestCombo':
      return prog.bestCombo;
    case 'overdrivesUsed':
      return prog.overdrivesUsed;
  }
}

export function getAchievementBonuses(prog: PlayerProgression) {
  let powerBonus = 0;
  let coinBonus = 0;
  let speedBonus = 0;
  let critBonus = 0;
  let bagStrBonus = 0;
  let splashBonus = 0;
  for (const ach of ACHIEVEMENTS) {
    if (prog.claimedAchievements.includes(ach.id)) {
      if (ach.rewardType === 'power') powerBonus += ach.rewardValue;
      else if (ach.rewardType === 'coins') coinBonus += ach.rewardValue;
      else if (ach.rewardType === 'speed') speedBonus += ach.rewardValue;
      else if (ach.rewardType === 'crit') critBonus += ach.rewardValue;
      else if (ach.rewardType === 'bagStr') bagStrBonus += ach.rewardValue;
      else if (ach.rewardType === 'splash') splashBonus += ach.rewardValue;
    }
  }
  return { powerBonus, coinBonus, speedBonus, critBonus, bagStrBonus, splashBonus };
}

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  if (currentLevel >= def.maxLevel) return 0;
  return Math.round(def.baseCost * Math.pow(def.costScale, currentLevel));
}

export function computeMaxUpgradePurchase(
  def: UpgradeDef,
  currentLevel: number,
  coins: number
): { levelsToBuy: number; totalCost: number } {
  let lvl = currentLevel;
  let remaining = coins;
  let levelsToBuy = 0;
  let totalCost = 0;
  while (lvl < def.maxLevel) {
    const stepCost = getUpgradeCost(def, lvl);
    if (remaining < stepCost) break;
    remaining -= stepCost;
    totalCost += stepCost;
    lvl++;
    levelsToBuy++;
  }
  return { levelsToBuy, totalCost };
}

export function getPrestigeUpgradeCost(def: PrestigeUpgradeDef, currentLevel: number): number {
  if (currentLevel >= def.maxLevel) return 0;
  return def.baseCost + currentLevel * def.costStep + Math.floor((currentLevel * currentLevel) / 2);
}

export function getGloveById(id: string): GloveDefinition {
  return GLOVE_DEFINITIONS.find((g) => g.id === id) ?? GLOVE_DEFINITIONS[0];
}

export function getBagById(id: string): BagDefinition {
  return BAG_DEFINITIONS.find((b) => b.id === id) ?? BAG_DEFINITIONS[0];
}

export function getGloveColorPreset(id: string): ColorPreset {
  return GLOVE_COLOR_PRESETS.find((c) => c.id === id) ?? GLOVE_COLOR_PRESETS[0];
}

export function getSkinTonePreset(id: string): SkinTonePreset {
  return SKIN_TONE_PRESETS.find((s) => s.id === id) ?? SKIN_TONE_PRESETS[1];
}

export function getBagColorPreset(id: string): ColorPreset {
  return BAG_COLOR_PRESETS.find((c) => c.id === id) ?? BAG_COLOR_PRESETS[0];
}

export function computeEffectivePunchPower(prog: PlayerProgression): number {
  const glove = getGloveById(prog.equippedGlove);
  const { powerBonus } = getAchievementBonuses(prog);
  const powerUpgrade = 1 + prog.upgrades.power * 0.15;
  const rebirthMult = 1 + prog.rebirths * 0.6;
  const titanMult = 1 + prog.prestigeUpgrades.titan * 0.25;
  return Math.max(
    1,
    Math.round(
      prog.strength * glove.multiplier * powerUpgrade * rebirthMult * titanMult * (1 + powerBonus)
    )
  );
}

export function computeEffectiveCoinMultiplier(prog: PlayerProgression): number {
  const { coinBonus } = getAchievementBonuses(prog);
  const bag = getBagById(prog.equippedBag);
  const wealthMult = 1 + prog.upgrades.wealth * 0.15;
  const midasMult = 1 + prog.prestigeUpgrades.midas * 0.2;
  return wealthMult * midasMult * (1 + coinBonus + bag.coinBonus * 0.35);
}

export function computeEffectiveSpeedMultiplier(prog: PlayerProgression): number {
  const { speedBonus } = getAchievementBonuses(prog);
  return (
    (1 + prog.upgrades.speed * 0.1) *
    (1 + prog.prestigeUpgrades.overdrive * 0.1) *
    (1 + speedBonus)
  );
}

export function computeEffectiveCritChance(prog: PlayerProgression): number {
  const { critBonus } = getAchievementBonuses(prog);
  return Math.min(0.75, 0.05 + prog.upgrades.crit * 0.025 + critBonus);
}

export function computeEffectiveBagStrength(prog: PlayerProgression, baseBagStr: number): number {
  const bag = getBagById(prog.equippedBag);
  const { bagStrBonus } = getAchievementBonuses(prog);
  const bagMaster = 1 + prog.prestigeUpgrades.bagmaster * 0.35;
  const rebirthBoost = 1 + prog.rebirths * 0.45;
  return Math.max(
    1,
    Math.round(baseBagStr * bag.strMultiplier * bagMaster * rebirthBoost * (1 + bagStrBonus))
  );
}

export function computeEffectiveBagCoins(prog: PlayerProgression, stage: number): number {
  const bag = getBagById(prog.equippedBag);
  const coinMult = computeEffectiveCoinMultiplier(prog);
  return Math.max(1, Math.round(stage * (0.5 + bag.coinBonus) * coinMult));
}

export function computeEffectiveSplashRadius(prog: PlayerProgression): number {
  const { splashBonus } = getAchievementBonuses(prog);
  return (
    0.88 +
    prog.upgrades.splash * 0.05 +
    prog.prestigeUpgrades.shockwave * 0.12 +
    splashBonus
  );
}

export function computeComboPowerMultiplier(prog: PlayerProgression, combo: number): number {
  const perHit =
    0.004 + prog.upgrades.combo * 0.0018 + prog.prestigeUpgrades.combomaster * 0.0025;
  return 1 + Math.min(2.5, Math.max(0, combo) * perHit);
}

export function computeComboFloor(prog: PlayerProgression): number {
  return prog.prestigeUpgrades.combomaster * 2;
}

export function computeComboDecayMs(prog: PlayerProgression): number {
  return 1700 + prog.upgrades.combo * 85;
}

export function computeWeakSpotMultiplier(prog: PlayerProgression): number {
  return 3.5 + prog.prestigeUpgrades.weakspot * 0.5;
}

export function computeChainCritMultiplier(prog: PlayerProgression): number {
  return 1 + prog.prestigeUpgrades.chaincrit * 0.15;
}

export function computeShatterBonusMultiplier(prog: PlayerProgression): number {
  return 1 + prog.prestigeUpgrades.shockwave * 0.15 + prog.upgrades.splash * 0.08;
}

export function getRebirthRequirementStage(rebirths: number): number {
  return 8 + rebirths * 4;
}

export interface RebirthStipulation {
  id: string;
  label: string;
  current: number;
  target: number;
  met: boolean;
}

export function getRebirthStipulations(
  prog: PlayerProgression,
  currentStage: number
): { allMet: boolean; items: RebirthStipulation[] } {
  const reqStage = getRebirthRequirementStage(prog.rebirths);
  const reqWalls = 8 + prog.rebirths * 6;
  const reqStrength = 60 * (prog.rebirths + 1) * (prog.rebirths + 1);

  const items: RebirthStipulation[] = [
    {
      id: 'stage',
      label: `Reach Wall Stage ${reqStage}`,
      current: currentStage,
      target: reqStage,
      met: currentStage >= reqStage,
    },
    {
      id: 'walls',
      label: `Shatter ${reqWalls} Lifetime Walls`,
      current: prog.wallsBroken,
      target: reqWalls,
      met: prog.wallsBroken >= reqWalls,
    },
    {
      id: 'strength',
      label: `Train ${formatCompact(reqStrength)} Strength`,
      current: prog.strength,
      target: reqStrength,
      met: prog.strength >= reqStrength,
    },
  ];
  return {
    allMet: items.every((i) => i.met),
    items,
  };
}

export function computeGoldenKnucklesEarned(currentStage: number, rebirths: number): number {
  const req = getRebirthRequirementStage(rebirths);
  if (currentStage < req) return 0;
  return 1 + Math.floor((currentStage - req) / 4);
}

export function formatCompact(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (num < 1000) return Math.floor(num).toLocaleString();
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let n = num;
  let u = -1;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)}${units[u]}`;
}

export function createBountyContract(
  id: number,
  prog: PlayerProgression,
  stage: number
): {
  id: number;
  kind: 'wall_punches' | 'bag_punches' | 'weak_spots' | 'break_walls' | 'crit_hits';
  title: string;
  progress: number;
  target: number;
  rewardCoins: number;
  rewardStrength: number;
} {
  const coinMult = computeEffectiveCoinMultiplier(prog);
  const spec = getWallSpecForStage(stage);
  const baseCoins = Math.max(8, Math.round(spec.breakReward * 0.22 * coinMult));
  const baseStr = Math.max(2, Math.round(computeEffectiveBagStrength(prog, spec.strengthPerPunch) * 1.15));

  const kinds = ['wall_punches', 'bag_punches', 'weak_spots', 'break_walls', 'crit_hits'] as const;
  const kind = kinds[id % kinds.length];

  switch (kind) {
    case 'wall_punches':
      return {
        id,
        kind,
        title: 'Land 40 Wall Punches',
        progress: 0,
        target: 40,
        rewardCoins: Math.round(baseCoins * 0.9),
        rewardStrength: 0,
      };
    case 'bag_punches':
      return {
        id,
        kind,
        title: 'Train 32 Heavy Bag Hits',
        progress: 0,
        target: 32,
        rewardCoins: Math.round(baseCoins * 0.7),
        rewardStrength: Math.round(baseStr * 1.4),
      };
    case 'weak_spots':
      return {
        id,
        kind,
        title: 'Hit 3 Weak Spots',
        progress: 0,
        target: 3,
        rewardCoins: Math.round(baseCoins * 1.35),
        rewardStrength: baseStr,
      };
    case 'break_walls':
      return {
        id,
        kind,
        title: 'Shatter 4 Walls',
        progress: 0,
        target: 4,
        rewardCoins: Math.round(baseCoins * 1.65),
        rewardStrength: baseStr,
      };
    case 'crit_hits':
      return {
        id,
        kind,
        title: 'Score 12 Critical Hits',
        progress: 0,
        target: 12,
        rewardCoins: Math.round(baseCoins * 1.1),
        rewardStrength: Math.round(baseStr * 0.65),
      };
  }
}

export const PREMIUM_PRODUCTS: PremiumProductDef[] = [
  {
    id: 'starter_crate',
    name: 'Starter Breaker Crate',
    tagline: 'Permanent Run Boost',
    description:
      'Keep +500 Coins and +25 Strength at the start of every single run, even after failing a Boss or restarting.',
    priceLabel: '$1.99 (Coming Soon)',
    perks: ['+500 Starting Coins every run', '+25 Starting Strength every run', 'Kept forever across resets'],
    starterCoinsBonus: 500,
    starterStrengthBonus: 25,
    badgeColor: '#F59E0B',
  },
  {
    id: 'vip_pass',
    name: 'VIP Gym Pass',
    tagline: 'Kept Forever Entitlement',
    description:
      'Permanent VIP supporter pass granting +50% Coin & Strength drops across every character wipe and session.',
    priceLabel: '$4.99 (Coming Soon)',
    perks: ['+50% Permanent Coins', '+50% Permanent Strength Gain', 'VIP Crown Tag on Leaderboards'],
    badgeColor: '#FACC15',
  },
  {
    id: 'galaxian_bundle',
    name: 'Carbon & Brass Pack',
    tagline: 'Permanent Armaments',
    description:
      'Permanently own Brass Gauntlets & Carbon Tactical Gloves from Wall 1 across every single reset.',
    priceLabel: '$3.99 (Coming Soon)',
    perks: ['Permanent Brass Gauntlets', 'Permanent Carbon Tactical Gloves', 'Auto-unlocked on Wall 1'],
    grantsGloveId: 'carbon',
    badgeColor: '#10B981',
  },
  {
    id: 'titan_bag_pack',
    name: 'Iron-Core Gym Pack',
    tagline: 'Permanent Training Gear',
    description:
      'Keep the Iron-Core Heavy Bag unlocked permanently every time you start a new run.',
    priceLabel: '$2.99 (Coming Soon)',
    perks: ['Permanent Iron-Core Heavy Bag', '3.0x Bag STR from Stage 1', 'Kept across Boss resets'],
    grantsBagId: 'iron',
    badgeColor: '#38BDF8',
  },
  {
    id: 'rage_accelerator',
    name: 'Adrenaline Core',
    tagline: 'Faster Fury Charge',
    description:
      'Charge Overdrive Fury 35% faster on every wall and heavy bag punch permanently.',
    priceLabel: '$3.49 (Coming Soon)',
    perks: ['+35% Rage Charge Speed', '+1.5s Overdrive Duration', 'Retained across all wipes'],
    badgeColor: '#F97316',
  },
  {
    id: 'founder_crown',
    name: 'LiveBetterGameS Founder',
    tagline: 'All-In Supporter Pack',
    description:
      'Support active development of HIT DAT WALL! Includes Plasma Reactor Gloves & +1,500 starter Coins.',
    priceLabel: '$9.99 (Coming Soon)',
    perks: ['Permanent Plasma Reactor Gloves', '+1,500 Starter Coins & +60 STR', 'Founder Supporter Badge'],
    grantsGloveId: 'plasma',
    starterCoinsBonus: 1500,
    starterStrengthBonus: 60,
    badgeColor: '#A855F7',
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  bgmVolume: 0.42,
  sfxVolume: 0.85,
  bgmEnabled: true,
  muted: false,
  graphicsQuality: 'high',
  dofEnabled: true,
  showFloatingNumbers: true,
  shakeIntensity: 1.0,
  keybinds: {
    punch: 'Space',
    altPunch: 'KeyF',
    overdrive: 'KeyQ',
    switchTarget: 'KeyT',
    autoPunch: 'KeyR',
    toggleDock: 'KeyH',
    pause: 'KeyP',
  },
};

export function formatKeyCode(code: string): string {
  if (code === 'Space') return 'SPACE';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  return code.toUpperCase();
}

export const DEFAULT_PROGRESSION: PlayerProgression = {
  displayName: 'Breaker',
  coins: 0,
  strength: 5,
  wallsBroken: 0,
  highestStage: 1,
  highestBossStageCleared: 0,
  rebirths: 0,
  goldenKnuckles: 0,
  totalPunches: 0,
  weakSpotsHit: 0,
  bossesDefeated: 0,
  bestCombo: 0,
  overdrivesUsed: 0,
  upgrades: {
    power: 0,
    speed: 0,
    crit: 0,
    wealth: 0,
    splash: 0,
    combo: 0,
  },
  prestigeUpgrades: {
    titan: 0,
    midas: 0,
    idle: 0,
    overdrive: 0,
    shockwave: 0,
    weakspot: 0,
    bagmaster: 0,
    starter: 0,
    chaincrit: 0,
    combomaster: 0,
  },
  unlockedGloves: ['wraps'],
  equippedGlove: 'wraps',
  equippedGloveColor: 'default',
  skinTone: 'tan',
  unlockedBags: ['leather'],
  equippedBag: 'leather',
  equippedBagColor: 'default',
  claimedAchievements: [],
  ownedPremiumItems: [],
  lastActiveAt: Date.now(),
};
