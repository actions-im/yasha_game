/** Procedural low-poly meshes. Vertex: pos3 + nrm3 + col3 */

export class MeshBuilder {
  constructor() {
    this.v = [];
    this.i = [];
  }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, col) {
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const l = Math.hypot(nx, ny, nz) || 1;
    const n = [nx / l, ny / l, nz / l];
    const base = this.v.length / 9;
    this._vert(ax, ay, az, n, col);
    this._vert(bx, by, bz, n, col);
    this._vert(cx, cy, cz, n, col);
    this.i.push(base, base + 1, base + 2);
  }

  _vert(x, y, z, n, col) {
    this.v.push(x, y, z, n[0], n[1], n[2], col[0], col[1], col[2]);
  }

  box(cx, cy, cz, hx, hy, hz, col, rotY = 0) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const corners = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let x = sx * hx, z = sz * hz;
          const xr = x * c + z * s;
          const zr = -x * s + z * c;
          corners.push([cx + xr, cy + sy * hy, cz + zr]);
        }
      }
    }
    // index: sx sy sz as bit... easier explicit faces from local axes
    const p = (x, y, z) => {
      const xr = x * c + z * s;
      const zr = -x * s + z * c;
      return [cx + xr, cy + y, cz + zr];
    };
    const f = (a, b, c3, d) => {
      this.tri(...a, ...b, ...c3, col);
      this.tri(...a, ...c3, ...d, col);
    };
    f(p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz));
    f(p(hx, -hy, -hz), p(-hx, -hy, -hz), p(-hx, hy, -hz), p(hx, hy, -hz));
    f(p(-hx, -hy, -hz), p(-hx, -hy, hz), p(-hx, hy, hz), p(-hx, hy, -hz));
    f(p(hx, -hy, hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(hx, hy, hz));
    f(p(-hx, hy, hz), p(hx, hy, hz), p(hx, hy, -hz), p(-hx, hy, -hz));
    f(p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, -hy, hz), p(-hx, -hy, hz));
  }

  wedge(z0, z1, w0, w1, h, col, y = 0) {
    const a = [-w0, y, z0], b = [w0, y, z0], c = [w1, y, z1], d = [-w1, y, z1];
    const e = [-w0, y + h, z0], f = [w0, y + h, z0], g = [w1, y + h, z1], hh = [-w1, y + h, z1];
    this.tri(...a, ...b, ...c, col); this.tri(...a, ...c, ...d, col);
    this.tri(...e, ...g, ...f, col); this.tri(...e, ...hh, ...g, col);
    this.tri(...a, ...d, ...hh, col); this.tri(...a, ...hh, ...e, col);
    this.tri(...b, ...f, ...g, col); this.tri(...b, ...g, ...c, col);
    this.tri(...a, ...e, ...f, col); this.tri(...a, ...f, ...b, col);
    this.tri(...d, ...c, ...g, col); this.tri(...d, ...g, ...hh, col);
  }

  ellipsoid(cx, cy, cz, rx, ry, rz, col, segments = 24, rings = 12) {
    const base = this.v.length / 9;
    for (let j = 0; j <= rings; j++) {
      const phi = Math.PI * j / rings;
      for (let i = 0; i <= segments; i++) {
        const theta = Math.PI * 2 * i / segments;
        const x = Math.sin(phi)*Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi)*Math.sin(theta);
        const n = [x/rx,y/ry,z/rz];
        const len = Math.hypot(...n);
        this._vert(cx+x*rx,cy+y*ry,cz+z*rz,n.map(v=>v/len),col);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
      const a = base+j*(segments+1)+i, b = a+segments+1;
      this.i.push(a,a+1,b,b,a+1,b+1);
    }
  }

  // Extruded polygon for swept wings and tail surfaces.
  wing(points, y, thickness, col) {
    for (let i = 1; i < points.length-1; i++) {
      const a=points[0], b=points[i], c=points[i+1];
      this.tri(a[0],y+thickness,a[1],c[0],y+thickness,c[1],b[0],y+thickness,b[1],col);
      this.tri(a[0],y,a[1],b[0],y,b[1],c[0],y,c[1],col);
    }
    for (let i = 0; i < points.length; i++) {
      const a=points[i], b=points[(i+1)%points.length];
      this.tri(a[0],y,a[1],a[0],y+thickness,a[1],b[0],y+thickness,b[1],col);
      this.tri(a[0],y,a[1],b[0],y+thickness,b[1],b[0],y,b[1],col);
    }
  }

  finish() {
    return {
      vertices: new Float32Array(this.v),
      indices: new Uint32Array(this.i),
    };
  }
}

