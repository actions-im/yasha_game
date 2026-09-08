# Star Fox–style WebGL Rail Shooter

Date: 2026-09-06  
Status: approved in conversation; awaiting spec review before implementation plan

## Goal

A browser 3D shooter in the spirit of classic Star Fox: on-rails flight, then an all-range boss, with a health bar, wing guns, bombs, and enemies. Original ships and stages — not Nintendo IP, names, or exact copies.

Success: a player can open the game in a browser, pick a stage from a course map, fly ~5 minutes of rails, fight an all-range boss, see health and bombs on the HUD, and return to the map on win or death.

## Constraints

- Web only. Rendering is **WebGL2** (browser OpenGL). No Three.js, Babylon, PlayCanvas, or other 3D engines.
- No build step. ES modules loaded from a local static server (WebGL2 + modules will not run reliably as `file://`).
- Low-poly, vertex-colored meshes generated in code. No external 3D model files.
- Keyboard + mouse. No gamepad in v1.
- Single player. One ship, one stage at a time.

## High-level flow

1. Title screen with a **course map**.
2. Player picks one of three routes (any order, all unlocked).
3. Stage: **~5 minutes on rails**, then **all-range boss**.
4. Win overlay (boss destroyed) or fail overlay (HP hits 0).
5. Return to the course map. Retry the same stage or pick another.

Pause with Esc during a stage; resume or quit to map.

## Flight model (hybrid)

### On-rails (~5 minutes)

The path pulls the ship forward at a constant cruise speed. The player steers in a corridor: left/right/up/down in path-local space. The camera is a chase cam behind the ship. The ship banks and pitches slightly so it reads as a plane, not a cursor.

Corridor bounds: leaving the play box is clamped (Planet, Space) or deals contact damage (Canyon walls).

### All-range (boss)

Forward flight is player-controlled. Yaw is free 360°. Pitch is limited (no inverted loops, no full 6DOF tumble). The fighter stays visually upright, Star Fox 64 style. Chase camera stays behind the ship.

- **Left Shift:** boost (higher speed, harder to turn).
- **Right Shift:** brake (lower speed, tighter turn).
- Neither: cruise speed.

Boost and brake do nothing meaningful on rails (path speed is fixed). They are live in all-range only.

## Controls (left-handed)

WASD is not bound.

| Input | Action |
|---|---|
| Arrow keys | Rails: move in corridor. All-range: yaw (left/right) and pitch (up/down) |
| Mouse click | Fire twin lasers |
| Space | Fire a bomb (if any remain) |
| Left Shift | Boost (all-range) |
| Right Shift | Brake (all-range) |
| Esc | Pause; from pause, resume or return to map |

Mouse may sit in the left hand. Arrows, Space, and both Shifts are right-hand reachable.

## Player ship

Low-poly original fighter: pointed nose, two wings, twin laser cannons at the wing roots, engine at the tail. Vertex colors (white/cyan hull, dark intakes). Not an Arwing replica.

- Start each stage at **100 HP** and **3 bombs**.
- Unlimited lasers.
- After a hit: short invulnerability (about 0.8s) and a hull flash so one swarm cannot shred the bar.
- HP 0: explosion, “SHIP DOWN”, return to map. No extra lives.

### Lasers

- Twin forward bolts from the wing cannons.
- Fire rate about 8 shots/sec while the mouse button is held.
- Slight auto-aim inside a small cone toward the nearest enemy so shots feel like classic Star Fox, not a precision sim.
- On hit: enemy flashes and loses HP. Lasers do modest single-target damage.

### Bombs

- Smart-bomb style: a charged sphere launches forward and detonates after a short fuse or on proximity.
- Area damage: destroys typical rail enemies in the blast, heavy damage to boss parts in range.
- HUD shows remaining bombs (3 icons).
- Rare rail pickup can restore 1 bomb, capped at 3.

### Rings

Gold rings on the rails restore a chunk of HP (20). They do not appear in the boss arena.

## Enemies (shared)

Shots are telegraphed: a bright muzzle flash, then the bolt. Player lasers and bombs use the same hit rules on every stage.

| Type | Role | HP | Notes |
|---|---|---|---|
| Fighter | Rail swarm | Low | V-formations; fire forward |
| Interceptor | Fast strafe | Low | Dart across the corridor |
| Turret | Ground / wall | Medium | Leads shots; static |
| Missile nest | Canyon | Medium | Fires homing missiles (slow turn) |
| Drone | Space | Low | Hover, weak shots |
| Gunboat | Space | High | Slow, fat projectiles |

