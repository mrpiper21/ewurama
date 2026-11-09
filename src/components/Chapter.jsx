import { motion } from 'framer-motion'

const ease = [0.16, 1, 0.3, 1]

// Words fade up out of a soft blur, one breath at a time.
export function Whisper({ text, delay = 0, step = 0.085, className = '' }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="word"
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: delay + i * step, duration: 0.9, ease }}
        >
          {w}&nbsp;
        </motion.span>
      ))}
    </span>
  )
}

export default function Chapter({ chapter, children }) {
  const { n, title, quote } = chapter
  return (
    <motion.section
      className="chapter"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30, filter: 'blur(12px)' }}
      transition={{ duration: 0.9, ease }}
    >
      <motion.div
        className="chapter-num"
        initial={{ opacity: 0, letterSpacing: '0.6em', filter: 'blur(8px)' }}
        animate={{ opacity: 1, letterSpacing: '0.08em', filter: 'blur(0px)' }}
        transition={{ duration: 1.8, ease }}
      >
        {n}
      </motion.div>
      <motion.div
        className="chapter-title"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 1.2, ease }}
      >
        <span className="rule" />
        {title}
      </motion.div>
      <blockquote className="chapter-quote">
        <motion.span
          className="quote-mark"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 1.4, ease }}
        >
          “
        </motion.span>
        <Whisper text={quote} delay={1.0} />
      </blockquote>
      {children}
    </motion.section>
  )
}

export const readTime = (quote) => quote.split(' ').length * 0.06 + 3.5
