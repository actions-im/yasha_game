import { C } from "./constants.js";
import { buildPath } from "./rails.js";
import { v3, maddV, copyV } from "./math.js";
import { makeEnemy } from "./enemies.js";
import { createWalker, createSerpent, createFortress, createHead } from "./bosses.js";
import { makeObb } from "./collision.js";

export const STAGE_META = {
  planet: {
    title: "VERDANT APPROACH",
    blurb: "Hills, ruins, open sky",
    fog: [0.42, 0.68, 0.92],
    fogNear: 50,
    fogFar: 240,
    scrape: false,
    ground: "groundPlanet",
    corridorY: C.CORRIDOR.planet.y,
  },
  canyon: {
    title: "SAND TRENCH",
    blurb: "Tight walls, missiles",
    fog: [0.78, 0.52, 0.28],
    fogNear: 28,
    fogFar: 140,
    scrape: false,
    ground: "groundCanyon",
    corridorY: C.CORRIDOR.canyon.y,
  },
  space: {
    title: "NEON TRENCH",
    blurb: "Capital ship, void",
    fog: [0.05, 0.06, 0.14],
    fogNear: 40,
    fogFar: 200,
    scrape: false,
    ground: "groundSpace",
    corridorY: C.CORRIDOR.space.y,
  },
  storm: {
    title: "STORM SPIRE",
    blurb: "Final corridor. Mixed squads. Giant head.",
    fog: [0.18, 0.08, 0.28],
    fogNear: 36,
    fogFar: 180,
    scrape: false,
    ground: "groundSpace",
    corridorY: C.CORRIDOR.storm.y,
  },
};

export function createStage(id) {
  const meta = STAGE_META[id];
  const path = buildPath(id, C.CRUISE_SPEED, C.RAIL_DURATION);
  const scenery = [];
  const colliders = [];
  const solids = [];
  const pickups = [];

  const addScenery = (mesh, pos, yaw, scale, pathDist, forward, right, up) => {
    scenery.push({
      mesh,
      pos,
      yaw,
      scale,
      pathDist,
      forward: v3(forward.x, forward.y, forward.z),
      right: v3(right.x, right.y, right.z),
      up: v3(up.x, up.y, up.z),
    });
  };

  const step = 40;
  for (let s = 0; s < path.length; s += step) {
    const f = path.sample(s);
    const yaw = Math.atan2(f.forward.x, f.forward.z);
    const gpos = v3();
    const floorDrop = meta.corridorY + 0.8;
    maddV(gpos, f.pos, f.up, -floorDrop);
    addScenery(meta.ground, gpos, yaw, 1.15, s, f.forward, f.right, f.up);
    const ghx = id === "planet" ? 48 : 20;
    solids.push(makeObb(gpos, f.right, f.up, f.forward, ghx, 1.4, 22, {
      pathDist: s, floor: true,
    }));

    if (id === "planet") {
      if (Math.floor(s / step) % 3 === 0) {
        for (const side of [-1, 1]) {
          const mountain = v3();
          maddV(mountain, gpos, f.right, side * 195);
          addScenery("mountain", mountain, yaw, 1, s, f.forward, f.right, f.up);
        }
      }
      if (s > 90 && Math.floor(s / step) % 5 === 0) {
        const a = v3();
        maddV(a, f.pos, f.up, 2);
        addScenery("arch", a, yaw, 1, s, f.forward, f.right, f.up);
        const postL = v3(), postR = v3(), lintel = v3();
        maddV(postL, a, f.right, -6);
        maddV(postL, postL, f.up, 4);
        maddV(postR, a, f.right, 6);
        maddV(postR, postR, f.up, 4);
        maddV(lintel, a, f.up, 11.5);
        solids.push(makeObb(postL, f.right, f.up, f.forward, 0.7, 8, 0.7, { pathDist: s }));
        solids.push(makeObb(postR, f.right, f.up, f.forward, 0.7, 8, 0.7, { pathDist: s }));
        solids.push(makeObb(lintel, f.right, f.up, f.forward, 7, 0.7, 0.7, { pathDist: s }));
      }
      if (Math.floor(s / step) % 3 === 1) {
        const r = v3();
        maddV(r, gpos, f.right, ((Math.floor(s) % 7) - 3) * 6);
        maddV(r, r, f.up, 2);
        addScenery("rock", r, yaw, 1.4, s, f.forward, f.right, f.up);
        const rc = v3();
        maddV(rc, r, f.up, 1.4);
        solids.push(makeObb(rc, f.right, f.up, f.forward, 1.8, 1.8, 1.6, { pathDist: s }));
      }
    } else if (id === "storm") {
      const left = v3(), right = v3();
      maddV(left, f.pos, f.right, -14);
      maddV(right, f.pos, f.right, 14);
      addScenery("trench", left, yaw + Math.PI, 1, s, f.forward, f.right, f.up);
      addScenery("wall", right, yaw, 1, s, f.forward, f.right, f.up);
      solids.push(makeObb(left, f.right, f.up, f.forward, 1.2, 8, 14, { pathDist: s }));
      const rcw = v3();
      maddV(rcw, right, f.up, 8);
      solids.push(makeObb(rcw, f.right, f.up, f.forward, 2.2, 14, 16, { pathDist: s }));
      if (Math.floor(s / step) % 5 === 2) {
        const beam = v3();
        copyV(beam, f.pos);
        addScenery("grid", beam, yaw, 1, s, f.forward, f.right, f.up);
        solids.push(makeObb(beam, f.right, f.up, f.forward, 0.4, 6, 0.4, {
          pathDist: s, damage: C.DMG_SCRAPE,
        }));
      }
    } else if (id === "canyon") {
      const left = v3(), right = v3();
      maddV(left, f.pos, f.right, -12);
      maddV(right, f.pos, f.right, 12);
      addScenery("wall", left, yaw + Math.PI, 1, s, f.forward, f.right, f.up);
      addScenery("wall", right, yaw, 1, s, f.forward, f.right, f.up);
      const lc = v3(), rcw = v3();
      maddV(lc, left, f.up, 8);
      maddV(rcw, right, f.up, 8);
      solids.push(makeObb(lc, f.right, f.up, f.forward, 2.2, 14, 16, { pathDist: s }));
      solids.push(makeObb(rcw, f.right, f.up, f.forward, 2.2, 14, 16, { pathDist: s }));
    } else {
      const left = v3(), right = v3();
      maddV(left, f.pos, f.right, -16);
      maddV(right, f.pos, f.right, 16);
      addScenery("trench", left, yaw + Math.PI, 1, s, f.forward, f.right, f.up);
      addScenery("trench", right, yaw, 1, s, f.forward, f.right, f.up);
      solids.push(makeObb(left, f.right, f.up, f.forward, 1.2, 8, 14, { pathDist: s }));
      solids.push(makeObb(right, f.right, f.up, f.forward, 1.2, 8, 14, { pathDist: s }));
      if (Math.floor(s / step) % 6 === 2) {
        const beam = v3();
        copyV(beam, f.pos);
        addScenery("grid", beam, yaw, 1, s, f.forward, f.right, f.up);
        solids.push(makeObb(beam, f.right, f.up, f.forward, 0.4, 6, 0.4, {
          pathDist: s, damage: C.DMG_SCRAPE,
        }));
      }
    }
  }

  return {
    id,
    meta,
    path,
    scenery,
    colliders,
    solids,
    pickups,
    lastWave: -1,
    corridor: C.CORRIDOR[id],
  };
}

