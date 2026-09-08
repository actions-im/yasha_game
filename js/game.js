import { bossIndicator } from "./guidance.js";
import { C } from "./constants.js?v=play28";
import {
  v3, setV, copyV, maddV, dist2, mat4, frameFromForward, mouseAimPoint,
} from "./math.js?v=aim";
import { sphereHit, sphereAabb, resolveSphereObb, resolveSphereSphere } from "./collision.js?v=play19";
import { createInput } from "./input.js?v=play29";
import {
  createPlayer, resetPlayer, damagePlayer, healPlayer, addBomb, tryBomb,
  tickPlayerTimers, updatePlayerRails, updatePlayerArena, cannonWorld, aimAtPoint,
  syncRailOffset,
} from "./ship.js?v=play26";
import { Renderer } from "./gl.js?v=environment32";
import { MESH_FNS } from "./mesh.js?v=environment32";
import {
  spawnLaser, spawnBomb, tickProjectiles,
} from "./projectiles.js";
import { updateEnemies, hurtEnemy } from "./enemies.js";
import {
  updateBoss, bossDead, livingBossTargets, coreExposed, bossHp, damageBoss, bossHitboxes, hitBoss,
} from "./bosses.js?v=play29";
import { createStage, tickSpawns, makeBossFor, addArenaBounds, STAGE_META } from "./stages.js?v=visual30";
import { bindUI } from "./ui.js?v=play29";
import { markCleared, stormUnlocked } from "./progress.js";
import { sfx } from "./sfx.js";

const canvas = document.getElementById("gl");
const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
if (!gl) {
  document.body.innerHTML = "<p style='color:#fff;padding:2rem'>WebGL2 is required.</p>";
  throw new Error("WebGL2 required");
}

const renderer = new Renderer(gl);
for (const [name, fn] of Object.entries(MESH_FNS)) {
  renderer.upload(name, fn());
}

const input = createInput(canvas);
const ui = bindUI();
if (typeof ui.initBombs === "function") ui.initBombs();
if (typeof ui.setReticle !== "function") ui.setReticle = function () {};

const railOverride = parseFloat(new URLSearchParams(location.search).get("rails"));
const RAIL_TIME = Number.isFinite(railOverride) && railOverride > 0 ? railOverride : C.RAIL_DURATION;

const proj = mat4.create();
const view = mat4.create();
const viewProj = mat4.create();
const invVP = mat4.create();
const model = mat4.create();
const mvp = mat4.create();
const AIM_DIST = 72;
const aimPoint = v3();
const planePt = v3();
const eye = v3();
const at = v3();
const camUp = v3(0, 1, 0);
const fwdTmp = v3();
const rightTmp = v3();
const upTmp = v3();
const WORLD_UP = v3(0, 1, 0);

const state = {
  mode: "map",
  play: "rails",
  stage: null,
  player: createPlayer(),
  shots: [],
  enemies: [],
  pickups: [],
  particles: [],
  boss: null,
  score: 0,
  railTime: 0,
  bannerAt: 0,
  checkpoint: null,
};

