// Debug overlay — toggled with backtick (`) from GameScene. The game keeps
// running while it is open; hotkeys here drive GameScene's debug* helpers.
import { GAME_W, PALETTE } from '../config.js';

const AMBER = '#ffb000';
const DIM = '#8a8a94';

export default class DebugScene extends Phaser.Scene {
    constructor() { super('DebugScene'); }

    create() {
        const lines = [
            '` close   I invinc   T speed',
            'G golden ear   H heal   K clear',
            '1-9 level   =/- next/prev   B skip'
        ];

        const pad = 8;
        const w = 250, h = 96;
        this.add.rectangle(pad + w / 2, pad + h / 2, w, h, 0x0d0518, 0.82)
            .setStrokeStyle(1, PALETTE.gold, 0.6).setDepth(0);
        this.add.text(pad + 8, pad + 6, 'DEBUG', {
            fontFamily: 'monospace', fontStyle: 'bold', fontSize: '12px', color: AMBER
        }).setDepth(1);
        this._stateText = this.add.text(pad + 70, pad + 6, '', {
            fontFamily: 'monospace', fontSize: '11px', color: AMBER
        }).setDepth(1);
        this.add.text(pad + 8, pad + 26, lines.join('\n'), {
            fontFamily: 'monospace', fontSize: '10px', color: DIM, lineSpacing: 6
        }).setDepth(1);

        const K = Phaser.Input.Keyboard.KeyCodes;
        this.keys = {
            I: this.input.keyboard.addKey(K.I),
            T: this.input.keyboard.addKey(K.T),
            G: this.input.keyboard.addKey(K.G),
            H: this.input.keyboard.addKey(K.H),
            K: this.input.keyboard.addKey(K.K),
            next: this.input.keyboard.addKey(K.PLUS),
            prev: this.input.keyboard.addKey(K.MINUS),
            B: this.input.keyboard.addKey(K.B),
            digits: [K.ONE, K.TWO, K.THREE, K.FOUR, K.FIVE, K.SIX, K.SEVEN, K.EIGHT, K.NINE]
                .map((code) => this.input.keyboard.addKey(code))
        };
    }

    _game() {
        const s = this.scene.get('GameScene');
        return (s && s.scene.isActive()) ? s : null;
    }

    update() {
        const g = this._game();
        if (!g || !g.debug) return;
        const JD = Phaser.Input.Keyboard.JustDown;

        if (JD(this.keys.I)) g.debugToggleInvincible();
        if (JD(this.keys.T)) g.debugCycleSpeed();
        if (JD(this.keys.G)) g.debugToggleGoldenEar();
        if (JD(this.keys.H)) g.debugHeal();
        if (JD(this.keys.K)) g.debugKillAll();
        if (JD(this.keys.B)) g.debugSkipLevel();
        if (JD(this.keys.next)) g.debugGotoLevel(g.currentLevel + 1);
        if (JD(this.keys.prev)) g.debugGotoLevel(g.currentLevel - 1);
        this.keys.digits.forEach((key, i) => { if (JD(key)) g.debugGotoLevel(i + 1); });

        const d = g.debug;
        this._stateText.setText(
            `L${g.currentLevel}  x${d.speed}` +
            (d.invincible ? '  INV' : '') +
            (d.goldenEar ? '  EAR' : '')
        );
    }
}
