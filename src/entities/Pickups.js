// WS-C — see CONTRACTS.md Contract 5. Thin anim-playing physics sprites w/ static spawn helpers.
import { PALETTE, DEPTH } from '../config.js';
import { Juice } from '../fx/Juice.js';

const EXPIRE_MS = 15000;

class BasePickup extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, animKey) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(DEPTH.pickups);
        if (animKey && scene.anims.exists(animKey)) this.play(animKey);
        if (this.body && this.body.setAllowGravity) this.body.setAllowGravity(false);
        this._expireTimer = scene.time.delayedCall(EXPIRE_MS, () => this._expire());
    }

    _expire() {
        if (!this.active) return;
        this.scene.tweens.add({
            targets: this,
            alpha: 0.15,
            duration: 180,
            yoyo: true,
            repeat: 4,
            onComplete: () => { if (this.active) this.destroy(); }
        });
    }

    destroy(fromScene) {
        if (this._expireTimer) { this._expireTimer.remove(false); this._expireTimer = null; }
        super.destroy(fromScene);
    }
}

export class Vinyl extends BasePickup {
    constructor(scene, x, y) {
        super(scene, x, y, 'vinyl', 'vinyl-spin');
        this.pickupType = 'vinyl';
        // Vinyls are quota items — they must never expire
        if (this._expireTimer) { this._expireTimer.remove(false); this._expireTimer = null; }
        Juice.addBloom(this, { color: PALETTE.gold, strength: 1 });
    }
    static spawn(scene, x, y) { return new Vinyl(scene, x, y); }
}

export class BeerMug extends BasePickup {
    constructor(scene, x, y) {
        super(scene, x, y, 'pickup_beer', 'beer-idle');
        this.pickupType = 'beer';
        Juice.addBloom(this, { color: PALETTE.gold, strength: 0.6 });
    }
    static spawn(scene, x, y) { return new BeerMug(scene, x, y); }
}

export class TempoTonic extends BasePickup {
    constructor(scene, x, y) {
        super(scene, x, y, 'pickup_tonic', 'tonic-idle');
        this.pickupType = 'tonic';
        Juice.addBloom(this, { color: PALETTE.cyan, strength: 0.6 });
    }
    static spawn(scene, x, y) { return new TempoTonic(scene, x, y); }
}

export class MysteryTape extends BasePickup {
    constructor(scene, x, y) {
        super(scene, x, y, 'pickup_tape', 'tape-idle');
        this.pickupType = 'tape';
        Juice.addBloom(this, { color: PALETTE.magenta, strength: 0.6 });
        this.scene.tweens.add({
            targets: this,
            angle: { from: -6, to: 6 },
            duration: 350,
            yoyo: true,
            repeat: -1
        });
    }
    static spawn(scene, x, y) { return new MysteryTape(scene, x, y); }
}
