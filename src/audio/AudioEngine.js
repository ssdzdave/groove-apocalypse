// WS-B — see CONTRACTS.md Contract 3 + PHASE 3 CONTRACTS (P3-B). Pure WebAudio, zero Phaser.
//
// Signal graph:
//   [music generator bus (per mood, crossfaded)] --\
//                                                    -> musicBusGain -\
//   [music generator bus ...]                     --/                  -> masterGain -> DynamicsCompressor -> destination
//                                                                     /
//   [sfx bus] -----------------------------------------------------/
//
// startMusic(mood) spins up a fresh MusicGenerator writing into its own GainNode
// ("music bus"). Switching moods creates a new bus/generator pair, ramps the new
// bus in and the old bus out over CROSSFADE_SEC, then stops/discards the old one.
// musicBusGain is the single fader all music routes through — it's what
// setMusicVolume()/setDucked() actually move.
//
// Beat broadcast: MusicGenerator invokes generator.onBeatScheduled(beatIndex,
// audioTime, bpm) once per quarter note (pre-swing base time), scheduled ~25-120ms
// ahead of playback (its lookahead scheduler). AudioEngine attaches that hook only
// to currentMusic.generator (detached the instant a crossfade starts so two
// generators never both broadcast beats during the overlap window), records the
// most recent {anchorTime, beatDur, beatIndex, bpm} for getBeatInfo()'s pure
// ctx-clock math, and arms a setTimeout to fire at the real audio time so the
// (already-existing) beatListeners Set gets invoked in sync with what's heard.
//
// Every public method is defensively wrapped so it is always a safe no-op before
// init() and never throws afterward.

import { MusicGenerator } from './MusicGenerator.js';
import { SfxBank } from './SfxBank.js';

const CROSSFADE_SEC = 0.7;
const STOP_FADE_SEC = 0.6;
const MASTER_GAIN = 0.6;
const SFX_BASE_GAIN = 0.9;
const DUCK_FACTOR = 0.35;
const DUCK_RAMP_SEC = 0.25;
const VOL_RAMP_SEC = 0.05;

let ctx = null;
let masterGain = null;
let compressor = null;
let sfxGain = null;
let musicBusGain = null;

let currentMusic = null; // { mood, generator, gain }
let fadingBuses = [];    // buses fading out, pending cleanup
let intensity = 0.3;
let ducked = false;

// Most recently scheduled quarter-note beat, used for getBeatInfo()'s pure
// ctx-clock math. null whenever nothing is actively broadcasting beats.
let beatState = null; // { anchorTime, beatDur, beatIndex, bpm }

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function fadeOutAndDiscard(bus) {
    if (!bus) return;
    try {
        const now = ctx.currentTime;
        bus.gain.gain.cancelScheduledValues(now);
        bus.gain.gain.setValueAtTime(bus.gain.gain.value, now);
        bus.gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_SEC);
    } catch (e) { /* ignore */ }
    fadingBuses.push(bus);
    setTimeout(() => {
        try { bus.generator.stop(); } catch (e) { /* ignore */ }
        try { bus.gain.disconnect(); } catch (e) { /* ignore */ }
        fadingBuses = fadingBuses.filter((b) => b !== bus);
    }, (CROSSFADE_SEC + 0.15) * 1000);
}

// ---------------- beat scheduling helpers ----------------

// Builds a per-generator onBeatScheduled hook. Each generator gets its own
// timeout bookkeeping array so detaching one generator never touches timeouts
// armed by another (relevant during the crossfade overlap window).
function makeBeatHook(generator) {
    const timeoutIds = [];
    generator._beatTimeoutIds = timeoutIds;
    return function onBeatScheduled(beatIndex, audioTime, bpm) {
        const beatDur = bpm > 0 ? 60 / bpm : 0;
        beatState = { anchorTime: audioTime, beatDur, beatIndex, bpm };
        if (beatDur <= 0) return;
        const delayMs = Math.max(0, (audioTime - ctx.currentTime) * 1000);
        const id = setTimeout(() => {
            const idx = timeoutIds.indexOf(id);
            if (idx !== -1) timeoutIds.splice(idx, 1);
            const payload = { bpm, beatIndex, beatDurMs: beatDur * 1000 };
            beatListeners.forEach((cb) => {
                try { cb(payload); } catch (e) { /* ignore */ }
            });
        }, delayMs);
        timeoutIds.push(id);
    };
}

