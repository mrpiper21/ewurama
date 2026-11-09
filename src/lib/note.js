// Emails go through FormSubmit (https://formsubmit.co), straight from her browser.
// (FormSubmit sits behind Cloudflare's bot check, so it can't be called from a server.)
//
// FORM_ID: use the random alias FormSubmit gave you after activation (a long string of letters
// and numbers) so your email address doesn't appear in the page source. It can also be set as
// VITE_FORMSUBMIT_ID in Vercel's environment variables.
const FORM_ID = import.meta.env.VITE_FORMSUBMIT_ID || 'benbaah104@gmail.com'
export const SUBJECT = '💜 Ewurama said yes — and she left you a note'
export const YES_SUBJECT = '💜 Ewurama said YES'

async function post(fields) {
  const res = await fetch(`https://formsubmit.co/ajax/${FORM_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _template: 'box', _captcha: 'false', from: 'Ewurama', sent: new Date().toLocaleString(), ...fields }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

// Keep trying for a while (flaky mobile data shouldn't lose the moment).
async function withRetry(fn, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= tries - 1) throw e
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i))
    }
  }
}

export function sendNote(message) {
  return withRetry(() => post({ _subject: SUBJECT, message }))
}

// Sent the moment she taps yes, before she writes anything, so you always hear about it.
let yesSent = false
export function sendYes() {
  if (yesSent) return Promise.resolve()
  yesSent = true
  return withRetry(() => post({ _subject: YES_SUBJECT, message: 'She said yes. 💜 (Her note, if she writes one, follows in a separate email.)' }), 6).catch((e) => {
    yesSent = false
    console.error(e)
  })
}
