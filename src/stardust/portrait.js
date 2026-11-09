import * as THREE from 'three'

// ── Her photograph, re-born as living stardust ─────────────────────────────
// Every particle is one pixel of the real photo, lifted into 3D by a depth map
// and cut from the background by a person mask (both computed offline with
// Depth-Anything-v2 and a matting model). On the GPU each particle can be:
// a star in a galaxy, a pixel of her portrait, a grain of wind, a firework.

export const PHOTO = { cx: 452, cy: 770, k: 1 / 150 } // pixel → world
export const px2w = (x, y) => [(x - PHOTO.cx) * PHOTO.k, (PHOTO.cy - y) * PHOTO.k]
const CROP = { x0: 285, x1: 625, y0: 440, y1: 1101 }

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = src
  })
}

function pixels(im, w, h) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(im, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h).data
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1)
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1)
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

const GLSL_FLOW = /* glsl */ `
  vec3 flow(vec3 p, float t){
    return vec3(
      sin(p.y * 1.3 + t * 0.7) + 0.5 * sin(p.z * 2.1 - t * 0.5 + p.x),
      sin(p.z * 1.1 + t * 0.6) + 0.5 * sin(p.x * 1.7 + t * 0.4 + p.y),
      sin(p.x * 1.2 - t * 0.5) + 0.5 * sin(p.y * 1.9 + t * 0.3 + p.z));
  }
  float hash(float n){ return fract(sin(n) * 43758.5453); }
`
export { GLSL_FLOW }

