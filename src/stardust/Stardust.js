import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createPortrait, px2w } from './portrait'
import { createSkyDust, createNight } from './sky'
import * as S from './shapes'
import * as Wd from './worlds'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const W2 = (x, y, z = 0) => { const [a, b] = px2w(x, y); return V(a, b, z) }

// landmarks on her, in world space
const FACE = W2(462, 545, 0.35)
const MOUTH = W2(450, 572, 0.4)
const NECK = W2(462, 612, 0.2)
const CHEST = W2(455, 690, 0.3)

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade; varying vec2 vUv;
    float r(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 off = (uv - 0.5) * 0.002;
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      float v = smoothstep(1.0, 0.3, length((uv - 0.5) * vec2(1.1, 1.0)));
      col *= mix(0.4, 1.0, v);
      col += (r(uv * 1000.0 + fract(uTime)) - 0.5) * 0.025;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
}

export class Stardust {
  constructor(container, { onProgress } = {}) {
    this.container = container
    this.onProgress = onProgress
    this.mobile = Math.min(innerWidth, innerHeight) < 700
    this.t = 0
    this.tweens = []
    this.ready = this.init()
  }

  async init() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }))
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 2))
    r.setSize(innerWidth, innerHeight)
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.0
    this.container.appendChild(r.domElement)
    const scene = (this.scene = new THREE.Scene())
    const cam = (this.camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 300))
    cam.position.set(0, 1, 14)
    this.look = V(0, 1, 0)
    this.onProgress?.(0.1)

    this.night = createNight()
    scene.add(this.night)
    this.her = await createPortrait({ step: this.mobile ? 1.6 : 1.05, onProgress: this.onProgress })
    scene.add(this.her)
    this.pu = this.her.userData.uniforms
    this.dust = createSkyDust(this.mobile ? 14000 : 26000, r.getPixelRatio())
    scene.add(this.dust)
    this.du = this.dust.userData.uniforms
    this.onProgress?.(0.8)

    // shapes, prepared ahead of time
    const N = this.dust.userData.N
    this.shapes = {
      home: this.dust.userData.home,
      diamond: S.diamond(N, [0, 0, 0], 0.42),
      halo: S.halo(N, [FACE.x, FACE.y + 0.05, -0.6], 0.62),
      heart: S.heart(N, [0, 1.6, -2.4], 1.7, 0.4),
      twin: S.twinHearts(N, this.dust.userData.seeds, [0, 2.6, -3], 1.25),
      name: await S.name(N, 'Ewurama', [0, 3.3, -1.5], 4.2),
      thoughts: await S.text(N, 'your thoughts', [0, 1.75, -1.2], 2.3),
      dreams: await S.text(N, 'your dreams', [0, 1.75, -1.2], 2.1),
      habits: await S.text(N, 'your little habits', [0, 1.75, -1.2], 2.6),
      you: await S.text(N, 'all that makes you, you', [0, 1.8, -1.2], 3.2),
    }

    const comp = (this.composer = new EffectComposer(r))
    comp.addPass(new RenderPass(scene, cam))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.5, 0.88)
    comp.addPass(this.bloom)
    this.grade = new ShaderPass(GRADE)
    comp.addPass(this.grade)
    comp.addPass(new OutputPass())

    this.onResize = () => {
      const portrait = innerWidth / innerHeight < 0.85
      cam.fov = portrait ? 52 : 35
      cam.aspect = innerWidth / innerHeight
      cam.updateProjectionMatrix()
      r.setSize(innerWidth, innerHeight)
      comp.setSize(innerWidth, innerHeight)
      const scale = (r.getDrawingBufferSize(new THREE.Vector2()).y / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      this.pu.uScale.value = scale
      this.du.uScale.value = scale
      this.portraitMode = portrait
    }
    addEventListener('resize', this.onResize)
    this.onResize()

    this.setScene('intro')
    this.loop = this.loop.bind(this)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
    this.onProgress?.(1)
  }

  // ── animation helpers ────────────────────────────────────────────────
  tween(u, value, dur = 2, fn = ease) {
    this.tweens = this.tweens.filter((tw) => tw.u !== u)
    if (u.value && typeof u.value.lerp === 'function') {
      this.tweens.push({ u, from: u.value.clone(), to: value.clone ? value.clone() : value, t: 0, dur, fn, obj: true })
    } else this.tweens.push({ u, from: u.value, to: value, t: 0, dur, fn })
  }
  set(map, dur = 2) {
    for (const [k, v] of Object.entries(map)) {
      const u = this.pu[k] ?? this.du[k]
      if (!u) continue
      if (dur === 0) {
        if (u.value?.copy) u.value.copy(v)
        else u.value = v
      } else this.tween(u, v, dur)
    }
  }
  // her particles become another world (or come home to her, with world(null))
  world(shape, { dur = 6, size = 3, fade = 4 } = {}) {
    if (!shape) return this.tween(this.pu.uAlt, 0, fade)
    const fresh = this.her.userData.alt(shape)
    if (fresh) this.tween(this.pu.uAlt, 1, fade, (x) => x)
    else this.tween(this.pu.uAltT, 1, dur, (x) => x)
    this.tween(this.pu.uAltSize, size, 3)
  }
  gather(name, opts) {
    this.dust.userData.to(this.shapes[name], opts)
  }
  beat() {
    this.pu.uPulse.value = 0
    this.du.uPulse.value = 1
  }

  // the resting state every scene starts from
  baseline() {
    this.set({
      uFlow: 0, uFlutter: 1, uBreath: 1, uWind: 0, uExplode: 0, uLayers: 0, uLines: 0, uSweep: -5, uRelight: 0.75, uRim: 0.6,
      uWarm: 0, uBlush: 0, uShake: 0, uWave: 0, uExposure: 1, uAltWave: 0, uAltDrift: 0, uCosmos: 0, uAltGain: 1, uTint: new THREE.Color(1, 1, 1),
      uLightCol: new THREE.Color(1.0, 0.86, 0.78), uLightPos: V(-2, 2.5, 3), uRimCol: new THREE.Color(0.62, 0.36, 1.0), uBright: 0.8, uColA: new THREE.Color(1.0, 0.78, 0.45), uColB: new THREE.Color(0.72, 0.5, 1.0),
    }, 2.5)
  }

  setScene(key) {
    const sc = SCENES[key]
    if (!sc || !this.pu) return
    this.current = sc
    this.sceneTime = 0
    this.beatIdx = 0
    this.blendFrom = { pos: this.camera.position.clone(), look: this.look.clone() }
    this.blendDur = sc.blend ?? 4
    this.baseline()
    this.tween(this.du.uSize, 0.016, 3)
    sc.enter?.(this)
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000))
    this.last = now
    this.t += dt
    this.sceneTime += dt
    const t = this.t, st = this.sceneTime
    const sc = this.current

    // beats
    while (sc.beats && this.beatIdx < sc.beats.length && st >= sc.beats[this.beatIdx][0]) sc.beats[this.beatIdx++][1](this)
    sc.update?.(this, st, dt)

    // tweens
    for (const tw of this.tweens) {
      tw.t = Math.min(1, tw.t + dt / tw.dur)
      const k = tw.fn(tw.t)
      if (tw.obj) tw.u.value.copy(tw.from).lerp(tw.to, k)
      else tw.u.value = tw.from + (tw.to - tw.from) * k
    }
    this.tweens = this.tweens.filter((tw) => tw.t < 1)

    // heartbeats decay
    this.pu.uPulse.value = Math.min(1, this.pu.uPulse.value + dt * 0.8)
    this.du.uPulse.value *= Math.pow(0.02, dt)

    // camera: blend from the last shot into this one
    const shot = sc.cam(this, st)
    const k = ease(Math.min(1, st / this.blendDur))
    const pos = this.blendFrom.pos.clone().lerp(shot.pos, k)
    const look = this.blendFrom.look.clone().lerp(shot.look, k)
    if (this.portraitMode) {
      pos.z += shot.pz ?? 2.2
      // on a tall phone the captions own the bottom third: lift the picture into the top of the frame
      const lift = shot.lift ?? Math.min(0.9, pos.distanceTo(look) * 0.12)
      pos.y -= lift
      look.y -= lift
    }
    this.camera.position.copy(pos)
    this.look.copy(look)
    this.camera.lookAt(look)


    this.pu.uTime.value = t
    this.dust.userData.update(dt, t)
    this.night.userData.update(t)
    const g = this.grade.uniforms
    g.uTime.value = t
    g.uFade.value += ((this.fadeTarget ?? 1) - g.uFade.value) * Math.min(1, dt * 0.7)
    this.composer.render()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.onResize)
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
  }
}

