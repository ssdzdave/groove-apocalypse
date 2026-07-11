// WS-B private helper — 23 synthesized one-shot SFX. Zero Phaser usage.
// Consumed only by AudioEngine.js, which dispatches SfxBank.play(ctx, out, name).

function cleanupOnEnd(node) {
    node.onended = () => { try { node.disconnect(); } catch (e) { /* ignore */ } };
}

function makeNoiseBuffer(ctx, seconds = 0.5) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
}

function makeDistortionCurve(amount = 30) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

// generic tone: osc -> [filter] -> gain -> out, self-cleaning
function tone(ctx, out, { type = 'sine', freq = 440, freqEnd = null, start = 0, attack = 0.004, decay = 0.2, peak = 0.3, detune = 0, filterType = 'lowpass', filterFreq = null, filterQ = 0.8 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + attack + decay);
    if (detune) osc.detune.setValueAtTime(detune, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 0.0004), start + attack + decay);
    let last = osc;
    if (filterFreq !== null) {
        const filt = ctx.createBiquadFilter();
        filt.type = filterType;
        filt.frequency.setValueAtTime(filterFreq, start);
        filt.Q.value = filterQ;
        osc.connect(filt);
        last = filt;
    }
    last.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + attack + decay + 0.05);
    cleanupOnEnd(osc);
    return gain;
}

function noiseHit(ctx, out, buffer, { start = 0, attack = 0.004, decay = 0.2, peak = 0.3, filterType = 'bandpass', filterFreq = 1200, Q = 1, freqEnd = null }) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(filterFreq, start);
    if (freqEnd !== null) filt.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + attack + decay);
    filt.Q.value = Q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.001, 0.0004), start + attack + decay);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(out);
    src.start(start);
    src.stop(start + attack + decay + 0.05);
    cleanupOnEnd(src);
    return gain;
}

const NOTE = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

// ---- individual SFX builders (ctx, out) -> void, each fire-and-forget ----

function sfxShootChord(ctx, out) {
    const t0 = ctx.currentTime;
    const freqs = [NOTE(0), NOTE(4), NOTE(7)]; // A - C#- E stack
    freqs.forEach((f, i) => {
        tone(ctx, out, { type: 'sawtooth', freq: f, detune: (i - 1) * 6, start: t0 + i * 0.012, attack: 0.002, decay: 0.09, peak: 0.16, filterFreq: 2400 });
    });
}

function sfxShootLoop(ctx, out) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.linearRampToValueAtTime(180, t0 + 0.08);
    osc.frequency.linearRampToValueAtTime(230, t0 + 0.16);
    osc.frequency.linearRampToValueAtTime(150, t0 + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.26);
    cleanupOnEnd(osc);
}

function sfxPickupVinyl(ctx, out) {
    const t0 = ctx.currentTime;
    tone(ctx, out, { type: 'triangle', freq: NOTE(3), start: t0, attack: 0.003, decay: 0.09, peak: 0.2, filterFreq: 3000 });
    tone(ctx, out, { type: 'triangle', freq: NOTE(10), start: t0 + 0.07, attack: 0.003, decay: 0.14, peak: 0.22, filterFreq: 3500 });
}

function sfxPickupPowerup(ctx, out) {
    const t0 = ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((iv, i) => {
        tone(ctx, out, { type: 'triangle', freq: NOTE(iv), start: t0 + i * 0.045, attack: 0.002, decay: 0.12, peak: 0.15, filterFreq: 4000 });
    });
}

function sfxConvert(ctx, out) {
    const t0 = ctx.currentTime;
    [0, 4, 7, 12].forEach((iv, i) => {
        tone(ctx, out, { type: 'sine', freq: NOTE(iv + 12), start: t0 + i * 0.07, attack: 0.004, decay: 0.3, peak: 0.18 });
    });
    const buf = makeNoiseBuffer(ctx, 0.6);
    noiseHit(ctx, out, buf, { start: t0, attack: 0.15, decay: 0.4, peak: 0.12, filterType: 'bandpass', filterFreq: 600, freqEnd: 3000, Q: 0.7 });
}

function sfxSlide(ctx, out) {
    const t0 = ctx.currentTime;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(18);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2200, t0);
    filt.frequency.exponentialRampToValueAtTime(300, t0 + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    shaper.connect(filt);
    filt.connect(gain);
    gain.connect(out);
    [NOTE(-5), NOTE(2)].forEach((f) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t0);
        osc.frequency.exponentialRampToValueAtTime(f * 0.4, t0 + 0.4);
        osc.connect(shaper);
        osc.start(t0);
        osc.stop(t0 + 0.45);
        cleanupOnEnd(osc);
    });
}

function sfxBassdrop(ctx, out) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.65);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.95);
    cleanupOnEnd(osc);
    // sub thump
    tone(ctx, out, { type: 'sine', freq: 90, start: t0, attack: 0.002, decay: 0.12, peak: 0.35 });
}

