import { load, save } from './Storage';

// One audio service for the whole game. Every sound effect and the music are
// synthesised with the Web Audio API; the only recordings are the optional
// Sinhala voice lines (Voice.ts), which play here on their own channel.
//
// Browsers keep audio suspended until the player clicks or presses a key, so
// the context is created (or resumed) on the first such gesture and `available`
// only reports true while sound can really be heard.

export type Sfx =
  | 'uiMove' | 'uiSelect'
  | 'cast' | 'splash' | 'bite' | 'catch' | 'miss' | 'deposit'
  | 'prowl' | 'sneak' | 'stolen' | 'step' | 'bonk' | 'recover' | 'lost'
  | 'crocEmerge' | 'crocWarn' | 'crocLunge' | 'hurt' | 'stun'
  | 'pickup' | 'throw' | 'thud' | 'deny'
  | 'shopOpen' | 'sell' | 'buy' | 'equip' | 'netCast' | 'catchMulti'
  | 'stageStart' | 'stage1' | 'stage2' | 'victory' | 'fail' | 'tick' | 'event';

type Priority = 'high' | 'medium' | 'low';
interface Def { vol: number; pri: Priority; cooldown: number; duck?: number; }
/** Mix: volume per sound, priority, and the shortest gap allowed between repeats (seconds). */
export const MIX: Record<Sfx, Def> = {
  uiMove: { vol: 0.25, pri: 'low', cooldown: 0.04 }, uiSelect: { vol: 0.4, pri: 'low', cooldown: 0.05 },
  cast: { vol: 0.45, pri: 'medium', cooldown: 0.1 }, splash: { vol: 0.45, pri: 'medium', cooldown: 0.08 },
  bite: { vol: 0.7, pri: 'medium', cooldown: 0.2 }, catch: { vol: 0.7, pri: 'medium', cooldown: 0.2 },
  miss: { vol: 0.4, pri: 'medium', cooldown: 0.3 }, deposit: { vol: 0.55, pri: 'medium', cooldown: 0.05 },
  prowl: { vol: 0.9, pri: 'high', cooldown: 3, duck: 1.6 }, sneak: { vol: 0.6, pri: 'high', cooldown: 2 },
  stolen: { vol: 0.95, pri: 'high', cooldown: 1, duck: 1.2 }, step: { vol: 0.14, pri: 'low', cooldown: 0.13 },
  bonk: { vol: 0.8, pri: 'medium', cooldown: 0.15 }, recover: { vol: 0.6, pri: 'medium', cooldown: 0.08 },
  lost: { vol: 0.6, pri: 'medium', cooldown: 1 },
  crocEmerge: { vol: 0.5, pri: 'medium', cooldown: 0.5 }, crocWarn: { vol: 0.9, pri: 'high', cooldown: 0.4, duck: 0.8 },
  crocLunge: { vol: 0.6, pri: 'medium', cooldown: 0.2 }, hurt: { vol: 0.85, pri: 'high', cooldown: 0.3 }, stun: { vol: 0.6, pri: 'medium', cooldown: 0.15 },
  pickup: { vol: 0.3, pri: 'low', cooldown: 0.08 }, throw: { vol: 0.35, pri: 'low', cooldown: 0.1 },
  thud: { vol: 0.35, pri: 'low', cooldown: 0.08 }, deny: { vol: 0.4, pri: 'low', cooldown: 0.4 },
  shopOpen: { vol: 0.5, pri: 'medium', cooldown: 0.3 }, sell: { vol: 0.5, pri: 'medium', cooldown: 0.05 }, buy: { vol: 0.8, pri: 'medium', cooldown: 0.3 },
  equip: { vol: 0.45, pri: 'medium', cooldown: 0.1 }, netCast: { vol: 0.5, pri: 'medium', cooldown: 0.1 }, catchMulti: { vol: 0.8, pri: 'medium', cooldown: 0.2 },
  stageStart: { vol: 0.6, pri: 'medium', cooldown: 1 }, stage1: { vol: 0.9, pri: 'high', cooldown: 2, duck: 2.2 },
  stage2: { vol: 0.9, pri: 'high', cooldown: 2, duck: 2.6 }, victory: { vol: 1, pri: 'high', cooldown: 3, duck: 4.5 },
  fail: { vol: 0.7, pri: 'high', cooldown: 2, duck: 2 }, tick: { vol: 0.3, pri: 'low', cooldown: 0.5 }, event: { vol: 0.6, pri: 'medium', cooldown: 1 },
};

