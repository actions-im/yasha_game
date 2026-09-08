import { C } from "./constants.js";
import { v3, setV, copyV, subV, norm, maddV, dist, rand } from "./math.js";
import { spawnEnemyBolt, spawnMissile } from "./projectiles.js";

const HP = {
  fighter: C.HP_FIGHTER,
  interceptor: C.HP_INTERCEPTOR,
  turret: C.HP_TURRET,
  nest: C.HP_NEST,
  drone: C.HP_DRONE,
  gunboat: C.HP_GUNBOAT,
};
const RAD = {
  fighter: 2.6,
  interceptor: 2.2,
  turret: 2.8,
  nest: 2.8,
  drone: 2.3,
  gunboat: 4.6,
};
const SCORE = {
  fighter: C.SCORE_FIGHTER,
  interceptor: C.SCORE_INTERCEPTOR,
  turret: C.SCORE_TURRET,
  nest: C.SCORE_NEST,
  drone: C.SCORE_DRONE,
  gunboat: C.SCORE_GUNBOAT,
};
const MESH = {
  fighter: "fighter",
  interceptor: "interceptor",
  turret: "turret",
  nest: "nest",
  drone: "drone",
  gunboat: "gunboat",
};

export function makeEnemy(kind, pos, opts = {}) {
  return {
    kind,
    mesh: MESH[kind],
    pos: v3(pos.x, pos.y, pos.z),
    vel: v3(opts.vx || 0, opts.vy || 0, opts.vz || 0),
    hp: HP[kind],
    radius: RAD[kind],
    alive: true,
    flash: 0,
    shootT: rand(0.5, 2.2),
    telegraph: 0,
    fromPlayer: false,
    isBossPart: false,
    score: SCORE[kind],
    pathDist: opts.pathDist || 0,
    strafe: opts.strafe || (kind === "interceptor" ? 14 : 0),
    strafeSign: opts.strafeSign || 1,
    lead: kind === "turret" || kind === "gunboat",
    homing: kind === "nest",
    yaw: 0,
    bank: 0,
  };
}

export function hurtEnemy(e, amount) {
  if (!e.alive) return false;
  e.hp -= amount;
  e.flash = 1;
  if (e.hp <= 0) {
    e.alive = false;
    return true;
  }
  return false;
}

export function updateEnemies(list, dt, player, shots, path) {
  for (const e of list) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt * 4);
    e.phase = (e.phase || 0) + dt;

    if (e.kind === "interceptor") {
      e.pos.x += e.strafe * e.strafeSign * dt;
      if (Math.abs(e.pos.x) > 40) e.strafeSign *= -1;
      e.pos.z += e.vel.z * dt;
    } else if (e.kind === "drone") {
      e.pos.x += Math.sin(e.phase * 2.2) * 4 * dt;
      e.pos.y += Math.cos(e.phase * 1.7) * 3 * dt;
    } else if (e.kind === "fighter") {
      e.pos.x += e.vel.x * dt;
      e.pos.y += e.vel.y * dt;
      e.pos.z += e.vel.z * dt;
    } else if (e.kind === "gunboat") {
      e.pos.z += e.vel.z * dt;
    }

    const toP = v3();
    subV(toP, player.pos, e.pos);
    const d = Math.hypot(toP.x, toP.y, toP.z) || 1;
    e.yaw = Math.atan2(toP.x, toP.z);

    e.shootT -= dt;
    if (e.shootT < 0.22) e.telegraph = 1;
    else e.telegraph = Math.max(0, e.telegraph - dt * 3);

    if (e.shootT <= 0 && d < 120 && d > 4) {
      const dir = v3();
      if (e.lead) {
        const t = d / 70;
        setV(dir, player.pos.x + player.forward.x * 8 * t - e.pos.x,
          player.pos.y + player.forward.y * 8 * t - e.pos.y,
          player.pos.z + player.forward.z * 8 * t - e.pos.z);
      } else {
        copyV(dir, toP);
      }
      norm(dir, dir);
      if (e.homing) {
        spawnMissile(shots, e.pos, dir);
        e.shootT = rand(2.4, 3.6);
      } else {
        const dmg = e.kind === "gunboat" || e.kind === "turret"
          ? C.DMG_TURRET_BOLT
          : C.DMG_FIGHTER_BOLT;
        const spd = e.kind === "gunboat" ? 48 : 78;
        spawnEnemyBolt(shots, e.pos, dir, dmg, spd);
        e.shootT = e.kind === "gunboat" ? rand(1.6, 2.4) : rand(1.1, 2.0);
      }
      e.telegraph = 0;
    }
  }
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;
    if (player.pathDist && e.pathDist && e.pathDist < player.pathDist - 40) continue;
    if (dist(e.pos, player.pos) > 400) continue;
    list[w++] = e;
  }
  list.length = w;
}

export { MESH, HP, RAD };
