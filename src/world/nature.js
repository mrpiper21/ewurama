import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────────────────────
//  The landscape: a lavender meadow on the shore of a moonlit lake.
// ─────────────────────────────────────────────────────────────────────────────

export const MOON_DIR = new THREE.Vector3(-0.12, 0.2, -1).normalize()
export const FOG_COLOR = new THREE.Color('#1a1030')

const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17

export const shoreZ = (x) => -5.4 + Math.sin(x * 0.13) * 1.6 + Math.sin(x * 0.41 + 1) * 0.5

export function heightAt(x, z) {
  const d = z - shoreZ(x)
  if (d < 0) return Math.max(-1.2, d * 0.35)
  const land = Math.min(1, d / 5)
  let h = Math.min(d * 0.08, 0.25) + (fbm(x * 0.08, z * 0.08) - 0.5) * 1.6 * land
  // rolling hills further back frame the meadow
  const back = Math.min(36, Math.max(0, z - 22))
  h += back * back * 0.01 * (0.6 + fbm(x * 0.04, z * 0.04))
  const side = Math.min(30, Math.max(0, Math.abs(x) - 26))
  h += side * side * 0.008
  return h
}

// ── Sky: gradient, moon, milky way and twinkling stars, all procedural ──────
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uMoon: { value: MOON_DIR }, uGlow: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uMoon; uniform float uGlow;
      varying vec3 vDir;
      float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*n3(p); p*=2.03; a*=0.5; } return s; }
      float stars(vec3 d, float scale, float thresh){
        vec3 p = d * scale; vec3 c = floor(p); float h = h31(c);
        if (h < thresh) return 0.0;
        vec3 o = vec3(h31(c+1.3), h31(c+2.7), h31(c+5.1)) - 0.5;
        float dist = length(fract(p) - 0.5 - o*0.6);
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 4.0) + h * 80.0);
        return smoothstep(0.09, 0.0, dist) * tw * (h - thresh) / (1.0 - thresh) * 6.0;
      }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zenith = vec3(0.012, 0.008, 0.045);
        vec3 mid = vec3(0.09, 0.035, 0.19);
        vec3 horizon = vec3(0.42, 0.17, 0.42);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, zenith, smoothstep(0.12, 0.75, h));
        // milky way
        vec3 bandN = normalize(vec3(0.5, 0.35, 0.8));
        float band = exp(-pow(dot(d, bandN) / 0.2, 2.0));
        float cloud = fbm(d * 5.0 + 3.0) * fbm(d * 11.0);
        col += band * cloud * vec3(0.55, 0.32, 0.75) * 0.9 * smoothstep(0.0, 0.25, h);
        col -= band * smoothstep(0.55, 0.75, fbm(d * 9.0)) * 0.05;
        // stars
        float s = stars(d, 180.0, 0.965) + stars(d, 420.0, 0.94) * 0.6 + band * stars(d, 700.0, 0.9) * 0.8;
        col += s * vec3(1.0, 0.93, 1.0) * smoothstep(0.02, 0.2, h);
        // moon + halo
        float m = dot(d, uMoon);
        float disc = smoothstep(0.99955, 0.99965, m);
        float maria = fbm(d * 160.0);
        col = mix(col, vec3(4.2, 3.9, 4.6) * (0.82 + 0.25 * maria), disc);
        col += vec3(0.75, 0.55, 1.0) * pow(max(m, 0.0), 120.0) * 0.9 * uGlow;
        col += vec3(0.55, 0.3, 0.75) * pow(max(m, 0.0), 10.0) * 0.32 * uGlow;
        // below the horizon fades into the hills
        col = mix(col, vec3(0.06, 0.03, 0.1), smoothstep(0.0, -0.08, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 64, 32), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  return mesh
}

// ── Ground ─────────────────────────────────────────────────────────────────
export function createTerrain() {
  const size = 260, seg = 260
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, 40)
  const p = geo.attributes.position
  const col = new Float32Array(p.count * 3)
  const grass = new THREE.Color('#1d2b26'), lav = new THREE.Color('#2b1c3d'), sand = new THREE.Color('#3a2c3a'), mud = new THREE.Color('#120c18')
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i)
    const y = heightAt(x, z)
    p.setY(i, y)
    const d = z - shoreZ(x)
    c.copy(grass).lerp(lav, fbm(x * 0.15, z * 0.15))
    if (d < 1.2) c.lerp(sand, 1 - Math.max(0, d) / 1.2)
    if (d < 0) c.copy(mud)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }))
  mesh.receiveShadow = true
  return mesh
}