/** Pure gate used by play(): is this sound allowed right now? (Exported for tests.) */
export function allowed(last: number | undefined, now: number, cooldown: number, active: number, pri: Priority): boolean {
  if (last !== undefined && now - last < cooldown) return false; // repeats too soon would just be noise
  const cap = pri === 'high' ? 99 : pri === 'medium' ? 10 : 6; // busy moments drop the least important sounds first
  return active < cap;
}

const N = (semi: number) => 440 * Math.pow(2, semi / 12); // semitones from A4

class AudioService {
  private ctx?: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicDuck!: GainNode;
  private sfxBus!: GainNode;
  private voiceBus!: GainNode;
  private unlockHooks: (() => void)[] = [];
  private last = new Map<Sfx, number>();
  private active = 0;
  private noiseBuf?: AudioBuffer;
  private timer?: number;
  private step = 0;
  private nextT = 0;
  private wantMusic = false;
  private hiddenPause = false;
  intensity = 0; // 0 calm .. 1 frantic: speeds the music up and thickens the rhythm
  /** Every sound requested, in order (read by automated tests). */
  readonly log: string[] = [];
  supported = typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  /** True only while sound can actually be heard. */
  get available() { return !!this.ctx && this.ctx.state === 'running'; }
  get muted() { return load().muted; }