// ── The film ───────────────────────────────────────────────────────────────
// Every scene: what the stardust does as the words arrive, and how the camera sees it.
const orbit = (c, r, a, h) => V(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r)

const SCENES = {
  // the envelope: a galaxy turning slowly in the dark — she is in there, somewhere
  intro: {
    blend: 0.01,
    enter(w) {
      w.set({ uAssemble: 0 }, 0)
      w.grade.uniforms.uFade.value = 0
      w.gather('home', { wander: 1, dur: 3 })
    },
    cam: (w, t) => ({ pos: V(Math.sin(t * 0.03) * 3, 4.5, 16 - Math.min(t, 40) * 0.05), look: V(0, 1, -6), parallax: 2 }),
  },

  // 01 — a diamond, found where I never thought to look: born out of a turning galaxy
  0: {
    blend: 7,
    enter(w) {
      w.world(null, { fade: 3 })
      w.set({ uAssemble: 0 }, 4)
      const c = V(0, 1.15, 0.5)
      w.shapes.diamond = S.diamond(w.dust.userData.N, [c.x, c.y, c.z], 0.85)
      w.gather('diamond', { spin: 0.3, center: c, dur: 6 })
      w.tween(w.du.uSize, 0.024, 3)
      w.set({ uBright: 1.1, uColA: C(0.85, 0.9, 1.0), uColB: C(0.9, 0.7, 1.0) }, 3)
    },
    beats: [[8, (w) => w.set({ uBright: 1.5 }, 4)]],
    cam: (w, t) => {
      const a = ease(Math.min(1, t / 20))
      return { pos: V(Math.sin(t * 0.06) * 1.2, 2.6 - a * 1.2, 12 - a * 7), look: V(0, 1.1, -2 + a * 2), pz: 2.5 }
    },
  },

  // 02 — your cheeks: she softens into a sky of fluffy rose clouds, and the moon smiles
  1: {
    blend: 6,
    enter(w) {
      const n = w.her.userData.count
      w.world(Wd.clouds(n), { size: 2.2, fade: 6 })
      w.set({ uAltA: C(1.0, 0.42, 0.62), uAltB: C(1.0, 0.68, 0.55), uAltY: new THREE.Vector2(-1, 4), uAltDrift: 0.5, uBright: 1.0, uColA: C(1.0, 0.9, 0.7), uColB: C(1.0, 0.8, 0.85) }, 4)
      w.dust.userData.to(Wd.smileMoon(w.dust.userData.N, [0, 3.7, -15], 1.7), { dur: 6 })
    },
    cam: (w, t) => ({ pos: V(Math.sin(t * 0.07) * 0.6, 1.0 + Math.sin(t * 0.1) * 0.15, 7 - Math.min(t, 30) * 0.12), look: V(0, 1.8, -15), pz: 1 }),
  },

  // 03 — your neck: the clouds unspool into ribbons of silk — the grace of a line
  2: {
    blend: 5,
    enter(w) {
      w.world(Wd.ribbons(w.her.userData.count), { size: 1.7, dur: 6, fade: 6 })
      w.set({ uAltWave: 1, uAltA: C(0.72, 0.4, 1.0), uAltB: C(1.0, 0.68, 0.32), uAltY: new THREE.Vector2(-0.6, 2.6), uBright: 0.45 }, 4)
      w.gather('home', { wander: 1, dur: 5 })
    },
    cam: (w, t) => ({ pos: V(-1.6 + Math.min(t, 30) * 0.08, 1.15, 6.8), look: V(0, 0.9, -1.5), pz: 2.5 }),
  },

  // 04 — your smile: warmth like a sunrise, lifting out of a still sea
  3: {
    blend: 5,
    enter(w) {
      w.world(Wd.sunrise(w.her.userData.count), { size: 1.6, fade: 7, dur: 7 })
      w.set({ uAltA: C(1.0, 0.72, 0.36), uAltB: C(1.0, 0.5, 0.42), uAltY: new THREE.Vector2(-1.6, 3), uAltGain: 1.8, uBright: 0.7, uColA: C(1.0, 0.8, 0.5), uColB: C(1.0, 0.65, 0.75) }, 4)
      w.gather('home', { wander: 1, dur: 5 })
      w.night.userData.sky.material.uniforms.uTint.value.set(1, 1, 1)
    },
    cam: (w, t) => ({ pos: V(Math.sin(t * 0.05) * 0.4, 0.55 + Math.min(t, 24) * 0.012, 7.5 - Math.min(t, 24) * 0.08), look: V(0, 0.7, -14), pz: 2 }),
  },

  // 05 — beyond the beauty: an open book of stars — the story of you — and the words rise from its pages
  4: {
    blend: 5,
    enter(w) {
      w.world(Wd.book(w.her.userData.count), { size: 1.3, fade: 6, dur: 6 })
      w.set({ uAltA: C(0.9, 0.8, 1.0), uAltB: C(1.0, 0.82, 0.55), uAltY: new THREE.Vector2(-0.6, 0.2), uAltGain: 0.9, uBright: 1.1, uColA: C(1.0, 0.85, 0.6), uColB: C(0.8, 0.65, 1.0) }, 4)
      w.gather('thoughts', { dur: 3.5 })
    },
    beats: [
      [5.5, (w) => w.gather('dreams', { dur: 3.5 })],
      [10, (w) => w.gather('habits', { dur: 3.5 })],
      [14.5, (w) => w.gather('you', { dur: 4 })],
    ],
    cam: (w, t) => ({ pos: V(Math.sin(t * 0.05) * 0.8, 3.6 - Math.min(t, 22) * 0.02, 9 - Math.min(t, 22) * 0.06), look: V(0, 0.2, -1.2), pz: 1.5 }),
  },

  // 06 — taking a chance: her light becomes a bridge, built one step at a time across the dark, toward the moon
  5: {
    blend: 5,
    enter(w) {
      w.world(Wd.bridge(w.her.userData.count), { size: 1.4, fade: 12, dur: 10 })
      w.set({ uAltA: C(1.0, 0.8, 0.5), uAltB: C(0.9, 0.7, 1.0), uAltY: new THREE.Vector2(-1.2, 4), uBright: 2.4, uColA: C(1.0, 0.95, 0.85), uColB: C(0.95, 0.88, 1.0) }, 3)
      w.dust.userData.to(Wd.moonDisk(w.dust.userData.N, [1.1, 4.5, -31], 3.2), { dur: 7 })
    },
    cam: (w, t) => {
      const a = Math.min(0.62, Math.max(0, (t - 3) / 30))
      const P = Wd.bridgePoint(a), L = Wd.bridgePoint(Math.min(1, a + 0.3))
      return { pos: V(P[0], P[1] + 2.4, P[2] + 4.2), look: V(L[0], L[1] + 1.6, L[2] - 4), pz: 1.5 }
    },
  },

  // 07 — the little things: an aurora of every feeling… then rain, and an umbrella held over us both
  6: {
    blend: 5,
    enter(w) {
      w.world(Wd.aurora(w.her.userData.count), { size: 1.3, fade: 6, dur: 6 })
      w.set({ uAltGain: 2.6, uAltWave: 0.6, uAltY: new THREE.Vector2(2.4, 7.5), uAltA: C(0.8, 0.6, 1.0), uAltB: C(0.6, 0.8, 1.0), uBright: 0.4 }, 3)
      w.gather('home', { wander: 1, dur: 5 })
    },
    beats: [
      // happiness
      [2.6, (w) => w.set({ uAltA: C(1.0, 0.85, 0.4), uAltB: C(1.0, 0.62, 0.3) }, 1.5)],
      // anger
      [5.0, (w) => w.set({ uAltA: C(1.0, 0.22, 0.18), uAltB: C(0.8, 0.1, 0.25), uAltWave: 1.8 }, 0.7)],
      // random conversations
      [6.8, (w) => w.set({ uAltA: C(0.45, 0.9, 1.0), uAltB: C(1.0, 0.6, 0.95), uAltWave: 1.0 }, 1.2)],
      // laughter
      [9.0, (w) => { w.set({ uAltA: C(1.0, 0.75, 0.92), uAltB: C(1.0, 0.92, 0.55), uBright: 1.2 }, 0.8); w.beat() }],
      [9.5, (w) => w.beat()],
      [10.0, (w) => w.beat()],
      // quiet moments
      [11.5, (w) => w.set({ uAltA: C(0.35, 0.45, 1.0), uAltB: C(0.55, 0.45, 0.9), uAltWave: 0.2, uBright: 0.3 }, 2.5)],
      // the difficult days: rain
      [14, (w) => { w.world(Wd.storm(w.her.userData.count, 0), { size: 0.9, dur: 4 }); w.set({ uRainCol: C(0.45, 0.6, 1.0), uAltWave: 0, uAltGain: 1.6 }, 2) }],
      // …and an umbrella, with a little heart beneath it
      [18, (w) => {
        w.world(Wd.storm(w.her.userData.count, 0.22), { size: 0.9, dur: 5 })
        w.set({ uAltA: C(1.0, 0.72, 0.5), uAltB: C(1.0, 0.58, 0.85), uAltY: new THREE.Vector2(-0.6, 2.7), uRainCol: C(0.85, 0.72, 1.0), uAltGain: 2.2, uBright: 1.2, uColA: C(1.0, 0.6, 0.8), uColB: C(1.0, 0.75, 0.6) }, 4)
        w.dust.userData.to(S.heart(w.dust.userData.N, [0, 0.55, -1], 0.55, 0.15), { dur: 5 })
      }],
    ],
    cam: (w, t) => {
      const k = Math.min(1, Math.max(0, (t - 13) / 5))
      return { pos: V(Math.sin(t * 0.05) * 0.8, 0.9 + k * 0.6, 8 - Math.min(t, 24) * 0.06), look: V(0, 3.4 - k * 2.4, -5 + k * 3.8), pz: 3 }
    },
  },

  // 08 — a team: two strands of light rise, winding around each other… and become one heart
  7: {
    blend: 5,
    enter(w) {
      w.world(Wd.helix(w.her.userData.count), { size: 1.6, fade: 6, dur: 6 })
      w.set({ uAltA: C(1.0, 0.8, 0.45), uAltB: C(0.75, 0.5, 1.0), uAltY: new THREE.Vector2(-2.2, 5), uAltDrift: 0.1, uBright: 0.5 }, 3)
      w.gather('home', { wander: 1, dur: 5 })
    },
    beats: [
      [10, (w) => {
        w.world(Wd.bigHeart(w.her.userData.count), { size: 1.4, dur: 6 })
        w.set({ uAltA: C(1.0, 0.5, 0.72), uAltB: C(1.0, 0.75, 0.6), uAltY: new THREE.Vector2(-0.6, 3.6), uBright: 1.0 }, 5)
      }],
    ],
    cam: (w, t) => ({ pos: orbit(V(0, 1.4, -1.5), 8.5, -0.35 + Math.min(t, 26) * 0.025, 0.3), look: V(0, 1.5, -1.5), pz: 3 }),
  },

  // the question: her, the heart behind her, beating
  question: {
    blend: 5,
    enter(w) {
      w.world(null, { fade: 4 })
      w.set({ uAssemble: 0 }, 0)
      w.set({ uWarm: 0.25, uRelight: 0.85, uLightPos: V(0, 2.2, 3), uColA: C(1.0, 0.55, 0.75), uColB: C(0.85, 0.45, 1.0), uBright: 1.15, uExposure: 0.95 }, 3)
      w.dust.userData.to(S.heart(w.dust.userData.N, [0, 1.25, -2.2], 2.1, 0.5), { dur: 5 })
      w.du.uPulseC.value.set(0, 1.25, -2.2)
    },
    // the reveal: for the first time, out of all that light — you
    beats: [[2.5, (w) => w.tween(w.pu.uAssemble, 1, 9)]],
    cam: (w, t) => ({ pos: V(0, 1.15, 7.2 - Math.min(t, 30) * 0.03), look: V(0, 1.15, 0), pz: 6, lift: 2.6 }),
  },

  // yes: she bursts into fireworks of light, and the sky writes her name
  yes: {
    blend: 3,
    enter(w) {
      w.world(null, { fade: 1 })
      w.set({ uAssemble: 1 }, 0)
      w.tween(w.pu.uExplode, 1, 2.2, (x) => 1 - Math.pow(1 - x, 3))
      w.set({ uColA: C(1.0, 0.8, 0.5), uColB: C(1.0, 0.6, 0.95), uBright: 1.4 }, 1)
      w.gather('name', { dur: 5 })
    },
    beats: [
      [3.2, (w) => w.tween(w.pu.uExplode, 0, 6)],
      [9.5, (w) => w.set({ uWarm: 0.45 }, 3)],
    ],
    cam: (w, t) => ({ pos: V(Math.sin(t * 0.06) * 1.5, 1.6, 10.5), look: V(0, 1.6, -1), pz: 3.5 }),
  },
}

function C(r, g, b) {
  return new THREE.Color(r, g, b)
}
