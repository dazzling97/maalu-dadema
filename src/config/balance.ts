// All tunable gameplay numbers live here. Later phases (fishing, crocodiles,
// Sabapathi) read from these tables instead of hardcoding behaviour.

export const PLAYER = {
  speed: 64, // px / s
  accel: 620,
  friction: 780,
  dashSpeed: 210,
  dashTime: 0.16,
  dashCooldown: 0.7,
  hearts: 3,
  invuln: 1.4, // seconds of safety after a bite
  knockback: 150,
};

export interface CharacterDef {
  id: string;
  name: string;
  blurb: string;
  speedMul: number;
  luckMul: number;
}

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'podipasiya', name: 'Podipasiya', blurb: 'Quick feet, big grin.', speedMul: 1, luckMul: 1 },
  { id: 'lekam', name: 'Lekam Thuma', blurb: 'Luckier line, slower stride.', speedMul: 0.9, luckMul: 1.2 },
];

// Endless-mode difficulty tiers (Phase 5 wires these in). Values are caps for
// the tier starting at `fromSec`; systems interpolate between tiers.
export interface DifficultyTier {
  fromSec: number;
  label: string;
  crocInterval: number; // seconds between crocodile spawns
  crocSpeed: number;
  crocMax: number; // most crocodiles out at once
  thiefInterval: number; // seconds between Sabapathi attempts
  thiefSpeed: number;
  fishSpeedMul: number;
  scoreMul: number;
}

export const DIFFICULTY: DifficultyTier[] = [
  { fromSec: 0, label: 'Calm', crocInterval: 40, crocSpeed: 38, crocMax: 1, thiefInterval: 55, thiefSpeed: 42, fishSpeedMul: 1, scoreMul: 1 },
  { fromSec: 120, label: 'Lively', crocInterval: 26, crocSpeed: 46, crocMax: 2, thiefInterval: 40, thiefSpeed: 50, fishSpeedMul: 1.2, scoreMul: 1.25 },
  { fromSec: 240, label: 'Hectic', crocInterval: 18, crocSpeed: 54, crocMax: 2, thiefInterval: 30, thiefSpeed: 58, fishSpeedMul: 1.4, scoreMul: 1.6 },
  { fromSec: 360, label: 'Chaos', crocInterval: 13, crocSpeed: 60, crocMax: 3, thiefInterval: 24, thiefSpeed: 64, fishSpeedMul: 1.55, scoreMul: 2 },
];

// ---------------------------------------------------------------- fishing (Phase 2)
export const FISHING = {
  castTime: 0.38,
  reach: 115, // how far from your feet the cursor can place a cast
  windowMul: 1.6, // global forgiveness on every species' reaction window
  fishSnap: 18, // cast this close to a visible fish and it bites almost at once
  waitMin: 1.0,
  waitMax: 2.6,
  reelTime: 0.45,
};

export interface FishDef {
  id: string;
  name: string;
  points: number;
  weight: number; // relative odds
  window: number; // seconds you have to react to the bite
  rare: boolean;
  colors: [string, string, string]; // back, belly, fin
}

export const FISH: FishDef[] = [
  { id: 'thilapiya', name: 'THILAPIYA', points: 10, weight: 46, window: 0.75, rare: false, colors: ['#7f8c9a', '#d9e1e6', '#5d6b78'] },
  { id: 'petiya', name: 'PETIYA', points: 15, weight: 26, window: 0.68, rare: false, colors: ['#c9a23a', '#f6e39a', '#e8433f'] },
  { id: 'lula', name: 'LULA', points: 30, weight: 16, window: 0.58, rare: false, colors: ['#5a6b3a', '#c9cf8a', '#3c4a28'] },
  { id: 'walaya', name: 'WALAYA', points: 50, weight: 9, window: 0.5, rare: true, colors: ['#4a4658', '#b9b4c9', '#2f2c3a'] },
  { id: 'ranmaalu', name: 'RAN MAALU', points: 120, weight: 3, window: 0.42, rare: true, colors: ['#f2a63a', '#fff0a8', '#e8662e'] },
];

export const FISH_SIZES = [
  { label: '', mul: 1, odds: 0.6 },
  { label: 'BIG ', mul: 1.5, odds: 0.3 },
  { label: 'HUGE ', mul: 2, odds: 0.1 },
];

// ---------------------------------------------------------------- crocodiles + stones (Phase 3)
export function tierAt(sec: number): DifficultyTier {
  let t = DIFFICULTY[0];
  for (const d of DIFFICULTY) if (sec >= d.fromSec) t = d;
  return t;
}

