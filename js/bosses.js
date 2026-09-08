import { sphereHit } from "./collision.js";
import { C } from "./constants.js";
import { v3, setV, copyV, subV, norm, maddV, dist } from "./math.js";
import { spawnEnemyBolt } from "./projectiles.js";

function part(id, x, y, z, hp, radius, mesh, core = false) {
  return {
    id,
    pos: v3(x, y, z),
    local: v3(x, y, z),
    hp,
    maxHp: hp,
    radius,
    mesh,
    alive: true,
    flash: 0,
    isBossPart: true,
    fromPlayer: false,
    core,
    yaw: 0,
  };
}

export function createWalker(origin) {
  const legs = [
    part("leg0", -7, 0.5, -6, C.WALKER_LEG_HP, 3.2, "spark"),
    part("leg1", 7, 0.5, -6, C.WALKER_LEG_HP, 3.2, "spark"),
    part("leg2", -7, 0.5, 6, C.WALKER_LEG_HP, 3.2, "spark"),
    part("leg3", 7, 0.5, 6, C.WALKER_LEG_HP, 3.2, "spark"),
  ];
  const core = part("core", 0, 8, 0, C.WALKER_CORE_HP, 4.2, "spark", true);
  const parts = [...legs, core];
  for (const p of parts) {
    p.pos.x = origin.x + p.local.x;
    p.pos.y = origin.y + p.local.y;
    p.pos.z = origin.z + p.local.z;
  }
  return withHpPool({
    kind: "walker",
    origin: v3(origin.x, origin.y, origin.z),
    pos: v3(origin.x, origin.y + 8, origin.z),
    hullRadius: 10,
    parts,
    t: 0,
    shootT: 1.2,
    yaw: 0,
  });
}

export function createSerpent(origin) {
  const segs = [];
  for (let i = 0; i < 8; i++) {
    segs.push(part("seg" + i, origin.x, origin.y, origin.z + 6 + (i + 1) * 5.4, 9999, 2.6, "serpentSeg"));
    segs[i].invuln = true;
  }
  const head = part("head", origin.x, origin.y, origin.z + 6, C.SERPENT_HEAD_HP, 3.6, "serpentHead", true);
  return withHpPool({
    kind: "serpent",
    origin: v3(origin.x, origin.y, origin.z),
    pos: v3(origin.x, origin.y, origin.z),
    hullRadius: 0,
    parts: [...segs, head],
    t: 0,
    mouthOpen: false,
    shootT: 0.8,
  });
}

export function createHead(origin) {
  const core = part("core", origin.x, origin.y + 10, origin.z, C.HEAD_HP, 16, "titanHead", true);
  return withHpPool({
    kind: "head",
    origin: v3(origin.x, origin.y, origin.z),
    pos: v3(origin.x, origin.y + 10, origin.z),
    hullRadius: 18,
    parts: [core],
    t: 0,
    shootT: 0.7,
    yaw: 0,
    mouthOpen: true,
  });
}

export function createTitan(origin) {
  return createHead(origin);
}

export function createFortress(origin) {
  const gens = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    gens.push(part("gen" + i, origin.x + Math.cos(a) * 28, origin.y, origin.z + Math.sin(a) * 28, C.FORT_GEN_HP, 3.2, "generator"));
  }
  const core = part("core", origin.x, origin.y, origin.z, C.FORT_CORE_HP, 8, "fortress", true);
  return withHpPool({
    kind: "fortress",
    origin: v3(origin.x, origin.y, origin.z),
    pos: v3(origin.x, origin.y, origin.z),
    hullRadius: 11,
    parts: [...gens, core],
    t: 0,
    shootT: 0.6,
    yaw: 0,
  });
}

function withHpPool(boss) {
  let max = 0;
  for (const p of boss.parts) {
    if (p.invuln) continue;
    max += p.maxHp || 0;
  }
  boss.maxHp = max;
  boss.hp = max;
  return boss;
}

export function legsDown(boss) {
  return boss.parts.filter((p) => p.id.startsWith("leg")).every((p) => !p.alive);
}

