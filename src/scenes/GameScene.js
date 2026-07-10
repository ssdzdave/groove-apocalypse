// WS-C — see CONTRACTS.md Contract 5.
import { TILE, GRID_W, GRID_H, PALETTE, CHARACTERS, MAX_LEVEL, isBossLevel, vinylsForLevel, EVT, DEPTH } from '../config.js';
import { getZoneForLevel } from '../gfx/ZoneThemes.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { generateLevel } from '../world/LevelGenerator.js';
import { buildWorld, setPortalOpen } from '../world/WorldBuilder.js';
import SilentSheriff from '../entities/SilentSheriff.js';
import { Juice } from '../fx/Juice.js';
import Player from '../entities/Player.js';
import Zomboid from '../entities/Zomboid.js';
import DroneBot from '../entities/DroneBot.js';
import { PlayerProjectile, SilenceProjectile } from '../entities/Projectiles.js';
import { Vinyl, BeerMug, TempoTonic, MysteryTape } from '../entities/Pickups.js';

const ZOMBOID_CAP = 10;
const DRONE_CAP = 4;
const SPAWN_MIN_DIST_TILES = 5;

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create(data) {
        this.charId = (data && data.charId) || CHARACTERS.ELLIOT;
        this.conversions = 0;
        this.boss = null;
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
            E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
        };

        this.physics.world.setBounds(0, 0, GRID_W * TILE, GRID_H * TILE);

        this.playerProjectiles = this.physics.add.group({ classType: PlayerProjectile, maxSize: 40, runChildUpdate: true });
        this.silenceProjectiles = this.physics.add.group({ classType: SilenceProjectile, maxSize: 30, runChildUpdate: true });
        this.zomboids = this.physics.add.group({ runChildUpdate: true });
        this.droneBots = this.physics.add.group({ runChildUpdate: true });
        this.pickups = this.physics.add.group();
        this.vinyls = this.physics.add.group();

        this._vinylsCollected = 0;
        this._vinylsNeeded = 0;

        Juice.addCameraFX(this);

        this._dataListener = (parent, value) => {
            if (value) {
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

        this.events.on('shutdown', this._onShutdown, this);

        this.startLevel(1);

        // UIScene is launched alongside this scene and attaches its listeners a
        // tick after startLevel(1) emitted the initial HUD events — re-emit them.
        this.time.delayedCall(150, () => {
            if (this._gameOverFired) return;
            const zone = this._zone;
            this.game.events.emit(EVT.LEVEL_START, {
                level: this.currentLevel, zoneId: zone.id, zoneName: zone.name, isBoss: isBossLevel(this.currentLevel)
            });
            this.game.events.emit(EVT.VINYLS, this._vinylsCollected, this._vinylsNeeded);
            this.game.events.emit(EVT.PLAYER_HP, this.player.hp, this.player.maxHp);
            if (this.boss && this.boss.active) this.game.events.emit(EVT.BOSS_HP, this.boss.hp, this.boss.maxHp);
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

        if (isBoss) {
            const bx = levelData.bossTile.tx * TILE + TILE / 2;
            const by = levelData.bossTile.ty * TILE + TILE / 2;
            this.boss = new SilentSheriff(this, bx, by);
            this.physics.add.collider(this.boss, world.wallsGroup);
            const bossOverlap = this.physics.add.overlap(this.playerProjectiles, this.boss, (proj, boss) => {
                if (boss.stunned) boss.onSpecialHit();
                else boss.onProjectileHit(proj);
            });
            this._bossOverlaps.push(bossOverlap);
        }

        setPortalOpen(world.portal, false);

        this._startSpawnTimers(n);

        this.game.events.emit(EVT.LEVEL_START, { level: n, zoneId: zone.id, zoneName: zone.name, isBoss });
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
        if (n >= MAX_LEVEL) {
            this.winGame();
        } else {
            this.startLevel(n + 1);
        }
    }

    // ---------------------------------------------------------------- spawning

    _startSpawnTimers(n) {
        const spawnDelay = Math.max(700, 2000 - 150 * n);
        this._zomboidTimer = this.time.addEvent({ delay: spawnDelay, loop: true, callback: () => this._spawnZomboid(n) });
        if (n >= 2) {
            this._droneTimer = this.time.addEvent({ delay: 8000, loop: true, callback: () => this._spawnDrone(n) });
        }
        this._beerTimer = this.time.addEvent({ delay: 9000, loop: true, callback: () => this._spawnPickup(BeerMug, 'beer') });
        this._tonicTimer = this.time.addEvent({ delay: 12000, loop: true, callback: () => this._spawnPickup(TempoTonic, 'tonic') });
        this._tapeTimer = this.time.addEvent({ delay: 20000, loop: true, callback: () => this._spawnPickup(MysteryTape, 'tape') });
    }

    _killLevelTimers() {
        [this._zomboidTimer, this._droneTimer, this._beerTimer, this._tonicTimer, this._tapeTimer].forEach((t) => t && t.remove(false));
        this._zomboidTimer = this._droneTimer = this._beerTimer = this._tonicTimer = this._tapeTimer = null;
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
        const active = this.zomboids.getChildren().filter((z) => z.active && !z.converted).length;
        if (active >= ZOMBOID_CAP) return;
        const tile = this._pickSpawnTile();
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        this.zomboids.add(new Zomboid(this, x, y, n));
    }

    _spawnDrone(n) {
        const active = this.droneBots.getChildren().filter((d) => d.active).length;
        if (active >= DRONE_CAP) return;
        const tile = this._pickSpawnTile();
        if (!tile) return;
        const x = tile.tx * TILE + TILE / 2, y = tile.ty * TILE + TILE / 2;
        this.droneBots.add(new DroneBot(this, x, y, n));
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
        this.physics.add.overlap(this.player, this.silenceProjectiles, (player, proj) => this._silenceHit(proj));
        this.physics.add.overlap(this.playerProjectiles, this.zomboids, (proj, z) => this._projectileHitZomboid(proj, z));
        this.physics.add.overlap(this.playerProjectiles, this.droneBots, (proj, d) => this._projectileHitDrone(proj, d));
    }

    _collectVinyl(vinyl) {
        if (!vinyl.active) return;
        const x = vinyl.x, y = vinyl.y;
        vinyl.destroy();
        this._vinylsCollected++;
        this.game.events.emit(EVT.VINYLS, this._vinylsCollected, this._vinylsNeeded);
        AudioEngine.sfx('pickup_vinyl');
        Juice.floatText(this, x, y, '+♪', PALETTE.gold);
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

    _silenceHit(proj) {
        if (!proj.active) return;
        proj.deactivate();
        this.player.damage(1);
    }

    _projectileHitZomboid(proj, z) {
        if (!proj.active || !z.active || z.converted) return;
        z.convert();
        if (!proj.piercing) proj.deactivate();
    }

    _projectileHitDrone(proj, d) {
        if (!proj.active || !d.active) return;
        d.hit();
        if (!proj.piercing) proj.deactivate();
    }

    // ---------------------------------------------------------------- shared entity API

    stunAllEnemies(ms) {
        this.zomboids.getChildren().forEach((z) => z.active && typeof z.stun === 'function' && z.stun(ms));
        this.droneBots.getChildren().forEach((d) => d.active && typeof d.stun === 'function' && d.stun(ms));
        if (this.boss && this.boss.active) this.boss.stun(ms);
    }

    // ---------------------------------------------------------------- end states

    onPlayerDeath() {
        if (this._gameOverFired) return;
        this._gameOverFired = true;
        AudioEngine.sfx('gameover');
        AudioEngine.stopMusic();
        this.game.events.emit(EVT.GAME_OVER, { won: false, level: this.currentLevel, conversions: this.conversions, charId: this.charId });
        this.scene.pause();
    }

    winGame() {
        if (this._gameOverFired) return;
        this._gameOverFired = true;
        AudioEngine.sfx('win');
        AudioEngine.startMusic('win');
        this.game.events.emit(EVT.GAME_OVER, { won: true, level: MAX_LEVEL, conversions: this.conversions, charId: this.charId });
        this.scene.pause();
    }

    // ---------------------------------------------------------------- update loop

    update(time, delta) {
        if (!this.player || !this.player.active || this._gameOverFired) return;

        this.player.update(time, delta);

        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.player.shoot();
        if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.player.special();

        if (this.boss && this.boss.active) this.boss.update(time, delta);

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
            y: this.player ? Math.round(this.player.y) : 0
        };
    }

    debugTeleport(tx, ty) {
        if (!this.player) return;
        this.player.setPosition(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
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
    }
}
