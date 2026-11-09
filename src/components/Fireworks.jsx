import { useEffect, useRef } from 'react'

// Heart-shaped fireworks for the happiest moment.
export default function Fireworks({ onPop }) {
  const ref = useRef(null)
  const pop = useRef(onPop)
  pop.current = onPop

  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio, 2)
    let W, H
    const resize = () => {
      W = cv.width = window.innerWidth * dpr
      H = cv.height = window.innerHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)
    const rockets = []
    const sparks = []
    const palettes = [
      ['#ff7ac4', '#ffd1ec', '#fff'],
      ['#b388ff', '#e6d4ff', '#fff'],
      ['#ffd38a', '#fff1cf', '#ff9bd2'],
      ['#e27bff', '#ffc6f7', '#b388ff'],
    ]
    const launch = (x) => {
      rockets.push({ x: x ?? W * (0.15 + Math.random() * 0.7), y: H, vy: -(10 + Math.random() * 4) * dpr, vx: (Math.random() - 0.5) * 2 * dpr, pal: palettes[Math.floor(Math.random() * palettes.length)], fuse: 0.45 + Math.random() * 0.25 })
    }
    const explode = (r) => {
      const heart = Math.random() < 0.6
      const n = 140
      const power = (2.6 + Math.random() * 1.6) * dpr
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2
        let vx, vy
        if (heart) {
          vx = (16 * Math.pow(Math.sin(t), 3)) / 16
          vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16
        } else {
          const s = 0.6 + Math.random() * 0.5
          vx = Math.cos(t) * s
          vy = Math.sin(t) * s
        }
        sparks.push({ x: r.x, y: r.y, vx: vx * power, vy: vy * power, life: 1, decay: 0.008 + Math.random() * 0.008, c: r.pal[i % r.pal.length] })
      }
      pop.current?.()
    }
    let raf, frame = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      frame++
      if (frame % 55 === 0 && frame < 1400) launch()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.x += r.vx
        r.y += r.vy
        r.vy += 0.12 * dpr
        ctx.fillStyle = '#fff3d6'
        ctx.beginPath()
        ctx.arc(r.x, r.y, 2.2 * dpr, 0, 7)
        ctx.fill()
        if (r.vy > -r.fuse * 6 * dpr) {
          explode(r)
          rockets.splice(i, 1)
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.vx *= 0.975
        s.vy = s.vy * 0.975 + 0.035 * dpr
        s.x += s.vx
        s.y += s.vy
        s.life -= s.decay
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        ctx.globalAlpha = Math.min(1, s.life * 1.4) * (0.7 + Math.random() * 0.3)
        ctx.fillStyle = s.c
        ctx.beginPath()
        ctx.arc(s.x, s.y, 1.7 * dpr, 0, 7)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    launch(W * 0.3)
    setTimeout(() => launch(W * 0.7), 400)
    loop()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="fireworks" aria-hidden="true" />
}
