// Her note goes to our own serverless function (api/note.js on Vercel), which emails it.
// No email address is ever shipped in the page.
export const SUBJECT = '💜 Ewurama said yes — and she left you a note'

export async function sendNote(message) {
  const res = await fetch('/api/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ message, sent: new Date().toLocaleString() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}
