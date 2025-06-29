class Projectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'projectile');
        console.log("Projectile constructor called.");
    }

    fire(x, y) {
        this.body.reset(x, y);
        this.setActive(true);
        this.setVisible(true);
        this.setVelocityX(300);
        console.log(`Projectile fired at x: ${x}, y: ${y}`);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        console.log(`Projectile X: ${this.x}, Active: ${this.active}, Visible: ${this.visible}`);
        if (this.x >= 800) {
            this.setActive(false);
            this.setVisible(false);
            console.log("Projectile deactivated (off-screen).");
        }
    }
}