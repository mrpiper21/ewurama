import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// A sealed letter with a purple wax seal. Breaking the seal begins everything.
export default function Envelope({ onOpen, ready = true, progress = 1 }) {
  const [stage, setStage] = useState('sealed') // sealed → cracking → open → gone

  const open = () => {
    if (stage !== 'sealed' || !ready) return
    setStage('cracking')
    onOpen?.('start')
    setTimeout(() => setStage('open'), 700)
    setTimeout(() => setStage('gone'), 4200)
    setTimeout(() => onOpen?.('done'), 5000)
  }

  return (
    <AnimatePresence>
      {stage !== 'gone' && (
        <motion.div
          className="envelope-stage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.6, filter: 'blur(14px)' }}
          transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.p
            className="envelope-kicker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: stage === 'sealed' ? 1 : 0, y: 0 }}
            transition={{ delay: 0.6, duration: 1.2 }}
          >
            a letter, delivered by starlight
          </motion.p>

          <motion.div
            className={`envelope ${stage}`}
            initial={{ y: 60, rotateX: 20, opacity: 0 }}
            animate={{ y: 0, rotateX: 0, opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            onClick={open}
          >
            <div className="env-back" />
            <motion.div
              className="letter"
              animate={stage === 'open' ? { y: '-62%' } : { y: '0%' }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            >
              <p className="letter-script">Dear Ewurama,</p>
              <p className="letter-body">There are a few things I have been wanting to tell you. I thought the stars should help me say them.</p>
              <p className="letter-sign">— turn the lights down, turn the sound up 🎧</p>
            </motion.div>
            <div className="env-front" />
            <div className={`env-flap ${stage !== 'sealed' ? 'opened' : ''}`} />
            <button className={`seal ${stage}`} aria-label="Break the seal">
              <span className="seal-half left">
                <span>E</span>
              </span>
              <span className="seal-half right">
                <span>E</span>
              </span>
            </button>
            <p className="envelope-to">For Ewurama</p>
          </motion.div>

          <motion.p
            className="envelope-hint"
            animate={{ opacity: stage === 'sealed' ? [0.35, 1, 0.35] : 0 }}
            transition={{ duration: 2.4, repeat: Infinity }}
          >
            {ready ? 'touch the seal' : `the stars are aligning… ${Math.round(progress * 100)}%`}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
