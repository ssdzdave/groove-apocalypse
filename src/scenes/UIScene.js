// WS-E — see CONTRACTS.md Contract 6 + PHASE 3 CONTRACTS P3-E.
// Transparent HUD overlay, driven purely by this.game.events.on(EVT.*).
import { PALETTE, EVT, GAME_W, GAME_H, COMBO_WINDOW_MS } from '../config.js';
import { getZoneForLevel } from '../gfx/ZoneThemes.js';
import { AudioEngine } from '../audio/AudioEngine.js';

const HUD_Y = GAME_H - 12; // vertical center of the bottom 24px HUD strip
const POWERUP_DURATION = { tonic: 5000, tape: 5000 };
const POWERUP_COLOR = { tonic: PALETTE.cyan, tape: PALETTE.magenta };
const POWERUP_Y = { tonic: GAME_H - 48, tape: GAME_H - 36 };

export default class UIScene extends Phaser.Scene {
    constructor() { super('UIScene'); }

    create() {
        this.maxHp = 3;
        this.hp = 3;
        this.mugs = [];
        this.powerupBars = {};
        this.levelBannerGroup = [];
        this._specialGlowTween = null;

        this._bossName = 'BOSS';
        this._comboShown = false;
        this._comboDrainTween = null;
        this._comboBarW = 90;
        this._lastCombo = 0;

        this.buildHealth();
        this.buildVinylCounter();
        this.buildSpecialIndicator();
        this.buildBossBar();
        this.buildScoreCombo();
        this.buildBeatIndicator();
        this.buildCRT();
        this.bindEvents();
    }

    // ------------------------------------------------------------ HEALTH --

    buildHealth() {
        this.rebuildMugs();
    }

    rebuildMugs() {
        this.mugs.forEach((m) => m.destroy());
        this.mugs = [];
        for (let i = 0; i < this.maxHp; i++) {
            const img = this.add.image(14 + i * 20, HUD_Y, 'pickup_beer', 0).setScale(0.5).setDepth(50);
            this.mugs.push(img);
        }
        this.refreshMugs();
    }

    refreshMugs() {
        this.mugs.forEach((m, i) => m.setAlpha(i < this.hp ? 1 : 0.25));
    }

    handlePlayerHp = (hp, maxHp) => {
        const needsRebuild = maxHp !== this.maxHp || this.mugs.length === 0;
        this.hp = hp;
        this.maxHp = maxHp;
        if (needsRebuild) this.rebuildMugs();
        else this.refreshMugs();
    };

    // -------------------------------------------------------- VINYL/EVT --

