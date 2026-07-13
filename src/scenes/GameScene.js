// WS-C — see CONTRACTS.md Contract 5 + PHASE 3 CONTRACTS P3-C.
import {
    TILE, GRID_W, GRID_H, PALETTE, CHARACTERS, MAX_LEVEL, isBossLevel, vinylsForLevel, EVT, DEPTH,
    BOSS_IDS, bossForLevel, BOSS_NAMES
} from '../config.js';
import { getZoneForLevel } from '../gfx/ZoneThemes.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { generateLevel } from '../world/LevelGenerator.js';
import { buildWorld, setPortalOpen } from '../world/WorldBuilder.js';
import SilentSheriff from '../entities/SilentSheriff.js';
import FeedbackBaron from '../entities/FeedbackBaron.js';
import { Juice } from '../fx/Juice.js';
import Player from '../entities/Player.js';
import Zomboid from '../entities/Zomboid.js';
import DroneBot from '../entities/DroneBot.js';
import AmpGolem from '../entities/AmpGolem.js';
import FeedbackPhantom from '../entities/FeedbackPhantom.js';
import { PlayerProjectile, SilenceProjectile } from '../entities/Projectiles.js';
import { Vinyl, BeerMug, TempoTonic, MysteryTape } from '../entities/Pickups.js';
import { SilencePool } from '../world/SilencePool.js';
import ScoreSystem from '../systems/ScoreSystem.js';

const SPAWN_MIN_DIST_TILES = 5;
const GOLEM_CAP = 2, GOLEM_CAP_ENDLESS = 3, GOLEM_SPAWN_DELAY_MS = 10000;
const PHANTOM_CAP = 2, PHANTOM_CAP_ENDLESS = 3, PHANTOM_SPAWN_DELAY_MS = 12000;
const ONBEAT_AOE_RADIUS = 48;
const GAMEPAD_DEADZONE = 0.25;

