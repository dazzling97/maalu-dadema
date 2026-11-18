import Phaser from 'phaser';
import { applyStage, STAGES } from '../config/balance';
import { audio } from '../systems/Audio';
import { freshGear, copyGear, GearState } from '../systems/Gear';

// Scene hand-offs live here so every screen switches the same way. A stage
// always starts by rebuilding the world scene, which is what guarantees no
// timers, enemies, projectiles or listeners survive from the stage before.

export interface Totals { fish: number; stolen: number; stunned: number; left: number; done: number; }

function begin(from: Phaser.Scene, stage: number, gear: GearState) {
  // `gear` is what the player owns as this stage starts. A copy is kept so a retry starts from the same point:
  // nothing sold or bought during a failed attempt carries over.
  from.registry.set('gearStart', copyGear(gear));
  from.registry.set('gear', copyGear(gear));
  from.registry.set('attract', false);
  from.registry.set('stage', stage);
  applyStage(stage);
  audio.unlock(); audio.setPaused(false); audio.intensity = 0; audio.startMusic();
  audio.play('stageStart');
  ['menu', 'pause', 'result', 'shop', 'hud', 'touch'].forEach((k) => from.scene.stop(k));
  from.scene.get('world').scene.restart();
  from.scene.run('hud');
  from.scene.run('touch'); // on-screen controls; they stay hidden unless touch mode is on
}
/** New game: always from Stage 1 with clean totals. */
export function startRun(from: Phaser.Scene) {
  const totals: Totals = { fish: 0, stolen: 0, stunned: 0, left: 0, done: 0 };
  from.registry.set('totals', totals);
  from.registry.set('tipsSeen', []); // contextual tips show once per game, never again on a retry
  const dev = Number(new URLSearchParams(window.location.search).get('stage')); // test hook: ?stage=3
  begin(from, dev >= 1 && dev <= STAGES.length ? dev - 1 : 0, freshGear()); // a new game starts with the rod and no coins
}
export function nextStage(from: Phaser.Scene) { begin(from, (from.registry.get('stage') as number) + 1, from.registry.get('gear') as GearState); }
/** Replays only the stage that was failed (or paused). Earlier stages stay completed. */
export function retryStage(from: Phaser.Scene) { begin(from, (from.registry.get('stage') as number) ?? 0, (from.registry.get('gearStart') as GearState) ?? freshGear()); }
export function goMenu(from: Phaser.Scene) {
  from.registry.set('attract', true);
  applyStage(0);
  audio.setPaused(false); audio.intensity = 0;
  ['pause', 'result', 'shop', 'hud', 'touch'].forEach((k) => from.scene.stop(k));
  from.scene.get('world').scene.restart();
  from.scene.run('menu');
}
