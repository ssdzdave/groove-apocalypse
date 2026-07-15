// WS-D (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-D. Mirrors SilentSheriff's seam (D6).
import { TILE, GRID_W, GRID_H, GAME_W, GAME_H, PALETTE, DEPTH, EVT } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Juice } from '../fx/Juice.js';
import Zomboid from './Zomboid.js';

const BODY_SIZE = 48;
const STALK_SPEED_P1 = 35;
const STALK_SPEED_P2 = 55;
const SUMMON_INTERVAL_MS = 6000;
const SPREAD_INTERVAL_MS = 4000;
const SWEEP_INTERVAL_MS = 5000;
const SWEEP_SPACING = 64;
const SWEEP_SPEED = 140;
const SPREAD_SPEED = 220;
const SPREAD_ANGLE_DEG = 20;
const SUMMON_CAP_SLACK = 6;
const ARENA_EDGE_MARGIN = 2;

function zomboidCapForLevel(n) {
    const level = n || 0;
    return Math.min(10 + Math.floor(Math.max(0, level - 6) / 2), 16);
}

export default class FeedbackBaron extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'boss_baron');

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
        if (scene.anims && scene.anims.exists('baron-idle')) this.play('baron-idle');

        Juice.addBloom(this, { color: PALETTE.gold, strength: 1 });

        this.maxHp = 8 + 2 * Math.max(0, Math.floor((scene.currentLevel || 0) / 3) - 2);
        this.hp = this.maxHp;
        this.stunned = false;
        this.dead = false;

        this._nextSummonAt = null;
        this._nextSpreadAt = null;
        this._nextSweepAt = null;
        this._attackAnimUntil = 0;
        this._summonCount = 0;

        scene.game.events.emit(EVT.BOSS_HP, this.hp, this.maxHp);
        AudioEngine.sfx('boss_roar');
    }

    update(time, delta) {
        if (this.dead || !this.active) return;

        if (this.stunned) {
            if (this.anims) this.play('baron-stunned', true);
            if (this.body) this.body.setVelocity(0, 0);
            return;
        }

        const scene = this.scene;
        const player = scene && scene.player;
        const phase2 = this.hp <= this.maxHp / 2;
        const stalkSpeed = phase2 ? STALK_SPEED_P2 : STALK_SPEED_P1;

        if (player && player.active && this.body && scene.physics) {
            scene.physics.moveToObject(this, player, stalkSpeed);
        }

        if (this._nextSummonAt === null) this._nextSummonAt = time + SUMMON_INTERVAL_MS;
        if (this._nextSpreadAt === null) this._nextSpreadAt = time + SPREAD_INTERVAL_MS;
        if (this._nextSweepAt === null) this._nextSweepAt = time + SWEEP_INTERVAL_MS;

        let attacked = false;
        if (!phase2) {
            if (time >= this._nextSummonAt) {
                this._nextSummonAt = time + SUMMON_INTERVAL_MS;
                this._summonZomboids(time);
                attacked = true;
            } else if (time >= this._nextSpreadAt) {
                this._nextSpreadAt = time + SPREAD_INTERVAL_MS;
                this._fireSpread(time);
                attacked = true;
            }
        } else {
            if (time >= this._nextSweepAt) {
                this._nextSweepAt = time + SWEEP_INTERVAL_MS;
                this._edgeSweep(time);
                attacked = true;
            }
        }

        if (!attacked && time >= this._attackAnimUntil && this.anims) {
            this.play('baron-idle', true);
        }
    }

    _arenaEdgeTiles(openTiles) {
        return openTiles.filter((t) => (
            t.tx <= ARENA_EDGE_MARGIN || t.tx >= GRID_W - 1 - ARENA_EDGE_MARGIN ||
            t.ty <= ARENA_EDGE_MARGIN || t.ty >= GRID_H - 1 - ARENA_EDGE_MARGIN
        ));
    }

    _summonZomboids(time) {
        const scene = this.scene;
        if (!scene) return;

        if (this.anims) this.play('baron-attack', true);
        this._attackAnimUntil = time + 400;
        this._summonCount += 1;
        if (this._summonCount % 2 === 0) AudioEngine.sfx('boss_roar');

        const levelData = scene._levelData;
        const openTiles = levelData && levelData.openTiles;
        if (!openTiles || !openTiles.length || !scene.zomboids) return;

        const activeCount = typeof scene.zomboids.getChildren === 'function'
            ? scene.zomboids.getChildren().filter((z) => z.active).length
            : 0;
        const limit = zomboidCapForLevel(scene.currentLevel) + SUMMON_CAP_SLACK;
        if (activeCount >= limit) return;

        const edgeTiles = this._arenaEdgeTiles(openTiles);
        const pool = (edgeTiles.length ? edgeTiles : openTiles).slice();
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }

        const wanted = Phaser.Math.Between(3, 5);
        let spawned = 0;
        for (let i = 0; i < pool.length && spawned < wanted && (activeCount + spawned) < limit; i++) {
            const tile = pool[i];
            const x = tile.tx * TILE + TILE / 2;
            const y = tile.ty * TILE + TILE / 2;
            const z = new Zomboid(scene, x, y, scene.currentLevel);
            scene.zomboids.add(z);
            spawned++;
        }
    }

    _fireSpread(time) {
        const scene = this.scene;
        const player = scene && scene.player;
        if (!scene || !player || !player.active) return;

        if (this.anims) this.play('baron-attack', true);
        this._attackAnimUntil = time + 400;

        const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const spreadRad = Phaser.Math.DegToRad(SPREAD_ANGLE_DEG);
        const offsets = [-spreadRad, 0, spreadRad];
        for (const off of offsets) {
            const angle = baseAngle + off;
            this._fireProjectile(this.x, this.y, Math.cos(angle), Math.sin(angle), SPREAD_SPEED);
        }
    }

    _edgeSweep(time) {
        const scene = this.scene;
        if (!scene) return;

        if (this.anims) this.play('baron-attack', true);
        this._attackAnimUntil = time + 500;
        AudioEngine.sfx('boss_roar');

        const edges = ['top', 'bottom', 'left', 'right'];
        const edge = edges[Phaser.Math.Between(0, edges.length - 1)];

        const positions = [];
        let dir = { x: 0, y: 0 };
        if (edge === 'top' || edge === 'bottom') {
            const y = edge === 'top' ? 0 : GAME_H;
            dir = { x: 0, y: edge === 'top' ? 1 : -1 };
            for (let x = SWEEP_SPACING / 2; x < GAME_W; x += SWEEP_SPACING) positions.push({ x, y });
        } else {
            const x = edge === 'left' ? 0 : GAME_W;
            dir = { x: edge === 'left' ? 1 : -1, y: 0 };
            for (let y = SWEEP_SPACING / 2; y < GAME_H; y += SWEEP_SPACING) positions.push({ x, y });
        }

        for (const pos of positions) {
            this._fireProjectile(pos.x, pos.y, dir.x, dir.y, SWEEP_SPEED);
        }
    }

    _fireProjectile(x, y, dx, dy, speed) {
        const group = this.scene && this.scene.silenceProjectiles;
        if (!group) return;
        const proj = group.get(x, y);
        if (!proj) return;

        if (typeof proj.fire === 'function') {
            proj.fire(x, y, dx, dy, { speed });
        } else {
            // Defensive fallback if the pooled projectile doesn't expose fire().
            if (typeof proj.setActive === 'function') proj.setActive(true);
            if (typeof proj.setVisible === 'function') proj.setVisible(true);
            if (typeof proj.setPosition === 'function') proj.setPosition(x, y);
            if (proj.body) {
                proj.body.enable = true;
                proj.body.setVelocity(dx * speed, dy * speed);
            }
        }
    }

    stun(ms) {
        if (this.dead) return;

        this.stunned = true;
        if (this.anims) this.play('baron-stunned', true);
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

        if (this.anims) this.play('baron-attack', true);
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
                Juice.burst(scene, this.x + ox, this.y + oy, PALETTE.gold, 16);
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
