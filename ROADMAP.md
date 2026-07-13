# ROADMAP — future development phases

Design notes captured between build phases. Written so a future phase can lift
these straight into `CONTRACTS.md` workstream contracts.

---

## Band Mode — multi-instrument beat combat (headline feature, next major phase)

The Phase-3 on-beat mechanic (one quarter-note lane, one bonus) proved the
concept. The full vision:

### One lane per instrument
Replace the single beat indicator with **one lane per sound type** in the
generative music — bass / drums / chords / sprinkle-lead. Each lane's indicator
pulses when that instrument actually plays (not on an abstract grid), so lanes
are dense or sparse exactly as the mix is.

### Each instrument maps to a different attack
Playing "in the band" means timing different actions to different instruments.
Sketch (mapping TBD at design time):

| Lane | Attack |
|---|---|
| Drums | basic shot |
| Bass | special / dash |
| Chords | AoE burst |
| Lead | precision / piercing shot |

### Full-band bonus (band momentum)
Separate from per-shot bonuses: a **momentum meter that grows the longer the
player keeps hitting notes across ALL lanes**, multiplying rewards the higher
it climbs; decays (not hard-resets) on sustained misses. Hitting every lane in
a bar = "full band" tick that accelerates growth.

### Player-attempt feedback per lane
On top of each lane's beat indicator, render **the player's attempt to play
that instrument**: a rhythm-game hit-error marker per attempt (early / perfect /
late, offset shown spatially) so players can see and correct their timing
rather than guessing.

### Implementation seams that already exist
- `src/audio/MusicGenerator.js` `_scheduleStep` already schedules every layer's
  notes — generalize the Phase-3 `onBeatScheduled` hook to
  `onNoteScheduled(layer, noteIndex, audioTime, bpm)`.
- `src/audio/AudioEngine.js` `getBeatInfo()` → per-layer `getNoteInfo(layer)`
  (same pure-audio-clock math, one anchor per layer).
- `EVT.BEAT` → per-lane events for visuals.
- `ONBEAT_WINDOW_MS` (`src/config.js`) → per-lane windows (sparser lanes can be
  more forgiving).
- Rule D1 carries over unchanged: **bonuses poll the audio clock; events drive
  visuals only.**

---

## Parking lot (smaller ideas / tuning knobs)

- `ONBEAT_WINDOW_MS` (95ms) — revisit after human playtesting; may need to be
  per-difficulty or per-lane.
- Difficulty curves live in `src/config.js` + `GameScene._startSpawnTimers`;
  endless caps in the P3-C contract.
- Character balance: Dave's piercing loop vs Elliot's spread in golem/boss
  fights.
- Mobile/touch controls (currently keyboard + gamepad only).
- Butler-based deploy: `butler push groove-apocalypse-mvp.zip
  ssdzdave/groove-apocalypse:html5` for one-command itch.io updates.

---

## Hosting options (researched 2026-07; MVP shipped to itch.io)

The game is pure static files (index.html + src/, Phaser via CDN) — any static
host works with zero build step.

| Host | Cost | Access control for a small pool | Notes |
|---|---|---|---|
| **itch.io** (chosen) | free | Restricted (password) or secret URL | Built for game builds; HTML5 iframe embed; butler CLI for updates |
| GitHub Pages | free | none — public repo + URL obscurity | Lowest friction from a git repo |
| Cloudflare Pages + Access | free (≤50 users) | **real email-gated auth** | Best true access control; more setup |
| Netlify / Vercel | free tier | obscure URL only (password = paid) | Drag-and-drop deploys |
