# CONTRACTS.md — Interface law for the Groove Apocalypse revamp

Every module's public API is pinned here and mirrored by stub files in `src/`.
**Workstream agents: implement ONLY the files you own. Never edit `src/config.js`, this file, `index.html`, or `src/main.js`. Import shared constants from `src/config.js` — never inline event-name strings, depths, or palette hexes.**

Phaser 3.90.0 is a **global** (`Phaser`) loaded by a classic script tag; game code is ES modules. There are **no asset files** — all textures are canvas-generated, all audio is WebAudio-synthesized.

Game: top-down 8-bit neon-vaporwave roguelike. 800×600 canvas, 25×18 grid of 32px tiles (world rows 0–17 = 576px; the bottom 24px strip is HUD territory drawn by UIScene). Palette: orange/cyan/magenta/purple desert vaporwave (see `PALETTE` in config).

---

## Contract 0 — `src/config.js` (frozen)

See the file itself. Exports: `TILE, GRID_W, GRID_H, GAME_W, GAME_H, PALETTE, CHARACTERS, ZONE_IDS, MAX_LEVEL, isBossLevel(n), vinylsForLevel(n), EVT, DEPTH`.

All cross-scene UI state flows through `this.game.events.emit(EVT.X, ...)` / `.on(EVT.X, ...)` with the payloads documented in config.js comments. GameScene emits; UIScene listens. No scene reaches into another scene's objects for UI state.

---

## Contract 1 — `src/gfx/TextureFactory.js` (WS-A) — consumed by C, D, E, F

```js
export const TextureFactory = {
    generateAll(scene) // idempotent (guard: if (scene.textures.exists('char_elliot')) return;)
};
```

Called once from `MenuScene.create()` before anything else renders. Registers every texture below as a **spritesheet** (canvas → `scene.textures.addSpriteSheet(key, canvasImage, { frameWidth, frameHeight })` or addCanvas + `add.frame` slicing) and creates every animation via `scene.anims.create` (global anims manager, so all scenes can use them).

Style: chunky 8-bit pixel art — draw with 2×2px "pixels" on 32×32 frames. Characters must read at a glance: Elliot = cowboy hat, glitter-fringe jacket, guitar, purple boots; Dave = beard, sunglasses, silver sequin jacket, turntable backpack.

### Pinned texture/animation table

| Texture key | Frame size | Frames (layout) | Animations created (key → frames, repeat) |
|---|---|---|---|
| `char_elliot` | 32×32 | 12: idle 0-3, walk 4-7, shoot 8-9, special 10-11 | `elliot-idle`(0-3, loop), `elliot-walk`(4-7, loop), `elliot-shoot`(8-9, once), `elliot-special`(10-11, once) |
| `char_dave` | 32×32 | 12 (same layout) | `dave-idle`, `dave-walk`, `dave-shoot`, `dave-special` (same pattern) |
| `zomboid` | 32×32 | 4 walk (muted grays, shambling) | `zomboid-walk`(0-3, loop) |
| `dancer` | 32×32 | 6 dance (neon rainbow happy dancer) | `dancer-dance`(0-5, loop) — consumers start at a random frame |
| `dronebot` | 32×32 | 4 hover (dark chrome, red eye) | `drone-hover`(0-3, loop) |
| `boss_sheriff` | **64×64** | 8: idle 0-3, attack 4-5, stunned 6-7 (black-hat sheriff, silence aura) | `boss-idle`(0-3, loop), `boss-attack`(4-5, loop), `boss-stunned`(6-7, loop) |
| `vinyl` | 32×32 | 6 spin with pulsing glow ring | `vinyl-spin`(0-5, loop) |
| `portal` | 32×32 | 6 glowing turntable | `portal-spin`(0-5, loop) |
| `pickup_beer` | 32×32 | 4 (gold sparkling beer mug) | `beer-idle`(0-3, loop) |
| `pickup_tonic` | 32×32 | 4 (cyan bottle) | `tonic-idle`(0-3, loop) |
| `pickup_tape` | 32×32 | 4 (magenta cassette, rainbow shimmer) | `tape-idle`(0-3, loop) |
| `proj_chord` | **16×16** | 2 (orange/gold chord bolt) | `chord-fly`(0-1, loop) |
| `proj_loop` | **16×16** | 3 (cyan expanding ring) | `loop-fly`(0-2, loop) |
| `proj_silence` | **16×16** | 2 (black void orb, purple rim) | `silence-fly`(0-1, loop) |
| `disco_ball` | 32×32 | 4 glint | `disco-glint`(0-3, loop) |
| `string_light` | **16×16** | 3 color-cycle bulb | `light-twinkle`(0-2, loop) |
| `particle_soft` | **8×8** | 1 (white radial-alpha dot; consumers tint it) | — |
| `tiles_dunes` | 32×32 | 8: walls 0-3 (orange/purple gradient rock), floors 4-7 (sand) | — |
| `tiles_chrome` | 32×32 | 8: walls 0-3 (metallic + wires), floors 4-7 (dark metal) | — |
| `tiles_glitter` | 32×32 | 8: walls 0-3 (mirrored/sparkle), floors 4-7 | — |
| `tiles_lair` | 32×32 | 8: walls 0-3 (dark, ominous, red accents), floors 4-7 | — |
| `portrait_elliot` | **64×64** | 1 (menu bust) | — |
| `portrait_dave` | **64×64** | 1 (menu bust) | — |
| `scanline` | **4×4** | 1 (repeating CRT pattern: dark row + transparent rows) | — |

