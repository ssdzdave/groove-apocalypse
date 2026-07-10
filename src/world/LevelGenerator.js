// WS-D — see CONTRACTS.md Contract 4. Pure data, no Phaser scene coupling.
import { GRID_W, GRID_H, vinylsForLevel } from '../config.js';

const CARDINALS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function makeGrid(fill) {
    const grid = [];
    for (let y = 0; y < GRID_H; y++) {
        grid.push(new Array(GRID_W).fill(fill));
    }
    return grid;
}

function inBounds(tx, ty) {
    return tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H;
}

function manhattan(a, b) {
    return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}

// Odd interior coordinates for the DFS maze lattice (1, 3, 5 ... < max-1).
function oddCoords(max) {
    const arr = [];
    for (let v = 1; v < max - 1; v += 2) arr.push(v);
    return arr;
}

// DFS ("recursive backtracker") maze carved on the odd-cell lattice.
function carveMaze(grid) {
    const xs = oddCoords(GRID_W);
    const ys = oddCoords(GRID_H);
    if (xs.length === 0 || ys.length === 0) return;

    const startX = xs[Math.floor(Math.random() * xs.length)];
    const startY = ys[Math.floor(Math.random() * ys.length)];
    grid[startY][startX] = 0;

    const stack = [{ x: startX, y: startY }];
    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];

    while (stack.length) {
        const cur = stack[stack.length - 1];
        const neighbors = [];
        for (const [dx, dy] of dirs) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            if (nx > 0 && nx < GRID_W - 1 && ny > 0 && ny < GRID_H - 1 && grid[ny][nx] === 1) {
                neighbors.push({ x: nx, y: ny, dx, dy });
            }
        }
        if (neighbors.length) {
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            grid[cur.y + next.dy / 2][cur.x + next.dx / 2] = 0; // wall between cur & next
            grid[next.y][next.x] = 0;
            stack.push({ x: next.x, y: next.y });
        } else {
            stack.pop();
        }
    }
}

// Knock out ~15% of remaining non-border walls (favoring ones that open up loops/rooms).
function addLoops(grid) {
    let totalNonBorderWalls = 0;
    const candidates = [];
    for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
            if (grid[y][x] === 1) {
                totalNonBorderWalls++;
                let floorNeighbors = 0;
                for (const [dx, dy] of CARDINALS) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (grid[ny] && grid[ny][nx] === 0) floorNeighbors++;
                }
                if (floorNeighbors >= 2) candidates.push({ x, y });
            }
        }
    }
    shuffle(candidates);
    const removeCount = Math.min(candidates.length, Math.round(totalNonBorderWalls * 0.15));
    for (let i = 0; i < removeCount; i++) {
        grid[candidates[i].y][candidates[i].x] = 0;
    }
}

// Mostly-open arena with a handful of cover pillars scattered away from center.
function carveBossArena(grid) {
    for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
            grid[y][x] = 0;
        }
    }

    const centerX = Math.floor(GRID_W / 2);
    const centerY = Math.floor(GRID_H / 2);
    const pillarCount = 6 + Math.floor(Math.random() * 5); // 6-10

    const candidates = [];
    for (let y = 2; y < GRID_H - 2; y++) {
        for (let x = 2; x < GRID_W - 2; x++) {
            if (Math.abs(x - centerX) + Math.abs(y - centerY) >= 3) {
                candidates.push({ x, y });
            }
        }
    }
    shuffle(candidates);

    let placed = 0;
    for (let i = 0; i < candidates.length && placed < pillarCount; i++) {
        const { x, y } = candidates[i];
        if (grid[y][x] !== 0) continue; // already claimed by another pillar
        const canBe2x2 = x < GRID_W - 3 && y < GRID_H - 3 &&
            grid[y][x + 1] === 0 && grid[y + 1][x] === 0 && grid[y + 1][x + 1] === 0;
        if (canBe2x2 && Math.random() < 0.5) {
            grid[y][x] = 1;
            grid[y][x + 1] = 1;
            grid[y + 1][x] = 1;
            grid[y + 1][x + 1] = 1;
        } else {
            grid[y][x] = 1;
        }
        placed++;
    }

    return { centerX, centerY };
}

function openNeighborCount(grid, t) {
    let c = 0;
    for (const [dx, dy] of CARDINALS) {
        const nx = t.tx + dx;
        const ny = t.ty + dy;
        if (inBounds(nx, ny) && grid[ny][nx] === 0) c++;
    }
    return c;
}

// BFS over floor tiles from spawn. Iterative, bounded by grid size — no unbounded loops.
function bfsReachable(grid, spawn) {
    const dist = makeGrid(-1);
    const order = [spawn];
    dist[spawn.ty][spawn.tx] = 0;
    let head = 0;
    while (head < order.length) {
        const cur = order[head++];
        const d = dist[cur.ty][cur.tx];
        for (const [dx, dy] of CARDINALS) {
            const nx = cur.tx + dx;
            const ny = cur.ty + dy;
            if (inBounds(nx, ny) && grid[ny][nx] === 0 && dist[ny][nx] === -1) {
                dist[ny][nx] = d + 1;
                order.push({ tx: nx, ty: ny });
            }
        }
    }
    return { dist, order };
}