function resize(force = false) {
  const dpr = Math.min(devicePixelRatio || 1, 1);
  const w = Math.max(1, Math.floor(innerWidth * dpr));
  const h = Math.max(1, Math.floor(innerHeight * dpr));
  if (force || canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function showScriptError(err) {
  let box = document.getElementById("script-error");
  if (!box) {
    box = document.createElement("div");
    box.id = "script-error";
    box.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:99;background:#400;color:#fff;padding:12px 16px;font:13px monospace;white-space:pre-wrap;";
    document.body.appendChild(box);
  }
  box.textContent = String(err && err.stack ? err.stack : err);
}
window.addEventListener("error", (e) => showScriptError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showScriptError(e.reason));

function refreshStormLock() {
  const open = stormUnlocked();
  const btn = document.querySelector('[data-stage="storm"]');
  if (!btn) return;
  btn.classList.toggle("locked", !open);
  btn.disabled = !open;
  const blurb = btn.querySelector("p");
  if (blurb) {
    blurb.textContent = open
      ? "Storm corridor. Mixed squads. Giant head."
      : "Locked. Beat routes 01, 02, and 03 to unlock.";
  }
}

function goMap() {
  state.mode = "map";
  state.checkpoint = null;
  input.reset();
  ui.setGuidance(null, false);
  ui.clearFeedback();
  ui.banner("");
  state.boss = null;
  state.enemies.length = 0;
  state.shots.length = 0;
  state.pickups.length = 0;
  state.particles.length = 0;
  refreshStormLock();
  ui.showMap(true);
  ui.showHud(false);
  ui.showPause(false);
  ui.hideResult();
  renderer.setClear(0.02, 0.04, 0.08);
}

function startStage(id) {
  if (id === "storm" && !stormUnlocked()) return;
  input.reset();
  document.activeElement?.blur();
  ui.clearFeedback();
  ui.setGuidance(null, false);
  state.checkpoint = null;
  state.stage = createStage(id);
  resetPlayer(state.player);
  state.shots.length = 0;
  state.enemies.length = 0;
  state.pickups = state.stage.pickups;
  state.particles.length = 0;
  state.boss = null;
  state.score = 0;
  state.railTime = 0;
  state.play = "rails";
  state.mode = "play";
  const f = state.stage.path.sample(8);
  copyV(state.player.pos, f.pos);
  copyV(state.player.forward, f.forward);
  copyV(state.player.right, f.right);
  copyV(state.player.up, f.up);
  const fog = state.stage.meta.fog;
  renderer.setClear(fog[0], fog[1], fog[2]);
  renderer.fog = fog;
  renderer.setFog(state.stage.meta.fogNear, state.stage.meta.fogFar);
  ui.showMap(false);
  ui.hideResult();
  ui.showPause(false);
  ui.showHud(true);
  ui.setHp(state.player.hp);
  ui.setBombs(state.player.bombs);
  ui.setScore(0);
  ui.setRailClock(RAIL_TIME, false);
  ui.setBossHp(0, 0);
  ui.banner(STAGE_META[id].title, 2200);
  tickSpawns(state.stage, 1.05, state.player, state.enemies, state.pickups);
  resize(true);
  render();
}

function enterArena() {
  const player = state.player;
  const stage = state.stage;
  state.checkpoint = { id: stage.id, player: structuredClone(player),
    score: state.score, railTime: state.railTime };
  state.shots.length = 0;
  state.play = "arena";
  state.enemies.length = 0;
  state.pickups.length = 0;
  state.boss = makeBossFor(stage, player);
  addArenaBounds(stage, state.boss.origin);
  const f = player.forward;
  player.yaw = Math.atan2(f.x, f.z);
  player.pitch = 0;
  ui.banner("FREE FLIGHT", 2200);
  sfx.boss();
}

function win() {
  state.mode = "result";
  sfx.win();
  const id = state.stage && state.stage.id;
  const result = id ? markCleared(id) : { unlockedStorm: false };
  ui.banner(result.unlockedStorm ? "NEW ROUTE UNLOCKED" : "STAGE CLEAR", 2500);
  ui.showResult("clear", state.score);
  refreshStormLock();
}

function lose() {
  state.mode = "result";
  sfx.explode();
  ui.banner("SHIP DOWN", 2500);
  input.reset();
  ui.showResult("down", state.score, !!state.checkpoint);
}

document.getElementById("map").addEventListener("click", (e) => {
  const btn = e.target.closest(".route");
  if (!btn || !btn.dataset.stage) return;
  e.preventDefault();
  startStage(btn.dataset.stage);
});
document.getElementById("btn-resume").addEventListener("click", () => {
  resumePlay();
});
document.getElementById("btn-map").addEventListener("click", goMap);
document.getElementById("btn-result").addEventListener("click", goMap);
document.getElementById("btn-retry").addEventListener("click", () => {
  if (state.mode === "result" && state.stage) startStage(state.stage.id);
});

function pausePlay() {
  if (state.mode !== "play") return;
  state.mode = "pause";
  input.reset();
  ui.showPause(true);
  ui.setGuidance(null, false);
}
function resumePlay() {
  input.reset();
  document.activeElement?.blur();
  state.mode = "play";
  ui.showPause(false);
}
window.addEventListener("blur", pausePlay);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pausePlay();
});
document.getElementById("btn-checkpoint").addEventListener("click", () => {
  if (state.mode !== "result" || !state.checkpoint) return;
  const checkpoint = state.checkpoint;
  startStage(checkpoint.id);
  for (const key of ["pos", "prevPos", "forward", "right", "up", "pathDist", "offsetX", "offsetY"]) {
    state.player[key] = structuredClone(checkpoint.player[key]);
  }
  state.score = checkpoint.score;
  state.railTime = checkpoint.railTime;
  enterArena();
  ui.setScore(state.score);
});

