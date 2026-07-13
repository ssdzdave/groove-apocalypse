import { GAME_W, GAME_H, EVT } from './config.js';
import { AudioEngine } from './audio/AudioEngine.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import PauseScene from './scenes/PauseScene.js';
import DebugScene from './scenes/DebugScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: 'game-container',
    pixelArt: true,
    backgroundColor: '#0d0518',
    input: { gamepad: true },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene, UIScene, PauseScene, DebugScene, GameOverScene]
};

window.__game = new Phaser.Game(config);

// Bridge audio-clock beats onto the game event bus. EVT.BEAT drives visuals
// only — the on-beat shot bonus polls AudioEngine.getBeatInfo() directly.
AudioEngine.onBeat((info) => window.__game.events.emit(EVT.BEAT, info));
