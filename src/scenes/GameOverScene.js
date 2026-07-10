// WS-E — see CONTRACTS.md Contract 6.
import { PALETTE, CHARACTERS, GAME_W, GAME_H } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';

const CHAR_NAMES = {
    [CHARACTERS.ELLIOT]: 'Elliot — Guitar Cowboy',
    [CHARACTERS.DAVE]: 'Dave — DJ Outrider'
};

export default class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }

    create(data) {
        const { won, level, conversions, charId } = data || {};

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
            this.buildLoseTitle();
        }

        this.buildStats(level, conversions, charId);
        this.buildPrompt();
        this.bindInput();
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

    buildLoseTitle() {
        const title = this.add.text(GAME_W / 2, 130, 'SILENCED...', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '44px', color: '#8a8a94'
        }).setOrigin(0.5).setDepth(6);
        this.tweens.add({
            targets: title, alpha: { from: 1, to: 0.55 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    // ------------------------------------------------------------- STATS --

    buildStats(level, conversions, charId) {
        const charName = CHAR_NAMES[charId] || 'Unknown';
        const lines = [
            `LEVEL REACHED: ${level ?? '-'}`,
            `ZOMBOIDS GROOVED: ${conversions ?? 0}`,
            `CHARACTER: ${charName}`
        ];
        this.add.text(GAME_W / 2, 250, lines.join('\n'), {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '16px', color: '#ffffff',
            align: 'center', lineSpacing: 10
        }).setOrigin(0.5).setDepth(6);
    }

    buildPrompt() {
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

    bindInput() {
        const goToMenu = () => this.scene.start('MenuScene');
        this.input.keyboard.once('keydown-ENTER', goToMenu);
        this.input.keyboard.once('keydown-SPACE', goToMenu);
    }
}
