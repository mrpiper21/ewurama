import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Envelope from './components/Envelope'
import { Whisper, readTime } from './components/Chapter'
import Question from './components/Question'
import Celebration from './components/Celebration'
import Fireworks from './components/Fireworks'
import { song } from './lib/music'
import { Stardust } from './stardust/Stardust'

const CHAPTERS = [
  { n: '01', title: 'The first impression', quote: 'The moment I saw you, I knew I had stumbled upon something special. Like finding a diamond in a place I never thought to look.' },
  { n: '02', title: 'Your cheeks', quote: 'Your cheeks were so fluffy and adorable. There’s just something about them that makes me want to smile every time I think about you.' },
  { n: '03', title: 'Your neck', quote: 'And those beautiful lines along your neck… I don’t know how to explain it, but there’s something so delicate and captivating about the way you carry yourself.' },
  { n: '04', title: 'Your smile', quote: 'That smile of yours… I hope you never run out of reasons to wear it. There’s a warmth in it that makes an ordinary moment feel special.' },
  { n: '05', title: 'Beyond the beauty', quote: 'We haven’t spoken much, but somehow, I’m already curious about the person behind that beautiful face. I want to know your thoughts, your dreams, your little habits, and all the things that make you who you are.' },
  { n: '06', title: 'Taking a chance', quote: 'I want to try this beautiful thing called a relationship with you. Not because I think everything will always be perfect, but because I think some things are worth taking a chance on.' },
  { n: '07', title: 'The little things', quote: 'I want to experience your happiness, your anger, your random conversations, your laughter, and even your quiet moments. I want to be someone you can share both the beautiful and difficult days with.' },
  { n: '08', title: 'Protecting you', quote: 'I want to protect you — your heart, your peace, and that beautiful smile. Not to hold you back or change who you are, but to be a safe place you can always run to; someone who stands with you when the world gets loud, and holds you close when it all feels like too much.' },
  { n: '09', title: 'Being a team', quote: 'I want us to be a team. To encourage each other, learn from each other, grow together, and create memories that we’ll look back on and smile about.' },
]
const Q = CHAPTERS.length
const YES = Q + 1
// each shot breathes for a moment before the words arrive
const SUB_DELAY = 2.2

export default function App() {
  const mount = useRef(null)
  const world = useRef(null)
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(() => {
    const q = new URLSearchParams(location.search).get('step')
    return q === null ? -1 : Number(q)
  })
  const [canNext, setCanNext] = useState(false)
  const [muted, setMuted] = useState(false)
  const [titleCard, setTitleCard] = useState(false)

  useEffect(() => {
    const w = new Stardust(mount.current, { onProgress: setProgress })
    world.current = w
    if (import.meta.env.DEV) {
      window.__world = w
      window.__song = song
    }
    let alive = true
    w.ready.then(() => alive && setReady(true)).catch((e) => console.error(e))
    return () => {
      alive = false
      w.ready.finally(() => w.dispose())
    }
  }, [])

  // direct the film
  useEffect(() => {
    const w = world.current
    if (!ready || !w) return
    if (step < 0) return w.setScene('intro')
    if (step < Q) {
      w.setScene(step)
      setCanNext(false)
      const t = setTimeout(() => setCanNext(true), (SUB_DELAY + readTime(CHAPTERS[step].quote)) * 1000)
      return () => clearTimeout(t)
    }
    if (step === Q) {
      w.setScene('question')
      const hb = setInterval(() => {
        song.heartbeat()
        w.beat()
      }, 1100)
      return () => clearInterval(hb)
    }
    if (step === YES) {
      w.setScene('yes')
      song.setMood('joy')
      song.sparkle(7)
    }
  }, [step, ready])

  const next = useCallback(() => {
    if (step < 0 || step >= Q || !canNext) return
    song.sparkle(3)
    setStep((s) => s + 1)
  }, [step, canNext])

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', ' ', 'Enter'].includes(e.key)) next()
      if (e.key === 'ArrowLeft' && step > 0 && step < Q) setStep((s) => s - 1)
    }
    addEventListener('keydown', onKey)
    // on a phone: swipe left for the next scene, right to go back
    let sx = 0, sy = 0
    const onStart = (e) => {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
    }
    const onEnd = (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) next()
      else if (step > 0 && step < Q) setStep((s) => s - 1)
    }
    addEventListener('touchstart', onStart, { passive: true })
    addEventListener('touchend', onEnd, { passive: true })
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('touchstart', onStart)
      removeEventListener('touchend', onEnd)
    }
  }, [next, step])

  const onEnvelope = (phase) => {
    if (phase === 'start') {
      song.start()
      song.sparkle(6)
    } else {
      setTitleCard(true)
      setTimeout(() => setTitleCard(false), 8500)
      setTimeout(() => setStep(0), 9500)
    }
  }

  const replay = () => {
    song.setMood('tender')
    setStep(0)
  }

  const inChapter = step >= 0 && step < Q
  const cinema = (step >= 0 || titleCard) && step !== YES

  return (
    <main className={`app step-${step}`}>
      <div ref={mount} className="stage" />

      {/* letterbox: the moment it begins, it becomes a film */}
      <div className={`bar top ${cinema ? 'on' : ''}`} />
      <div className={`bar bottom ${cinema ? 'on' : ''}`} />

      {step === YES && <Fireworks onPop={() => song.sparkle(2)} />}

      {step === -1 && !titleCard && <Envelope onOpen={onEnvelope} ready={ready} progress={progress} />}

      <AnimatePresence>
        {titleCard && (
          <motion.div className="title-card" key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)' }} transition={{ duration: 2 }}>
            <motion.p className="tc-once" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 2.4 }}>
              Once upon a time…
            </motion.p>
            <motion.p className="tc-small" initial={{ opacity: 0, letterSpacing: '0.9em' }} animate={{ opacity: 1, letterSpacing: '0.45em' }} transition={{ delay: 2.2, duration: 2.5 }}>
              a love story for
            </motion.p>
            <motion.h1 className="tc-name" initial={{ opacity: 0, y: 20, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 3, duration: 2.6 }}>
              Ewurama
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {inChapter && (
          <motion.div key={step} className="subtitle" exit={{ opacity: 0, filter: 'blur(10px)' }} transition={{ duration: 1 }}>
            <motion.p className="sub-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: SUB_DELAY - 0.6, duration: 1 }}>
              <span className="dropcap">{CHAPTERS[step].quote[0]}</span>
              <Whisper text={CHAPTERS[step].quote.slice(1)} delay={SUB_DELAY} step={0.06} />
            </motion.p>
          </motion.div>
        )}
        {step === Q && <Question key="q" onYes={() => setStep(YES)} onNoAttempt={() => song.sparkle(2)} />}
        {step === YES && <Celebration key="c" onReplay={replay} />}
      </AnimatePresence>

      <AnimatePresence>
        {inChapter && canNext && (
          <motion.button key={'n' + step} className="btn-next" onClick={next} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
            {step === Q - 1 ? 'one more thing…' : 'continue'} <span className="arrow">→</span>
          </motion.button>
        )}
      </AnimatePresence>

      {inChapter && (
        <div className="reel" aria-label={`Scene ${step + 1} of ${Q}`}>
          {CHAPTERS.map((c, i) => (
            <span key={c.n} className={i < step ? 'done' : i === step ? 'now' : ''} />
          ))}
        </div>
      )}

      {step >= 0 && (
        <button className="mute" onClick={() => setMuted(song.toggleMute())} aria-label={muted ? 'Play music' : 'Mute music'}>
          {muted ? '♪̸' : '♪'}
        </button>
      )}
    </main>
  )
}
