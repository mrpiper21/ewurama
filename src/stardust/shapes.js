// Shapes the stardust can become. Each returns a Float32Array of N xyz positions.

const rnd = (a = 1) => (Math.random() - 0.5) * a

export function heart(N, c, s, depth = 0.25, filter) {
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    if (filter && !filter(i)) continue
    const t = Math.random() * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3) / 17
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
    const shell = Math.random() < 0.72
    const k = shell ? 1 + rnd(0.04) : Math.sqrt(Math.random())
    out[i * 3] = c[0] + x * k * s
    out[i * 3 + 1] = c[1] + y * k * s
    out[i * 3 + 2] = c[2] + rnd(depth) * (shell ? 1 : 1 - k)
  }
  return out
}

// two hearts, interlocked — one gold, one violet (split by the particle's colour seed)
export function twinHearts(N, seeds, c, s) {
  const a = heart(N, [c[0] - s * 0.42, c[1], c[2]], s, 0.3, (i) => seeds[i * 4 + 3] < 0.5)
  const b = heart(N, [c[0] + s * 0.42, c[1] - s * 0.08, c[2] + 0.2], s, 0.3, (i) => seeds[i * 4 + 3] >= 0.5)
  for (let i = 0; i < N; i++) if (seeds[i * 4 + 3] >= 0.5) a.set(b.subarray(i * 3, i * 3 + 3), i * 3)
  return a
}

// a brilliant-cut diamond, drawn in light along its edges
export function diamond(N, c, s) {
  const V = []
  const table = [], girdle = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    table.push([Math.cos(a) * 0.55, 0.42, Math.sin(a) * 0.55])
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16
    girdle.push([Math.cos(a), 0, Math.sin(a)])
  }
  const culet = [0, -1.05, 0]
  const E = []
  for (let i = 0; i < 8; i++) {
    E.push([table[i], table[(i + 1) % 8]])
    E.push([table[i], girdle[i * 2]], [table[i], girdle[(i * 2 + 1) % 16]], [table[(i + 1) % 8], girdle[(i * 2 + 1) % 16]])
  }
  for (let i = 0; i < 16; i++) {
    E.push([girdle[i], girdle[(i + 1) % 16]])
    if (i % 2 === 0) E.push([girdle[i], culet])
  }
  void V
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const [p, q] = E[Math.floor(Math.random() * E.length)]
    const t = Math.random()
    const j = Math.random() < 0.82 ? 0.012 : 0.09
    out[i * 3] = c[0] + (p[0] + (q[0] - p[0]) * t + rnd(j)) * s
    out[i * 3 + 1] = c[1] + (p[1] + (q[1] - p[1]) * t + rnd(j)) * s
    out[i * 3 + 2] = c[2] + (p[2] + (q[2] - p[2]) * t + rnd(j)) * s
  }
  return out
}

// a halo of light, like sunrise behind her smile
export function halo(N, c, r) {
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2
    const ray = Math.random() < 0.35
    const rr = ray ? r * (1.05 + Math.pow(Math.random(), 1.6) * 1.6) : r * (1 + rnd(0.05))
    const aa = ray ? Math.round(a / (Math.PI / 12)) * (Math.PI / 12) + rnd(0.02) : a
    out[i * 3] = c[0] + Math.cos(aa) * rr
    out[i * 3 + 1] = c[1] + Math.sin(aa) * rr
    out[i * 3 + 2] = c[2] + rnd(0.15)
  }
  return out
}

// a wide, slow sea of stars around the whole world
export function drift(N) {
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 2.2 + Math.pow(Math.random(), 0.7) * 14
    out[i * 3] = Math.cos(a) * r
    out[i * 3 + 1] = -2 + Math.random() * 9
    out[i * 3 + 2] = -3 - Math.abs(Math.sin(a) * r) - Math.random() * 6
  }
  return out
}

const canvasCache = {}
async function textPixels(text, font) {
  const key = text + font
  if (canvasCache[key]) return canvasCache[key]
  await document.fonts.load(font)
  const W = 1400, H = 320
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = ctx.strokeStyle = '#fff'
  ctx.lineWidth = 5
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font
  ctx.fillText(text, W / 2, H / 2)
  ctx.strokeText(text, W / 2, H / 2)
  const d = ctx.getImageData(0, 0, W, H).data
  const px = []
  let minX = W, maxX = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 120) {
        px.push(x, y)
        if (x < minX) minX = x
        if (x > maxX) maxX = x
      }
  return (canvasCache[key] = { px, W, H, span: maxX - minX + 1 })
}

// words written in stardust
export async function text(N, str, c, width, font = 'italic 200px "Cormorant Garamond"') {
  const { px, W, H, span } = await textPixels(str, font)
  const s = width / span
  const out = new Float32Array(N * 3)
  const n = px.length / 2
  for (let i = 0; i < N; i++) {
    const k = Math.floor(Math.random() * n) * 2
    out[i * 3] = c[0] + (px[k] + Math.random() - W / 2) * s
    out[i * 3 + 1] = c[1] - (px[k + 1] + Math.random() - H / 2) * s
    out[i * 3 + 2] = c[2] + rnd(0.05)
  }
  return out
}

// her name, with a little heart dotting the end
export async function name(N, str, c, width) {
  const base = await text(N, str, c, width, '200px "Pinyon Script"')
  const h = heart(N, [c[0] + width * 0.56, c[1] + width * 0.1, c[2]], width * 0.07, 0.05)
  for (let i = Math.floor(N * 0.88); i < N; i++) base.set(h.subarray(i * 3, i * 3 + 3), i * 3)
  return base
}
