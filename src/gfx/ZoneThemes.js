// WS-A — see CONTRACTS.md Contract 2
import { PALETTE, isBossLevel } from '../config.js';

// Non-boss levels cycle through these zones in order encountered.
const CYCLE = ['dunes', 'chrome', 'glitter'];

const ZONES = {
    dunes: {
        id: 'dunes',
        name: 'Neon Dunes',
        tileKey: 'tiles_dunes',
        bgColors: [0x2a1045, 0x4a1a5e],
        accent: PALETTE.orange,
        musicMood: 'dunes'
    },
    chrome: {
        id: 'chrome',
        name: 'Chrome Caverns',
        tileKey: 'tiles_chrome',
        bgColors: [0x0e1a2a, 0x1a2f4a],
        accent: PALETTE.cyan,
        musicMood: 'chrome'
    },
    glitter: {
        id: 'glitter',
        name: 'Glitter Gulch',
        tileKey: 'tiles_glitter',
        bgColors: [0x2a0e3a, 0x4a1a5e],
        accent: PALETTE.magenta,
        musicMood: 'glitter'
    },
    lair: {
        id: 'lair',
        name: "Silent Sheriff's Lair",
        tileKey: 'tiles_lair',
        bgColors: [0x0a0a0a, 0x2a0a12],
        accent: 0xff3c3c,
        musicMood: 'boss'
    }
};

// Track order of non-boss levels encountered so far (1-indexed level numbers, excluding boss levels).
function nonBossIndex(level) {
    let idx = 0;
    for (let n = 1; n <= level; n++) {
        if (isBossLevel(n)) continue;
        if (n === level) return idx;
        idx++;
    }
    return idx;
}

export function getZoneForLevel(level) {
    if (isBossLevel(level)) {
        return { ...ZONES.lair };
    }
    const cycleIdx = nonBossIndex(level) % CYCLE.length;
    const zoneId = CYCLE[cycleIdx];
    return { ...ZONES[zoneId] };
}
