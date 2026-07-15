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
    hazard: 3,        // silence pools: above decor, below portal
    portal: 5,
    pickups: 10,
    enemies: 20,
    player: 30,
    projectiles: 35,
    particles: 40
};

// ======================= PHASE 3 additions ==========================
// Everything above this line is still frozen. Appends only below.

export const GAME_VERSION = '0.3.2'; // bump when shipping a new zip to itch.io

export const BOSS_IDS = { SHERIFF: 'sheriff', BARON: 'baron' };
// Boss cycle: k = n/3; odd k -> Sheriff (L3, L9, ...), even k -> Baron (L6, L12, ...)
export const bossForLevel = (n) => (Math.floor(n / 3) % 2 === 1 ? BOSS_IDS.SHERIFF : BOSS_IDS.BARON);
export const BOSS_NAMES = { sheriff: 'THE SILENT SHERIFF', baron: 'THE FEEDBACK BARON' };

export const STORAGE = { HIGHSCORES: 'ga-highscores-v1', SETTINGS: 'ga-settings-v1' };

export const ONBEAT_WINDOW_MS = 95;   // ± window around the quarter-note for the on-beat bonus
export const COMBO_WINDOW_MS = 4000;  // conversions within this window chain the combo

// Base score values. Rules: comboMult = min(1 + 0.25*(combo-1), 3);
// onBeat doubles the BASE value; vinyl and level_clear are combo-exempt.
export const SCORE_VALUES = {
    convert: 100,
    elite_convert: 250,
    golem_convert: 400,
    phantom_convert: 300,
    drone_kill: 150,
    vinyl: 50,
    level_clear: 500,
    boss_defeat: 1500
};

// Phase-3 EVT additions (same bus, same rules: always import, never inline).
// Also note two EXTENDED payloads on existing events:
//   LEVEL_START gains optional bossName (string) on boss levels
//   GAME_OVER gains {score, maxCombo, endless, canContinue}
EVT.SCORE = 'gp-score';   // ({score, delta, combo, comboMult, reason, x, y, onBeat})
EVT.COMBO = 'gp-combo';   // ({combo, comboMult}) — on change; combo 0 = reset/expired
EVT.BEAT = 'gp-beat';     // ({bpm, beatIndex, beatDurMs}) — bridged from AudioEngine in main.js; VISUALS ONLY
