// WS-D (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-D.
import { TILE, DEPTH } from '../config.js';

const RADIUS = 26;
const FRAME_SIZE = 48;
const SPAWN_MIN_TILES = 4;
const EXIT_MIN_TILES = 3;
const POOL_MIN_TILES = 3;

function manhattanTiles(a, b) {
    return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}

export class SilencePool extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'silence_pool');
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // static body

        if (this.body) {
            const offset = FRAME_SIZE / 2 - RADIUS;
            this.body.setCircle(RADIUS, offset, offset);
        }

        this.setDepth(DEPTH.hazard);

        if (scene.anims && scene.anims.exists('pool-shimmer')) {
            this.play('pool-shimmer');
        }

        if (scene.tweens) {
            scene.tweens.add({
                targets: this,
                alpha: { from: 0.75, to: 1 },
                duration: 1400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }
}

// -> SilencePool[]; picks from a shuffled copy of levelData.openTiles, enforcing
// minimum manhattan-tile distances from spawn/exit/bossTile and from each other.
// Bounded by openTiles.length — no rejection-sampling / unbounded loops.
SilencePool.placePools = function (scene, levelData, count) {
    const pools = [];
    if (!scene || !levelData || !Array.isArray(levelData.openTiles) || !count || count <= 0) {
        return pools;
    }

    const shuffled = levelData.openTiles.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
    }

    const spawn = levelData.spawn;
    const exit = levelData.exit;
    const bossTile = levelData.bossTile;
    const placedTiles = [];

    for (let i = 0; i < shuffled.length && pools.length < count; i++) {
        const tile = shuffled[i];

        if (spawn && manhattanTiles(tile, spawn) < SPAWN_MIN_TILES) continue;
        if (exit && manhattanTiles(tile, exit) < EXIT_MIN_TILES) continue;
        if (bossTile && manhattanTiles(tile, bossTile) < EXIT_MIN_TILES) continue;

        let tooClose = false;
        for (let p = 0; p < placedTiles.length; p++) {
            if (manhattanTiles(tile, placedTiles[p]) < POOL_MIN_TILES) { tooClose = true; break; }
        }
        if (tooClose) continue;

        const x = tile.tx * TILE + TILE / 2;
        const y = tile.ty * TILE + TILE / 2;
        const pool = new SilencePool(scene, x, y);

        if (scene.silencePools && typeof scene.silencePools.add === 'function') {
            scene.silencePools.add(pool);
        }

        pools.push(pool);
        placedTiles.push(tile);
    }

    return pools;
};
