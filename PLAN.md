# Nomadic Practice: Groove Apocalypse - Development Plan

This document outlines the multi-phase development plan for the "Nomadic Practice: Groove Apocalypse" game.

## Phase 1: Core Mechanics & Basic Playable Prototype (Current)

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
*   **Procedural Level Generation (V1):** Implement a simple random dungeon generation for the slot canyon levels.
*   **Player Health System:** Replace the instant game over with a beer mug health meter.
*   **Power-ups:** Implement Tempo Tonic (speed boost) and Mystery Tape (invincibility).
*   **Enemy Variety:** Introduce Drone Bots (from Level 3+).
*   **Basic UI Enhancements:** Display health, power-up status.
*   **Win Condition:** Implement collecting X vinyls to unlock the exit.
*   **Level Progression:** Transition between levels with increasing difficulty.

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
