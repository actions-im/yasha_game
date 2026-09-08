import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Run the real game orchestration with only browser elements and GPU drawing stubbed.
test('game flow: focus loss, checkpoint reset, route retry and bomb collision', async () => {
  class Element extends EventTarget {
    constructor() {
      super(); this.style = {}; this.children = []; this.textContent = '';
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, on) => on ? classes.add(n) : classes.delete(n), contains: n => classes.has(n) };
    }
    focus() { document.activeElement = this; }
    blur() { document.activeElement = null; }
    querySelector() { return new Element(); }
    querySelectorAll() { return this.children; }
    appendChild(el) { this.children.push(el); }
    getContext() { return {}; }
  }
  const elements = new Map();
  const globals = { window: new EventTarget(), document: new EventTarget(),
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    location: { search: '' }, requestAnimationFrame() {} };
  Object.assign(globals.document, { body: new Element(), hidden: false,
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    querySelector: () => new Element(), createElement: () => new Element() });
  const saved = new Map(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  let game;
  try {
    let source = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
    source = source.replace(/import \{ Renderer \} from "[^\"]+";/, `
      class Renderer {
        eye = []; fogFar = 200;
        upload() {} setClear() {} setFog() {} begin() {} draw() {}
      }`);
    source = source.replace(/from "(\.\/[^\"]+)"/g, (_, path) =>
      `from "${new URL('../js/' + path.slice(2), import.meta.url).href}"`);
    source += '\nexport { state, startStage, enterArena, lose, goMap, collideShots, applyBlasts };';
    game = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const { state } = game;
    game.startStage('canyon');
    window.dispatchEvent(new Event('blur'));
    assert.equal(state.mode, 'pause');
    document.getElementById('btn-resume').dispatchEvent(new Event('click'));
    assert.equal(state.mode, 'play');
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(state.mode, 'pause');
    document.hidden = false;
    document.getElementById('btn-resume').dispatchEvent(new Event('click'));
    state.score = 500; state.player.pathDist = 100; state.railTime = 30;
    game.enterArena();
    const checkpointPos = structuredClone(state.player.pos);
    const maxBossHp = state.boss.hp;
    // Bombs must reach the explosion path, even when inside a boss hitbox.
    const bomb = { kind: 'bomb', fromPlayer: true, pos: {...state.boss.parts[0].pos}, radius: 1 };
    state.shots.push(bomb);
    game.collideShots(state.player);
    assert.equal(bomb.dead, undefined);
    assert.equal(state.boss.hp, maxBossHp);
    game.applyBlasts([{ pos: {...state.boss.parts[0].pos}, radius: 20 }]);
    assert.equal(state.boss.hp, maxBossHp - 35);
    state.player.hp = 0; state.player.bombs = 0; state.player.pos.x += 40;
    state.score = 900;
    game.lose();
    assert.equal(document.getElementById('btn-checkpoint').classList.contains('hidden'), false);
    document.getElementById('btn-checkpoint').dispatchEvent(new Event('click'));
    assert.equal(state.mode, 'play'); assert.equal(state.play, 'arena');
    assert.deepEqual(state.player.pos, checkpointPos);
    assert.equal(state.player.hp, 100); assert.equal(state.player.bombs, 3);
    assert.equal(state.score, 500); assert.equal(state.boss.hp, maxBossHp);
    assert.equal(state.shots.length, 0);
    game.lose();
    document.getElementById('btn-retry').dispatchEvent(new Event('click'));
    assert.equal(state.stage.id, 'canyon'); assert.equal(state.play, 'rails');
    assert.equal(state.score, 0); assert.equal(state.checkpoint, null);
    game.lose();
    assert.equal(document.getElementById('btn-checkpoint').classList.contains('hidden'), true);
  } finally {
    if (game) game.goMap();
    for (const [key, value] of saved) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
