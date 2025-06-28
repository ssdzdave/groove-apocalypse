# Nomadic Practice: Groove Apocalypse - Development Plan

This document outlines the multi-phase development plan for the "Nomadic Practice: Groove Apocalypse" game.

## Phase 1: Core Mechanics & Basic Playable Prototype (Completed)

**Goal:** Establish a minimal viable game loop with core mechanics.

**Features:**
*   Player movement (WASD/Arrows).
*   Projectile firing.
*   Basic enemy (Zomboid) spawning and interaction (collision, being hit by projectiles).
*   Vinyl collection and score tracking.
*   Placeholder graphics (colored shapes).
*   Basic game over state (player hit by zomboid).
*   Local development server setup.
*   Initial Git repository.

**Deliverable:** A runnable game demonstrating these core interactions.

## Phase 2: Enhanced Gameplay & Initial Content

**Goal:** Expand on core mechanics, introduce more game elements, and improve the player experience.

**Features:**
*   **Procedural Level Generation (V1):** Simple tile-based random maze generation.
*   **Player Health System:** Max health: 3 (represented by beer mugs). Beer Mug power-up: restores 1 health.
*   **Power-ups:**
    *   **Tempo Tonic:** 5 seconds duration, +50% speed.
    *   **Mystery Tape:** 10 seconds duration, invincibility.
*   **Enemy Variety (Drone Bots):** Follow a path, move towards the player when within a 3-block range. Slower movement speed than the player. Silence projectiles will be visually distinct (e.g., black squares) and deal damage.
*   **Win Condition & Level Progression:** Collect 3 vinyls for level 1, 5 for level 2, 7 for level 3. Game has a fixed number of 3 levels.
*   **Elliot's Special Attack (Sonic Slide):** Implement in Phase 2. (Default cooldown/range/effect will be implemented).
*   **"Convert Zomboids to Happy Dancers":** Happy Dancers despawn after 3 seconds.

**Deliverable:** A game with multiple levels, varied enemies, and power-ups.

## Phase 3: Character & Boss Integration

**Goal:** Integrate the second player character and the boss battle.

**Features:**
*   **Second Player Character (Dave):** Implement Dave with his unique weapon (Bass Blaster Deck) and special (Bass Drop).
*   **Character Selection:** Add a simple menu to choose between Elliot and Dave.
*   **Boss Level:** Implement the "Silent Sheriff" boss with its unique mechanics (immune to regular shots, requires special attacks).

**Deliverable:** A game with two playable characters and a boss encounter.

## Phase 4: Art, Audio & Polish

**Goal:** Replace placeholder assets with 8-bit pixel art, add audio, and refine the overall experience.

**Features:**
*   **Art Integration:** Replace all placeholder graphics with actual 8-bit pixel art (characters, enemies, projectiles, vinyls, environment tiles).
*   **Audio Integration:** Add background music, sound effects for projectiles, pickups, transformations, and specials.
*   **Visual Effects:** Implement animations for characters, glowing vinyls, Happy Dancers, and power-up sparkles.
*   **UI Polish:** Improve the visual design of the UI elements.
*   **Performance Optimization:** Ensure smooth gameplay.

**Deliverable:** A visually and audibly complete, polished game prototype.