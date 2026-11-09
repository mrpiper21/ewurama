// Whole worlds her stardust can become. Each returns { p, fall?, ord? } for N particles.
const R = Math.random
const g = () => (R() + R() + R() - 1.5) / 1.5

// 02 — a sky of fluffy, rose-gold clouds at dusk
export function clouds(N) {
  const puffs = []
  for (let c = 0; c < 18; c++) {
    const cx = (R() - 0.5) * 20, cy = -0.8 + R() * 4.2, cz = -20 + R() * 16
    const n = 4 + Math.floor(R() * 5)
    for (let k = 0; k < n; k++) puffs.push([cx + (R() - 0.5) * 3.2, cy + R() * 0.7, cz + (R() - 0.5) * 1.6, 0.5 + R() * 0.9])
  }
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const [x, y, z, r] = puffs[Math.floor(R() * puffs.length)]
    // denser toward the surface → fluffy, lit edges
    const d = Math.pow(R(), 0.35) * r
    const v = [g(), g() * 0.75, g()]
    const l = Math.hypot(...v) || 1
    p[i * 3] = x + (v[0] / l) * d
    p[i * 3 + 1] = Math.max(y - r * 0.35, y + (v[1] / l) * d) // flat-ish bottoms
    p[i * 3 + 2] = z + (v[2] / l) * d
    ord[i] = R()
  }
  return { p, ord }
}

// 03 — ribbons of silk, the grace of a line
export function ribbons(N) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  const K = 5
  for (let i = 0; i < N; i++) {
    const k = i % K
    const s = R()
    const x = (s - 0.5) * 13
    const ph = k * 1.3
    const y = 0.9 + Math.sin(s * 4.2 + ph) * 0.9 + (k - 2) * 0.32
    const z = -1.5 + Math.cos(s * 3.1 + ph) * 1.6 - k * 0.4
    // ribbon width, with a twist
    const w = (R() - 0.5) * (0.22 + 0.1 * Math.sin(s * 9 + k))
    const tw = s * 6 + k
    p[i * 3] = x
    p[i * 3 + 1] = y + Math.cos(tw) * w
    p[i * 3 + 2] = z + Math.sin(tw) * w
    ord[i] = s
  }
  return { p, ord }
}

// 06 — a bridge of light across the dark, built step by step, toward the moon
export const bridgePoint = (s) => [Math.sin(s * 2.2) * 1.4, -1.2 + Math.sin(s * Math.PI) * 2.2 + s * 2.2, 3 - s * 26]
export function bridge(N) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  const STEPS = 70
  for (let i = 0; i < N; i++) {
    const rail = R() < 0.3
    let s
    if (rail) s = R()
    else s = (Math.floor(R() * STEPS) + 0.5) / STEPS
    const [x, y, z] = bridgePoint(s)
    const [x2, , z2] = bridgePoint(s + 0.001)
    // perpendicular in xz
    let nx = -(z2 - z), nz = x2 - x
    const l = Math.hypot(nx, nz)
    nx /= l
    nz /= l
    if (rail) {
      const side = R() < 0.5 ? -1 : 1
      p[i * 3] = x + nx * 0.75 * side
      p[i * 3 + 1] = y + 0.55 + g() * 0.02
      p[i * 3 + 2] = z + nz * 0.75 * side
    } else {
      const u = (R() - 0.5) * 1.4, v = (R() - 0.5) * 0.12
      p[i * 3] = x + nx * u
      p[i * 3 + 1] = y + g() * 0.02
      p[i * 3 + 2] = z + nz * u + v
    }
    ord[i] = s
  }
  return { p, ord }
}

// 07 — an aurora of feelings: tall curtains of light folding across the sky
export function aurora(N) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const k = i % 3
    const s = R()
    const x = (s - 0.5) * 24
    const z = -10 - k * 3 + Math.sin(s * 5 + k) * 2.5
    const base = 2.6 + k * 0.5 + Math.sin(s * 6 + k * 2) * 0.6
    const h = Math.pow(R(), 0.8) * (3.2 + Math.sin(s * 9 + k) * 1.2)
    p[i * 3] = x + Math.sin(h * 1.3 + s * 40) * 0.05 + g() * 0.03
    p[i * 3 + 1] = base + h
    p[i * 3 + 2] = z + g() * 0.08
    ord[i] = s
  }
  return { p, ord }
}

// 07 — the difficult days: rain… and an umbrella held over us
export function storm(N, umbrellaShare = 0) {
  const p = new Float32Array(N * 3), fall = new Float32Array(N), ord = new Float32Array(N)
  const U = Math.floor(N * umbrellaShare)
  for (let i = 0; i < N; i++) {
    ord[i] = R()
    if (i < U) {
      // the canopy: a scalloped dome, and its handle
      if (R() < 0.88) {
        const a = R() * Math.PI * 2
        const r = Math.sqrt(R()) * 1.7
        const scallop = 1 - 0.08 * Math.pow(Math.abs(Math.sin(a * 4)), 0.5) * (r / 1.7)
        p[i * 3] = Math.cos(a) * r * scallop
        p[i * 3 + 1] = 1.9 + 0.75 * (1 - Math.pow(r / 1.7, 2)) + g() * 0.015
        p[i * 3 + 2] = -1 + Math.sin(a) * r * scallop
      } else {
        const s = R()
        const hook = s > 0.9
        const hy = 1.9 - s * 2.4
        p[i * 3] = hook ? 0.18 - Math.cos((s - 0.9) * 31) * 0.18 : 0
        p[i * 3 + 1] = hook ? -0.5 - Math.sin((s - 0.9) * 31) * 0.18 : hy
        p[i * 3 + 2] = -1
      }
      ord[i] = 0.3 + R() * 0.3
      continue
    }
    let x, z
    do {
      x = (R() - 0.5) * 14
      z = -9 + R() * 11
    } while (umbrellaShare > 0 && Math.hypot(x, z + 1) < 1.9)
    p[i * 3] = x
    p[i * 3 + 1] = -2 + R() * 9
    p[i * 3 + 2] = z
    fall[i] = 1
  }
  return { p, fall, ord }
}

