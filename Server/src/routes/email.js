import { Router } from "express"
import { Resend } from "resend"

const router = Router()

// No auth required — this is the public "send us an email" composer on the
// marketing site, open to anyone (customers don't have to log in just to
// send a message this way).
router.post("/send", async (req, res) => {
  const { name, email, message } = req.body || {}
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const to = process.env.BUSINESS_EMAIL

  if (!apiKey || !from || !to) {
    return res.status(503).json({
      error: "Email sending isn't configured yet (RESEND_API_KEY / RESEND_FROM_EMAIL / BUSINESS_EMAIL missing).",
    })
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `Ny henvendelse fra ${name} via nettsiden`,
      text: `Fra: ${name} <${email}>\n\n${message}`,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error("Resend send failed:", err.message)
    res.status(502).json({ error: "Could not send email right now." })
  }
})

export default router
