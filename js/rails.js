import { v3, setV, copyV, subV, lerpV, norm, cross, clamp, len } from "./math.js";

export class RailPath {
  constructor(points) {
    this.points = points;
    this.cum = new Float64Array(points.length);
    let acc = 0;
    this.cum[0] = 0;
    for (let i = 1; i < points.length; i++) {
      acc += len(subV(v3(), points[i], points[i - 1]));
      this.cum[i] = acc;
    }
    this.length = acc;
  }

  sample(s) {
    const pts = this.points;
    const cum = this.cum;
    s = clamp(s, 0, this.length - 0.0001);
    let lo = 0, hi = pts.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / span;
    const pos = v3();
    lerpV(pos, pts[lo], pts[hi], t);
    const forward = v3();
    subV(forward, pts[hi], pts[lo]);
    if (len(forward) < 1e-5 && hi + 1 < pts.length) subV(forward, pts[hi + 1], pts[lo]);
    norm(forward, forward);
    const right = v3();
    const up = v3();
    const worldUp = v3(0, 1, 0);
    if (Math.abs(forward.y) > 0.97) setV(worldUp, 1, 0, 0);
    cross(right, worldUp, forward);
    norm(right, right);
    cross(up, forward, right);
    norm(up, up);
    return { pos, forward, right, up, t, i: lo };
  }
}

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Build a long winding path whose length is about speed * duration. */
export function buildPath(kind, speed, duration) {
  const target = speed * duration + 80;
  const step = 28;
  const n = Math.ceil(target / step) + 4;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const d = i * step;
    let x = 0, y = 18, z = d;
    if (kind === "planet") {
      x = Math.sin(u * Math.PI * 7.2) * 90 + Math.sin(u * 31) * 12;
      y = 22 + Math.sin(u * Math.PI * 4.4) * 16 + Math.cos(u * 18) * 4;
      z = d;
    } else if (kind === "canyon") {
      x = Math.sin(u * Math.PI * 11) * 40 + Math.sin(u * 40) * 8;
      y = 14 + Math.sin(u * Math.PI * 6) * 6;
      z = d;
    } else if (kind === "storm") {
      x = Math.sin(u * Math.PI * 9) * 70 + Math.cos(u * 22) * 16;
      y = 18 + Math.sin(u * Math.PI * 5.5) * 12;
      z = d;
    } else {
      x = Math.sin(u * Math.PI * 5) * 50 + Math.cos(u * 14) * 10;
      y = 20 + Math.sin(u * Math.PI * 3.2) * 10;
      z = d;
    }
    x += (hash(i) - 0.5) * 4;
    pts.push(v3(x, y, z));
  }
  return new RailPath(pts);
}

export function noise2(i, j) {
  return hash(i * 13.1 + j * 7.7);
}
