import { Router } from "express"
import { Appointment } from "../models/Appointment.js"
import { Order } from "../models/Order.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"
import { notifyRole } from "../lib/notify.js"

const router = Router()

// Every appointment route now requires login — booking, checking your own
// appointments, and the internal calendar are all behind auth.
router.use(verifyFirebaseToken)

const SLOT_MINUTES = 30
const BOOKING_START_HOUR = 9
const BOOKING_END_HOUR = 17

// Real available time slots for a given day, so customers pick an open slot
// instead of typing in any time they like. Any logged-in user can check
// this (it's what powers the public booking widget).
router.get("/availability", async (req, res) => {
  const { date } = req.query
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date is required as YYYY-MM-DD" })
  }

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59.999`)
  const existing = await Appointment.find({
    start: { $lte: dayEnd },
    end: { $gte: dayStart },
    status: { $ne: "cancelled" },
  })

  const now = new Date()
  const slots = []
  for (let hour = BOOKING_START_HOUR; hour < BOOKING_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      const start = new Date(dayStart)
      start.setHours(hour, minute, 0, 0)
      const end = new Date(start.getTime() + SLOT_MINUTES * 60000)
      const isPast = start < now
      const isTaken = existing.some((a) => start < new Date(a.end) && end > new Date(a.start))
      slots.push({ start: start.toISOString(), end: end.toISOString(), available: !isPast && !isTaken })
    }
  }
  res.json({ slots })
})

// A logged-in customer requests a meeting slot from the marketing site's
// booking widget. Tied to their account so it shows up under "Mine avtaler".
router.post("/request", async (req, res) => {
  const { title, start, end, notes } = req.body || {}
  if (!title || !start || !end) {
    return res.status(400).json({ error: "title, start and end are required" })
  }

  // Re-check the slot is still free server-side — the client only ever
  // shows open slots, but two people could race for the same one.
  const overlap = await Appointment.findOne({
    start: { $lt: new Date(end) },
    end: { $gt: new Date(start) },
    status: { $ne: "cancelled" },
  })
  if (overlap) {
    return res.status(409).json({ error: "Dette tidspunktet er nettopp booket av noen andre. Velg et annet." })
  }

  const appointment = await Appointment.create({
    title,
    start,
    end,
    requestedByName: req.user.name || req.user.email,
    requestedByEmail: req.user.email,
    requestedBy: req.user._id,
    notes: notes || "",
  })

  const message = `${appointment.requestedByName} — ${new Date(appointment.start).toLocaleString("no-NO", { dateStyle: "medium", timeStyle: "short" })}`
  notifyRole("owner", {
    type: "appointment_booked",
    title: "Ny avtale booket",
    message,
    link: "/dashboard/owner/ansattmoter",
  })
  notifyRole("administrator", {
    type: "appointment_booked",
    title: "Ny avtale booket",
    message,
    link: "/dashboard/admin/ansattmoter",
  })

  res.status(201).json({ appointment })
})

// The customer clicked "Bli med" and joined the meeting — it's done, so it
// drops off "Mine avtaler" immediately rather than waiting on an order to
// be decided later.
router.patch("/:id/join", async (req, res) => {
  const appointment = await Appointment.findOne({ _id: req.params.id, requestedBy: req.user._id })
  if (!appointment) return res.status(404).json({ error: "Appointment not found" })
  if (appointment.status === "scheduled") {
    appointment.status = "completed"
    await appointment.save()
  }
  res.json({ appointment })
})

// The logged-in customer's own booked appointments. "completed" ones (their
// linked order has been decided) are left out — they've served their
// purpose and the customer no longer needs to see or join them.
router.get("/mine", async (req, res) => {
  const appointments = await Appointment.find({
    requestedBy: req.user._id,
    status: { $ne: "completed" },
  }).sort({ start: 1 })
  res.json({ appointments })
})

router.get("/", requireRole(["administrator", "owner"]), async (req, res) => {
  const { from, to, customerEmail, status } = req.query
  const query = {}
  if (from || to) {
    query.start = {}
    if (from) query.start.$gte = new Date(from)
    if (to) query.start.$lte = new Date(to)
  }
  if (customerEmail) {
    query.requestedByEmail = new RegExp(`^${customerEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
  }
  if (status) query.status = status
  const appointments = await Appointment.find(query).sort({ start: 1 })

  // Attach the linked order (if any) so the calendar can show what an
  // appointment turned into — customer name, status, and the dates the
  // status badge needs — without a separate lookup per block.
  const ids = appointments.map((a) => a._id)
  const orders = await Order.find({ appointmentId: { $in: ids } }).select(
    "appointmentId orderNumber status customerName createdAt expectedDeliveryDate completedAt"
  )
  const orderByAppointment = new Map(orders.map((o) => [String(o.appointmentId), o]))

  res.json({
    appointments: appointments.map((a) => {
      const order = orderByAppointment.get(String(a._id))
      return {
        ...a.toObject(),
        linkedOrder: order
          ? {
              _id: order._id,
              orderNumber: order.orderNumber,
              status: order.status,
              customerName: order.customerName,
              createdAt: order.createdAt,
              expectedDeliveryDate: order.expectedDeliveryDate,
              completedAt: order.completedAt,
            }
          : null,
      }
    }),
  })
})

router.post("/", requireRole(["administrator", "owner"]), async (req, res) => {
  const { title, start, end, name, email, notes } = req.body || {}
  if (!title || !start || !end) {
    return res.status(400).json({ error: "title, start and end are required" })
  }
  const appointment = await Appointment.create({
    title,
    start,
    end,
    requestedByName: name || req.user.name || "Internt møte",
    requestedByEmail: email || req.user.email,
    notes: notes || "",
    createdBy: req.user._id,
  })
  res.status(201).json({ appointment })
})

router.patch("/:id/cancel", requireRole(["administrator", "owner"]), async (req, res) => {
  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  )
  if (!appointment) return res.status(404).json({ error: "Appointment not found" })
  res.json({ appointment })
})

export default router