export const CROC = {
  firstSpawn: 14, // seconds of peace at the start
  surfaceTime: 1.1, // eyes-only warning before it starts hunting
  strikeRange: 36,
  leash: 230, // gives up if you get this far away
  giveUp: 11, // ...or after this many seconds of chasing
  telegraph: 0.7,
  lungeSpeed: 175,
  lungeTime: 0.32,
  recover: 0.8,
  stun: 1.8,
  biteRadius: 11,
};

export const STONE = {
  speed: 210,
  range: 150,
  cooldown: 0.35,
  hitRadius: 11,
  bonkScore: 25,
  startAmmo: 3,
  maxAmmo: 6,
  perPile: 2,
  pileRespawn: 14, // seconds until a collected pile comes back
};

// ---------------------------------------------------------------- Sabapathi (Phase 4)
export const THIEF = {
  firstAttempt: 45, // seconds before his first raid
  sneakRadius: 115, // starts tiptoeing this far from the bucket
  stealTime: 0.9,
  takeFrac: 0.4, // takes 1 + this share of the bucket...
  maxTake: 5, // ...up to this many
  fleeMul: 1.2, // run speed relative to his tier walk speed
  stun: 1.6,
  dropExpire: 25, // seconds dropped fish stay on the ground
};

// ================================================================ Gameplay overhaul: risk and reward
// Everything below is tuning. Systems read these tables; nothing here is duplicated elsewhere.

export type ZoneId = 'A' | 'B' | 'C';
export interface ZoneDef {
  id: ZoneId;
  name: string;
  title: string; // as written in notifications
  hint: string;
  valueMul: number; // fish value multiplier
  windowMul: number; // reaction window multiplier (lower = harder)
  rareBoost: number; // multiplies the odds of rare species
  comboCap: number; // highest combo multiplier this zone can pay
  danger: number; // threat added while you fish here
  popMax: number; // fish population
  regen: number; // fish per second regained while nobody fishes here
}
export const ZONES: Record<ZoneId, ZoneDef> = {
  A: { id: 'A', title: 'Dock Shallows', name: 'DOCK SHALLOWS', hint: 'SAFE WATER, SMALL FISH', valueMul: 1, windowMul: 1, rareBoost: 0.5, comboCap: 1.2, danger: 0, popMax: 8, regen: 0.16 },
  B: { id: 'B', title: 'River Bend', name: 'RIVER BEND', hint: 'BETTER FISH, QUICKER BITES', valueMul: 1.8, windowMul: 0.82, rareBoost: 1.6, comboCap: 1.5, danger: 0.12, popMax: 7, regen: 0.13 },
  C: { id: 'C', title: 'Deep Swamp', name: 'DEEP SWAMP', hint: 'RARE FISH, HUNGRY CROCODILES', valueMul: 3, windowMul: 0.68, rareBoost: 3.2, comboCap: 2, danger: 0.28, popMax: 6, regen: 0.1 },
};

export const DEPLETION = {
  waitPenalty: 1.4, // an empty spot makes bites take up to (1 + this) times longer
  thinRatio: 0.5, // below this share of the population, warn the player
};

/** [consecutive catches, multiplier] */
export const COMBO: [number, number][] = [[2, 1.2], [4, 1.5], [6, 2]];

export const BANK = { radius: 26, bonkBonus: 10 };
export const SPILL = { onBite: 2 }; // fish knocked out of the bucket by a bite (they can be picked up again)

export const THREAT = {
  baseMax: 0.5, // most threat that elapsed time alone can produce
  baseRampSec: 300,
  carriedWeight: 0.25,
  carriedFull: 350, // carried value that maxes the carried term
  comboWeight: 0.02, // per combo step
  reliefAfterHit: 12, // seconds of reduced pressure after taking damage
  reliefFactor: 0.45,
  graceAfterEncounter: 9, // seconds with no new crocodile after one leaves or is stunned
  firstSpawn: 16,
  spawnIntervalCalm: 32,
  spawnIntervalPeak: 9,
  speedCalm: 36,
  speedPeak: 58,
  maxCrocs: 3,
  labels: [[0, 'CALM'], [0.25, 'LIVELY'], [0.5, 'HECTIC'], [0.75, 'CHAOS']] as [number, string][],
};

