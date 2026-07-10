// Shared constants — FROZEN after workstream fan-out. Do not edit.

export const TILE = 32;
export const GRID_W = 25;
export const GRID_H = 18; // 25x18 tiles = 800x576 world; 24px bottom strip belongs to the HUD
export const GAME_W = 800;
export const GAME_H = 600;

export const PALETTE = {
    orange: 0xff8a3c,
    magenta: 0xff3cbe,
    cyan: 0x3cf0ff,
    purple: 0x8c3cff,
    deepPurple: 0x2a1045,
    sand: 0xd9a066,
    gray: 0x8a8a94,
    gold: 0xffd23c,
    bgTop: 0x1a0a2e,
    bgBottom: 0x4a1a5e
};

export const CHARACTERS = { ELLIOT: 'elliot', DAVE: 'dave' };

export const ZONE_IDS = ['dunes', 'chrome', 'glitter', 'lair'];

export const MAX_LEVEL = 6; // levels 3 and 6 are boss levels
export const isBossLevel = (n) => n % 3 === 0;
// Vinyls needed: level 1 -> 3, level 2 -> 5, boss levels -> 0, level 4 -> 3, level 5 -> 5
export const vinylsForLevel = (n) => (isBossLevel(n) ? 0 : 3 + 2 * ((n - 1) % 3));

// Game-wide event names, emitted/listened on this.game.events.
// ALWAYS import EVT — never inline these strings.
export const EVT = {
    PLAYER_HP: 'gp-player-hp',       // (hp, maxHp)
    VINYLS: 'gp-vinyls',             // (collected, needed)
    LEVEL_START: 'gp-level-start',   // ({level, zoneId, zoneName, isBoss})
    SPECIAL_READY: 'gp-special',     // (ready:boolean, cooldownFrac:0..1  — 1 = ready)
    POWERUP: 'gp-powerup',           // ({type:'tonic'|'tape', remainingMs}) remainingMs 0 = expired
    CONVERTED: 'gp-converted',       // (totalConversions)
    BOSS_HP: 'gp-boss-hp',           // (hp, maxHp) — hp === null hides the bar
    GAME_OVER: 'gp-game-over'        // ({won, level, conversions, charId})
};

// Render depth order — use these, never magic numbers.
export const DEPTH = {
    decor: 0,
    portal: 5,
    pickups: 10,
    enemies: 20,
    player: 30,
    projectiles: 35,
    particles: 40
};