function zomboidCapForLevel(n) { return Math.min(16, 10 + Math.floor(Math.max(0, n - 6) / 2)); }
function droneCapForLevel(n) { return Math.min(7, 4 + Math.floor(Math.max(0, n - 6) / 3)); }
function eliteChanceForLevel(n) { return n < 3 ? 0 : Math.min(0.35, 0.06 * (n - 2)); }

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create(data) {
        this.charId = (data && data.charId) || CHARACTERS.ELLIOT;
        this.endless = !!(data && data.endless);
        this.conversions = (data && data.carry && typeof data.carry.conversions === 'number') ? data.carry.conversions : 0;
        this.boss = null;
        this._currentBossName = null;
        // Phaser reuses the scene instance across runs — clear stale refs
        this.player = null;
        this._levelColliders = [];
        this._world = null;
        this.currentLevel = 0;
        this._gameOverFired = false;
        this._portalEntering = false;
        this._levelData = null;
        this._zone = null;
        this._world = null;
        this._bossOverlaps = [];
        this._portalOverlap = null;
        this.score = null;
        this._beatListener = null;
        this._prevPadSpecial = false;
        this._prevPadStart = false;
        this.debug = { invincible: false, speed: 1, goldenEar: false };
        this._applyDebugSpeed(1);

        this.keys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            esc: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
            P: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
            backtick: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK)
        };

        this.physics.world.setBounds(0, 0, GRID_W * TILE, GRID_H * TILE);

        this.playerProjectiles = this.physics.add.group({ classType: PlayerProjectile, maxSize: 40, runChildUpdate: true });
        this.silenceProjectiles = this.physics.add.group({ classType: SilenceProjectile, maxSize: 30, runChildUpdate: true });
        this.zomboids = this.physics.add.group({ runChildUpdate: true });
        this.droneBots = this.physics.add.group({ runChildUpdate: true });
        this.golems = this.physics.add.group({ runChildUpdate: true });
        this.phantoms = this.physics.add.group({ runChildUpdate: true });
        this.silencePools = this.physics.add.staticGroup();
        this.pickups = this.physics.add.group();
        this.vinyls = this.physics.add.group();

        this._vinylsCollected = 0;
        this._vinylsNeeded = 0;

        Juice.addCameraFX(this);

        this.score = new ScoreSystem(this, (data && data.carry) || null);

        this._dataListener = (parent, value) => {
            if (value) {
                const bx = this.boss ? this.boss.x : (this._world && this._world.portal ? this._world.portal.x : 0);
                const by = this.boss ? this.boss.y : (this._world && this._world.portal ? this._world.portal.y : 0);
                if (this.score) this.score.onBossDefeated(bx, by);
                this.boss = null;
                this._openPortal();
                this._updateIntensity();
            }
        };
        this.data.events.on('changedata-bossDefeated', this._dataListener, this);

        this._debugTimer = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => this._logDebugState()
        });

        this._beatListener = () => this._pulseOnBeat();
        this.game.events.on(EVT.BEAT, this._beatListener);

        this.events.on('shutdown', this._onShutdown, this);

        const startLvl = (data && data.startLevel) || 1;
        this.startLevel(startLvl);

        // UIScene is launched alongside this scene and attaches its listeners a
        // tick after startLevel() emitted the initial HUD events — re-emit them.
        this.time.delayedCall(150, () => {
            if (this._gameOverFired) return;
            const zone = this._zone;
            const isBoss = isBossLevel(this.currentLevel);
            this.game.events.emit(EVT.LEVEL_START, Object.assign(
                { level: this.currentLevel, zoneId: zone.id, zoneName: zone.name, isBoss },
                isBoss ? { bossName: this._currentBossName } : {}
            ));
            this.game.events.emit(EVT.VINYLS, this._vinylsCollected, this._vinylsNeeded);
            this.game.events.emit(EVT.PLAYER_HP, this.player.hp, this.player.maxHp);
            if (this.boss && this.boss.active) this.game.events.emit(EVT.BOSS_HP, this.boss.hp, this.boss.maxHp);
            // Endless carry: sync the HUD score readout without an award
            if (this.score && this.score.score > 0) {
                this.game.events.emit(EVT.SCORE, {
                    score: this.score.score, delta: 0, combo: 0, comboMult: 1,
                    reason: 'carry', x: 0, y: 0, onBeat: false
                });
            }
        });
    }

    // ---------------------------------------------------------------- level flow

    startLevel(n) {
        const isBoss = isBossLevel(n);

        // teardown previous level state
        (this._levelColliders || []).forEach((c) => c.destroy());
        this._levelColliders = [];
        if (this._portalOverlap) { this._portalOverlap.destroy(); this._portalOverlap = null; }
        this._bossOverlaps.forEach((c) => c.destroy());
        this._bossOverlaps = [];
        if (this.boss) { this.boss.destroy(); this.boss = null; }

        if (this._world) {
            if (this._world.wallsGroup) this._world.wallsGroup.destroy(true);
            if (this._world.portal) this._world.portal.destroy();
            const decor = this._world.decorLayer;
            if (decor) {
                if (typeof decor.destroy === 'function') decor.destroy(true);
                else if (Array.isArray(decor)) decor.forEach((o) => o.destroy && o.destroy());
            }
            this._world = null;
        }

        this._clearGroup(this.zomboids);
        this._clearGroup(this.droneBots);
        this._clearGroup(this.golems);
        this._clearGroup(this.phantoms);
        this._clearGroup(this.silencePools);
        this._clearGroup(this.pickups);
        this._clearGroup(this.vinyls);
        this._deactivateAll(this.playerProjectiles);
        this._deactivateAll(this.silenceProjectiles);

        this._killLevelTimers();

        this.currentLevel = n;
        const levelData = generateLevel({ level: n, isBoss });
        const zone = getZoneForLevel(n);
        this._levelData = levelData;
        this._zone = zone;

        const world = buildWorld(this, levelData, zone);
        this._world = world;

        const spawnX = levelData.spawn.tx * TILE + TILE / 2;
        const spawnY = levelData.spawn.ty * TILE + TILE / 2;

        if (!this.player) {
            this.player = new Player(this, spawnX, spawnY, this.charId);
            this._wireCollisions();
        } else {
            this.player.setPosition(spawnX, spawnY);
            this.player.setVelocity(0, 0);
        }

        this._levelColliders.push(
            this.physics.add.collider(this.player, world.wallsGroup),
            this.physics.add.collider(this.zomboids, world.wallsGroup),
            this.physics.add.collider(this.droneBots, world.wallsGroup),
            this.physics.add.collider(this.golems, world.wallsGroup),
            this.physics.add.collider(this.phantoms, world.wallsGroup),
            this.physics.add.collider(this.playerProjectiles, world.wallsGroup, (p) => p.deactivate()),
            this.physics.add.collider(this.silenceProjectiles, world.wallsGroup, (p) => p.deactivate())
        );

        this._portalOverlap = this.physics.add.overlap(this.player, world.portal, () => {
            if (world.portal.getData('open')) this._enterPortal();
        });

        this._vinylsCollected = 0;
        this._vinylsNeeded = vinylsForLevel(n);

        (levelData.vinylTiles || []).forEach((t) => {
            const vx = t.tx * TILE + TILE / 2;
            const vy = t.ty * TILE + TILE / 2;
            this.vinyls.add(Vinyl.spawn(this, vx, vy));
        });

        this.data.set('bossDefeated', false);

        let bossId = null;
        if (isBoss) {
            bossId = bossForLevel(n);
            const bx = levelData.bossTile.tx * TILE + TILE / 2;
            const by = levelData.bossTile.ty * TILE + TILE / 2;
            const BossClass = bossId === BOSS_IDS.BARON ? FeedbackBaron : SilentSheriff;
            this.boss = new BossClass(this, bx, by);
            this.physics.add.collider(this.boss, world.wallsGroup);
            const bossOverlap = this.physics.add.overlap(this.playerProjectiles, this.boss, (proj, boss) => {
                if (boss.stunned) boss.onSpecialHit();
                else boss.onProjectileHit(proj);
            });
            this._bossOverlaps.push(bossOverlap);
        }
        this._currentBossName = isBoss ? BOSS_NAMES[bossId] : null;

        // Silence pools: non-boss L5+ scaling count, or 2 fixed in Baron arenas.
        let poolCount = 0;
        if (isBoss) {
            if (bossId === BOSS_IDS.BARON) poolCount = 2;
        } else if (n >= 5) {
            poolCount = Math.min(1 + Math.floor((n - 5) / 2), 4);
        }
        if (poolCount > 0 && typeof SilencePool.placePools === 'function') {
            SilencePool.placePools(this, levelData, poolCount);
        }

        setPortalOpen(world.portal, false);

        this._startSpawnTimers(n);

        this.game.events.emit(EVT.LEVEL_START, Object.assign(
            { level: n, zoneId: zone.id, zoneName: zone.name, isBoss },
            isBoss ? { bossName: this._currentBossName } : {}
        ));
        this.game.events.emit(EVT.VINYLS, this._vinylsCollected, this._vinylsNeeded);
        this.game.events.emit(EVT.PLAYER_HP, this.player.hp, this.player.maxHp);
        if (!isBoss) this.game.events.emit(EVT.BOSS_HP, null, null);

        AudioEngine.startMusic(zone.musicMood);
        this._updateIntensity();
        this._portalEntering = false;
    }

    _openPortal() {
        if (!this._world || !this._world.portal) return;
        setPortalOpen(this._world.portal, true);
    }

    _enterPortal() {
        if (this._portalEntering || this._gameOverFired) return;
        this._portalEntering = true;
        AudioEngine.sfx('levelup');
        const n = this.currentLevel;
        if (this.score) this.score.onLevelClear(n);
        // D5: endless mode never wins via the portal — levels just keep counting up.
        if (!this.endless && n >= MAX_LEVEL) {
            this.winGame();
        } else {
            this.startLevel(n + 1);
        }
    }

    // ---------------------------------------------------------------- spawning

    _startSpawnTimers(n) {
        const spawnDelay = Math.max(450, 2000 - 150 * n);
        this._zomboidTimer = this.time.addEvent({ delay: spawnDelay, loop: true, callback: () => this._spawnZomboid(n) });
        if (n >= 2) {
            this._droneTimer = this.time.addEvent({ delay: 8000, loop: true, callback: () => this._spawnDrone(n) });
        }
        if (n >= 4) {
            this._golemTimer = this.time.addEvent({ delay: GOLEM_SPAWN_DELAY_MS, loop: true, callback: () => this._spawnGolem(n) });
        }
        if (n >= 5) {
            this._phantomTimer = this.time.addEvent({ delay: PHANTOM_SPAWN_DELAY_MS, loop: true, callback: () => this._spawnPhantom(n) });
        }
        this._beerTimer = this.time.addEvent({ delay: 9000, loop: true, callback: () => this._spawnPickup(BeerMug, 'beer') });
        this._tonicTimer = this.time.addEvent({ delay: 12000, loop: true, callback: () => this._spawnPickup(TempoTonic, 'tonic') });
        this._tapeTimer = this.time.addEvent({ delay: 20000, loop: true, callback: () => this._spawnPickup(MysteryTape, 'tape') });
    }

    _killLevelTimers() {
        [this._zomboidTimer, this._droneTimer, this._golemTimer, this._phantomTimer, this._beerTimer, this._tonicTimer, this._tapeTimer]
            .forEach((t) => t && t.remove(false));
        this._zomboidTimer = this._droneTimer = this._golemTimer = this._phantomTimer = this._beerTimer = this._tonicTimer = this._tapeTimer = null;
    }

    _pickSpawnTile() {
        const levelData = this._levelData;
        if (!levelData || !this.player) return null;
        const ptx = Math.floor(this.player.x / TILE);
        const pty = Math.floor(this.player.y / TILE);
        const candidates = levelData.openTiles.filter((t) => {
            const dx = t.tx - ptx, dy = t.ty - pty;
            return Math.sqrt(dx * dx + dy * dy) >= SPAWN_MIN_DIST_TILES;
        });
        if (candidates.length === 0) return null;
        return Phaser.Utils.Array.GetRandom(candidates);
    }

    _spawnZomboid(n) {
        const cap = zomboidCapForLevel(n);
        const active = this.zomboids.getChildren().filter((z) => z.active && !z.converted).length;
        if (active >= cap) return;
        const tile = this._pickSpawnTile();
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        const elite = Math.random() < eliteChanceForLevel(n);
        this.zomboids.add(new Zomboid(this, x, y, n, { elite }));
    }

    _spawnDrone(n) {
        const cap = droneCapForLevel(n);
        const active = this.droneBots.getChildren().filter((d) => d.active).length;
        if (active >= cap) return;
        const tile = this._pickSpawnTile();
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        this.droneBots.add(new DroneBot(this, x, y, n));
    }

    _spawnGolem(n) {
        const cap = this.endless ? GOLEM_CAP_ENDLESS : GOLEM_CAP;
        const active = this.golems.getChildren().filter((g) => g.active).length;
        if (active >= cap) return;
        const tile = this._pickSpawnTile();
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        this.golems.add(new AmpGolem(this, x, y, n));
    }

    _spawnPhantom(n) {
        const cap = this.endless ? PHANTOM_CAP_ENDLESS : PHANTOM_CAP;
        const active = this.phantoms.getChildren().filter((p) => p.active).length;
        if (active >= cap) return;
        const tile = this._pickSpawnTile();
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        this.phantoms.add(new FeedbackPhantom(this, x, y, n));
    }

    _spawnPickup(Cls, type) {
        const cap = 1;
        const count = this.pickups.getChildren().filter((p) => p.active && p.pickupType === type).length;
        if (count >= cap) return;
        const levelData = this._levelData;
        if (!levelData) return;
        const tile = this._pickSpawnTile() || Phaser.Utils.Array.GetRandom(levelData.openTiles);
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        this.pickups.add(Cls.spawn(this, x, y));
    }

    // ---------------------------------------------------------------- collisions

    _wireCollisions() {
        this.physics.add.overlap(this.player, this.vinyls, (player, vinyl) => this._collectVinyl(vinyl));
        this.physics.add.overlap(this.player, this.pickups, (player, pickup) => this._collectPickup(pickup));
        this.physics.add.overlap(this.player, this.zomboids, (player, z) => this._zomboidContact(z));
        this.physics.add.overlap(this.player, this.golems, (player, g) => this._golemContact(g));
        this.physics.add.overlap(this.player, this.silenceProjectiles, (player, proj) => this._silenceHit(proj));
        this.physics.add.overlap(this.playerProjectiles, this.zomboids, (proj, z) => this._projectileHitZomboid(proj, z));
        this.physics.add.overlap(this.playerProjectiles, this.droneBots, (proj, d) => this._projectileHitDrone(proj, d));
        this.physics.add.overlap(this.playerProjectiles, this.golems, (proj, g) => this._projectileHitGolem(proj, g));
        this.physics.add.overlap(this.playerProjectiles, this.phantoms, (proj, p) => this._projectileHitPhantom(proj, p));
    }

    _collectVinyl(vinyl) {
        if (!vinyl.active) return;
        const x = vinyl.x, y = vinyl.y;
        vinyl.destroy();
        this._vinylsCollected++;
        this.game.events.emit(EVT.VINYLS, this._vinylsCollected, this._vinylsNeeded);
        AudioEngine.sfx('pickup_vinyl');
        Juice.floatText(this, x, y, '+♪', PALETTE.gold);
        if (this.score) this.score.onVinyl(x, y);
    }

    _collectPickup(pickup) {
        if (!pickup.active) return;
        const type = pickup.pickupType;
        const x = pickup.x, y = pickup.y;
        pickup.destroy();
        AudioEngine.sfx('pickup_powerup');
        if (type === 'beer') {
            this.player.heal(1);
            Juice.burst(this, x, y, PALETTE.gold);
        } else if (type === 'tonic') {
            this.player.applyTonic(5000);
            Juice.burst(this, x, y, PALETTE.cyan);
        } else if (type === 'tape') {
            this.player.applyInvincible(5000);
            Juice.burst(this, x, y, PALETTE.magenta);
        }
    }

    _zomboidContact(z) {
        if (!z.active || z.converted) return;
        this.player.damage(1);
        const angle = Phaser.Math.Angle.Between(z.x, z.y, this.player.x, this.player.y);
        this.player.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
    }

    // Ambiguity resolution: P3-D doesn't spell out a golem attack; treated like a
    // heavier zomboid (chases + contact-damages) since it has no other means to hurt the player.
    _golemContact(g) {
        if (!g.active) return;
        this.player.damage(1);
        const angle = Phaser.Math.Angle.Between(g.x, g.y, this.player.x, this.player.y);
        this.player.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
    }

    _silenceHit(proj) {
        if (!proj.active) return;
        proj.deactivate();
        this.player.damage(1);
    }

    _projectileHitZomboid(proj, z) {
        if (!proj.active || !z.active || z.converted) return;
        const onBeat = !!proj.onBeat;
        const ix = z.x, iy = z.y;
        z.convert({ onBeat });
        // D1/P3-C: on-beat impact conversion mini-AoE — convert other nearby zomboids too.
        if (onBeat) {
            this.zomboids.getChildren().forEach((other) => {
                if (other === z || !other.active || other.converted) return;
                const d = Phaser.Math.Distance.Between(ix, iy, other.x, other.y);
                if (d <= ONBEAT_AOE_RADIUS) other.convert({ onBeat: true });
            });
        }
        if (!proj.piercing) proj.deactivate();
    }

    _projectileHitDrone(proj, d) {
        if (!proj.active || !d.active) return;
        const onBeat = !!proj.onBeat;
        const x = d.x, y = d.y;
        d.hit();
        if (this.score) this.score.onKill(x, y, { kind: 'drone', onBeat });
        if (!proj.piercing) proj.deactivate();
    }

    // WS-D's AmpGolem.hit(proj) reads proj.onBeat itself (2 dmg on-beat) and owns its
    // own score.onConversion call on death — we just forward the projectile.
    _projectileHitGolem(proj, g) {
        if (!proj.active || !g.active) return;
        if (typeof g.hit === 'function') g.hit(proj);
        if (!proj.piercing) proj.deactivate();
    }

    // Ambiguity resolution: while phased the phantom is immune — the projectile passes
    // through untouched (no deactivate) rather than being consumed for no effect.
    _projectileHitPhantom(proj, p) {
        if (!proj.active || !p.active || p.phased) return;
        if (typeof p.convert === 'function') p.convert({ onBeat: !!proj.onBeat });
        if (!proj.piercing) proj.deactivate();
    }

    // ---------------------------------------------------------------- shared entity API

    stunAllEnemies(ms) {
        this.zomboids.getChildren().forEach((z) => z.active && typeof z.stun === 'function' && z.stun(ms));
        this.droneBots.getChildren().forEach((d) => d.active && typeof d.stun === 'function' && d.stun(ms));
        this.golems.getChildren().forEach((g) => g.active && typeof g.stun === 'function' && g.stun(ms));
        this.phantoms.getChildren().forEach((p) => p.active && typeof p.stun === 'function' && p.stun(ms));
        if (this.boss && this.boss.active) this.boss.stun(ms);
    }

    // ---------------------------------------------------------------- end states

    onPlayerDeath() {
        if (this._gameOverFired) return;
        this._gameOverFired = true;
        AudioEngine.sfx('gameover');
        AudioEngine.stopMusic();
        this.game.events.emit(EVT.GAME_OVER, {
            won: false, level: this.currentLevel, conversions: this.conversions, charId: this.charId,
            score: this.score ? this.score.score : 0,
            maxCombo: this.score ? this.score.maxCombo : 0,
            endless: this.endless,
            canContinue: false // won && !this.endless, won is always false here
        });
        this.scene.pause();
    }

    winGame() {
        if (this._gameOverFired) return;
        this._gameOverFired = true;
        AudioEngine.sfx('win');
        AudioEngine.startMusic('win');
        this.game.events.emit(EVT.GAME_OVER, {
            won: true, level: this.currentLevel, conversions: this.conversions, charId: this.charId,
            score: this.score ? this.score.score : 0,
            maxCombo: this.score ? this.score.maxCombo : 0,
            endless: this.endless,
            canContinue: !this.endless // won (true) && !this.endless
        });
        this.scene.pause();
    }

    // ---------------------------------------------------------------- update loop

    getMoveVector() {
        const keys = this.keys;
        let dx = 0, dy = 0;
        if (keys) {
            if ((keys.left && keys.left.isDown) || (keys.A && keys.A.isDown)) dx -= 1;
            if ((keys.right && keys.right.isDown) || (keys.D && keys.D.isDown)) dx += 1;
            if ((keys.up && keys.up.isDown) || (keys.W && keys.W.isDown)) dy -= 1;
            if ((keys.down && keys.down.isDown) || (keys.S && keys.S.isDown)) dy += 1;
        }
        if (dx === 0 && dy === 0) {
            const pad = this._getPad();
            if (pad) {
                let px = pad.leftStick ? pad.leftStick.x : 0;
                let py = pad.leftStick ? pad.leftStick.y : 0;
                if (Math.abs(px) < GAMEPAD_DEADZONE) px = 0;
                if (Math.abs(py) < GAMEPAD_DEADZONE) py = 0;
                if (px !== 0 || py !== 0) {
                    dx = px; dy = py;
                } else {
                    if (pad.left) dx -= 1;
                    if (pad.right) dx += 1;
                    if (pad.up) dy -= 1;
                    if (pad.down) dy += 1;
                }
            }
        }
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        return { x: dx, y: dy };
    }

    _getPad() {
        if (!this.input.gamepad) return undefined;
        return this.input.gamepad.getPad(0);
    }

    _tryPause() {
        if (this._gameOverFired) return false;
        if (this.scene.isActive('PauseScene')) return false;
        this.scene.launch('PauseScene');
        this.scene.pause();
        AudioEngine.setDucked(true);
        AudioEngine.sfx('pause');
        return true;
    }

    update(time, delta) {
        if (!this.player || !this.player.active || this._gameOverFired) return;

        this.player.update(time, delta);

        const pad = this._getPad();
        const padShoot = !!(pad && ((pad.buttons[0] && pad.buttons[0].pressed) || (pad.buttons[2] && pad.buttons[2].pressed)));
        const padSpecial = !!(pad && ((pad.buttons[1] && pad.buttons[1].pressed) || (pad.buttons[7] && pad.buttons[7].pressed)));
        const padStart = !!(pad && pad.buttons[9] && pad.buttons[9].pressed);

        if (Phaser.Input.Keyboard.JustDown(this.keys.space) || padShoot) this.player.shoot();
        if (Phaser.Input.Keyboard.JustDown(this.keys.E) || (padSpecial && !this._prevPadSpecial)) this.player.special();
        this._prevPadSpecial = padSpecial;

        if (Phaser.Input.Keyboard.JustDown(this.keys.esc) || Phaser.Input.Keyboard.JustDown(this.keys.P) || (padStart && !this._prevPadStart)) {
            this._prevPadStart = padStart;
            if (this._tryPause()) return;
        } else {
            this._prevPadStart = padStart;
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.backtick)) this._toggleDebugPanel();

        if (this.boss && this.boss.active) this.boss.update(time, delta);

        if (this.player && this.silencePools) {
            this.player.setSilenced(this.physics.overlap(this.player, this.silencePools));
        }

        if (!isBossLevel(this.currentLevel) && this._world && this._world.portal) {
            if (!this._world.portal.getData('open') && this._vinylsCollected >= this._vinylsNeeded) {
                this._openPortal();
            }
        }
    }

    // ---------------------------------------------------------------- helpers

    _clearGroup(group) {
        group.clear(true, true);
    }

    _deactivateAll(group) {
        group.getChildren().forEach((c) => {
            if (typeof c.deactivate === 'function') c.deactivate();
            else { c.setActive(false); c.setVisible(false); }
        });
    }

    _updateIntensity() {
        let t;
        if (this.boss && this.boss.active) t = 0.9;
        else if (this.player && this.player.hp === 1) t = 0.8;
        else t = 0.4 + 0.1 * this.currentLevel;
        AudioEngine.setIntensity(Math.min(1, Math.max(0, t)));
    }

    // ---------------------------------------------------------------- beat visuals

    // 120ms scale pulse (1.0 -> 1.06 -> 1.0) on active zomboids/golems/portal. Cheap
    // manual tween — kills any in-flight pulse tween first so rapid beats don't compound scale.
    _pulseOnBeat() {
        const pulse = (obj) => {
            if (!obj || !obj.active) return;
            const base = obj._beatBaseScale != null ? obj._beatBaseScale : obj.scale;
            obj._beatBaseScale = base;
            if (obj._beatPulseTween) { obj._beatPulseTween.remove(); obj._beatPulseTween = null; }
            obj.setScale(base);
            obj._beatPulseTween = this.tweens.add({
                targets: obj,
                scale: base * 1.06,
                duration: 60,
                yoyo: true,
                ease: 'Sine.easeInOut',
                onComplete: () => { if (obj.active) obj.setScale(base); obj._beatPulseTween = null; }
            });
        };
        this.zomboids.getChildren().forEach(pulse);
        this.golems.getChildren().forEach(pulse);
        if (this._world && this._world.portal) pulse(this._world.portal);
    }

    // ---------------------------------------------------------------- debug API (pinned)

    getDebugState() {
        return {
            level: this.currentLevel,
            hp: this.player ? this.player.hp : 0,
            vinyls: this._vinylsCollected,
            vinylsNeeded: this._vinylsNeeded,
            enemies: this.zomboids.getChildren().filter((z) => z.active).length + this.droneBots.getChildren().filter((d) => d.active).length,
            bossHp: this.boss && this.boss.active ? this.boss.hp : null,
            charId: this.charId,
            x: this.player ? Math.round(this.player.x) : 0,
            y: this.player ? Math.round(this.player.y) : 0,
            score: this.score ? this.score.score : 0,
            combo: this.score ? this.score.combo : 0,
            endless: this.endless,
            paused: this.scene.isPaused(),
            debug: { invincible: this.debug.invincible, speed: this.debug.speed, goldenEar: this.debug.goldenEar }
        };
    }

    // ------------------------------------------------------- debug mode (backtick)

    _toggleDebugPanel() {
        if (this.scene.isActive('DebugScene')) this.scene.stop('DebugScene');
        else this.scene.launch('DebugScene');
    }

    debugToggleInvincible() {
        this.debug.invincible = !this.debug.invincible;
        if (this.player) {
            this.player.debugInvincible = this.debug.invincible;
            this.player.setAlpha(this.debug.invincible ? 0.8 : 1);
        }
        return this.debug.invincible;
    }

    debugToggleGoldenEar() {
        this.debug.goldenEar = !this.debug.goldenEar;
        return this.debug.goldenEar;
    }

    // Cycle x1 -> x2 -> x4 -> x0.5 -> x1. Arcade world.timeScale is INVERSE
    // (0.5 = double speed); Clock/anims timeScale are direct.
    debugCycleSpeed() {
        const order = [1, 2, 4, 0.5];
        const next = order[(order.indexOf(this.debug.speed) + 1) % order.length];
        this._applyDebugSpeed(next);
        return next;
    }

    _applyDebugSpeed(mult) {
        this.debug.speed = mult;
        this.time.timeScale = mult;
        this.tweens.timeScale = mult;
        this.anims.globalTimeScale = mult;
        if (this.physics && this.physics.world) this.physics.world.timeScale = 1 / mult;
    }

    debugHeal() {
        if (this.player) this.player.heal(this.player.maxHp);
    }

    debugKillAll() {
        this.zomboids.getChildren().forEach((z) => { if (z.active && !z.converted) z.convert(); });
        this.golems.getChildren().forEach((g) => { if (g.active && !g.converted) g.convert(); });
        this.phantoms.getChildren().forEach((p) => { if (p.active && !p.converted) { p.phased = false; p.convert(); } });
        this.droneBots.getChildren().forEach((d) => {
            if (!d.active) return;
            if (typeof d.hit === 'function') d.hit(); else d.destroy();
        });
        if (this.boss && this.boss.active) this.boss.onSpecialHit();
    }

    debugGotoLevel(n) {
        if (n < 1) return;
        this._applyDebugSpeed(this.debug.speed); // keep speed across level swap
        this.startLevel(n);
        if (this.player && this.debug.invincible) this.player.debugInvincible = true;
    }

    debugTeleport(tx, ty) {
        if (!this.player) return;
        this.player.setPosition(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
    }

    // Opens the portal and teleports the player onto it — quick way to skip a level.
    debugSkipLevel() {
        if (!this._world || !this._world.portal || !this.player) return;
        setPortalOpen(this._world.portal, true);
        this.player.setPosition(this._world.portal.x, this._world.portal.y);
    }

    _logDebugState() {
        if (this._gameOverFired) return;
        console.log('GAME_STATE:' + JSON.stringify(this.getDebugState()));
        this._updateIntensity();
    }

    // ---------------------------------------------------------------- cleanup

    _onShutdown() {
        this._killLevelTimers();
        if (this._debugTimer) { this._debugTimer.remove(false); this._debugTimer = null; }
        if (this._portalOverlap) { this._portalOverlap.destroy(); this._portalOverlap = null; }
        this._bossOverlaps.forEach((c) => c.destroy());
        this._bossOverlaps = [];
        if (this._dataListener) {
            this.data.events.off('changedata-bossDefeated', this._dataListener, this);
            this._dataListener = null;
        }
        // game.events outlives the scene — must be removed explicitly.
        if (this._beatListener) {
            this.game.events.off(EVT.BEAT, this._beatListener);
            this._beatListener = null;
        }
        if (this.score) {
            this.score.destroy();
            this.score = null;
        }
        // Debug speed must not leak into the menu (anims.globalTimeScale is global)
        this._applyDebugSpeed(1);
        if (this.scene.isActive('DebugScene')) this.scene.stop('DebugScene');
    }
}
