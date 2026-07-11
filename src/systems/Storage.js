// WS-F (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-F. try/catch localStorage wrapper
// with an in-memory fallback for private-mode/quota failures (and for non-browser environments).
import { STORAGE } from '../config.js';

// Mirrors the two storage keys whenever real localStorage access throws (or doesn't exist).
let memFallback = null;

function hasLocalStorage() {
    try {
        return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) {
        return false;
    }
}

function readKey(key) {
    try {
        if (hasLocalStorage()) {
            const raw = localStorage.getItem(key);
            return (raw === null || raw === undefined) ? null : raw;
        }
    } catch (e) {
        // fall through to memory fallback
    }
    if (memFallback && Object.prototype.hasOwnProperty.call(memFallback, key)) {
        return memFallback[key];
    }
    return null;
}

function writeKey(key, valueString) {
    try {
        if (hasLocalStorage()) {
            localStorage.setItem(key, valueString);
            return;
        }
    } catch (e) {
        // fall through to memory fallback
    }
    if (!memFallback) memFallback = {};
    memFallback[key] = valueString;
}

function parseHighScores() {
    const raw = readKey(STORAGE.HIGHSCORES);
    if (!raw) return [];
    let arr;
    try {
        arr = JSON.parse(raw);
    } catch (e) {
        return [];
    }
    if (!Array.isArray(arr)) return [];
    const valid = arr.filter((e) => (
        e && typeof e === 'object' &&
        typeof e.score === 'number' && isFinite(e.score) &&
        typeof e.charId === 'string'
    ));
    valid.sort((a, b) => b.score - a.score);
    return valid.slice(0, 5);
}

function parseSettings() {
    const defaults = { musicVol: 1, sfxVol: 1 };
    const raw = readKey(STORAGE.SETTINGS);
    let persisted = {};
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') persisted = parsed;
        } catch (e) {
            persisted = {};
        }
    }
    const clean = {};
    for (const key of Object.keys(defaults)) {
        let v = persisted[key];
        if (typeof v !== 'number' || !isFinite(v)) v = defaults[key];
        clean[key] = Math.min(1, Math.max(0, v));
    }
    return clean;
}

export const Storage = {
    getHighScores() {
        try {
            return parseHighScores();
        } catch (e) {
            return [];
        }
    },

    submitScore(entry) {
        try {
            const list = parseHighScores();
            const newEntry = {
                score: (entry && typeof entry.score === 'number' && isFinite(entry.score)) ? entry.score : 0,
                charId: (entry && typeof entry.charId === 'string') ? entry.charId : '',
                level: (entry && typeof entry.level === 'number' && isFinite(entry.level)) ? entry.level : 0,
                endless: !!(entry && entry.endless),
                date: (entry && entry.date) ? entry.date : new Date().toISOString()
            };
            list.push(newEntry);
            // Stable sort (V8 guarantees stability): ties keep prior relative order,
            // and the newly-pushed entry — being last pre-sort — loses ties. Intentional.
            list.sort((a, b) => b.score - a.score);
            const kept = list.slice(0, 5);
            writeKey(STORAGE.HIGHSCORES, JSON.stringify(kept));

            const idx = kept.indexOf(newEntry);
            const rank = idx === -1 ? null : idx + 1;
            const isNewHigh = rank === 1 && newEntry.score > 0;
            return { rank, isNewHigh };
        } catch (e) {
            return { rank: null, isNewHigh: false };
        }
    },

    getSettings() {
        try {
            return parseSettings();
        } catch (e) {
            return { musicVol: 1, sfxVol: 1 };
        }
    },

    saveSettings(partial) {
        try {
            const current = parseSettings();
            const merged = { ...current, ...(partial && typeof partial === 'object' ? partial : {}) };
            const clean = {};
            for (const key of Object.keys(current)) {
                let v = merged[key];
                if (typeof v !== 'number' || !isFinite(v)) v = current[key];
                clean[key] = Math.min(1, Math.max(0, v));
            }
            writeKey(STORAGE.SETTINGS, JSON.stringify(clean));
            return clean;
        } catch (e) {
            return { musicVol: 1, sfxVol: 1 };
        }
    }
};
