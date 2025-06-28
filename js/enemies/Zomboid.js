class Zomboid extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'zomboid');
    }

    spawn(x, y) {
        this.body.reset(x, y);
        this.setActive(true);
        this.setVisible(true);
        this.setVelocityX(-50);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.x <= 0) {
            this.setActive(false);
            this.setVisible(false);
        }
    }
}