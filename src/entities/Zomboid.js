// WS-C — see CONTRACTS.md Contract 5.
import { PALETTE, DEPTH, EVT } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Juice } from '../fx/Juice.js';

const BASE_SPEED = 45;
const LEVEL_SPEED_CAP = 2.2; // pinned: zomboid level-based speed factor caps at x2.2
const ELITE_SPEED_MULT = 1.6;
const ELITE_SCALE = 1.15;

function speedFactorForLevel(level) {
    return Math.min(LEVEL_SPEED_CAP, 1 + 0.08 * (level - 1));
}

export default class Zomboid extends Phaser.Physics.Arcade.Sprite {
    // opts: { elite }
    constructor(scene, x, y, level, opts = {}) {
        super(scene, x, y, 'zomboid');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(DEPTH.enemies);
        this.body.setSize(22, 22);

        this.level = level || 1;
        this.elite = !!(opts && opts.elite);
        this.speed = BASE_SPEED * speedFactorForLevel(this.level) * (this.elite ? ELITE_SPEED_MULT : 1);
        this.converted = false;
        this._stunUntil = 0;

        if (this.elite) {
            this.setTint(PALETTE.gold);
            this.setScale(ELITE_SCALE);
        }

        if (scene.anims.exists('zomboid-walk')) this.play('zomboid-walk');
    }

    setLevel(level) {
        this.level = level;
        this.speed = BASE_SPEED * speedFactorForLevel(level) * (this.elite ? ELITE_SPEED_MULT : 1);
    }

    stun(ms) {
        if (this.converted) return;
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
        // Restore elite gold tint once the stun-gray tint lapses.
        if (this.elite) this.setTint(PALETTE.gold);
        else this.clearTint();

        const scene = this.scene;
        const player = scene.player;
        if (!player || !player.active) return;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);

        if (!this.anims.isPlaying && this.scene.anims.exists('zomboid-walk')) {
            this.play('zomboid-walk', true);
        }
    }

    // opts: { onBeat } — see CONTRACTS.md P3-C
    convert(opts = {}) {
        if (this.converted) return;
        this.converted = true;
        const onBeat = !!(opts && opts.onBeat);

        const scene = this.scene;
        this.setTexture('dancer');
        this.clearTint();
        const startFrame = Phaser.Math.Between(0, 5);
        if (scene.anims.exists('dancer-dance')) {
            this.play({ key: 'dancer-dance', startFrame });
        }
        this.setVelocity(0, 0);
        if (this.body) this.body.enable = false;

        scene.conversions = (scene.conversions || 0) + 1;
        scene.game.events.emit(EVT.CONVERTED, scene.conversions);
        Juice.burst(scene, this.x, this.y, PALETTE.magenta);
        Juice.floatText(scene, this.x, this.y, 'GROOVE!', PALETTE.magenta);
        AudioEngine.sfx('convert');

        if (scene.score && typeof scene.score.onConversion === 'function') {
            scene.score.onConversion(this.x, this.y, { elite: this.elite, onBeat, kind: 'zomboid' });
        }

        scene.time.delayedCall(3000, () => {
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