const HULL = [0.86, 0.9, 0.95];
const CYAN = [0.15, 0.72, 0.88];
const DARK = [0.12, 0.14, 0.18];
const GOLD = [0.95, 0.78, 0.2];
const RED = [0.85, 0.18, 0.16];
const GREEN = [0.35, 0.7, 0.28];
const SAND = [0.78, 0.52, 0.28];
const METAL = [0.45, 0.5, 0.58];
const NEON = [0.2, 0.95, 1.0];
const PURPLE = [0.55, 0.3, 0.85];

export function shipMesh() {
  const m = new MeshBuilder();
  const pearl = [0.78,0.85,0.94], graphite = [0.08,0.12,0.18];
  m.ellipsoid(0,0,0.1,0.48,0.32,1.85,pearl);
  m.wedge(1.2,2.6,0.34,0.015,0.22,pearl,-0.1);
  m.ellipsoid(0,0.29,0.35,0.3,0.27,0.8,[0.05,0.22,0.34]);
  m.box(0,0.48,-0.22,0.025,0.04,0.2,CYAN);
  for (const side of [-1,1]) {
    const points = [[0.32,0.85],[2.7,-0.65],[2.6,-1.12],[0.35,-0.65]];
    const wing = points.map(([x,z])=>[x*side,z]);
    if (side > 0) wing.reverse();
    m.wing(wing,-0.12,0.1,pearl);
    const stripe = [[0.8,0.43],[2.5,-0.58],[2.45,-0.78],[0.8,0.15]].map(([x,z])=>[x*side,z]);
    if (side > 0) stripe.reverse();
    m.wing(stripe,-0.012,0.015,CYAN);
    m.ellipsoid(side*0.61,-0.04,-0.72,0.28,0.27,0.88,graphite,20,10);
    m.ellipsoid(side*0.61,-0.04,-1.43,0.22,0.22,0.16,METAL,20,10);
    m.ellipsoid(side*0.61,-0.04,-1.57,0.15,0.15,0.04,[0.15,0.75,1],16,8);
    m.box(side*1.1,-0.18,0.65,0.075,0.07,0.6,graphite);
    m.box(side*1.1,-0.18,1.25,0.095,0.09,0.1,METAL);
    m.box(side*2.58,-0.03,-0.85,0.065,0.035,0.08,side<0?RED:CYAN);
    m.box(side*0.48,0.42,-1.02,0.045,0.4,0.28,CYAN,side*0.18);
  }
  return m.finish();
}

export function exhaustMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0,0,-0.45,0.12,0.12,0.65,[0.18,0.55,1],16,8);
  m.ellipsoid(0,0,-0.12,0.08,0.08,0.32,[0.65,0.95,1],16,8);
  return m.finish();
}

export function fighterMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0,0,0,0.29,0.2,0.85,RED,16,8);
  m.wedge(0.65,1.25,0.23,0.02,0.16,RED,-0.07);
  m.ellipsoid(0,0.17,0.18,0.16,0.13,0.36,[0.07,0.12,0.2],16,8);
  for (const side of [-1,1]) {
    const wing = [[0.2,0.4],[1.24,-0.25],[1.1,-0.49],[0.2,-0.38]].map(([x,z])=>[x*side,z]);
    if(side>0) wing.reverse();
    m.wing(wing,-0.06,0.07,[0.5,0.12,0.14]);
    m.ellipsoid(side*0.44,-0.03,-0.38,0.14,0.14,0.39,DARK,12,8);
    m.ellipsoid(side*0.44,-0.03,-0.75,0.1,0.1,0.035,GOLD,12,6);
    m.box(side*0.76,-0.02,0.14,0.045,0.045,0.27,METAL);
    m.box(side*0.17,0.23,-0.53,0.025,0.18,0.16,RED);
  }
  return m.finish();
}

