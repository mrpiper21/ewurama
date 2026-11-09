import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  MOON_DIR, FOG_COLOR, shoreZ, heightAt,
  createSky, createTerrain, createMountains, createMeadow, createTree, createPetals, createLanterns, glowTexture, createCastle,
} from './nature'
import { createFireflies, createDust, heartPoints, namePoints } from './fireflies'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const ground = (x, z, lift = 0) => V(x, heightAt(x, z) + lift, z)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// ── The places in our little film ───────────────────────────────────────────
const A = ground(1.2, shoreZ(1.2) + 1.7) // her spot by the water
const TREE = ground(7.5, shoreZ(7.5) + 3.6)
const U = ground(TREE.x - 0.6, TREE.z + 2.3) // under the jacaranda
const PATH1 = new THREE.CatmullRomCurve3([ground(-10, 15), ground(-7, 10.5), ground(-3.5, 7.5), ground(-1.2, 4), ground(0.2, 1), A])
const PATH2 = new THREE.CatmullRomCurve3([A, ground(3.2, shoreZ(3.2) + 1.6), ground(5.2, shoreZ(5.2) + 2.2), U])

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade; varying vec2 vUv;
    float r(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // a breath of chromatic aberration toward the edges, like a real lens
      vec2 off = (uv - 0.5) * 0.0025;
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      float v = smoothstep(0.95, 0.25, length((uv - 0.5) * vec2(1.15, 1.0)));
      col *= mix(0.45, 1.0, v);
      // grade: lift shadows toward violet, keep highlights warm
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += vec3(0.012, 0.004, 0.025) * (1.0 - smoothstep(0.0, 0.3, l));
      col += (r(uv * 1000.0 + fract(uTime)) - 0.5) * 0.03;
      col *= uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
}

export class World {
  constructor(container, { onProgress } = {}) {
    this.container = container
    this.onProgress = onProgress
    this.mobile = Math.min(innerWidth, innerHeight) < 700
    this.clock = { last: performance.now(), t: 0 }
    this.sceneTime = 0
    this.current = null
    this.ready = this.init()
  }

