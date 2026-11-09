// A small generative love song, composed live in the browser with the Web Audio API:
// warm string-like pads, a music-box melody, and a long reverb tail. Nothing to download,
// never repeats exactly the same way twice.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12)

// D major, tender and a little bittersweet:  Bm(add9) → Gmaj7 → D/F# → A(sus4)
const CHORDS = [
  { bass: 35, pad: [59, 62, 66, 69, 73], mel: [71, 73, 74, 78, 81, 83], harp: [47, 54, 59, 62, 66, 73, 78] },
  { bass: 43, pad: [59, 62, 66, 67, 71], mel: [71, 74, 78, 79, 83, 86], harp: [43, 50, 55, 59, 62, 66, 71] },
  { bass: 42, pad: [57, 62, 66, 69, 74], mel: [69, 74, 76, 78, 81, 86], harp: [42, 50, 54, 57, 62, 66, 74] },
  { bass: 45, pad: [57, 62, 64, 69, 71], mel: [69, 71, 74, 76, 81, 83], harp: [45, 52, 57, 62, 64, 69, 76] },
]

export class LoveSong {
  constructor() {
    this.started = false
    this.muted = false
    this.mood = 'tender'
  }

  start() {
    if (this.started) return
    this.started = true
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 4)
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)

    // long, dreamy reverb from a synthesized impulse
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.impulse(5.5, 2.6)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.75
    this.reverb.connect(this.wet).connect(this.master)
    this.dry = ctx.createGain()
    this.dry.gain.value = 0.55
    this.dry.connect(this.master)
    this.dry.connect(this.reverb)

    // tape-style echo for the music box
    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = 0.42
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const dlp = ctx.createBiquadFilter()
    dlp.frequency.value = 2600
    this.delay.connect(dlp).connect(fb).connect(this.delay)
    dlp.connect(this.reverb)

    this.bar = 0
    this.nextBar = ctx.currentTime + 0.1
    this.timer = setInterval(() => this.schedule(), 200)
  }

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate
    const len = rate * seconds
    const buf = this.ctx.createBuffer(2, len, rate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  get barLen() {
    return this.mood === 'joy' ? 3.4 : 4.8
  }

  schedule() {
    const ctx = this.ctx
    while (this.nextBar < ctx.currentTime + 1.2) {
      this.playBar(this.nextBar, CHORDS[this.bar % CHORDS.length])
      this.nextBar += this.barLen
      this.bar++
    }
  }

  playBar(t, ch) {
    const L = this.barLen
    // pad: detuned saw/triangle through a soft low-pass
    ch.pad.forEach((m, i) => {
      for (const det of [-7, 6]) {
        this.voice({ t, dur: L + 1.8, freq: NOTE(m), type: i % 2 ? 'triangle' : 'sawtooth', gain: 0.022, attack: 1.6, release: 2.4, cutoff: this.mood === 'joy' ? 2200 : 1100, detune: det })
      }
    })
    this.voice({ t, dur: L + 1, freq: NOTE(ch.bass), type: 'sine', gain: 0.16, attack: 0.4, release: 2 })
    this.voice({ t, dur: L + 1, freq: NOTE(ch.bass + 12), type: 'triangle', gain: 0.03, attack: 0.6, release: 2, cutoff: 600 })

    // harp: a soft rolled chord at the top of each bar
    ch.harp.forEach((m, i) => this.pluck(t + i * 0.09, NOTE(m), 0.05 - i * 0.004))
    // celesta: a gentle, wandering line
    const steps = this.mood === 'joy' ? 8 : 6
    let idx = Math.floor(Math.random() * 3) + 1
    for (let s = 0; s < steps; s++) {
      const p = this.mood === 'joy' ? 0.85 : 0.55
      if (Math.random() > p && s !== 0) continue
      idx = Math.max(0, Math.min(ch.mel.length - 1, idx + Math.round((Math.random() - 0.5) * 3)))
      const when = t + (s * L) / steps + (Math.random() - 0.5) * 0.02
      this.bell(when, NOTE(ch.mel[idx]), s === 0 ? 0.09 : 0.06)
    }
  }

  voice({ t, dur, freq, type, gain, attack, release, cutoff = 8000, detune = 0 }) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = cutoff
    f.Q.value = 0.3
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.setValueAtTime(gain, t + dur - release)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(f).connect(g).connect(this.dry)
    o.start(t)
    o.stop(t + dur + 0.1)
  }

  bell(t, freq, gain = 0.07) {
    const ctx = this.ctx
    const partials = [[1, 1], [2.01, 0.35], [3.98, 0.12], [6.1, 0.05]]
    partials.forEach(([mult, amp]) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq * mult
      const g = ctx.createGain()
      const d = 2.8 / mult
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(gain * amp, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g)
      g.connect(this.dry)
      g.connect(this.delay)
      o.start(t)
      o.stop(t + d + 0.05)
    })
  }

  pluck(t, freq, gain = 0.05) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(3200, t)
    f.frequency.exponentialRampToValueAtTime(700, t + 1.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
    o.connect(f).connect(g)
    g.connect(this.dry)
    o.start(t)
    o.stop(t + 2.7)
  }

  // a little glittery flourish for magical moments
  sparkle(count = 7) {
    if (!this.started || this.muted) return
    const t = this.ctx.currentTime
    const notes = [86, 90, 93, 97, 98, 102, 105]
    for (let i = 0; i < count; i++) this.bell(t + i * 0.07, NOTE(notes[i % notes.length]), 0.045)
  }

  heartbeat() {
    if (!this.started) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.05
    ;[0, 0.22].forEach((d, i) => {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(70, t + d)
      o.frequency.exponentialRampToValueAtTime(38, t + d + 0.18)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t + d)
      g.gain.linearRampToValueAtTime(i ? 0.25 : 0.4, t + d + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25)
      o.connect(g).connect(this.master)
      o.start(t + d)
      o.stop(t + d + 0.3)
    })
  }

  setMood(m) {
    this.mood = m
  }

  toggleMute() {
    if (!this.started) return this.muted
    this.muted = !this.muted
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.85, now + 0.8)
    return this.muted
  }
}

export const song = new LoveSong()