Rules: no physics, no audio, no scene mutation beyond textures/anims. Every anim key above must exist after `generateAll` (`scene.anims.exists(key)`).

## Contract 2 — `src/gfx/ZoneThemes.js` (WS-A) — consumed by C, D, E

```js
export function getZoneForLevel(level) // -> zone object
```

Returns `{ id, name, tileKey, bgColors: [topHexInt, bottomHexInt], accent: hexInt, musicMood }`.

Mapping: boss levels (`isBossLevel`) → `{id:'lair', name:"Silent Sheriff's Lair", tileKey:'tiles_lair', musicMood:'boss'}`. Non-boss cycle: level 1→dunes ("Neon Dunes"), 2→chrome ("Chrome Caverns"), 4→glitter ("Glitter Gulch"), 5→dunes... i.e. cycle `[dunes, chrome, glitter]` over non-boss levels in order. `musicMood` for non-boss = the zone id.

---

## Contract 3 — `src/audio/AudioEngine.js` (WS-B) — consumed by C, E, F

Pure WebAudio. **Zero Phaser imports/usage.** Internal helpers live in `src/audio/MusicGenerator.js` and `src/audio/SfxBank.js` (private to WS-B; other streams import only `AudioEngine`).

```js
export const AudioEngine = {
    init(),              // create/resume AudioContext — MUST be called from a user-gesture handler; idempotent
    startMusic(mood),    // 'menu'|'dunes'|'chrome'|'glitter'|'boss'|'win' — crossfades (~0.5-1s) if already playing; no-op if same mood
    stopMusic(),
    setIntensity(t),     // 0..1 — scales drum density / filter cutoff / layer count
    sfx(name),           // fire-and-forget one-shot; unknown name -> console.warn, never throw
    debugState()         // -> { ctxState: 'uninitialized'|'suspended'|'running', mood: string|null, intensity: number }
};
```

**Every method is a safe no-op before `init()` — never throws.** Music: generative lo-fi desert-funk, ~80–90 BPM with swing, built from a lookahead scheduler (single shared AudioContext, schedule ~100ms ahead on a ~25ms timer). Layers: synth bass line, drums (kick/snare/hat via noise+osc), warm chord stabs; each mood varies key/pattern/timbre (menu = dreamy sparse; boss = tense minor, driving; win = triumphant). Keep total gain sane (master compressor/limiter recommended).

### Pinned SFX names (all 17 must exist)
`shoot_chord`, `shoot_loop`, `pickup_vinyl`, `pickup_powerup`, `convert`, `slide`, `bassdrop`, `hurt`, `stun`, `levelup`, `boss_roar`, `boss_hit`, `boss_die`, `win`, `gameover`, `ui_move`, `ui_select`.

---

## Contract 4 — `src/world/LevelGenerator.js` + `src/world/WorldBuilder.js` (WS-D) — consumed by C

```js
// LevelGenerator.js — PURE DATA, no Phaser scene coupling (Phaser.Math OK to avoid, use Math.random)
export function generateLevel({ level, isBoss }) // -> levelData
```

Returns:
```js
{
    grid,        // number[GRID_H][GRID_W], 1 = wall, 0 = floor; border always wall
    spawn,       // {tx, ty} open tile with ≥2 open cardinal neighbors (breathing room)
    exit,        // {tx, ty} portal tile — BFS-farthest open tile from spawn
    vinylTiles,  // [{tx,ty}] × vinylsForLevel(level), spread out, none within 3 tiles of spawn; [] on boss levels
    bossTile,    // {tx,ty} arena center on boss levels, else null
    openTiles,   // [{tx,ty}] every floor tile (consumers pick spawn points from this)
    props: { discoBalls: [{tx,ty}], lights: [{tx,ty}] } // decorative placements on/adjacent to floor
}
```

Non-boss: DFS maze backbone, then remove ~15% of remaining non-border walls to add loops and widen combat space. Boss: mostly-open arena with a few scattered cover pillars; `bossTile` near center, `spawn` near an edge. **No unbounded rejection-sampling loops** — pick from shuffled `openTiles`. Spawn↔exit connectivity must be guaranteed (BFS — which you already run for `exit`).

```js
// WorldBuilder.js — renders levelData into a scene
export function buildWorld(scene, levelData, zone) // -> { wallsGroup, portal, decorLayer }
export function setPortalOpen(portal, open)        // visual state + portal.setData('open', open)
```