export function interceptorMesh() {
  const m = new MeshBuilder();
  const amber = [0.92,0.46,0.12];
  m.ellipsoid(0,0,0,0.2,0.15,0.9,amber,16,8);
  m.ellipsoid(0,0.12,0.22,0.12,0.11,0.4,DARK,16,8);
  for(const side of [-1,1]) {
    const wing = [[0.12,0.25],[0.93,-0.35],[0.78,-0.53],[0.12,-0.4]].map(([x,z])=>[side*x,z]);
    if(side>0) wing.reverse();
    m.wing(wing,-0.05,0.05,METAL);
    m.ellipsoid(side*0.44,0,-0.35,0.11,0.12,0.36,amber,12,8);
    m.ellipsoid(side*0.44,0,-0.7,0.075,0.075,0.03,NEON,12,6);
    m.box(side*0.75,0.04,-0.32,0.025,0.11,0.2,DARK);
  }
  return m.finish();
}

export function turretMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0,-0.2,0,0.7,0.25,0.7,METAL,16,8);
  m.ellipsoid(0,0.35,0,0.43,0.4,0.43,[0.3,0.34,0.4],16,10);
  m.ellipsoid(0,0.7,0.17,0.13,0.13,0.13,RED,12,8);
  for(const side of [-1,1]) {
    m.ellipsoid(side*0.19,0.5,0.5,0.08,0.08,0.5,DARK,12,8);
    m.box(side*0.19,0.5,0.97,0.095,0.095,0.08,METAL);
    m.box(side*0.5,-0.18,0,0.12,0.12,0.4,DARK);
  }
  return m.finish();
}

export function nestMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0,-0.18,0,0.9,0.32,0.6,METAL,16,8);
  m.ellipsoid(0,0.15,0,0.76,0.38,0.48,SAND,16,8);
  for(const x of [-0.48,0,0.48]) for(const y of [0.15,0.42]) {
    m.ellipsoid(x,y,0.3,0.16,0.12,0.37,DARK,12,8);
    m.ellipsoid(x,y,0.65,0.1,0.08,0.04,RED,12,6);
  }
  m.box(0,0.57,-0.2,0.04,0.18,0.04,METAL);
  return m.finish();
}

export function droneMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0,0,0,0.45,0.2,0.45,METAL,16,10);
  m.ellipsoid(0,0.08,0,0.24,0.27,0.24,DARK,16,10);
  m.ellipsoid(0,0.05,0.3,0.14,0.12,0.12,NEON,12,8);
  for(const side of [-1,1]) {
    m.ellipsoid(side*0.34,0,-0.16,0.11,0.13,0.23,DARK,12,8);
    m.ellipsoid(side*0.34,0,-0.37,0.08,0.09,0.03,NEON,12,6);
    m.box(side*0.31,0.13,0.08,0.1,0.02,0.2,PURPLE);
  }
  return m.finish();
}

export function gunboatMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0,0,0,1.4,0.55,2.1,METAL,20,10);
  m.ellipsoid(0,0.56,-0.4,0.8,0.44,0.85,DARK,16,8);
  m.ellipsoid(0,0.65,0.12,0.58,0.18,0.25,PURPLE,16,8);
  for(const side of [-1,1]) {
    m.ellipsoid(side*1.1,-0.08,-1,0.28,0.3,0.95,DARK,16,8);
    m.ellipsoid(side*1.1,-0.08,-1.91,0.21,0.23,0.07,NEON,12,8);
    m.ellipsoid(side*1.12,0.07,0.75,0.17,0.17,0.8,DARK,12,8);
    for(const z of [-0.9,-0.4,0.1]) m.box(side*0.75,0.42,z,0.3,0.06,0.045,PURPLE);
    m.box(side*1.12,0.07,1.48,0.2,0.2,0.09,METAL);
  }
  return m.finish();
}