function sfxHurt(ctx, out) {
    const t0 = ctx.currentTime;
    [0, -1].forEach((detune) => {
        tone(ctx, out, { type: 'sawtooth', freq: NOTE(-4), freqEnd: NOTE(-12), start: t0, detune: detune * 20, attack: 0.001, decay: 0.16, peak: 0.16, filterFreq: 1400 });
    });
}

function sfxStun(ctx, out) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(NOTE(-2), t0);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(7, t0);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(18, t0);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.2, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + 0.5);
    lfo.stop(t0 + 0.5);
    cleanupOnEnd(osc);
    cleanupOnEnd(lfo);
}

function sfxLevelup(ctx, out) {
    const t0 = ctx.currentTime;
    [0, 4, 7, 12].forEach((iv, i) => {
        tone(ctx, out, { type: 'triangle', freq: NOTE(iv), start: t0 + i * 0.09, attack: 0.003, decay: 0.18, peak: 0.22, filterFreq: 3500 });
    });
}

function sfxBossRoar(ctx, out) {
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(500, t0);
    filt.connect(gain);
    gain.connect(out);
    [NOTE(-14), NOTE(-14) + 3, NOTE(-19)].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t0);
        osc.detune.setValueAtTime((i - 1) * 12, t0);
        osc.connect(filt);
        osc.start(t0);
        osc.stop(t0 + 0.9);
        cleanupOnEnd(osc);
    });
    const buf = makeNoiseBuffer(ctx, 0.9);
    noiseHit(ctx, out, buf, { start: t0, attack: 0.25, decay: 0.6, peak: 0.1, filterType: 'lowpass', filterFreq: 900, Q: 0.6 });
}

function sfxBossHit(ctx, out) {
    const t0 = ctx.currentTime;
    tone(ctx, out, { type: 'sine', freq: 160, freqEnd: 45, start: t0, attack: 0.001, decay: 0.16, peak: 0.4 });
    [NOTE(9), NOTE(9) + 7].forEach((f, i) => {
        tone(ctx, out, { type: 'square', freq: f, start: t0 + 0.01, attack: 0.002, decay: 0.25, peak: 0.08, detune: i * 8, filterFreq: 4000 });
    });
}

function sfxBossDie(ctx, out) {
    const t0 = ctx.currentTime;
    const buf = makeNoiseBuffer(ctx, 1.3);
    noiseHit(ctx, out, buf, { start: t0, attack: 0.01, decay: 1.1, peak: 0.28, filterType: 'lowpass', filterFreq: 4000, freqEnd: 200, Q: 0.8 });
    [NOTE(-7), NOTE(-14), NOTE(-19)].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t0 + i * 0.08);
        osc.frequency.exponentialRampToValueAtTime(f * 0.35, t0 + i * 0.08 + 1.0);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, t0 + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.08 + 1.15);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t0 + i * 0.08);
        osc.stop(t0 + i * 0.08 + 1.2);
        cleanupOnEnd(osc);
    });
}

function sfxWin(ctx, out) {
    const t0 = ctx.currentTime;
    [0, 4, 7, 12].forEach((iv) => {
        tone(ctx, out, { type: 'triangle', freq: NOTE(iv), start: t0, attack: 0.006, decay: 0.5, peak: 0.16, filterFreq: 3500 });
    });
}

function sfxGameover(ctx, out) {
    const t0 = ctx.currentTime;
    [0, -2, -4, -7].forEach((iv, i) => {
        tone(ctx, out, { type: 'sine', freq: NOTE(iv - 5), start: t0 + i * 0.32, attack: 0.02, decay: 0.55, peak: 0.22, filterFreq: 1400 });
    });
}

function sfxUiMove(ctx, out) {
    const t0 = ctx.currentTime;
    tone(ctx, out, { type: 'square', freq: NOTE(2), start: t0, attack: 0.001, decay: 0.04, peak: 0.1, filterFreq: 3000 });
}

function sfxUiSelect(ctx, out) {
    const t0 = ctx.currentTime;
    tone(ctx, out, { type: 'square', freq: NOTE(0), start: t0, attack: 0.001, decay: 0.05, peak: 0.12, filterFreq: 3500 });
    tone(ctx, out, { type: 'square', freq: NOTE(7), start: t0 + 0.05, attack: 0.001, decay: 0.08, peak: 0.14, filterFreq: 3800 });
}

// ---- Phase 3 (P3-B) additions ----

// Bright, tight zap-chime — fires often on every on-beat hit, so kept very
// short/cheap: a single high square blip + a quick shimmer harmonic.
function sfxOnbeat(ctx, out) {
    const t0 = ctx.currentTime;
    tone(ctx, out, { type: 'square', freq: NOTE(19), start: t0, attack: 0.001, decay: 0.05, peak: 0.18, filterFreq: 6000 });
    tone(ctx, out, { type: 'sine', freq: NOTE(31), start: t0, attack: 0.001, decay: 0.03, peak: 0.08 });
}

