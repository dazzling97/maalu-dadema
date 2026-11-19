// Sinhala voice lines: short recorded reactions from the fisherman and Sabapathi.
//
// Lines and their subtitles live in src/config/voices.json. Recordings live in
// public/voice/<speaker>/<event>/<NN>.<mp3|ogg|m4a|wav>; voice/index.json (written
// by the build, served live in dev) lists the files that actually exist, so only
// real recordings are ever requested and a missing one is simply skipped.
//
// Rules, so the voices help rather than chatter:
// - one speaker at a time; a warning cuts off casual talk, anything else waits its turn
//   by not speaking at all (a late line is worse than none);
// - every event has its own cooldown, casual events speak only some of the time,
//   and casual talk keeps a quiet gap after any line;
// - the same variation is never picked twice in a row.
import manifest from '../config/voices.json';
import { audio } from './Audio';
import { load } from './Storage';

export type VoiceEvent = keyof typeof manifest.events;
export type SpeakerId = keyof typeof manifest.speakers;
interface EventDef { speaker: string; priority: number; cooldown: number; chance: number; when: string; lines: { si: string; en: string }[]; }
const EVENTS = manifest.events as Record<VoiceEvent, EventDef>;

/** What the subtitle needs to show. */
export interface SpokenLine { event: VoiceEvent; speaker: SpeakerId; name: string; si: string; en: string; ms: number; priority: number; }

/** Seconds of quiet after a line before casual (1) or important (2) talk may follow. Warnings (3) never wait. */
const GAP: Record<number, number> = { 1: 3, 2: 0.6, 3: 0 };
/** Order in which file formats are tried, best first, if the browser can play them. */
const FORMATS: [string, string][] = [['ogg', 'audio/ogg; codecs="opus"'], ['ogg', 'audio/ogg; codecs="vorbis"'], ['m4a', 'audio/mp4; codecs="mp4a.40.2"'], ['mp3', 'audio/mpeg'], ['wav', 'audio/wav']];

/** Pure gate (exported for tests): may this event speak now? */
export function mayPlay(o: { now: number; last?: number; cooldown: number; priority: number; busyPriority: number | null; quietUntil: number }): boolean {
  if (o.last !== undefined && o.now - o.last < o.cooldown) return false;
  if (o.busyPriority !== null) return o.priority === 3 && o.busyPriority < 3; // only a warning may cut in, and never over another warning
  return o.priority === 3 || o.now >= o.quietUntil;
}
/** Pure pick (exported for tests): a random variation from those available, never the one just used if there is a choice. */
export function pickVariant(available: number[], last: number | undefined, rnd = Math.random()): number | null {
  if (!available.length) return null;
  const pool = available.length > 1 && last !== undefined ? available.filter((i) => i !== last) : available;
  return pool[Math.floor(rnd * pool.length) % pool.length];
}

class VoiceService {
  /** True during play (stages and the ending); the title-screen backdrop stays silent. */
  live = false;
  /** `?voices=preview` shows every line's subtitle even where no recording exists yet. */
  readonly preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('voices') === 'preview';
  private index: Record<string, string[]> = {};
  private indexLoaded = false;
  private buffers = new Map<string, AudioBuffer | 'loading' | 'failed'>();
  private last = new Map<VoiceEvent, number>();
  private lastVariant = new Map<VoiceEvent, number>();
  private current: { priority: number; stop: () => void; until: number } | null = null;
  private lineEnd = -99;
  private listeners = new Set<(l: SpokenLine) => void>();
  private base = 'voice/';

