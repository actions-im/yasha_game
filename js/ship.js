import { C } from "./constants.js?v=play23";
import {
  v3, setV, copyV, addV, maddV, scaleV, clamp, forwardFromYawPitch,
  frameFromForward, norm, dot,
} from "./math.js";

export function createPlayer() {
  return {
    hp: C.HP_MAX,
    bombs: C.BOMBS_MAX,
    invuln: 0,
    offsetX: 0,
    offsetY: 0,
    pathDist: 8,
    yaw: 0,
    pitch: 0,
    pos: v3(),
    prevPos: v3(),
    forward: v3(0, 0, 1),
    right: v3(1, 0, 0),
    up: v3(0, 1, 0),
    bank: 0,
    fireCd: 0,
    alive: true,
    flash: 0,
    speed: C.CRUISE_SPEED,
    boosting: false,
    braking: false,
  };
}

export function resetPlayer(p) {
  p.hp = C.HP_MAX;
  p.bombs = C.BOMBS_MAX;
  p.invuln = 0;
  p.offsetX = 0;
  p.offsetY = 0;
  p.pathDist = 8;
  p.yaw = 0;
  p.pitch = 0;
  p.fireCd = 0;
  p.alive = true;
  p.flash = 0;
  p.speed = C.CRUISE_SPEED;
  p.boosting = false;
  p.braking = false;
  setV(p.pos, 0, 0, 0);
  setV(p.forward, 0, 0, 1);
  setV(p.right, 1, 0, 0);
  setV(p.up, 0, 1, 0);
}

export function damagePlayer(p, amount) {
  if (!p.alive || p.invuln > 0) return false;
  p.hp = Math.max(0, p.hp - amount);
  p.invuln = C.INVULN_SEC;
  p.flash = 1;
  if (p.hp <= 0) p.alive = false;
  return true;
}

export function healPlayer(p, amount) {
  if (!p.alive) return;
  p.hp = Math.min(C.HP_MAX, p.hp + amount);
}

export function addBomb(p) {
  if (p.bombs >= C.BOMBS_MAX) return false;
  p.bombs += 1;
  return true;
}

export function tryBomb(p) {
  if (!p.alive || p.bombs <= 0) return false;
  p.bombs -= 1;
  return true;
}

export function tickPlayerTimers(p, dt) {
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.fireCd > 0) p.fireCd = Math.max(0, p.fireCd - dt);
  if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 4);
}

export function updatePlayerRails(p, dt, input, path, corridor, scrape) {
  copyV(p.prevPos, p.pos);
  p.boosting = !!input.boost && !input.brake;
  p.braking = !!input.brake && !input.boost;
  p.speed = p.boosting ? C.BOOST_SPEED : p.braking ? C.BRAKE_SPEED : C.CRUISE_SPEED;
  p.pathDist += p.speed * dt;

  // Screen-left is +path.right with this chase camera (lookAt x-axis is flipped).
  const sx = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const sy = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const strafe = p.boosting ? C.STRAFE_SPEED * 0.7 : p.braking ? C.STRAFE_SPEED * 1.25 : C.STRAFE_SPEED;
  p.offsetX += sx * strafe * dt;
  p.offsetY += sy * strafe * dt;
  p.offsetX = clamp(p.offsetX, -corridor.x, corridor.x);
  p.offsetY = clamp(p.offsetY, -corridor.y, corridor.y);

  const frame = path.sample(p.pathDist);
  maddV(p.pos, frame.pos, frame.right, p.offsetX);
  maddV(p.pos, p.pos, frame.up, p.offsetY);
  copyV(p.forward, frame.forward);
  copyV(p.right, frame.right);
  copyV(p.up, frame.up);
  p.bank = lerpToward(p.bank, -sx * 0.45 - p.offsetX * 0.04, dt * 6);
  p.yaw = Math.atan2(p.forward.x, p.forward.z);

  let scraped = false;
  if (scrape) {
    const edgeX = corridor.x * 0.9;
    const edgeY = corridor.y * 0.9;
    if (Math.abs(p.offsetX) > edgeX || Math.abs(p.offsetY) > edgeY) scraped = true;
  }
  return scraped;
}