export function gensDown(boss) {
  return boss.parts.filter((p) => p.id.startsWith("gen")).every((p) => !p.alive);
}

export function coreExposed(boss) {
  if (boss.kind === "walker") return legsDown(boss);
  if (boss.kind === "fortress") return gensDown(boss);
  if (boss.kind === "serpent") return boss.mouthOpen;
  if (boss.kind === "head") return true;
  return true;
}

export function damageBoss(boss, amount) {
  if (!boss || boss.hp <= 0) return false;
  boss.hp = Math.max(0, boss.hp - amount);
  for (const p of boss.parts) {
    if (p.alive) p.flash = 1;
  }
  if (boss.hp <= 0) {
    for (const p of boss.parts) {
      p.hp = 0;
      p.alive = false;
    }
    return true;
  }
  return false;
}

export function bossHitboxes(boss) {
  const boxes = [];
  if (!boss) return boxes;
  if (boss.hullRadius > 0 && boss.pos) {
    boxes.push({ pos: boss.pos, radius: boss.hullRadius, alive: true });
  }
  for (const p of boss.parts) {
    if (p.alive) boxes.push(p);
  }
  return boxes;
}

export function hurtBossPart(boss, part, amount) {
  if (!part.alive) return 0;
  if (part.invuln) return 0;
  if (part.core) {
    if (boss.kind === "walker" && !legsDown(boss)) return 0;
    if (boss.kind === "fortress" && !gensDown(boss)) return 0;
    if (boss.kind === "serpent" && !boss.mouthOpen) return 0;
  }
  part.hp -= amount;
  part.flash = 1;
  if (part.hp <= 0) {
    part.alive = false;
    return 1;
  }
  return 0;
}

export function bossDead(boss) {
  if (!boss) return true;
  if (typeof boss.hp === "number" && boss.hp <= 0) return true;
  const core = boss.parts.find((p) => p.core);
  return !!(core && !core.alive);
}

export function bossHp(boss) {
  if (!boss) return { cur: 0, max: 0 };
  if (typeof boss.hp === "number" && boss.maxHp) {
    return { cur: Math.max(0, boss.hp), max: boss.maxHp };
  }
  let cur = 0, max = 0;
  for (const p of boss.parts) {
    if (p.invuln) continue;
    max += p.maxHp || 0;
    cur += p.alive ? Math.max(0, p.hp) : 0;
  }
  return { cur, max };
}