  /** Load the list of recordings once sound is unlocked, then decode the current cast's clips. */
  install(base = 'voice/') {
    this.base = base;
    audio.onUnlock(() => { void this.loadIndex(); });
  }
  private async loadIndex() {
    if (this.indexLoaded) return;
    this.indexLoaded = true;
    try {
      const r = await fetch(`${this.base}index.json`, { cache: 'no-cache' });
      if (r.ok) this.index = (await r.json()) as Record<string, string[]>;
    } catch { /* no recordings available (opened from a file, offline): voices stay quiet */ }
    this.preload();
  }
  /** Decode everything the current fisherman and Sabapathi can say, so lines play without delay. */
  preload() {
    const who = [this.playerFolder(), 'sabapathi'];
    for (const key of Object.keys(this.index)) if (who.some((w) => key.startsWith(`${w}/`))) void this.decode(key);
  }
  private playerFolder() { const id = load().charId; return id in manifest.speakers ? id : 'podipasiya'; }
  private async decode(key: string): Promise<void> {
    const ctx = audio.context;
    if (!ctx || this.buffers.has(key)) return;
    this.buffers.set(key, 'loading');
    const can = (mime: string) => { try { return document.createElement('audio').canPlayType(mime) !== ''; } catch { return false; } };
    const files = [...(this.index[key] ?? [])].sort((a, b) => rank(a) - rank(b));
    function rank(f: string) { const ext = f.split('.').pop()!; const i = FORMATS.findIndex(([e, mime]) => e === ext && can(mime)); return i < 0 ? 99 : i; }
    for (const f of files) {
      try {
        const r = await fetch(`${this.base}${f}`);
        if (!r.ok) continue;
        const buf = await ctx.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(key, buf);
        return;
      } catch { /* this format would not decode here: try the next one */ }
    }
    this.buffers.set(key, 'failed');
  }

  /** Subtitles listen here. Returns an unsubscribe function. */
  onLine(f: (l: SpokenLine) => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }

  /** Stop whoever is speaking (a stage ending, quitting to the menu). */
  hush() { this.current?.stop(); this.current = null; }

  /**
   * React to a game event. Fire and forget: it never blocks or changes gameplay,
   * and returns whether a line was actually spoken.
   */
  say(event: VoiceEvent): boolean {
    const def = EVENTS[event];
    if (!def || !this.live) return false;
    const s = load();
    if (!s.voices || s.muted) return false;
    const now = performance.now() / 1000;
    const busy = this.current && now < this.current.until ? this.current : null;
    if (!mayPlay({ now, last: this.last.get(event), cooldown: def.cooldown, priority: def.priority, busyPriority: busy ? busy.priority : null, quietUntil: this.lineEnd + GAP[def.priority] })) return false;
    if (def.chance < 1 && Math.random() > def.chance) { this.last.set(event, now - def.cooldown * 0.6); return false; } // stay quiet a little while either way
    const speaker = (def.speaker === 'player' ? this.playerFolder() : def.speaker) as SpeakerId;
    const keyOf = (i: number) => `${speaker}/${event}/${String(i + 1).padStart(2, '0')}`;
    const ready = def.lines.map((_l, i) => i).filter((i) => this.buffers.get(keyOf(i)) instanceof AudioBuffer);
    // lines recorded but not decoded yet start loading now; this moment passes in silence
    def.lines.forEach((_l, i) => { if (this.index[keyOf(i)] && !this.buffers.has(keyOf(i))) void this.decode(keyOf(i)); });
    const pool = ready.length ? ready : this.preview ? def.lines.map((_l, i) => i) : [];
    const i = pickVariant(pool, this.lastVariant.get(event));
    if (i === null) return false; // nothing recorded for this event: skip quietly
    const buf = this.buffers.get(keyOf(i));
    let secs = 1.6;
    busy?.stop();
    if (buf instanceof AudioBuffer) {
      const stop = audio.playVoice(buf, () => { if (this.current?.stop === stop) this.current = null; });
      if (!stop) return false;
      secs = buf.duration;
      this.current = { priority: def.priority, stop, until: now + secs };
    } else this.current = { priority: def.priority, stop: () => undefined, until: now + secs }; // preview: subtitle only
    this.last.set(event, now);
    this.lastVariant.set(event, i);
    this.lineEnd = now + secs;
    const line = def.lines[i];
    const name = manifest.speakers[speaker].name;
    this.listeners.forEach((f) => f({ event, speaker, name, si: line.si, en: line.en, ms: Math.round(secs * 1000) + 700, priority: def.priority }));
    return true;
  }
}

export const voice = new VoiceService();
