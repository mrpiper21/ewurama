import { motion } from 'framer-motion'
import { Whisper } from './Chapter'
import NoteToMe from './NoteToMe'

const ease = [0.16, 1, 0.3, 1]

export default function Celebration({ onReplay }) {
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <motion.section className="celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }}>
      <motion.p className="c-kicker" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4.5, duration: 1.5, ease }}>
        {today} · the first day of us
      </motion.p>
      <div className="c-bottom">
        <p className="c-line">
          <Whisper text="You just made the stars write your name across the sky." delay={5.5} step={0.07} />
        </p>
        <p className="c-line soft">
          <Whisper text="Thank you for taking a chance on us. I promise to take good care of your heart. 💜" delay={8.2} step={0.07} />
        </p>
        <NoteToMe delay={12} />
        <motion.button className="btn-ghost" onClick={onReplay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 15, duration: 1.5 }}>
          ↺ relive our story
        </motion.button>
      </div>
    </motion.section>
  )
}
