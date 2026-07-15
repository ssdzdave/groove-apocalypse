// WS-F — see CONTRACTS.md Contract 7. Phaser is a global — never import it.
import { EVT, DEPTH, PALETTE } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Juice } from '../fx/Juice.js';

const NOVA_INTERVAL_MS = 3500;
const NOVA_DIRECTIONS = 8;
const NOVA_PROJECTILE_SPEED = 140;
const STALK_SPEED = 40;
const BODY_SIZE = 48;

export default class SilentSheriff extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'boss_sheriff');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        if (this.body) {
            const offset = (64 - BODY_SIZE) / 2;
            this.body.setSize(BODY_SIZE, BODY_SIZE);
            this.body.setOffset(offset, offset);
            this.body.setImmovable(true);
            // Immovable bodies aren't pushed back by wall colliders — clamp to
            // world bounds so the boss can't drift into the border walls.
            this.body.setCollideWorldBounds(true);
        }

        this.setDepth(DEPTH.enemies);
        this.play('boss-idle');

        Juice.addBloom(this, { color: PALETTE.purple, strength: 1 });

        // 6 hp at level 3, 8 hp at level 6 — Math.max guards against a stray
        // spawn on a non-boss level yielding less than the L3 baseline.
        this.maxHp = 6 + 2 * Math.max(0, Math.floor(scene.currentLevel / 3) - 1);
        this.hp = this.maxHp;
        this.stunned = false;
        this.dead = false;

        this._novaCount = 0;
        this._nextNovaAt = null; // set on first update() relative to spawn time
        this._attackAnimUntil = 0;

        scene.game.events.emit(EVT.BOSS_HP, this.hp, this.maxHp);
        AudioEngine.sfx('boss_roar');
    }

    update(time, delta) {
        if (this.dead || !this.active) return;

        if (this.stunned) {
            if (this.anims) this.play('boss-stunned', true);
            if (this.body) this.body.setVelocity(0, 0);
            return;
        }

        const player = this.scene && this.scene.player;
        if (player && player.active && this.body && this.scene.physics) {
            this.scene.physics.moveToObject(this, player, STALK_SPEED);
        }

        if (this._nextNovaAt === null) {
            this._nextNovaAt = time + NOVA_INTERVAL_MS;
        }

        if (time >= this._nextNovaAt) {
            this._nextNovaAt = time + NOVA_INTERVAL_MS;
            this._fireNova(time);
        } else if (time >= this._attackAnimUntil && this.anims) {
            this.play('boss-idle', true);
        }
    }

    _fireNova(time) {
        this._novaCount += 1;

        if (this.anims) this.play('boss-attack', true);
        this._attackAnimUntil = time + 400;

        if (this._novaCount % 3 === 0) {
            AudioEngine.sfx('boss_roar');
        }

        const group = this.scene && this.scene.silenceProjectiles;
        if (!group) return;

        for (let i = 0; i < NOVA_DIRECTIONS; i++) {
            const angle = (i / NOVA_DIRECTIONS) * Math.PI * 2;
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);

            const proj = group.get(this.x, this.y);
            if (!proj) continue;

            if (typeof proj.fire === 'function') {
                // Preferred path — WS-C's SilenceProjectile owns activation/pooling.
                proj.fire(this.x, this.y, dirX, dirY);
            } else {
                // Defensive fallback if the pooled projectile doesn't expose fire().
                if (typeof proj.setActive === 'function') proj.setActive(true);
                if (typeof proj.setVisible === 'function') proj.setVisible(true);
                if (typeof proj.setPosition === 'function') proj.setPosition(this.x, this.y);
                if (proj.body) {
                    proj.body.enable = true;
                    proj.body.setVelocity(dirX * NOVA_PROJECTILE_SPEED, dirY * NOVA_PROJECTILE_SPEED);
                }
            }
        }
    }

    stun(ms) {
        if (this.dead) return;

        this.stunned = true;
        if (this.anims) this.play('boss-stunned', true);
        this.setTint(PALETTE.cyan);
        if (this.body) this.body.setVelocity(0, 0);
        AudioEngine.sfx('stun');

        this.scene.time.delayedCall(ms, () => {
            if (!this.active) return;
            this.stunned = false;
            this.clearTint();
        });
    }

    // Normal (non-special) player projectiles: absorbed while not stunned, never damage.
    onProjectileHit(proj) {
        if (this.dead || this.stunned) return;

        Juice.hitFlash(this, PALETTE.gray);
        // Tell the player WHY nothing happened (throttled to 1/s)
        const now = this.scene && this.scene.time ? this.scene.time.now : 0;
        if (!this._lastImmuneText || now - this._lastImmuneText > 1000) {
            this._lastImmuneText = now;
            Juice.floatText(this.scene, this.x, this.y - 40, 'IMMUNE!', PALETTE.gray);
        }

        const piercing = !!(proj && proj.piercing);
        if (!piercing && proj) {
            if (typeof proj.setActive === 'function') proj.setActive(false);
            if (typeof proj.setVisible === 'function') proj.setVisible(false);
            if (proj.body) proj.body.enable = false;
        }
    }

    // Routed here by GameScene's collider only while stunned (special-attack damage).
    onSpecialHit() {
        if (this.dead) return;
        // Brief cooldown so a piercing shot through a stunned boss lands once,
        // not once per overlapping physics frame.
        const nowT = this.scene && this.scene.time ? this.scene.time.now : 0;
        if (this._lastSpecialHitAt && nowT - this._lastSpecialHitAt < 250) return;
        this._lastSpecialHitAt = nowT;

        const scene = this.scene;
        const now = scene && scene.time ? scene.time.now : 0;

        this.hp -= 1;
        scene.game.events.emit(EVT.BOSS_HP, this.hp, this.maxHp);
        AudioEngine.sfx('boss_hit');
        Juice.hitFlash(this, 0xffffff);
        Juice.shake(scene, 0.008, 150);

        if (this.anims) this.play('boss-attack', true);
        this._attackAnimUntil = now + 300;

        if (this.hp <= 0) {
            this._die(scene);
        }
    }

    _die(scene) {
        this.dead = true;
        this.stunned = false;

        if (this.body) {
            this.body.setVelocity(0, 0);
            this.body.enable = false;
        }

        AudioEngine.sfx('boss_die');
        scene.game.events.emit(EVT.BOSS_HP, null, null);
        scene.data.set('bossDefeated', true);

        const burstCount = 4;
        for (let i = 0; i < burstCount; i++) {
            scene.time.delayedCall(i * 225, () => {
                if (!this.active) return;
                const ox = Phaser.Math.Between(-20, 20);
                const oy = Phaser.Math.Between(-20, 20);
                Juice.burst(scene, this.x + ox, this.y + oy, PALETTE.purple, 16);
            });
        }

        scene.time.delayedCall(900, () => {
            if (!this.active) return;
            scene.tweens.add({
                targets: this,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    if (this.active) this.destroy();
                }
            });
        });
    }
}
