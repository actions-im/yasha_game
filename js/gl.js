// Per-pixel materials: soft sky fill, warm key light, specular reflections and atmospheric haze.
const VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
void main() {
  vWorld = (uModel * vec4(aPos, 1.0)).xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform vec3 uEye;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFlash;
uniform vec3 uMaterial;
out vec4 o;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uEye - vWorld);
  vec3 l = normalize(uLightDir);
  float ndl = max(dot(n,l),0.0);
  float hemi = n.y * 0.5 + 0.5;
  vec3 fill = mix(vec3(0.13,0.12,0.15), vec3(0.38,0.48,0.62),hemi);
  vec3 base = pow(max(vColor,vec3(0.0)),vec3(2.2));
  float grain = sin(vWorld.x*2.3 + sin(vWorld.z*1.7))*sin(vWorld.z*3.1+vWorld.y*1.2);
  float strata = sin(vWorld.y*2.5 + sin(vWorld.x*0.13)*2.0);
  base *= 1.0 + uMaterial.z * (grain*0.07 + strata*0.06);
  float rough = uMaterial.y;
  float spec = pow(max(dot(n,normalize(l+v)),0.0),mix(100.0,10.0,rough));
  float fresnel = pow(1.0-max(dot(n,v),0.0),4.0);
  vec3 specColor = mix(vec3(0.22),base, uMaterial.x);
  vec3 color = base*(fill + vec3(1.5,1.32,1.08)*ndl);
  color += specColor*spec*(1.0-rough)*3.0;
  color += vec3(0.28,0.52,0.78)*fresnel*(0.16+uMaterial.x*0.4);
  color += vec3(uFlash);
  color = color/(color+vec3(0.7));
  color = pow(color,vec3(1.0/2.2));
  float fog = smoothstep(uFogNear,uFogFar,length(vWorld-uEye));
  o = vec4(mix(color,uFogColor,fog),1.0);
}`;
const SKY_VERT = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2),float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p*2.0-1.0,0.0,1.0);
}`;
const SKY_FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform vec3 uFogColor;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main() {
  float dark = 1.0-smoothstep(0.08,0.24,max(uFogColor.r,max(uFogColor.g,uFogColor.b)));
  vec3 sky = mix(uFogColor*1.12,uFogColor*0.46,smoothstep(0.25,1.0,uv.y));
  float sun = exp(-length((uv-vec2(0.78,0.78))*vec2(1.5,1.0))*8.0);
  sky += vec3(1.0,0.68,0.33)*sun*0.3*(1.0-dark);
  float cloudLine = uv.y - 0.69 - 0.035*sin(uv.x*15.0) - 0.02*sin(uv.x*31.0);
  float clouds = exp(-cloudLine*cloudLine*750.0) * (0.55+0.25*sin(uv.x*22.0));
  sky = mix(sky,vec3(0.9,0.91,0.92),clouds*(1.0-dark)*0.33);

  vec2 cell = floor(uv*vec2(700.0,450.0));
  float star = step(0.997,hash(cell))*pow(max(0.0,1.0-length(fract(uv*vec2(700.0,450.0))-0.5)*2.0),3.0);
  sky += vec3(0.65,0.8,1.0)*star*dark;
  o = vec4(sky,1.0);
}`;

const VERT_UNLIT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uMVP;
out vec3 vColor;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  vColor = aColor;
}`;

const FRAG_UNLIT = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 o;
void main() {
  o = vec4(vColor * 1.4, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || "shader");
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "link");
  }
  return p;
}

function loc(gl, p) {
  return {
    uMVP: gl.getUniformLocation(p, "uMVP"),
    uModel: gl.getUniformLocation(p, "uModel"),
    uLightDir: gl.getUniformLocation(p, "uLightDir"),
    uAmbient: gl.getUniformLocation(p, "uAmbient"),
    uFlash: gl.getUniformLocation(p, "uFlash"),
    uFogColor: gl.getUniformLocation(p, "uFogColor"),
    uFogNear: gl.getUniformLocation(p, "uFogNear"),
    uFogFar: gl.getUniformLocation(p, "uFogFar"),
    uEye: gl.getUniformLocation(p, "uEye"),
    uMaterial: gl.getUniformLocation(p, "uMaterial"),
  };
}

export class Renderer {
  constructor(gl) {
    this.gl = gl;
    this.lit = program(gl, VERT, FRAG);
    this.sky = program(gl, SKY_VERT, SKY_FRAG);
    this.skyFog = gl.getUniformLocation(this.sky, "uFogColor");
    this.skyVao = gl.createVertexArray();
    this.unlit = program(gl, VERT_UNLIT, FRAG_UNLIT);
    this.litLoc = loc(gl, this.lit);
    this.unlitLoc = loc(gl, this.unlit);
    this.meshes = new Map();
    this.fog = [0.45, 0.7, 0.95];
    this.fogNear = 40;
    this.fogFar = 220;
    this.eye = [0, 20, 0];
    this.light = [0.35, 0.82, 0.4];
    this.ambient = [0.28, 0.3, 0.34];
    this._prog = null;
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.45, 0.7, 0.95, 1);
  }

  setClear(r, g, b) {
    this.gl.clearColor(r, g, b, 1);
    this.fog = [r, g, b];
  }

  setFog(near, far) {
    this.fogNear = near;
    this.fogFar = far;
  }

  upload(name, data) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
    const stride = 36;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.meshes.set(name, { vao, count: data.indices.length });
  }

  begin(w, h, clearRgb) {
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    if (clearRgb) gl.clearColor(clearRgb[0], clearRgb[1], clearRgb[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky);
    gl.uniform3fv(this.skyFog, clearRgb || this.fog);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    this._prog = null;
  }

  draw(name, mvp, model, flash = 0, unlit = false) {
    const mesh = this.meshes.get(name);
    if (!mesh) return;
    const gl = this.gl;
    const prog = unlit ? this.unlit : this.lit;
    const L = unlit ? this.unlitLoc : this.litLoc;
    if (this._prog !== prog) {
      gl.useProgram(prog);
      this._prog = prog;
    }
    gl.uniformMatrix4fv(L.uMVP, false, mvp);
    if (!unlit) {
      gl.uniformMatrix4fv(L.uModel, false, model);
      gl.uniform3fv(L.uLightDir, this.light);
      gl.uniform3fv(L.uAmbient, this.ambient);
      gl.uniform1f(L.uFlash, flash);
      gl.uniform3fv(L.uFogColor, this.fog);
      gl.uniform1f(L.uFogNear, this.fogNear);
      gl.uniform1f(L.uFogFar, this.fogFar);
      gl.uniform3fv(L.uEye, this.eye);
      const terrain = /ground|rock|wall|mountain|arch/i.test(name);
      gl.uniform3f(L.uMaterial, terrain ? 0.0 : 0.65, terrain ? 0.95 : 0.26, terrain ? 1.0 : 0.0);
    }
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
}
