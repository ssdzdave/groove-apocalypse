# 🎮 Nomadic Practice: Groove Apocalypse – Full Game Prompt

Build a browser-based top-down 8-bit roguelike game using **Phaser.js v3**.

---

## 🎭 Game Concept

**Nomadic Practice: Groove Apocalypse** is a psychedelic music-wielding dungeon crawler set in a **neon-lit slot canyon**. Players fight silence-infected zombies using rhythm-based weapons. Each run is a procedurally generated canyon level, echoing a mix of **Western dungeon** and **festival surrealism**.

---

## 🧑‍🎤 Player Characters

### Elliot – The Guitar Cowboy
- **Weapon**: Sonic Guitar
- **Projectile**: Chord Bursts (spread shot)
- **Special**: Sonic Slide – knockback pulse of power chords
- **Visual**: Cowboy hat, glitter fringe jacket, Gibson SG, purple boots

### Dave – The DJ Outrider
- **Weapon**: Bass Blaster Deck
- **Projectile**: Loop Waves (beat pulses)
- **Special**: Bass Drop – stuns all enemies for 3 seconds
- **Visual**: Beard, Pit Vipers, silver sequin jacket, backpack turntables

---

## 🧩 Core Mechanics

- WASD / Arrow movement
- SPACE to shoot
- E to trigger special
- **Shoot music to convert Zomboids into Happy Dancers**
- Collect vinyls to unlock the exit
- Health = beer mug meter
- Power-ups:
  - 🍺 Beer Mug → heal
  - 🔊 Tempo Tonic → speed boost
  - 📼 Mystery Tape → invincibility

---

## 🧱 Environment & Setting

**Slot Canyon Dungeon Design**:
- Each level is a **procedurally generated canyon maze**, styled like a desert rave-meets-western ghost town
- Walls = pixel stone slot canyons in orange/purple gradient
- Paths light up with glowing string lights or floor vinyl decals
- Disco balls hang from natural rock arches

**Zones (Tileset themes)**:
- Neon Dunes (sand floor + glowing rocks)
- Chrome Caverns (metallic cave walls + wires)
- Glitter Gulch (mirrored canyon tiles)
- Silent Sheriff's Lair (boss level)

---

## 💿 Level Flow

1. **Random canyon layout per run**
2. Player spawns in
3. Must:
   - Collect X vinyls (3 → 5 → 7…)
   - Avoid or convert enemies
   - Find and enter the exit portal (glowing turntable)
4. Next level loads → new map, harder spawns

**Boss Level** (every 3rd level):  
“Silent Sheriff” appears, immune to regular shots. Must use special attacks and strategic vinyl collection to win.

---

## 🧟 Enemies

### Zomboids
- Muted gray color palette
- Chase player slowly
- Deal damage on contact
- Converted by music → Happy Dancers (despawn after 3s dance animation)

### Drone Bots (from Level 3+)
- Float over terrain
- Shoot silence projectiles
- Immune to normal dancers

---

## 🎨 Art & Visuals

- 8-bit pixel style
- Vaporwave + desert tones (orange, cyan, magenta, purple)
- Characters: 4-frame idle, shoot, special animations
- Vinyls glow with animated rings
- Happy Dancers: randomized dance loop sprites
- Beer power-up sparkles gold

---

## 🔈 Audio & Music

- Background: lo-fi desert funk / ambient festival loops
- Sound FX:
  - Projectiles: chord strum or bass hit
  - Pickup: retro game pop
  - Transform: chime + cheering
  - Special: unique bass drop or guitar riff

---

## 🧪 Technical Requirements

- Phaser.js v3 project
- Code output:
  - `index.html`
  - `js/` folder with:
    - `main.js` (game setup)
    - `scenes/` (e.g., `SlotCanyonScene.js`, `MenuScene.js`)
    - `characters/` (Elliot, Dave)
    - `enemies/`, `items/`, `ui/`
  - Asset placeholders in `assets/`
- Controls: WASD/Arrow + Space (shoot) + E (special)
- Config for hot reload via `live-server`
- Embed-ready via iframe

---

## 🛠 Additional Notes

- Clearly comment placeholder asset points for easy swap-in
- Level generation should follow tile-based procedural logic (roguelike style)
- Optional: Include JSON config or object map per level for vinyls/enemy spawns

---

Create the entire scaffold with working Phaser game logic, placeholder asset references, and file structure for immediate testing.