- `wallsGroup`: `scene.physics.add.staticGroup()` of wall sprites using `zone.tileKey` wall frames (0-3, varied). GameScene wires colliders.
- Floor tiles / string lights / disco balls / glow decals go in `decorLayer` (a Container or just sprites) at `DEPTH.decor`.
- `portal`: physics sprite (`scene.physics.add.sprite`) at the exit tile playing `portal-spin`, `DEPTH.portal`, starts locked: `portal.setData('open', false)`, dimmed/desaturated until `setPortalOpen(portal, true)` (bright + glowing).
- Camera background: set gradient feel via `scene.cameras.main.setBackgroundColor(zone.bgColors[0])` (plus any decor gradient you draw).
- Must be re-invokable per level: caller destroys previous world; `buildWorld` creates fresh objects only.

---

## Contract 5 — Entities + GameScene (WS-C)

Files: `src/scenes/GameScene.js`, `src/entities/Player.js`, `Zomboid.js`, `DroneBot.js`, `Projectiles.js`, `Pickups.js`.

```js
// Player.js
export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, charId)  // 'elliot' | 'dave'
    update(time, delta)               // reads scene.keys; movement + facing + anim switching
    get facing()                      // normalized {x, y} of last movement, default {x:1, y:0}
    shoot()                           // fires in facing direction. Elliot: 3 proj_chord spread (±15°). Dave: 1 piercing proj_loop
    special()                         // Elliot: Sonic Slide — radial knockback pulse r≈110, damages boss. Dave: Bass Drop — scene.stunAllEnemies(3000) + stuns boss
    hp; maxHp;                        // 3 / 3
    isInvincible;                     // MysteryTape sets true for 5s
    damage(n); heal(n);               // clamp 0..maxHp; damage respects isInvincible; emits EVT.PLAYER_HP
}
```

`GameScene` (scene key `'GameScene'`; started as `scene.start('GameScene', { charId })`):

- `this.keys = { up, down, left, right, W, A, S, D, space, E }` (cursors + WASD; space = shoot with ~200ms cooldown, E = special with 3s cooldown → emit `EVT.SPECIAL_READY` updates).
- **Pinned public fields (WS-F reads these):** `this.player` (Player), `this.silenceProjectiles` (physics group of `proj_silence`, maxSize 30), `this.currentLevel` (number), `this.zomboids`, `this.droneBots` (groups).
- `stunAllEnemies(ms)` — calls `.stun(ms)` on every active zomboid/dronebot (and boss if present).
- Level flow **inside the scene**: `startLevel(n)` destroys the previous world/groups' members, calls `generateLevel` + `getZoneForLevel` + `buildWorld`, repositions player, emits `EVT.LEVEL_START` and `EVT.VINYLS(0, needed)`, calls `AudioEngine.startMusic(zone.musicMood)`. Portal opens (`setPortalOpen`) when vinyl quota met (or boss defeated on boss levels); player overlapping an OPEN portal → `AudioEngine.sfx('levelup')` + `startLevel(n+1)`, or if `n === MAX_LEVEL` → win: emit `EVT.GAME_OVER {won:true,...}`.
- Boss levels: spawn `SilentSheriff` at `bossTile`, no vinyls, portal opens on boss death (boss sets scene data `'bossDefeated'`; also listen for it). Wire: `overlap(playerProjectiles, boss, (b, p) => b.stunned ? b.onSpecialHit() : b.onProjectileHit(p))`.
- Enemy spawn timers with difficulty scaling: `spawnDelay = Math.max(700, 2000 - 150 * level)` for zomboids (speed +8%/level), drone bots from level 2 (every ~8s, cap ~4 active). Spawn positions from `levelData.openTiles` at distance ≥ 5 tiles from player.
- Pickups: beer every ~9s (heal 1), tonic every ~12s (+50% speed 5s), **mystery tape every ~20s (isInvincible 5s + rainbow tint pulse)** — each emits `EVT.POWERUP` where applicable; cap actives.
- Zomboid contact → `player.damage(1)` + knockback (unless invincible); silence projectile → same. hp 0 → emit `EVT.GAME_OVER {won:false, level, conversions, charId}` and stop.
- **Renders no UI text** — everything via EVT.
- All visual FX through `Juice` (never touch `postFX` directly): `Juice.trail` on player projectiles, `Juice.burst` + `floatText('GROOVE!')` on conversion, `Juice.shake` + `hitFlash` on player damage, `Juice.addCameraFX(this)` once in create.
- Audio hooks: `sfx('shoot_chord'/'shoot_loop')` on shoot, `pickup_vinyl`, `pickup_powerup`, `convert`, `slide`/`bassdrop` on special, `hurt`, `stun`, `gameover`, `win`. `AudioEngine.setIntensity(...)` — raise when hp low or boss active.
- **Debug/verification API (pinned):** `getDebugState()` → `{ level, hp, vinyls, vinylsNeeded, enemies, bossHp, charId, x, y }`; log `'GAME_STATE:' + JSON.stringify(...)` once per second; `debugTeleport(tx, ty)` moves player to tile center.

