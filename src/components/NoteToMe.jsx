import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sendNote } from '../lib/note'

const ease = [0.16, 1, 0.3, 1]

// After her yes: a note back to me. It's not optional — the story waits until she sends it.
export default function NoteToMe({ delay = 12, onSent }) {
  const [state, setState] = useState('writing') // writing | sending | sent | error
  const [text, setText] = useState('')

  const send = async () => {
    if (!text.trim()) return
    setState('sending')
    try {
      await sendNote(text.trim())
      setState('sent')
      onSent?.()
    } catch (e) {
      console.error(e)
      setState('error')
    }
  }

  return (
    <motion.div className="note" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 1.4, ease }}>
      <AnimatePresence mode="wait">
        {state !== 'sent' && (
          <motion.div key="write" className="note-card" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.6, ease }}>
            <p className="note-q">Before the stars settle — write me a little note?</p>
            <textarea
              className="note-text"
              rows={4}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Anything at all — it comes straight to me…"
              disabled={state === 'sending'}
            />
            {state === 'error' && (
              <p className="note-err">
                It didn’t go through — check your connection and try again.{' '}
                <button type="button" className="note-link" onClick={() => navigator.clipboard?.writeText(text)}>
                  Copy my note
                </button>
              </p>
            )}
            <div className="note-actions">
              <button className="note-btn primary" onClick={send} disabled={!text.trim() || state === 'sending'}>
                {state === 'sending' ? 'Sending…' : state === 'error' ? 'Try again 💜' : 'Send it 💜'}
              </button>
            </div>
          </motion.div>
        )}

        {state === 'sent' && (
          <motion.div key="sent" className="note-card sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease }}>
            <p className="note-q">Sent. I’ll be reading it with the biggest smile. 💜</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
