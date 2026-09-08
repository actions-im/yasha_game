import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { C } from "../js/constants.js";
import { sphereHit, sphereAabb, makeAabb, makeObb, resolveSphereObb } from "../js/collision.js";
import { v3, mat4, mouseAimPoint } from "../js/math.js";
import {
  createPlayer, damagePlayer, healPlayer, tryBomb, addBomb, tickPlayerTimers,
  aimAtPoint,
} from "../js/ship.js";
import {
  createWalker, createSerpent, createFortress, createHead, hurtBossPart, bossDead,
  coreExposed, legsDown, gensDown, damageBoss, bossHp,
} from "../js/bosses.js";
import { BOUND_CODES, UNBOUND_WASD, mapSteer } from "../js/input.js";
import { buildPath } from "../js/rails.js";
import { createStage } from "../js/stages.js";

describe("controls", () => {
  it("does not bind WASD", () => {
    for (const code of UNBOUND_WASD) {
      assert.equal(BOUND_CODES.includes(code), false);
    }
  });
  it("binds arrows, click is separate, space bomb, both shifts, esc", () => {
    assert.ok(BOUND_CODES.includes("ArrowLeft"));
    assert.ok(BOUND_CODES.includes("ArrowUp"));
    assert.ok(BOUND_CODES.includes("Space"));
    assert.ok(BOUND_CODES.includes("ShiftLeft"));
    assert.ok(BOUND_CODES.includes("ShiftRight"));
    assert.ok(BOUND_CODES.includes("Escape"));
  });
  it("uses regular arrow directions", () => {
    const left = mapSteer(new Set(["ArrowLeft"]));
    assert.equal(left.left, true);
    assert.equal(left.right, false);
    const right = mapSteer(new Set(["ArrowRight"]));
    assert.equal(right.right, true);
    assert.equal(right.left, false);
    const upKey = mapSteer(new Set(["ArrowUp"]));
    assert.equal(upKey.up, true);
    assert.equal(upKey.down, false);
    const downKey = mapSteer(new Set(["ArrowDown"]));
    assert.equal(downKey.down, true);
    assert.equal(downKey.up, false);
  });
});

describe("player hull", () => {
  it("starts at 100 HP and 3 bombs", () => {
    const p = createPlayer();
    assert.equal(p.hp, 100);
    assert.equal(p.bombs, 3);
  });
  it("ignores hits during invuln", () => {
    const p = createPlayer();
    assert.equal(damagePlayer(p, 8), true);
    assert.equal(p.hp, 92);
    assert.equal(damagePlayer(p, 8), false);
    assert.equal(p.hp, 92);
    tickPlayerTimers(p, C.INVULN_SEC);
    assert.equal(damagePlayer(p, 8), true);
    assert.equal(p.hp, 84);
  });
  it("rings heal 20 and clamp at max", () => {
    const p = createPlayer();
    p.hp = 90;
    healPlayer(p, C.RING_HEAL);
    assert.equal(p.hp, 100);
  });
  it("bombs decrement then dry-fire", () => {
    const p = createPlayer();
    assert.equal(tryBomb(p), true);
    assert.equal(tryBomb(p), true);
    assert.equal(tryBomb(p), true);
    assert.equal(tryBomb(p), false);
    assert.equal(p.bombs, 0);
    assert.equal(addBomb(p), true);
    assert.equal(p.bombs, 1);
  });
  it("dies at 0 HP", () => {
    const p = createPlayer();
    damagePlayer(p, 100);
    assert.equal(p.alive, false);
    assert.equal(p.hp, 0);
  });
});

describe("collision", () => {
  it("spheres overlap on touch", () => {
    assert.equal(sphereHit(v3(0, 0, 0), 1, v3(1.5, 0, 0), 1), true);
    assert.equal(sphereHit(v3(0, 0, 0), 1, v3(3, 0, 0), 1), false);
  });
  it("sphere vs aabb", () => {
    const box = makeAabb(0, 0, 0, 1, 1, 1);
    assert.equal(sphereAabb(v3(0, 0, 0), 0.1, box), true);
    assert.equal(sphereAabb(v3(3, 0, 0), 0.1, box), false);
  });
  it("pushes a sphere out of a wall box", () => {
    const wall = makeObb(v3(5, 0, 0), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 1, 4, 4);
    const hit = resolveSphereObb(v3(4.2, 0, 0), 1, wall);
    assert.equal(hit.hit, true);
    assert.ok(hit.x < 4.2, "should push away from wall " + hit.x);
  });
});