```js
// Zomboid.js
export default class Zomboid extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level)
    update()            // chase player (speed ~45 * (1 + 0.08*(level-1))), play 'zomboid-walk'
    stun(ms)
    convert()           // -> swap to 'dancer' texture + 'dancer-dance' at random start frame, disable body,
                        //    despawn after 3s; emits EVT.CONVERTED with running total (scene tracks the counter)
}
// DroneBot.js
export default class DroneBot extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level)
    update(time)        // hover drift; within 5 tiles of player: approach + fire proj_silence at player every 2500ms
    stun(ms)
    // killed (not converted) by player projectiles — Juice.burst on death
}
// Projectiles.js — exports PlayerProjectile (handles chord + loop variants, piercing flag) and SilenceProjectile,
//   both pooled Arcade sprites with fire(x, y, dirX, dirY) and off-screen/wall cleanup.
// Pickups.js — exports Vinyl, BeerMug, TempoTonic, MysteryTape (simple anim-playing physics sprites w/ static spawn helpers).
```

---

## Contract 6 — Scenes & flow (WS-E)

Files: `src/scenes/MenuScene.js`, `src/scenes/UIScene.js`, `src/scenes/GameOverScene.js`. All default-export scene classes with keys `'MenuScene'`, `'UIScene'`, `'GameOverScene'`.

- **MenuScene**: FIRST calls `TextureFactory.generateAll(this)`. Vaporwave title treatment ("NOMADIC PRACTICE" kicker + "GROOVE APOCALYPSE" title), animated background (gradient, sun/grid or drifting particles, disco ball), character select using `portrait_elliot`/`portrait_dave` + name/weapon blurbs; navigate ←→/AD (`sfx('ui_move')`), confirm Enter/Space (`sfx('ui_select')`). **First keydown → `AudioEngine.init()` then `AudioEngine.startMusic('menu')`** (autoplay-policy unlock). On confirm: `this.scene.start('GameScene', { charId }); this.scene.launch('UIScene');`
- **UIScene**: transparent overlay above GameScene. Driven ONLY by `this.game.events.on(EVT.*)` (clean up listeners on shutdown). Renders: beer-mug health meter (maxHp mugs, dim when empty), vinyl counter `♪ 3/5`, level + zone-name banner on `LEVEL_START` (fades out), special-cooldown indicator, boss HP bar (top center; hidden when hp === null), power-up timers. Owns the **CRT effect**: full-screen `tileSprite` of `scanline` + subtle vignette at topmost depth, alpha ≲ 0.15. On `EVT.GAME_OVER`: stop GameScene + UIScene, `scene.start('GameOverScene', payload)`.
- **GameOverScene**: win → "GROOVE RESTORED" celebration; lose → "SILENCED..." treatment; show stats (level reached, conversions, character); Enter/Space → back to MenuScene. Play `sfx('win')`/`sfx('gameover')` + `startMusic('win')` on win / `stopMusic()` on lose.

---

## Contract 7 — `src/entities/SilentSheriff.js` (WS-F) — consumed by C

```js
export default class SilentSheriff extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y)   // 64×64 'boss_sheriff'; hp = 6 + 2 * Math.floor(scene.currentLevel / 3 - 1) (6 at L3, 8 at L6); emits EVT.BOSS_HP(hp, maxHp)
    update(time, delta)        // slow stalk toward scene.player; every ~3.5s: silence-nova — ring of 8 proj_silence from scene.silenceProjectiles + sfx('boss_roar') occasionally
    stunned;                   // boolean
    stun(ms)                   // enter stunned state ('boss-stunned' anim, tint), auto-clear after ms
    onProjectileHit(proj)      // NOT stunned: absorb — immune flash (Juice.hitFlash gray), sfx nothing/dull, NO damage; deactivate proj unless piercing
    onSpecialHit()             // -1 hp, EVT.BOSS_HP, sfx('boss_hit'), hit reaction; at 0: death sequence (Juice.burst ×n, sfx('boss_die')), EVT.BOSS_HP(null, null), scene.data.set('bossDefeated', true), destroy
}
```

**Damage rule (pinned; C wires colliders to match):** normal player projectiles never damage the Sheriff unless he is `stunned` (then they call `onSpecialHit()`). Elliot's Sonic Slide: if boss within pulse radius → `onSpecialHit()`. Dave's Bass Drop: `stun(3000)` on the boss (vulnerability window).

## Contract 8 — `src/fx/Juice.js` (WS-F) — consumed by C, E

The ONLY module allowed to touch Phaser postFX pipelines. Every postFX call guarded (`if (!obj.postFX) return;` — Canvas-renderer safe; game must run under `Phaser.CANVAS` without crashing).