// distant mountain silhouettes across the lake
export function createMountains() {
  const g = new THREE.Group()
  const layers = [
    { r: 230, h: 9, color: '#160c25', seed: 1 },
    { r: 190, h: 5, color: '#1d1130', seed: 7 },
  ]
  for (const L of layers) {
    const seg = 220
    const geo = new THREE.BufferGeometry()
    const pos = []
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI * 0.12 + (i / seg) * Math.PI * 0.76
      const x = Math.cos(a) * L.r * 1.6, z = -Math.sin(a) * L.r
      const n = fbm(i * 0.06 + L.seed, L.seed) * 0.8 + vnoise(i * 0.25, L.seed) * 0.25
      pos.push(x, -2, z, x, -2 + L.h * n * n * 2.2, z)
    }
    const idx = []
    for (let i = 0; i < seg; i++) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: L.color, side: THREE.DoubleSide, fog: false })))
  }
  return g
}

// ── Grass & lavender: 70k wind-swept blades that part around her ──────────
export function createMeadow() {
  const uniforms = {
    uTime: { value: 0 },
    uWalker: { value: new THREE.Vector3(999, 0, 999) },
    uOrb: { value: new THREE.Vector3(0, -50, 0) },
    uOrbPower: { value: 0 },
    uMoon: { value: MOON_DIR },
    uFogColor: { value: FOG_COLOR },
    uFogDensity: { value: 0.022 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec3 uWalker;
      varying float vT; varying vec3 vColor; varying vec3 vWorld; varying float vRand;
      void main(){
        vT = uv.y;
        vColor = instanceColor;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        vRand = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float gust = sin(uTime * 0.6 + root.x * 0.08 + root.z * 0.05) * 0.5 + 0.5;
        float w = sin(uTime * 1.6 + root.x * 0.5 + root.z * 0.35 + vRand * 2.0) * (0.35 + gust * 0.65);
        w += sin(uTime * 3.1 + root.x * 1.7 + vRand * 6.0) * 0.12;
        float bend = vT * vT;
        wp.x += w * bend * 0.22;
        wp.z += w * bend * 0.1;
        vec2 dv = root.xz - uWalker.xz;
        float dl = length(dv);
        float push = (1.0 - smoothstep(0.0, 0.7, dl)) * bend;
        wp.xz += normalize(dv + 0.0001) * push * 0.35;
        wp.y -= push * 0.15;
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uOrb; uniform float uOrbPower; uniform vec3 uFogColor; uniform float uFogDensity;
      varying float vT; varying vec3 vColor; varying vec3 vWorld; varying float vRand;
      void main(){
        vec3 base = vec3(0.012, 0.02, 0.022);
        vec3 col = mix(base, vColor, smoothstep(0.0, 1.0, vT));
        // moonlit sheen on the tips
        col += vec3(0.16, 0.12, 0.3) * pow(vT, 3.0) * (0.5 + vRand * 0.5);
        // warm glow from the little light that follows her
        float d = distance(vWorld, uOrb);
        col += vec3(0.95, 0.7, 1.0) * uOrbPower * vT / (1.0 + d * d * 1.4);
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        float f = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
      }`,
  })

  // blade: tapered strip
  const blade = new THREE.PlaneGeometry(0.05, 1, 1, 5)
  blade.translate(0, 0.5, 0)
  {
    const p = blade.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i)
      p.setX(i, p.getX(i) * (1 - t * 0.92))
      p.setZ(i, t * t * 0.08)
    }
  }
  // lavender: slim stalk with a plump spike of flowers
  const spike = new THREE.PlaneGeometry(0.05, 1, 1, 8)
  spike.translate(0, 0.5, 0)
  {
    const p = spike.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i)
      const w = t < 0.55 ? 0.22 : 0.9 * Math.sin(((t - 0.55) / 0.45) * Math.PI * 0.95 + 0.1)
      p.setX(i, p.getX(i) * w)
    }
  }
  const spikeX = spike.clone().rotateY(Math.PI / 2)
  const lavGeo = mergeGeometries([spike, spikeX])

  const group = new THREE.Group()
  const dummy = new THREE.Object3D()
  const c = new THREE.Color()

  const plant = (geo, count, area, colorFn, hFn) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    let n = 0
    let guard = 0
    while (n < count && guard++ < count * 6) {
      const x = area.x0 + Math.random() * (area.x1 - area.x0)
      const z = area.z0 + Math.random() * (area.z1 - area.z0)
      const d = z - shoreZ(x)
      if (d < 0.6) continue
      if (area.mask && !area.mask(x, z)) continue
      const h = hFn(x, z)
      dummy.position.set(x, heightAt(x, z) - 0.02, z)
      dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25)
      dummy.scale.set(0.8 + Math.random() * 0.6, h, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix)
      mesh.setColorAt(n, colorFn(x, z, c))
      n++
    }
    mesh.count = n
    mesh.frustumCulled = false
    return mesh
  }

  const grass = plant(
    blade,
    65000,
    { x0: -26, x1: 26, z0: -8, z1: 24 },
    (x, z, c) => c.setHSL(0.36 + Math.random() * 0.1, 0.35, 0.16 + Math.random() * 0.1),
    () => 0.25 + Math.random() * 0.45,
  )
  // lavender grows in soft drifts (rows) through the meadow
  const lav = plant(
    lavGeo,
    16000,
    { x0: -24, x1: 24, z0: -6, z1: 22, mask: (x, z) => Math.sin(x * 0.7 + Math.sin(z * 0.2) * 2) > 0.1 && fbm(x * 0.12, z * 0.12) > 0.42 },
    (x, z, c) => c.setHSL(0.74 + Math.random() * 0.06, 0.65, 0.45 + Math.random() * 0.15),
    () => 0.45 + Math.random() * 0.35,
  )
  group.add(grass, lav)
  group.userData.uniforms = uniforms
  return group
}

// ── A jacaranda tree in full purple bloom ──────────────────────────────────
export function createTree() {
  const group = new THREE.Group()
  const wood = []
  const tips = []
  const up = new THREE.Vector3(0, 1, 0)
  const grow = (start, dir, len, rad, depth) => {
    const end = start.clone().addScaledVector(dir, len)
    const g = new THREE.CylinderGeometry(rad * 0.68, rad, len, 7, 1)
    g.translate(0, len / 2, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir)
    g.applyQuaternion(q)
    g.translate(start.x, start.y, start.z)
    wood.push(g)
    if (depth === 0) {
      tips.push(end)
      return
    }
    const kids = depth > 3 ? 2 : 3
    for (let i = 0; i < kids; i++) {
      const nd = dir.clone()
      nd.x += (Math.random() - 0.5) * 1.3
      nd.z += (Math.random() - 0.5) * 1.3
      nd.y += 0.15 + Math.random() * 0.3
      nd.normalize()
      grow(end, nd, len * (0.68 + Math.random() * 0.15), rad * 0.62, depth - 1)
    }
    if (depth < 3) tips.push(end)
  }
  grow(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.08, 1, 0.05).normalize(), 2.6, 0.32, 5)
  const trunk = new THREE.Mesh(mergeGeometries(wood), new THREE.MeshStandardMaterial({ color: '#2a1d22', roughness: 0.9 }))
  trunk.castShadow = true
  group.add(trunk)

  const bloomGeo = new THREE.IcosahedronGeometry(0.11, 0)
  const bloomMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#5a2a9a', emissiveIntensity: 0.55 })
  const count = tips.length * 26
  const blooms = new THREE.InstancedMesh(bloomGeo, bloomMat, count)
  const d = new THREE.Object3D()
  const c = new THREE.Color()
  let n = 0
  for (const t of tips) {
    for (let k = 0; k < 26; k++) {
      d.position.set(t.x + (Math.random() - 0.5) * 1.3, t.y + (Math.random() - 0.35) * 0.8, t.z + (Math.random() - 0.5) * 1.3)
      d.rotation.set(Math.random() * 6, Math.random() * 6, 0)
      d.scale.setScalar(0.6 + Math.random() * 1.1)
      d.updateMatrix()
      blooms.setMatrixAt(n, d.matrix)
      blooms.setColorAt(n, c.setHSL(0.73 + Math.random() * 0.08, 0.7, 0.55 + Math.random() * 0.2))
      n++
    }
  }
  blooms.castShadow = true
  group.add(blooms)
  group.userData.tips = tips
  return group
}

// ── Petals drifting down from the jacaranda ────────────────────────────────
export function createPetals(origin, count = 500) {
  const geo = new THREE.PlaneGeometry(0.07, 0.1)
  const mat = new THREE.MeshStandardMaterial({ color: '#c79bff', emissive: '#6b2fb0', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.5 })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  const parts = Array.from({ length: count }, () => ({}))
  const spawn = (p, initial) => {
    p.x = origin.x + (Math.random() - 0.5) * 7
    p.z = origin.z + (Math.random() - 0.5) * 7
    p.y = initial ? Math.random() * 7 : 4 + Math.random() * 3
    p.vy = 0.25 + Math.random() * 0.3
    p.ph = Math.random() * 6.28
    p.spin = (Math.random() - 0.5) * 3
  }
  parts.forEach((p) => spawn(p, true))
  const d = new THREE.Object3D()
  mesh.frustumCulled = false
  mesh.userData.update = (dt, t, wind = 1) => {
    for (let i = 0; i < count; i++) {
      const p = parts[i]
      p.y -= p.vy * dt
      p.x += (Math.sin(t * 0.8 + p.ph) * 0.4 + 0.35 * wind) * dt
      p.z += Math.cos(t * 0.6 + p.ph) * 0.2 * dt
      if (p.y < heightAt(p.x, p.z)) spawn(p, false)
      d.position.set(p.x, p.y, p.z)
      d.rotation.set(t * p.spin + p.ph, t * p.spin * 0.7, Math.sin(t + p.ph))
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  return mesh
}

// ── Sky lanterns, released one by one over the water ───────────────────────
export function createLanterns(count = 90) {
  const geo = new THREE.CylinderGeometry(0.12, 0.09, 0.26, 10, 1, true)
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.62, 0.22), side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  const parts = Array.from({ length: count }, (_, i) => ({ t: -1, i }))
  const d = new THREE.Object3D()
  let origin = new THREE.Vector3()
  let rate = 0, acc = 0
  mesh.userData.release = (o, perSec) => {
    origin = o.clone()
    rate = perSec
  }
  mesh.userData.update = (dt, time) => {
    acc += dt * rate
    for (const p of parts) {
      if (p.t < 0 && acc >= 1) {
        acc -= 1
        p.t = 0
        p.x = origin.x + (Math.random() - 0.5) * 6
        p.z = origin.z + (Math.random() - 0.5) * 3
        p.y = origin.y + Math.random() * 0.5
        p.sp = 0.35 + Math.random() * 0.35
        p.dx = (Math.random() - 0.5) * 0.25
        p.dz = -0.5 - Math.random() * 0.6
        p.ph = Math.random() * 6.28
      }
      if (p.t < 0) {
        d.position.set(0, -100, 0)
        d.scale.setScalar(0.0001)
      } else {
        p.t += dt
        p.y += p.sp * dt
        p.x += (p.dx + Math.sin(time * 0.5 + p.ph) * 0.12) * dt
        p.z += p.dz * dt
        if (p.y > 60) p.t = -1
        d.position.set(p.x, p.y, p.z)
        const flick = 0.9 + Math.sin(time * 9 + p.ph) * 0.05
        d.scale.setScalar(Math.min(1, p.t) * flick)
        d.rotation.set(0, p.ph + time * 0.2, Math.sin(time + p.ph) * 0.08)
      }
      d.updateMatrix()
      mesh.setMatrixAt(p.i, d.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  return mesh
}

// shared glow sprite
export function glowTexture() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,230,255,0.85)')
  g.addColorStop(0.4, 'rgba(200,140,255,0.25)')
  g.addColorStop(1, 'rgba(120,60,200,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ── A small fairy-tale castle on the far shore, windows warm with candlelight ──
export function createCastle() {
  const g = new THREE.Group()
  const stone = new THREE.MeshBasicMaterial({ color: '#1b0f2c', fog: false })
  const roof = new THREE.MeshBasicMaterial({ color: '#241339', fog: false })
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.6), fog: false })
  const tower = (x, z, r, h, roofH) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 16), stone)
    t.position.set(x, h / 2, z)
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, roofH, 16), roof)
    c.position.set(x, h + roofH / 2, z)
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, roofH * 0.35, 4), roof)
    spire.position.set(x, h + roofH + roofH * 0.17, z)
    g.add(t, c, spire)
    for (let k = 0; k < Math.floor(h / 2.2); k++) {
      if (Math.random() < 0.35) continue
      const w = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.28, r * 0.5), win)
      w.position.set(x + (Math.random() - 0.5) * r * 0.6, 1.4 + k * 2.2, z + r + 0.02)
      g.add(w)
    }
  }
  const keep = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 5), stone)
  keep.position.set(0, 4, 0)
  g.add(keep)
  for (let i = 0; i < 6; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1), win)
    w.position.set(-3.4 + i * 1.35, 4.5 + (i % 2) * 1.6, 2.52)
    g.add(w)
  }
  tower(0, 0, 1.6, 15, 6)
  tower(-4.8, 0.5, 1.1, 11, 4.5)
  tower(4.8, 0.5, 1.1, 11, 4.5)
  tower(-2.4, 2.4, 0.75, 9, 3.4)
  tower(2.6, 2.3, 0.8, 9.5, 3.5)
  tower(-7, 1.5, 0.7, 7, 2.8)
  tower(7.2, 1.2, 0.65, 6.5, 2.6)
  // a hill to sit on
  const hill = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone)
  hill.scale.set(1.4, 0.32, 0.8)
  hill.position.y = -3
  g.add(hill)
  return g
}
