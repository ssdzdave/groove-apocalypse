// WS-A — see CONTRACTS.md Contract 1
// Chunky 8-bit vaporwave-desert pixel art, generated entirely on offscreen canvases.
// Phaser 3.90 is a GLOBAL (`Phaser`) — this file never imports it.
import { PALETTE } from '../config.js';

// ---------------------------------------------------------------------------
// Color palette (CSS strings derived from PALETTE + a few hand-picked extras)
// ---------------------------------------------------------------------------
function hexStr(v) {
    return '#' + v.toString(16).padStart(6, '0');
}

const ORANGE = hexStr(PALETTE.orange);
const MAGENTA = hexStr(PALETTE.magenta);
const CYAN = hexStr(PALETTE.cyan);
const PURPLE = hexStr(PALETTE.purple);
const DEEP_PURPLE = hexStr(PALETTE.deepPurple);
const SAND = hexStr(PALETTE.sand);
const GRAY = hexStr(PALETTE.gray);
const GOLD = hexStr(PALETTE.gold);

const BLACK = '#0a0a0a';
const WHITE = '#f5f5ff';
const SKIN = '#e8b088';
const BROWN_HAT = '#7a4a2a';
const BROWN_HAT_DK = '#5a3418';
const SILVER = '#d8d8e8';
const SILVER_DK = GRAY;
const DARK_GRAY = '#2a2a32';
const CHROME_DK = '#1a1a22';
const RED = '#ff3c3c';
const DARK_RED = '#7a1414';
const ZOMBIE_GREEN = '#6a7a5a';
const ZOMBIE_GREEN_DK = '#4a5a42';
const BEARD = '#3a2a20';
const GUITAR_BODY = '#b5652d';
const GUITAR_DK = '#7a4018';

const RAINBOW = [MAGENTA, CYAN, ORANGE, GOLD, PURPLE, '#3cff6a'];

// ---------------------------------------------------------------------------
// Low-level pixel-art helpers
// ---------------------------------------------------------------------------

/** Chunky 8-bit "pixel": fills a size×size rect at real canvas coords. */
function px(ctx, x, y, color, size = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
}

/** Flat-color block (silhouette base) — sharp edges since imageSmoothingEnabled=false. */
function block(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

/** Deterministic tiny PRNG so repeated generateAll() calls look identical. */
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** Scatter `count` 2px accent dots inside a 32×32 frame using a seeded rng. */
function speckle(ctx, rng, count, color) {
    for (let s = 0; s < count; s++) {
        const gx = Math.floor(rng() * 16) * 2;
        const gy = Math.floor(rng() * 16) * 2;
        px(ctx, gx, gy, color, 2);
    }
}

/**
 * Build a spritesheet on an offscreen canvas (frames laid side-by-side),
 * register it via addCanvas, then manually slice frames — the known-good,
 * always-works pattern (addSpriteSheet-from-canvas is flaky).
 */
function makeSheet(scene, key, frameW, frameH, frameCount, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frameCount;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < frameCount; i++) {
        ctx.save();
        ctx.translate(i * frameW, 0);
        drawFn(ctx, i);
        ctx.restore();
    }

    const tex = scene.textures.addCanvas(key, canvas);
    for (let i = 0; i < frameCount; i++) {
        tex.add(i, 0, i * frameW, 0, frameW, frameH);
    }
    return tex;
}

/** 8-frame tile sheet: frames 0-3 walls, frames 4-7 floors. */
function makeTileSheet(scene, key, wallFn, floorFn) {
    makeSheet(scene, key, 32, 32, 8, (ctx, i) => {
        if (i < 4) wallFn(ctx, i);
        else floorFn(ctx, i - 4);
    });
}

/** Guarded scene.anims.create wrapper — safe to call every generateAll(). */
function anim(scene, key, textureKey, start, end, opts = {}) {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(textureKey, { start, end }),
        frameRate: opts.frameRate ?? 6,
        repeat: opts.repeat ?? -1
    });
}

// ---------------------------------------------------------------------------
// Humanoid characters — shared skeleton, per-character decoration callbacks
// ---------------------------------------------------------------------------

function elliotDrawHead(ctx, cx) {
    // face
    block(ctx, cx - 3, 6, 6, 6, SKIN);
    px(ctx, cx - 2, 8, BLACK, 2);
    px(ctx, cx + 1, 8, BLACK, 2);
    // brown cowboy hat
    block(ctx, cx - 5, 3, 10, 2, BROWN_HAT_DK);
    block(ctx, cx - 3, 0, 6, 3, BROWN_HAT);
    px(ctx, cx - 3, 2, BROWN_HAT_DK, 2);
}

