// WS-F — see CONTRACTS.md Contract 8. The ONLY module allowed to touch postFX.
// Phaser is a global script-tag load — never import it.
import { DEPTH } from '../config.js';

function toHexString(colorHex) {
    return '#' + (colorHex & 0xffffff).toString(16).padStart(6, '0');
}

export const Juice = {
    // Subtle glow around a game object. Guard postFX (Canvas renderer has none).
    addBloom(gameObject, { color = 0xffffff, strength = 1 } = {}) {
        if (!gameObject || !gameObject.postFX) return;
        gameObject.postFX.addGlow(color, strength * 2, 0, false, 0.1, 12);
    },

    // One-time subtle camera bloom for GameScene. Guard with a flag on the scene
    // so repeated calls (e.g. level restarts) don't stack the pipeline.
    addCameraFX(scene) {
        if (!scene || scene._juiceCameraFXApplied) return;
        scene._juiceCameraFXApplied = true;
        const cam = scene.cameras && scene.cameras.main;
        if (!cam || !cam.postFX) return;
        cam.postFX.addBloom(0xffffff, 1, 1, 1, 1.1);
    },

    shake(scene, intensity = 0.005, ms = 120) {
        if (!scene || !scene.cameras || !scene.cameras.main) return;
        scene.cameras.main.shake(ms, intensity);
    },

    // Tint-pulse a sprite: fill with color briefly, then restore whatever tint it had.
    hitFlash(sprite, color = 0xffffff) {
        if (!sprite || !sprite.active) return;
        const scene = sprite.scene;
        const priorTint = sprite.isTinted ? sprite.tintTopLeft : null;
        sprite.setTintFill(color);
        if (!scene || !scene.time) return;
        scene.time.delayedCall(70, () => {
            if (!sprite || !sprite.active) return;
            if (priorTint !== null) {
                sprite.setTint(priorTint);
            } else {
                sprite.clearTint();
            }
        });
    },

    // Following particle trail. Auto-cleans on sprite destroy or once sprite goes inactive.
    trail(scene, sprite, colorHex) {
        if (!scene || !scene.add || !sprite) return null;
        const emitter = scene.add.particles(0, 0, 'particle_soft', {
            follow: sprite,
            tint: colorHex,
            speed: 10,
            lifespan: 250,
            frequency: 35,
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.7, end: 0 },
            blendMode: 'ADD'
        });
        emitter.setDepth(DEPTH.particles);

        const cleanup = () => {
            if (watchEvent) watchEvent.remove(false);
            if (emitter && emitter.destroy) emitter.destroy();
        };

        sprite.once('destroy', cleanup);

        // Pragmatic liveness poll: some code paths deactivate a sprite (setActive(false))
        // without destroying it, which wouldn't fire 'destroy'. Stop the emitter then too.
        const watchEvent = scene.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                if (!sprite || !sprite.active) {
                    cleanup();
                }
            }
        });

        return emitter;
    },

    // One-shot radial particle pop.
    burst(scene, x, y, colorHex, count = 12) {
        if (!scene || !scene.add) return;
        const emitter = scene.add.particles(0, 0, 'particle_soft', {
            tint: colorHex,
            speed: { min: 60, max: 140 },
            lifespan: 400,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            emitting: false
        });
        emitter.setDepth(DEPTH.particles);
        emitter.explode(count, x, y);
        scene.time.delayedCall(600, () => {
            if (emitter && emitter.destroy) emitter.destroy();
        });
    },

    // Rising, fading bitmap-style text (e.g. "GROOVE!").
    floatText(scene, x, y, str, colorHex) {
        if (!scene || !scene.add) return;
        const text = scene.add.text(x, y, str, {
            fontFamily: 'monospace',
            fontStyle: 'bold',
            fontSize: '12px',
            color: toHexString(colorHex)
        });
        text.setStroke('#000000', 3);
        text.setOrigin(0.5);
        text.setDepth(DEPTH.particles);

        scene.tweens.add({
            targets: text,
            y: y - 28,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                if (text && text.destroy) text.destroy();
            }
        });
    }
};
