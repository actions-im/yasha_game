import { dist2, clamp } from "./math.js";

export function sphereHit(a, ar, b, br) {
  const r = ar + br;
  return dist2(a, b) <= r * r;
}

export function resolveSphereSphere(pos, radius, center, cr) {
  const dx = pos.x - center.x;
  const dy = pos.y - center.y;
  const dz = pos.z - center.z;
  const min = radius + cr;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= min * min) return { hit: false };
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    return { hit: true, x: pos.x + min, y: pos.y, z: pos.z, nx: 1, ny: 0, nz: 0, pen: min };
  }
  const pen = min - d;
  const inv = 1 / d;
  const nx = dx * inv, ny = dy * inv, nz = dz * inv;
  return {
    hit: true,
    x: pos.x + nx * pen,
    y: pos.y + ny * pen,
    z: pos.z + nz * pen,
    nx, ny, nz, pen,
  };
}

export function sphereAabb(p, r, box) {
  const qx = clamp(p.x, box.minX, box.maxX);
  const qy = clamp(p.y, box.minY, box.maxY);
  const qz = clamp(p.z, box.minZ, box.maxZ);
  const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz;
  return dx * dx + dy * dy + dz * dz <= r * r;
}

export function makeAabb(cx, cy, cz, hx, hy, hz) {
  return {
    minX: cx - hx, maxX: cx + hx,
    minY: cy - hy, maxY: cy + hy,
    minZ: cz - hz, maxZ: cz + hz,
  };
}

export function makeObb(pos, right, up, forward, hx, hy, hz, extra = {}) {
  return {
    pos,
    right,
    up,
    forward,
    hx,
    hy,
    hz,
    block: extra.block !== false,
    damage: extra.damage || 0,
    pathDist: extra.pathDist,
    floor: !!extra.floor,
    arena: !!extra.arena,
  };
}

/** Push a sphere out of an oriented box. */
export function resolveSphereObb(pos, radius, obb) {
  const rx = obb.right, uy = obb.up, fz = obb.forward;
  const dx = pos.x - obb.pos.x;
  const dy = pos.y - obb.pos.y;
  const dz = pos.z - obb.pos.z;
  const lx = dx * rx.x + dy * rx.y + dz * rx.z;
  const ly = dx * uy.x + dy * uy.y + dz * uy.z;
  const lz = dx * fz.x + dy * fz.y + dz * fz.z;

  const inside =
    Math.abs(lx) <= obb.hx && Math.abs(ly) <= obb.hy && Math.abs(lz) <= obb.hz;

  if (inside) {
    const px = obb.hx - Math.abs(lx);
    const py = obb.hy - Math.abs(ly);
    const pz = obb.hz - Math.abs(lz);
    let nx, ny, nz, pen;
    if (px <= py && px <= pz) {
      const s = lx >= 0 ? 1 : -1;
      nx = rx.x * s; ny = rx.y * s; nz = rx.z * s;
      pen = px + radius;
    } else if (py <= pz) {
      const s = ly >= 0 ? 1 : -1;
      nx = uy.x * s; ny = uy.y * s; nz = uy.z * s;
      pen = py + radius;
    } else {
      const s = lz >= 0 ? 1 : -1;
      nx = fz.x * s; ny = fz.y * s; nz = fz.z * s;
      pen = pz + radius;
    }
    return {
      hit: true,
      x: pos.x + nx * pen,
      y: pos.y + ny * pen,
      z: pos.z + nz * pen,
      nx, ny, nz, pen,
    };
  }

  const qx = clamp(lx, -obb.hx, obb.hx);
  const qy = clamp(ly, -obb.hy, obb.hy);
  const qz = clamp(lz, -obb.hz, obb.hz);
  const cx = obb.pos.x + rx.x * qx + uy.x * qy + fz.x * qz;
  const cy = obb.pos.y + rx.y * qx + uy.y * qy + fz.y * qz;
  const cz = obb.pos.z + rx.z * qx + uy.z * qy + fz.z * qz;
  const vx = pos.x - cx, vy = pos.y - cy, vz = pos.z - cz;
  const d2 = vx * vx + vy * vy + vz * vz;
  if (d2 >= radius * radius) return { hit: false };
  const d = Math.sqrt(d2) || 1e-6;
  const pen = radius - d;
  const inv = 1 / d;
  const nx = vx * inv, ny = vy * inv, nz = vz * inv;
  return {
    hit: true,
    x: pos.x + nx * pen,
    y: pos.y + ny * pen,
    z: pos.z + nz * pen,
    nx, ny, nz, pen,
  };
}