function elliotDrawWeapon(ctx, pose, sub, cx) {
    // guitar neck, diagonal across the body
    for (let t = 0; t < 8; t++) {
        const gx = Math.round(cx - 8 + t * 1.8);
        const gy = Math.round(14 + t * 1.1);
        px(ctx, gx, gy, GUITAR_DK, 2);
    }
    // guitar body
    block(ctx, cx + 3, 19, 7, 8, GUITAR_BODY);
    px(ctx, cx + 4, 20, '#d88a4a', 2);
    px(ctx, cx + 5, 22, BLACK, 2);
}

const ELLIOT_CFG = {
    skin: SKIN,
    jacket: '#8a5a2a',
    jacketShade: '#6a4218',
    jacketAccent: GOLD,
    pants: '#3a2a1a',
    boots: PURPLE,
    glowColor: GOLD,
    drawHead: elliotDrawHead,
    drawWeapon: elliotDrawWeapon
};

function daveDrawHead(ctx, cx) {
    block(ctx, cx - 3, 6, 6, 6, SKIN);
    block(ctx, cx - 4, 3, 8, 3, BEARD); // hair
    block(ctx, cx - 4, 8, 8, 2, BLACK); // dark wraparound sunglasses
    px(ctx, cx - 3, 8, '#3a3a44', 2);
    px(ctx, cx + 2, 8, '#3a3a44', 2);
    block(ctx, cx - 3, 10, 6, 3, BEARD); // beard
}

function daveDrawBack(ctx, cx, top) {
    // turntable backpack, peeking past the shoulders
    block(ctx, cx - 9, top - 1, 5, 7, DARK_GRAY);
    block(ctx, cx + 4, top - 1, 5, 7, DARK_GRAY);
    px(ctx, cx - 7, top + 1, SILVER, 2);
    px(ctx, cx + 6, top + 1, SILVER, 2);
}

const DAVE_CFG = {
    skin: SKIN,
    jacket: '#b8b8c8',
    jacketShade: SILVER_DK,
    jacketAccent: WHITE,
    pants: DARK_GRAY,
    boots: '#1a1a22',
    glowColor: CYAN,
    drawHead: daveDrawHead,
    drawBack: daveDrawBack
};

/**
 * 32×32, 12-frame layout: idle 0-3, walk 4-7, shoot 8-9, special 10-11.
 * Idle = subtle bob/sway, walk = leg alternation, shoot = weapon flash pose,
 * special = arms-up glow pose.
 */
