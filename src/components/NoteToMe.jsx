import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sendNote, mailtoLink } from '../lib/note'

const ease = [0.16, 1, 0.3, 1]

// After her yes: a little card asking if there's anything she'd like to say back.
export default function NoteToMe({ delay = 12 }) {
  const [state, setState] = useState('ask') // ask | writing | sending | sent | error | later
  const [text, setText] = useState('')

  const send = async () => {
    if (!text.trim()) return
    setState('sending')
    try {
      await sendNote(text.trim())
      setState('sent')
    } catch (e) {
      console.error(e)
      setState('error')
    }
  }

  return (
    <motion.div className="note" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 1.4, ease }}>
      <AnimatePresence mode="wait">
        {state === 'ask' && (
          <motion.div key="ask" className="note-card" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }}>
            <p className="note-q">Is there anything you’d like to say to me?</p>
            <div className="note-actions">
              <button className="note-btn primary" onClick={() => setState('writing')}>
                Yes, write a note ✍︎
              </button>
              <button className="note-btn" onClick={() => setState('later')}>
                Not right now
              </button>
            </div>
          </motion.div>
        )}

        {(state === 'writing' || state === 'sending' || state === 'error') && (
          <motion.div key="write" className="note-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.6, ease }}>
            <p className="note-q">Say anything — it comes straight to me.</p>
            <textarea
              className="note-text"
              autoFocus
              rows={4}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your heart out…"
              disabled={state === 'sending'}
            />
            {state === 'error' && (
              <p className="note-err">
                It didn’t go through. Try again, or <a href={mailtoLink(text)}>send it from your mail app</a>.
              </p>
            )}
            <div className="note-actions">
              <button className="note-btn primary" onClick={send} disabled={!text.trim() || state === 'sending'}>
                {state === 'sending' ? 'Sending…' : state === 'error' ? 'Try again 💜' : 'Send it 💜'}
              </button>
              <button className="note-btn" onClick={() => setState('later')} disabled={state === 'sending'}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {state === 'sent' && (
          <motion.div key="sent" className="note-card sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease }}>
            <p className="note-q">Sent. I’ll be reading it with the biggest smile. 💜</p>
          </motion.div>
        )}

        {state === 'later' && (
          <motion.button key="later" className="note-pill" onClick={() => setState('writing')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            ✉︎ write me a note
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