    buildVinylCounter() {
        this.vinylText = this.add.text(14 + this.maxHp * 20 + 12, HUD_Y, '♪ 0/0', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '14px', color: '#ffd23c'
        }).setOrigin(0, 0.5).setDepth(50);
    }

    handleVinyls = (collected, needed) => {
        this.vinylText.setText(`♪ ${collected}/${needed}`);
    };

    // ----------------------------------------------------------- SPECIAL --

    buildSpecialIndicator() {
        const x = GAME_W - 70;
        this.specialGlow = this.add.rectangle(x, HUD_Y, 66, 18, PALETTE.gold, 0).setDepth(49);
        this.specialBarBg = this.add.rectangle(x, HUD_Y, 56, 12).setStrokeStyle(2, 0xffffff, 0.6).setDepth(50);
        this.specialBarFill = this.add.rectangle(x - 28, HUD_Y, 1, 8, PALETTE.cyan).setOrigin(0, 0.5).setDepth(51);
        this.specialLabel = this.add.text(x - 46, HUD_Y, 'E', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '12px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(51);
    }

    handleSpecialReady = (ready, cooldownFrac) => {
        const innerW = 52;
        const w = Math.max(1, innerW * Phaser.Math.Clamp(cooldownFrac, 0, 1));
        this.specialBarFill.setSize(w, 8);
        if (ready) {
            this.specialBarFill.setFillStyle(PALETTE.gold);
            if (!this._specialGlowTween) {
                this._specialGlowTween = this.tweens.add({
                    targets: this.specialGlow, alpha: { from: 0, to: 0.55 }, duration: 380, yoyo: true, repeat: -1
                });
            }
        } else {
            this.specialBarFill.setFillStyle(PALETTE.cyan);
            if (this._specialGlowTween) {
                this._specialGlowTween.stop();
                this._specialGlowTween = null;
            }
            this.specialGlow.setAlpha(0);
        }
    };

    // ---------------------------------------------------------- POWERUPS --

    handlePowerup = (payload) => {
        const { type, remainingMs } = payload || {};
        if (!type) return;
        if (!remainingMs || remainingMs <= 0) {
            const bar = this.powerupBars[type];
            if (bar) {
                bar.bg.destroy();
                bar.fill.destroy();
                bar.label.destroy();
                delete this.powerupBars[type];
            }
            return;
        }
        const maxDur = POWERUP_DURATION[type] || remainingMs;
        const frac = Phaser.Math.Clamp(remainingMs / maxDur, 0, 1);
        let bar = this.powerupBars[type];
        if (!bar) {
            const y = POWERUP_Y[type] || (GAME_H - 48);
            const bg = this.add.rectangle(14, y, 100, 6, 0x000000, 0.45).setOrigin(0, 0.5).setDepth(50);
            const fill = this.add.rectangle(14, y, 100, 6, POWERUP_COLOR[type] || 0xffffff).setOrigin(0, 0.5).setDepth(51);
            const label = this.add.text(120, y, type.toUpperCase(), {
                fontFamily: 'monospace', fontStyle: 'bold', fontSize: '9px', color: '#ffffff'
            }).setOrigin(0, 0.5).setDepth(51);
            bar = { bg, fill, label };
            this.powerupBars[type] = bar;
        }
        bar.fill.setSize(Math.max(1, 100 * frac), 6);
    };

    // ------------------------------------------------------- LEVEL START --

    handleLevelStart = (payload) => {
        const { level, zoneName, isBoss, bossName } = payload || {};
        this._bossName = (bossName || 'BOSS').toUpperCase();
        if (this.bossLabel) this.bossLabel.setText(this._bossName);
        if (this.levelBannerGroup.length) {
            this.tweens.killTweensOf(this.levelBannerGroup);
            this.levelBannerGroup.forEach((o) => o.destroy());
        }
        this.levelBannerGroup = [];

        const zone = getZoneForLevel(level);
        const accent = (zone && zone.accent !== undefined) ? zone.accent : PALETTE.cyan;
        const colorStr = '#' + accent.toString(16).padStart(6, '0');
        const label = (zoneName || (zone && zone.name) || '').toUpperCase();

        const title = this.add.text(GAME_W / 2, 210, `LEVEL ${level} — ${label}`, {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '26px', color: colorStr
        }).setOrigin(0.5).setAlpha(0).setDepth(60);
        const items = [title];

        if (isBoss) {
            const warn = this.add.text(GAME_W / 2, 246, this._bossName, {
                fontFamily: 'monospace', fontStyle: 'bold', fontSize: '18px', color: '#ff3c3c'
            }).setOrigin(0.5).setAlpha(0).setDepth(60);
            const hint = this.add.text(GAME_W / 2, 272, 'ONLY YOUR SPECIAL [E] CAN HURT HIM', {
                fontFamily: 'monospace', fontStyle: 'bold', fontSize: '13px', color: '#ffd23c'
            }).setOrigin(0.5).setAlpha(0).setDepth(60);
            items.push(warn, hint);
        }

        this.levelBannerGroup = items;
        this.tweens.add({
            targets: items,
            alpha: { from: 0, to: 1 },
            duration: 350,
            yoyo: true,
            hold: isBoss ? 2600 : 1300,
            onComplete: () => {
                items.forEach((o) => o.destroy());
                if (this.levelBannerGroup === items) this.levelBannerGroup = [];
            }
        });
    };

    // ------------------------------------------------------------ BOSS HP --

    buildBossBar() {
        const x = GAME_W / 2;
        this.bossBarBg = this.add.rectangle(x, 20, 204, 18, 0x000000, 0.55)
            .setStrokeStyle(2, 0xffffff, 0.5).setDepth(60).setVisible(false);
        this.bossBarFill = this.add.rectangle(x - 100, 20, 200, 14, 0xff3c3c)
            .setOrigin(0, 0.5).setDepth(61).setVisible(false);
        this.bossLabel = this.add.text(x, 20, this._bossName, {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '11px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(62).setVisible(false);
    }

    handleBossHp = (hp, maxHp) => {
        if (hp === null || hp === undefined) {
            this.bossBarBg.setVisible(false);
            this.bossBarFill.setVisible(false);
            this.bossLabel.setVisible(false);
            return;
        }
        this.bossBarBg.setVisible(true);
        this.bossBarFill.setVisible(true);
        this.bossLabel.setVisible(true);
        const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
        this.bossBarFill.setSize(Math.max(1, 200 * frac), 14);
    };

    // ------------------------------------------------------- SCORE/COMBO --

    buildScoreCombo() {
        const rx = GAME_W - 12;
        this.scoreText = this.add.text(rx, 10, 'SCORE 000000', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '16px', color: '#ffffff'
        }).setOrigin(1, 0).setDepth(55);

        this.comboText = this.add.text(rx, 32, '×0', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '13px', color: '#ffd23c'
        }).setOrigin(1, 0).setDepth(55).setVisible(false);

        this.comboBarBg = this.add.rectangle(rx, 50, this._comboBarW, 5, 0x000000, 0.5)
            .setOrigin(1, 0.5).setDepth(55).setVisible(false);
        this.comboBarFill = this.add.rectangle(rx, 50, this._comboBarW, 5, PALETTE.gold)
            .setOrigin(1, 0.5).setDepth(56).setVisible(false);
    }

    handleScore = (payload) => {
        const { score, combo, onBeat } = payload || {};
        if (typeof score === 'number') {
            const clamped = Math.max(0, Math.min(999999, Math.floor(score)));
            this.scoreText.setText('SCORE ' + String(clamped).padStart(6, '0'));
            this.tweens.killTweensOf(this.scoreText);
            this.scoreText.setScale(1);
            this.tweens.add({
                targets: this.scoreText, scale: 1.25, duration: 90, yoyo: true, ease: 'Quad.easeOut'
            });
        }
        if (typeof combo === 'number') {
            // Only a combo-ADVANCING award (combo went up) restarts the drain
            // window; a combo-exempt award (vinyl/level-clear/boss) reported
            // alongside an unchanged combo just re-syncs the display.
            if (combo > this._lastCombo) this.restartComboDrain(combo);
            else this.syncComboDisplay(combo);
            this._lastCombo = combo;
        }
        if (onBeat) this.beatBurstFlash();
    };

    syncComboDisplay(combo) {
        if (combo <= 1) {
            this.comboText.setVisible(false);
            this.comboBarBg.setVisible(false);
            this.comboBarFill.setVisible(false);
            this._comboShown = false;
            return;
        }
        this._comboShown = true;
        this.comboText.setText(`×${combo}`).setColor('#ffd23c').setAlpha(1).setVisible(true);
        this.comboBarBg.setVisible(true);
        this.comboBarFill.setVisible(true);
    }

    restartComboDrain(combo) {
        this.syncComboDisplay(combo);
        if (combo <= 1) {
            if (this._comboDrainTween) {
                this._comboDrainTween.stop();
                this._comboDrainTween = null;
            }
            return;
        }
        if (this._comboDrainTween) this._comboDrainTween.stop();
        this.comboBarFill.setSize(this._comboBarW, 5);
        this._comboDrainTween = this.tweens.addCounter({
            from: this._comboBarW, to: 0, duration: COMBO_WINDOW_MS, ease: 'Linear',
            onUpdate: (tw) => this.comboBarFill.setSize(Math.max(0, tw.getValue()), 5)
        });
    }

    handleCombo = (payload) => {
        const { combo } = payload || {};
        if (combo === 0) {
            if (this._comboShown) this.flashComboBreak();
            this.restartComboDrain(0);
            this._lastCombo = 0;
        }
    };

    flashComboBreak() {
        AudioEngine.sfx('combo_break');
        this.tweens.killTweensOf(this.comboText);
        this.comboText.setColor('#ff3c3c').setAlpha(1);
        this.tweens.add({
            targets: this.comboText, alpha: { from: 1, to: 0 }, duration: 260, ease: 'Quad.easeIn'
        });
    }

    // ------------------------------------------------------- BEAT INDICATOR --

    buildBeatIndicator() {
        this.beatNote = this.add.sprite(GAME_W / 2, HUD_Y, 'ui_note', 0).setDepth(50);
        this.beatBurst = this.add.circle(GAME_W / 2, HUD_Y, 14, PALETTE.gold, 0).setDepth(49);
        this.tweens.add({
            targets: this.beatNote, alpha: { from: 0.55, to: 0.9 }, duration: 700,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    handleBeat = () => {
        this.tweens.killTweensOf(this.beatNote);
        this.beatNote.setFrame(1).setScale(1).setAlpha(1);
        this.tweens.add({
            targets: this.beatNote, scale: 1.5, duration: 70, yoyo: true, ease: 'Quad.easeOut',
            onComplete: () => this.beatNote.setFrame(0)
        });
    };

    beatBurstFlash() {
        this.tweens.killTweensOf(this.beatBurst);
        this.beatBurst.setScale(0.6).setAlpha(0.8);
        this.tweens.add({
            targets: this.beatBurst, scale: 1.9, alpha: 0, duration: 280, ease: 'Quad.easeOut'
        });
    }

    // ---------------------------------------------------------------- CRT --

    buildCRT() {
        const vignette = this.add.graphics().setDepth(998);
        const edge = 90;
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.32, 0.32, 0, 0);
        vignette.fillRect(0, 0, GAME_W, edge);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.32, 0.32);
        vignette.fillRect(0, GAME_H - edge, GAME_W, edge);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.32, 0, 0.32, 0);
        vignette.fillRect(0, 0, edge, GAME_H);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.32, 0, 0.32);
        vignette.fillRect(GAME_W - edge, 0, edge, GAME_H);

        this.crt = this.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 'scanline')
            .setDepth(999).setAlpha(0.12);
    }

    // ------------------------------------------------------------ GAMEOVER --

    handleGameOver = (payload) => {
        // Small delay so the death/win moment lands before we transition away.
        this.time.delayedCall(900, () => {
            this.scene.stop('GameScene');
            this.scene.stop();
            this.scene.start('GameOverScene', payload);
        });
    };

    // ----------------------------------------------------------- LIFECYCLE --

    bindEvents() {
        this._listeners = [
            [EVT.PLAYER_HP, this.handlePlayerHp],
            [EVT.VINYLS, this.handleVinyls],
            [EVT.SPECIAL_READY, this.handleSpecialReady],
            [EVT.POWERUP, this.handlePowerup],
            [EVT.LEVEL_START, this.handleLevelStart],
            [EVT.BOSS_HP, this.handleBossHp],
            [EVT.GAME_OVER, this.handleGameOver],
            [EVT.SCORE, this.handleScore],
            [EVT.COMBO, this.handleCombo],
            [EVT.BEAT, this.handleBeat]
        ];
        this._listeners.forEach(([evt, fn]) => this.game.events.on(evt, fn));
        this.events.on('shutdown', this.handleShutdown, this);
    }

    handleShutdown = () => {
        if (this._listeners) {
            this._listeners.forEach(([evt, fn]) => this.game.events.off(evt, fn));
            this._listeners = [];
        }
        this.events.off('shutdown', this.handleShutdown, this);
    };
}