function lerpToward(a, b, t) {
  return a + (b - a) * Math.min(1, t);
}

export function updatePlayerArena(p, dt, input, origin) {
  copyV(p.prevPos, p.pos);
  p.boosting = input.boost && !input.brake && !input.reverse;
  p.braking = input.brake && !input.boost && !input.reverse;
  if (input.reverse) p.speed = -C.CRUISE_SPEED;
  else p.speed = p.boosting ? C.BOOST_SPEED : p.braking ? C.BRAKE_SPEED : C.CRUISE_SPEED;

  const yawIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const pitchIn = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const turnScale = p.boosting ? 0.55 : p.braking ? 1.35 : 1;
  p.yaw += yawIn * C.YAW_RATE * turnScale * dt;
  p.pitch += pitchIn * C.PITCH_RATE * turnScale * dt;
  p.pitch = clamp(p.pitch, -C.PITCH_LIMIT, C.PITCH_LIMIT);

  forwardFromYawPitch(p.forward, p.yaw, p.pitch);
  frameFromForward(p.forward, p.right, p.up, p.forward);
  maddV(p.pos, p.pos, p.forward, p.speed * dt);
  p.bank = lerpToward(p.bank, -yawIn * 0.5, dt * 5);

  const dx = p.pos.x - origin.x;
  const dy = p.pos.y - origin.y;
  const dz = p.pos.z - origin.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > C.ARENA_RADIUS) {
    const s = C.ARENA_RADIUS / d;
    p.pos.x = origin.x + dx * s;
    p.pos.y = origin.y + dy * s;
    p.pos.z = origin.z + dz * s;
  }
}

export function syncRailOffset(p, frame) {
  const dx = p.pos.x - frame.pos.x;
  const dy = p.pos.y - frame.pos.y;
  const dz = p.pos.z - frame.pos.z;
  p.offsetX = dx * frame.right.x + dy * frame.right.y + dz * frame.right.z;
  p.offsetY = dx * frame.up.x + dy * frame.up.y + dz * frame.up.z;
}

export function cannonWorld(p, side) {
  const out = v3();
  maddV(out, p.pos, p.right, side * 1.15);
  maddV(out, out, p.up, -0.15);
  maddV(out, out, p.forward, 1.6);
  return out;
}

export function aimDir(p, enemies) {
  const dir = v3();
  copyV(dir, p.forward);
  let best = null;
  let bestDot = C.AUTOAIM_DOT;
  for (const e of enemies) {
    if (!e.alive) continue;
    const to = v3(e.pos.x - p.pos.x, e.pos.y - p.pos.y, e.pos.z - p.pos.z);
    norm(to, to);
    const d = dot(p.forward, to);
    if (d > bestDot) {
      bestDot = d;
      best = to;
    }
  }
  if (best) {
    dir.x = p.forward.x * 0.72 + best.x * 0.28;
    dir.y = p.forward.y * 0.72 + best.y * 0.28;
    dir.z = p.forward.z * 0.72 + best.z * 0.28;
    norm(dir, dir);
  }
  return dir;
}

/** Direction from a cannon (or the ship) to a world aim point. */
export function aimAtPoint(from, target) {
  const dir = v3(target.x - from.x, target.y - from.y, target.z - from.z);
  const l = Math.hypot(dir.x, dir.y, dir.z);
  if (l < 0.001) return v3(0, 0, 1);
  dir.x /= l;
  dir.y /= l;
  dir.z /= l;
  return dir;
}

export function hpColor(hp) {
  const t = hp / C.HP_MAX;
  if (t > 0.5) return "ok";
  if (t > 0.25) return "mid";
  return "low";
}