// 08 — two strands of light, rising and winding around each other
export function helix(N) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const s = R()
    const strand = i % 2
    const a = s * Math.PI * 7 + strand * Math.PI
    const r = 1.1 * (1 - s * 0.45)
    p[i * 3] = Math.cos(a) * r + g() * 0.05
    p[i * 3 + 1] = -2.2 + s * 7
    p[i * 3 + 2] = -1.5 + Math.sin(a) * r + g() * 0.05
    ord[i] = s
  }
  return { p, ord }
}

// 08 — …and they become one heart
export function bigHeart(N, c = [0, 1.7, -1.5], s = 2.2) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const t = R() * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3) / 17
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
    const k = Math.pow(R(), 0.25)
    const th = Math.sqrt(Math.max(0, 1 - k * k)) * 0.55
    p[i * 3] = c[0] + x * k * s
    p[i * 3 + 1] = c[1] + y * k * s
    p[i * 3 + 2] = c[2] + (R() - 0.5) * 2 * th * s
    ord[i] = 1 - k
  }
  return { p, ord }
}

// sky shapes (plain Float32Array) ────────────────────────────────────────
// a crescent moon lying on its back — a smile in the sky
export function smileMoon(N, c, r) {
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    let x, y
    do {
      x = (R() * 2 - 1) * r
      y = (R() * 2 - 1) * r
    } while (!(x * x + y * y < r * r && x * x + (y - r * 0.38) ** 2 > (r * 0.92) ** 2))
    out[i * 3] = c[0] + x
    out[i * 3 + 1] = c[1] + y
    out[i * 3 + 2] = c[2] + (R() - 0.5) * 0.2
  }
  return out
}

export function moonDisk(N, c, r) {
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const a = R() * Math.PI * 2
    const rr = R() < 0.25 ? r * (1 + Math.pow(R(), 2) * 0.5) : Math.sqrt(R()) * r
    out[i * 3] = c[0] + Math.cos(a) * rr
    out[i * 3 + 1] = c[1] + Math.sin(a) * rr
    out[i * 3 + 2] = c[2] + (R() - 0.5) * 0.4
  }
  return out
}

// 04 — a smile like sunrise: the sun lifting out of a still sea, its light running toward us
export function sunrise(N) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  const C = [0, 0.15, -14], r = 2.6, H = -0.35
  for (let i = 0; i < N; i++) {
    const u = R()
    let x, y, z
    if (u < 0.38) {
      // the disc, above the horizon
      do {
        const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * r
        x = C[0] + Math.cos(a) * rr
        y = C[1] + Math.sin(a) * rr
      } while (y < H)
      z = C[2]
      ord[i] = 0.5 * R()
    } else if (u < 0.62) {
      // rays
      const k = Math.floor(R() * 13)
      const a = (k / 12) * Math.PI + g() * 0.012
      const rr = r * (1.12 + Math.pow(R(), 1.5) * 1.9)
      x = C[0] + Math.cos(a) * rr
      y = Math.max(H, C[1] + Math.sin(a) * rr)
      z = C[2] - 0.3
      ord[i] = 0.4 + 0.4 * R()
    } else if (u < 0.72) {
      // the horizon line
      x = (R() - 0.5) * 34
      y = H + g() * 0.02
      z = C[2] + 0.2
      ord[i] = R()
    } else {
      // the sun's road across the water, glittering toward us
      const d = R()
      z = C[2] + 0.4 + d * 16
      x = g() * (0.5 + d * 2.4)
      y = H - 0.15 - d * 1.1
      ord[i] = 0.3 + 0.7 * d
    }
    p[i * 3] = x
    p[i * 3 + 1] = y
    p[i * 3 + 2] = z
  }
  return { p, ord }
}

// 05 — an open book of stars: the story of you, which I want to read
export function book(N) {
  const p = new Float32Array(N * 3), ord = new Float32Array(N)
  const W = 2.1, D = 2.8, cz = -1.2, cy = -0.4
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1
    let u = R(), v = R()
    const edge = R() < 0.3
    if (edge) {
      if (R() < 0.5) u = R() < 0.5 ? 0.02 : 1
      else v = R() < 0.5 ? 0 : 1
    }
    // pages lift from the spine and curl at the edge; a few lines of "text"
    const lift = Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5) * 0.42 - u * u * 0.18
    const line = !edge && u > 0.12 && u < 0.9 && Math.abs(((v * 14) % 1) - 0.5) < 0.12
    p[i * 3] = side * (0.05 + u * W)
    p[i * 3 + 1] = cy + lift + (line ? 0.01 : 0) + g() * 0.006
    p[i * 3 + 2] = cz + (v - 0.5) * D
    ord[i] = u
  }
  return { p, ord }
}
