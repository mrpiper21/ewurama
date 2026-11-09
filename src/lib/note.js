// Her note is emailed through FormSubmit (https://formsubmit.co), straight from her browser.
// (FormSubmit sits behind Cloudflare's bot check, so it can't be called from a server.)
//
// FORM_ID: use the random alias FormSubmit gave you after activation (a long string of letters
// and numbers) so your email address doesn't appear in the page source. It can also be set as
// VITE_FORMSUBMIT_ID in Vercel's environment variables.
const FORM_ID = import.meta.env.VITE_FORMSUBMIT_ID || 'benbaah104@gmail.com'
export const SUBJECT = '💜 Ewurama said yes — and she left you a note'

export async function sendNote(message) {
  const res = await fetch(`https://formsubmit.co/ajax/${FORM_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: SUBJECT,
      _template: 'box',
      _captcha: 'false',
      from: 'Ewurama',
      message,
      sent: new Date().toLocaleString(),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || `HTTP ${res.status}`)
  return data
}
