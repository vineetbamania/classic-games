# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of classic mobile games (currently just Nokia "Bounce") reimplemented as self-contained, zero-dependency static web pages, branded "CloudFone". Games are reverse-engineered from original J2ME `.jar` files. There is no build step, no package manager, and no test framework — everything is plain HTML/CSS/vanilla JS served statically.

## Running / developing

Serve the repo root over HTTP (the games load assets via relative paths, so `file://` will hit CORS issues):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

`index.html` (root) is the game-selection menu; each game lives at `games/<name>/index.html`.

## Deployment

Pushing to `main` triggers `.github/workflows/static.yml`, which uploads the entire repo as-is to GitHub Pages. No build — what's committed is what's served.

## Architecture

### JAR → web pipeline
`tools/extract-jar.py` unpacks an original J2ME game JAR and scaffolds a web game:
- copies the best-matching spritesheet to `assets/sprites.png` (heuristic: PNG 500–10000 bytes, ≤128×128, width divisible by 12) and `bouncesplash.png` → `assets/splash.png`
- decodes binary level files into JS. The level binary format is an 8-byte header (`sx, sy, grav, W, V, ao, cols, rows`) followed by a `cols×rows` tilemap, then a segment count `B` and `B` 8-byte segments.

Run it with: `python3 tools/extract-jar.py jars/bounce.jar games/bounce`

> Note: the script emits `Bounce.LEVEL_DATA = {...}`, but the live game in `games/bounce/js/leveldata.js` reads a global `var LEVELS = {...}`. The committed level data was adapted to the `LEVELS` shape the game expects — regenerating from the JAR will not drop in cleanly without reconciling this.

### Game structure (games/bounce/)
`index.html` is just markup + CSS and a list of `<script src>` tags loaded **in dependency order**; all engine code lives in `js/`. The scripts share plain global `var`s (no modules/bundler) — `game.js` must load **last** because it boots. Load order and responsibilities:
1. `js/leveldata.js` — the `LEVELS` global (decoded from the JAR).
2. `js/atlas.js` — the reverse-engineered tile renderer **data + builder** (`DA`/`DB`/`ATLAS`/`TILE`, `buildAtlas`, `sliceCell`, `xform`, `getRot`). Reads the global `sheet`.
3. `js/audio.js` — WebAudio sound (`tone` + `snd*`, `initAudio`, `muted`).
4. `js/input.js` — key handling; sets `left`/`right`/`jump` and pushes to `actQ`.
5. `js/render.js` — all canvas drawing (`render`, `drawWorld`, `drawTile`, `drawBall`, HUD/overlay).
6. `js/game.js` — constants, `SOLID`/`SPIKE`/`RING`, state, level loading, physics (`update`/`die`/…), `refreshHUD`, `loop`, and the boot sequence.