export function walkerMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0, 8, 0, 8, 3.2, 6, METAL, 24, 12);
  m.ellipsoid(0, 11.4, 3.2, 3.4, 1.6, 3, DARK, 20, 10);
  const legs = [[-7, -6], [7, -6], [-7, 6], [7, 6]];
  for (const [x, z] of legs) {
    m.box(x, 3.2, z, 0.9, 3.6, 0.9, [0.35, 0.38, 0.42]);
    m.ellipsoid(x, 0.5, z, 1.4, 0.6, 1.8, GOLD, 12, 8);
    m.ellipsoid(x, 5.8, z, 1.3, 1.3, 1.3, DARK, 16, 8);
    m.box(x + 0.55, 3.2, z, 0.14, 2.5, 0.2, HULL);
  }
  m.box(0, 8, 0, 2.2, 2.2, 2.2, RED);
  return m.finish();
}

export function serpentSegMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0, 0, 0, 1.6, 1.1, 2.2, [0.2, 0.62, 0.38], 16, 8);
  m.box(0, 0.75, 0, 0.4, 0.55, 1.4, [0.15, 0.4, 0.25]);
  return m.finish();
}

export function serpentHeadMesh() {
  const m = new MeshBuilder();
  m.wedge(0.3, 3.6, 1.8, 0.2, 1.6, [0.18, 0.7, 0.4], -0.5);
  m.ellipsoid(0, 0.7, 0, 1.6, 0.7, 0.9, GOLD, 16, 8);
  for (const side of [-1,1]) m.ellipsoid(side*1.2, 0.8, 1, 0.3, 0.3, 0.3, RED, 12, 8);
  return m.finish();
}

export function titanHeadMesh() {
  const m = new MeshBuilder();
  const skin = [0.72, 0.42, 0.38];
  const shadow = [0.38, 0.16, 0.18];
  const bone = [0.88, 0.78, 0.62];
  m.ellipsoid(0, 4, 0, 14, 16, 11, skin, 24, 16);
  m.ellipsoid(0, 18, 1, 10, 4, 8, skin, 20, 10);
  m.box(-6.5, 8, 10.4, 3.4, 2.6, 1.4, RED);
  m.box(6.5, 8, 10.4, 3.4, 2.6, 1.4, RED);
  m.box(-6.5, 8, 11.2, 1.5, 1.2, 0.6, GOLD);
  m.box(6.5, 8, 11.2, 1.5, 1.2, 0.6, GOLD);
  m.box(0, 12.5, 10.2, 12, 1.4, 1.2, shadow);
  m.box(0, 3.2, 11, 2.2, 3.4, 2.4, shadow);
  m.ellipsoid(0, -6, 4, 12, 6, 8, skin, 20, 10);
  m.box(0, -1.5, 10.5, 8, 2.4, 2.2, [0.08, 0.04, 0.05]);
  for (const x of [-6, -2, 2, 6]) {
    m.box(x, -3.4, 11.2, 0.9, 1.6, 0.7, bone);
    m.box(x, 0.2, 11.2, 0.8, 1.1, 0.6, bone);
  }
  m.box(-13.5, 6, 0, 2.2, 5, 3.5, skin);
  m.box(13.5, 6, 0, 2.2, 5, 3.5, skin);
  return m.finish();
}

export function fortressMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0, 0, 0, 9, 9, 9, [0.25, 0.28, 0.4], 24, 16);
  for (const side of [-1,1]) {
    m.ellipsoid(side*8, 0, 0, 2, 5, 5, METAL, 16, 10);
    for (const y of [-3,0,3]) m.box(side*8, y, 4.8, 0.9, 0.15, 0.15, NEON);
  }
  m.box(0, 0, 0, 4.4, 4.4, 13, PURPLE);
  m.box(0, 0, 0, 13, 4.4, 4.4, PURPLE);
  return m.finish();
}

