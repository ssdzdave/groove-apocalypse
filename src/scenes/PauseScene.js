// WS-E (Phase 3) — see CONTRACTS.md "PHASE 3 CONTRACTS" P3-E.
// Transparent overlay launched on top of a paused GameScene (D3: pause ducks,
// never suspends — the AudioContext keeps running so pause-menu SFX work).
import { PALETTE, GAME_W, GAME_H } from '../config.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Storage } from '../systems/Storage.js';

const GAMEPAD_REPEAT_MS = 250;
const GAMEPAD_DEADZONE = 0.25;
const SLIDER_SEGMENTS = 10;
const SLIDER_STEP = 0.1;

const LABEL_X = GAME_W / 2 - 150;
const CURSOR_X = LABEL_X - 24;
const BAR_X = GAME_W / 2 + 30;
const VALUE_X = GAME_W / 2 + 175;
const ROW0_Y = 262;
const ROW_H = 44;

export default class PauseScene extends Phaser.Scene {
    constructor() { super('PauseScene'); }

    create() {
        this.selectedIndex = 0;
        this._padNavAt = 0;
        this._padSliderAt = 0;
        this._padConfirmAt = 0;
        this._padResumeAt = 0;

        const settings = Storage.getSettings();
        this.values = { music: settings.musicVol, sfx: settings.sfxVol };

        this.items = [
            { key: 'resume', label: 'RESUME', type: 'action' },
            { key: 'music', label: 'MUSIC', type: 'slider' },
            { key: 'sfx', label: 'SFX', type: 'slider' },
            { key: 'restart', label: 'RESTART', type: 'action' },
            { key: 'quit', label: 'QUIT TO MENU', type: 'action' }
        ];

        this.buildOverlay();
        this.buildMenu();
        this.bindInput();
    }

    // -------------------------------------------------------------- BUILD --

    buildOverlay() {
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7).setDepth(1000);

