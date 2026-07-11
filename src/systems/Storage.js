// WS-F (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS". try/catch localStorage wrapper with in-memory fallback.
export const Storage = {
    getHighScores() { return []; },
    submitScore(entry) { return { rank: null, isNewHigh: false }; },
    getSettings() { return { musicVol: 1, sfxVol: 1 }; },
    saveSettings(partial) {}
};
