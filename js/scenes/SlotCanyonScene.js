class SlotCanyonScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SlotCanyonScene' });
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

    createBeerMugTexture() {
        let canvas = this.textures.createCanvas('beerMug', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFA500'; // Orange
        ctx.fillRect(8, 0, 16, 32);
        ctx.fillRect(0, 24, 32, 8);
        canvas.refresh();
    }

    createTempoTonicTexture() {
        let canvas = this.textures.createCanvas('tempoTonic', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00FFFF'; // Cyan
        ctx.fillRect(0, 0, 32, 32);
        canvas.refresh();
    }

    create() {
        // Create textures
        this.createPlayerTexture();
        this.createZomboidTexture();
        this.createVinylTexture();
        this.createProjectileTexture();
        this.createBeerMugTexture();
        this.createTempoTonicTexture();

        // Player
        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);
        this.playerSpeed = 160; // Initial player speed

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

        // Beer Mugs
        this.beerMugs = this.physics.add.group({
            classType: BeerMug,
            maxSize: 5,
            runChildUpdate: true
        });

        // Tempo Tonics
        this.tempoTonics = this.physics.add.group({
            classType: TempoTonic,
            maxSize: 5,
            runChildUpdate: true
        });

        // Player Health
        this.playerHealth = 3;
        this.healthText = this.add.text(16, 16, 'Health: ' + this.playerHealth, { fontSize: '32px', fill: '#fff' });

        // Score
        this.score = 0;
        this.scoreText = this.add.text(16, 50, 'Vinyls: 0', { fontSize: '32px', fill: '#fff' });

        // Vinyls
        this.vinyls = this.physics.add.group();
        for (let i = 0; i < 5; i++) {
            this.vinyls.create(12 + i * 140, 50, 'vinyl');
        }

        this.physics.add.overlap(this.player, this.vinyls, this.collectVinyl, null, this);
        this.physics.add.collider(this.projectiles, this.zomboids, this.hitZomboid, null, this);
        this.physics.add.collider(this.player, this.zomboids, this.playerHit, null, this);
        this.physics.add.overlap(this.player, this.beerMugs, this.collectBeerMug, null, this);
        this.physics.add.overlap(this.player, this.tempoTonics, this.collectTempoTonic, null, this);

        // Spawn zomboids
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnZomboid,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 5000,
            callback: this.spawnBeerMug,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 7000,
            callback: this.spawnTempoTonic,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        // Player movement
        if (this.cursors.left.isDown || this.keyA.isDown) {
            this.player.setVelocityX(-this.playerSpeed);
        } else if (this.cursors.right.isDown || this.keyD.isDown) {
            this.player.setVelocityX(this.playerSpeed);
        } else {
            this.player.setVelocityX(0);
        }

        if (this.cursors.up.isDown || this.keyW.isDown) {
            this.player.setVelocityY(-this.playerSpeed);
        } else if (this.cursors.down.isDown || this.keyS.isDown) {
            this.player.setVelocityY(this.playerSpeed);
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
        zomboid.disableBody(true, true);
        this.playerHealth -= 1;
        this.healthText.setText('Health: ' + this.playerHealth);

        if (this.playerHealth <= 0) {
            this.physics.pause();
            this.player.setTint(0xff0000);
            this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER', { fontSize: '64px', fill: '#ff0000' }).setOrigin(0.5);
        }
    }

    collectBeerMug(player, beerMug) {
        beerMug.disableBody(true, true);
        if (this.playerHealth < 3) {
            this.playerHealth += 1;
            this.healthText.setText('Health: ' + this.playerHealth);
        }
    }

    collectTempoTonic(player, tempoTonic) {
        tempoTonic.disableBody(true, true);
        this.playerSpeed = 160 * 1.5; // +50% speed
        this.time.delayedCall(5000, () => {
            this.playerSpeed = 160; // Reset speed after 5 seconds
        }, [], this);
    }

    spawnBeerMug() {
        const beerMug = this.beerMugs.get();
        if (beerMug) {
            beerMug.spawn(800, Phaser.Math.Between(100, 500));
        }
    }

    spawnTempoTonic() {
        const tempoTonic = this.tempoTonics.get();
        if (tempoTonic) {
            tempoTonic.spawn(800, Phaser.Math.Between(100, 500));
        }
    }
}