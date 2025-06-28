class SlotCanyonScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SlotCanyonScene' });
    }

    preload() {
        // Placeholders for assets
        this.load.image('player', 'assets/player.png');
        this.load.image('zomboid', 'assets/zomboid.png');
        this.load.image('vinyl', 'assets/vinyl.png');
        this.load.image('projectile', 'assets/projectile.png');
    }

    create() {
        // Player
        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);

        // Cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Projectiles
        this.projectiles = this.physics.add.group({
            classType: Projectile,
            maxSize: 10,
            runChildUpdate: true
        });

        // Zomboids
        this.zomboids = this.physics.add.group({
            classType: Zomboid,
            maxSize: 20,
            runChildUpdate: true
        });

        // Score
        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Vinyls: 0', { fontSize: '32px', fill: '#fff' });

        // Vinyls
        this.vinyls = this.physics.add.group({
            key: 'vinyl',
            repeat: 5,
            setXY: { x: 12, y: 0, stepX: 140 }
        });

        this.physics.add.overlap(this.player, this.vinyls, this.collectVinyl, null, this);
        this.physics.add.collider(this.projectiles, this.zomboids, this.hitZomboid, null, this);
        this.physics.add.collider(this.player, this.zomboids, this.playerHit, null, this);

        // Spawn zomboids
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnZomboid,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        // Player movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }

        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-160);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(160);
        } else {
            this.player.setVelocityY(0);
        }

        // Shooting
        if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
            this.shootProjectile();
        }
    }

    collectVinyl(player, vinyl) {
        vinyl.disableBody(true, true);
        this.score += 1;
        this.scoreText.setText('Vinyls: ' + this.score);
    }

    shootProjectile() {
        const projectile = this.projectiles.get();
        if (projectile) {
            projectile.fire(this.player.x, this.player.y);
        }
    }

    spawnZomboid() {
        const zomboid = this.zomboids.get();
        if (zomboid) {
            zomboid.spawn(800, Phaser.Math.Between(100, 500));
        }
    }

    hitZomboid(projectile, zomboid) {
        projectile.setActive(false);
        projectile.setVisible(false);
        zomboid.setActive(false);
        zomboid.setVisible(false);
    }

    playerHit(player, zomboid) {
        this.physics.pause();
        this.player.setTint(0xff0000);
    }
}