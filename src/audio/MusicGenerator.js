// WS-B private helper — generative lo-fi desert-funk music via a lookahead scheduler.
// Zero Phaser usage. Consumed only by AudioEngine.js.
//
// Architecture: one MusicGenerator instance = one mood's worth of synthesis, writing
// into a single GainNode ("bus") that the caller (AudioEngine) owns and crossfades.
// The scheduler wakes every LOOKAHEAD_MS and schedules any 16th-note steps whose
// target time falls within SCHEDULE_AHEAD seconds, using ctx.currentTime as the
// clock and precise AudioParam-timed oscillator/buffer starts (never setTimeout
// for actual sound timing — setTimeout only drives the "am I due to schedule yet" poll).

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12; // seconds
const SWING_AMOUNT = 0.16;  // fraction of a step the off-beat 16th is delayed (~58% grid feel)

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// scale/chord data ------------------------------------------------------------
// progression values are semitone offsets from the mood root (i-VI-III-VII style loops)
const MOOD_CONFIGS = {
    menu: {
        bpm: 76, rootMidi: 45, progression: [0, 8, 3, 10],
        bassWave: 'triangle', bassCutoff: 700, chordWave: 'triangle', chordCutoff: 900,
        chordIntervals: [0, 3, 7, 10], chordSteps: [10],
        hatSkip: 0.62, kickBoost: 0, snareGhost: 0.15,
        sprinkle: 'pluck', sprinkleProb: 0.10
    },
    dunes: {
        bpm: 84, rootMidi: 33, progression: [0, 8, 3, 10],
        bassWave: 'sawtooth', bassCutoff: 1100, chordWave: 'triangle', chordCutoff: 1300,
        chordIntervals: [0, 3, 7, 10], chordSteps: [2, 10],
        hatSkip: 0.38, kickBoost: 0.15, snareGhost: 0.3,
        sprinkle: 'slide', sprinkleProb: 0.09
    },
    chrome: {
        bpm: 84, rootMidi: 35, progression: [0, 3, 10, 8],
        bassWave: 'sawtooth', bassCutoff: 1400, chordWave: 'sawtooth', chordCutoff: 1500,
        chordIntervals: [0, 3, 7, 10], chordSteps: [2, 7, 10],
        hatSkip: 0.3, kickBoost: 0.2, snareGhost: 0.35,
        sprinkle: 'ping', sprinkleProb: 0.18
    },
    glitter: {
        bpm: 84, rootMidi: 38, progression: [0, 10, 8, 3],
        bassWave: 'triangle', bassCutoff: 1300, chordWave: 'triangle', chordCutoff: 1700,
        chordIntervals: [0, 3, 7, 10, 14], chordSteps: [2, 6, 10, 14],
        hatSkip: 0.26, kickBoost: 0.2, snareGhost: 0.4,
        sprinkle: 'echo', sprinkleProb: 0.2
    },
    boss: {
        bpm: 100, rootMidi: 31, progression: [0, 6, 3, 10],
        bassWave: 'sawtooth', bassCutoff: 900, chordWave: 'sawtooth', chordCutoff: 800,
        chordIntervals: [0, 6, 7, 10], chordSteps: [0, 4, 8, 12],
        hatSkip: 0.14, kickBoost: 0.45, snareGhost: 0.5,
        sprinkle: 'none', sprinkleProb: 0
    },
    win: {
        bpm: 92, rootMidi: 36, progression: [0, 7, 9, 5],
        bassWave: 'triangle', bassCutoff: 1700, chordWave: 'triangle', chordCutoff: 2100,
        chordIntervals: [0, 4, 7, 11], chordSteps: [0, 8],
        hatSkip: 0.3, kickBoost: 0.15, snareGhost: 0.3,
        sprinkle: 'ping', sprinkleProb: 0.14
    }
};

// bass patterns: null = rest, else semitone offset added to the bar's chord root
const BASS_PATTERNS = [
    [0, null, null, 12, null, null, 0, null, 10, null, null, 7, null, null, 10, null],
    [0, null, 0, null, null, 7, null, null, 0, null, null, 12, null, 10, null, 0]
];
const KICK_STEPS = [0, 6, 10, 15];
const SNARE_STEPS = [4, 12];

function makeNoiseBuffer(ctx, seconds = 0.4) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
}

function cleanupOnEnd(node) {
    node.onended = () => { try { node.disconnect(); } catch (e) { /* ignore */ } };
}

