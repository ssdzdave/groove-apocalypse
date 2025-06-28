class SlotCanyonScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SlotCanyonScene' });
    }

    create() {
        // Create textures
        this.createPlayerTexture();
        this.createZomboidTexture();
        this.createVinylTexture();
        this.createProjectileTexture();

        // Player
        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);

        // Cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

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
        this.vinyls = this.physics.add.group();
        for (let i = 0; i < 5; i++) {
            this.vinyls.create(12 + i * 140, 50, 'vinyl');
        }

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
        if (this.cursors.left.isDown || this.keyA.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown || this.keyD.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }

        if (this.cursors.up.isDown || this.keyW.isDown) {
            this.player.setVelocityY(-160);
        } else if (this.cursors.down.isDown || this.keyS.isDown) {
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

    createPlayerTexture() {
        let canvas = this.textures.createCanvas('player', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0000FF'; // Blue
        ctx.fillRect(0, 0, 32, 32);
        canvas.refresh();
    }

    createZomboidTexture() {
        let canvas = this.textures.createCanvas('zomboid', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#808080'; // Gray
        ctx.fillRect(0, 0, 32, 32);
        canvas.refresh();
    }

    createVinylTexture() {
        let canvas = this.textures.createCanvas('vinyl', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFF00'; // Yellow
        ctx.beginPath();
        ctx.arc(16, 16, 16, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();
        canvas.refresh();
    }

    createProjectileTexture() {
        let canvas = this.textures.createCanvas('projectile', 16, 16);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; // White
        ctx.fillRect(0, 0, 16, 16);
        canvas.refresh();
    }
}