```js
export const Juice = {
    addBloom(gameObject, { color = 0xffffff, strength = 1 } = {}),
    addCameraFX(scene),                          // one-time subtle camera treatment for GameScene
    shake(scene, intensity = 0.005, ms = 120),
    hitFlash(sprite, color = 0xffffff),          // tint pulse tween, restores prior tint
    trail(scene, sprite, colorHex),              // particle_soft emitter following sprite; auto-cleans when sprite dies; returns emitter
    burst(scene, x, y, colorHex, count = 12),    // radial particle pop (conversions, deaths)
    floatText(scene, x, y, str, colorHex)        // rising, fading bitmap-style text
};
```

---

## Integration notes (orchestrator enforces)

- Depth: use `DEPTH` from config everywhere.
- Events: import `EVT`; grep will flag inlined `'gp-'` strings.
- Only MenuScene calls `AudioEngine.init()`.
- Boss ↔ GameScene seam: fields pinned in Contract 5; damage rule pinned in Contract 7.
- Texture keys/frames: exactly as the Contract 1 table; C/D/E/F play anims by the pinned names only.

---
---

# PHASE 3 CONTRACTS — "The Groove Update"

Beat-synced gameplay · score/combos/endless · new enemies + Feedback Baron · pause/settings/gamepad.
Same rules as Phase 2: implement ONLY files you own; import everything shared from `src/config.js` (which gained Phase-3 appends: `BOSS_IDS`, `bossForLevel`, `BOSS_NAMES`, `STORAGE`, `ONBEAT_WINDOW_MS`, `COMBO_WINDOW_MS`, `SCORE_VALUES`, `EVT.SCORE/COMBO/BEAT`, `DEPTH.hazard`). Never inline `'gp-'` strings, storage keys, or score values.

## Pinned decisions (all workstreams)

- **D1 — Beat timing lives in the audio clock.** A beat = every 4th 16th step (unswung). Consumers of the on-beat BONUS poll `AudioEngine.getBeatInfo()` at the moment of interest: `onBeat = info.active && Math.min(info.sinceMs, info.untilMs) <= ONBEAT_WINDOW_MS`. `EVT.BEAT` events (bridged from AudioEngine in main.js — already wired) are for VISUALS ONLY, never the bonus check. Nobody converts AudioContext time to Phaser time.
- **D2 — Score flows by DIRECT CALLS** into `scene.score` (a ScoreSystem instance created by GameScene). ScoreSystem emits `EVT.SCORE`/`EVT.COMBO` and owns the score `Juice.floatText` popups. EVT listeners NEVER add score.
- **D3 — Pause ducks, never suspends.** `AudioEngine.setDucked(true)` ramps the music bus to ×0.35 (0.25s); the AudioContext keeps running (pause-menu SFX work; beats keep broadcasting for the HUD pulse). GameScene is `scene.pause()`d so no gameplay advantage exists.
- **D4 — Volumes:** AudioEngine caches setter values pre-init and applies them on `init()`; `Storage` persists them; AudioEngine never touches localStorage.
- **D5 — Endless via start-data.** Winning L6 (non-endless) emits `EVT.GAME_OVER` with `canContinue: true`. GameOverScene's KEEP RIDING does `scene.start('GameScene', { charId, endless: true, startLevel: 7, carry: { score, conversions } })` + `launch('UIScene')`. In endless, `_enterPortal` never wins — levels count up forever. `isBossLevel`/`vinylsForLevel`/`getZoneForLevel` already generalize past 6.
- **D6 — Boss cycle:** `bossForLevel(n)` from config: Sheriff at L3/L9/…, Baron at L6/L12/…. FeedbackBaron implements the IDENTICAL seam as SilentSheriff (`stunned`, `stun(ms)`, `onProjectileHit(proj)`, `onSpecialHit()`, emits `EVT.BOSS_HP`, sets scene data `'bossDefeated'` on death) so GameScene's wiring stays class-agnostic.
- **D7 — Gamepad mapping:** left stick/dpad move (deadzone 0.25), buttons 0 (A)/2 (X) shoot, 1 (B)/7 (R2) special, 9 (Start) pause / menu confirm-alt; dpad/stick menu nav, A confirm. Gamepad input is NOT a browser audio-unlock gesture: MenuScene also unlocks on `pointerdown`, and the "press any key" hint stays.
- **Elite zomboid has NO new texture:** `zomboid` sheet + `setTint(PALETTE.gold)` + `setScale(1.15)`.
- Extended payloads: `EVT.LEVEL_START` gains `bossName` (from `BOSS_NAMES`) on boss levels; `EVT.GAME_OVER` gains `{ score, maxCombo, endless, canContinue }`.

## P3-A — TextureFactory + ZoneThemes additions (WS-A)

Append inside `generateAll`'s existing idempotency guard, using the existing sheet/anim helpers:

