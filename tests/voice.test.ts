import { describe, it, expect } from 'vitest';
import { mayPlay, pickVariant } from '../src/systems/Voice';
import manifest from '../src/config/voices.json';

describe('voice lines', () => {
  const base = { now: 10, cooldown: 5, quietUntil: 0, busyPriority: null as number | null };
  it('respects each event cooldown', () => {
    expect(mayPlay({ ...base, last: 7, priority: 1 })).toBe(false);
    expect(mayPlay({ ...base, last: 4, priority: 1 })).toBe(true);
  });
  it('lets only a warning cut in, and never over another warning', () => {
    expect(mayPlay({ ...base, priority: 1, busyPriority: 1 })).toBe(false);
    expect(mayPlay({ ...base, priority: 2, busyPriority: 1 })).toBe(false);
    expect(mayPlay({ ...base, priority: 3, busyPriority: 2 })).toBe(true);
    expect(mayPlay({ ...base, priority: 3, busyPriority: 3 })).toBe(false);
  });
  it('keeps chatter quiet for a moment after a line, but not warnings', () => {
    expect(mayPlay({ ...base, priority: 1, quietUntil: 12 })).toBe(false);
    expect(mayPlay({ ...base, priority: 3, quietUntil: 12 })).toBe(true);
  });
  it('picks a variation at random but never the same one twice running', () => {
    for (let r = 0; r < 1; r += 0.1) expect(pickVariant([0, 1, 2], 1, r)).not.toBe(1);
    expect(pickVariant([2], 2, 0.5)).toBe(2); // only one recorded: it may repeat
    expect(pickVariant([], undefined)).toBeNull(); // nothing recorded: skip
  });
  it('gives every line Sinhala text, a valid speaker and priority', () => {
    for (const [id, e] of Object.entries(manifest.events)) {
      expect(e.lines.length, id).toBeGreaterThan(0);
      for (const l of e.lines) expect(/[඀-෿]/.test(l.si), `${id}: ${l.si}`).toBe(true);
      expect(e.speaker === 'player' || e.speaker in manifest.speakers, id).toBe(true);
      expect([1, 2, 3]).toContain(e.priority);
    }
  });
});