  async init() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75))
    r.setSize(innerWidth, innerHeight)
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.05
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(r.domElement)

    const scene = (this.scene = new THREE.Scene())
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.022)
    const cam = (this.camera = new THREE.PerspectiveCamera(this.mobile ? 50 : 38, innerWidth / innerHeight, 0.05, 900))
    cam.position.set(-14, 9, 24)
    this.look = V(0, 1, -10)

    // ── load everything we downloaded ─────────────────────────────
    const manager = new THREE.LoadingManager()
    manager.onProgress = (_, loaded, total) => this.onProgress?.(loaded / total)
    const gltf = new GLTFLoader(manager)
    const [michelle, xbot, flamingo, stork, parrot, horse, flower, hdr, normals] = await Promise.all([
      gltf.loadAsync('/models/Michelle.glb'),
      gltf.loadAsync('/models/Xbot.glb'),
      gltf.loadAsync('/models/Flamingo.glb'),
      gltf.loadAsync('/models/Stork.glb'),
      gltf.loadAsync('/models/Parrot.glb'),
      gltf.loadAsync('/models/Horse.glb'),
      gltf.loadAsync('/models/Flower.glb'),
      new HDRLoader(manager).loadAsync('/hdri/moonrise_1k.hdr'),
      new THREE.TextureLoader(manager).loadAsync('/models/waternormals.jpg'),
    ])

    // image-based light from a real moonrise sky (Poly Haven, CC0)
    const pmrem = new THREE.PMREMGenerator(r)
    hdr.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = pmrem.fromEquirectangular(hdr).texture
    scene.environmentIntensity = 0.32
    hdr.dispose()

    // ── light ──────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight('#5a4a86', '#120a1a', 0.4))
    const moon = (this.moonLight = new THREE.DirectionalLight('#c9b8ff', 2.1))
    moon.castShadow = true
    moon.shadow.mapSize.set(2048, 2048)
    const sc = moon.shadow.camera
    sc.left = sc.bottom = -7
    sc.right = sc.top = 7
    sc.near = 1
    sc.far = 80
    moon.shadow.bias = -0.0004
    moon.shadow.normalBias = 0.02
    scene.add(moon, moon.target)
    this.keyLight = new THREE.PointLight('#ffe4d4', 2.4, 7, 1.6) // the cinematographer's soft key
    scene.add(this.keyLight)

    // ── land, water, sky ───────────────────────────────────────────
    this.sky = createSky()
    scene.add(this.sky)
    scene.add(createTerrain())
    scene.add(createMountains())
    const castle = createCastle()
    castle.position.set(-38, 0, -95)
    castle.rotation.y = 0.35
    castle.scale.setScalar(1.6)
    scene.add(castle)
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    this.water = new Water(new THREE.PlaneGeometry(700, 700), {
      textureWidth: this.mobile ? 256 : 512,
      textureHeight: this.mobile ? 256 : 512,
      waterNormals: normals,
      sunDirection: MOON_DIR.clone(),
      sunColor: 0xe6d6ff,
      waterColor: 0x0b0720,
      distortionScale: 1.6,
      fog: true,
    })
    this.water.rotation.x = -Math.PI / 2
    this.water.position.set(0, -0.1, -150)
    this.water.material.uniforms.size.value = 3.2
    scene.add(this.water)

    this.meadow = createMeadow()
    scene.add(this.meadow)

    this.tree = createTree()
    this.tree.position.copy(TREE)
    this.tree.rotation.y = 0.6
    scene.add(this.tree)
    this.petals = createPetals(V(TREE.x, 0, TREE.z), this.mobile ? 260 : 520)
    scene.add(this.petals)

    // glowing blossoms scattered through the grass (three.js Flower model)
    this.addFlowers(flower)

    this.lanterns = createLanterns(110)
    scene.add(this.lanterns)

    const glow = glowTexture()
    this.fireflies = createFireflies(glow)
    scene.add(this.fireflies)

    // ── the little light: his heart, quietly following her ─────────
    this.orb = new THREE.Group()
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2.4, 1.6, 3.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    halo.scale.setScalar(0.9)
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(6, 5, 6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    core.scale.setScalar(0.18)
    this.orbLight = new THREE.PointLight('#e2b8ff', 0, 6, 1.5)
    this.orb.add(halo, core, this.orbLight)
    this.orb.position.set(-30, 6, -40)
    this.orbTarget = this.orb.position.clone()
    this.orbPower = 0
    scene.add(this.orb)
    this.dust = createDust(glow)
    scene.add(this.dust)

    // ── her ────────────────────────────────────────────────────────
    this.setupHer(michelle, xbot)

    // ── creatures ──────────────────────────────────────────────────
    this.mixers = []
    this.flamingos = this.flock(flamingo, 7, 1.5)
    this.storks = this.flock(stork, 4, 1.6)
    this.parrots = this.flock(parrot, 10, 0.55)
    this.horse = this.creature(horse, 2.6)
    this.horse.visible = false
    this.flights = []

    // ── post-processing: a real lens, bloom and film ───────────────
    const comp = (this.composer = new EffectComposer(r))
    comp.addPass(new RenderPass(scene, cam))
    if (!this.mobile) {
      this.bokeh = new BokehPass(scene, cam, { focus: 8, aperture: 0.0018, maxblur: 0.007 })
      comp.addPass(this.bokeh)
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.75, 0.6, 0.82)
    comp.addPass(this.bloom)
    this.grade = new ShaderPass(GRADE)
    comp.addPass(this.grade)
    comp.addPass(new OutputPass())

    this.name = await namePoints('Ewurama', V(A.x - 0.6, 6.6, A.z - 12), 6.5)
    this.heart = heartPoints(V(U.x + 0.9, 4.3, U.z - 7), 1.8)

    this.onResize = () => {
      cam.aspect = innerWidth / innerHeight
      cam.fov = innerWidth / innerHeight < 0.8 ? 56 : this.mobile ? 50 : 38
      cam.updateProjectionMatrix()
      r.setSize(innerWidth, innerHeight)
      comp.setSize(innerWidth, innerHeight)
    }
    addEventListener('resize', this.onResize)
    this.onResize()
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 }
    this.onMove = (e) => {
      const p = e.touches ? e.touches[0] : e
      this.pointer.x = p.clientX / innerWidth - 0.5
      this.pointer.y = p.clientY / innerHeight - 0.5
    }
    addEventListener('pointermove', this.onMove)

    this.setScene('intro')
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
    this.onProgress?.(1)
  }

  addFlowers(gltf) {
    const blossom = gltf.scene.getObjectByName('Blossom')
    const stem = gltf.scene.getObjectByName('Stem')
    if (!blossom || !stem) return
    const count = 420
    const bMat = new THREE.MeshStandardMaterial({ color: '#ffd6f6', emissive: '#c45ad8', emissiveIntensity: 1.4, roughness: 0.5 })
    const sMat = new THREE.MeshStandardMaterial({ color: '#1f3a2c', roughness: 0.9 })
    const b = new THREE.InstancedMesh(blossom.geometry, bMat, count)
    const s = new THREE.InstancedMesh(stem.geometry, sMat, count)
    const box = new THREE.Box3().setFromBufferAttribute(stem.geometry.attributes.position)
    const scale = 0.32 / (box.max.y - box.min.y || 1)
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let n = 0
    while (n < count) {
      const x = (Math.random() - 0.5) * 40
      const z = -4 + Math.random() * 24
      if (z - shoreZ(x) < 0.8) continue
      d.position.set(x, heightAt(x, z), z)
      d.rotation.set(0, Math.random() * 6.28, (Math.random() - 0.5) * 0.3)
      d.scale.setScalar(scale * (0.7 + Math.random() * 0.8))
      d.updateMatrix()
      b.setMatrixAt(n, d.matrix)
      s.setMatrixAt(n, d.matrix)
      b.setColorAt(n, c.setHSL(0.8 + Math.random() * 0.15, 0.8, 0.75))
      n++
    }
    this.scene.add(b, s)
  }

  setupHer(michelle, xbot) {
    const model = michelle.scene
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
        if (o.material) {
          const m = o.material
          m.envMapIntensity = 0.7
          m.metalness = 0
          // a soft, matte storybook finish instead of plastic shine
          m.roughnessMap = null
          m.metalnessMap = null
          m.roughness = 0.72
          if ('specularIntensity' in m) m.specularIntensity = 0.35
          if ('clearcoat' in m) m.clearcoat = 0
          // dress her in her favourite colour: yellows in the outfit become violet
          m.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader
              .replace('#include <common>', '#include <common>\nattribute float aHead;\nvarying float vHead;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHead = aHead;')
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHead;')
            sh.fragmentShader = sh.fragmentShader.replace(
              '#include <map_fragment>',
              `#include <map_fragment>
              {
                vec3 c = diffuseColor.rgb;
                if (vHead > 0.5) {
                  bool red = (c.r > 0.12 && c.r > 4.0 * c.g && c.r > 4.0 * c.b) || (c.r > 0.55 && c.g < 0.62 * c.r && c.b < 0.62 * c.r && abs(c.g - c.b) < 0.12);
                  bool white = c.r > 0.35 && c.g > 0.35 && c.b > 0.35;
                  bool cyan = c.g > 0.25 && c.b > 0.25 && c.r < 0.2;
                  bool gold = c.r > 0.35 && c.g > 0.2 && c.b < 0.4 * c.g;
                  if (red || white || cyan || gold) discard;
                }
                float yellow = smoothstep(0.5, 0.65, c.g / max(c.r, 1e-3)) * smoothstep(0.35, 0.18, c.b / max(c.g, 1e-3)) * smoothstep(0.15, 0.3, c.r);
                float l = dot(c, vec3(0.3, 0.59, 0.11));
                diffuseColor.rgb = mix(c, vec3(l * 0.62, l * 0.22, l * 1.25), yellow);
              }`,
            )
          }
        }
      }
    })
    // Xbot's clips come from a rig with a different rest pose (Y-up, identity bones),
    // so we retarget them through world space onto her skeleton.
    const skinOf = (root) => {
      let m = null
      root.traverse((o) => { if (!m && o.isSkinnedMesh) m = o })
      return m
    }
    const tgt = skinOf(model)
    const src = skinOf(xbot.scene)
    this.stripAccessories(tgt)
    xbot.scene.updateMatrixWorld(true)
    model.updateMatrixWorld(true)
    const clip = (list, name) => list.find((c) => c.name === name)
    // world-space retarget: target_local = Pt⁻¹·Ps · src_local · Ws⁻¹·Wt  (both rigs in their loaded rest pose)
    xbot.scene.updateMatrixWorld(true)
    model.updateMatrixWorld(true)
    const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion())
    const maps = {}
    for (const sb of src.skeleton.bones) {
      const tb = tgt.skeleton.bones.find((b) => b.name === sb.name)
      if (!tb) continue
      const A = wq(tb.parent).invert().multiply(wq(sb.parent))
      const B = wq(sb).invert().multiply(wq(tb))
      maps[sb.name] = { A, B }
    }
    const retarget = (c) => {
      const out = c.clone()
      const q = new THREE.Quaternion()
      out.tracks = out.tracks.filter((t) => {
        const [bone, prop] = t.name.split('.')
        if (prop !== 'quaternion' || !maps[bone]) return false
        const { A, B } = maps[bone]
        const v = t.values
        for (let i = 0; i < v.length; i += 4) {
          q.fromArray(v, i)
          q.premultiply(A).multiply(B)
          q.toArray(v, i)
        }
        return true
      })
      return out
    }
    const idle = retarget(clip(xbot.animations, 'idle'))
    const walk = retarget(clip(xbot.animations, 'walk'))
    const agree = retarget(clip(xbot.animations, 'agree'))
    const shake = retarget(clip(xbot.animations, 'headShake'))
    // her own samba, with the hips kept centred so she dances on the spot
    const samba = clip(michelle.animations, 'SambaDance').clone()
    samba.tracks = samba.tracks.filter((t) => !t.name.endsWith('.scale'))
    // her hips' parent space is Z-up: pin x/y so she dances on the spot, keep the vertical bounce
    samba.tracks.forEach((t) => {
      if (!t.name.endsWith('Hips.position')) return
      const v = t.values
      for (let i = 0; i < v.length; i += 3) {
        v[i] = v[0]
        v[i + 1] = v[1]
      }
    })

    // measure her standing height from the skeleton itself (bind pose)
    const bw = (n) => tgt.skeleton.bones.find((b) => b.name === 'mixamorig' + n).getWorldPosition(new THREE.Vector3())
    const tall = bw('HeadTop_End').y - Math.min(bw('LeftToe_End').y, bw('LeftFoot').y - 0.08 * (bw('HeadTop_End').y - bw('Hips').y))
    model.scale.multiplyScalar(1.66 / tall)
    model.position.y -= Math.min(bw('LeftToe_End').y, 0) * (1.66 / tall)
    const her = (this.her = new THREE.Group())
    her.add(model)
    this.scene.add(her)
    this.herYaw = 0

    this.neckBone = tgt.skeleton.bones.find((b) => b.name === 'mixamorigNeck')
    this.headBone = tgt.skeleton.bones.find((b) => b.name === 'mixamorigHead')
    this.spineBone = tgt.skeleton.bones.find((b) => b.name === 'mixamorigSpine2')
    this.gaze = { yaw: 0, pitch: 0, roll: 0 }
    this.emotion = { look: null, down: 0, tilt: 0, weight: 0 }
    const mixer = (this.herMixer = new THREE.AnimationMixer(model))
    this.actions = {
      idle: mixer.clipAction(idle),
      walk: mixer.clipAction(walk),
      samba: mixer.clipAction(samba),
    }
    for (const [n, c] of [['agree', agree], ['headShake', shake]]) {
      THREE.AnimationUtils.makeClipAdditive(c)
      const a = mixer.clipAction(c)
      a.blendMode = THREE.AdditiveAnimationBlendMode
      a.setLoop(THREE.LoopOnce, 1)
      this.actions[n] = a
    }
    this.actions.walk.timeScale = 0.92
    this.base = 'idle'
    this.actions.idle.play()
  }

  // Her model ships with headphones and heart sunglasses. For a fairy tale we take them off:
  // drop head-bound triangles whose texels are the accessories' red / white / cyan / gold.
  stripAccessories(mesh) {
    const g = mesh.geometry
    // mark vertices bound to the head; the shader then hides accessory-coloured texels there
    const head = new Set()
    mesh.skeleton.bones.forEach((b, i) => /Head/.test(b.name) && head.add(i))
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight
    const h = new Float32Array(si.count)
    for (let v = 0; v < si.count; v++) {
      let w = 0
      for (let k = 0; k < 4; k++) if (head.has(si.getComponent(v, k))) w += sw.getComponent(v, k)
      h[v] = w
    }
    g.setAttribute('aHead', new THREE.BufferAttribute(h, 1))
    this.hideAccessories = true
  }

  // ── Emotion: where she looks, how she holds her head ──────────────────────
  // look: Vector3 | () => Vector3 | 'camera' | 'orb' | null ; down: + lowers her gaze (shy), - lifts it ; tilt: head tilt
  emote(e) {
    this.emotion ??= {}
    Object.assign(this.emotion, { look: null, down: 0, tilt: 0, weight: 1 }, e)
  }

  applyEmotion(dt) {
    const e = this.emotion
    const head = this.headBone
    if (!head) return
    let want = { yaw: 0, pitch: 0 }
    let target = typeof e.look === 'function' ? e.look() : e.look === 'camera' ? this.camera.position : e.look === 'orb' ? this.orb.position : e.look
    if (target) {
      const hp = head.getWorldPosition(new THREE.Vector3())
      const d = target.clone().sub(hp)
      const local = d.applyQuaternion(this.her.getWorldQuaternion(new THREE.Quaternion()).invert())
      want.yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1)
      want.pitch = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.6, 0.5)
    }
    want.pitch += e.down
    const k = 1 - Math.exp(-dt * 2.2) // soft, human easing
    const g = this.gaze
    g.yaw += (want.yaw * e.weight - g.yaw) * k
    g.pitch += (want.pitch * e.weight - g.pitch) * k
    g.roll += (e.tilt - g.roll) * k
    const rootQ = this.her.getWorldQuaternion(new THREE.Quaternion())
    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(g.pitch, g.yaw, g.roll, 'YXZ'))
    const share = [
      [this.spineBone, 0.15],
      [this.neckBone, 0.35],
      [head, 0.5],
    ]
    for (const [b, f] of share) {
      if (!b) continue
      const part = new THREE.Quaternion().slerp(delta, f)
      const parentQ = b.parent.getWorldQuaternion(new THREE.Quaternion())
      // express the root-space rotation in the bone's parent space
      const inParent = parentQ.clone().invert().multiply(rootQ).multiply(part).multiply(rootQ.clone().invert()).multiply(parentQ)
      b.quaternion.premultiply(inParent)
      b.updateMatrixWorld(true)
    }
  }

  pose(name, fade = 0.8) {
    if (this.base === name) return
    const from = this.actions[this.base]
    const to = this.actions[name]
    to.reset().setEffectiveWeight(1).play()
    if (name === 'walk' && this.base === 'idle') to.syncWith?.(to)
    from.crossFadeTo(to, fade, true)
    this.base = name
  }

  gesture(name, weight = 1) {
    const a = this.actions[name]
    if (!a) return
    a.reset().setEffectiveWeight(weight).play()
  }

  flock(gltf, count, span) {
    const src = gltf.scene.children.find((c) => c.isMesh) || gltf.scene.getObjectByProperty('isMesh', true)
    src.geometry.computeBoundingBox()
    const bb = src.geometry.boundingBox
    const k = span / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
    const birds = []
    for (let i = 0; i < count; i++) {
      const m = src.clone()
      m.material = src.material.clone()
      m.material.color = new THREE.Color('#e9d6ff')
      m.material.emissive = new THREE.Color('#2a1640')
      m.scale.setScalar(k * (0.85 + Math.random() * 0.3))
      m.visible = false
      const mixer = new THREE.AnimationMixer(m)
      const a = mixer.clipAction(gltf.animations[0])
      a.time = Math.random()
      a.timeScale = 0.75 + Math.random() * 0.2
      a.play()
      this.mixers.push(mixer)
      this.scene.add(m)
      birds.push({ mesh: m, off: V((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 5), ph: Math.random() * 6 })
    }
    return birds
  }

  creature(gltf, length) {
    const m = gltf.scene.children.find((c) => c.isMesh)
    m.geometry.computeBoundingBox()
    const bb = m.geometry.boundingBox
    m.scale.setScalar(length / (bb.max.z - bb.min.z))
    m.material = m.material.clone()
    m.material.color = new THREE.Color('#f2ecff')
    m.material.emissive = new THREE.Color('#251836')
    m.castShadow = true
    const mixer = new THREE.AnimationMixer(m)
    mixer.clipAction(gltf.animations[0]).play()
    this.mixers.push(mixer)
    this.scene.add(m)
    return m
  }

  // birds glide across the sky along a gentle arc
  fly(birds, from, to, duration, delay = 0) {
    this.flights.push({ birds, from, to, duration, t: -delay })
  }

  // ── Scenes ───────────────────────────────────────────────────────────────
  setScene(id) {
    this.current = SCENES[id]
    this.sceneId = id
    this.sceneTime = 0
    this.blendFrom = { pos: this.camera.position.clone(), look: this.look.clone() }
    this.blendDur = this.current.blend ?? 3.2
    this.beat = 0
    this.emote({ look: null })
    this.current.enter?.(this)
  }

  place(p, yaw) {
    this.her.position.copy(p)
    this.herYaw = yaw
    this.walking = null
  }

  walk(curve, speed = 1.05, then) {
    this.walking = { curve, u: 0, len: curve.getLength(), speed, then }
    this.pose('walk', 0.6)
  }

  orbTo(p, power = 1) {
    this.orbTarget.copy(p)
    this.orbPower = power
  }

  fadeIn() {
    this.fadeTarget = 1
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.clock.last) / 1000, 1 / 20)
    this.clock.last = now
    const t = (this.clock.t += dt)
    this.sceneTime += dt
    const st = this.sceneTime

    // her motion
    if (this.walking) {
      const w = this.walking
      w.u = Math.min(1, w.u + (w.speed * dt) / w.len)
      const p = w.curve.getPointAt(w.u)
      p.y = heightAt(p.x, p.z)
      this.her.position.copy(p)
      const tan = w.curve.getTangentAt(Math.min(w.u, 0.999))
      this.herYaw = Math.atan2(tan.x, tan.z)
      if (w.u >= 1) {
        this.walking = null
        this.pose('idle', 1)
        w.then?.()
      }
    }
    let dy = this.herYaw - this.her.rotation.y
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    this.her.rotation.y += dy * Math.min(1, dt * 2.2)
    this.herMixer.update(dt)
    this.her.updateMatrixWorld(true)
    this.applyEmotion(dt)
    this.mixers.forEach((m) => m.update(dt))

    const beats = this.current.beats
    while (beats && this.beat < beats.length && st >= beats[this.beat][0]) beats[this.beat++][1](this)
    this.current.update?.(this, st, dt)

    // the orb floats with a lazy, living drift
    const wob = V(Math.sin(t * 0.9) * 0.18, Math.sin(t * 1.3) * 0.12, Math.cos(t * 0.7) * 0.18)
    this.orb.position.lerp(this.orbTarget.clone().add(wob), Math.min(1, dt * 1.1))
    this.orbLight.intensity += (this.orbPower * 5 - this.orbLight.intensity) * Math.min(1, dt * 1.5)
    this.orb.visible = this.orbLight.intensity > 0.05
    this.orb.children[0].material.opacity = Math.min(1, this.orbLight.intensity / 4)
    this.orb.children[1].material.opacity = Math.min(1, this.orbLight.intensity / 4)

    // flights
    for (const f of this.flights) {
      f.t += dt
      const k = f.t / f.duration
      f.birds.forEach((b) => {
        b.mesh.visible = k > 0 && k < 1
        if (!b.mesh.visible) return
        const p = f.from.clone().lerp(f.to, k).add(b.off)
        p.y += Math.sin(k * Math.PI) * 2 + Math.sin(t * 1.2 + b.ph) * 0.15
        b.mesh.position.copy(p)
        const dir = f.to.clone().sub(f.from)
        b.mesh.rotation.y = Math.atan2(dir.x, dir.z)
      })
    }
    this.flights = this.flights.filter((f) => f.t < f.duration)

    // world life
    const mu = this.meadow.userData.uniforms
    mu.uTime.value = t
    mu.uWalker.value.copy(this.her.position)
    mu.uOrb.value.copy(this.orb.position)
    mu.uOrbPower.value = this.orbLight.intensity / 5
    this.water.material.uniforms.time.value += dt * 0.35
    this.sky.material.uniforms.uTime.value = t
    const gu = this.sky.material.uniforms.uGlow
    gu.value += ((this.sceneId === 'yes' ? 0.3 : 1) - gu.value) * Math.min(1, dt)
    this.petals.userData.update(dt, t)
    this.lanterns.userData.update(dt, t)
    this.fireflies.userData.update(dt, t)
    this.dust.userData.update(dt, t, this.orb.position, this.orb.visible ? 1 : 0)
    this.tree.rotation.z = Math.sin(t * 0.5) * 0.006

    // the camera — composed per shot, blended between shots, breathing like a handheld
    const shot = this.current.cam(this, st)
    const k = ease(Math.min(1, st / this.blendDur))
    const pos = this.blendFrom.pos.clone().lerp(shot.pos, k)
    const look = this.blendFrom.look.clone().lerp(shot.look, k)
    const P = this.pointer
    P.sx += (P.x - P.sx) * dt * 1.5
    P.sy += (P.y - P.sy) * dt * 1.5
    pos.x += Math.sin(t * 0.31) * 0.03 + P.sx * 0.25
    pos.y += Math.sin(t * 0.47) * 0.02 - P.sy * 0.15
    this.camera.position.copy(pos)
    this.look.copy(look)
    this.camera.lookAt(look)
    this.sky.position.copy(pos)

    const head = this.her.position.clone().add(V(0, 1.5, 0))
    this.keyLight.position.copy(pos.clone().lerp(head, 0.55).add(V(0.4, 0.4, 0)))
    this.moonLight.position.copy(this.her.position).addScaledVector(MOON_DIR, 30)
    this.moonLight.target.position.copy(this.her.position)
    if (this.bokeh) {
      const focus = shot.focus ?? pos.distanceTo(head)
      const u = this.bokeh.uniforms
      u.focus.value += (focus - u.focus.value) * Math.min(1, dt * 3)
      u.aperture.value = shot.aperture ?? 0.0018
    }
    const fu = this.grade.uniforms
    fu.uTime.value = t
    fu.uFade.value += ((this.fadeTarget ?? 1) - fu.uFade.value) * Math.min(1, dt * 0.8)
    this.composer.render()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.onResize)
    removeEventListener('pointermove', this.onMove)
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
  }
}

