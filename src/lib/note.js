// Her note is delivered by email, with no server of our own.
//
// Preferred: Web3Forms (https://web3forms.com). Enter your email on their homepage and they
// email you a free "access key". Put it in WEB3FORMS_KEY below (or VITE_WEB3FORMS_KEY in .env).
//
// Fallback: FormSubmit (https://formsubmit.co). Needs a one-time activation link it emails you.
export const NOTE_EMAIL = 'benbaah104@gmail.com'
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || ''
const FORMSUBMIT = import.meta.env.VITE_NOTE_ENDPOINT || `https://formsubmit.co/ajax/${NOTE_EMAIL}`

export const SUBJECT = '💜 Ewurama said yes — and she left you a note'

async function post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false || data.success === 'false') throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

export async function sendNote(message) {
  const sent = new Date().toLocaleString()
  if (WEB3FORMS_KEY) {
    return post('https://api.web3forms.com/submit', {
      access_key: WEB3FORMS_KEY,
      subject: SUBJECT,
      from_name: 'Ewurama 💜',
      message,
      sent,
    })
  }
  return post(FORMSUBMIT, { _subject: SUBJECT, _template: 'box', _captcha: 'false', from: 'Ewurama', message, sent })
}

// if the network fails, she can still send it from her own mail app
export const mailtoLink = (message) =>
  `mailto:${NOTE_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(message)}`