| Key | Frame | Frames | Anims |
|---|---|---|---|
| `amp_golem` | 32×32 | 6: walk 0-3 (hulking speaker-stack golem, orange cone "face", thick silhouette), cracked-walk 4-5 | `golem-walk`(0-3 loop), `golem-cracked`(4-5 loop) |
| `feedback_phantom` | 32×32 | 6: float 0-3 (tattered translucent figure, magenta static edges), teleport-shimmer 4-5 | `phantom-float`(0-3 loop), `phantom-tele`(4-5 once) |
| `boss_baron` | 64×64 | 8: idle 0-3 (top-hat amp-stack baron, gold monocle, cable whips), attack 4-5, stunned 6-7 | `baron-idle`, `baron-attack`, `baron-stunned` (same pattern as sheriff) |
| `silence_pool` | 48×48 | 3 shimmer (black void puddle, purple rim ripple) | `pool-shimmer`(0-2 loop, slow) |
| `ui_note` | 16×16 | 2 (gold eighth-note glyph: dim, bright) | — (UIScene tweens it) |

ZoneThemes: on boss levels use `bossForLevel(level)` — baron levels return `{ id:'lair', name: "The Baron's Feedback Chamber", accent: PALETTE.gold }` (same tileKey/musicMood); sheriff levels unchanged.

## P3-B — AudioEngine additions (WS-B)

```js
AudioEngine.getBeatInfo()  // -> { active, bpm, beatDurMs, beatIndex, phase 0..1, sinceMs, untilMs } — pure ctx-clock math
AudioEngine.onBeat(cb) / offBeat(cb)  // ALREADY EXIST as a module-level Set (Stage 0) — keep the Set; your scheduler invokes it
AudioEngine.setMusicVolume(v) / setSfxVolume(v) / getVolumes()  // 0..1, cached pre-init, applied at init; new musicBusGain node between music buses and masterGain
AudioEngine.setDucked(on)  // music ×0.35, 0.25s ramp, idempotent
AudioEngine.debugState()   // extend with { musicVol, sfxVol, ducked, beat: { active, bpm, beatIndex } }
```
Implementation: `MusicGenerator` gets an `onBeatScheduled(beatIndex, audioTime, bpm)` hook called in `_scheduleStep` when `stepIndex % 4 === 0` (pre-swing base time). AudioEngine sets the hook only on `currentMusic.generator` and clears it on crossfade-out (beats never double-fire during crossfade). It records `{ anchorTime, beatDur, beatIndex }` for `getBeatInfo()` and arms a `setTimeout((t - ctx.currentTime)*1000)` per beat to invoke the listener Set. `getBeatInfo().active === false` whenever no music plays or pre-init.
New pinned SFX (append; all must exist): `onbeat`, `phantom_tele`, `golem_shockwave`, `pause`, `combo_break`, `highscore`.

## P3-C — Core integration (WS-C: GameScene, Player, Zomboid, Projectiles)

- **On-beat shooting** in `Player.shoot()` per D1. On-beat projectiles: `fire(..., { onBeat: true })` → projectile stores `this.onBeat`, scale 1.35, white-hot tint, `sfx('onbeat')`. Pinned effects: impact conversion mini-AoE (converts zomboids within 48px of impact), counts as 2 hits on Amp Golems, ScoreSystem gets `onBeat: true` (×2 base). On-beat `special()`: that cycle's cooldown is 2000ms instead of 3000ms.
- **ScoreSystem wiring** per D2: `this.score = new ScoreSystem(this, data.carry || null)` in create; direct calls: vinyl → `score.onVinyl(x, y)`; drone kill → `score.onKill(x, y, { kind:'drone', onBeat })`; `Zomboid.convert(opts)` gains `{ onBeat }` and calls `scene.score.onConversion(x, y, { elite: this.elite, onBeat, kind: 'zomboid' })`; portal → `score.onLevelClear(n)`; bossDefeated listener → `score.onBossDefeated(x, y)`; `Player.damage` → `scene.score.notifyPlayerDamaged()`. Call `score.destroy()` on shutdown.
- **Elite zomboids:** `Zomboid` ctor `opts = { elite }` → gold tint + scale 1.15 + speed ×1.6; spawn chance `n < 3 ? 0 : min(0.35, 0.06*(n-2))`.
- **Spawn tables:** Amp Golems from L4 (timer ~10s, cap 2; endless 3), Feedback Phantoms from L5 (~12s, cap 2; endless 3). Pinned public groups: `this.golems`, `this.phantoms`, `this.silencePools`. Overlaps: playerProjectiles×golems → `g.hit(proj)`; ×phantoms → `if (!p.phased) p.convert({ onBeat: proj.onBeat })`. `stunAllEnemies` covers golems + phantoms too.
- **Silence pools:** non-boss L5+ count `min(1 + floor((n-5)/2), 4)`; Baron arenas 2. Place via `SilencePool.placePools(scene, levelData, count)`. Per-frame: `this.player.setSilenced(this.physics.overlap(this.player, this.silencePools))`.
- **`Player.setSilenced(bool)`:** speed ×0.5, `shoot()` no-ops (dull click ≤1/s), gray-blue tint while inside.
- **Endless:** create-data `{ charId, endless, startLevel, carry }`; `_enterPortal` gates `winGame()` on `!this.endless && n >= MAX_LEVEL`; win payload gains `canContinue: !this.endless`. Difficulty pinned: `spawnDelay = max(450, 2000 - 150*n)`; zomboid speed factor capped ×2.2; `ZOMBOID_CAP = 10 + floor(max(0, n-6)/2)` cap 16; `DRONE_CAP = 4 + floor(max(0, n-6)/3)` cap 7.
- **Boss selection:** `bossForLevel(n) === BOSS_IDS.BARON ? new FeedbackBaron(...) : new SilentSheriff(...)`; existing wiring unchanged; `LEVEL_START` gains `bossName`.
- **Pause + gamepad:** keys gain ESC + P; `update()` polls `this.input.gamepad` per D7 merged with keyboard (put movement-vector logic in a `getMoveVector()` the Player reads); ESC/P/Start → `this.scene.launch('PauseScene'); this.scene.pause(); AudioEngine.setDucked(true); AudioEngine.sfx('pause');` (guard: not when `_gameOverFired`, no double-launch).
- **Beat visuals:** listen `EVT.BEAT` on game.events (clean up on shutdown): subtle 120ms scale pulse 1.0→1.06 on active zomboids/golems/portal.
- **Debug:** `getDebugState()` adds `{ score, combo, endless, paused }`; new `debugSkipLevel()` = open portal + teleport player onto it.
- **Known regressions to avoid (from Phase 2):** pooled projectiles MUST `body.setSize(...)` + `body.reset(x, y)` in `fire()`; vinyls never expire; `create()` must null stale refs (`this.player`, `this._world`, `this._levelColliders`) because Phaser reuses scene instances.