  /** Call once at start-up: wires the first-gesture unlock and tab visibility. */
  install() {
    if (!this.supported) return;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) { this.hiddenPause = true; void this.ctx.suspend(); }
      else if (this.hiddenPause) { this.hiddenPause = false; void this.ctx.resume(); }
    });
  }
  /** Create or resume the audio context. Only works inside a user gesture, which is when it is called. */
  unlock() {
    if (!this.supported) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
        this.voiceBus = this.ctx.createGain(); this.voiceBus.connect(this.master);
        this.musicBus = this.ctx.createGain(); this.musicDuck = this.ctx.createGain();
        this.musicDuck.connect(this.musicBus); this.musicBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, len);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolumes();
        this.unlockHooks.forEach((f) => { try { f(); } catch { /* a hook must never break sound */ } });
      }
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      if (this.wantMusic) this.startMusic();
    } catch { this.supported = false; }
  }

  // ------------------------------------------------------------------ settings
  applyVolumes() {
    if (!this.ctx) return;
    const s = load(), t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.02);
    this.voiceBus.gain.setTargetAtTime(s.voices ? s.voice : 0, t, 0.02);
  }
  set(patch: { master?: number; music?: number; sfx?: number; voice?: number; voices?: boolean; muted?: boolean }) {
    save(patch);
    this.applyVolumes();
  }

  // ------------------------------------------------------------------ building blocks
  private env(vol: number, t0: number, dur: number, attack = 0.005): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    return g;
  }
  private tone(bus: AudioNode, type: OscillatorType, f0: number, t0: number, dur: number, vol: number, f1?: number, attack?: number) {
    const o = this.ctx!.createOscillator(), g = this.env(vol, t0, dur, attack);
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    o.connect(g); g.connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.02);
    this.active++;
    o.onended = () => { this.active--; };
  }
  private noise(bus: AudioNode, t0: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1?: number, q = 1) {
    const src = this.ctx!.createBufferSource(), f = this.ctx!.createBiquadFilter(), g = this.env(vol, t0, dur);
    src.buffer = this.noiseBuf!; src.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.02);
    this.active++;
    src.onended = () => { this.active--; };
  }
  /** A run of notes: [semitone from A4, start offset, length]. */
  private seq(type: OscillatorType, notes: [number, number, number][], t: number, vol: number) {
    for (const [n, at, len] of notes) this.tone(this.sfxBus, type, N(n), t + at, len, vol);
  }

  // ------------------------------------------------------------------ sound effects
  play(name: Sfx, pitch = 1) {
    this.log.push(name);
    if (!this.available || this.muted) return;
    const def = MIX[name], now = this.ctx!.currentTime;
    if (!allowed(this.last.get(name), now, def.cooldown, this.active, def.pri)) return;
    this.last.set(name, now);
    if (def.duck) this.duck(def.duck);
    const v = def.vol * 0.5, t = now + 0.005, B = this.sfxBus;
    switch (name) {
      case 'uiMove': this.tone(B, 'sine', 620, t, 0.05, v); break;
      case 'uiSelect': this.tone(B, 'triangle', 520, t, 0.06, v); this.tone(B, 'triangle', 780, t + 0.05, 0.09, v); break;
      case 'cast': this.noise(B, t, 0.2, v, 'bandpass', 700, 3200, 2); break;
      case 'splash': this.noise(B, t, 0.26, v, 'lowpass', 1800, 320); this.tone(B, 'sine', 520, t, 0.14, v * 0.5, 180); break;
      case 'bite': this.tone(B, 'triangle', N(12), t, 0.07, v); this.tone(B, 'triangle', N(19), t + 0.08, 0.12, v); break;
      case 'catch': this.seq('triangle', [[3, 0, 0.09], [7, 0.07, 0.09], [10, 0.14, 0.09], [15, 0.21, 0.22]], t, v); break;
      case 'miss': this.tone(B, 'sine', 330, t, 0.28, v, 190); break;
      case 'deposit': this.tone(B, 'triangle', N(7) * pitch, t, 0.07, v); this.tone(B, 'sine', N(19) * pitch, t + 0.05, 0.14, v * 0.7); break;
      // Sabapathi's theme: a sneaky tiptoe figure ending on a cheeky tritone. Heard every time he sets out.
      case 'prowl': this.seq('square', [[-9, 0, 0.11], [-6, 0.16, 0.11], [-9, 0.32, 0.11], [-3, 0.48, 0.11], [-4, 0.64, 0.3]], t, v * 0.5);
        this.seq('triangle', [[-21, 0, 0.14], [-21, 0.32, 0.14], [-16, 0.64, 0.34]], t, v); break;
      case 'sneak': this.seq('triangle', [[-14, 0, 0.1], [-15, 0.14, 0.16]], t, v); break;
      case 'stolen': for (let i = 0; i < 6; i++) this.tone(B, 'square', i % 2 ? 660 : 880, t + i * 0.09, 0.08, v * 0.5); break;
      case 'step': this.noise(B, t, 0.04, v, 'highpass', 1800); break;
      case 'bonk': this.tone(B, 'sine', 190, t, 0.09, v, 560); this.tone(B, 'sine', 560, t + 0.09, 0.22, v, 130); this.noise(B, t, 0.04, v * 0.6, 'highpass', 2500); break;
      case 'recover': this.seq('triangle', [[10, 0, 0.07], [14, 0.06, 0.07], [17, 0.12, 0.16]], t, v); break;
      case 'lost': this.seq('sawtooth', [[-2, 0, 0.16], [-5, 0.16, 0.16], [-9, 0.32, 0.36]], t, v * 0.4); break;
      case 'crocEmerge': this.noise(B, t, 0.5, v, 'lowpass', 300, 900); this.tone(B, 'sine', 70, t, 0.4, v, 130); break;
      case 'crocWarn': this.tone(B, 'sawtooth', 110, t, 0.14, v * 0.6, 150); this.tone(B, 'sawtooth', 140, t + 0.18, 0.2, v * 0.6, 220); break;
      case 'crocLunge': this.noise(B, t, 0.2, v, 'bandpass', 2400, 500, 0.8); this.tone(B, 'sine', 140, t, 0.16, v, 60); break;
      case 'hurt': this.tone(B, 'square', 240, t, 0.22, v * 0.5, 90); this.noise(B, t, 0.1, v * 0.7, 'lowpass', 1400); break;
      case 'stun': this.tone(B, 'sine', 300, t, 0.07, v, 700); this.seq('sine', [[19, 0.08, 0.06], [24, 0.14, 0.06], [19, 0.2, 0.1]], t, v * 0.5); break;
      case 'pickup': this.tone(B, 'triangle', 1100, t, 0.05, v, 1500); break;
      case 'throw': this.noise(B, t, 0.12, v, 'bandpass', 1200, 2800, 3); break;
      case 'thud': this.noise(B, t, 0.08, v, 'lowpass', 700); this.tone(B, 'sine', 130, t, 0.08, v, 70); break;
      case 'deny': this.tone(B, 'square', 170, t, 0.07, v * 0.5); this.tone(B, 'square', 150, t + 0.1, 0.1, v * 0.5); break;
      case 'shopOpen': this.seq('triangle', [[7, 0, 0.07], [12, 0.07, 0.07], [19, 0.14, 0.16]], t, v); break; // a little door bell
      case 'sell': this.tone(B, 'sine', N(19) * pitch, t, 0.05, v); this.tone(B, 'sine', N(26) * pitch, t + 0.05, 0.16, v * 0.8); break; // coin
      case 'buy': this.seq('triangle', [[10, 0, 0.08], [14, 0.08, 0.08], [17, 0.16, 0.08], [22, 0.24, 0.3]], t, v); this.tone(B, 'sine', N(34), t + 0.24, 0.3, v * 0.4); break;
      case 'equip': this.noise(B, t, 0.05, v * 0.6, 'highpass', 3000); this.tone(B, 'triangle', 440, t + 0.03, 0.08, v, 660); break;
      case 'netCast': this.noise(B, t, 0.34, v, 'bandpass', 500, 2400, 1.2); this.noise(B, t + 0.1, 0.2, v * 0.5, 'highpass', 4000); break; // a wide, slower whoosh
      case 'catchMulti': this.seq('triangle', [[3, 0, 0.07], [7, 0.06, 0.07], [10, 0.12, 0.07], [15, 0.18, 0.07], [19, 0.24, 0.07], [22, 0.3, 0.26]], t, v); this.noise(B, t, 0.2, v * 0.4, 'lowpass', 1500, 400); break;
      case 'stageStart': this.seq('triangle', [[-2, 0, 0.1], [3, 0.1, 0.1], [10, 0.2, 0.26]], t, v); break;
      case 'stage1': this.seq('triangle', [[3, 0, 0.12], [7, 0.12, 0.12], [10, 0.24, 0.12], [15, 0.36, 0.5]], t, v); this.seq('square', [[-9, 0.36, 0.5]], t, v * 0.25); break;
      case 'stage2': this.seq('triangle', [[3, 0, 0.1], [7, 0.1, 0.1], [10, 0.2, 0.1], [15, 0.3, 0.1], [19, 0.4, 0.1], [22, 0.5, 0.6]], t, v); this.seq('square', [[-9, 0.3, 0.2], [-2, 0.5, 0.6]], t, v * 0.25); break;
      case 'victory': this.seq('triangle', [[3, 0, 0.14], [3, 0.16, 0.08], [3, 0.26, 0.08], [7, 0.36, 0.2], [10, 0.6, 0.2], [15, 0.84, 0.2], [14, 1.08, 0.14], [15, 1.24, 0.9]], t, v);
        this.seq('square', [[-9, 0, 0.3], [-9, 0.36, 0.2], [-5, 0.6, 0.2], [-2, 0.84, 0.36], [-9, 1.24, 0.9]], t, v * 0.25);
        this.seq('sine', [[22, 1.5, 0.08], [27, 1.6, 0.08], [22, 1.7, 0.08], [27, 1.8, 0.3]], t, v * 0.5); break;
      case 'fail': this.seq('triangle', [[-2, 0, 0.2], [-4, 0.2, 0.2], [-7, 0.4, 0.2], [-14, 0.6, 0.5]], t, v); break;
      case 'tick': this.tone(B, 'sine', 980, t, 0.04, v); break;
      case 'event': this.seq('triangle', [[10, 0, 0.08], [15, 0.09, 0.08], [10, 0.18, 0.08], [15, 0.27, 0.2]], t, v); break;
    }
  }
  // ------------------------------------------------------------------ voice lines
  /** The audio context once sound has been unlocked (voice clips are decoded with it). */
  get context(): AudioContext | undefined { return this.ctx; }
  /** Run `f` as soon as sound is unlocked (at once if it already is). */
  onUnlock(f: () => void) { if (this.ctx) f(); else this.unlockHooks.push(f); }
  /**
   * Play a decoded voice clip on the voice channel, with the music dipped under it.
   * Returns a function that stops it early (a warning cutting off casual chatter).
   */
  playVoice(buf: AudioBuffer, onEnd: () => void): (() => void) | null {
    if (!this.available || this.muted || !load().voices) return null;
    const src = this.ctx!.createBufferSource(), g = this.ctx!.createGain(), t = this.ctx!.currentTime;
    src.buffer = buf; src.connect(g); g.connect(this.voiceBus);
    g.gain.setValueAtTime(1, t);
    src.onended = () => onEnd();
    src.start(t);
    this.duck(buf.duration + 0.2, 0.55);
    let stopped = false;
    return () => { if (stopped) return; stopped = true; g.gain.setTargetAtTime(0.0001, this.ctx!.currentTime, 0.03); try { src.stop(this.ctx!.currentTime + 0.12); } catch { /* already ended */ } };
  }

  /** Drop the music under an important sound, then bring it back. */
  private duck(seconds: number, level = 0.25) {
    if (!this.ctx) return;
    const g = this.musicDuck.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(level, t, 0.03);
    g.setTargetAtTime(this.paused ? 0.35 : 1, t + seconds, 0.25);
  }
  private paused = false;
  /** Pause menu: the music steps back but keeps time. */
  setPaused(p: boolean) {
    this.paused = p;
    if (this.ctx) this.musicDuck.gain.setTargetAtTime(p ? 0.35 : 1, this.ctx.currentTime, 0.1);
  }

  // ------------------------------------------------------------------ music
  // An original baila-flavoured loop in 6/8: bass on the two big beats, a
  // plucked pentatonic tune over it, shaker and hand-drum underneath.
  // Each bar is 6 steps; the tune is 8 bars and loops seamlessly.
  private static BASS = [-19, -19, -14, -14, -17, -17, -12, -14]; // one root per bar
  private static TUNE: (number | null)[][] = [
    [5, null, 7, 10, null, 7], [5, null, 3, 5, null, null], [10, null, 12, 15, null, 12], [10, null, 7, 10, null, null],
    [7, null, 10, 12, null, 10], [7, null, 5, 7, null, 3], [12, null, 10, 7, null, 5], [3, null, 5, 7, null, null],
  ];
  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || this.timer !== undefined) return;
    this.step = 0; this.nextT = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }
  stopMusic() {
    this.wantMusic = false;
    if (this.timer !== undefined) { window.clearInterval(this.timer); this.timer = undefined; }
  }
  private schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.05; // after a tab switch: pick up from now
    const M = this.musicDuck;
    while (this.nextT < this.ctx.currentTime + 0.3) {
      const stepLen = 0.21 - this.intensity * 0.05; // faster when things heat up
      const bar = Math.floor(this.step / 6) % 8, s = this.step % 6, t = this.nextT;
      const root = AudioService.BASS[bar];
      if (s === 0) this.tone(M, 'triangle', N(root), t, stepLen * 2.6, 0.5);
      if (s === 3) this.tone(M, 'triangle', N(root + 7), t, stepLen * 2.2, 0.38);
      if (this.intensity > 0.5 && (s === 2 || s === 5)) this.tone(M, 'triangle', N(root + 12), t, stepLen, 0.22);
      const n = AudioService.TUNE[bar][s];
      if (n !== null) { this.tone(M, 'square', N(n), t, stepLen * 1.5, 0.1); this.tone(M, 'triangle', N(n + 12), t, stepLen * 1.2, 0.07); }
      // percussion: x . x x . x  (the baila lilt), busier under pressure
      if (s !== 1 && s !== 4) this.noise(M, t, 0.035, 0.11, 'highpass', 5200);
      else if (this.intensity > 0.5) this.noise(M, t, 0.025, 0.07, 'highpass', 7000);
      if (s === 0 || s === 3) this.tone(M, 'sine', 150, t, 0.09, 0.3, 70);
      if (s === 2 || s === 5) this.tone(M, 'sine', 240, t, 0.06, 0.14, 160);
      this.nextT += stepLen;
      this.step++;
    }
  }
}

export const audio = new AudioService();