function playTone(ctx, out, { type = 'sine', freq = 440, start, dur = 0.2, attack = 0.005, decay = 0.15, peak = 0.3, detune = 0, filterFreq = null, filterQ = 0.7 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (detune) osc.detune.setValueAtTime(detune, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 0.0005), start + attack + decay);
    let node = osc;
    if (filterFreq) {
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(filterFreq, start);
        filt.Q.value = filterQ;
        osc.connect(filt);
        filt.connect(gain);
    } else {
        osc.connect(gain);
    }
    gain.connect(out);
    osc.start(start);
    osc.stop(start + attack + decay + 0.05);
    cleanupOnEnd(osc);
    return { osc, gain };
}

function playNoiseHit(ctx, out, buffer, { start, dur = 0.1, attack = 0.002, decay = 0.08, peak = 0.3, filterType = 'bandpass', filterFreq = 1200, Q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(filterFreq, start);
    filt.Q.value = Q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 0.0005), start + attack + decay);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(out);
    src.start(start);
    src.stop(start + attack + decay + 0.05);
    cleanupOnEnd(src);
}

function playKick(ctx, out, start, velocity = 1) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(50, start + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * velocity, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + 0.24);
    cleanupOnEnd(osc);
}

function playSnare(ctx, out, buffer, start, velocity = 1) {
    playNoiseHit(ctx, out, buffer, { start, peak: 0.28 * velocity, decay: 0.11, filterType: 'bandpass', filterFreq: 1800, Q: 0.9 });
    playTone(ctx, out, { type: 'triangle', freq: 190, start, attack: 0.001, decay: 0.06, peak: 0.12 * velocity });
}

function playHat(ctx, out, buffer, start, velocity = 1) {
    playNoiseHit(ctx, out, buffer, { start, peak: 0.14 * velocity, decay: 0.035 + Math.random() * 0.02, filterType: 'highpass', filterFreq: 7000, Q: 0.7 });
}

function playShaker(ctx, out, buffer, start, velocity = 1) {
    playNoiseHit(ctx, out, buffer, { start, peak: 0.08 * velocity, decay: 0.05, filterType: 'bandpass', filterFreq: 5000, Q: 1.4 });
}

function playBassNote(ctx, out, freq, start, dur, wave, cutoff) {
    playTone(ctx, out, { type: wave, freq, start, dur, attack: 0.006, decay: dur * 0.85, peak: 0.32, filterFreq: cutoff, filterQ: 1.1 });
}

function playChordStab(ctx, out, freqs, start, wave, cutoff) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(cutoff, start);
    filt.Q.value = 0.6;
    filt.connect(gain);
    gain.connect(out);
    freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(f, start);
        osc.detune.setValueAtTime((i - freqs.length / 2) * 4, start);
        osc.connect(filt);
        osc.start(start);
        osc.stop(start + 0.55);
        cleanupOnEnd(osc);
    });
}

function playPing(ctx, out, freq, start) {
    playTone(ctx, out, { type: 'sine', freq, start, attack: 0.002, decay: 0.18, peak: 0.15 });
    playTone(ctx, out, { type: 'square', freq: freq * 2, start, attack: 0.001, decay: 0.05, peak: 0.03 });
}

function playEchoPluck(ctx, out, freq, start) {
    playTone(ctx, out, { type: 'triangle', freq, start, attack: 0.003, decay: 0.22, peak: 0.18 });
    playTone(ctx, out, { type: 'triangle', freq, start: start + 0.12, attack: 0.003, decay: 0.18, peak: 0.08 });
}

function playSlideLead(ctx, out, freq, start) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 1.5, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.35);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1600, start);
    filt.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + 0.5);
    cleanupOnEnd(osc);
}

function playPluck(ctx, out, freq, start) {
    playTone(ctx, out, { type: 'sine', freq, start, attack: 0.01, decay: 0.4, peak: 0.12, filterFreq: 1800 });
}

export class MusicGenerator {
    constructor(ctx, output) {
        this.ctx = ctx;
        this.output = output;
        this.mood = null;
        this.cfg = null;
        this.intensity = 0.3;
        this.timer = null;
        this.stepDur = 0.15;
        this.nextStepTime = 0;
        this.stepCount = 0;
        this.noiseBuffer = null;
        // Set by AudioEngine on the currently-active generator only (detached on
        // crossfade-out); invoked with the PRE-SWING base time of every quarter-note
        // (stepIndex % 4 === 0) step as it is scheduled ahead of playback.
        this.onBeatScheduled = null;
    }

    start(mood) {
        this.mood = mood;
        this.cfg = MOOD_CONFIGS[mood] || MOOD_CONFIGS.dunes;
        this.stepDur = 60 / this.cfg.bpm / 4;
        this.stepCount = 0;
        this.nextStepTime = this.ctx.currentTime + 0.05;
        this.noiseBuffer = makeNoiseBuffer(this.ctx, 0.4);
        this._tick();
        this.timer = setInterval(() => this._tick(), LOOKAHEAD_MS);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    setIntensity(t) {
        this.intensity = clamp01(t);
    }

    _tick() {
        const ctx = this.ctx;
        while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
            this._scheduleStep(this.stepCount, this.nextStepTime);
            this.stepCount++;
            this.nextStepTime += this.stepDur;
        }
    }