## P3-D — New entities (WS-D: AmpGolem, FeedbackPhantom, FeedbackBaron, SilencePool)

Follow existing conventions from `Zomboid.js`/`SilentSheriff.js` (scene.add.existing, DEPTH.enemies, stun-tint pattern, Juice FX, `scene.anims.exists` guards, defensive scene-field checks).

```js
export default class AmpGolem extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level)   // 'amp_golem', hp 3, speed ~30, body ~26×26
    update(time, delta)               // slow chase; 'golem-walk'; at hp 1 → 'golem-cracked'
    stun(ms)
    hit(proj)                         // -1 (or -2 when proj.onBeat); Juice.hitFlash; at 0 → this.convert({ onBeat: proj.onBeat })
    convert(opts)                     // dancer swap (scale 1.2), Juice.burst ×2, sfx('golem_shockwave'),
                                      // shockwave ring r≈90: stuns enemies inside 1000ms and chain-converts zomboids ≤60px;
                                      // scene.score.onConversion(x, y, { kind: 'golem', onBeat: opts && opts.onBeat })
}
export default class FeedbackPhantom extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, level)   // 'feedback_phantom'; phased = true (alpha 0.5, immune)
    update(time, delta)               // every ~4s: teleport to an open tile 2-4 tiles from player (read scene._levelData.openTiles),
                                      // 'phantom-tele' + sfx('phantom_tele') + Juice.burst; 400ms later fire 3-shot silence burst (±20°)
                                      // via scene.silenceProjectiles; then phased = false for 1500ms (full alpha, magenta rim)
    phased; stun(ms)                  // stun forces phased = false for the stun duration
    convert(opts)                     // dancer swap; scene.score.onConversion(x, y, { kind: 'phantom', onBeat: opts && opts.onBeat })
}
export default class FeedbackBaron extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y)          // 'boss_baron' 64×64; maxHp = 8 + 2*Math.max(0, Math.floor(scene.currentLevel/3) - 2);
                                      // emits EVT.BOSS_HP(hp, maxHp); sfx('boss_roar'); body ~48×48; DEPTH.enemies
    update(time, delta)               // phase 1 (hp > 50%): slow stalk + every ~6s summon 3-5 zomboids at arena-edge open tiles
                                      //   (push into scene.zomboids; may exceed cap by ≤6) + occasional aimed 3-shot spread;
                                      // phase 2 (hp ≤ 50%): every ~5s screen-edge sweep — picket line of silence projectiles
                                      //   (~every 64px along a random edge) traversing the arena; faster stalk
    stunned; stun(ms); onProjectileHit(proj); onSpecialHit()   // IDENTICAL semantics to SilentSheriff (D6) incl. death:
                                      // EVT.BOSS_HP(null, null), scene.data.set('bossDefeated', true), bursts, destroy
}
export class SilencePool extends Phaser.Physics.Arcade.Sprite {}  // 'silence_pool', DEPTH.hazard, static circular body r≈26, 'pool-shimmer'
SilencePool.placePools(scene, levelData, count)  // -> SilencePool[]; shuffled levelData.openTiles, ≥4 tiles from spawn,
                                      // ≥3 from exit/bossTile and from each other; adds each into scene.silencePools
```