function atPath(path, dist, ox, oy) {
  const d = Math.max(0, Math.min(dist, path.length - 5));
  const f = path.sample(d);
  const p = v3();
  maddV(p, f.pos, f.right, ox);
  maddV(p, p, f.up, oy);
  return { pos: p, frame: f };
}

export function tickSpawns(stage, railTime, player, enemies, pickups) {
  if (railTime < 1.0 || railTime > C.RAIL_DURATION - 8) return;
  const wave = Math.floor((railTime - 1.0) / 4);
  if (wave === stage.lastWave) return;
  stage.lastWave = wave;
  const ahead = player.pathDist + 55;
  const id = stage.id;
  const path = stage.path;

  const mk = (kind, ox, oy, extra) => {
    const { pos, frame } = atPath(path, ahead, ox, oy);
    const e = makeEnemy(kind, pos, extra);
    e.pathDist = ahead;
    const hold = kind === "turret" || kind === "nest";
    const along = hold ? 0 : C.CRUISE_SPEED * 0.4;
    e.vel.x = frame.forward.x * along;
    e.vel.y = frame.forward.y * along;
    e.vel.z = frame.forward.z * along;
    enemies.push(e);
  };

  const ring = (ox, oy) => {
    const { pos } = atPath(path, ahead - 10, ox, oy);
    pickups.push({ kind: "ring", pos, radius: 3.2, alive: true });
  };
  const crate = () => {
    const { pos } = atPath(path, ahead - 6, 0, 1);
    pickups.push({ kind: "bomb", pos, radius: 1.4, alive: true });
  };

  if (wave % 2 === 0) ring((wave % 5) - 2, 1 + (wave % 3));
  if (wave % 4 === 1) ring(2 - (wave % 3), 2);
  if (wave === 18 || wave === 42 || wave === 58) crate();

  if (id === "planet") {
    const pat = wave % 5;
    if (pat === 0) {
      mk("fighter", -6, 2); mk("fighter", 0, 4); mk("fighter", 6, 2); mk("fighter", -3, 0); mk("fighter", 3, 0);
    } else if (pat === 1) {
      mk("turret", -8, -6); mk("turret", 8, -6);
    } else if (pat === 2) {
      mk("fighter", -10, 3); mk("fighter", 10, 3); mk("fighter", 0, 6);
    } else if (pat === 3) {
      mk("turret", 0, -7); mk("fighter", -5, 2); mk("fighter", 5, 2);
    } else {
      mk("fighter", -8, 1); mk("fighter", -4, 5); mk("fighter", 0, 1); mk("fighter", 4, 5); mk("fighter", 8, 1);
    }
  } else if (id === "storm") {
    const pat = wave % 5;
    if (pat === 0) {
      mk("fighter", -6, 2); mk("drone", 6, 3); mk("interceptor", 0, 4);
    } else if (pat === 1) {
      mk("gunboat", 0, 1); mk("fighter", -8, 3);
    } else if (pat === 2) {
      mk("turret", -7, -5); mk("nest", 7, 2); mk("drone", 0, 5);
    } else if (pat === 3) {
      mk("interceptor", -4, 2); mk("interceptor", 4, -1); mk("fighter", 0, 6);
    } else {
      mk("drone", -8, 2); mk("drone", 8, 2); mk("gunboat", 3, 0);
    }
  } else if (id === "canyon") {
    const pat = wave % 4;
    if (pat === 0) {
      mk("interceptor", -4, 2, { strafe: 10, vz: -8 });
      mk("interceptor", 4, -1, { strafe: 12, strafeSign: -1, vz: -8 });
    } else if (pat === 1) {
      mk("nest", -7, 3); mk("nest", 7, -2);
    } else if (pat === 2) {
      mk("interceptor", 0, 4, { strafe: 16 }); mk("nest", 6, 2);
    } else {
      mk("interceptor", -3, 0); mk("interceptor", 3, 3); mk("interceptor", 0, -2);
    }
  } else {
    const pat = wave % 4;
    if (pat === 0) {
      mk("drone", -5, 3); mk("drone", 5, 3); mk("drone", 0, 6); mk("drone", -8, 0);
    } else if (pat === 1) {
      mk("gunboat", 0, 1);
    } else if (pat === 2) {
      mk("drone", -6, 2); mk("drone", 6, 2); mk("gunboat", 4, -1);
    } else {
      mk("drone", -10, 4); mk("drone", -5, 0); mk("drone", 5, 0); mk("drone", 10, 4);
    }
  }
}

