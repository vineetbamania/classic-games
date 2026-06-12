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

### CloudFM — music player (games/music/)
The second app: a feature-phone music player (full songs **and** internet radio).
Same zero-build, modular, script-tags-in-order pattern as Bounce, but **DOM-based**
(lists/text, not canvas) and **discrete input** — which deliberately sidesteps the
held-button/dropped-keyup problem that plagues a real-time game over Cloud Phone's
remote key channel.

Content sources are all free/open and serve **https** (an https page can't play http audio — mixed content). **Search merges three song sources** (see `searchAll` in app.js); each runs in parallel with its own failure path + a 10s guard so a slow/dead source can't hang the search. Results are tagged by `src` and ordered full-songs-first:
- `js/songs.js` — [Audius](https://audius.org) (no key, `app_name` only). **Full songs** via `/v1/tracks/trending` + `/v1/tracks/search`; `/v1/tracks/{id}/stream` returns `audio/mpeg`. CORS OK.
- `js/previews.js` — [iTunes Search API](https://itunes.apple.com/search) for **mainstream 30-sec previews**. iTunes sends no CORS header, so this uses **JSONP** (`?callback=` via injected `<script>`) — works on localhost/Pages/Cloud Phone alike.
- `js/yt.js` — **EXPERIMENTAL** YouTube via [Piped](https://github.com/TeamPiped/Piped) public instances (full songs, no own backend). Two-step: search returns video ids, the stream URL is **resolved lazily on play** (`resolveYt`). Public instances are frequently down/blocked and it's a YouTube-ToS grey area, so it's best-effort — if every `PIPED_HOST` fails, `searchYt` returns nothing and the other two sources carry the search. Update the host list if YT results stop appearing.
- `js/api.js` — [Radio-Browser](https://www.radio-browser.info) for radio stations. Tries several mirror hosts; https only; built-in SomaFM fallback if every mirror is down. `GENRES` = the radio browse categories.

Unified item shape `{kind, src, id, name, sub, url, duration, art, vid?, preview?}`. YT items carry `vid` (no `url` until resolved); favourites persist `src`/`vid`/`preview` so YT/preview items replay. **Search submit is `change`-driven** (feature-phone IMEs only commit the field value on `change`/OK, not keystroke) with Enter as a desktop fallback.
- `js/favorites.js` — localStorage-backed favourites (tracks + stations), with in-memory fallback if storage is blocked. Items keyed by `kind:id-or-url`.
- `js/player.js` — `<audio>` wrapper; `onState` (loading/buffering/playing/paused/error/ended) + `onProgress` (seek bar). Audio reaches the handset because Cloud Phone streams `<audio>`/`<video>` output (HLS confirmed supported) — unlike **Web Audio synthesis**, which only plays on the server (that's why Bounce's beeps are silent on a real phone). Playback starts from a keypress (gesture) for autoplay policy.
- `js/ui.js` — renders the current screen from the stack (`menu`/`genres`/`list`/`search`/`now`); favourited rows show ★; tracks get a progress bar, stations show ● LIVE.
- `js/app.js` — **screen-stack** state machine (Back = pop). Unified track/station item shape `{kind, name, sub, url, art, ...}` drives a shared play queue (Prev `1` / Next `6` + auto-advance on `ended`). Input: **nav keys (up/down) auto-repeat**; **action keys (ok/right/prev/back/fav/mute) ignore `e.repeat`** + 150ms debounce. Keys resolve by `keyCode` first then `key` (T9 digits arrive as one or the other). On the **search** screen the number keys are left free for the handset's text-input method — only OK/Enter (search) and D-pad-Left/Escape (leave) are intercepted, never `4`.
- The `now` screen is a player UI (artwork from Audius/favicon, progress bar for tracks, ● LIVE for radio, circular transport buttons). **Volume** (Up/Down → `audio.volume`) works where the platform honours it; on a feature phone loudness is usually the hardware side keys, so `audio.volume` may be a no-op there — not a bug. **YouTube is intentionally not used**: extracting audio needs a server + breaks YouTube ToS, and embedding is video/DRM-heavy — there's no static, legal, free way to stream mainstream songs (licensing), which is why Audius is the source.

### Adding a game
Add a folder under `games/`, then add a `.game-item` `<a>` linking to it in the root `index.html` `#game-list` (there's a `<!-- More games can be added here -->` marker). The menu's arrow-key navigation script picks up new items automatically.

## Conventions

Both `index.html` files share a retro aesthetic: `#020812` background, Courier New monospace, small pixel font sizes, and `@media (max-width:140px)` rules targeting tiny feature-phone-sized viewports. Keep new games visually consistent and dependency-free.
