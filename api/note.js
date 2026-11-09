// Vercel serverless function: receives her note and forwards it by email.
// Your address lives only here on the server (or in the NOTE_EMAIL env var on Vercel),
// so it never appears in the page's source.
const TO = process.env.NOTE_EMAIL || 'benbaah104@gmail.com'
const SITE = process.env.SITE_URL || 'https://ewurama.vercel.app/'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const message = String(body.message || '').trim().slice(0, 4000)
  if (!message) return res.status(400).json({ success: false, message: 'Empty note' })

  try {
    const r = await fetch(`https://formsubmit.co/ajax/${TO}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: SITE.replace(/\/$/, ''), Referer: SITE },
      body: JSON.stringify({
        _subject: '💜 Ewurama said yes — and she left you a note',
        _template: 'box',
        _captcha: 'false',
        from: 'Ewurama',
        message,
        sent: String(body.sent || new Date().toISOString()).slice(0, 80),
      }),
    })
    const data = await r.json().catch(() => ({}))
    const ok = r.ok && String(data.success) === 'true'
    return res.status(ok ? 200 : 502).json({ success: ok, message: data.message || '' })
  } catch (e) {
    return res.status(502).json({ success: false, message: 'Could not reach the mail service' })
  }
}