## P3-E — Scenes & UI (WS-E: UIScene, MenuScene, GameOverScene, PauseScene)

- **UIScene:** score readout top-right (pop tween on EVT.SCORE); combo meter below it (`×N` + drain bar animated locally over COMBO_WINDOW_MS; hidden at combo ≤ 1; red flash + sfx('combo_break') on `{combo: 0}`); beat indicator: `ui_note` bottom-center pulsing on EVT.BEAT (scale 1→1.5→1, ~140ms), gold flash when an EVT.SCORE arrives with `onBeat: true`; boss banner/HP-bar label use `LEVEL_START.bossName` — REMOVE the two hard-coded SHERIFF strings (UIScene.js:155, 183). All new listeners join the existing teardown table.
- **MenuScene:** top-5 high-score panel from `Storage.getHighScores()` (rank, score, char initial, `L{n}` or `∞` for endless) between title and panels; apply persisted volumes on create (D4); `pointerdown` audio unlock alongside keydown; gamepad menu nav (D7, 250ms repeat guard).
- **GameOverScene:** stats gain `SCORE` + `BEST COMBO ×{maxCombo}`; call `Storage.submitScore({score, charId, level, endless, date})` exactly once; `isNewHigh` → pulsing "★ NEW HIGH SCORE ★" + sfx('highscore'); when `payload.canContinue` → two prompts: ENTER = KEEP RIDING (endless, per D5) / ESC = menu (plus gamepad A/B); endless death shows `RODE TO LEVEL {n}`.
- **PauseScene** (key `'PauseScene'`): 0.7-alpha overlay + "PAUSED"; menu: RESUME / MUSIC slider / SFX slider / RESTART / QUIT TO MENU; ↑↓ nav (ui_move), ←→ adjust 0.1 steps (live AudioEngine setter + Storage.saveSettings), Enter/A activate, ESC/Start = resume. Resume: `setDucked(false); scene.stop(); scene.resume('GameScene')`. Restart = fresh L1 run: read charId from `this.scene.get('GameScene').charId`, stop Pause/UIScene/GameScene, `scene.start('GameScene', { charId })` + `launch('UIScene')`, unduck. Quit: stop all three, `scene.start('MenuScene')`, unduck + `startMusic('menu')`.

## P3-F — Systems (WS-F: ScoreSystem, Storage)

```js
export default class ScoreSystem {
    constructor(scene, carry = null)   // carry: { score, conversions }
    onConversion(x, y, { elite = false, onBeat = false, kind = 'zomboid' } = {})  // combo-eligible; reason: zomboid→(elite?'elite_convert':'convert'), golem→'golem_convert', phantom→'phantom_convert'
    onKill(x, y, { kind = 'drone', onBeat = false } = {})  // combo-eligible; 'drone_kill'
    onVinyl(x, y)          // combo-exempt
    onLevelClear(level)    // combo-exempt
    onBossDefeated(x, y)   // combo-exempt
    notifyPlayerDamaged()  // combo → 0; emit EVT.COMBO { combo: 0, comboMult: 1 }
    get score(); get combo(); get maxCombo();
    destroy()              // clears the expiry timer
}
// points = SCORE_VALUES[reason] * (onBeat ? 2 : 1) * comboMult (eligible only); comboMult = min(1 + 0.25*(combo-1), 3)
// combo window = COMBO_WINDOW_MS via scene.time (auto-respects pause). Emits EVT.SCORE per award.
// Owns popups: Juice.floatText "+{delta}" (append " ×{combo}" when combo ≥ 2; gold "ON BEAT!" variant when onBeat).

export const Storage = {
    getHighScores(),        // sorted desc, ≤5, of { score, charId, level, endless, date }
    submitScore(entry),     // -> { rank: 1..5 | null, isNewHigh: boolean }; persists STORAGE.HIGHSCORES
    getSettings(),          // { musicVol: 1, sfxVol: 1 } defaults merged over persisted STORAGE.SETTINGS
    saveSettings(partial)
};
// Every method try/catch-wrapped; in-memory fallback when localStorage is unavailable; malformed JSON never throws.
```

## Ownership matrix (Phase 3)

| Files | Owner |
|---|---|
| gfx/TextureFactory.js, gfx/ZoneThemes.js | A |
| audio/AudioEngine.js, audio/MusicGenerator.js, audio/SfxBank.js | B |
| scenes/GameScene.js, entities/Player.js, entities/Zomboid.js, entities/Projectiles.js | C |
| entities/AmpGolem.js, entities/FeedbackPhantom.js, entities/FeedbackBaron.js, world/SilencePool.js | D |
| scenes/UIScene.js, scenes/MenuScene.js, scenes/GameOverScene.js, scenes/PauseScene.js | E |
| systems/ScoreSystem.js, systems/Storage.js | F |

Untouched by everyone: DroneBot.js, Pickups.js, SilentSheriff.js, LevelGenerator.js, WorldBuilder.js, Juice.js, index.html, main.js, config.js.
