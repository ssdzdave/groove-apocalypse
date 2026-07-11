// WS-D (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-D.
import { TILE, PALETTE, DEPTH } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Juice } from '../fx/Juice.js';

const CYCLE_INTERVAL_MS = 4000;
const BURST_DELAY_MS = 400;
const VULN_MS = 1500;
const MIN_TP_TILES = 2;
const MAX_TP_TILES = 4;
const FIRE_RANGE_TILES = 7;
const BURST_SPEED = 180;
const BURST_SPREAD_DEG = 20;
const DESPAWN_MS = 3000;

export default class FeedbackPhantom extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level) {
        super(scene, x, y, 'feedback_phantom');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(DEPTH.enemies);

        if (this.body) {
            this.body.setSize(22, 22);
            if (this.body.setAllowGravity) this.body.setAllowGravity(false);
        }

        this.level = level || 1;
        this.converted = false;
        this.phased = true;
        this.setAlpha(0.5);

        this._stunUntil = 0;
        this._stunToken = 0;
        this._nextCycleAt = null;

        if (scene.anims && scene.anims.exists('phantom-float')) this.play('phantom-float');
    }

    // Stun forces phased = false for the stun duration (vulnerable while frozen).
    stun(ms) {
        if (this.converted || !this.active) return;
        this.phased = false;
        this.setAlpha(1);
        this.setTint(PALETTE.gray);
        this.setVelocity(0, 0);
        AudioEngine.sfx('stun');

        const token = (this._stunToken = this._stunToken + 1);
        this._stunUntil = this.scene.time.now + ms;

        this.scene.time.delayedCall(ms, () => {
            if (!this.active || this.converted) return;
            if (this._stunToken !== token) return; // superseded by a newer stun
            this._stunUntil = 0;
            this.phased = true;
            this.setAlpha(0.5);
            this.clearTint();
        });
    }

    update(time, delta) {
        if (this.converted || !this.active) return;

        if (this._stunUntil && time < this._stunUntil) {
            return;
        }

        if (this._nextCycleAt === null) {
            this._nextCycleAt = time + CYCLE_INTERVAL_MS;
        }
        if (time >= this._nextCycleAt) {
            this._nextCycleAt = time + CYCLE_INTERVAL_MS;
            this._burstCycle();
        }

        if (this.anims && !this.anims.isPlaying && this.scene.anims && this.scene.anims.exists('phantom-float')) {
            this.play('phantom-float', true);
        }
    }

    _burstCycle() {
        const scene = this.scene;
        if (!scene) return;

        this._teleport();

        scene.time.delayedCall(BURST_DELAY_MS, () => {
            if (!this.active || this.converted) return;
            if (this._stunUntil && scene.time.now < this._stunUntil) return;
            this._fireBurst();
            this._enterVulnerable();
        });
    }

    _teleport() {
        const scene = this.scene;
        const levelData = scene._levelData;
        const player = scene.player;
        const openTiles = levelData && levelData.openTiles;

        if (openTiles && openTiles.length && player) {
            const playerTx = Math.floor(player.x / TILE);
            const playerTy = Math.floor(player.y / TILE);
            const candidates = openTiles.filter((t) => {
                const d = Math.abs(t.tx - playerTx) + Math.abs(t.ty - playerTy);
                return d >= MIN_TP_TILES && d <= MAX_TP_TILES;
            });
            if (candidates.length) {
                const pick = candidates[Phaser.Math.Between(0, candidates.length - 1)];
                this.setPosition(pick.tx * TILE + TILE / 2, pick.ty * TILE + TILE / 2);
            }
            // else: no valid tile found — stay put (fallback per contract).
        }

        if (this.scene.anims && this.scene.anims.exists('phantom-tele')) this.play('phantom-tele', true);
        AudioEngine.sfx('phantom_tele');
        Juice.burst(scene, this.x, this.y, PALETTE.magenta, 10);
    }

    _fireBurst() {
        const scene = this.scene;
        const player = scene && scene.player;
        if (!player || !player.active) return;

        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist > FIRE_RANGE_TILES * TILE) return;

        const group = scene.silenceProjectiles;
        if (!group) return;

        const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const spreadRad = Phaser.Math.DegToRad(BURST_SPREAD_DEG);
        const offsets = [-spreadRad, 0, spreadRad];

        for (const off of offsets) {
            const angle = baseAngle + off;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const proj = group.get(this.x, this.y);
            if (!proj) continue;

            if (typeof proj.fire === 'function') {
                proj.fire(this.x, this.y, dx, dy, { speed: BURST_SPEED });
            } else {
                // Defensive fallback if the pooled projectile doesn't expose fire().
                if (typeof proj.setActive === 'function') proj.setActive(true);
                if (typeof proj.setVisible === 'function') proj.setVisible(true);
                if (typeof proj.setPosition === 'function') proj.setPosition(this.x, this.y);
                if (proj.body) {
                    proj.body.enable = true;
                    proj.body.setVelocity(dx * BURST_SPEED, dy * BURST_SPEED);
                }
            }
        }
    }

    _enterVulnerable() {
        const scene = this.scene;
        this.phased = false;
        this.setAlpha(1);
        this.setTint(PALETTE.magenta);

        if (!scene || !scene.time) return;
        scene.time.delayedCall(VULN_MS, () => {
            if (!this.active || this.converted) return;
            if (this._stunUntil && scene.time.now < this._stunUntil) return; // still stunned — stays vulnerable
            this.phased = true;
            this.setAlpha(0.5);
            this.clearTint();
        });
    }

    convert(opts) {
        if (this.converted) return;
        this.converted = true;

        const scene = this.scene;
        const onBeat = !!(opts && opts.onBeat);

        this.setTexture('dancer');
        const startFrame = Phaser.Math.Between(0, 5);
        if (scene.anims && scene.anims.exists('dancer-dance')) {
            this.play({ key: 'dancer-dance', startFrame });
        }
        this.setAlpha(1);
        this.clearTint();
        this.setVelocity(0, 0);
        if (this.body) this.body.enable = false;

        Juice.burst(scene, this.x, this.y, PALETTE.magenta);
        Juice.floatText(scene, this.x, this.y, 'GROOVE!', PALETTE.magenta);
        AudioEngine.sfx('convert');

        if (scene.score && typeof scene.score.onConversion === 'function') {
            scene.score.onConversion(this.x, this.y, { kind: 'phantom', onBeat });
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
}