export function generatorMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0, 0, 0, 2.4, 2.4, 2.4, NEON, 20, 12);
  m.box(0, 0, 0, 0.8, 3.6, 0.8, GOLD);
  return m.finish();
}

export function boltMesh() {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.12, 0.12, 0.85, [0.4, 1, 0.5]);
  return m.finish();
}

export function enemyBoltMesh() {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.16, 0.16, 0.7, [1, 0.3, 0.15]);
  return m.finish();
}

export function bombMesh() {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.55, 0.55, 0.55, [0.3, 0.85, 1]);
  m.box(0, 0, 0, 0.2, 0.9, 0.2, GOLD);
  return m.finish();
}

export function ringMesh() {
  const m = new MeshBuilder();
  const R = 3.2, r = 0.28, seg = 14;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const x0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R;
    const x1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R;
    m.box((x0 + x1) / 2, (y0 + y1) / 2, 0, r, r, r * 0.6, GOLD);
  }
  return m.finish();
}

export function crateMesh() {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.7, 0.7, 0.7, NEON);
  return m.finish();
}

export function cubeMesh(col = [1, 0.6, 0.2]) {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.5, 0.5, 0.5, col);
  return m.finish();
}

export function archMesh() {
  const m = new MeshBuilder();
  const stone = [0.55, 0.52, 0.45];
  m.box(-6, 4, 0, 0.7, 8, 0.7, stone);
  m.box(6, 4, 0, 0.7, 8, 0.7, stone);
  m.box(0, 11.5, 0, 7, 0.7, 0.7, stone);
  for(const side of [-1,1]) {
    for(let y=-3;y<12;y+=1.5) {
      m.box(side*6,y,0,0.72,0.035,0.72,[0.28,0.29,0.26]);
    }
    m.box(side*6,10.7,0,0.85,0.12,0.85,[0.65,0.63,0.54]);
    m.box(side*6,4,0.715,0.17,4,0.018,[0.26,0.35,0.2]);
  }
  for(const x of [-5,-3,-1,1,3,5]) m.box(x,11.5,0.715,0.035,0.68,0.018,[0.3,0.29,0.25]);
  return m.finish();
}

export function gridBeamMesh() {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.18, 6, 0.18, [1, 0.2, 0.45]);
  return m.finish();
}

export function groundPatch(kind, seed) {
  const m = new MeshBuilder();
  if (kind === "planet") {
    const xs = [-220,-180,-140,-100,-65,-40,-26,0,26,40,65,100,140,180,220];
    const height = (x,z) => {
      const edge = Math.max(0, Math.abs(x)-26);
      return 0.45 + (1-Math.exp(-edge/45))*
        (8+7*Math.sin(x*0.047)+4*Math.cos(z*Math.PI/22)*Math.sin(x*0.025));
    };
    for(let i=0;i<xs.length-1;i++) for(let z=-22;z<22;z+=5.5) {
      const x=xs[i], nx=xs[i+1], nz=z+5.5;
      const a=[x,height(x,z),z], b=[nx,height(nx,z),z];
      const c=[nx,height(nx,nz),nz], d=[x,height(x,nz),nz];
      const tone=(Math.sin(x*0.18)+Math.cos(z*0.24))*0.015;
      const col=[0.23+tone,0.4+tone,0.18+tone];
      m.tri(...a,...c,...b,col); m.tri(...a,...d,...c,col);
    }
  } else {
    m.box(0,0,0,18,0.45,22,kind === "canyon" ? [0.65,0.4,0.22] : [0.12,0.16,0.25]);
    if(kind === "space") {
      for(const x of [-12,-6,0,6,12]) {
        m.box(x,0.47,0,0.045,0.012,22,[0.05,0.07,0.1]);
      }
      for(const z of [-16,-8,0,8,16]) {
        m.box(0,0.47,z,18,0.012,0.045,[0.05,0.07,0.1]);
        for(const x of [-15,15]) m.box(x,0.49,z,0.16,0.02,1.5,NEON);
      }
    }
  }
  return m.finish();
}

