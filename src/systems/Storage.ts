// Settings and high scores in localStorage. Every access is guarded: some
// embeds (sandboxed iframes, private windows) throw on storage.
/** One finished attempt. `stages` = stages completed (0-3); `fish` = fish in the bag of the stage it ended on; `left` = total seconds to spare on a full win. */
export interface ScoreEntry { name: string; stages: number; won: boolean; fish: number; left: number; }
export interface Save {
  charId: string;
  name: string;
  shake: boolean;
  hints: boolean;
  master: number; // volumes, 0..1
  music: number;
  sfx: number;
  muted: boolean;
  tutorial: boolean; // legacy flag from the old hint bar
  howSeen: boolean; // the How to Play guide has been shown once (it opens on the first Play)
  tutorials: string[]; // ids of first-time tutorials already completed or skipped
  eased: string[]; // first encounters that have already been made gentler once
  scores: ScoreEntry[];
  touch: 'auto' | 'on' | 'off'; // on-screen controls: auto = on phones and tablets
}

const KEY = 'maalu-horu-v3'; // the save slot from the game's first name: kept so nobody loses their settings and best runs
const DEFAULT: Save = { charId: 'podipasiya', name: '', shake: true, hints: true, master: 0.8, music: 0.6, sfx: 0.9, muted: false, tutorial: false, howSeen: false, tutorials: [], eased: [], scores: [], touch: 'auto' };
let cache: Save | null = null;

export function load(): Save {
  if (cache) return cache;
  let data: Partial<Save> = {};
  try { data = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>; } catch { /* storage unavailable */ }
  cache = { ...DEFAULT, ...data, scores: Array.isArray(data.scores) ? data.scores : [], tutorials: Array.isArray(data.tutorials) ? data.tutorials : [], eased: Array.isArray(data.eased) ? data.eased : [] };
  return cache;
}
export function save(patch: Partial<Save>): Save {
  cache = { ...load(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* keep it in memory for this session */ }
  return cache;
}
const better = (a: ScoreEntry, b: ScoreEntry) => (b.stages - a.stages) || (b.won ? b.left - a.left : b.fish - a.fish);
/** Records a finished attempt. Ranked by stages completed, then time to spare (wins) or fish (losses). True if it is the new best. */
export function submitScore(e: ScoreEntry): boolean {
  const s = load();
  const scores = [...s.scores, e].sort(better).slice(0, 5);
  save({ scores });
  return scores[0] === e && (e.stages > 0 || e.fish > 0);
}
export function bestLine(): string {
  const b = load().scores[0];
  if (!b) return 'No runs yet';
  return b.won ? `Best: all three stages, ${fmtTime(b.left)} to spare` : `Best: reached stage ${Math.min(3, b.stages + 1)} with ${b.fish} fish`;
}
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