    _scheduleStep(stepCount, baseTime) {
        const cfg = this.cfg;
        const stepIndex = stepCount % 16;
        const barIndex = Math.floor(stepCount / 16) % cfg.progression.length;

        // Quarter-note beat broadcast — every 4th 16th step, using the UNSWUNG
        // base time (baseTime), before the swing offset below is applied.
        if (stepIndex % 4 === 0 && typeof this.onBeatScheduled === 'function') {
            const beatIndex = Math.floor(stepCount / 4);
            try {
                this.onBeatScheduled(beatIndex, baseTime, cfg.bpm);
            } catch (e) { /* ignore */ }
        }

        const swingOffset = (stepIndex % 2 === 1) ? this.stepDur * SWING_AMOUNT : 0;
        const t = baseTime + swingOffset;
        const chordRootMidi = cfg.rootMidi + 24 + cfg.progression[barIndex];

        this._scheduleBass(cfg, stepIndex, barIndex, chordRootMidi, t);
        this._scheduleDrums(cfg, stepIndex, t);
        this._scheduleChord(cfg, stepIndex, chordRootMidi, t);
        this._scheduleSprinkle(cfg, chordRootMidi, t);
    }

    _scheduleBass(cfg, stepIndex, barIndex, chordRootMidi, t) {
        const pattern = BASS_PATTERNS[barIndex % BASS_PATTERNS.length];
        const offset = pattern[stepIndex];
        if (offset === null || offset === undefined) return;
        const freq = midiToFreq(cfg.rootMidi + offset);
        const cutoff = cfg.bassCutoff * (1 + this.intensity * 0.5);
        playBassNote(this.ctx, this.output, freq, t, this.stepDur * 1.7, cfg.bassWave, cutoff);
    }

    _scheduleDrums(cfg, stepIndex, t) {
        const intensity = this.intensity;
        if (KICK_STEPS.includes(stepIndex) || (cfg.kickBoost > 0.3 && stepIndex === 8)) {
            playKick(this.ctx, this.output, t, 0.9 + intensity * 0.2);
        } else if (Math.random() < cfg.kickBoost * intensity * 0.4) {
            playKick(this.ctx, this.output, t, 0.5);
        }
        if (SNARE_STEPS.includes(stepIndex)) {
            playSnare(this.ctx, this.output, this.noiseBuffer, t, 1);
        } else if (Math.random() < cfg.snareGhost * (0.3 + intensity * 0.7) * 0.25) {
            playSnare(this.ctx, this.output, this.noiseBuffer, t, 0.35);
        }
        const hatSkip = Math.max(0.02, cfg.hatSkip - intensity * 0.35);
        if (Math.random() > hatSkip) {
            const vel = (stepIndex % 4 === 0) ? 1 : 0.6 + Math.random() * 0.3;
            playHat(this.ctx, this.output, this.noiseBuffer, t, vel);
        }
        if (intensity > 0.7 && stepIndex % 2 === 1 && Math.random() < 0.5) {
            playShaker(this.ctx, this.output, this.noiseBuffer, t, 0.7);
        }
    }

    _scheduleChord(cfg, stepIndex, chordRootMidi, t) {
        if (!cfg.chordSteps.includes(stepIndex)) return;
        const freqs = cfg.chordIntervals.map((iv) => midiToFreq(chordRootMidi + iv));
        const cutoff = cfg.chordCutoff * (1 + this.intensity * 0.4);
        playChordStab(this.ctx, this.output, freqs, t, cfg.chordWave, cutoff);
    }

    _scheduleSprinkle(cfg, chordRootMidi, t) {
        if (cfg.sprinkle === 'none' || cfg.sprinkleProb <= 0) return;
        if (Math.random() > cfg.sprinkleProb) return;
        const iv = cfg.chordIntervals[Math.floor(Math.random() * cfg.chordIntervals.length)];
        const freq = midiToFreq(chordRootMidi + iv + 12);
        switch (cfg.sprinkle) {
            case 'ping': playPing(this.ctx, this.output, freq, t); break;
            case 'echo': playEchoPluck(this.ctx, this.output, freq, t); break;
            case 'slide': playSlideLead(this.ctx, this.output, freq, t); break;
            case 'pluck': playPluck(this.ctx, this.output, freq, t); break;
            default: break;
        }
    }
}