function burst(pos, n, colScale = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI;
    state.particles.push({
      pos: v3(pos.x, pos.y, pos.z),
      vel: v3(Math.cos(a) * Math.sin(b) * 18, Math.cos(b) * 18, Math.sin(a) * Math.sin(b) * 18),
      life: 0.45 + Math.random() * 0.4,
      scale: 0.25 + Math.random() * 0.4,
    });
  }
}

function setPlayCamera(player) {
  maddV(eye, player.pos, player.forward, -12.5);
  maddV(eye, eye, player.up, 4.2);
  maddV(at, player.pos, player.forward, 10);
  copyV(camUp, player.up);
  renderer.eye[0] = eye.x; renderer.eye[1] = eye.y; renderer.eye[2] = eye.z;
  const w = Math.max(1, canvas.width);
  const h = Math.max(1, canvas.height);
  mat4.perspective(proj, (62 * Math.PI) / 180, w / h, 0.35, 520);
  mat4.lookAt(view, eye, at, camUp);
  mat4.multiply(viewProj, proj, view);
  mat4.invert(invVP, viewProj);
}

function currentAim(player, snap) {
  maddV(planePt, player.pos, player.forward, AIM_DIST);
  const hit = mouseAimPoint(aimPoint, snap.ndcX, snap.ndcY, invVP, planePt, player.forward);
  if (!hit) maddV(aimPoint, player.pos, player.forward, AIM_DIST);
  return aimPoint;
}

function fireLasers(player, snap) {
  if (player.fireCd > 0) return;
  player.fireCd = C.LASER_COOLDOWN;
  const target = currentAim(player, snap);
  const left = cannonWorld(player, -1);
  const right = cannonWorld(player, 1);
  spawnLaser(state.shots, left, aimAtPoint(left, target), true);
  spawnLaser(state.shots, right, aimAtPoint(right, target), true);
  sfx.laser();
}

function applyBlasts(blasts) {
  for (const b of blasts) {
    burst(b.pos, 18);
    sfx.bomb();
    for (const e of state.enemies) {
      if (e.alive && sphereHit(b.pos, b.radius, e.pos, e.radius)) {
        if (hurtEnemy(e, 9999)) {
          state.score += e.score;
          burst(e.pos, 10);
          ui.feedback("DESTROYED +" + e.score, true);
        }
      }
    }
    if (hitBoss(state.boss, b.pos, b.radius, C.BOMB_DMG_BOSS)) {
      burst(b.pos, 8);
      ui.feedback("BOSS HIT", true);
    }
  }
}

function collideShots(player) {
  for (const s of state.shots) {
    if (s.dead || s.kind === "bomb") continue;
    if (s.fromPlayer) {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (sphereHit(s.pos, s.radius, e.pos, e.radius)) {
          s.dead = true;
          if (hurtEnemy(e, C.LASER_DMG_SMALL)) {
            state.score += e.score;
            burst(e.pos, 10);
            sfx.explode();
            ui.feedback("DESTROYED +" + e.score, true);
          } else { sfx.hit(); ui.feedback("HIT"); }
          break;
        }
      }
      if (!s.dead && hitBoss(state.boss, s.pos, s.radius, C.LASER_DMG_BOSS)) {
        s.dead = true;
        burst(s.pos, 6);
        sfx.hit();
        ui.feedback("BOSS HIT");
      }
    } else if (player.alive) {
      if (sphereHit(s.pos, s.radius, player.pos, C.PLAYER_RADIUS)) {
        s.dead = true;
        if (damagePlayer(player, s.damage)) sfx.damage();
      }
    }
  }
}