describe("bosses", () => {
  it("walker core is invulnerable until all legs are down", () => {
    const b = createWalker(v3(0, 0, 0));
    const core = b.parts.find((p) => p.core);
    assert.equal(coreExposed(b), false);
    assert.equal(hurtBossPart(b, core, 50), 0);
    assert.equal(core.hp, C.WALKER_CORE_HP);
    for (const leg of b.parts.filter((p) => p.id.startsWith("leg"))) {
      hurtBossPart(b, leg, 999);
    }
    assert.equal(legsDown(b), true);
    assert.equal(coreExposed(b), true);
    hurtBossPart(b, core, C.WALKER_CORE_HP);
    assert.equal(bossDead(b), true);
  });
  it("serpent head only takes damage when the mouth is open", () => {
    const b = createSerpent(v3(0, 0, 0));
    const head = b.parts.find((p) => p.core);
    b.mouthOpen = false;
    assert.equal(hurtBossPart(b, head, 50), 0);
    b.mouthOpen = true;
    assert.equal(hurtBossPart(b, head, 50) >= 0, true);
    assert.equal(head.hp, C.SERPENT_HEAD_HP - 50);
  });
  it("each shot reduces the shared boss health bar", () => {
    const b = createWalker(v3(0, 0, 0));
    const start = bossHp(b).cur;
    damageBoss(b, 10);
    assert.equal(bossHp(b).cur, start - 10);
    damageBoss(b, 10);
    assert.equal(bossHp(b).cur, start - 20);
  });
  it("fortress core waits for generators", () => {
    const b = createFortress(v3(0, 0, 0));
    const core = b.parts.find((p) => p.core);
    assert.equal(gensDown(b), false);
    assert.equal(hurtBossPart(b, core, 50), 0);
    for (const g of b.parts.filter((p) => p.id.startsWith("gen"))) {
      hurtBossPart(b, g, 999);
    }
    assert.equal(coreExposed(b), true);
    hurtBossPart(b, core, C.FORT_CORE_HP);
    assert.equal(bossDead(b), true);
  });
  it("storm head is a large exposed face", () => {
    const b = createHead(v3(0, 0, 0));
    assert.equal(b.kind, "head");
    assert.equal(coreExposed(b), true);
    const core = b.parts.find((p) => p.core);
    assert.ok(core.radius >= 14);
    assert.equal(bossHp(b).max, C.HEAD_HP);
    hurtBossPart(b, core, C.HEAD_HP);
    assert.equal(bossDead(b), true);
  });
});

describe("rails", () => {
  it("rail duration is 2 minutes", () => {
    assert.equal(C.RAIL_DURATION, 120);
  });
  it("paths are long enough for the rail clock", () => {
    for (const id of ["planet", "canyon", "space"]) {
      const path = buildPath(id, C.CRUISE_SPEED, C.RAIL_DURATION);
      const seconds = path.length / C.CRUISE_SPEED;
      assert.ok(seconds >= C.RAIL_DURATION, `${id} path too short: ${seconds}`);
    }
  });
  it("builds three stages with scenery", () => {
    for (const id of ["planet", "canyon", "space"]) {
      const s = createStage(id);
      assert.ok(s.scenery.length > 50);
      assert.equal(s.corridor.x, C.CORRIDOR[id].x);
    }
  });
});

describe("mouse aim", () => {
  it("aimAtPoint points from a cannon to the target", () => {
    const d = aimAtPoint({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 });
    assert.ok(Math.abs(d.x) < 1e-6);
    assert.ok(Math.abs(d.y) < 1e-6);
    assert.ok(Math.abs(d.z - 1) < 1e-6);
  });
  it("center of the screen hits a plane in front of the camera", () => {
    const proj = mat4.create();
    const view = mat4.create();
    const vp = mat4.create();
    const inv = mat4.create();
    mat4.perspective(proj, Math.PI / 3, 1, 0.5, 200);
    mat4.lookAt(view, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { x: 0, y: 1, z: 0 });
    mat4.multiply(vp, proj, view);
    assert.ok(mat4.invert(inv, vp));
    const out = v3();
    const hit = mouseAimPoint(out, 0, 0, inv, { x: 0, y: 0, z: 40 }, { x: 0, y: 0, z: 1 });
    assert.ok(hit, "expected a hit");
    assert.ok(Math.abs(hit.x) < 0.6, "x " + hit.x);
    assert.ok(Math.abs(hit.y) < 0.6, "y " + hit.y);
    assert.ok(Math.abs(hit.z - 40) < 1.5, "z " + hit.z);
  });
});
