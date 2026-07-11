// WS-E — see CONTRACTS.md Contract 6 + PHASE 3 CONTRACTS P3-E.
import { PALETTE, CHARACTERS, GAME_W, GAME_H } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Storage } from '../systems/Storage.js';

const CHAR_NAMES = {
    [CHARACTERS.ELLIOT]: 'Elliot — Guitar Cowboy',
    [CHARACTERS.DAVE]: 'Dave — DJ Outrider'
};

export default class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }

    create(data) {
        const {
            won, level, conversions, charId,
            score = 0, maxCombo = 0, endless = false, canContinue = false
        } = data || {};
        this._data = data || {};

        this.buildBackground(won);

        if (won) {
            AudioEngine.startMusic('win');
            AudioEngine.sfx('win');
            this.buildWinTitle();
            this.buildDancers();
            this.buildConfetti();
        } else {
            AudioEngine.stopMusic();
            AudioEngine.sfx('gameover');
            this.buildLoseTitle(endless, level);
        }

        this.buildStats(level, conversions, charId, score, maxCombo);

        // Persist exactly once per game-over.
        let result = { rank: null, isNewHigh: false };
        try {
            result = Storage.submitScore({ score, charId, level, endless, date: Date.now() }) || result;
        } catch (e) {
            // Storage is try/catch-wrapped internally too; belt & suspenders.
        }
        if (result.isNewHigh) {
            this.buildNewHighBanner();
            AudioEngine.sfx('highscore');
        }

        this.buildPrompt(canContinue);
        this.bindInput(canContinue);
    }

    // ---------------------------------------------------------------- BG --

    buildBackground(won) {
        const topC = won ? PALETTE.bgTop : 0x0a0a0a;
        const botC = won ? PALETTE.bgBottom : 0x1a0a12;
        const grad = this.add.graphics().setDepth(0);
        grad.fillGradientStyle(topC, topC, botC, botC, 1);
        grad.fillRect(0, 0, GAME_W, GAME_H);

        const g = this.add.graphics().setDepth(1);
        const gridColor = won ? PALETTE.cyan : PALETTE.gray;
        g.lineStyle(1, gridColor, won ? 0.18 : 0.12);
        const horizonY = 400;
        const vanishX = GAME_W / 2;
        for (let i = 0; i <= 10; i++) {
            const bx = (i / 10) * GAME_W;
            g.lineBetween(vanishX, horizonY, bx, GAME_H);
        }
        for (let j = 1; j <= 5; j++) {
            const t = j / 5;
            const y = horizonY + (GAME_H - horizonY) * (t * t);
            g.lineBetween(0, y, GAME_W, y);
        }
    }

    // ------------------------------------------------------------- TITLE --

    buildWinTitle() {
        const ty = 120;
        const back = this.add.text(GAME_W / 2 - 3, ty - 3, 'GROOVE RESTORED!', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '42px', color: '#3cf0ff'
        }).setOrigin(0.5).setDepth(5);
        const front = this.add.text(GAME_W / 2, ty, 'GROOVE RESTORED!', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '42px', color: '#ffd23c'
        }).setOrigin(0.5).setDepth(6);
        this.tweens.add({
            targets: front, scale: { from: 1, to: 1.05 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: back, alpha: { from: 0.6, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    buildLoseTitle(endless, level) {
        const text = endless ? `RODE TO LEVEL ${level ?? '-'}` : 'SILENCED...';
        const title = this.add.text(GAME_W / 2, 130, text, {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '44px', color: '#8a8a94'
        }).setOrigin(0.5).setDepth(6);
        this.tweens.add({
            targets: title, alpha: { from: 1, to: 0.55 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    // ------------------------------------------------------------- STATS --

    buildStats(level, conversions, charId, score, maxCombo) {
        const charName = CHAR_NAMES[charId] || 'Unknown';
        const scoreStr = String(Math.max(0, Math.floor(score || 0))).padStart(6, '0');
        const lines = [
            `LEVEL REACHED: ${level ?? '-'}`,
            `SCORE: ${scoreStr}`,
            `BEST COMBO ×${maxCombo || 0}`,
            `ZOMBOIDS GROOVED: ${conversions ?? 0}`,
            `CHARACTER: ${charName}`
        ];
        this.add.text(GAME_W / 2, 260, lines.join('\n'), {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '15px', color: '#ffffff',
            align: 'center', lineSpacing: 8
        }).setOrigin(0.5).setDepth(6);
    }

    buildNewHighBanner() {
        const banner = this.add.text(GAME_W / 2, 182, '★ NEW HIGH SCORE ★', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '18px', color: '#ffd23c'
        }).setOrigin(0.5).setDepth(6);
        this.tweens.add({
            targets: banner, scale: { from: 1, to: 1.18 }, alpha: { from: 1, to: 0.65 },
            duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    buildPrompt(canContinue) {
        if (canContinue) {
            const prompt = this.add.text(GAME_W / 2, GAME_H - 54,
                'ENTER — KEEP RIDING (ENDLESS)\nESC — BACK TO MENU', {
                    fontFamily: 'monospace', fontStyle: 'bold', fontSize: '14px', color: '#ffd23c',
                    align: 'center', lineSpacing: 8
                }).setOrigin(0.5).setDepth(6);
            this.tweens.add({
                targets: prompt, alpha: { from: 1, to: 0.2 }, duration: 550, yoyo: true, repeat: -1
            });
            return;
        }
        const prompt = this.add.text(GAME_W / 2, GAME_H - 60, 'ENTER — RIDE AGAIN', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '16px', color: '#ffd23c'
        }).setOrigin(0.5).setDepth(6);
        this.tweens.add({
            targets: prompt, alpha: { from: 1, to: 0.15 }, duration: 550, yoyo: true, repeat: -1
        });
    }

    // ---------------------------------------------------------------- FX --

    buildDancers() {
        const count = 5;
        const spacing = GAME_W / (count + 1);
        for (let i = 0; i < count; i++) {
            const x = spacing * (i + 1);
            const sprite = this.add.sprite(x, GAME_H - 90, 'dancer').setDepth(4).setScale(1.6);
            sprite.play({ key: 'dancer-dance', startFrame: Phaser.Math.Between(0, 5) });
        }
    }

    buildConfetti() {
        this.add.particles(0, -10, 'particle_soft', {
            x: { min: 0, max: GAME_W },
            y: -10,
            lifespan: { min: 2500, max: 4500 },
            speedY: { min: 40, max: 110 },
            speedX: { min: -30, max: 30 },
            scale: { start: 1.4, end: 0.2 },
            alpha: { start: 1, end: 0 },
            tint: [PALETTE.gold, PALETTE.cyan, PALETTE.magenta, 0xffffff],
            quantity: 2,
            frequency: 90
        }).setDepth(3);
    }

    // ------------------------------------------------------------- INPUT --

    bindInput(canContinue) {
        this._navigated = false;
        const data = this._data;

        const goEndless = () => {
            if (this._navigated) return;
            this._navigated = true;
            this.scene.start('GameScene', {
                charId: data.charId, endless: true, startLevel: 7,
                carry: { score: data.score, conversions: data.conversions }
            });
            this.scene.launch('UIScene');
        };
        const goMenu = () => {
            if (this._navigated) return;
            this._navigated = true;
            this.scene.start('MenuScene');
        };
        const confirm = () => (canContinue ? goEndless() : goMenu());

        this.input.keyboard.once('keydown-ENTER', confirm);
        this.input.keyboard.once('keydown-SPACE', confirm);
        if (canContinue) this.input.keyboard.once('keydown-ESC', goMenu);

        // D7: gamepad A/Start mirrors Enter; B mirrors ESC (only meaningful
        // in the canContinue two-option prompt).
        if (this.input.gamepad) {
            const onPadDown = (pad, button) => {
                if (this._navigated) return;
                const idx = button.index;
                if (idx === 0 || idx === 9) confirm();
                else if (idx === 1 && canContinue) goMenu();
            };
            this.input.gamepad.on('down', onPadDown);
            this.events.once('shutdown', () => this.input.gamepad.off('down', onPadDown));
        }
    }
}