export async function createPortrait({ step = 1, onProgress } = {}) {
  const [photo, depthIm, maskIm] = await Promise.all([
    loadImage('/ewurama.jpg'),
    loadImage('/portrait/depth.png'),
    loadImage('/portrait/mask.png'),
  ])
  onProgress?.(0.6)
  const W = photo.naturalWidth, H = photo.naturalHeight
  const P = pixels(photo, W, H)
  const D = pixels(depthIm, W, H)
  const M = pixels(maskIm, W, H)
  const mask = new Float32Array(W * H)
  const depth = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    mask[i] = M[i * 4] / 255
    depth[i] = D[i * 4] / 255
  }
  // keep only her (not the people far behind her)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (x < CROP.x0 || x > CROP.x1 || y < CROP.y0) mask[y * W + x] = 0
  const soft = boxBlur(mask, W, H, 9)
  // depth only from confidently-her pixels, so the silhouette never smears into the background
  const solid = new Float32Array(W * H), dm = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    solid[i] = mask[i] > 0.92 ? 1 : 0
    dm[i] = depth[i] * solid[i]
  }
  const bS = boxBlur(solid, W, H, 6), bD = boxBlur(dm, W, H, 6)
  const sDepth = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) sDepth[i] = solid[i] ? (depth[i] + bD[i] / Math.max(1e-4, bS[i])) * 0.5 : bD[i] / Math.max(1e-4, bS[i])

  // depth range over her body
  let dmin = 1, dmax = 0
  for (let i = 0; i < W * H; i++)
    if (mask[i] > 0.92) {
      dmin = Math.min(dmin, sDepth[i])
      dmax = Math.max(dmax, sDepth[i])
    }
  const nd = (i) => Math.min(1, Math.max(0, (sDepth[i] - dmin) / Math.max(1e-3, dmax - dmin)))

  const pos = [], col = [], nor = [], rnd = [], gal = [], misc = []
  const lin = (v) => Math.pow(v / 255, 2.2)
  const DS = 0.95 // depth in world units
  for (let y = CROP.y0; y < CROP.y1; y += step)
    for (let x = CROP.x0; x < CROP.x1; x += step) {
      const fx = Math.min(W - 4, Math.max(3, Math.round(x + (Math.random() - 0.5) * step)))
      const fy = Math.min(H - 4, Math.max(3, Math.round(y + (Math.random() - 0.5) * step)))
      const i = fy * W + fx
      const m = mask[i]
      if (m < 0.5) continue
      const d = nd(i)
      const [wx, wy] = px2w(fx, fy)
      pos.push(wx, wy, (d - 0.5) * DS)
      col.push(lin(P[i * 4]), lin(P[i * 4 + 1]), lin(P[i * 4 + 2]))
      // normal from the depth gradient
      const dzdx = ((nd(i + 3) - nd(i - 3)) * DS) / (6 * PHOTO.k)
      const dzdy = ((nd(i - 3 * W) - nd(i + 3 * W)) * DS) / (6 * PHOTO.k)
      const n = new THREE.Vector3(-dzdx, -dzdy, 1).normalize()
      nor.push(n.x, n.y, n.z)
      rnd.push(Math.random(), Math.random(), Math.random(), Math.random())
      // home in a spiral galaxy: (radius, angle, height)
      const r = 0.6 + Math.pow(Math.random(), 0.65) * 9
      const arm = Math.floor(Math.random() * 3)
      const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
      gal.push(r, r * 0.75 + (arm * Math.PI * 2) / 3 + g() * 0.45, g() * 0.35 * (1.2 - r / 10))
      const edge = 1 - Math.min(1, Math.max(0, (soft[i] - 0.55) / 0.4))
      const low = Math.min(1, Math.max(0, (fy - 940) / 160))
      misc.push(edge, low, d)
    }

  const count = pos.length / 3
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3))
  geo.setAttribute('aNormal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 4))
  geo.setAttribute('aGal', new THREE.Float32BufferAttribute(gal, 3))
  geo.setAttribute('aMisc', new THREE.Float32BufferAttribute(misc, 3))
  // other worlds these same particles can become
  const altFrom = new Float32Array(count * 4), altTo = new Float32Array(count * 4), ord = new Float32Array(count)
  for (let i = 0; i < count; i++) ord[i] = Math.random()
  geo.setAttribute('aAltFrom', new THREE.BufferAttribute(altFrom, 4))
  geo.setAttribute('aAltTo', new THREE.BufferAttribute(altTo, 4))
  geo.setAttribute('aOrd', new THREE.BufferAttribute(ord, 1))

  const u = {
    uTime: { value: 0 },
    uScale: { value: 800 },
    uSize: { value: step * PHOTO.k * 2.1 },
    uAssemble: { value: 0 },
    uFlow: { value: 0 },
    uFlutter: { value: 1 },
    uBreath: { value: 1 },
    uWind: { value: 0 },
    uExplode: { value: 0 },
    uLayers: { value: 0 },
    uLines: { value: 0 },
    uSweep: { value: -5 },
    uRelight: { value: 0.75 },
    uLightPos: { value: new THREE.Vector3(-2, 2.5, 3) },
    uLightCol: { value: new THREE.Color(1.0, 0.86, 0.78) },
    uRimCol: { value: new THREE.Color(0.62, 0.36, 1.0) },
    uRim: { value: 0.6 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uWarm: { value: 0 },
    uBlush: { value: 0 },
    uCheeks: { value: [new THREE.Vector2(...px2w(436, 566)), new THREE.Vector2(...px2w(494, 566))] },
    uShake: { value: 0 },
    uWave: { value: 0 },
    uWaveC: { value: new THREE.Vector2(...px2w(452, 572)) },
    uPulse: { value: 1 },
    uPulseC: { value: new THREE.Vector2(...px2w(455, 690)) },
    uAlt: { value: 0 },
    uAltT: { value: 1 },
    uAltWave: { value: 0 },
    uAltDrift: { value: 0 },
    uAltSize: { value: 3 },
    uAltA: { value: new THREE.Color(1, 0.6, 0.8) },
    uAltB: { value: new THREE.Color(0.7, 0.5, 1) },
    uAltY: { value: new THREE.Vector2(-1, 5) },
    uRainCol: { value: new THREE.Color(0.45, 0.6, 1.0) },
    uFall: { value: new THREE.Vector3(7, 9, 2.2) }, // top, height, speed
    uCosmos: { value: 0 },
    uAltGain: { value: 1 },
    uExposure: { value: 1 },
    uGalRot: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.1, 0, 0.35))) },
    uGalC: { value: new THREE.Vector3(0, 1.2, -9) },
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      uniform float uTime, uScale, uSize, uAssemble, uFlow, uFlutter, uBreath, uWind, uExplode, uLayers, uLines, uSweep;
      uniform float uRelight, uRim, uWarm, uBlush, uShake, uWave, uPulse, uExposure;
      uniform float uAlt, uAltT, uAltWave, uAltDrift, uAltSize, uCosmos, uAltGain;
      uniform vec3 uAltA, uAltB, uRainCol, uFall; uniform vec2 uAltY;
      uniform vec3 uLightPos, uLightCol, uRimCol, uTint, uGalC;
      uniform vec2 uCheeks[2], uWaveC, uPulseC;
      uniform mat3 uGalRot;
      attribute vec3 aCol, aNormal, aGal, aMisc; attribute vec4 aRand, aAltFrom, aAltTo; attribute float aOrd;
      varying vec3 vCol; varying float vAlpha;
      ${GLSL_FLOW}
      float fallY(float y, float f){
        if (f < 0.5) return y;
        return uFall.x - mod(uFall.x - y + uTime * uFall.z * (0.75 + aRand.y * 0.5), uFall.y);
      }
      void main(){
        float t = uTime;
        float edge = aMisc.x, low = aMisc.y, dep = aMisc.z;
        vec3 p0 = position;
        vec3 N = aNormal;

        // ── she is alive: breath, a stir of hair, stardust at her edges ──
        float br = sin(t * 1.05);
        p0.y += br * 0.006 * uBreath * smoothstep(-1.5, 1.0, p0.y);
        p0.z += br * 0.012 * uBreath * smoothstep(-0.2, 0.8, p0.y) * (1.0 - smoothstep(1.0, 1.4, p0.y));
        p0 += flow(p0 * 3.0 + aRand.xyz * 2.0, t * 1.2) * 0.010 * edge * uFlutter;
        // anger: a little tremor
        p0 += vec3(sin(t * 47.0 + aRand.x * 60.0), sin(t * 53.0 + aRand.y * 60.0), 0.0) * 0.006 * uShake;
        // conversations: ripples spreading from her lips
        float rw = length(p0.xy - uWaveC);
        p0.z += sin(rw * 16.0 - t * 7.0) * 0.022 * uWave * exp(-rw * 0.7);
        // heartbeat ripple from her chest
        float rp = length(p0.xy - uPulseC);
        float pulse = exp(-pow(rp - uPulse * 3.2, 2.0) * 14.0) * (1.0 - uPulse);
        p0 += N * pulse * 0.07;

        // the universe inside her: the interior drifts like a nebula
        p0 += flow(p0 * 2.0 + aRand.xyz * 3.0, t * 0.35) * 0.035 * uCosmos * (1.0 - edge);

        // a diorama: her depth pulled apart into floating layers
        float layer = floor(dep * 7.0) / 6.0;
        p0.z = mix(p0.z, (layer - 0.5) * 3.2, uLayers);

        // the hem of the photograph dissolves into drifting stardust
        float ph = fract(t * (0.035 + aRand.z * 0.05) + aRand.x);
        float shed = pow(low, 1.4) * ph;
        p0 += (flow(p0 * 1.4 + aRand.wxy * 4.0, t * 0.4) * vec3(0.35, 0.15, 0.35) + vec3(0.0, -0.25 - aRand.y * 0.6, 0.0)) * shed * 1.6;

        // ── where it came from: a galaxy ──
        float ang = aGal.y + t * 0.06 / (0.35 + aGal.x * 0.12);
        vec3 g = uGalRot * vec3(cos(ang) * aGal.x, aGal.z, sin(ang) * aGal.x) + uGalC;
        float delay = aRand.x * 0.5 + (0.5 - p0.y / 4.6) * 0.3;
        float a = smoothstep(delay, delay + 0.4, uAssemble);
        vec3 p = mix(g, p0, a);
        p += flow(p * 0.7 + aRand.zyx * 3.0, t * 0.5) * sin(a * 3.14159) * 0.9;

        // ── taking a chance: carried off on the wind, and home again ──
        float wd = clamp((p0.x + 1.2) / 2.4, 0.0, 1.0) * 0.45 + aRand.y * 0.3;
        float w = smoothstep(wd, wd + 0.25, uWind);
        vec3 away = p0 + vec3(-2.2 - aRand.x * 3.2, 0.8 + aRand.y * 2.8, -1.2 - aRand.z * 2.8) + flow(p0 * 0.8 + aRand.xyz * 6.0, t * 0.6) * 0.9;
        p = mix(p, away, w);
        p += flow(p * 0.9 + aRand.xyz * 5.0, t * 0.8) * sin(w * 3.14159) * 0.5;

        // ── joy: she bursts into fireworks ──
        vec3 dir = normalize(aRand.xyz - 0.5 + 1e-4);
        p += dir * uExplode * (1.5 + aRand.w * 4.5) + vec3(0.0, -uExplode * uExplode * 0.8, 0.0);

        // free drift
        p += flow(p * 0.5 + aRand.xyz * 9.0, t * 0.3) * uFlow * (0.2 + aRand.w * 0.6);

        // ── other worlds: clouds, silk, a bridge, rain… made of the same light ──
        float kd = aOrd * 0.55 + aRand.z * 0.1;
        float ka = smoothstep(kd, kd + 0.35, uAlt);
        float kt = smoothstep(aOrd * 0.6, aOrd * 0.6 + 0.4, uAltT);
        vec3 af = vec3(aAltFrom.x, fallY(aAltFrom.y, aAltFrom.w), aAltFrom.z);
        vec3 at = vec3(aAltTo.x, fallY(aAltTo.y, aAltTo.w), aAltTo.z);
        vec3 q = mix(af, at, kt);
        float rainy = mix(aAltFrom.w, aAltTo.w, kt);
        q += flow(q * 0.5 + aRand.xyz * 4.0, t * 0.5) * sin(kt * 3.14159) * 0.6 * (1.0 - rainy);
        q.y += sin(q.x * 0.7 + t * 0.6 + q.z * 0.3) * 0.35 * uAltWave * (1.0 - rainy);
        q.z += cos(q.x * 0.5 + t * 0.4) * 0.3 * uAltWave * (1.0 - rainy);
        q += flow(q * 0.35 + aRand.zyx * 6.0, t * 0.22) * uAltDrift * 0.35 * (1.0 - rainy);
        p = mix(p, q, ka);
        p += flow(p * 0.6 + aRand.xyz * 5.0, t * 0.6) * sin(ka * 3.14159) * 0.7;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        // ── light ──
        vec3 c = aCol;
        vec3 L = normalize(uLightPos - p0);
        float dif = max(dot(N, L), 0.0);
        float rim = pow(1.0 - clamp(N.z, 0.0, 1.0), 2.0) + edge * 0.6;
        vec3 lit = c * (0.42 + dif * 0.8 * uLightCol) + uRimCol * rim * 0.18 * uRim;
        c = mix(c, lit, uRelight) * uTint;
        // warmth (her smile) and a blush on her cheeks
        c = mix(c, c * vec3(1.25, 1.02, 0.8) + vec3(0.05, 0.025, 0.0), uWarm);
        float bl = exp(-dot(p0.xy - uCheeks[0], p0.xy - uCheeks[0]) * 260.0) + exp(-dot(p0.xy - uCheeks[1], p0.xy - uCheeks[1]) * 260.0);
        c += vec3(0.16, 0.02, 0.06) * bl * uBlush;
        // the beautiful lines: glowing contours of her form, swept by light
        float iso = abs(fract(dep * 16.0 - t * 0.08) - 0.5);
        float line = smoothstep(0.045, 0.0, iso) * (1.0 - smoothstep(0.9, 1.25, p0.y)) * (1.0 - edge * 0.7);
        float band = exp(-pow(p0.y - uSweep, 2.0) * 14.0);
        c = mix(c, c * 0.7, uLines * 0.4);
        c += vec3(1.0, 0.78, 0.5) * line * uLines * (0.05 + band * 0.7);
        c += vec3(0.75, 0.55, 1.0) * band * uLines * 0.12;
        c += vec3(1.0, 0.75, 0.95) * pulse * 0.6;
        c *= uExposure;

        // stars, while travelling
        vec3 star = mix(vec3(0.7, 0.5, 1.0), vec3(1.0, 0.82, 0.55), step(0.6, aRand.w)) * 1.1;
        float travel = max(1.0 - a, w);
        c = mix(c, star, travel * 0.85);
        c += vec3(0.8, 0.6, 1.0) * (sin(a * 3.14159) + sin(w * 3.14159)) * 0.25;
        c = mix(c, star * 1.4, clamp(uExplode, 0.0, 1.0));
        // the universe inside her
        float tw = 0.5 + 0.5 * sin(t * (1.0 + aRand.y * 3.0) + aRand.x * 50.0);
        vec3 neb = mix(vec3(0.05, 0.02, 0.14), vec3(0.16, 0.05, 0.3), aRand.z) + mix(vec3(0.0), vec3(0.4, 0.2, 0.7), smoothstep(0.4, 1.0, flow(p0 * 1.5, t * 0.2).x * 0.5 + 0.5)) * 0.4;
        neb += step(0.965, aRand.y) * mix(vec3(1.0, 0.8, 0.5), vec3(0.7, 0.55, 1.0), aRand.w) * (0.4 + tw * 0.9);
        neb += vec3(0.6, 0.35, 1.0) * smoothstep(0.35, 0.95, edge) * 0.55;
        c = mix(c, neb, uCosmos);

        vec3 ac = pow(mix(uAltA, uAltB, aRand.w), vec3(2.2)) * (0.55 + 0.6 * aRand.y);
        ac *= mix(0.55, 1.25, clamp((q.y - uAltY.x) / max(0.1, uAltY.y - uAltY.x), 0.0, 1.0));
        ac *= uAltGain;
        ac = mix(ac, pow(uRainCol, vec3(2.2)) * (0.6 + 0.6 * aRand.y), rainy);
        c = mix(c, ac, ka);
        vCol = c;
        vAlpha = (1.0 - shed * shed * (1.0 - ka)) * mix(1.0, step(0.72, aRand.x), rainy * ka);

        float sz = mix(0.55 + aRand.w * 0.7, 1.0, a * (1.0 - w));
        sz *= mix(1.0, uAltSize * (rainy > 0.5 ? 0.5 : 1.0) * (0.6 + aRand.x * 0.8), ka);
        sz *= mix(1.0, 0.8 + step(0.965, aRand.y) * 1.4, uCosmos);
        gl_PointSize = uSize * sz * uScale / -mv.z;
        gl_PointSize = max(gl_PointSize, 1.2);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vAlpha;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        if (h(gl_FragCoord.xy) > vAlpha) discard;
        gl_FragColor = vec4(vCol, 1.0);
      }`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.userData = {
    uniforms: u,
    count,
    // morph the particles toward a new world: shape = { p: Float32Array(count*3), fall?, ord? }
    alt(shape) {
      const fresh = u.uAlt.value < 0.5
      if (fresh) altFrom.set(altTo)
      else altFrom.set(altTo)
      for (let i = 0; i < count; i++) {
        altTo[i * 4] = shape.p[i * 3]
        altTo[i * 4 + 1] = shape.p[i * 3 + 1]
        altTo[i * 4 + 2] = shape.p[i * 3 + 2]
        altTo[i * 4 + 3] = shape.fall ? shape.fall[i] : 0
        ord[i] = shape.ord ? shape.ord[i] : Math.random()
      }
      if (fresh) altFrom.set(altTo)
      geo.attributes.aAltFrom.needsUpdate = geo.attributes.aAltTo.needsUpdate = geo.attributes.aOrd.needsUpdate = true
      u.uAltT.value = fresh ? 1 : 0
      return fresh
    },
  }
  return points
}
