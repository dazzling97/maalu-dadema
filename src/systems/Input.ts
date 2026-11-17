import Phaser from 'phaser';

/** Keyboard intent, decoupled from key codes so touch / gamepad can slot in later. */
export class Input {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  constructor(scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard!.addKeys({
      up: K.W, down: K.S, left: K.A, right: K.D,
      up2: K.UP, down2: K.DOWN, left2: K.LEFT, right2: K.RIGHT,
      dash: K.SHIFT, action: K.SPACE, pause: K.ESC, interact: K.E, swap: K.Q,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }
  /** Forget held / just-pressed keys (after a pause, so nothing fires twice). */
  reset() { Object.values(this.keys).forEach((k) => k.reset()); }
  get moveX() { return (this.keys.right.isDown || this.keys.right2.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.left2.isDown ? 1 : 0); }
  get moveY() { return (this.keys.down.isDown || this.keys.down2.isDown ? 1 : 0) - (this.keys.up.isDown || this.keys.up2.isDown ? 1 : 0); }
  get dashPressed() { return Phaser.Input.Keyboard.JustDown(this.keys.dash); }
  get swapPressed() { return Phaser.Input.Keyboard.JustDown(this.keys.swap); }
  get interactPressed() { return Phaser.Input.Keyboard.JustDown(this.keys.interact); }
  get actionPressed() { return Phaser.Input.Keyboard.JustDown(this.keys.action); }
}
