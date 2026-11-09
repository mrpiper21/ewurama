import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Whisper } from './Chapter'

const ease = [0.16, 1, 0.3, 1]
const NO_LINES = ['No', 'Are you sure? 🥺', 'Think again…', 'Pretty please?', 'Look at the stars first ✨', 'The heart says otherwise', 'Okay this button is broken 💜']

export default function Question({ onYes, onNoAttempt }) {
  const [tries, setTries] = useState(0)
  const [noPos, setNoPos] = useState(null)
  const zone = useRef(null)

  const dodge = () => {
    const next = tries + 1
    setTries(next)
    onNoAttempt?.(next)
    const w = window.innerWidth, h = window.innerHeight
    const x = (Math.random() * 0.7 + 0.15) * w - w / 2
    const y = (Math.random() * 0.5 + 0.35) * h - h * 0.75
    setNoPos({ x, y })
  }
  const noGone = tries >= NO_LINES.length

  return (
    <motion.section className="question" exit={{ opacity: 0, scale: 0.94, filter: 'blur(16px)' }} transition={{ duration: 1.2, ease }}>
      <motion.p className="q-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6 }}>
        So, here’s my question…
      </motion.p>
      <p className="q-line">
        <Whisper text="“I don’t know exactly what the future holds, but I know I’d love to find out with you.”" delay={1.6} />
      </p>
      <p className="q-line">
        <Whisper text="“Would you give me the chance to make you my favourite person, and let me be yours?”" delay={4.4} />
      </p>
      <motion.h1
        className="q-big"
        initial={{ opacity: 0, scale: 0.85, filter: 'blur(20px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ delay: 7.6, duration: 2.2, ease }}
      >
        Will you be my girlfriend?
        <motion.span className="q-heart" animate={{ scale: [1, 1.25, 1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.4 }}>
          💜
        </motion.span>
      </motion.h1>

      <motion.div ref={zone} className="q-buttons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 9.4, duration: 1.2, ease }}>
        <motion.button
          className="btn-yes"
          onClick={onYes}
          animate={{ scale: 1 + Math.min(tries, 7) * 0.12 }}
          whileHover={{ scale: 1.08 + Math.min(tries, 7) * 0.12 }}
          whileTap={{ scale: 0.96 }}
        >
          <span className="btn-glow" />
          Yes, a thousand times
        </motion.button>
        <AnimatePresence>
          {!noGone && (
            <motion.button
              className="btn-no"
              onPointerEnter={(e) => e.pointerType === 'mouse' && dodge()}
              onClick={dodge}
              animate={noPos ? { x: noPos.x, y: noPos.y, scale: Math.max(0.45, 1 - tries * 0.09) } : {}}
              exit={{ opacity: 0, scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {NO_LINES[tries]}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}
