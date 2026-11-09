import * as THREE from 'three'
import { GLSL_FLOW } from './portrait'
import * as S from './shapes'

// Free stardust: it drifts, and on cue it gathers into a diamond, a halo,
// words, two hearts, her name.
export function createSkyDust(N, pr) {
  const seeds = new Float32Array(N * 4)
  for (let i = 0; i < N * 4; i++) seeds[i] = Math.random()
  const home = S.drift(N)
  const from = home.slice(), to = home.slice()
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(home, 3))
  geo.setAttribute('aFrom', new THREE.BufferAttribute(from, 3))
  geo.setAttribute('aTo', new THREE.BufferAttribute(to, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(seeds, 4))
  const u = {
    uTime: { value: 0 },
    uT: { value: 1 },
    uWander: { value: 1 },
    uSpin: { value: 0 },
    uSpinC: { value: new THREE.Vector3() },
    uSpinFrom: { value: 0 },
    uSpinFromC: { value: new THREE.Vector3() },
    uScale: { value: 800 },
    uSize: { value: 0.016 },
    uBright: { value: 0.8 },
    uColA: { value: new THREE.Color(1.0, 0.78, 0.45) },
    uColB: { value: new THREE.Color(0.72, 0.5, 1.0) },
    uPulse: { value: 0 },
    uPulseC: { value: new THREE.Vector3() },
    uPR: { value: pr },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uT, uWander, uSpin, uSpinFrom, uScale, uSize, uBright, uPulse;
      uniform vec3 uSpinC, uSpinFromC, uColA, uColB, uPulseC;
      attribute vec3 aFrom, aTo; attribute vec4 aRand;
      varying vec3 vC; varying float vA;
      ${GLSL_FLOW}
      vec3 spin(vec3 p, vec3 c, float a){ p -= c; float s = sin(a), co = cos(a); return vec3(co * p.x + s * p.z, p.y, -s * p.x + co * p.z) + c; }
      void main(){
        float t = uTime;
        float d = aRand.x * 0.45;
        float k = smoothstep(d, d + 0.55, uT);
        vec3 a = uSpinFrom != 0.0 ? spin(aFrom, uSpinFromC, t * uSpinFrom) : aFrom;
        vec3 b = uSpin != 0.0 ? spin(aTo, uSpinC, t * uSpin) : aTo;
        vec3 p = mix(a, b, k);
        float arc = sin(k * 3.14159);
        p += flow(p * 0.45 + aRand.xyz * 5.0, t * 0.5) * arc * 0.9;
        p += flow(p * 0.3 + aRand.zyx * 7.0, t * 0.22) * uWander * 0.7;
        p += flow(aRand.xyz * 20.0, t * 1.4) * 0.008;
        p = uPulseC + (p - uPulseC) * (1.0 + uPulse * 0.07);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.55 + 0.45 * sin(t * (1.0 + aRand.y * 3.0) + aRand.z * 40.0);
        vA = tw * uBright * (1.0 + uPulse * 0.8);
        vC = mix(uColA, uColB, step(0.5, aRand.w)) * (1.0 + arc * 0.8);
        gl_PointSize = uSize * (0.5 + aRand.y * 1.0) * uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 5.0) * smoothstep(1.0, 0.7, d);
        gl_FragColor = vec4(vC * 1.2, a * vA * 0.75);
      }`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  let curSpin = { s: 0, c: new THREE.Vector3() }
  points.userData = {
    uniforms: u,
    seeds,
    home,
    N,
    // gather into a new shape; dur in seconds
    to(shape, { spin = 0, center = null, wander = 0, dur = 4 } = {}) {
      from.set(to)
      u.uSpinFrom.value = curSpin.s
      u.uSpinFromC.value.copy(curSpin.c)
      to.set(shape)
      curSpin = { s: spin, c: center ? center.clone() : new THREE.Vector3() }
      u.uSpin.value = spin
      u.uSpinC.value.copy(curSpin.c)
      geo.attributes.aFrom.needsUpdate = true
      geo.attributes.aTo.needsUpdate = true
      u.uT.value = 0
      points.userData.dur = dur
      points.userData.wanderTarget = wander
    },
    dur: 4,
    wanderTarget: 1,
    update(dt, t) {
      u.uTime.value = t
      u.uT.value = Math.min(1, u.uT.value + dt / points.userData.dur)
      if (u.uT.value >= 1) u.uSpinFrom.value = u.uSpin.value
      u.uWander.value += (points.userData.wanderTarget - u.uWander.value) * Math.min(1, dt * 0.8)
    },
  }
  return points
}

// A deep violet night: nebula clouds and a dome of stars
export function createNight() {
  const g = new THREE.Group()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uGlow: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uGlow; uniform vec3 uTint; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vD);
          float t = uTime * 0.006;
          float c = fbm(d * 2.2 + vec3(t, 0.0, -t));
          float c2 = fbm(d * 4.5 - vec3(0.0, t * 1.5, 0.0) + c);
          vec3 base = mix(vec3(0.006, 0.003, 0.02), vec3(0.03, 0.01, 0.06), smoothstep(-0.4, 0.6, d.y));
          float band = exp(-pow(d.y - 0.15 + sin(d.x * 2.0) * 0.12, 2.0) * 9.0);
          vec3 neb = mix(vec3(0.16, 0.03, 0.3), vec3(0.55, 0.12, 0.42), c2) * pow(c, 2.4) * (0.35 + band * 1.3);
          vec3 col = base + neb * 0.55 * uGlow;
          // horizon glow, like a city of dreams far away
          col += vec3(0.25, 0.08, 0.32) * exp(-abs(d.y + 0.05) * 9.0) * 0.4;
          gl_FragColor = vec4(col * uTint, 1.0);
        }`,
    }),
  )
  g.add(sky)
  // far stars
  const N = 9000
  const pos = new Float32Array(N * 3), s = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection()
    v.y = Math.abs(v.y) * 0.9 - 0.15
    v.normalize().multiplyScalar(60 + Math.random() * 10)
    pos.set([v.x, v.y, v.z], i * 3)
    s[i] = Math.random()
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  sg.setAttribute('aS', new THREE.BufferAttribute(s, 1))
  const stars = new THREE.Points(
    sg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) }, uGlow: { value: 1 } },
      vertexShader: `attribute float aS; uniform float uTime, uPR; varying float vA;
        void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.5 + aS * 2.0) + aS * 90.0))) * (0.3 + pow(aS, 3.0) * 0.9);
          gl_PointSize = (1.0 + pow(aS, 6.0) * 3.5) * uPR; }`,
      fragmentShader: `uniform float uGlow; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.92, 0.85, 1.0), smoothstep(1.0, 0.0, d) * vA * uGlow); }`,
    }),
  )
  g.add(stars)
  g.userData = {
    sky,
    stars,
    update(t) {
      sky.material.uniforms.uTime.value = t
      stars.material.uniforms.uTime.value = t
    },
  }
  return g
}
