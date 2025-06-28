class Projectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'projectile');
    }

    fire(x, y) {
        this.body.reset(x, y);
        this.setActive(true);
        this.setVisible(true);
        this.setVelocityX(300);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.x >= 800) {
            this.setActive(false);
            this.setVisible(false);
        }
    }
}