Key pieces:
- **Tile rendering is reverse-engineered from JAR class `b`** (see `tools/jdis.py`), not guessed. `atlas.js` builds a 67-entry image atlas by slicing 12×12 cells from `objects_nm.png` and rotating/flipping them (Nokia DirectGraphics codes → canvas transforms), then `drawTile` runs a per-tile recipe (`TILE`): generic terrain tiles 13–28 **composite two layers** (`Q[DA[t-13]]` base + `Q[DB[t-13]]` overlay); spikes/rings/slopes are real cells, not procedural shapes. The playfield background is the original sky blue `#B0E0F0` (`#1060B0` for variant regions).
- **Tile bit flags**: a tile byte is masked `& 0x3f` for the base value (0–54) used by `TILE`; bit 6 (`& 64`) is the variant flag (picks `{n,v}` recipes); collision uses the `SOLID`/`SPIKE`/`RING` sets (which register both `v` and `v|64`).
- **Collision (`SOLID`/`SPIKE`/`RING` in `game.js`)**: only tiles **1, 2, 10** are structural walls/floors — verified by the level data (these are the only values forming long contiguous runs across all 11 levels) and the JAR's collision class. Every other non-empty tile (13/14, 15/16, 29, 30–33, …) is an isolated *object* placed inside open corridors; they must **not** be solid or the level seals shut. (The original port wrongly marked 13–28 etc. as solid, which walled off level 1 at column 9.) `3` = spike (kills), `29` = ring (collect + pass through).
- **State machine**: a `phase` string (`title` / `playing` / `paused` / `levelComplete` / `gameover`) drives `update()` and the overlay rendering.
- **Game loop**: `loop()` drains an `actQ` input queue (menu/pause actions), then `update()` (physics) and `render()`, via `requestAnimationFrame`.
- **Input** targets Cloud Phone hardware: arrow/D-pad keys, the numeric T9 keypad (`4`/`6` move, `2`/`8` jump, `5` = OK/select), soft keys (`SoftLeft` select, `SoftRight` pause), plus WASD for desktop testing. `0`/`m` toggles mute. There is no touch/pointer handling (Cloud Phone has no pointer).
- **Sound**: synthesized with WebAudio (`tone()` helper + `snd*` functions) — the original's 3 Nokia OTT tones are not real audio, so they're re-created as oscillator blips. The `AudioContext` is created lazily on first keydown because Chromium blocks audio until a user gesture. Sound is cosmetic, never gameplay.
- **Physics**: fixed gravity/bounce constants at the top of `game.js`; the ball auto-bounces on landing (`BOUNCE`) and jumps higher on input (`JUMP`). `gdir` per level can invert gravity. Horizontal screen-wrap is intentional. Ring pickup uses a **swept** test (`segDist2` along the ball's per-frame travel segment), not a single-point check — a point test tunnels past rings when the ball bounces fast in a tight space.
- **Rendering**: 128×128 logical canvas upscaled by `S` (scale 2) with `imageSmoothingEnabled = false` for crisp pixels.

### Reverse-engineering tools
`tools/jdis.py` is a dependency-free (no JDK) JVM `.class` disassembler used to recover the tile renderer from the obfuscated JAR. `Cls(path)` parses the constant pool/fields/methods; `disasm(cls, name, desc)` prints bytecode. This is how `atlas.js`'s `DA`/`DB`/`ATLAS`/`TILE` tables were derived from classes `b` (renderer) and `d` (the two `int[]` composite tables) — re-run it against `/tmp` JAR extractions if tile mappings ever need re-verifying.

### CloudFM — internet radio (games/music/)
The second app: a feature-phone internet-radio player. Same zero-build, modular,
script-tags-in-order pattern as Bounce, but **DOM-based** (lists/text, not canvas)
and **discrete input** — which deliberately sidesteps the held-button/dropped-keyup
problem that plagues a real-time game over Cloud Phone's remote key channel.
- `js/api.js` — [Radio-Browser](https://www.radio-browser.info) client (free/open, no key). Tries several mirror hosts in order; keeps **https streams only** (an https page can't play http audio — mixed content); falls back to a built-in SomaFM list if every mirror is unreachable. `GENRES` defines the browse categories.
- `js/player.js` — thin `<audio>` wrapper; surfaces loading/buffering/playing/paused/error via a state callback. Audio reaches the handset because Cloud Phone streams it (HLS/audio confirmed supported); playback starts from a keypress (gesture) to satisfy autoplay policy.
- `js/ui.js` — renders the three screens (`home` genres → `list` stations → `now` playing) from global state `S`, scrolling the selected row into view.
- `js/app.js` — state machine + input. **Nav keys (up/down) auto-repeat** (hold to scroll/ramp volume); **action keys (OK/back/mute) ignore `e.repeat`** + a 150ms debounce so a held button can't cascade through screens. Keys resolve by `keyCode` first, `key` second (T9 digits arrive inconsistently as one or the other).

### Adding a game
Add a folder under `games/`, then add a `.game-item` `<a>` linking to it in the root `index.html` `#game-list` (there's a `<!-- More games can be added here -->` marker). The menu's arrow-key navigation script picks up new items automatically.

## Conventions

Both `index.html` files share a retro aesthetic: `#020812` background, Courier New monospace, small pixel font sizes, and `@media (max-width:140px)` rules targeting tiny feature-phone-sized viewports. Keep new games visually consistent and dependency-free.