export function addArenaBounds(stage, origin) {
  stage.solids = (stage.solids || []).filter((s) => !s.arena);
  stage.scenery = (stage.scenery || []).filter((s) => !s.arena);
  const right = v3(1, 0, 0);
  const up = v3(0, 1, 0);
  const fwd = v3(0, 0, 1);
  const half = 118;
  const floorY = origin.y - 14;
  const floorPos = v3(origin.x, floorY, origin.z);
  stage.solids.push(makeObb(floorPos, right, up, fwd, half + 8, 3, half + 8, {
    floor: true, arena: true,
  }));
  const wallMesh = stage.id === "space" || stage.id === "storm" ? "trench" : "wall";
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const pos = v3(origin.x + i * 36, floorY, origin.z + j * 36);
      stage.scenery.push({
        mesh: stage.meta.ground,
        pos,
        scale: 1.2,
        pathDist: null,
        arena: true,
        forward: fwd,
        right,
        up,
      });
    }
  }
  const wallY = origin.y + 12;
  const sides = [
    { x: origin.x + half, z: origin.z, hx: 3, hz: half + 3, yaw: 0 },
    { x: origin.x - half, z: origin.z, hx: 3, hz: half + 3, yaw: Math.PI },
    { x: origin.x, z: origin.z + half, hx: half + 3, hz: 3, yaw: Math.PI / 2 },
    { x: origin.x, z: origin.z - half, hx: half + 3, hz: 3, yaw: -Math.PI / 2 },
  ];
  for (const side of sides) {
    const wpos = v3(side.x, wallY, side.z);
    stage.solids.push(makeObb(wpos, right, up, fwd, side.hx, 28, side.hz, { arena: true }));
    const along = side.hx > side.hz ? side.hx : side.hz;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1) - 0.5) * along * 1.6;
      const pos = side.hx > side.hz
        ? v3(origin.x + t, wallY - 4, side.z)
        : v3(side.x, wallY - 4, origin.z + t);
      stage.scenery.push({
        mesh: wallMesh,
        pos,
        scale: 1.2,
        pathDist: null,
        arena: true,
        yaw: side.yaw,
        forward: fwd,
        right,
        up,
      });
    }
  }
}

export function makeBossFor(stage, player) {
  const end = stage.path.sample(Math.min(player.pathDist + 40, stage.path.length - 2));
  if (stage.id === "planet") {
    return createWalker(v3(end.pos.x, end.pos.y + 10, end.pos.z + 22));
  }
  if (stage.id === "canyon") {
    return createSerpent(v3(end.pos.x, end.pos.y + 3, end.pos.z + 18));
  }
  if (stage.id === "storm") {
    return createHead(v3(end.pos.x, end.pos.y + 8, end.pos.z + 24));
  }
  return createFortress(v3(end.pos.x, end.pos.y + 6, end.pos.z + 26));
}