        const ty = 168;
        const back = this.add.text(GAME_W / 2 + 2, ty + 2, 'PAUSED', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '38px', color: '#3cf0ff'
        }).setOrigin(0.5).setDepth(1001);
        this.add.text(GAME_W / 2, ty, 'PAUSED', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '38px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(1002);
        this.tweens.add({
            targets: back, alpha: { from: 0.5, to: 1 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    buildMenu() {
        this.rows = this.items.map((item, i) => this.createRow(item, ROW0_Y + i * ROW_H));
        this.refreshSelection();
    }

    createRow(item, y) {
        const cursor = this.add.text(CURSOR_X, y, '▶', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '16px', color: '#ffd23c'
        }).setOrigin(0.5).setDepth(1002).setVisible(false);

        const label = this.add.text(LABEL_X, y, item.label, {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '17px', color: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(1001);

        const row = { item, cursor, label };

        if (item.type === 'slider') {
            const segW = 10, segGap = 3, segH = 16;
            const totalW = SLIDER_SEGMENTS * (segW + segGap) - segGap;
            row.bg = this.add.rectangle(BAR_X + totalW / 2, y, totalW + 8, segH + 6, 0x000000, 0.4)
                .setStrokeStyle(1, 0xffffff, 0.25).setDepth(1001);
            row.segs = [];
            for (let s = 0; s < SLIDER_SEGMENTS; s++) {
                const sx = BAR_X + s * (segW + segGap) + segW / 2;
                row.segs.push(this.add.rectangle(sx, y, segW, segH, PALETTE.gold, 1).setDepth(1002));
            }
            row.valueText = this.add.text(VALUE_X, y, '100%', {
                fontFamily: 'monospace', fontStyle: 'bold', fontSize: '13px', color: '#ffd23c'
            }).setOrigin(0, 0.5).setDepth(1001);
            this.updateSliderVisual(row);
        }

        return row;
    }

    updateSliderVisual(row) {
        const val = this.values[row.item.key];
        const filled = Math.round(val * SLIDER_SEGMENTS);
        row.segs.forEach((seg, i) => {
            if (i < filled) seg.setFillStyle(PALETTE.gold, 1);
            else seg.setFillStyle(PALETTE.gray, 0.35);
        });
        row.valueText.setText(`${Math.round(val * 100)}%`);
    }

    refreshSelection() {
        this.rows.forEach((row, i) => {
            const selected = i === this.selectedIndex;
            row.cursor.setVisible(selected);
            row.label.setColor(selected ? '#ffd23c' : '#ffffff');
        });
    }

    // -------------------------------------------------------------- NAV --

    moveSelection(dir) {
        const n = this.items.length;
        this.selectedIndex = (this.selectedIndex + dir + n) % n;
        AudioEngine.sfx('ui_move');
        this.refreshSelection();
    }

    adjustSlider(dir) {
        const row = this.rows[this.selectedIndex];
        if (!row || row.item.type !== 'slider') return;
        const key = row.item.key;
        const raw = this.values[key] + dir * SLIDER_STEP;
        const next = Phaser.Math.Clamp(Math.round(raw * 10) / 10, 0, 1);
        if (next === this.values[key]) return;
        this.values[key] = next;
        this.updateSliderVisual(row);
        if (key === 'music') {
            AudioEngine.setMusicVolume(next);
            Storage.saveSettings({ musicVol: next });
        } else {
            AudioEngine.setSfxVolume(next);
            Storage.saveSettings({ sfxVol: next });
        }
    }

    activateSelected() {
        const item = this.items[this.selectedIndex];
        if (item.type === 'slider') return;
        AudioEngine.sfx('ui_select');
        if (item.key === 'resume') this.doResume();
        else if (item.key === 'restart') this.doRestart();
        else if (item.key === 'quit') this.doQuit();
    }

    // ---------------------------------------------------------- ACTIONS --

    doResume() {
        AudioEngine.setDucked(false);
        this.scene.stop();
        this.scene.resume('GameScene');
    }

    doRestart() {
        const gs = this.scene.get('GameScene');
        const charId = gs ? gs.charId : undefined;
        AudioEngine.setDucked(false);
        this.scene.stop('UIScene');
        this.scene.stop('GameScene');
        this.scene.stop();
        this.scene.start('GameScene', { charId });
        this.scene.launch('UIScene');
    }

    doQuit() {
        AudioEngine.setDucked(false);
        this.scene.stop('UIScene');
        this.scene.stop('GameScene');
        this.scene.stop();
        this.scene.start('MenuScene');
        AudioEngine.startMusic('menu');
    }

    // ------------------------------------------------------------- INPUT --

    bindInput() {
        const up = () => this.moveSelection(-1);
        const down = () => this.moveSelection(1);
        const left = () => this.adjustSlider(-1);
        const right = () => this.adjustSlider(1);
        const activate = () => this.activateSelected();
        const resumeShortcut = () => this.doResume();

        // Scene-local keyboard plugin — listeners are torn down automatically
        // when this scene shuts down (Phaser InputPlugin shutdown).
        this.input.keyboard.on('keydown-UP', up);
        this.input.keyboard.on('keydown-W', up);
        this.input.keyboard.on('keydown-DOWN', down);
        this.input.keyboard.on('keydown-S', down);
        this.input.keyboard.on('keydown-LEFT', left);
        this.input.keyboard.on('keydown-A', left);
        this.input.keyboard.on('keydown-RIGHT', right);
        this.input.keyboard.on('keydown-D', right);
        this.input.keyboard.on('keydown-ENTER', activate);
        this.input.keyboard.on('keydown-SPACE', activate);
        this.input.keyboard.on('keydown-ESC', resumeShortcut);
        this.input.keyboard.on('keydown-P', resumeShortcut);
    }

    // D7: dpad up/down nav, left/right sliders, A activate, Start/B resume.
    // Polled (not event-bound) so nothing needs manual teardown on shutdown.
    update(time) {
        const gp = this.input.gamepad;
        if (!gp || gp.total === 0) return;
        const pad = gp.getPad(0);
        if (!pad) return;

        const stickY = pad.leftStick ? pad.leftStick.y : 0;
        const stickX = pad.leftStick ? pad.leftStick.x : 0;
        const navUp = pad.up || stickY < -GAMEPAD_DEADZONE;
        const navDown = pad.down || stickY > GAMEPAD_DEADZONE;
        const navLeft = pad.left || stickX < -GAMEPAD_DEADZONE;
        const navRight = pad.right || stickX > GAMEPAD_DEADZONE;

        if ((navUp || navDown) && time - this._padNavAt > GAMEPAD_REPEAT_MS) {
            this._padNavAt = time;
            this.moveSelection(navUp ? -1 : 1);
        }
        if ((navLeft || navRight) && time - this._padSliderAt > GAMEPAD_REPEAT_MS) {
            this._padSliderAt = time;
            this.adjustSlider(navLeft ? -1 : 1);
        }

        const aPressed = pad.buttons[0] && pad.buttons[0].pressed;
        if (aPressed && time - this._padConfirmAt > GAMEPAD_REPEAT_MS) {
            this._padConfirmAt = time;
            this.activateSelected();
        }

        const resumePressed = (pad.buttons[9] && pad.buttons[9].pressed) ||
            (pad.buttons[1] && pad.buttons[1].pressed);
        if (resumePressed && time - this._padResumeAt > GAMEPAD_REPEAT_MS) {
            this._padResumeAt = time;
            this.doResume();
        }
    }
}