// Greedy farthest-point sampling for spread-out vinyl placement.
function pickVinyls(reachable, spawn, exit, count) {
    if (count <= 0) return [];
    const pool = reachable.filter((t) => manhattan(t, spawn) >= 3 && !(t.tx === exit.tx && t.ty === exit.ty));
    if (pool.length === 0) return [];

    shuffle(pool);
    const picked = [pool[0]];
    while (picked.length < count && picked.length < pool.length) {
        let best = null;
        let bestDist = -1;
        for (const cand of pool) {
            if (picked.includes(cand)) continue;
            let minDist = Infinity;
            for (const p of picked) {
                const d = manhattan(cand, p);
                if (d < minDist) minDist = d;
            }
            if (minDist > bestDist) {
                bestDist = minDist;
                best = cand;
            }
        }
        if (!best) break;
        picked.push(best);
    }
    return picked.slice(0, count).map((t) => ({ tx: t.tx, ty: t.ty }));
}

// String lights (scattered, near walls) + disco balls (junctions/room-ish spots).
function pickProps(grid, reachable, excludeList) {
    const excludeSet = new Set(excludeList.map((t) => `${t.tx},${t.ty}`));

    const adjacentToWall = [];
    const junctions = [];
    for (const t of reachable) {
        if (excludeSet.has(`${t.tx},${t.ty}`)) continue;
        let openNeighbors = 0;
        let wallAdjacent = false;
        for (const [dx, dy] of CARDINALS) {
            const nx = t.tx + dx;
            const ny = t.ty + dy;
            if (!inBounds(nx, ny) || grid[ny][nx] === 1) wallAdjacent = true;
            else openNeighbors++;
        }
        if (wallAdjacent) adjacentToWall.push(t);
        if (openNeighbors >= 3) junctions.push(t);
    }

    shuffle(adjacentToWall);
    const targetLights = 10 + Math.floor(Math.random() * 5); // 10-14
    const lights = [];
    for (const cand of adjacentToWall) {
        if (lights.length >= targetLights) break;
        if (lights.every((l) => manhattan(l, cand) >= 2)) lights.push(cand);
    }
    if (lights.length < 10) {
        for (const cand of adjacentToWall) {
            if (lights.length >= 10) break;
            if (!lights.includes(cand)) lights.push(cand);
        }
    }

    const lightKeys = new Set(lights.map((l) => `${l.tx},${l.ty}`));
    shuffle(junctions);
    const discoCount = 2 + Math.floor(Math.random() * 3); // 2-4
    const discoBalls = [];
    for (const cand of junctions) {
        if (discoBalls.length >= discoCount) break;
        const key = `${cand.tx},${cand.ty}`;
        if (lightKeys.has(key)) continue;
        discoBalls.push(cand);
    }
    // Fallback fill if junctions were scarce.
    if (discoBalls.length < 2) {
        for (const cand of reachable) {
            if (discoBalls.length >= 2) break;
            const key = `${cand.tx},${cand.ty}`;
            if (excludeSet.has(key) || lightKeys.has(key)) continue;
            if (discoBalls.includes(cand)) continue;
            discoBalls.push(cand);
        }
    }

    return {
        lights: lights.map((t) => ({ tx: t.tx, ty: t.ty })),
        discoBalls: discoBalls.map((t) => ({ tx: t.tx, ty: t.ty }))
    };
}

export function generateLevel({ level, isBoss }) {
    const grid = makeGrid(1);
    let bossCenter = null;

    if (isBoss) {
        bossCenter = carveBossArena(grid);
    } else {
        carveMaze(grid);
        addLoops(grid);
    }

    const allOpen = [];
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            if (grid[y][x] === 0) allOpen.push({ tx: x, ty: y });
        }
    }

    // --- spawn ---
    let spawnPool = allOpen;
    if (isBoss) {
        const edgeTiles = allOpen.filter((t) => t.tx <= 3 || t.tx >= GRID_W - 4 || t.ty <= 3 || t.ty >= GRID_H - 4);
        if (edgeTiles.length) spawnPool = edgeTiles;
    }
    const shuffledSpawnPool = shuffle(spawnPool.slice());
    let spawn = shuffledSpawnPool.find((t) => openNeighborCount(grid, t) >= 2);
    if (!spawn) spawn = shuffledSpawnPool[0] || allOpen[0];

    // --- BFS reachability + exit (farthest reachable tile) ---
    const { dist, order } = bfsReachable(grid, spawn);
    const reachable = order;
    let exit = reachable[0];
    let maxDist = 0;
    for (const t of reachable) {
        const d = dist[t.ty][t.tx];
        if (d > maxDist) {
            maxDist = d;
            exit = t;
        }
    }

    const openTiles = reachable.map((t) => ({ tx: t.tx, ty: t.ty }));

    // --- vinyls ---
    const vinylCount = vinylsForLevel(level);
    const vinylTiles = isBoss ? [] : pickVinyls(reachable, spawn, exit, vinylCount);

    // --- boss tile ---
    let bossTile = null;
    if (isBoss) {
        let best = null;
        let bestDist = Infinity;
        for (const t of reachable) {
            const d = Math.abs(t.tx - bossCenter.centerX) + Math.abs(t.ty - bossCenter.centerY);
            if (d < bestDist) {
                bestDist = d;
                best = t;
            }
        }
        bossTile = best ? { tx: best.tx, ty: best.ty } : { tx: spawn.tx, ty: spawn.ty };
    }

    // --- props ---
    const exclude = [spawn, exit, ...vinylTiles];
    if (bossTile) exclude.push(bossTile);
    const props = pickProps(grid, reachable, exclude);

    return {
        grid,
        spawn: { tx: spawn.tx, ty: spawn.ty },
        exit: { tx: exit.tx, ty: exit.ty },
        vinylTiles,
        bossTile,
        openTiles,
        props
    };
}
