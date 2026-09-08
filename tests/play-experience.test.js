import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../js/input.js';
import { createWalker, bossHp, hitBoss } from '../js/bosses.js';
import { bossIndicator } from '../js/guidance.js';

test('blur clears held and queued actions, while menu buttons retain Enter', () => {
  const events = new Map();
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener: (name, fn) => events.set(name, fn) };
  try {
    const input = createInput({ addEventListener() {} });
    events.get('keydown')({ code: 'Space', preventDefault() {} });
    events.get('keydown')({ code: 'ArrowLeft', preventDefault() {} });
    events.get('blur')();
    const snap = input.beginFrame();
    assert.equal(snap.bomb, false);
    assert.equal(snap.left, false);
    let prevented = false;
    events.get('keydown')({ code: 'Enter', target: { closest: () => ({}) }, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(input.beginFrame().confirm, false);
  } finally { globalThis.window = oldWindow; }
});

test('live boss collision damages shared health once even where hitboxes overlap', () => {
  const boss = createWalker({ x: 0, y: 0, z: 0 });
  const hp = bossHp(boss).cur;
  assert.equal(hitBoss(boss, boss.pos, 20, 35), true);
  assert.equal(bossHp(boss).cur, hp - 35);
  assert.equal(hitBoss(boss, { x: 1000, y: 0, z: 0 }, 1, 10), false);
  assert.equal(bossHp(boss).cur, hp - 35);
  hitBoss(boss, boss.pos, 20, 9999);
  assert.equal(hitBoss(boss, boss.pos, 20, 10), false);
});

test('boss guidance hides on-screen targets and points toward offscreen targets', () => {
  const matrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  assert.equal(bossIndicator({x:0,y:0,z:0}, matrix, 800, 600), null);
  const right = bossIndicator({x:5,y:0,z:0}, matrix, 800, 600);
  assert.ok(right.x > 400 && right.x < 800);
  assert.equal(right.y, 300);
  const behind = [...matrix]; behind[15] = -1;
  const turn = bossIndicator({x:0,y:0,z:0}, behind, 800, 600);
  assert.ok(Number.isFinite(turn.angle));
  assert.equal(turn.behind, true);
});
