// WS-B — see CONTRACTS.md Contract 3. Pure WebAudio, zero Phaser.
//
// Signal graph:
//   [music generator bus (per mood, crossfaded)] --\
//                                                    -> masterGain -> DynamicsCompressor -> destination
//   [sfx bus] -------------------------------------/
//
// startMusic(mood) spins up a fresh MusicGenerator writing into its own GainNode
// ("music bus"). Switching moods creates a new bus/generator pair, ramps the new
// bus in and the old bus out over CROSSFADE_SEC, then stops/discards the old one.
// Every public method is defensively wrapped so it is always a safe no-op before
// init() and never throws afterward.

import { MusicGenerator } from './MusicGenerator.js';
import { SfxBank } from './SfxBank.js';

const CROSSFADE_SEC = 0.7;
const STOP_FADE_SEC = 0.6;
const MASTER_GAIN = 0.6;

let ctx = null;
let masterGain = null;
let compressor = null;
let sfxGain = null;

let currentMusic = null; // { mood, generator, gain }
let fadingBuses = [];    // buses fading out, pending cleanup
let intensity = 0.3;

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
            sfxGain = ctx.createGain();
            sfxGain.gain.value = 0.9;
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
            bus.connect(masterGain);
            const generator = new MusicGenerator(ctx, bus);
            generator.setIntensity(intensity);
            generator.start(mood);
            bus.gain.linearRampToValueAtTime(1, ctx.currentTime + CROSSFADE_SEC);

            if (currentMusic) {
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
            return {
                ctxState: ctx ? ctx.state : 'uninitialized',
                mood: currentMusic ? currentMusic.mood : null,
                intensity
            };
        } catch (e) {
            return { ctxState: 'uninitialized', mood: null, intensity };
        }
    }
};
