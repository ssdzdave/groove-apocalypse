// WS-F (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-F. Direct-call model (D2);
// emits EVT.SCORE/EVT.COMBO on scene.game.events; listens to NOTHING.
import { SCORE_VALUES, COMBO_WINDOW_MS, EVT, PALETTE } from '../config.js';
import { Juice } from '../fx/Juice.js';

export default class ScoreSystem {
    constructor(scene, carry = null) {
        this.scene = scene;
        this._score = (carry && typeof carry.score === 'number') ? carry.score : 0;
        this._combo = 0;
        this._maxCombo = 0;
        this._expiryTimer = null;
    }

    // ---- public API (pinned signatures) ----

    onConversion(x, y, { elite = false, onBeat = false, kind = 'zomboid' } = {}) {
        let reason;
        if (kind === 'golem') reason = 'golem_convert';
        else if (kind === 'phantom') reason = 'phantom_convert';
        else reason = elite ? 'elite_convert' : 'convert';
        return this._award(reason, x, y, { onBeat, comboEligible: true });
    }

    onKill(x, y, { kind = 'drone', onBeat = false } = {}) {
        return this._award('drone_kill', x, y, { onBeat, comboEligible: true });
    }

    onVinyl(x, y) {
        return this._award('vinyl', x, y, { onBeat: false, comboEligible: false });
    }

    onLevelClear(level) {
        return this._award('level_clear', undefined, undefined, { onBeat: false, comboEligible: false });
    }

    onBossDefeated(x, y) {
        return this._award('boss_defeat', x, y, { onBeat: false, comboEligible: false });
    }

    notifyPlayerDamaged() {
        if (this._combo > 0) {
            this._clearExpiry();
            this._combo = 0;
            this._emit(EVT.COMBO, { combo: 0, comboMult: 1 });
        }
    }

    get score() { return this._score; }
    get combo() { return this._combo; }
    get maxCombo() { return this._maxCombo; }

    destroy() {
        this._clearExpiry();
    }

    // ---- internals ----

    _award(reason, x, y, { onBeat = false, comboEligible = false } = {}) {
        if (!this.scene) return 0;

        let base = SCORE_VALUES[reason];
        if (typeof base !== 'number') {
            console.warn(`ScoreSystem: unknown score reason "${reason}"`);
            base = 0;
        }
        if (onBeat) base *= 2;

        let comboMult;
        if (comboEligible) {
            this._combo += 1;
            this._maxCombo = Math.max(this._maxCombo, this._combo);
            comboMult = Math.min(1 + 0.25 * (this._combo - 1), 3);
            this._scheduleExpiry();
            this._emit(EVT.COMBO, { combo: this._combo, comboMult });
        } else {
            // Combo-exempt awards: flat multiplier, never touch the running combo.
            comboMult = 1;
        }

        const delta = Math.round(base * comboMult);
        this._score += delta;

        this._emit(EVT.SCORE, {
            score: this._score,
            delta,
            combo: this._combo,
            comboMult,
            reason,
            x,
            y,
            onBeat
        });

        this._popup(x, y, delta, onBeat, comboEligible);

        return delta;
    }

    _popup(x, y, delta, onBeat, comboEligible) {
        if (!this.scene || !this.scene.add) return;

        let px = x;
        let py = y;
        if (px === undefined || px === null || py === undefined || py === null) {
            if (this.scene.player && typeof this.scene.player.x === 'number' && typeof this.scene.player.y === 'number') {
                px = this.scene.player.x;
                py = this.scene.player.y;
            } else {
                return; // no coords available — skip the popup, score/EVT already applied
            }
        }

        let text = `+${delta}`;
        let color;
        if (comboEligible) {
            if (this._combo >= 2) text += ` ×${this._combo}`;
            if (onBeat) {
                color = PALETTE.gold;
                text += ' ON BEAT!';
            } else {
                color = PALETTE.cyan;
            }
        } else {
            // vinyl / level_clear / boss_defeat: plain gold popup, no combo suffix.
            color = PALETTE.gold;
        }

        try {
            Juice.floatText(this.scene, px, py, text, color);
        } catch (e) {
            // defensive: never let a popup failure break scoring
        }
    }

    _clearExpiry() {
        if (this._expiryTimer) {
            try { this._expiryTimer.remove(false); } catch (e) { /* ignore */ }
            this._expiryTimer = null;
        }
    }

    _scheduleExpiry() {
        this._clearExpiry();
        if (!this.scene || !this.scene.time || typeof this.scene.time.delayedCall !== 'function') return;
        try {
            this._expiryTimer = this.scene.time.delayedCall(COMBO_WINDOW_MS, () => this._onExpire());
        } catch (e) {
            this._expiryTimer = null;
        }
    }

    _onExpire() {
        this._expiryTimer = null;
        this._combo = 0;
        this._emit(EVT.COMBO, { combo: 0, comboMult: 1 });
    }

    _emit(name, payload) {
        try {
            if (this.scene && this.scene.game && this.scene.game.events) {
                this.scene.game.events.emit(name, payload);
            }
        } catch (e) {
            // defensive: scene may be mid-shutdown
        }
    }
}