// helpers for shots
const around = (c, r, a, h) => V(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r)
const headOf = (w, y = 1.45) => w.her.position.clone().add(V(0, y, 0))

const MOON_AT = (w) => w.her.position.clone().addScaledVector(MOON_DIR, 120)
const LANTERN_SKY = V(A.x + 1, 9, A.z - 14)

// Every scene: where she stands, what she feels (beats over time), and how the camera sees it.
const SCENES = {
  // establishing: the valley under the moon
  intro: {
    blend: 0.01,
    enter(w) {
      w.place(A, Math.PI)
      w.pose('idle')
      w.fireflies.userData.wander(V(0, 1.5, 6), 20)
      w.grade.uniforms.uFade.value = 0
      w.fadeIn()
      w.emote({ look: MOON_AT(w) })
    },
    cam: (w, t) => ({ pos: V(-16 + t * 0.12, 10 - t * 0.05, 26 - t * 0.15), look: V(0, 1.5, -12), focus: 30, aperture: 0.0004 }),
  },

  // 01 — "like finding a diamond": alone by the water, she notices a little light, and turns to it in wonder
  0: {
    blend: 6,
    enter(w) {
      w.place(A, Math.PI)
      w.pose('idle')
      w.orbTo(V(A.x - 7, 3.5, A.z - 16), 0.4)
      w.lanterns.userData.release(V(0, 0, 0), 0)
      w.emote({ look: MOON_AT(w), down: 0.05 })
    },
    beats: [
      [4.5, (w) => w.orbTo(V(A.x - 1.3, 1.85, A.z - 1.2), 1)],
      [6.5, (w) => w.emote({ look: 'orb', tilt: 0.08 })],
      [11, (w) => w.gesture('agree', 0.35)],
    ],
    cam: (w, t) => ({ pos: V(A.x - 2.6 + t * 0.07, 0.8 + t * 0.025, A.z + 7 - t * 0.3), look: headOf(w, 1.25) }),
  },

  // 02 — "your cheeks": a bashful close-up. She looks away, shy… then up at him, and nods
  1: {
    blend: 3.5,
    enter(w) {
      w.place(A, 0.35)
      w.orbTo(V(A.x + 0.95, 1.7, A.z + 1.0), 0.9)
      w.emote({ look: V(A.x - 3, 0.6, A.z + 1.5), down: 0.32, tilt: -0.16 })
    },
    beats: [
      [5.2, (w) => w.emote({ look: 'camera', down: 0.12, tilt: 0.12 })],
      [6.4, (w) => w.gesture('agree', 0.55)],
      [10.5, (w) => w.emote({ look: 'camera', down: 0.2, tilt: 0.18 })],
    ],
    cam: (w, t) => {
      const h = headOf(w, 1.48)
      return { pos: V(h.x + 0.5 + t * 0.008, h.y + 0.03, h.z + 1.45 - t * 0.025), look: h, aperture: 0.004 }
    },
  },

  // 03 — "the lines of your neck": she lifts her chin to the moon as flamingos glide past
  2: {
    blend: 3.5,
    enter(w) {
      w.place(A, Math.PI / 2 + 0.15)
      w.orbTo(V(A.x + 1.6, 2.1, A.z - 0.8), 0.5)
      w.fly(w.flamingos, V(-60, 9, -55), V(60, 11, -40), 26, 1)
      w.emote({ look: V(A.x + 6, 1.6, A.z - 2) })
    },
    beats: [[3, (w) => w.emote({ look: () => w.flamingos[0].mesh.visible ? w.flamingos[0].mesh.position : MOON_AT(w), down: -0.12, tilt: -0.06 })]],
    cam: (w, t) => {
      const h = headOf(w, 1.38)
      return { pos: V(h.x - 0.15 + t * 0.015, h.y - 0.3, h.z + 1.7 - t * 0.02), look: V(h.x + 0.05, h.y + 0.12, h.z - 1), aperture: 0.003 }
    },
  },

  // 04 — "your smile": the light dances around her, and her eyes follow it with delight
  3: {
    blend: 3,
    enter(w) {
      w.place(A, 0.2)
      w.emote({ look: 'orb', tilt: 0.14 })
    },
    beats: [
      [4, (w) => w.gesture('agree', 0.4)],
      [9, (w) => w.emote({ look: 'camera', tilt: 0.2, down: 0.06 })],
    ],
    update(w, t) {
      w.orbTo(around(A, 0.95, t * 0.55, 1.6 + Math.sin(t * 1.3) * 0.15), 1)
    },
    cam: (w, t) => ({ pos: around(A, 2.5, 0.5 + t * 0.11, 1.45), look: headOf(w, 1.35), aperture: 0.003 }),
  },

  // 05 — "the person behind that face": she wanders through the lavender, curious; the light walks beside her
  4: {
    blend: 2.5,
    enter(w) {
      w.place(PATH1.getPointAt(0), 0)
      w.walk(PATH1, 1.0)
      w.fireflies.userData.wander(V(-4, 1.5, 8), 12)
      w.emote({ look: () => w.her.position.clone().add(V(Math.sin(w.her.rotation.y) * 5, 0.6, Math.cos(w.her.rotation.y) * 5)), down: 0.1 })
    },
    beats: [
      [4, (w) => w.emote({ look: 'orb', tilt: 0.1 })],
      [8, (w) => w.emote({ look: () => w.her.position.clone().add(V(-3, 0.2, 2)), down: 0.15 })],
      [11, (w) => w.emote({ look: 'orb', tilt: 0.12 })],
    ],
    update(w) {
      w.orbTo(w.her.position.clone().add(V(0.8, 1.9, 0.4)), 0.8)
    },
    cam: (w) => {
      const p = w.her.position
      const fwd = V(Math.sin(w.her.rotation.y), 0, Math.cos(w.her.rotation.y))
      const side = V(fwd.z, 0, -fwd.x)
      return { pos: p.clone().addScaledVector(side, -2.8).addScaledVector(fwd, 1.2).add(V(0, 1.35, 0)), look: p.clone().addScaledVector(fwd, 0.4).add(V(0, 1.2, 0)), aperture: 0.0025 }
    },
  },

  // 06 — "worth taking a chance on": she hesitates, eyes down… then the lanterns rise and so does her gaze
  5: {
    blend: 3.5,
    enter(w) {
      if (!w.walking) w.place(A, Math.PI)
      w.herYaw = Math.PI
      w.orbTo(V(A.x + 0.6, 2.0, A.z - 0.5), 0.6)
      w.emote({ look: V(A.x, 0, A.z - 2), down: 0.25 })
      w.horse.visible = true
      w.horseT = -3
    },
    beats: [
      [3.2, (w) => w.lanterns.userData.release(V(A.x, 0.6, A.z - 1.5), 2.2)],
      [4.5, (w) => w.emote({ look: LANTERN_SKY, down: -0.05 })],
    ],
    update(w, t, dt) {
      w.horseT += dt
      const x = -36 + Math.max(0, w.horseT) * 5.5
      const z = shoreZ(x) + 0.3
      w.horse.position.set(x, heightAt(x, z) + 0.02, z - 2.8)
      w.horse.rotation.y = Math.PI / 2
      w.horse.visible = w.horseT > 0 && x < 40
    },
    cam: (w, t) => ({ pos: V(A.x - 1.6, 1.15 + t * 0.03, A.z + 4.2 - t * 0.04), look: V(A.x + 0.3, 1.9 + t * 0.07, A.z - 8), aperture: 0.0016 }),
  },

  // 07 — "your happiness, your anger, your quiet moments": the whole weather of her heart
  6: {
    blend: 3.5,
    enter(w) {
      w.place(A, 0.4)
      w.horse.visible = false
      w.lanterns.userData.release(V(A.x, 0.6, A.z - 1.5), 0.4)
      w.fireflies.userData.wander(V(A.x, 1.5, A.z + 2), 5)
      w.orbTo(V(A.x + 0.7, 1.8, A.z + 0.6), 0.8)
      w.fly(w.parrots, V(-25, 4, 6), V(30, 6, -10), 14, 2)
      w.emote({ look: 'orb', tilt: 0.15 }) // happiness
    },
    beats: [
      [3.5, (w) => { w.emote({ look: V(A.x - 3, 1.4, A.z), tilt: -0.05 }); w.gesture('headShake', 0.9) }], // a little anger
      [6.5, (w) => { w.emote({ look: 'orb', tilt: 0.18 }); w.gesture('agree', 0.8) }], // laughter
      [10, (w) => w.emote({ look: V(A.x + 0.5, 0, A.z - 3), down: 0.3 })], // a quiet moment
      [13.5, (w) => w.emote({ look: 'camera', down: 0.08, tilt: 0.1 })],
    ],
    cam: (w, t) => ({ pos: around(A, 3.2 + t * 0.1, 0.9 + t * 0.04, 1.3 + t * 0.15), look: headOf(w, 1.15), aperture: 0.002 }),
  },

  // 08 — "a team": they walk the shore together, and she keeps glancing at the light beside her
  7: {
    blend: 3,
    enter(w) {
      w.place(A, 0.8)
      w.walk(PATH2, 0.8, () => (w.herYaw = 0))
      w.fireflies.userData.wander(V(TREE.x, 1.5, TREE.z), 10)
      w.fly(w.storks, V(-50, 18, -70), V(50, 20, -60), 30, 0)
      w.emote({ look: 'orb', tilt: 0.1 })
    },
    beats: [
      [5, (w) => w.emote({ look: () => w.her.position.clone().add(V(4, 1.5, -3)) })],
      [8, (w) => w.emote({ look: 'orb', tilt: 0.14 })],
    ],
    update(w) {
      const p = w.her.position
      const fwd = V(Math.sin(w.her.rotation.y), 0, Math.cos(w.her.rotation.y))
      const side = V(fwd.z, 0, -fwd.x)
      w.orbTo(p.clone().addScaledVector(side, -0.8).add(V(0, 1.55, 0)), 1)
    },
    cam: (w, t) => ({ pos: w.her.position.clone().add(V(-3.6 + Math.min(t, 14) * 0.08, 1.7, 3.4)), look: w.her.position.clone().add(V(1.6, 1.9, -1.2)), aperture: 0.0014 }),
  },

  // the question — under the jacaranda. She can't quite look at him… then she does.
  question: {
    blend: 4,
    enter(w) {
      w.place(U, -0.2)
      w.pose('idle')
      w.orbTo(V(U.x + 0.55, 1.65, U.z + 0.8), 1)
      w.lanterns.userData.release(V(U.x, 0.5, U.z - 3), 0.6)
      w.emote({ look: V(U.x + 1, 0, U.z + 1), down: 0.3, tilt: -0.1 })
    },
    beats: [
      [2.5, (w) => w.fireflies.userData.form(w.heart)],
      [5, (w) => w.emote({ look: 'camera', down: 0.18, tilt: 0.12 })],
      [9, (w) => w.emote({ look: 'camera', down: 0.06, tilt: 0.16 })],
    ],
    update(w, t) {
      // his light trembles a little, like a nervous heart
      w.orbTo(V(U.x + 0.55 + Math.sin(t * 9) * 0.02, 1.65 + Math.sin(t * 2.2) * 0.05, U.z + 0.8), 0.9 + Math.max(0, Math.sin(t * 7.2)) * 0.4)
    },
    cam: (w, t) => {
      const d = Math.max(3.2, 6 - t * 0.12)
      return { pos: V(U.x - 0.9, 1.25, U.z + d), look: V(U.x - 0.35, 1.05 + d * 0.06, U.z), focus: d, aperture: 0.0018 }
    },
  },

  // yes — she nods, her eyes never leave him; she turns with the light as it circles her like a waltz
  yes: {
    blend: 3,
    enter(w) {
      w.place(A, 0.15)
      w.pose('idle', 0.8)
      w.fireflies.userData.form(w.name)
      w.lanterns.userData.release(V(A.x, 0.5, A.z - 2.5), 4)
      w.fly(w.flamingos, V(-60, 10, -50), V(60, 12, -40), 24, 4)
      w.emote({ look: 'camera', tilt: 0.12 })
      w.gesture('agree', 1)
    },
    beats: [
      [2.2, (w) => w.gesture('agree', 0.7)],
      [4.5, (w) => w.emote({ look: 'orb', tilt: 0.18 })],
      [11, (w) => w.emote({ look: () => V(A.x - 0.6, 6.6, A.z - 12), down: -0.05 })],
      [16, (w) => w.emote({ look: 'orb', tilt: 0.16 })],
    ],
    update(w, t) {
      const a = t > 4 ? (t - 4) * 0.5 : 0
      w.orbTo(around(A, 1.2, a + 0.5, 1.5 + Math.sin(t * 1.6) * 0.2), 1.3)
      // a slow waltz: she turns to keep facing the light
      if (t > 4) w.herYaw = Math.atan2(w.orb.position.x - A.x, w.orb.position.z - A.z)
    },
    cam: (w, t) => ({ pos: around(A, 5.4 - Math.min(t, 12) * 0.08, 0.12 + Math.sin(t * 0.1) * 0.3, 1.35), look: V(A.x + 0.2, 2.0, A.z - 1.5), focus: 5, aperture: 0.0012 }),
  },
}
