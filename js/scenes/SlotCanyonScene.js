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

    createMysteryTapeTexture() {
        let canvas = this.textures.createCanvas('mysteryTape', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FF00FF'; // Magenta
        ctx.fillRect(0, 0, 32, 32);
        canvas.refresh();
    }

    createDroneBotTexture() {
        let canvas = this.textures.createCanvas('droneBot', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000'; // Black
        ctx.fillRect(0, 0, 32, 32);
        canvas.refresh();
    }

    createHappyDancerTexture() {
        let canvas = this.textures.createCanvas('happyDancer', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00FF00'; // Green
        ctx.fillRect(0, 0, 32, 32);
        canvas.refresh();
    }

    createWallTexture() {
        let canvas = this.textures.createCanvas('wall', 32, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8B4513'; // SaddleBrown
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
        this.createMysteryTapeTexture();
        this.createDroneBotTexture();
        this.createHappyDancerTexture();
        this.createWallTexture();

        // Level Generation
        this.tileSize = 32;
        this.levelWidth = Math.floor(this.game.config.width / this.tileSize);
        this.levelHeight = Math.floor(this.game.config.height / this.tileSize);
        this.levelGenerator = new LevelGenerator(this, this.levelWidth, this.levelHeight, this.tileSize);
        this.walls = this.physics.add.staticGroup();

        // Player
        this.player = this.physics.add.sprite(0, 0, 'player'); // Initial position will be set by level generation
        this.player.setCollideWorldBounds(true);
        this.playerSpeed = 160; // Initial player speed

        // Cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        this.canSonicSlide = true;
        this.sonicSlideCooldown = 3000; // 3 seconds cooldown

        // Projectiles
        this.projectiles = this.physics.add.group({
            classType: Projectile,
            maxSize: 50, // Increased for testing
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

        // Mystery Tapes
        this.mysteryTapes = this.physics.add.group({
            classType: MysteryTape,
            maxSize: 5,
            runChildUpdate: true
        });

        // Drone Bots
        this.droneBots = this.physics.add.group({
            classType: DroneBot,
            maxSize: 10,
            runChildUpdate: true
        });

        // Player Health
        this.playerHealth = 3;
        this.healthText = this.add.text(16, 16, 'Health: ' + this.playerHealth, { fontSize: '32px', fill: '#fff' });

        // Level and Score
        this.currentLevel = 1;
        this.vinylsToCollect = 3; // For Level 1
        this.collectedVinyls = 0;
        this.levelText = this.add.text(16, 50, 'Level: ' + this.currentLevel, { fontSize: '32px', fill: '#fff' });
        this.scoreText = this.add.text(16, 84, 'Vinyls: ' + this.collectedVinyls + ' / ' + this.vinylsToCollect, { fontSize: '32px', fill: '#fff' });

        // Vinyls
        this.vinyls = this.physics.add.group();

        this.physics.add.overlap(this.player, this.vinyls, this.collectVinyl, null, this);
        this.physics.add.collider(this.projectiles, this.zomboids, this.hitZomboid, null, this);
        this.playerZomboidCollider = this.physics.add.collider(this.player, this.zomboids, this.playerHit, null, this);
        this.physics.add.overlap(this.player, this.beerMugs, this.collectBeerMug, null, this);
        this.physics.add.overlap(this.player, this.tempoTonics, this.collectTempoTonic, null, this);
        this.physics.add.overlap(this.player, this.mysteryTapes, this.collectMysteryTape, null, this);
        this.physics.add.collider(this.projectiles, this.droneBots, this.hitDroneBot, null, this);
        this.physics.add.collider(this.player, this.droneBots, this.playerHit, null, this);
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.zomboids, this.walls);
        this.physics.add.collider(this.droneBots, this.walls);


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

        this.time.addEvent({
            delay: 10000,
            callback: this.spawnDroneBot,
            callbackScope: this,
            loop: true
        });

        this.generateLevel();

        // Report initial game state for testing
        this.reportGameState();
    }

    reportGameState() {
        const gameState = {
            playerX: this.player.x,
            playerY: this.player.y,
            playerHealth: this.playerHealth,
            activeProjectiles: this.projectiles.getChildren().filter(p => p.active).length
        };
        console.log("GAME_STATE:" + JSON.stringify(gameState));
    }

    hitDroneBot(projectile, droneBot) {
        projectile.setActive(false);
        projectile.setVisible(false);
        droneBot.setActive(false);
        droneBot.setVisible(false);
    }

    spawnDroneBot() {
        const droneBot = this.droneBots.get();
        if (droneBot) {
            const spawnPos = this.getRandomPathPosition();
            droneBot.spawn(spawnPos.x, spawnPos.y);
        }
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

        // Special Attack
        if (Phaser.Input.Keyboard.JustDown(this.keyE) && this.canSonicSlide) {
            this.sonicSlide();
        }

        // Report game state for testing
        this.reportGameState();
    }

    collectVinyl(player, vinyl) {
        vinyl.disableBody(true, true);
        this.collectedVinyls += 1;
        this.scoreText.setText('Vinyls: ' + this.collectedVinyls + ' / ' + this.vinylsToCollect);

        if (this.collectedVinyls >= this.vinylsToCollect) {
            this.nextLevel();
        }
    }

    shootProjectile() {
        let projectile = this.projectiles.get();
        console.log("Before get():", this.projectiles.getChildren().map(p => ({ active: p.active, visible: p.visible })));
        if (!projectile) {
            projectile = new Projectile(this, 0, 0);
            this.projectiles.add(projectile);
            console.log("New projectile created and added.");
        }
        projectile.fire(this.player.x, this.player.y);
        console.log("After fire():", { active: projectile.active, visible: projectile.visible, x: projectile.x, y: projectile.y });
        console.log("Projectiles after fire():", this.projectiles.getChildren().map(p => ({ active: p.active, visible: p.visible, x: p.x, y: p.y })));
    }

    spawnZomboid() {
        const zomboid = this.zomboids.get();
        if (zomboid) {
            const spawnPos = this.getRandomPathPosition();
            zomboid.spawn(spawnPos.x, spawnPos.y);
        }
    }

    hitZomboid(projectile, zomboid) {
        projectile.setActive(false);
        projectile.setVisible(false);

        zomboid.setTexture('happyDancer');
        zomboid.setVelocity(0);
        this.time.delayedCall(3000, () => {
            zomboid.disableBody(true, true);
        }, [], this);
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
            const spawnPos = this.getRandomPathPosition();
            beerMug.spawn(spawnPos.x, spawnPos.y);
        }
    }

    spawnTempoTonic() {
        const tempoTonic = this.tempoTonics.get();
        if (tempoTonic) {
            const spawnPos = this.getRandomPathPosition();
            tempoTonic.spawn(spawnPos.x, spawnPos.y);
        }
    }

    sonicSlide() {
        this.canSonicSlide = false;
        // Visual effect for sonic slide
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xFFFFFF, 1);
        graphics.strokeCircle(this.player.x, this.player.y, 50);
        this.time.delayedCall(200, () => {
            graphics.destroy();
        }, [], this);

        // Knockback effect on enemies
        const knockbackRadius = 100;
        const knockbackForce = 300;

        this.zomboids.children.each(zomboid => {
            if (zomboid.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, zomboid.x, zomboid.y) < knockbackRadius) {
                this.physics.moveToObject(zomboid, this.player, -knockbackForce);
            }
        });

        this.droneBots.children.each(droneBot => {
            if (droneBot.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, droneBot.x, droneBot.y) < knockbackRadius) {
                this.physics.moveToObject(droneBot, this.player, -knockbackForce);
            }
        });

        this.time.delayedCall(this.sonicSlideCooldown, () => {
            this.canSonicSlide = true;
        }, [], this);
    }

    nextLevel() {
        this.currentLevel += 1;
        this.collectedVinyls = 0;

        if (this.currentLevel > 3) {
            this.physics.pause();
            this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'YOU WIN!', { fontSize: '64px', fill: '#00FF00' }).setOrigin(0.5);
            return;
        }

        // Update vinyls to collect
        if (this.currentLevel === 2) {
            this.vinylsToCollect = 5;
        } else if (this.currentLevel === 3) {
            this.vinylsToCollect = 7;
        }

        this.levelText.setText('Level: ' + this.currentLevel);
        this.scoreText.setText('Vinyls: ' + this.collectedVinyls + ' / ' + this.vinylsToCollect);

        // Clear existing entities
        this.zomboids.clear(true, true);
        this.beerMugs.clear(true, true);
        this.tempoTonics.clear(true, true);
        this.mysteryTapes.clear(true, true);
        this.projectiles.clear(true, true);
        this.vinyls.clear(true, true);
        this.walls.clear(true, true);

        // Generate new level
        this.generateLevel();

        // Adjust enemy spawn rates/types (simplified for now)
        if (this.currentLevel >= 2) {
            // Increase zomboid spawn rate or quantity
        }
        if (this.currentLevel >= 3) {
            // Introduce Drone Bots more frequently
        }
    }

    generateLevel() {
        const levelGrid = this.levelGenerator.generateLevel();
        for (let y = 0; y < this.levelHeight; y++) {
            for (let x = 0; x < this.levelWidth; x++) {
                if (levelGrid[y][x] === 1) {
                    this.walls.create(x * this.tileSize + this.tileSize / 2, y * this.tileSize + this.tileSize / 2, 'wall');
                }
            }
        }

        // Place player
        const playerSpawn = this.levelGenerator.getSpawnPosition();
        this.player.setPosition(playerSpawn.x, playerSpawn.y);

        // Place vinyls
        const vinylPositions = this.levelGenerator.getVinylPositions(this.vinylsToCollect);
        vinylPositions.forEach(pos => {
            this.vinyls.create(pos.x, pos.y, 'vinyl');
        });
    }

    getRandomPathPosition() {
        let spawnX, spawnY;
        do {
            spawnX = Phaser.Math.Between(1, this.levelWidth - 2);
            spawnY = Phaser.Math.Between(1, this.levelHeight - 2);
        } while (this.levelGenerator.grid[spawnY][spawnX] !== 0);
        return { x: spawnX * this.tileSize + this.tileSize / 2, y: spawnY * this.tileSize + this.tileSize / 2 };
    }
}