// Detaches the beat hook from a { generator } bus entry and clears any of its
// still-pending beat timeouts so no stale/duplicate fires happen post-crossfade.
function detachBeatHook(musicEntry) {
    if (!musicEntry || !musicEntry.generator) return;
    musicEntry.generator.onBeatScheduled = null;
    const ids = musicEntry.generator._beatTimeoutIds;
    if (ids && ids.length) {
        ids.forEach((id) => clearTimeout(id));
        ids.length = 0;
    }
}

function computeBeatInfo() {
    if (!ctx || !currentMusic || !beatState || !(beatState.beatDur > 0)) {
        return { active: false, bpm: 0, beatDurMs: 0, beatIndex: -1, phase: 0, sinceMs: Infinity, untilMs: Infinity };
    }
    const { anchorTime, beatDur, beatIndex, bpm } = beatState;
    const now = ctx.currentTime;
    const rawBeats = (now - anchorTime) / beatDur;
    const beatsElapsed = Math.floor(rawBeats);
    const diff = (rawBeats - beatsElapsed) * beatDur; // seconds since last beat boundary, in [0, beatDur)
    return {
        active: true,
        bpm,
        beatDurMs: beatDur * 1000,
        beatIndex: beatIndex + beatsElapsed,
        phase: diff / beatDur,
        sinceMs: diff * 1000,
        untilMs: (beatDur - diff) * 1000
    };
}

// ---------------- music bus volume/duck helpers ----------------

function currentMusicBusTarget() {
    return ducked ? pendingVolumes.music * DUCK_FACTOR : pendingVolumes.music;
}

function rampMusicBusTo(target, rampSec) {
    if (!ctx || !musicBusGain) return;
    try {
        const now = ctx.currentTime;
        const g = musicBusGain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(Math.max(0.0001, target), now + rampSec);
    } catch (e) { /* ignore */ }
}

