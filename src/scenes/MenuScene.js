// WS-E — see CONTRACTS.md Contract 6.
// Vaporwave title screen + character select.
import { PALETTE, CHARACTERS, GAME_W, GAME_H } from '../config.js';
import { TextureFactory } from '../gfx/TextureFactory.js';
import { AudioEngine } from '../audio/AudioEngine.js';

const CHAR_INFO = [
    {
        id: CHARACTERS.ELLIOT,
        name: 'ELLIOT — Guitar Cowboy',
        portrait: 'portrait_elliot',
        sprite: 'char_elliot',
        idleAnim: 'elliot-idle',
        blurb: ['Chord Burst spread', 'Sonic Slide'],
        accent: PALETTE.orange
    },
    {
        id: CHARACTERS.DAVE,
        name: 'DAVE — DJ Outrider',
        portrait: 'portrait_dave',
        sprite: 'char_dave',
        idleAnim: 'dave-idle',
        blurb: ['Piercing Loop Wave', 'Bass Drop stun'],
        accent: PALETTE.cyan
    }
];

const PANEL_CX = [220, 580];
const PANEL_CY = 340;
const PANEL_W = 240;
const PANEL_H = 300;

export default class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        // Contract 6: MUST be the first thing that happens in MenuScene.create().
        TextureFactory.generateAll(this);

        this.selectedIndex = 0;
        this.panels = [];
        this._transitioning = false;

        // ---- Autoplay-policy unlock: first keydown of ANY key arms audio. ----
        // Registered before any other input listener so it is always present
        // for the very first key press, whatever that key turns out to be.
        this._unlockAudio = () => {
            AudioEngine.init();
            AudioEngine.startMusic('menu');
        };
        this.input.keyboard.once('keydown', () => {
            this._unlockAudio();
            if (this.hintText) {
                this.tweens.add({ targets: this.hintText, alpha: 0, duration: 350 });
            }
        });

        this.buildBackground();
        this.buildTitle();
        this.buildCharacterSelect();
        this.buildHint();
        this.bindInput();
    }

    // ---------------------------------------------------------------- BG --

    buildBackground() {
        // Deep purple -> magenta dusk gradient.
        const grad = this.add.graphics().setDepth(0);
        grad.fillGradientStyle(PALETTE.bgTop, PALETTE.bgTop, PALETTE.bgBottom, PALETTE.bgBottom, 1);
        grad.fillRect(0, 0, GAME_W, GAME_H);

        this.drawSun();
        this.drawGrid();

        // Slow-drifting sparkle field.
        this.add.particles(0, 0, 'particle_soft', {
            x: { min: 0, max: GAME_W },
            y: { min: 0, max: GAME_H },
            lifespan: { min: 4000, max: 8000 },
            speedX: { min: -6, max: 6 },
            speedY: { min: -12, max: -3 },
            scale: { start: 1.6, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: [PALETTE.cyan, PALETTE.magenta, 0xffffff],
            quantity: 1,
            frequency: 160
        }).setDepth(3);

        // Disco ball, hanging top-center, gently swinging.
        const disco = this.add.sprite(GAME_W / 2, 62, 'disco_ball').setDepth(4).setScale(1.6);
        disco.play('disco-glint');
        this.tweens.add({
            targets: disco,
            angle: { from: -8, to: 8 },
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    drawSun() {
        // Retro banded sun, low on the horizon, partly occluded by the grid.
        const cx = GAME_W / 2;
        const cy = 360;
        const r = 150;
        const g = this.add.graphics().setDepth(1);
        const bandH = 9;
        const gap = 3;
        let i = 0;
        for (let y = cy - r; y < cy + r; y += bandH + gap) {
            const bandTop = y;
            const bandBottom = Math.min(y + bandH, cy + r);
            let dyNearest;
            if (bandTop <= cy && bandBottom >= cy) dyNearest = 0;
            else dyNearest = Math.min(Math.abs(bandTop - cy), Math.abs(bandBottom - cy));
            const halfW = Math.sqrt(Math.max(0, r * r - dyNearest * dyNearest));
            const color = i % 2 === 0 ? PALETTE.orange : PALETTE.magenta;
            g.fillStyle(color, 1);
            g.fillRect(cx - halfW, bandTop, halfW * 2, bandBottom - bandTop);
            i++;
        }
    }

    drawGrid() {
        // Subtle perspective floor grid across the lower third.
        const horizonY = 380;
        const vanishX = GAME_W / 2;
        const g = this.add.graphics().setDepth(2);
        g.lineStyle(1, PALETTE.cyan, 0.28);
        const numV = 14;
        for (let i = 0; i <= numV; i++) {
            const bx = (i / numV) * GAME_W;
            g.lineBetween(vanishX, horizonY, bx, GAME_H);
        }
        const numH = 7;
        for (let j = 1; j <= numH; j++) {
            const t = j / numH;
            const y = horizonY + (GAME_H - horizonY) * (t * t);
            g.lineBetween(0, y, GAME_W, y);
        }
    }

    // ------------------------------------------------------------- TITLE --

    buildTitle() {
        this.add.text(GAME_W / 2, 88, 'NOMADIC PRACTICE', {
            fontFamily: 'monospace',
            fontStyle: 'bold',
            fontSize: '14px',
            color: '#3cf0ff',
            letterSpacing: 8
        }).setOrigin(0.5).setDepth(5);

        const titleStr = 'GROOVE APOCALYPSE';
        const baseStyle = { fontFamily: 'monospace', fontStyle: 'bold', fontSize: '48px' };
        const ty = 148;

        // Fake chrome/neon: offset magenta + cyan copies behind a white-hot front layer.
        const back1 = this.add.text(GAME_W / 2 + 3, ty + 3, titleStr, { ...baseStyle, color: '#ff3cbe' })
            .setOrigin(0.5).setDepth(5);
        const back2 = this.add.text(GAME_W / 2 - 3, ty - 3, titleStr, { ...baseStyle, color: '#3cf0ff' })
            .setOrigin(0.5).setDepth(6);
        const front = this.add.text(GAME_W / 2, ty, titleStr, { ...baseStyle, color: '#ffffff' })
            .setOrigin(0.5).setDepth(7);

        this.tweens.add({
            targets: front,
            scale: { from: 1, to: 1.035 },
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: [back1, back2],
            alpha: { from: 0.7, to: 1 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    // -------------------------------------------------------- CHAR SELECT --

    buildCharacterSelect() {
        this.panels = CHAR_INFO.map((info, i) => this.createPanel(PANEL_CX[i], info));
        this.updateSelectionVisuals();
    }

    createPanel(cx, info) {
        const cy = PANEL_CY;
        const depth = 10;

        const glow = this.add.rectangle(cx, cy, PANEL_W + 26, PANEL_H + 26, info.accent, 0.18).setDepth(depth);
        const bg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0x0d0518, 0.72).setDepth(depth + 1);
        const border = this.add.rectangle(cx, cy, PANEL_W, PANEL_H)
            .setStrokeStyle(3, info.accent, 1).setDepth(depth + 2);

        const portrait = this.add.image(cx, cy - 74, info.portrait).setScale(2).setDepth(depth + 3);

        const name = this.add.text(cx, cy + 12, info.name, {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '13px', color: '#ffffff',
            align: 'center', wordWrap: { width: PANEL_W - 20 }
        }).setOrigin(0.5).setDepth(depth + 3);

        const blurb1 = this.add.text(cx, cy + 34, info.blurb[0], {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '11px', color: '#ffd23c'
        }).setOrigin(0.5).setDepth(depth + 3);
        const blurb2 = this.add.text(cx, cy + 50, info.blurb[1], {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '11px', color: '#ffd23c'
        }).setOrigin(0.5).setDepth(depth + 3);

        const sprite = this.add.sprite(cx, cy + 105, info.sprite).setScale(2).setDepth(depth + 3);
        sprite.play(info.idleAnim);

        return { glow, bg, border, portrait, name, blurb1, blurb2, sprite, info };
    }

    updateSelectionVisuals() {
        this.panels.forEach((p, i) => {
            const selected = i === this.selectedIndex;
            this.tweens.killTweensOf([p.bg, p.border, p.glow]);
            const scale = selected ? 1.08 : 0.94;
            this.tweens.add({
                targets: [p.bg, p.border, p.glow],
                scaleX: scale, scaleY: scale,
                duration: 220, ease: 'Back.easeOut'
            });
            p.border.setStrokeStyle(selected ? 4 : 2, p.info.accent, selected ? 1 : 0.35);
            p.glow.setAlpha(selected ? 0.32 : 0.08);
            p.bg.setAlpha(selected ? 0.82 : 0.55);
            [p.portrait, p.name, p.blurb1, p.blurb2, p.sprite].forEach((o) => o.setAlpha(selected ? 1 : 0.45));
        });
    }

    // -------------------------------------------------------------- HINT --

    buildHint() {
        this.hintText = this.add.text(GAME_W / 2, GAME_H - 20, 'press any key — sound on', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '12px', color: '#8a8a94'
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
            targets: this.hintText, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1
        });

        this.add.text(GAME_W / 2, GAME_H - 44, '← → / A D select    ENTER / SPACE confirm', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '11px', color: '#8c3cff'
        }).setOrigin(0.5).setDepth(20);
    }

    // ------------------------------------------------------------- INPUT --

    bindInput() {
        const moveLeft = () => this.moveSelection(-1);
        const moveRight = () => this.moveSelection(1);
        this.input.keyboard.on('keydown-LEFT', moveLeft);
        this.input.keyboard.on('keydown-A', moveLeft);
        this.input.keyboard.on('keydown-RIGHT', moveRight);
        this.input.keyboard.on('keydown-D', moveRight);
        this.input.keyboard.on('keydown-ENTER', () => this.confirmSelection());
        this.input.keyboard.on('keydown-SPACE', () => this.confirmSelection());
    }

    moveSelection(dir) {
        this._unlockAudio();
        const next = (this.selectedIndex + dir + this.panels.length) % this.panels.length;
        if (next === this.selectedIndex) return;
        this.selectedIndex = next;
        AudioEngine.sfx('ui_move');
        this.updateSelectionVisuals();
    }

    confirmSelection() {
        if (this._transitioning) return;
        this._transitioning = true;
        this._unlockAudio();
        AudioEngine.sfx('ui_select');
        const charId = CHAR_INFO[this.selectedIndex].id;
        this.time.delayedCall(120, () => {
            this.scene.start('GameScene', { charId });
            this.scene.launch('UIScene');
        });
    }
}
