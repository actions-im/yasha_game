export function v3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function setV(out, x, y, z) {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copyV(out, a) {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
}

export function addV(out, a, b) {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  return out;
}

export function subV(out, a, b) {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
  return out;
}

export function scaleV(out, a, s) {
  out.x = a.x * s;
  out.y = a.y * s;
  out.z = a.z * s;
  return out;
}

export function maddV(out, a, b, s) {
  out.x = a.x + b.x * s;
  out.y = a.y + b.y * s;
  out.z = a.z + b.z * s;
  return out;
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(out, a, b) {
  const x = a.y * b.z - a.z * b.y;
  const y = a.z * b.x - a.x * b.z;
  const z = a.x * b.y - a.y * b.x;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function len(a) {
  return Math.hypot(a.x, a.y, a.z);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function norm(out, a) {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  out.x = a.x / l;
  out.y = a.y / l;
  out.z = a.z / l;
  return out;
}

export function lerpV(out, a, b, t) {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

export function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

const _tmp = v3();
const _tmp2 = v3();
const _tmp3 = v3();
const WORLD_UP = v3(0, 1, 0);

/** Orthonormal frame from a forward vector (local +Z). */
export function frameFromForward(forward, outRight, outUp, outFwd) {
  copyV(outFwd, forward);
  norm(outFwd, outFwd);
  if (Math.abs(dot(outFwd, WORLD_UP)) > 0.98) {
    setV(_tmp, 1, 0, 0);
  } else {
    copyV(_tmp, WORLD_UP);
  }
  cross(outRight, _tmp, outFwd);
  norm(outRight, outRight);
  cross(outUp, outFwd, outRight);
  norm(outUp, outUp);
  return outFwd;
}

export function forwardFromYawPitch(out, yaw, pitch) {
  const cp = Math.cos(pitch);
  out.x = Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = Math.cos(yaw) * cp;
  return out;
}

export const mat4 = {
  create() {
    return new Float32Array(16);
  },
  identity(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },
  copy(out, a) {
    out.set(a);
    return out;
  },
  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const r = out === a || out === b ? new Float32Array(16) : out;
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      r[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      r[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      r[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      r[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    if (r !== out) out.set(r);
    return out;
  },
  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  },
  lookAt(out, eye, center, up) {
    const zx = eye.x - center.x;
    const zy = eye.y - center.y;
    const zz = eye.z - center.z;
    let zl = Math.hypot(zx, zy, zz) || 1;
    const z0 = zx / zl, z1 = zy / zl, z2 = zz / zl;
    let x0 = up.y * z2 - up.z * z1;
    let x1 = up.z * z0 - up.x * z2;
    let x2 = up.x * z1 - up.y * z0;
    let xl = Math.hypot(x0, x1, x2) || 1;
    x0 /= xl; x1 /= xl; x2 /= xl;
    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;
    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye.x + x1 * eye.y + x2 * eye.z);
    out[13] = -(y0 * eye.x + y1 * eye.y + y2 * eye.z);
    out[14] = -(z0 * eye.x + z1 * eye.y + z2 * eye.z);
    out[15] = 1;
    return out;
  },
  fromFrame(out, right, up, fwd, pos, bank = 0) {
    let rx = right.x, ry = right.y, rz = right.z;
    let ux = up.x, uy = up.y, uz = up.z;
    if (bank) {
      const c = Math.cos(bank), s = Math.sin(bank);
      const nrx = rx * c + ux * s;
      const nry = ry * c + uy * s;
      const nrz = rz * c + uz * s;
      const nux = ux * c - rx * s;
      const nuy = uy * c - ry * s;
      const nuz = uz * c - rz * s;
      rx = nrx; ry = nry; rz = nrz;
      ux = nux; uy = nuy; uz = nuz;
    }
    out[0] = rx; out[1] = ry; out[2] = rz; out[3] = 0;
    out[4] = ux; out[5] = uy; out[6] = uz; out[7] = 0;
    out[8] = fwd.x; out[9] = fwd.y; out[10] = fwd.z; out[11] = 0;
    out[12] = pos.x; out[13] = pos.y; out[14] = pos.z; out[15] = 1;
    return out;
  },
  translation(out, x, y, z) {
    this.identity(out);
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  },
  scaling(out, x, y, z) {
    this.identity(out);
    out[0] = x; out[5] = y; out[10] = z;
    return out;
  },
  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
};

export function transformH(out, m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const iw = w !== 0 ? 1 / w : 1;
  out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw;
  out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw;
  out.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw;
  return out;
}

const _near = v3();
const _far = v3();
const _dir = v3();

/** World point where the mouse ray hits a plane in front of the ship. */
export function mouseAimPoint(out, ndcX, ndcY, invVP, planePt, planeN) {
  transformH(_near, invVP, ndcX, ndcY, -1);
  transformH(_far, invVP, ndcX, ndcY, 1);
  _dir.x = _far.x - _near.x;
  _dir.y = _far.y - _near.y;
  _dir.z = _far.z - _near.z;
  norm(_dir, _dir);
  const denom = dot(_dir, planeN);
  if (Math.abs(denom) < 1e-4) return null;
  const t = (
    (planePt.x - _near.x) * planeN.x +
    (planePt.y - _near.y) * planeN.y +
    (planePt.z - _near.z) * planeN.z
  ) / denom;
  if (t < 2) return null;
  out.x = _near.x + _dir.x * t;
  out.y = _near.y + _dir.y * t;
  out.z = _near.z + _dir.z * t;
  return out;
}

export function transformDir(out, m, v) {
  out.x = m[0] * v.x + m[4] * v.y + m[8] * v.z;
  out.y = m[1] * v.x + m[5] * v.y + m[9] * v.z;
  out.z = m[2] * v.x + m[6] * v.y + m[10] * v.z;
  return out;
}

export { _tmp, _tmp2, _tmp3, WORLD_UP };
