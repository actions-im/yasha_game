import { C } from "./constants.js";
import { v3, copyV, maddV, setV } from "./math.js";
import { sphereHit } from "./collision.js";

let _id = 1;

export function spawnLaser(list, origin, dir, fromPlayer = true) {
  const p = {
    id: _id++,
    kind: "laser",
    pos: v3(origin.x, origin.y, origin.z),
    vel: v3(dir.x * C.LASER_SPEED, dir.y * C.LASER_SPEED, dir.z * C.LASER_SPEED),
    life: C.LASER_LIFE,
    radius: C.LASER_RADIUS,
    fromPlayer,
    damage: fromPlayer ? C.LASER_DMG_SMALL : C.DMG_FIGHTER_BOLT,
    color: fromPlayer ? [0.35, 1, 0.55] : [1, 0.25, 0.2],
  };
  list.push(p);
  return p;
}

export function spawnEnemyBolt(list, origin, dir, damage, speed, color) {
  const sp = speed || 70;
  list.push({
    id: _id++,
    kind: "bolt",
    pos: v3(origin.x, origin.y, origin.z),
    vel: v3(dir.x * sp, dir.y * sp, dir.z * sp),
    life: 3.2,
    radius: 0.55,
    fromPlayer: false,
    damage,
    color: color || [1, 0.35, 0.15],
  });
}

export function spawnMissile(list, origin, dir) {
  list.push({
    id: _id++,
    kind: "missile",
    pos: v3(origin.x, origin.y, origin.z),
    vel: v3(dir.x * 38, dir.y * 38, dir.z * 38),
    life: 5,
    radius: 0.7,
    fromPlayer: false,
    damage: C.DMG_MISSILE,
    color: [1, 0.6, 0.2],
    homing: true,
  });
}

export function spawnBomb(list, origin, dir) {
  list.push({
    id: _id++,
    kind: "bomb",
    pos: v3(origin.x, origin.y, origin.z),
    vel: v3(dir.x * C.BOMB_SPEED, dir.y * C.BOMB_SPEED, dir.z * C.BOMB_SPEED),
    life: C.BOMB_FUSE,
    radius: 1.1,
    fromPlayer: true,
    fuse: C.BOMB_FUSE,
    exploded: false,
    blast: C.BOMB_RADIUS,
    color: [0.4, 0.9, 1],
  });
}

export function tickProjectiles(list, dt, player, enemies) {
  const blasts = [];
  for (const p of list) {
    if (p.dead) continue;
    if (p.homing && player) {
      const dx = player.pos.x - p.pos.x;
      const dy = player.pos.y - p.pos.y;
      const dz = player.pos.z - p.pos.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      p.vel.x += (dx / l) * 22 * dt;
      p.vel.y += (dy / l) * 22 * dt;
      p.vel.z += (dz / l) * 22 * dt;
      const sp = Math.hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
      const cap = 48;
      p.vel.x = (p.vel.x / sp) * cap;
      p.vel.y = (p.vel.y / sp) * cap;
      p.vel.z = (p.vel.z / sp) * cap;
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.z += p.vel.z * dt;
    p.life -= dt;
    if (p.kind === "bomb") {
      let near = false;
      for (const e of enemies) {
        if (e.alive && sphereHit(p.pos, C.BOMB_PROXIMITY, e.pos, e.radius)) {
          near = true;
          break;
        }
      }
      if (p.life <= 0 || near) {
        p.dead = true;
        p.exploded = true;
        blasts.push({ pos: v3(p.pos.x, p.pos.y, p.pos.z), radius: p.blast });
      }
    } else if (p.life <= 0) {
      p.dead = true;
    }
  }
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    if (!list[i].dead) list[w++] = list[i];
  }
  list.length = w;
  return blasts;
}

export function hitProjectilesVsSpheres(list, targets, onHit) {
  for (const p of list) {
    if (p.dead) continue;
    for (const t of targets) {
      if (!t.alive) continue;
      if (p.fromPlayer === t.fromPlayer) continue;
      if (sphereHit(p.pos, p.radius, t.pos, t.radius)) {
        p.dead = true;
        onHit(p, t);
        break;
      }
    }
  }
}
