class LevelGenerator {
    constructor(scene, width, height, tileSize) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.tileSize = tileSize;
        this.grid = [];
    }

    generateLevel() {
        this.initializeGrid();
        this.createMaze();
        return this.grid;
    }

    initializeGrid() {
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = 1; // 1 represents a wall
            }
        }
    }

    createMaze() {
        // Simple random walk maze generation
        let x = Math.floor(Math.random() * (this.width / 2)) * 2 + 1;
        let y = Math.floor(Math.random() * (this.height / 2)) * 2 + 1;
        this.grid[y][x] = 0; // 0 represents a path

        let path = [{ x: x, y: y }];

        while (path.length > 0) {
            let current = path[path.length - 1];
            let neighbors = this.getUnvisitedNeighbors(current.x, current.y);

            if (neighbors.length > 0) {
                let next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWall(current, next);
                this.grid[next.y][next.x] = 0;
                path.push(next);
            } else {
                path.pop();
            }
        }
    }

    getUnvisitedNeighbors(x, y) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -2 }, // Up
            { dx: 0, dy: 2 },  // Down
            { dx: -2, dy: 0 }, // Left
            { dx: 2, dy: 0 }   // Right
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            if (nx > 0 && nx < this.width - 1 && ny > 0 && ny < this.height - 1 && this.grid[ny][nx] === 1) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        return neighbors;
    }

    removeWall(current, next) {
        const wallX = current.x + (next.x - current.x) / 2;
        const wallY = current.y + (next.y - current.y) / 2;
        this.grid[wallY][wallX] = 0;
    }

    getSpawnPosition() {
        let spawnX, spawnY;
        do {
            spawnX = Phaser.Math.Between(1, this.width - 2);
            spawnY = Phaser.Math.Between(1, this.height - 2);
        } while (this.grid[spawnY][spawnX] !== 0);
        return { x: spawnX * this.tileSize + this.tileSize / 2, y: spawnY * this.tileSize + this.tileSize / 2 };
    }

    getVinylPositions(count) {
        const positions = [];
        for (let i = 0; i < count; i++) {
            let vinylX, vinylY;
            do {
                vinylX = Phaser.Math.Between(1, this.width - 2);
                vinylY = Phaser.Math.Between(1, this.height - 2);
            } while (this.grid[vinylY][vinylX] !== 0 || this.isNearPlayerSpawn(vinylX, vinylY));
            positions.push({ x: vinylX * this.tileSize + this.tileSize / 2, y: vinylY * this.tileSize + this.tileSize / 2 });
        }
        return positions;
    }

    isNearPlayerSpawn(x, y) {
        // For simplicity, just check if it's in the top-left corner where player might spawn
        return x < 5 && y < 5;
    }
}