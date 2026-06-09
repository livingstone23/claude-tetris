# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly or use a local server:

```bash
open index.html                  # macOS direct open
python3 -m http.server 8000      # then visit http://localhost:8000
```

## Architecture

Single-file game logic in `game.js` (~305 lines). No dependencies, no bundler.

**State variables** (module-level `let`): `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`.

**Board**: `ROWS × COLS` matrix. Cell value = `0` (empty) or `1–7` (piece color index matching `COLORS` array).

**Piece object**: `{ type, shape, x, y }` where `shape` is a 2D matrix of color indices.

**Key functions and data flow**:
- `init()` → resets all state, calls `spawn()`, starts `requestAnimationFrame(loop)`
- `loop(ts)` → accumulates `dropAccum`; when ≥ `dropInterval` moves piece down or calls `lockPiece()`
- `lockPiece()` → `merge()` (write piece to board) → `clearLines()` → `spawn()`
- `spawn()` → promotes `next` to `current`, generates new `next`; collision on spawn → `endGame()`
- `collide(shape, ox, oy)` → bounds + board overlap check; used by all movement/rotation logic
- `tryRotate()` → `rotateCW()` then wall-kick offsets `[0, -1, 1, -2, 2]`
- `draw()` → clears canvas, draws grid + board cells + ghost (alpha 0.2) + current piece

**Speed formula**: `dropInterval = max(100, 1000 − (level − 1) × 90)` ms. Level increments every 10 lines.

**Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level. Hard drop: +2 pts/cell. Soft drop: +1 pt/row.

## Tunable constants (top of game.js)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | Also update canvas `width`/`height` in `index.html` |
| `BLOCK` | 30px | Pixel size per cell |
| `COLORS` | 7 colors | Index 1–7; index 0 = null |
| `LINE_SCORES` | [0,100,300,500,800] | Points per 1–4 lines cleared |
