import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESH_FNS } from '../js/mesh.js';

test('all rendered meshes have finite vertices, unit normals and valid triangle indices', () => {
  for (const [name, build] of Object.entries(MESH_FNS)) {
    const { vertices, indices } = build();
    assert.equal(vertices.length % 9, 0, name);
    assert.equal(indices.length % 3, 0, name);
    assert.ok(vertices.every(Number.isFinite), name);
    for (let i = 0; i < vertices.length; i += 9) {
      assert.ok(Math.abs(Math.hypot(...vertices.slice(i+3,i+6))-1)<0.001, `${name}: normal`);
    }
    assert.ok(indices.every(i => i < vertices.length/9), name);
  }
});
