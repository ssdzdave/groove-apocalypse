class DroneBot extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'droneBot');
        this.player = scene.player;
        this.speed = 80; // Slower than player (160)
        this.detectionRange = 3 * 32; // 3 blocks * 32 pixels/block
    }

    spawn(x, y) {
        this.body.reset(x, y);
        this.setActive(true);
        this.setVisible(true);
        this.setVelocityX(-this.speed);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);

        if (this.x <= 0) {
            this.setActive(false);
            this.setVisible(false);
        }

        const distance = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);

        if (distance < this.detectionRange) {
            this.scene.physics.moveToObject(this, this.player, this.speed);
        } else {
            this.setVelocityX(-this.speed);
            this.setVelocityY(0);
        }
    }
}