import * as THREE from 'three'

// Thousands of fireflies that wander the meadow — and, when it matters,
// gather in the sky to draw a heart, or her name.
const N = 3200

export function heartPoints(center, scale) {
  const out = []
  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const shell = Math.random() < 0.7
    const s = shell ? 1 + (Math.random() - 0.5) * 0.03 : Math.sqrt(Math.random())
    out.push(new THREE.Vector3(center.x + (x / 17) * s * scale, center.y + (y / 17) * s * scale, center.z + (Math.random() - 0.5) * 0.3))
  }
  return out
}

export async function namePoints(name, center, width) {
  await document.fonts.load('160px "Pinyon Script"')
  const W = 1000, H = 300
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = ctx.strokeStyle = '#fff'
  ctx.lineWidth = 6
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '190px "Pinyon Script", cursive'
  ctx.fillText(name, W / 2, H / 2)
  ctx.strokeText(name, W / 2, H / 2)
  const d = ctx.getImageData(0, 0, W, H).data
  const px = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 120) px.push([x, y])
  const s = width / W
  const out = []
  for (let i = 0; i < N; i++) {
    if (i < N * 0.85) {
      const [x, y] = px[Math.floor(Math.random() * px.length)]
      out.push(new THREE.Vector3(center.x + (x + Math.random() - W / 2) * s, center.y - (y + Math.random() - H / 2) * s, center.z))
    } else {
      // a little heart dotting the end
      const t = Math.random() * Math.PI * 2
      const hx = 16 * Math.pow(Math.sin(t), 3) / 17, hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
      out.push(new THREE.Vector3(center.x + width * 0.5 + 0.6 + hx * 0.7, center.y + 0.9 + hy * 0.7, center.z))
    }
  }
  return out
}

export function createFireflies(tex) {
  const pos = new Float32Array(N * 3)
  const vel = new Float32Array(N * 3)
  const home = new Float32Array(N * 3)
  const seed = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    seed[i] = Math.random()
    home[i * 3] = (Math.random() - 0.5) * 40
    home[i * 3 + 1] = 0.3 + Math.random() * 3.5
    home[i * 3 + 2] = -4 + Math.random() * 24
    pos.set(home.subarray(i * 3, i * 3 + 3), i * 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const uniforms = { uTime: { value: 0 }, uTex: { value: tex }, uSize: { value: 1 }, uPR: { value: Math.min(devicePixelRatio, 2) }, uForm: { value: 0 } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uSize, uPR, uForm;
      varying float vA; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = smoothstep(0.2, 1.0, sin(uTime * (0.8 + aSeed * 1.6) + aSeed * 60.0) * 0.5 + 0.5);
        vA = mix(blink * 0.9 + 0.1, 0.75 + 0.25 * blink, uForm);
        vC = mix(vec3(1.0, 0.82, 0.45), vec3(0.85, 0.6, 1.0), step(0.55, aSeed));
        vC = mix(vC, vec3(1.0, 0.72, 0.92), uForm * 0.6);
        gl_PointSize = uSize * (14.0 + aSeed * 10.0) * uPR / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; varying float vA; varying vec3 vC;
      void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * 2.2, t.a * vA); }`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false

  let targets = null
  let center = new THREE.Vector3(0, 1.5, 0)
  let radius = 18
  points.userData = {
    uniforms,
    wander(c = new THREE.Vector3(0, 1.5, 4), r = 18) {
      targets = null
      center = c.clone()
      radius = r
      uniforms.uForm.value = 0
      for (let i = 0; i < N; i++) {
        home[i * 3] = c.x + (Math.random() - 0.5) * r * 2
        home[i * 3 + 1] = 0.25 + Math.random() * 3.2
        home[i * 3 + 2] = c.z + (Math.random() - 0.5) * r * 1.4
      }
    },
    form(list) {
      targets = list
    },
    update(dt, t) {
      uniforms.uTime.value = t
      const f = Math.min(dt * 60, 3)
      const formT = targets ? 1 : 0
      uniforms.uForm.value += (formT - uniforms.uForm.value) * 0.02 * f
      for (let i = 0; i < N; i++) {
        const j = i * 3
        let tx, ty, tz, k
        if (targets) {
          const p = targets[i]
          tx = p.x + Math.sin(t * 0.9 + seed[i] * 50) * 0.03
          ty = p.y + Math.cos(t * 0.8 + seed[i] * 40) * 0.03
          tz = p.z
          k = 0.004 + seed[i] * 0.006
        } else {
          tx = home[j] + Math.sin(t * 0.3 + seed[i] * 20) * 1.2
          ty = home[j + 1] + Math.sin(t * 0.5 + seed[i] * 30) * 0.5
          tz = home[j + 2] + Math.cos(t * 0.25 + seed[i] * 10) * 1.2
          k = 0.0015
        }
        vel[j] = (vel[j] + (tx - pos[j]) * k * f) * Math.pow(0.95, f)
        vel[j + 1] = (vel[j + 1] + (ty - pos[j + 1]) * k * f) * Math.pow(0.95, f)
        vel[j + 2] = (vel[j + 2] + (tz - pos[j + 2]) * k * f) * Math.pow(0.95, f)
        pos[j] += vel[j] * f
        pos[j + 1] += vel[j + 1] * f
        pos[j + 2] += vel[j + 2] * f
      }
      geo.attributes.position.needsUpdate = true
    },
  }
  void center
  void radius
  return points
}

// Golden fairy dust shed by his light as it moves.
export function createDust(tex, count = 700) {
  const pos = new Float32Array(count * 3)
  const vel = new Float32Array(count * 3)
  const life = new Float32Array(count)
  const seed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    seed[i] = Math.random()
    pos[i * 3 + 1] = -100
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uPR: { value: Math.min(devicePixelRatio, 2) }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aLife; attribute float aSeed; uniform float uPR; uniform float uTime;
      varying float vA; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.6 + 0.4 * sin(uTime * 14.0 + aSeed * 50.0);
        vA = aLife * tw;
        vC = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.7, 0.95), aSeed);
        gl_PointSize = (5.0 + aSeed * 6.0) * aLife * uPR * 10.0 / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; varying float vA; varying vec3 vC;
      void main(){ gl_FragColor = vec4(vC * 2.5, texture2D(uTex, gl_PointCoord).a * vA); }`,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  let next = 0, acc = 0
  const last = new THREE.Vector3()
  pts.userData.update = (dt, t, src, strength = 1) => {
    mat.uniforms.uTime.value = t
    const moved = last.distanceTo(src)
    last.copy(src)
    acc += dt * (25 + moved * 400) * strength
    while (acc > 1) {
      acc -= 1
      const i = next
      next = (next + 1) % count
      pos[i * 3] = src.x + (Math.random() - 0.5) * 0.15
      pos[i * 3 + 1] = src.y + (Math.random() - 0.5) * 0.15
      pos[i * 3 + 2] = src.z + (Math.random() - 0.5) * 0.15
      vel[i * 3] = (Math.random() - 0.5) * 0.25
      vel[i * 3 + 1] = -0.05 - Math.random() * 0.2
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.25
      life[i] = 1
    }
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) continue
      life[i] = Math.max(0, life[i] - dt * 0.42)
      pos[i * 3] += vel[i * 3] * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aLife.needsUpdate = true
  }
  return pts
}