export function canyonWallMesh() {
  const m = new MeshBuilder();
  // Layered rock stays within the existing wall's collision envelope.
  m.box(0,8,0,2,14,16,[0.61,0.36,0.2]);
  for(let y=-5;y<22;y+=3) {
    const tone = 0.035*Math.sin(y*1.7);
    const col=[0.72+tone,0.46+tone,0.26+tone];
    for(const side of [-1,1]) {
      m.ellipsoid(side*1.45,y,0,0.75,1.7,15.9,col,12,6);
    }
  }
  return m.finish();
}

export function trenchPanelMesh() {
  const m = new MeshBuilder();
  m.box(0,0,0,1.05,8,14,[0.16,0.2,0.29]);
  for(const side of [-1,1]) {
    for(const z of [-10,-3,4,11]) {
      m.box(side*1.12,0,z,0.075,7.7,0.22,METAL);
      m.box(side*1.14,3,z-1.5,0.055,1.5,1.05,[0.24,0.29,0.36]);
      m.box(side*1.14,-3,z-1.5,0.055,1.5,1.05,[0.1,0.12,0.18]);
      for(let y=-4;y<=4;y+=2) m.box(side*1.18,y,z-1.5,0.02,0.06,0.8,[0.03,0.05,0.08]);
    }
    for(const y of [-6,6]) m.box(side*1.18,y,0,0.02,0.09,13.8,NEON);
    m.box(side*1.18,0,0,0.02,0.04,13.8,[0.6,0.36,0.1]);
  }
  return m.finish();
}

export function skyMesh(col) {
  const m = new MeshBuilder();
  const R = 400;
  m.box(0, 0, 0, R, R, R, col);
  return m.finish();
}

export function rockMesh() {
  const m = new MeshBuilder();
  m.ellipsoid(0, 1.4, 0, 1.6, 1.6, 1.4, [0.48, 0.46, 0.4], 9, 6);
  m.ellipsoid(0.8, 0.5, 0.4, 0.9, 0.7, 0.8, [0.4, 0.38, 0.34], 8, 5);
  return m.finish();
}

export const MESH_FNS = {
  mountain: () => {
    const m = new MeshBuilder();
    m.ellipsoid(0,-18,0,55,42,65,[0.22,0.36,0.29],12,8);
    m.ellipsoid(30,-10,15,30,45,38,[0.3,0.4,0.34],10,7);
    return m.finish();
  },
  ship: shipMesh,
  exhaust: exhaustMesh,
  groundPlanet: () => groundPatch("planet", 1),
  groundCanyon: () => groundPatch("canyon", 2),
  groundSpace: () => groundPatch("space", 3),
  rock: rockMesh,
  fighter: fighterMesh,
  interceptor: interceptorMesh,
  turret: turretMesh,
  nest: nestMesh,
  drone: droneMesh,
  gunboat: gunboatMesh,
  walker: walkerMesh,
  serpentSeg: serpentSegMesh,
  serpentHead: serpentHeadMesh,
  titanHead: titanHeadMesh,
  fortress: fortressMesh,
  generator: generatorMesh,
  bolt: boltMesh,
  ebolt: enemyBoltMesh,
  bomb: bombMesh,
  ring: ringMesh,
  crate: crateMesh,
  spark: () => cubeMesh([1, 0.7, 0.3]),
  reticle: () => {
    const m = new MeshBuilder();
    const c = [0.35, 1, 0.85];
    m.box(0, 0, 0, 0.08, 1.15, 0.08, c);
    m.box(0, 0, 0, 1.15, 0.08, 0.08, c);
    return m.finish();
  },
  arch: archMesh,
  grid: gridBeamMesh,
  wall: canyonWallMesh,
  trench: trenchPanelMesh,
};
