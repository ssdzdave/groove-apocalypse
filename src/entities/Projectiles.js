// WS-C — see CONTRACTS.md Contract 5. Pooled projectile sprites.
import { DEPTH } from '../config.js';

const DEFAULT_LIFE_MS = 1500;

const ONBEAT_SCALE = 1.35;
const ONBEAT_TINT = 0xffffff; // white-hot

export class PlayerProjectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x = 0, y = 0, texture = 'proj_chord') {
        super(scene, x, y, texture);
        this.piercing = false;
        this.onBeat = false;
        this._life = DEFAULT_LIFE_MS;
        this._elapsed = 0;
    }

    // fire(x, y, dirX, dirY, opts) — opts: { texture, speed, piercing, onBeat }
    fire(x, y, dirX, dirY, opts = {}) {
        const scene = this.scene;
        const texture = opts.texture || 'proj_chord';
        if (!this.body && scene && scene.physics) {
            scene.physics.add.existing(this);
        }
        this.setTexture(texture);
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        if (this.body) {
            this.body.enable = true;
            if (this.body.setAllowGravity) this.body.setAllowGravity(false);
            // Pooled sprites keep the body size of their creation texture (32x32
            // __DEFAULT) — resize to a forgiving hitbox and re-sync to position.
            this.body.setSize(10, 10);
            this.body.reset(x, y);
        }
        this.piercing = !!opts.piercing;
        this.onBeat = !!opts.onBeat;
        if (this.onBeat) {
            this.setScale(ONBEAT_SCALE);
            this.setTintFill(ONBEAT_TINT);
        } else {
            this.setScale(1);
            this.clearTint();
        }
        const speed = opts.speed || 380;
        const len = Math.hypot(dirX, dirY) || 1;
        const nx = dirX / len, ny = dirY / len;
        this.setVelocity(nx * speed, ny * speed);
        this.setRotation(Math.atan2(ny, nx));
        this.setDepth(DEPTH.projectiles);
        if (texture === 'proj_loop' && scene.anims.exists('loop-fly')) this.play('loop-fly', true);
        else if (scene.anims.exists('chord-fly')) this.play('chord-fly', true);
        this._life = DEFAULT_LIFE_MS;
        this._elapsed = 0;
        return this;
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (!this.active) return;
        this._elapsed += delta;
        if (this._elapsed > this._life) { this.deactivate(); return; }
        const bounds = this.scene && this.scene.physics ? this.scene.physics.world.bounds : null;
        if (bounds) {
            if (this.x < bounds.x - 16 || this.x > bounds.x + bounds.width + 16 ||
                this.y < bounds.y - 16 || this.y > bounds.y + bounds.height + 16) {
                this.deactivate();
            }
        }
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        this.setVelocity(0, 0);
        if (this.body) this.body.enable = false;
        this.onBeat = false;
    }
}

export class SilenceProjectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x = 0, y = 0) {
        super(scene, x, y, 'proj_silence');
        this._life = 3000;
        this._elapsed = 0;
    }

    fire(x, y, dirX, dirY, opts = {}) {
        const scene = this.scene;
        if (!this.body && scene && scene.physics) {
            scene.physics.add.existing(this);
        }
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        if (this.body) {
            this.body.enable = true;
            if (this.body.setAllowGravity) this.body.setAllowGravity(false);
            this.body.setSize(10, 10);
            this.body.reset(x, y);
        }
        const speed = opts.speed || 200;
        const len = Math.hypot(dirX, dirY) || 1;
        const nx = dirX / len, ny = dirY / len;
        this.setVelocity(nx * speed, ny * speed);
        this.setDepth(DEPTH.projectiles);
        if (scene.anims.exists('silence-fly')) this.play('silence-fly', true);
        this._life = 3000;
        this._elapsed = 0;
        return this;
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (!this.active) return;
        this._elapsed += delta;
        if (this._elapsed > this._life) { this.deactivate(); return; }
        const bounds = this.scene && this.scene.physics ? this.scene.physics.world.bounds : null;
        if (bounds) {
            if (this.x < bounds.x - 16 || this.x > bounds.x + bounds.width + 16 ||
                this.y < bounds.y - 16 || this.y > bounds.y + bounds.height + 16) {
                this.deactivate();
            }
        }
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        this.setVelocity(0, 0);
        if (this.body) this.body.enable = false;
    }
}