function collideWorld(player, dt) {
  if (!player.alive) return false;
  for (const pk of state.pickups) {
    if (!pk.alive) continue;
    if (sphereHit(player.pos, C.PLAYER_RADIUS, pk.pos, pk.radius)) {
      pk.alive = false;
      if (pk.kind === "ring") {
        healPlayer(player, C.RING_HEAL);
        sfx.ring();
      } else if (pk.kind === "bomb") {
        addBomb(player);
        sfx.ring();
      }
    }
  }
  let blocked = false;
  const pd = player.pathDist || 0;
  const solids = state.stage.solids || [];
  for (const obb of solids) {
    if (obb.arena) {
      /* always test arena floor/walls */
    } else {
      const reach = obb.floor ? 90 : 50;
      if (obb.pathDist != null && Math.abs(obb.pathDist - pd) > reach) continue;
    }
    const hit = resolveSphereObb(player.pos, C.PLAYER_RADIUS, obb);
    if (!hit.hit) continue;
    blocked = true;
    const ox = player.pos.x, oy = player.pos.y, oz = player.pos.z;
    player.pos.x = hit.x;
    player.pos.y = hit.y;
    player.pos.z = hit.z;
    if (player.forward) {
      const along =
        (hit.x - ox) * player.forward.x +
        (hit.y - oy) * player.forward.y +
        (hit.z - oz) * player.forward.z;
      if (along < 0) player.pathDist += along;
    }
    if (obb.damage && damagePlayer(player, obb.damage)) sfx.damage();
  }
  for (const box of state.stage.colliders || []) {
    if (sphereAabb(player.pos, C.PLAYER_RADIUS, box)) {
      if (damagePlayer(player, box.damage || C.DMG_SCRAPE)) sfx.damage();
    }
  }
  collideBoss(player);
  return blocked;
}