function drawHumanoidFrame(ctx, i, cfg) {
    const cx = 16;
    let pose, sub;
    if (i < 4) { pose = 'idle'; sub = i; }
    else if (i < 8) { pose = 'walk'; sub = i - 4; }
    else if (i < 10) { pose = 'shoot'; sub = i - 8; }
    else { pose = 'special'; sub = i - 10; }

    const idleBob = [0, -1, 0, 1];
    const walkBob = [0, -1, 0, -1];
    const walkLegOff = [2, 0, -2, 0];

    let dy = 0;
    if (pose === 'idle') dy = idleBob[sub];
    if (pose === 'walk') dy = walkBob[sub];

    ctx.save();
    ctx.translate(0, dy);

    // ground shadow
    ctx.globalAlpha = 0.3;
    block(ctx, cx - 6, 28, 12, 2, BLACK);
    ctx.globalAlpha = 1;

    // legs
    let legL = 0, legR = 0;
    if (pose === 'walk') { legL = walkLegOff[sub]; legR = -walkLegOff[sub]; }
    block(ctx, cx - 4 + legL, 21, 4, 4, cfg.pants);
    block(ctx, cx - 4 + legL, 25, 4, 3, cfg.boots);
    block(ctx, cx + 1 + legR, 21, 4, 4, cfg.pants);
    block(ctx, cx + 1 + legR, 25, 4, 3, cfg.boots);

    // back accessory, drawn behind torso
    if (cfg.drawBack) cfg.drawBack(ctx, cx, 12, 22, i);

    // arms
    if (pose === 'special') {
        const raise = sub === 0 ? 3 : 6;
        block(ctx, cx - 9, 13 - raise, 3, 7 + raise, cfg.jacket);
        block(ctx, cx - 9, 12 - raise, 3, 2, cfg.skin);
        block(ctx, cx + 6, 13 - raise, 3, 7 + raise, cfg.jacket);
        block(ctx, cx + 6, 12 - raise, 3, 2, cfg.skin);
    } else if (pose === 'shoot') {
        block(ctx, cx - 9, 13, 3, 7, cfg.jacket);
        block(ctx, cx - 9, 18, 3, 2, cfg.skin);
        const reach = sub === 0 ? 6 : 9;
        block(ctx, cx + 6, 15, reach, 3, cfg.jacket);
        block(ctx, cx + 5 + reach, 15, 2, 3, cfg.skin);
    } else {
        const armSwing = pose === 'walk' ? Math.round(legR / 2) : 0;
        block(ctx, cx - 9, 13 + armSwing, 3, 7, cfg.jacket);
        block(ctx, cx - 9, 18 + armSwing, 3, 2, cfg.skin);
        block(ctx, cx + 6, 13 - armSwing, 3, 7, cfg.jacket);
        block(ctx, cx + 6, 18 - armSwing, 3, 2, cfg.skin);
    }

    // torso
    block(ctx, cx - 6, 12, 12, 10, cfg.jacket);
    block(ctx, cx - 6, 19, 12, 3, cfg.jacketShade);

    // jacket sparkle / sequin accent pixels
    const rng = mulberry32(i * 97 + 13);
    for (let s = 0; s < 6; s++) {
        const sx = cx - 5 + Math.floor(rng() * 10);
        const sy = 13 + Math.floor(rng() * 8);
        px(ctx, sx, sy, cfg.jacketAccent, 2);
    }

    // weapon overlay (e.g. Elliot's guitar)
    if (cfg.drawWeapon) cfg.drawWeapon(ctx, pose, sub, cx, cfg.glowColor);

    // head
    if (cfg.drawHead) cfg.drawHead(ctx, cx, i, pose, sub);

    // shoot muzzle flash
    if (pose === 'shoot') {
        const size = sub === 0 ? 3 : 5;
        const fx = cx + (sub === 0 ? 12 : 15);
        block(ctx, fx - size / 2, 14 - size / 2, size, size, cfg.glowColor);
    }

    // special arms-up glow burst
    if (pose === 'special') {
        const rng2 = mulberry32(i * 51 + 7);
        const count = sub === 0 ? 6 : 12;
        for (let s = 0; s < count; s++) {
            const ang = rng2() * Math.PI * 2;
            const rad = 9 + rng2() * 5;
            const gx = Math.round(cx + Math.cos(ang) * rad);
            const gy = Math.round(16 + Math.sin(ang) * rad);
            px(ctx, gx, gy, cfg.glowColor, 2);
        }
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Enemies / boss
// ---------------------------------------------------------------------------

/** 32×32, 4-frame shambling lurch. Muted gray-green, hollow eyes. */
function drawZomboidFrame(ctx, i) {
    const cx = 16;
    const lurch = [0, 1, 0, -1][i];
    ctx.save();
    ctx.translate(lurch, 0);

    ctx.globalAlpha = 0.3;
    block(ctx, cx - 6, 28, 12, 2, BLACK);
    ctx.globalAlpha = 1;

    const legOff = [0, 2, 0, -2][i];
    block(ctx, cx - 4 + legOff, 22, 4, 6, ZOMBIE_GREEN_DK);
    block(ctx, cx + 1 - legOff, 22, 4, 6, ZOMBIE_GREEN_DK);

    const armDroop = [0, 1, 2, 1][i];
    block(ctx, cx - 9, 13 + armDroop, 3, 8, ZOMBIE_GREEN);
    block(ctx, cx + 6, 13 + armDroop, 3, 8, ZOMBIE_GREEN);

    block(ctx, cx - 6, 12, 12, 10, ZOMBIE_GREEN);
    block(ctx, cx - 6, 19, 12, 3, ZOMBIE_GREEN_DK);
    px(ctx, cx - 5, 16, ZOMBIE_GREEN_DK, 2);
    px(ctx, cx + 4, 18, ZOMBIE_GREEN_DK, 2);

    block(ctx, cx - 3, 6, 6, 6, ZOMBIE_GREEN);
    px(ctx, cx - 2, 8, BLACK, 2); // hollow eyes
    px(ctx, cx + 1, 8, BLACK, 2);
    block(ctx, cx - 2, 10, 4, 1, BLACK);

    ctx.restore();
}

/** 32×32, 6-frame happy dancer — SAME silhouette as zomboid, neon rainbow, arms up. */
function drawDancerFrame(ctx, i) {
    const cx = 16;
    const color = RAINBOW[i % RAINBOW.length];
    const armUp = [4, 6, 3, 7, 5, 6][i];
    const legSpread = [2, 3, 1, 3, 2, 4][i];

    ctx.save();
    ctx.globalAlpha = 0.3;
    block(ctx, cx - 6, 28, 12, 2, BLACK);
    ctx.globalAlpha = 1;

    const half = Math.floor(legSpread / 2);
    block(ctx, cx - 4 - half, 22, 4, 6, color);
    block(ctx, cx + 1 + half, 22, 4, 6, color);

    block(ctx, cx - 6, 12, 12, 10, color);

    block(ctx, cx - 9, 13 - armUp, 3, armUp + 5, color);
    block(ctx, cx + 6, 13 - armUp, 3, armUp + 5, color);

    block(ctx, cx - 3, 6, 6, 6, color);
    px(ctx, cx - 2, 8, WHITE, 2); // bright happy eyes
    px(ctx, cx + 1, 8, WHITE, 2);
    block(ctx, cx - 2, 10, 4, 1, WHITE);

    const rng = mulberry32(i * 33 + 5);
    for (let s = 0; s < 5; s++) {
        px(ctx, cx - 6 + Math.floor(rng() * 12), 12 + Math.floor(rng() * 10), WHITE, 2);
    }

    ctx.restore();
}

/** 32×32, 4-frame hover-wobble. Dark chrome saucer, glowing red eye. */
function drawDroneFrame(ctx, i) {
    const cx = 16;
    const wob = [0, -1, 0, 1][i];
    ctx.save();
    ctx.translate(0, wob);

    ctx.globalAlpha = 0.3;
    block(ctx, cx - 6, 26, 12, 2, BLACK);
    ctx.globalAlpha = 1;

    block(ctx, cx - 10, 12, 20, 3, DARK_GRAY);
    block(ctx, cx - 8, 14, 16, 3, CHROME_DK);
    block(ctx, cx - 6, 10, 12, 3, DARK_GRAY);
    block(ctx, cx - 3, 7, 6, 4, SILVER_DK);

    const eyeColor = i % 2 === 0 ? RED : '#ff8080';
    px(ctx, cx - 1, 8, eyeColor, 3);

    px(ctx, cx - 6, 17, CYAN, 2);
    px(ctx, cx + 4, 17, CYAN, 2);
    px(ctx, cx - 8, 13, SILVER, 2);
    px(ctx, cx + 6, 13, SILVER, 2);

    ctx.restore();
}

/**
 * 64×64, 8-frame boss: idle 0-3, attack 4-5, stunned 6-7.
 * Black-hat sheriff, long duster, pale face, purple silence-aura wisps.
 */
function drawBossFrame(ctx, i) {
    let pose, sub;
    if (i < 4) { pose = 'idle'; sub = i; }
    else if (i < 6) { pose = 'attack'; sub = i - 4; }
    else { pose = 'stunned'; sub = i - 6; }

    const cx = 32;
    const dy = pose === 'idle' ? [0, -1, 0, 1][sub] : 0;
    const slump = pose === 'stunned' ? 4 : 0;

    ctx.save();
    ctx.translate(0, dy + slump);

    // silence aura wisps (behind everything)
    const rng = mulberry32(i * 71 + 3);
    for (let s = 0; s < 14; s++) {
        const ang = rng() * Math.PI * 2;
        const rad = 22 + rng() * 6;
        const gx = Math.round(cx + Math.cos(ang) * rad);
        const gy = Math.round(34 + Math.sin(ang) * rad * 0.6);
        ctx.globalAlpha = 0.45;
        px(ctx, gx, gy, DEEP_PURPLE, 3);
        ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = 0.35;
    block(ctx, cx - 14, 58, 28, 3, BLACK);
    ctx.globalAlpha = 1;

    // boots peeking beneath the duster
    block(ctx, cx - 8, 52, 6, 6, DARK_GRAY);
    block(ctx, cx + 2, 52, 6, 6, DARK_GRAY);

    // long black duster coat
    block(ctx, cx - 14, 26, 28, 28 - slump, BLACK);
    block(ctx, cx - 16, 24, 32, 6, '#0d0d0d');
    block(ctx, cx - 14, 44, 28, 2, DARK_RED);

    // arms — raised for attack, drooped for stunned
    let armRaise = 0;
    if (pose === 'attack') armRaise = sub === 0 ? 6 : 12;
    if (pose === 'stunned') armRaise = -4;
    block(ctx, cx - 18, 26 - armRaise, 5, 16, BLACK);
    block(ctx, cx + 13, 26 - armRaise, 5, 16, BLACK);
    block(ctx, cx - 18, 24 - armRaise, 5, 3, '#e8d0c0');
    block(ctx, cx + 13, 24 - armRaise, 5, 3, '#e8d0c0');

    // pale face
    block(ctx, cx - 6, 12, 12, 10, '#e8d0c0');
    if (pose === 'stunned') {
        for (let s = 0; s < 3; s++) px(ctx, cx - 8 + s * 8, 4, GOLD, 2);
    } else {
        block(ctx, cx - 6, 16, 12, 2, '#2a2a2a'); // hat-shadowed eyes
    }

    // black hat
    block(ctx, cx - 11, 6, 22, 3, '#0d0d0d');
    block(ctx, cx - 6, 0, 12, 7, BLACK);
    block(ctx, cx - 6, 5, 12, 1, DARK_RED);

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Vinyl / portal
// ---------------------------------------------------------------------------

/** 32×32, 6-frame spinning vinyl with pulsing cyan/magenta glow ring. */
function drawVinylFrame(ctx, i) {
    const cx = 16, cy = 16;
    const glowColor = i % 2 === 0 ? CYAN : MAGENTA;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = glowColor;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let r = 4; r <= 10; r += 2) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }

    const labelColor = RAINBOW[i % RAINBOW.length];
    ctx.fillStyle = labelColor;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.arc(cx, cy, 1, 0, Math.PI * 2); ctx.fill();

    const ang = (i / 6) * Math.PI * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
}

/** 32×32, 6-frame glowing turntable seen from above, rotating platter highlight. */
function drawPortalFrame(ctx, i) {
    const cx = 16, cy = 16;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = CYAN;
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = DARK_GRAY;
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1a1a22';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = MAGENTA;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();

    const ang = (i / 6) * Math.PI * 2;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * 7, cy + Math.sin(ang) * 7, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

/** 32×32, 4-frame gold sparkling beer mug. */
function drawBeerFrame(ctx, i) {
    const cx = 16;
    const bob = [0, -1, 0, 1][i];
    ctx.save();
    ctx.translate(0, bob);

    block(ctx, cx - 5, 12, 8, 12, '#e0a030');
    block(ctx, cx - 5, 12, 8, 3, '#fff2c0');
    block(ctx, cx + 3, 15, 2, 6, '#8a5a10');
    block(ctx, cx - 5, 22, 8, 2, '#8a5a10');

    if (i % 2 === 0) {
        px(ctx, cx - 6, 10, GOLD, 2);
        px(ctx, cx + 4, 13, GOLD, 2);
    }
    ctx.restore();
}

/** 32×32, 4-frame cyan tonic bottle. */
function drawTonicFrame(ctx, i) {
    const cx = 16;
    const bob = [0, -1, 0, 1][i];
    ctx.save();
    ctx.translate(0, bob);

    block(ctx, cx - 3, 10, 6, 4, CYAN);
    block(ctx, cx - 5, 14, 10, 12, CYAN);
    block(ctx, cx - 5, 22, 10, 2, '#1a8a99');
    block(ctx, cx - 2, 8, 4, 2, WHITE);

    const rng = mulberry32(i * 19 + 2);
    for (let s = 0; s < 3; s++) {
        px(ctx, cx - 3 + Math.floor(rng() * 6), 16 + Math.floor(rng() * 6), WHITE, 2);
    }
    ctx.restore();
}

/** 32×32, 4-frame magenta cassette with rainbow shimmer. */
function drawTapeFrame(ctx, i) {
    const cx = 16;
    const bob = [0, -1, 0, 1][i];
    ctx.save();
    ctx.translate(0, bob);

    block(ctx, cx - 8, 12, 16, 10, MAGENTA);
    block(ctx, cx - 8, 12, 16, 2, RAINBOW[i % RAINBOW.length]);
    block(ctx, cx - 6, 14, 5, 5, BLACK);
    block(ctx, cx + 1, 14, 5, 5, BLACK);
    px(ctx, cx - 4, 16, WHITE, 2);
    px(ctx, cx + 3, 16, WHITE, 2);

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

/** 16×16, 2-frame orange/gold chord bolt. */
function drawChordFrame(ctx, i) {
    const cx = 8, cy = 8;
    const color = i === 0 ? ORANGE : GOLD;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    px(ctx, cx - 2, cy - 6, color, 2);
    px(ctx, cx - 1, cy - 4, color, 2);
    px(ctx, cx - 3, cy - 2, color, 2);
    px(ctx, cx, cy, color, 2);
    px(ctx, cx - 2, cy + 2, color, 2);
    px(ctx, cx + 1, cy + 4, color, 2);
}

/** 16×16, 3-frame cyan expanding ring. */
function drawLoopFrame(ctx, i) {
    const cx = 8, cy = 8;
    const r = 3 + i * 2;

    ctx.globalAlpha = 1 - i * 0.2;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();
}

/** 16×16, 2-frame black void orb with purple rim. */
function drawSilenceFrame(ctx, i) {
    const cx = 8, cy = 8;
    const rimColor = i === 0 ? PURPLE : DEEP_PURPLE;

    ctx.fillStyle = rimColor;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(140,60,255,0.5)';
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------

/** 32×32, 4-frame mirrored disco ball glint. */
function drawDiscoFrame(ctx, i) {
    const cx = 16, cy = 16;

    ctx.fillStyle = SILVER;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = SILVER_DK;
    ctx.lineWidth = 1;
    for (let gx = -8; gx <= 8; gx += 4) {
        ctx.beginPath(); ctx.moveTo(cx + gx, cy - 10); ctx.lineTo(cx + gx, cy + 10); ctx.stroke();
    }
    for (let gy = -8; gy <= 8; gy += 4) {
        ctx.beginPath(); ctx.moveTo(cx - 10, cy + gy); ctx.lineTo(cx + 10, cy + gy); ctx.stroke();
    }

    const positions = [[-4, -6], [3, -5], [5, 3], [-3, 5]];
    const [gx, gy] = positions[i];
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.arc(cx + gx, cy + gy, 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#555555';
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - 10); ctx.stroke();
}

/** 16×16, 3-frame color-cycling string light bulb. */
function drawStringLightFrame(ctx, i) {
    const cx = 8, cy = 8;
    const colors = [ORANGE, MAGENTA, CYAN];
    const color = colors[i];

    ctx.strokeStyle = '#2a2a2a';
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(16, 2); ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy + 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy + 2, 3, 0, Math.PI * 2); ctx.fill();
}

/** 8×8, single frame white radial-alpha dot. Real gradient allowed for this one. */
function drawParticleSoftFrame(ctx) {
    const cx = 4, cy = 4;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 4);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Zone tile sheets — frames 0-3 walls (top-lit banded), 4-7 floors (low-contrast)
// ---------------------------------------------------------------------------

function dunesWall(ctx, v) {
    const bands = ['#c86a2a', '#a8501e', '#7a3a1a', '#6a2a8a'];
    bands.forEach((c, idx) => block(ctx, 0, idx * 8, 32, 9, c));
    block(ctx, 0, 0, 32, 2, '#ffb35c'); // top-lit edge
    const rng = mulberry32(v * 171 + 11);
    speckle(ctx, rng, 5, '#4a1a5e');
    speckle(ctx, rng, 3, ORANGE);
}
function dunesFloor(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#2a1c12');
    const rng = mulberry32(v * 233 + 41);
    speckle(ctx, rng, 8, '#3a2818');
    speckle(ctx, rng, 3, SAND);
}

function chromeWall(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#3a3a44');
    block(ctx, 0, 0, 32, 3, '#6a6a78'); // top-lit edge
    block(ctx, 0, 15, 32, 1, '#1e1e26');
    block(ctx, 15, 0, 1, 32, '#1e1e26');
    const rng = mulberry32(v * 311 + 7);
    speckle(ctx, rng, 4, CYAN);
    speckle(ctx, rng, 3, GRAY);
}
function chromeFloor(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#14141a');
    const rng = mulberry32(v * 389 + 19);
    speckle(ctx, rng, 6, '#20202a');
    speckle(ctx, rng, 1, CYAN);
}

function glitterWall(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#3a1a5a');
    block(ctx, 0, 0, 32, 3, '#6a3aa0'); // top-lit edge
    for (let d = 0; d < 4; d++) {
        px(ctx, ((d * 4 + v * 2) % 16) * 2, d * 3 * 2, '#5a2a80', 2);
    }
    const rng = mulberry32(v * 421 + 29);
    speckle(ctx, rng, 5, WHITE);
    speckle(ctx, rng, 3, MAGENTA);
}
function glitterFloor(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#1e0e30');
    const rng = mulberry32(v * 461 + 3);
    speckle(ctx, rng, 5, '#2a1840');
    speckle(ctx, rng, 1, WHITE);
}

function lairWall(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#141414');
    block(ctx, 0, 0, 32, 3, '#242424'); // top-lit edge
    const rng = mulberry32(v * 541 + 17);
    speckle(ctx, rng, 4, '#0a0a0a');
    speckle(ctx, rng, 3, RED);
}
function lairFloor(ctx, v) {
    block(ctx, 0, 0, 32, 32, '#0c0c0c');
    const rng = mulberry32(v * 601 + 23);
    speckle(ctx, rng, 6, '#181818');
    speckle(ctx, rng, 1, DARK_RED);
}

// ---------------------------------------------------------------------------
// Menu portraits & CRT scanline
// ---------------------------------------------------------------------------

function drawElliotPortrait(ctx) {
    const cx = 32;
    block(ctx, cx - 22, 42, 44, 22, '#8a5a2a');
    block(ctx, cx - 22, 42, 44, 4, '#6a4218');
    const rng = mulberry32(11);
    for (let s = 0; s < 10; s++) {
        px(ctx, cx - 20 + Math.floor(rng() * 40), 44 + Math.floor(rng() * 18), GOLD, 3);
    }
    block(ctx, cx - 6, 34, 12, 10, SKIN);
    block(ctx, cx - 14, 10, 28, 26, SKIN);
    block(ctx, cx - 9, 22, 6, 5, BLACK);
    block(ctx, cx + 3, 22, 6, 5, BLACK);
    block(ctx, cx - 6, 30, 12, 3, '#8a4a2a');
    block(ctx, cx - 19, 5, 38, 5, BROWN_HAT_DK);
    block(ctx, cx - 12, 0, 24, 8, BROWN_HAT);
    block(ctx, cx - 12, 4, 24, 2, BROWN_HAT_DK);
}

function drawDavePortrait(ctx) {
    const cx = 32;
    block(ctx, cx - 22, 42, 44, 22, '#b8b8c8');
    block(ctx, cx - 22, 42, 44, 4, SILVER_DK);
    block(ctx, cx - 20, 40, 6, 20, DARK_GRAY);
    block(ctx, cx + 14, 40, 6, 20, DARK_GRAY);
    block(ctx, cx - 6, 34, 12, 10, SKIN);
    block(ctx, cx - 14, 10, 28, 26, SKIN);
    block(ctx, cx - 16, 6, 32, 8, BEARD);
    block(ctx, cx - 12, 20, 24, 6, BLACK);
    px(ctx, cx - 6, 21, '#3a3a44', 3);
    px(ctx, cx + 3, 21, '#3a3a44', 3);
    block(ctx, cx - 8, 28, 16, 8, BEARD);
}

function drawScanline(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 4, 1);
}

// ---------------------------------------------------------------------------
// Animation table (Contract 1)
// ---------------------------------------------------------------------------

function createAnims(scene) {
    anim(scene, 'elliot-idle', 'char_elliot', 0, 3, { frameRate: 4, repeat: -1 });
    anim(scene, 'elliot-walk', 'char_elliot', 4, 7, { frameRate: 8, repeat: -1 });
    anim(scene, 'elliot-shoot', 'char_elliot', 8, 9, { frameRate: 12, repeat: 0 });
    anim(scene, 'elliot-special', 'char_elliot', 10, 11, { frameRate: 6, repeat: 0 });

    anim(scene, 'dave-idle', 'char_dave', 0, 3, { frameRate: 4, repeat: -1 });
    anim(scene, 'dave-walk', 'char_dave', 4, 7, { frameRate: 8, repeat: -1 });
    anim(scene, 'dave-shoot', 'char_dave', 8, 9, { frameRate: 12, repeat: 0 });
    anim(scene, 'dave-special', 'char_dave', 10, 11, { frameRate: 6, repeat: 0 });

    anim(scene, 'zomboid-walk', 'zomboid', 0, 3, { frameRate: 5, repeat: -1 });
    anim(scene, 'dancer-dance', 'dancer', 0, 5, { frameRate: 6, repeat: -1 });
    anim(scene, 'drone-hover', 'dronebot', 0, 3, { frameRate: 6, repeat: -1 });

    anim(scene, 'boss-idle', 'boss_sheriff', 0, 3, { frameRate: 4, repeat: -1 });
    anim(scene, 'boss-attack', 'boss_sheriff', 4, 5, { frameRate: 6, repeat: -1 });
    anim(scene, 'boss-stunned', 'boss_sheriff', 6, 7, { frameRate: 3, repeat: -1 });

    anim(scene, 'vinyl-spin', 'vinyl', 0, 5, { frameRate: 8, repeat: -1 });
    anim(scene, 'portal-spin', 'portal', 0, 5, { frameRate: 6, repeat: -1 });

    anim(scene, 'beer-idle', 'pickup_beer', 0, 3, { frameRate: 4, repeat: -1 });
    anim(scene, 'tonic-idle', 'pickup_tonic', 0, 3, { frameRate: 4, repeat: -1 });
    anim(scene, 'tape-idle', 'pickup_tape', 0, 3, { frameRate: 4, repeat: -1 });

    anim(scene, 'chord-fly', 'proj_chord', 0, 1, { frameRate: 12, repeat: -1 });
    anim(scene, 'loop-fly', 'proj_loop', 0, 2, { frameRate: 10, repeat: -1 });
    anim(scene, 'silence-fly', 'proj_silence', 0, 1, { frameRate: 8, repeat: -1 });

    anim(scene, 'disco-glint', 'disco_ball', 0, 3, { frameRate: 4, repeat: -1 });
    anim(scene, 'light-twinkle', 'string_light', 0, 2, { frameRate: 3, repeat: -1 });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const TextureFactory = {
    generateAll(scene) {
        if (scene.textures.exists('char_elliot')) return; // idempotency guard

        makeSheet(scene, 'char_elliot', 32, 32, 12, (ctx, i) => drawHumanoidFrame(ctx, i, ELLIOT_CFG));
        makeSheet(scene, 'char_dave', 32, 32, 12, (ctx, i) => drawHumanoidFrame(ctx, i, DAVE_CFG));
        makeSheet(scene, 'zomboid', 32, 32, 4, drawZomboidFrame);
        makeSheet(scene, 'dancer', 32, 32, 6, drawDancerFrame);
        makeSheet(scene, 'dronebot', 32, 32, 4, drawDroneFrame);
        makeSheet(scene, 'boss_sheriff', 64, 64, 8, drawBossFrame);

        makeSheet(scene, 'vinyl', 32, 32, 6, drawVinylFrame);
        makeSheet(scene, 'portal', 32, 32, 6, drawPortalFrame);

        makeSheet(scene, 'pickup_beer', 32, 32, 4, drawBeerFrame);
        makeSheet(scene, 'pickup_tonic', 32, 32, 4, drawTonicFrame);
        makeSheet(scene, 'pickup_tape', 32, 32, 4, drawTapeFrame);

        makeSheet(scene, 'proj_chord', 16, 16, 2, drawChordFrame);
        makeSheet(scene, 'proj_loop', 16, 16, 3, drawLoopFrame);
        makeSheet(scene, 'proj_silence', 16, 16, 2, drawSilenceFrame);

        makeSheet(scene, 'disco_ball', 32, 32, 4, drawDiscoFrame);
        makeSheet(scene, 'string_light', 16, 16, 3, drawStringLightFrame);
        makeSheet(scene, 'particle_soft', 8, 8, 1, drawParticleSoftFrame);

        makeTileSheet(scene, 'tiles_dunes', dunesWall, dunesFloor);
        makeTileSheet(scene, 'tiles_chrome', chromeWall, chromeFloor);
        makeTileSheet(scene, 'tiles_glitter', glitterWall, glitterFloor);
        makeTileSheet(scene, 'tiles_lair', lairWall, lairFloor);

        makeSheet(scene, 'portrait_elliot', 64, 64, 1, drawElliotPortrait);
        makeSheet(scene, 'portrait_dave', 64, 64, 1, drawDavePortrait);
        makeSheet(scene, 'scanline', 4, 4, 1, drawScanline);

        createAnims(scene);
    }
};
