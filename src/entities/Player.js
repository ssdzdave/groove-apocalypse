// WS-C — see CONTRACTS.md Contract 5.
import { PALETTE, DEPTH, EVT } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Juice } from '../fx/Juice.js';

const BASE_SPEED = 170;
const SHOOT_COOLDOWN_MS = 200;
const SPECIAL_COOLDOWN_MS = 3000;
const MERCY_MS = 800;
const SLIDE_RADIUS = 110;

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, charId) {
        super(scene, x, y, 'char_' + charId);
        this.charId = charId;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.setDepth(DEPTH.player);

        this.hp = 3;
        this.maxHp = 3;
        this.isInvincible = false;

        this._facing = { x: 1, y: 0 };
        this._speedMult = 1;
        this._tonicUntil = 0;
        this._invincibleUntil = 0;
        this._mercyUntil = 0;
        this._invincibleTween = null;

        this._lastShot = -Infinity;
        this._lastSpecial = -Infinity;
        this._specialCharging = false;
        this._shootAnimPlaying = false;
        this._moving = false;

        if (scene.anims.exists(charId + '-idle')) this.play(charId + '-idle');
    }

    get facing() { return this._facing; }

    update(time, delta) {
        const keys = this.scene.keys;
        if (!keys) return;

        let dx = 0, dy = 0;
        if ((keys.left && keys.left.isDown) || (keys.A && keys.A.isDown)) dx -= 1;
        if ((keys.right && keys.right.isDown) || (keys.D && keys.D.isDown)) dx += 1;
        if ((keys.up && keys.up.isDown) || (keys.W && keys.W.isDown)) dy -= 1;
        if ((keys.down && keys.down.isDown) || (keys.S && keys.S.isDown)) dy += 1;

        if (dx !== 0 && dy !== 0) {
            const inv = Math.SQRT1_2;
            dx *= inv; dy *= inv;
        }

        const speed = BASE_SPEED * this._speedMult;
        this.setVelocity(dx * speed, dy * speed);

        if (dx !== 0 || dy !== 0) {
            this._facing = { x: dx, y: dy };
            this._moving = true;
            if (dx < 0) this.setFlipX(true);
            else if (dx > 0) this.setFlipX(false);
        } else {
            this._moving = false;
        }

        // tonic speed boost expiry
        if (this._tonicUntil && time > this._tonicUntil) {
            this._tonicUntil = 0;
            this._speedMult = 1;
            this.scene.game.events.emit(EVT.POWERUP, { type: 'tonic', remainingMs: 0 });
        }

        // mystery-tape invincibility expiry
        if (this.isInvincible && this._invincibleUntil && time > this._invincibleUntil) {
            this.isInvincible = false;
            this._invincibleUntil = 0;
            if (this._invincibleTween) { this._invincibleTween.remove(); this._invincibleTween = null; }
            this.clearTint();
            this.scene.game.events.emit(EVT.POWERUP, { type: 'tape', remainingMs: 0 });
        }

        if (!this._shootAnimPlaying) {
            const key = this.charId + (this._moving ? '-walk' : '-idle');
            const current = this.anims.currentAnim;
            if ((!current || current.key !== key) && this.scene.anims.exists(key)) {
                this.play(key, true);
            }
        }
    }

    shoot() {
        const scene = this.scene;
        const time = scene.time.now;
        if (time - this._lastShot < SHOOT_COOLDOWN_MS) return;
        this._lastShot = time;

        const fx = this._facing.x === 0 && this._facing.y === 0 ? 1 : this._facing.x;
        const fy = this._facing.x === 0 && this._facing.y === 0 ? 0 : this._facing.y;
        const baseAngle = Math.atan2(fy, fx);

        const shootKey = this.charId + '-shoot';
        if (scene.anims.exists(shootKey)) {
            this._shootAnimPlaying = true;
            this.play(shootKey, true);
            this.once('animationcomplete-' + shootKey, () => { this._shootAnimPlaying = false; });
        }

        if (this.charId === 'elliot') {
            [-15, 0, 15].forEach((deg) => {
                const a = baseAngle + Phaser.Math.DegToRad(deg);
                const dx = Math.cos(a), dy = Math.sin(a);
                const proj = scene.playerProjectiles.get(this.x, this.y);
                if (proj) {
                    proj.fire(this.x, this.y, dx, dy, { texture: 'proj_chord', speed: 380, piercing: false });
                    Juice.trail(scene, proj, PALETTE.gold);
                }
            });
            AudioEngine.sfx('shoot_chord');
        } else {
            const proj = scene.playerProjectiles.get(this.x, this.y);
            if (proj) {
                proj.fire(this.x, this.y, fx, fy, { texture: 'proj_loop', speed: 320, piercing: true });
                Juice.trail(scene, proj, PALETTE.cyan);
            }
            AudioEngine.sfx('shoot_loop');
        }
    }

    special() {
        const scene = this.scene;
        const time = scene.time.now;
        if (this._specialCharging || time - this._lastSpecial < SPECIAL_COOLDOWN_MS) return;
        this._lastSpecial = time;
        this._specialCharging = true;

        scene.game.events.emit(EVT.SPECIAL_READY, false, 0);
        const ticks = Math.floor(SPECIAL_COOLDOWN_MS / 100);
        scene.time.addEvent({
            delay: 100,
            repeat: ticks - 1,
            callback: () => {
                const elapsed = scene.time.now - this._lastSpecial;
                const frac = Math.min(1, elapsed / SPECIAL_COOLDOWN_MS);
                scene.game.events.emit(EVT.SPECIAL_READY, frac >= 1, frac);
            }
        });

        const specialKey = this.charId + '-special';
        if (scene.anims.exists(specialKey)) this.play(specialKey, true);

        if (this.charId === 'elliot') this._sonicSlide();
        else this._bassDrop();

        scene.time.delayedCall(SPECIAL_COOLDOWN_MS, () => { this._specialCharging = false; });
    }

    _sonicSlide() {
        const scene = this.scene;
        const gfx = scene.add.graphics();
        gfx.setDepth(DEPTH.particles);
        scene.tweens.addCounter({
            from: 4,
            to: SLIDE_RADIUS,
            duration: 350,
            onUpdate: (tw) => {
                const r = tw.getValue();
                gfx.clear();
                gfx.lineStyle(4, PALETTE.gold, Math.max(0, 1 - r / SLIDE_RADIUS));
                gfx.strokeCircle(this.x, this.y, r);
            },
            onComplete: () => gfx.destroy()
        });

        const applyKnockback = (target) => {
            if (!target.active) return;
            const d = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
            if (d <= SLIDE_RADIUS) {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
                target.setVelocity(Math.cos(angle) * 260, Math.sin(angle) * 260);
                if (typeof target.stun === 'function') target.stun(400);
            }
        };

        if (scene.zomboids) scene.zomboids.getChildren().forEach(applyKnockback);
        if (scene.droneBots) scene.droneBots.getChildren().forEach(applyKnockback);

        if (scene.boss && scene.boss.active) {
            const d = Phaser.Math.Distance.Between(this.x, this.y, scene.boss.x, scene.boss.y);
            if (d <= SLIDE_RADIUS) scene.boss.onSpecialHit();
        }

        AudioEngine.sfx('slide');
    }

    _bassDrop() {
        const scene = this.scene;
        if (typeof scene.stunAllEnemies === 'function') scene.stunAllEnemies(3000);
        if (scene.boss && scene.boss.active) scene.boss.stun(3000);
        Juice.shake(scene, 0.012, 250);
        AudioEngine.sfx('bassdrop');
    }

    applyTonic(ms) {
        this._speedMult = 1.5;
        this._tonicUntil = this.scene.time.now + ms;
        this.scene.game.events.emit(EVT.POWERUP, { type: 'tonic', remainingMs: ms });
    }

    applyInvincible(ms) {
        this.isInvincible = true;
        this._invincibleUntil = this.scene.time.now + ms;
        this.scene.game.events.emit(EVT.POWERUP, { type: 'tape', remainingMs: ms });
        if (this._invincibleTween) this._invincibleTween.remove();
        this._invincibleTween = this.scene.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 400,
            repeat: -1,
            onUpdate: (tw) => {
                const hue = tw.getValue() / 360;
                const c = Phaser.Display.Color.HSVToRGB(hue, 1, 1);
                this.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
            }
        });
    }

    damage(n) {
        if (this.isInvincible) return;
        const scene = this.scene;
        const time = scene.time.now;
        if (time < this._mercyUntil) return;
        this._mercyUntil = time + MERCY_MS;

        this.hp = Phaser.Math.Clamp(this.hp - n, 0, this.maxHp);
        scene.game.events.emit(EVT.PLAYER_HP, this.hp, this.maxHp);
        Juice.shake(scene, 0.006, 150);
        Juice.hitFlash(this, 0xff3c3c);
        AudioEngine.sfx('hurt');

        if (this.hp <= 0 && typeof scene.onPlayerDeath === 'function') {
            scene.onPlayerDeath();
        }
    }

    heal(n) {
        this.hp = Phaser.Math.Clamp(this.hp + n, 0, this.maxHp);
        this.scene.game.events.emit(EVT.PLAYER_HP, this.hp, this.maxHp);
    }
}
