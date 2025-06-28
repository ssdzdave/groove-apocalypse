class MysteryTape extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'mysteryTape');
    }

    spawn(x, y) {
        this.body.reset(x, y);
        this.setActive(true);
        this.setVisible(true);
    }
}