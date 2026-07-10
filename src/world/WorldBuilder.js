// WS-D — see CONTRACTS.md Contract 4. Renders pure levelData into a Phaser scene.
import { TILE, DEPTH, PALETTE } from '../config.js';

function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function buildWorld(scene, levelData, zone) {
    const { grid, exit, props } = levelData;
    const worldW = grid[0].length * TILE;
    const worldH = grid.length * TILE;

    scene.cameras.main.setBackgroundColor(zone.bgColors[0]);

    const decorLayer = scene.add.container(0, 0);
    decorLayer.setDepth(DEPTH.decor);

    // (1) full-canvas background gradient
    const bg = scene.add.graphics();
    bg.fillGradientStyle(zone.bgColors[0], zone.bgColors[0], zone.bgColors[1], zone.bgColors[1], 1);
    bg.fillRect(0, 0, worldW, worldH);
    decorLayer.add(bg);

    // (2) floor tiles per floor cell
    for (let ty = 0; ty < grid.length; ty++) {
        for (let tx = 0; tx < grid[ty].length; tx++) {
            if (grid[ty][tx] === 0) {
                const { x, y } = tileCenter(tx, ty);
                const frame = 4 + Math.floor(Math.random() * 4); // floor frames 4-7
                const img = scene.add.image(x, y, zone.tileKey, frame);
                decorLayer.add(img);
            }
        }
    }

    // (5) subtle floor glow decals near lights (drawn under the light sprites)
    for (const p of props.lights) {
        const { x, y } = tileCenter(p.tx, p.ty);
        const glow = scene.add.graphics();
        glow.fillStyle(zone.accent, 0.12);
        glow.fillCircle(x, y + TILE * 0.28, TILE * 0.36);
        decorLayer.add(glow);
    }

    // (3) string lights
    for (const p of props.lights) {
        const { x, y } = tileCenter(p.tx, p.ty);
        const light = scene.add.sprite(x, y, 'string_light');
        light.play('light-twinkle');
        decorLayer.add(light);
    }

    // (4) disco balls
    for (const p of props.discoBalls) {
        const { x, y } = tileCenter(p.tx, p.ty);
        const ball = scene.add.sprite(x, y, 'disco_ball');
        ball.play('disco-glint');
        decorLayer.add(ball);
    }

    // wallsGroup: one static sprite per wall cell, above floor / below entities
    const wallsGroup = scene.physics.add.staticGroup();
    for (let ty = 0; ty < grid.length; ty++) {
        for (let tx = 0; tx < grid[ty].length; tx++) {
            if (grid[ty][tx] === 1) {
                const { x, y } = tileCenter(tx, ty);
                const frame = Math.floor(Math.random() * 4); // wall frames 0-3
                const wall = wallsGroup.create(x, y, zone.tileKey, frame);
                wall.setDepth(DEPTH.decor + 1);
            }
        }
    }

    // portal: locked/dimmed until setPortalOpen(portal, true)
    const exitCenter = tileCenter(exit.tx, exit.ty);
    const portal = scene.physics.add.sprite(exitCenter.x, exitCenter.y, 'portal');
    portal.play('portal-spin');
    portal.setDepth(DEPTH.portal);
    portal.setImmovable(true);
    portal.setData('open', false);
    portal.setAlpha(0.5);
    portal.setTint(PALETTE.gray);

    return { wallsGroup, portal, decorLayer };
}

export function setPortalOpen(portal, open) {
    if (!portal) return;
    const current = portal.getData('open');
    if (current === open) return; // guard double-calls

    portal.setData('open', open);

    if (portal._pulseTween) {
        portal._pulseTween.stop();
        portal._pulseTween = null;
    }

    if (open) {
        portal.setAlpha(1);
        portal.clearTint();
        portal.setScale(1);
        const scene = portal.scene;
        if (scene && scene.tweens) {
            portal._pulseTween = scene.tweens.add({
                targets: portal,
                scale: { from: 1, to: 1.12 },
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    } else {
        portal.setAlpha(0.5);
        portal.setTint(PALETTE.gray);
        portal.setScale(1);
    }
}