function collideBoss(player) {
  const boss = state.boss;
  if (!boss || bossDead(boss)) return;
  const push = (center, radius) => {
    const hit = resolveSphereSphere(player.pos, C.PLAYER_RADIUS, center, radius);
    if (!hit.hit) return;
    player.pos.x = hit.x;
    player.pos.y = hit.y;
    player.pos.z = hit.z;
  };
  if (boss.hullRadius > 0 && boss.pos) push(boss.pos, boss.hullRadius);
  for (const part of boss.parts) {
    if (!part.alive) continue;
    push(part.pos, part.radius * 1.1);
  }
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.z += p.vel.z * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function updatePlay(dt, snap) {
  const player = state.player;
  const stage = state.stage;
  if (!player || !stage || !snap) return;
  dt = dt > 0 && dt < 1 ? dt : 1 / 60;
  tickPlayerTimers(player, dt);

  if (state.play === "rails") {
    state.railTime += dt * (player.speed / C.CRUISE_SPEED);
    updatePlayerRails(
      player, dt, snap, stage.path, stage.corridor, stage.meta.scrape,
    );
    collideWorld(player, dt);
    syncRailOffset(player, stage.path.sample(player.pathDist));
    tickSpawns(stage, state.railTime, player, state.enemies, state.pickups);
    if (state.railTime >= RAIL_TIME) enterArena();
  } else {
    updatePlayerArena(player, dt, snap, state.boss.origin);
    updateBoss(state.boss, dt, player, state.shots);
    if (bossDead(state.boss)) {
      state.score += C.SCORE_BOSS;
      burst(state.boss.pos, 28);
      win();
      return;
    }
  }

  setPlayCamera(player);
  currentAim(player, snap);

  if (snap.laserHeld) fireLasers(player, snap);
  if (snap.bomb) {
    if (tryBomb(player)) {
      const from = cannonWorld(player, 0);
      spawnBomb(state.shots, from, aimAtPoint(from, aimPoint));
      sfx.bomb();
    }
  }

  const blasts = tickProjectiles(state.shots, dt, player, [
    ...state.enemies,
    ...(state.boss ? state.boss.parts.filter((p) => p.alive) : []),
  ]);
  applyBlasts(blasts);
  updateEnemies(state.enemies, dt, player, state.shots, stage.path);
  collideShots(player);
  collideWorld(player, dt);
  updateParticles(dt);

  if (!player.alive) lose();

  ui.setHp(player.hp);
  ui.setBombs(player.bombs);
  ui.setScore(state.score);
  ui.setRailClock(RAIL_TIME - state.railTime, state.play === "arena");
  if (state.play === "arena" && state.boss && typeof ui.setBossHp === "function") {
    const hp = bossHp(state.boss);
    ui.setBossHp(hp.cur, hp.max);
  } else if (typeof ui.setBossHp === "function") {
    ui.setBossHp(0, 0);
  }
}

function drawMesh(name, pos, forward, right, up, bank = 0, flash = 0, unlit = false, scale = 1) {
  mat4.fromFrame(model, right, up, forward, pos, bank);
  if (scale !== 1) {
    model[0] *= scale; model[1] *= scale; model[2] *= scale;
    model[4] *= scale; model[5] *= scale; model[6] *= scale;
    model[8] *= scale; model[9] *= scale; model[10] *= scale;
  }
  mat4.multiply(mvp, viewProj, model);
  renderer.draw(name, mvp, model, flash, unlit);
}

function yawFrame(yaw) {
  setV(fwdTmp, Math.sin(yaw), 0, Math.cos(yaw));
  frameFromForward(fwdTmp, rightTmp, upTmp, fwdTmp);
}

function render() {
  resize();
  const arena = state.mode === "play" && state.play === "arena" && state.boss;
  if (!arena) ui.setGuidance(null, false);
  const w = canvas.width, h = canvas.height;
  const player = state.player;

  if (state.mode === "map") {
    renderer.setFog(40, 180);
    renderer.fog = [0.02, 0.04, 0.08];
    renderer.begin(w, h, [0.02, 0.04, 0.08]);
    const t = performance.now() * 0.001;
    setV(eye, Math.sin(t * 0.35) * 9, 3.2, Math.cos(t * 0.35) * 9);
    setV(at, 0, 0, 0);
    setV(camUp, 0, 1, 0);
    renderer.eye[0] = eye.x; renderer.eye[1] = eye.y; renderer.eye[2] = eye.z;
    mat4.perspective(proj, (55 * Math.PI) / 180, w / h, 0.3, 200);
    mat4.lookAt(view, eye, at, camUp);
    mat4.multiply(viewProj, proj, view);
    yawFrame(t * 0.8);
    drawMesh("ship", v3(0, 0, 0), fwdTmp, rightTmp, upTmp, Math.sin(t) * 0.15);
    return;
  }

  setPlayCamera(player);
  if (arena) ui.setGuidance(bossIndicator(state.boss.pos, viewProj, innerWidth, innerHeight), true);

  const fog = state.stage ? state.stage.meta.fog : [0.1, 0.1, 0.12];
  renderer.fog = fog;
  renderer.begin(w, h, fog);

  const fogFar = renderer.fogFar + 30;
  const fogFar2 = fogFar * fogFar;

  if (state.stage) {
    const pd = state.player.pathDist || 0;
    const along = fogFar + 50;
    for (const sc of state.stage.scenery) {
      if (sc.pathDist != null && Math.abs(sc.pathDist - pd) > along) continue;
      else if (sc.pathDist == null && dist2(sc.pos, eye) > fogFar2) continue;
      if (sc.forward) {
        drawMesh(sc.mesh, sc.pos, sc.forward, sc.right, sc.up, 0, 0, false, sc.scale || 1);
      } else {
        yawFrame(sc.yaw || 0);
        drawMesh(sc.mesh, sc.pos, fwdTmp, rightTmp, upTmp, 0, 0, false, sc.scale || 1);
      }
    }
  }

  const pFlash = player.flash + (player.invuln > 0 ? 0.35 * (Math.sin(performance.now() * 0.03) * 0.5 + 0.5) : 0);
  drawMesh("ship", player.pos, player.forward, player.right, player.up, player.bank, pFlash);
  for (const side of [-1, 1]) {
    const exhaust = v3();
    maddV(exhaust, player.pos, player.forward, -1.62);
    maddV(exhaust, exhaust, player.right, side * 0.61);
    maddV(exhaust, exhaust, player.up, -0.04);
    const pulse = 1 + Math.sin(performance.now()*0.04)*0.08;
    drawMesh("exhaust", exhaust, player.forward, player.right, player.up, player.bank, 0, true,
      pulse * (player.boosting ? 1.8 : player.braking ? 0.55 : 1));
  }
  if (state.snap) {
    currentAim(player, state.snap);
    drawMesh("reticle", aimPoint, player.forward, player.right, player.up, 0, 0.35, true, 1.6);
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist2(e.pos, eye) > fogFar2) continue;
    setV(fwdTmp, Math.sin(e.yaw), 0, Math.cos(e.yaw));
    frameFromForward(fwdTmp, rightTmp, upTmp, fwdTmp);
    const esc = e.kind === "gunboat" ? 1.8 : 2.15;
    drawMesh(e.mesh, e.pos, fwdTmp, rightTmp, upTmp, 0, e.flash + e.telegraph * 0.6, false, esc);
  }

  for (const pk of state.pickups) {
    if (!pk.alive) continue;
    yawFrame(performance.now() * 0.002);
    drawMesh(pk.kind === "ring" ? "ring" : "crate", pk.pos, fwdTmp, rightTmp, upTmp);
  }

  if (state.boss) {
    const b = state.boss;
    if (b.kind === "walker") {
      yawFrame(b.yaw);
      drawMesh("walker", b.origin, fwdTmp, rightTmp, upTmp, 0, coreExposed(b) ? 0.25 : 0);
    } else if (b.kind === "head") {
      yawFrame(b.yaw);
      const core = b.parts.find((p) => p.core);
      drawMesh("titanHead", core.pos, fwdTmp, rightTmp, upTmp, 0, core.flash, false, 1);
    } else if (b.kind === "fortress") {
      yawFrame(b.yaw);
      const core = b.parts.find((p) => p.core);
      drawMesh("fortress", core.pos, fwdTmp, rightTmp, upTmp, 0, core.flash);
    }
    for (const p of b.parts) {
      if (!p.alive) continue;
      if (p.mesh === "fortress" || p.mesh === "titanHead") continue;
      if (b.kind === "walker" && p.core) continue;
      if (b.kind === "head") continue;
      yawFrame(p.yaw || b.yaw || 0);
      const glow = p.flash + (p.core && coreExposed(b) ? 0.45 : 0);
      const mesh = b.kind === "serpent"
        ? (p.core ? "serpentHead" : "serpentSeg")
        : p.mesh;
      const sc = p.core && b.kind === "serpent" && b.mouthOpen ? 1.15 : 1;
      drawMesh(mesh, p.pos, fwdTmp, rightTmp, upTmp, 0, glow, false, sc);
    }
  }

  for (const s of state.shots) {
    if (s.dead) continue;
    const f = v3(s.vel.x, s.vel.y, s.vel.z);
    if (f.x === 0 && f.y === 0 && f.z === 0) setV(f, 0, 0, 1);
    frameFromForward(f, rightTmp, upTmp, f);
    const mesh = s.kind === "bomb" ? "bomb" : s.fromPlayer ? "bolt" : "ebolt";
    drawMesh(mesh, s.pos, f, rightTmp, upTmp, 0, 0, true, s.kind === "missile" ? 1.3 : 1);
  }

  for (const p of state.particles) {
    yawFrame(0);
    drawMesh("spark", p.pos, fwdTmp, rightTmp, upTmp, 0, 0.5, true, p.scale);
  }
}