export const CROC_AI = {
  detect: 95, // notices you from this far...
  shoreBand: 46, // ...only while you stand this close to the water
  patrolSpeed: 0.6,
  patrolTime: 22,
  repositionTime: 2.6, // backs off after every lunge so it can never chain attacks
};
export interface CrocType { speedMul: number; lungeMul: number; recover: number; stun: number; sheet: string; }
export const CROC_TYPES: Record<'lurker' | 'sprinter' | 'brute', CrocType> = {
  lurker: { speedMul: 1, lungeMul: 1, recover: 0.8, stun: 1.8, sheet: 'croc' },
  sprinter: { speedMul: 1.3, lungeMul: 0.8, recover: 1.15, stun: 2, sheet: 'croc' },
  brute: { speedMul: 0.8, lungeMul: 1.25, recover: 0.65, stun: 1.1, sheet: 'crocDark' },
};

export const RIVAL = {
  firstAt: 35,
  checkEvery: 2, // seconds between "shall I?" rolls
  cooldown: 26, // seconds after a raid ends before he considers another
  minValue: 25, // will not bother for less than this in the bucket
  urgeBase: 0.05,
  urgeValue: 0.3, // added at THREAT.carriedFull worth of fish
  urgeFishing: 0.15, // added while your line is in the water
  urgeBusy: 0.2, // added while a crocodile is hunting you
  observeDist: 62, // lurks this far away while the bucket is in your hands
  observeGiveUp: 14,
  grabRadius: 12,
  stealTime: 0.8,
  speedCalm: 44,
  speedPeak: 62,
  sneakMul: 0.55,
  fleeMul: 1.2,
  shrugOffs: 2, // stones he shrugs off (brief stagger) before one sends him home empty-handed
  staggerTime: 0.9,
  rushMul: 1.35, // speed during a Sabapathi Rush event
};

// ---------------------------------------------------------------- timed events
export type EventId = 'golden' | 'frenzy' | 'rush' | 'bonanza';
export const EVENTS = {
  firstAt: 55, // no events in the opening minute
  gapMin: 26, // quiet seconds between events
  gapMax: 42,
  frenzyPace: 0.45, // crocodile interval multiplier during a Crocodile Frenzy
  bonanzaWait: 0.4, // bite wait multiplier in the bonanza zone
  goldenSnap: 24, // cast this close to the golden fish to hook it
  defs: {
    golden: { weight: 3, duration: 14 },
    frenzy: { weight: 2, duration: 16 },
    rush: { weight: 2, duration: 18 },
    bonanza: { weight: 3, duration: 20 },
  } as Record<EventId, { weight: number; duration: number }>,
};

// ================================================================ Timed challenge rules
export const RUN = {
  duration: 300, // seconds (set per stage by applyStage)
  target: 10, // fish that must be in the bag (set per stage)
  hearts: 3,
  startRocks: 2,
  maxRocks: 5,
  carryMax: 3, // fish you can hold before depositing
  finalStretch: 30, // countdown turns urgent
  rockRespawn: 12,
  interactRadius: 20,
  rockPickupRadius: 12, // walk this close to a rock to pocket it
  goldenFish: 3, // fish a golden fish is worth
};

/** Difficulty by time elapsed. Enemy counts are capped per band; nothing scales without limit. */
export interface Band {
  until: number;
  label: string;
  crocMax: number;
  crocInterval: number;
  crocSpeed: number;
  thiefSpeed: number;
  thiefCooldown: number; // seconds between raids
  windowMul: number; // fishing reaction window
}
export const BANDS: Band[] = [
  { until: 60, label: 'Calm', crocMax: 1, crocInterval: 34, crocSpeed: 36, thiefSpeed: 42, thiefCooldown: 40, windowMul: 1 },
  { until: 150, label: 'Lively', crocMax: 2, crocInterval: 26, crocSpeed: 42, thiefSpeed: 50, thiefCooldown: 32, windowMul: 0.92 },
  { until: 240, label: 'Hectic', crocMax: 2, crocInterval: 20, crocSpeed: 50, thiefSpeed: 57, thiefCooldown: 26, windowMul: 0.86 },
  { until: 300, label: 'Final push', crocMax: 3, crocInterval: 15, crocSpeed: 54, thiefSpeed: 62, thiefCooldown: 20, windowMul: 0.82 },
];

/** Seconds the BANDS table is written for. Longer stages stretch the same four bands. */
export const BAND_SPAN = 300;

