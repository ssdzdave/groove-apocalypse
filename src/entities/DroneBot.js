// WS-C — see CONTRACTS.md Contract 5.
import { TILE, PALETTE, DEPTH } from '../config.js';
import { Juice } from '../fx/Juice.js';

const APPROACH_SPEED = 60;
const DRIFT_SPEED = 22;
const FIRE_RANGE = 5 * TILE;
const FIRE_INTERVAL_MS = 2500;

export default class DroneBot extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level) {
        super(scene, x, y, 'dronebot');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(DEPTH.enemies);
        this.body.setSize(22, 22);
        if (this.body && this.body.setAllowGravity) this.body.setAllowGravity(false);

        this.level = level || 1;
        this._stunUntil = 0;
        this._lastFire = -Infinity;
        this._wobble = Math.random() * Math.PI * 2;
        this._driftAngle = Math.random() * Math.PI * 2;
        this._driftTimer = 0;

        if (scene.anims.exists('drone-hover')) this.play('drone-hover');
    }

    stun(ms) {
        this._stunUntil = this.scene.time.now + ms;
        this.setVelocity(0, 0);
        this.setTint(PALETTE.gray);
    }

    update(time, delta) {
        if (!this.active) return;
        if (time < this._stunUntil) return;
        this.clearTint();

        const scene = this.scene;
        const player = scene.player;
        if (!player || !player.active) return;

        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (dist < FIRE_RANGE) {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            this.setVelocity(Math.cos(angle) * APPROACH_SPEED, Math.sin(angle) * APPROACH_SPEED + Math.sin(this._wobble) * 8);
            if (time - this._lastFire > FIRE_INTERVAL_MS) {
                this._lastFire = time;
                this._fireAt(player);
            }
        } else {
            this._driftTimer -= delta || 16;
            if (this._driftTimer <= 0) {
                this._driftAngle = Math.random() * Math.PI * 2;
                this._driftTimer = 2000 + Math.random() * 1500;
            }
            this.setVelocity(Math.cos(this._driftAngle) * DRIFT_SPEED, Math.sin(this._driftAngle) * DRIFT_SPEED);
        }

        this._wobble += 0.03;
        this.y += Math.sin(this._wobble) * 0.15;
    }

    _fireAt(player) {
        const scene = this.scene;
        if (!scene.silenceProjectiles) return;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const proj = scene.silenceProjectiles.get(this.x, this.y);
        if (proj) proj.fire(this.x, this.y, Math.cos(angle), Math.sin(angle), { speed: 200 });
    }

    hit() {
        Juice.burst(this.scene, this.x, this.y, PALETTE.gray);
        this.destroy();
    }
}