const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;
let last = performance.now();
let fpsFrames = 0;
let fpsWindow = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = now - last;
  if (elapsed < FRAME_MS - 1) return;
  last = now;
  let dt = elapsed / 1000;
  if (!(dt > 0) || dt > 0.25) dt = 1 / TARGET_FPS;
  if (dt > 0.05) dt = 0.05;
  fpsFrames += 1;
  fpsWindow += dt;
  if (fpsWindow >= 0.4) {
    const fps = Math.round(fpsFrames / fpsWindow);
    if (typeof ui.setFps === "function") ui.setFps(fps);
    fpsFrames = 0;
    fpsWindow = 0;
  }
  const snap = input.beginFrame();
  state.snap = snap;
  try {
    const aiming = state.mode === "play";
    if (typeof ui.setReticle === "function") {
      ui.setReticle(snap.cssX, snap.cssY, aiming);
    }
    if (state.mode === "play" && snap.pause) {
      pausePlay();
    } else if (state.mode === "pause" && snap.pause) {
      resumePlay();
    }
  } catch (err) {
    showScriptError(err);
  }
  try {
    if (state.mode === "play" && !snap.pause) updatePlay(dt, snap);
  } catch (err) {
    showScriptError(err);
  }
  try {
    render();
  } catch (err) {
    showScriptError(err);
  }
}

const bootParams = new URLSearchParams(location.search);
const autoStage = bootParams.get("stage");
if (autoStage && STAGE_META[autoStage]) {
  startStage(autoStage);
  if (bootParams.get("arena") === "1") enterArena();
} else {
  goMap();
}
requestAnimationFrame(frame);