export function updateBoss(boss, dt, player, shots) {
  boss.t += dt;
  for (const p of boss.parts) {
    p.flash = Math.max(0, p.flash - dt * 3);
  }

  if (boss.kind === "walker") {
    boss.yaw += dt * 0.25;
    const bob = Math.sin(boss.t * 1.4) * 0.6;
    for (const p of boss.parts) {
      const c = Math.cos(boss.yaw), s = Math.sin(boss.yaw);
      p.pos.x = boss.origin.x + p.local.x * c - p.local.z * s;
      p.pos.z = boss.origin.z + p.local.x * s + p.local.z * c;
      p.pos.y = boss.origin.y + p.local.y + (p.core ? bob : Math.abs(bob) * 0.4);
      p.yaw = boss.yaw;
    }
    copyV(boss.pos, boss.parts.find((p) => p.core).pos);
  } else if (boss.kind === "serpent") {
    const cycle = 4.5;
    const phase = boss.t % cycle;
    boss.mouthOpen = phase > 2.4 && phase < 3.9;
    const head = boss.parts.find((p) => p.core);
    const segs = boss.parts.filter((p) => !p.core);
    const ox = boss.origin.x + Math.sin(boss.t * 0.7) * 4;
    const oy = boss.origin.y + Math.sin(boss.t * 1.1) * 2.4;
    const oz = boss.origin.z + 10 + Math.cos(boss.t * 0.5) * 3;
    setV(head.pos, ox, oy, oz);
    for (let i = 0; i < segs.length; i++) {
      const k = boss.t - (i + 1) * 0.2;
      segs[i].pos.x = boss.origin.x + Math.sin(k * 0.7) * 4;
      segs[i].pos.y = boss.origin.y + Math.sin(k * 1.1) * 2.4;
      segs[i].pos.z = boss.origin.z + 10 + Math.cos(k * 0.5) * 3 + (i + 1) * 5.4;
    }
    copyV(boss.pos, head.pos);
  } else if (boss.kind === "head") {
    const lookX = player.pos.x - boss.origin.x;
    const lookZ = player.pos.z - boss.origin.z;
    const wantYaw = Math.atan2(lookX, lookZ);
    let dy = wantYaw - boss.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    boss.yaw += dy * Math.min(1, dt * 2.2);
    const bob = Math.sin(boss.t * 0.9) * 3.2;
    const sway = Math.sin(boss.t * 0.45) * 6;
    const core = boss.parts.find((p) => p.core);
    setV(core.pos, boss.origin.x + sway, boss.origin.y + 12 + bob, boss.origin.z);
    core.yaw = boss.yaw;
    copyV(boss.pos, core.pos);
  } else if (boss.kind === "fortress") {
    boss.yaw += dt * 0.55;
    const core = boss.parts.find((p) => p.core);
    copyV(core.pos, boss.origin);
    core.yaw = boss.yaw;
    const gens = boss.parts.filter((p) => !p.core);
    const n = gens.length || 3;
    for (let i = 0; i < gens.length; i++) {
      const a = boss.yaw + (i / n) * Math.PI * 2;
      gens[i].pos.x = boss.origin.x + Math.cos(a) * 28;
      gens[i].pos.y = boss.origin.y + Math.sin(boss.t * 1.3 + i) * 4;
      gens[i].pos.z = boss.origin.z + Math.sin(a) * 28;
    }
    copyV(boss.pos, core.pos);
  }

  boss.shootT -= dt;
  if (boss.shootT <= 0) {
    const src = boss.kind === "serpent" || boss.kind === "head"
      ? boss.parts.find((p) => p.core)
      : boss.parts.filter((p) => p.alive)[0] || boss.parts[0];
    const dir = v3();
    subV(dir, player.pos, src.pos);
    norm(dir, dir);
    spawnEnemyBolt(shots, src.pos, dir, C.DMG_BOSS_SHOT, 62, [1, 0.2, 0.55]);
    if (boss.kind === "head") {
      const fy = Math.sin(boss.yaw), fz = Math.cos(boss.yaw);
      const rx = Math.cos(boss.yaw), rz = -Math.sin(boss.yaw);
      for (const side of [-1, 1]) {
        const eye = v3(
          src.pos.x + rx * side * 6.5 + fy * 11,
          src.pos.y + 8,
          src.pos.z + rz * side * 6.5 + fz * 11,
        );
        subV(dir, player.pos, eye);
        norm(dir, dir);
        spawnEnemyBolt(shots, eye, dir, C.DMG_BOSS_SHOT, 70, [1, 0.15, 0.2]);
      }
    }
    if (boss.kind === "fortress") {
      for (const g of boss.parts.filter((p) => p.id.startsWith("gen") && p.alive)) {
        subV(dir, player.pos, g.pos);
        norm(dir, dir);
        spawnEnemyBolt(shots, g.pos, dir, C.DMG_BOSS_SHOT, 55, [0.6, 0.9, 1]);
      }
    }
    boss.shootT = boss.kind === "head" ? 0.85 : boss.kind === "fortress" ? 1.35 : 1.1;
  }
}

export function livingBossTargets(boss) {
  return boss.parts.filter((p) => {
    if (!p.alive) return false;
    if (p.invuln) return false;
    if (p.core && !coreExposed(boss)) return false;
    return true;
  });
}

/** Live combat uses one health pool: overlapping parts count as a single hit. */
export function hitBoss(boss, pos, radius, damage) {
  if (!boss || bossDead(boss)) return false;
  if (!bossHitboxes(boss).some(part => sphereHit(pos, radius, part.pos, part.radius))) return false;
  damageBoss(boss, damage);
  return true;
}