Score increases on kill. Score is display-only (no unlocks).

## Stages

Each stage is ~5 minutes of rails plus the boss arena. Extra rail time is filled with formations, turrets, and pickups — not empty sky.

### Planet — green hills, ruins, sky

- Rails over rolling terrain, stone arches, distant mountains.
- Enemies: fighters in V-formations, ground turrets.
- **Boss:** four-legged walker. All-range circle around it. Destroy glowing weak points on each leg, then the core. Core is invulnerable until all legs are down.

### Canyon — sandstone trench

- Tight walls. Contact with canyon rock deals damage.
- Enemies: interceptors, cliff missile nests.
- **Boss:** winged serpent at the canyon mouth. All-range. Vulnerable when the head opens; boost/brake to stay behind it.

### Space — neon trench, then open void

- Rails down a capital-ship trench: columns, exhaust glow, laser grids that damage on touch.
- Enemies: drones, heavy gunboats.
- **Boss:** rotating fortress. All-range. Destroy exposed shield generators around the hull, then the core. Core invulnerable until generators are down.

## HUD

HTML/CSS overlay on the WebGL canvas. No text baked into textures.

- **Top-left:** health bar, green → yellow → red as HP drops. Low HP adds a screen-edge vignette.
- **Next to health:** three bomb icons; empty slots when spent.
- **Top-right:** score.
- **Bottom:** compact control reminder (arrows / click / space / shifts).
- **Center, timed:** “BOSS” when the arena starts; “STAGE CLEAR” or “SHIP DOWN” at the end.
- Pause dim + menu: Resume, Course map.

Course map: three labeled nodes (Planet, Canyon, Space), all selectable from the start. Hover/focus highlight, click or Enter to start.

## Rendering (WebGL2)

Custom thin layer only:

- Perspective camera, look-at chase rig.
- Vertex-colored meshes, one simple lighting model (directional + ambient).
- Instanced or batched unlit bolts for lasers/projectiles.
- Additive engine trail on boost; simple airbrake plates on brake.
- Fog / distance fade so the rail path can stream (spawn ahead, despawn behind).

No external image textures required for v1. Sky and terrain are geometry + vertex color + fog.

## Project layout

```
index.html          canvas, HUD markup, course map, pause
css/style.css       HUD, map, overlays
js/gl.js            WebGL2 bootstrap, shaders, GPU buffers, camera math
js/mesh.js          procedural ship, terrain chunks, enemy meshes
js/ship.js          player transform, lasers, bombs, health, invuln
js/enemies.js       fighter, interceptor, turret, nests, drones, gunboats
js/bosses.js        walker, serpent, fortress + weak-point logic
js/stages.js        three rail paths, spawn timelines, arena switch
js/ui.js            map, pause, HUD numbers, win/lose
js/game.js          main loop, mode (map / rails / arena / overlay), collisions
```

Entry: `index.html` loads `js/game.js` as a module.

## Collision and damage (explicit)

- Lasers vs enemies: sphere vs sphere (bolt radius vs enemy radius).
- Bombs: sphere vs sphere at detonation radius.
- Enemy bolts vs player: sphere vs player hull sphere.
- Canyon walls and space laser grids: player hull vs static colliders; damage on overlap per tick, gated by invuln.
- Boss weak points: separate spheres; only those take damage until the phase rule (legs / generators) is met.

Player damage examples (so tuning is not ambiguous):

- Enemy fighter bolt: 8 HP
- Turret / gunboat bolt: 12 HP
- Missile: 18 HP
- Wall / grid scrape: 10 HP per contact after invuln
- Boss projectile: 15 HP

Bomb vs small enemy: destroy. Bomb vs boss part: 35 HP. Laser vs small enemy: 25 HP per hit. Laser vs boss part: 8 HP per hit.

## Out of scope (v1)

- Gamepad, touch, or remappable keys
- Multiplayer, lives system, branching map paths
- External 3D assets, music engine, or licensed Star Fox content
- Settings menu beyond pause
- Mobile layout

## Testing

Manual, in-browser:

1. Course map opens; all three stages start.
2. Arrows steer; click lasers; Space bombs (3 then dry); Left Shift boosts and Right Shift brakes only in the arena.
3. WASD does nothing.
4. Health bar moves and recolors on hits; rings heal; death at 0.
5. Each stage lasts about 5 minutes of rails before “BOSS”.
6. Each boss respects its weak-point rule, then dies, then “STAGE CLEAR”.
7. Esc pause → map; retry works.
