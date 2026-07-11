// WS-D (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-D.
import { PALETTE, DEPTH } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Juice } from '../fx/Juice.js';

const BASE_SPEED = 30;
const BODY_SIZE = 26;
const SHOCKWAVE_RADIUS = 90;
const SHOCKWAVE_STUN_MS = 1000;
const CHAIN_RADIUS = 60;
const DESPAWN_MS = 3000;

export default class AmpGolem extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level) {
        super(scene, x, y, 'amp_golem');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(DEPTH.enemies);

        if (this.body) {
            this.body.setSize(BODY_SIZE, BODY_SIZE);
            this.body.setOffset((32 - BODY_SIZE) / 2, (32 - BODY_SIZE) / 2);
        }

        this.level = level || 1;
        this.speed = BASE_SPEED;
        this.hp = 3;
        this.converted = false;
        this._stunUntil = 0;
        this._animState = null;

        if (scene.anims && scene.anims.exists('golem-walk')) {
            this.play('golem-walk');
            this._animState = 'golem-walk';
        }
    }

    stun(ms) {
        if (this.converted || !this.active) return;
        this._stunUntil = this.scene.time.now + ms;
        this.setVelocity(0, 0);
        this.setTint(PALETTE.gray);
        AudioEngine.sfx('stun');
    }

    update(time, delta) {
        if (this.converted || !this.active) return;

        if (time < this._stunUntil) {
            this.setVelocity(0, 0);
            return;
        }
        this.clearTint();

        const scene = this.scene;
        const player = scene && scene.player;
        if (player && player.active) {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
        } else {
            this.setVelocity(0, 0);
        }

        const desiredAnim = this.hp <= 1 ? 'golem-cracked' : 'golem-walk';
        if (this._animState !== desiredAnim && scene.anims && scene.anims.exists(desiredAnim)) {
            this.play(desiredAnim, true);
            this._animState = desiredAnim;
        }
    }

    // Called by GameScene's playerProjectiles x golems overlap.
    hit(proj) {
        if (this.converted || !this.active) return;
        const onBeat = !!(proj && proj.onBeat);
        this.hp -= onBeat ? 2 : 1;
        Juice.hitFlash(this, 0xffffff);

        if (this.hp <= 0) {
            this.convert({ onBeat });
        }
    }

    convert(opts) {
        if (this.converted) return;
        this.converted = true;

        const scene = this.scene;
        const onBeat = !!(opts && opts.onBeat);

        this.setTexture('dancer');
        this.setScale(1.2);
        const startFrame = Phaser.Math.Between(0, 5);
        if (scene.anims && scene.anims.exists('dancer-dance')) {
            this.play({ key: 'dancer-dance', startFrame });
        }
        this.setVelocity(0, 0);
        this.clearTint();
        if (this.body) this.body.enable = false;

        Juice.burst(scene, this.x, this.y, PALETTE.orange, 12);
        Juice.burst(scene, this.x, this.y, PALETTE.gold, 12);
        AudioEngine.sfx('golem_shockwave');

        this._shockwave(scene);

        if (scene.score && typeof scene.score.onConversion === 'function') {
            scene.score.onConversion(this.x, this.y, { kind: 'golem', onBeat });
        }

        scene.time.delayedCall(DESPAWN_MS, () => {
            if (!this.scene) return;
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                duration: 400,
                onComplete: () => { if (this.scene) this.destroy(); }
            });
        });
    }

    _shockwave(scene) {
        const cx = this.x;
        const cy = this.y;

        // Ring visual: a Graphics circle redrawn each tween step (sheriff/sonic-slide style).
        if (scene.add && scene.tweens) {
            const g = scene.add.graphics();
            g.setDepth(DEPTH.particles);
            const state = { r: 8, a: 0.9 };
            scene.tweens.add({
                targets: state,
                r: SHOCKWAVE_RADIUS,
                a: 0,
                duration: 350,
                onUpdate: () => {
                    g.clear();
                    g.lineStyle(3, PALETTE.orange, state.a);
                    g.strokeCircle(cx, cy, state.r);
                },
                onComplete: () => { if (g && g.destroy) g.destroy(); }
            });
        }

        // Stun enemies within the shockwave radius.
        const groups = [scene.zomboids, scene.droneBots, scene.golems, scene.phantoms];
        for (const group of groups) {
            if (!group || typeof group.getChildren !== 'function') continue;
            group.getChildren().forEach((enemy) => {
                if (!enemy || !enemy.active || enemy === this) return;
                const dist = Phaser.Math.Distance.Between(cx, cy, enemy.x, enemy.y);
                if (dist <= SHOCKWAVE_RADIUS && typeof enemy.stun === 'function') {
                    enemy.stun(SHOCKWAVE_STUN_MS);
                }
            });
        }

        // Chain-convert zomboids (elites included — they're still zomboids) within CHAIN_RADIUS.
        if (scene.zomboids && typeof scene.zomboids.getChildren === 'function') {
            scene.zomboids.getChildren().forEach((z) => {
                if (!z || !z.active || z.converted) return;
                const dist = Phaser.Math.Distance.Between(cx, cy, z.x, z.y);
                if (dist <= CHAIN_RADIUS && typeof z.convert === 'function') {
                    z.convert({ onBeat: false });
                }
            });
        }
    }
}