// ================================================================ The three stages
// Fixed and sequential: the player never chooses or configures a stage.
export interface StageDef {
  name: string;
  label: string;
  target: number; // fish needed in the bag
  duration: number; // seconds
  carryMax: number; // fish the player can hold
  waitMul: number; // time until a bite (lower = fish bite sooner)
  windowMul: number; // reaction window on a bite (lower = needs better timing)
  fishStock: number; // multiplies every zone's fish population and recovery
  crocSpeedMul: number;
  crocIntervalMul: number; // lower = crocodiles arrive more often
  crocMaxAdd: number; // extra simultaneous crocodiles (hard cap of 3 still applies)
  thiefCooldownMul: number; // lower = Sabapathi raids more often
  thiefSpeedMul: number;
  stealTimeMul: number; // lower = less time to stop him at the bag
  rockShare: number; // share of rock spots in play
  rockRespawn: number; // seconds
}
export const STAGES: StageDef[] = [
  { name: 'The Fishing Begins', label: 'Easy', target: 10, duration: 180, carryMax: 5, waitMul: 0.8, windowMul: 1, fishStock: 1, crocSpeedMul: 1, crocIntervalMul: 1, crocMaxAdd: 0, thiefCooldownMul: 1, thiefSpeedMul: 1, stealTimeMul: 1, rockShare: 1, rockRespawn: 12 },
  { name: 'Sabapathi Strikes Back', label: 'Medium', target: 24, duration: 210, carryMax: 5, waitMul: 0.6, windowMul: 0.9, fishStock: 1.6, crocSpeedMul: 1.1, crocIntervalMul: 0.85, crocMaxAdd: 0, thiefCooldownMul: 0.8, thiefSpeedMul: 1.08, stealTimeMul: 1, rockShare: 0.85, rockRespawn: 13 },
  { name: 'The Final Fish Heist', label: 'Hard', target: 34, duration: 240, carryMax: 5, waitMul: 0.35, windowMul: 0.8, fishStock: 3.4, crocSpeedMul: 1.25, crocIntervalMul: 0.84, crocMaxAdd: 1, thiefCooldownMul: 0.75, thiefSpeedMul: 1.2, stealTimeMul: 0.75, rockShare: 0.75, rockRespawn: 14 },
];
/** The stage being played. Systems read their multipliers from here. */
export const CUR: StageDef & { index: number } = { index: 0, ...STAGES[0] };
/** Load a stage's rules. Called once, before the world is rebuilt for that stage. */
export function applyStage(index: number) {
  const i = Math.max(0, Math.min(STAGES.length - 1, index));
  Object.assign(CUR, STAGES[i], { index: i });
  RUN.target = CUR.target; RUN.duration = CUR.duration; RUN.carryMax = CUR.carryMax; RUN.rockRespawn = CUR.rockRespawn;
}

export const BAG_RAID = {
  firstAt: 40, // he leaves you alone for the opening
  checkEvery: 2,
  minStored: 3, // will not bother for fewer fish than this
  urgeBase: 0.12,
  urgeAway: 0.25, // added when you are far from the bag
  awayDist: 150,
  urgeFishing: 0.15,
  urgeFull: 0.2, // added as the bag approaches the target
  sneakRadius: 110,
  sneakMul: 0.6,
  stealTime: 1.0,
  takeFrac: 0.25, // takes 1 + this share of the bag...
  maxTake: 4, // ...up to this many
  fleeMul: 1.15,
  stun: 1.6,
};

// ================================================================ Fishing equipment and Fish Coins
export type GearId = 'rod' | 'net' | 'advnet';
export interface GearDef {
  id: GearId;
  name: string;
  desc: string;
  catch: number; // most fish landed by one successful catch
  cost: number; // Fish Coins
  stage: number; // index of the stage that unlocks it
  waitMul: number; // time until a bite (nets take longer to fill)
  windowMul: number; // reaction window (lower = harder)
  reelTime: number; // seconds to haul it in
  frame: number; // icon frame
}
export const GEAR: Record<GearId, GearDef> = {
  rod: { id: 'rod', name: 'Fishing Rod', desc: 'One fish per catch. Quick and easy.', catch: 1, cost: 0, stage: 0, waitMul: 1, windowMul: 1, reelTime: 0.45, frame: 0 },
  net: { id: 'net', name: 'Fishing Net', desc: 'Up to 3 fish per catch. A little slower.', catch: 3, cost: 5, stage: 1, waitMul: 1.15, windowMul: 0.9, reelTime: 0.7, frame: 1 },
  advnet: { id: 'advnet', name: 'Advanced Net', desc: 'Up to 5 fish per catch. Needs sharp timing.', catch: 5, cost: 12, stage: 2, waitMul: 1.15, windowMul: 0.7, reelTime: 0.8, frame: 2 },
};
export const GEAR_ORDER: GearId[] = ['rod', 'net', 'advnet'];
export const COIN_PER_FISH = 1;
export const SHOP_OPENS_STAGE = 1; // index: the gear stall opens in Stage 2