// Reversed-feel whoosh (rising filtered noise swell, cut abruptly like tape
// reverse) + a short digital static blip landing right at the teleport.
function sfxPhantomTele(ctx, out) {
    const t0 = ctx.currentTime;
    const buf = makeNoiseBuffer(ctx, 0.4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(200, t0);
    filt.frequency.exponentialRampToValueAtTime(3200, t0 + 0.22);
    filt.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0004, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.2);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + 0.24);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(out);
    src.start(t0);
    src.stop(t0 + 0.25);
    cleanupOnEnd(src);
    // static blip landing on the teleport
    const blipBuf = makeNoiseBuffer(ctx, 0.08);
    noiseHit(ctx, out, blipBuf, { start: t0 + 0.21, attack: 0.001, decay: 0.06, peak: 0.16, filterType: 'highpass', filterFreq: 5000, Q: 0.8 });
}

// Deep boom (sub sine sweep) + a rattly noise burst simulating a blown
// speaker cabinet shaking.
function sfxGolemShockwave(ctx, out) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t0);
    osc.frequency.exponentialRampToValueAtTime(28, t0 + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.62);
    cleanupOnEnd(osc);
    const buf = makeNoiseBuffer(ctx, 0.5);
    noiseHit(ctx, out, buf, { start: t0, attack: 0.008, decay: 0.4, peak: 0.22, filterType: 'bandpass', filterFreq: 250, freqEnd: 90, Q: 0.9 });
    // rattle: rapid low-passed noise ticks
    for (let i = 0; i < 5; i++) {
        const rt = t0 + 0.03 + i * 0.045;
        noiseHit(ctx, out, buf, { start: rt, attack: 0.002, decay: 0.05, peak: 0.09, filterType: 'bandpass', filterFreq: 900, Q: 2 });
    }
}

// Soft two-note descending blip for opening the pause menu.
function sfxPause(ctx, out) {
    const t0 = ctx.currentTime;
    tone(ctx, out, { type: 'triangle', freq: NOTE(4), start: t0, attack: 0.004, decay: 0.1, peak: 0.14, filterFreq: 2800 });
    tone(ctx, out, { type: 'triangle', freq: NOTE(-1), start: t0 + 0.09, attack: 0.004, decay: 0.14, peak: 0.13, filterFreq: 2400 });
}

// Short, sad record-scratch-ish drop: reversed-pitch noise scrub + a
// downward-bending tone, like the needle got yanked.
function sfxComboBreak(ctx, out) {
    const t0 = ctx.currentTime;
    const buf = makeNoiseBuffer(ctx, 0.3);
    noiseHit(ctx, out, buf, { start: t0, attack: 0.001, decay: 0.18, peak: 0.2, filterType: 'bandpass', filterFreq: 1800, freqEnd: 300, Q: 3 });
    tone(ctx, out, { type: 'sawtooth', freq: NOTE(-2), freqEnd: NOTE(-16), start: t0 + 0.01, attack: 0.001, decay: 0.22, peak: 0.16, filterFreq: 1200 });
}

// Sparkly ascending fanfare (~1s) for a new high score.
function sfxHighscore(ctx, out) {
    const t0 = ctx.currentTime;
    [0, 4, 7, 12, 16, 19].forEach((iv, i) => {
        tone(ctx, out, { type: 'triangle', freq: NOTE(iv), start: t0 + i * 0.09, attack: 0.003, decay: 0.24, peak: 0.18, filterFreq: 4200 });
        tone(ctx, out, { type: 'square', freq: NOTE(iv + 12), start: t0 + i * 0.09, attack: 0.002, decay: 0.1, peak: 0.05, filterFreq: 5000 });
    });
    tone(ctx, out, { type: 'sine', freq: NOTE(24), start: t0 + 0.55, attack: 0.005, decay: 0.5, peak: 0.16, filterFreq: 5500 });
}

const SFX_MAP = {
    shoot_chord: sfxShootChord,
    shoot_loop: sfxShootLoop,
    pickup_vinyl: sfxPickupVinyl,
    pickup_powerup: sfxPickupPowerup,
    convert: sfxConvert,
    slide: sfxSlide,
    bassdrop: sfxBassdrop,
    hurt: sfxHurt,
    stun: sfxStun,
    levelup: sfxLevelup,
    boss_roar: sfxBossRoar,
    boss_hit: sfxBossHit,
    boss_die: sfxBossDie,
    win: sfxWin,
    gameover: sfxGameover,
    ui_move: sfxUiMove,
    ui_select: sfxUiSelect,
    onbeat: sfxOnbeat,
    phantom_tele: sfxPhantomTele,
    golem_shockwave: sfxGolemShockwave,
    pause: sfxPause,
    combo_break: sfxComboBreak,
    highscore: sfxHighscore
};

export const SfxBank = {
    has(name) {
        return Object.prototype.hasOwnProperty.call(SFX_MAP, name);
    },
    play(ctx, out, name) {
        const fn = SFX_MAP[name];
        if (!fn) return false;
        fn(ctx, out);
        return true;
    }
};
