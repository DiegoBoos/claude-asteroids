# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Asteroids arcade clone in a single vanilla-JS file, rendered on HTML5 Canvas. No build step, no bundler, no dependencies, no package.json.

## Running

Open `index.html` directly in a browser, or serve locally:

```bash
npx serve .
```

Then visit `http://localhost:3000`. There is no build/lint/test tooling in this repo — verify changes by loading the page and playing.

## Architecture

Everything lives in `game.js` (canvas is 800x600, defined in `index.html`). Structure, top to bottom:

- **Input**: `keys`/`justPressed` maps populated by `keydown`/`keyup` listeners; `pressed(code)` consumes a one-shot press (used for shooting and restart) while `keys[code]` gives held-state (used for rotation/thrust).
- **Entity classes**: `Bullet`, `Asteroid`, `Ship`, `Particle`. Each has `update(dt)` and `draw()`. Positions wrap toroidally via `wrap(v, max)` — the play field has no edges.
- **Asteroids** have 3 sizes (`RADII`/`SPEEDS`/`POINTS` indexed by size 1-3); `split()` produces two smaller asteroids on death, bottoming out at size 1.
- **Global mutable game state** (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`, `state`) lives at module scope, not in a class/object. `state` is one of `'playing' | 'dead' | 'gameover'`.
- **Game flow**: `initGame()` resets everything and calls `spawnAsteroids(4)`; `nextLevel()` triggers when `asteroids.length === 0`; `killShip()` decrements lives and either goes to `'dead'` (temporary, respawns after `deadTimer` seconds with invincibility) or `'gameover'`.
- **Main loop**: `requestAnimationFrame(loop)` computes `dt` (clamped to 0.05s), calls `update(dt)` then `draw()`. All collision detection (bullet-vs-asteroid, ship-vs-asteroid) happens inside `update()` using simple circle distance checks (`dist`).
- **Rendering** is all `ctx` calls, no sprites/images — everything is stroked vector shapes (ship, asteroid polygons, bullets, particles) plus a text HUD (`drawHUD`) and overlay screen (`drawOverlay`) for game over.

When adding features, follow the existing pattern: a class with `update(dt)`/`draw()`, pushed into the relevant global array, filtered out via a `dead` flag each frame.

## UI text

HUD/overlay text and README are in Spanish (`NIVEL`, `PUNTAJE`, `GAME OVER`, etc.) — match this when adding player-facing text.