export const AudioEngine = {
    init() {
        try {
            if (ctx) {
                if (ctx.state === 'suspended') ctx.resume().catch(() => {});
                return;
            }
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            masterGain = ctx.createGain();
            masterGain.gain.value = MASTER_GAIN;
            compressor = ctx.createDynamicsCompressor();
            masterGain.connect(compressor);
            compressor.connect(ctx.destination);

            musicBusGain = ctx.createGain();
            musicBusGain.gain.value = currentMusicBusTarget();
            musicBusGain.connect(masterGain);

            sfxGain = ctx.createGain();
            sfxGain.gain.value = SFX_BASE_GAIN * pendingVolumes.sfx;
            sfxGain.connect(masterGain);

            ctx.resume().catch(() => {});
        } catch (e) {
            console.warn('AudioEngine.init failed', e);
            ctx = null;
        }
    },

    startMusic(mood) {
        try {
            if (!ctx) return;
            if (currentMusic && currentMusic.mood === mood) return;

            const bus = ctx.createGain();
            bus.gain.setValueAtTime(0.0001, ctx.currentTime);
            bus.connect(musicBusGain);
            const generator = new MusicGenerator(ctx, bus);
            generator.onBeatScheduled = makeBeatHook(generator);
            generator.setIntensity(intensity);
            generator.start(mood);
            bus.gain.linearRampToValueAtTime(1, ctx.currentTime + CROSSFADE_SEC);

            if (currentMusic) {
                detachBeatHook(currentMusic); // never let two generators broadcast beats at once
                fadeOutAndDiscard(currentMusic);
            }
            currentMusic = { mood, generator, gain: bus };
        } catch (e) {
            console.warn('AudioEngine.startMusic failed', e);
        }
    },

    stopMusic() {
        try {
            if (!ctx || !currentMusic) return;
            const bus = currentMusic;
            detachBeatHook(bus);
            beatState = null;
            currentMusic = null;
            try {
                const now = ctx.currentTime;
                bus.gain.gain.cancelScheduledValues(now);
                bus.gain.gain.setValueAtTime(bus.gain.gain.value, now);
                bus.gain.gain.linearRampToValueAtTime(0.0001, now + STOP_FADE_SEC);
            } catch (e) { /* ignore */ }
            fadingBuses.push(bus);
            setTimeout(() => {
                try { bus.generator.stop(); } catch (e2) { /* ignore */ }
                try { bus.gain.disconnect(); } catch (e2) { /* ignore */ }
                fadingBuses = fadingBuses.filter((b) => b !== bus);
            }, (STOP_FADE_SEC + 0.15) * 1000);
        } catch (e) {
            console.warn('AudioEngine.stopMusic failed', e);
        }
    },

    setIntensity(t) {
        try {
            intensity = clamp01(t);
            if (currentMusic) currentMusic.generator.setIntensity(intensity);
        } catch (e) {
            console.warn('AudioEngine.setIntensity failed', e);
        }
    },

    sfx(name) {
        try {
            if (!ctx) return;
            if (!SfxBank.has(name)) {
                console.warn(`AudioEngine.sfx: unknown sfx name "${name}"`);
                return;
            }
            SfxBank.play(ctx, sfxGain, name);
        } catch (e) {
            console.warn('AudioEngine.sfx failed', e);
        }
    },

    debugState() {
        try {
            const info = computeBeatInfo();
            return {
                ctxState: ctx ? ctx.state : 'uninitialized',
                mood: currentMusic ? currentMusic.mood : null,
                intensity,
                musicVol: pendingVolumes.music,
                sfxVol: pendingVolumes.sfx,
                ducked,
                beat: { active: info.active, bpm: info.bpm, beatIndex: info.beatIndex }
            };
        } catch (e) {
            return {
                ctxState: 'uninitialized', mood: null, intensity,
                musicVol: pendingVolumes.music, sfxVol: pendingVolumes.sfx, ducked,
                beat: { active: false, bpm: 0, beatIndex: -1 }
            };
        }
    },

    // ---------------- Phase 3 additions (P3-B) ----------------
    onBeat(cb) { beatListeners.add(cb); },
    offBeat(cb) { beatListeners.delete(cb); },

    getBeatInfo() {
        try {
            return computeBeatInfo();
        } catch (e) {
            return { active: false, bpm: 0, beatDurMs: 0, beatIndex: -1, phase: 0, sinceMs: Infinity, untilMs: Infinity };
        }
    },

    setMusicVolume(v) {
        try {
            pendingVolumes.music = clamp01(v);
            if (ctx && musicBusGain) rampMusicBusTo(currentMusicBusTarget(), VOL_RAMP_SEC);
        } catch (e) {
            console.warn('AudioEngine.setMusicVolume failed', e);
        }
    },
    setSfxVolume(v) {
        try {
            pendingVolumes.sfx = clamp01(v);
            if (ctx && sfxGain) sfxGain.gain.value = SFX_BASE_GAIN * pendingVolumes.sfx;
        } catch (e) {
            console.warn('AudioEngine.setSfxVolume failed', e);
        }
    },
    getVolumes() { return { musicVol: pendingVolumes.music, sfxVol: pendingVolumes.sfx }; },

    setDucked(on) {
        try {
            const next = !!on;
            if (next === ducked) return; // idempotent
            ducked = next;
            if (ctx && musicBusGain) rampMusicBusTo(currentMusicBusTarget(), DUCK_RAMP_SEC);
        } catch (e) {
            console.warn('AudioEngine.setDucked failed', e);
        }
    }
};

// Phase-3 module state
const beatListeners = new Set();
const pendingVolumes = { music: 1, sfx: 1 };
