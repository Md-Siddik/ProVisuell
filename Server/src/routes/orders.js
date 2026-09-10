import { Router } from "express"
import { Resend } from "resend"
import { Order } from "../models/Order.js"
import { User } from "../models/User.js"
import { Appointment } from "../models/Appointment.js"
import { Invoice } from "../models/Invoice.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"
import { notifyRole, notifyUser } from "../lib/notify.js"
import { createInvoiceFromOrder } from "../lib/invoicing.js"
import { nextInSequence } from "../lib/sequence.js"

// Cleans and totals a raw items array from the client. Money is always
// recomputed here from the cleaned numbers — a client-sent subtotal/VAT/
// total is never trusted or stored directly.
function buildItemTotals(rawItems) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .filter((i) => i && String(i.name || "").trim())
    .map((i) => ({
      name: String(i.name).trim(),
      description: String(i.description || "").trim(),
      quantity: Math.max(0, Number(i.quantity) || 0),
      unit: String(i.unit || "stk").trim() || "stk",
      unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      vatRate: Number(i.vatRate) >= 0 ? Number(i.vatRate) : 25,
    }))

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  return { items, subtotal, vatAmount }
}

const router = Router()
router.use(verifyFirebaseToken)

// Best-effort — silently does nothing until RESEND_API_KEY etc. are set in
// Server/.env (see routes/email.js for the same pattern). Never throws.
async function notifyCustomerOfDecision(order) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from || !order.customerEmail) return
  const copy = {
    approved: {
      verb: "godkjent",
      text: `Hei ${order.customerName},\n\nBestillingen din (${order.orderNumber} – ${order.service}) er godkjent. Vi setter i gang med leveransen.\n\nMvh ProVisuell`,
    },
    rejected: {
      verb: "avvist",
      text: `Hei ${order.customerName},\n\nBestillingen din (${order.orderNumber} – ${order.service}) kunne dessverre ikke godkjennes. Ta kontakt med oss, så finner vi en løsning.\n\nMvh ProVisuell`,
    },
    completed: {
      verb: "fullført",
      text: `Hei ${order.customerName},\n\nBestillingen din (${order.orderNumber} – ${order.service}) er nå fullført og levert. Takk for at du valgte ProVisuell!\n\nMvh ProVisuell`,
    },
  }[order.status]
  if (!copy) return
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from,
      to: order.customerEmail,
      subject: `Din bestilling ${order.orderNumber} er ${copy.verb}`,
      text: copy.text,
    })
  } catch (err) {
    console.error("Order decision email failed:", err.message)
  }
}

async function nextOrderNumber() {
  const year = new Date().getFullYear()
  const seq = await nextInSequence(`order-${year}`)
  return `PV-${year}-${String(seq).padStart(6, "0")}`
}

// List orders. Admin/owner see everything (optionally filtered); a plain
// customer only ever sees their own.
router.get("/", async (req, res) => {
  const { status, search, page = 1, limit = 10, deliveryFrom, deliveryTo } = req.query
  const query = {}

  if (req.user.role === "customer") {
    query.customerId = req.user._id
  }
  if (status && status !== "all") query.status = status

  const andClauses = []
  // Used by the Avtaler calendar to show orders relevant to the visible
  // week alongside booked appointments. A waiting order usually has no
  // expectedDeliveryDate yet — fall back to when it was placed so it still
  // shows up (on the calendar and in Rapporter drill-downs) instead of
  // disappearing until someone sets a delivery date.
  if (deliveryFrom || deliveryTo) {
    const from = deliveryFrom ? new Date(deliveryFrom) : new Date(0)
    const to = deliveryTo ? new Date(deliveryTo) : new Date(8640000000000000)
    andClauses.push({
      $or: [
        { expectedDeliveryDate: { $gte: from, $lte: to } },
        { expectedDeliveryDate: null, createdAt: { $gte: from, $lte: to } },
      ],
    })
  }
  if (search) {
    andClauses.push({
      $or: [
        { orderNumber: new RegExp(search, "i") },
        { customerName: new RegExp(search, "i") },
        { service: new RegExp(search, "i") },
      ],
    })
  }
  if (andClauses.length) query.$and = andClauses

  const skip = (Number(page) - 1) * Number(limit)
  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Order.countDocuments(query),
  ])

  // Attach a lightweight invoice summary per order (if one exists) so the
  // UI can show "Vis faktura" vs "Opprett faktura" without a round-trip per row.
  const orderIds = orders.map((o) => o._id)
  const invoices = await Invoice.find({ orderId: { $in: orderIds } }).select("orderId invoiceNumber status")
  const invoiceByOrder = new Map(invoices.map((i) => [String(i.orderId), i]))

  res.json({
    orders: orders.map((o) => {
      const inv = invoiceByOrder.get(String(o._id))
      return {
        ...o.toObject(),
        invoice: inv ? { _id: inv._id, invoiceNumber: inv.invoiceNumber, status: inv.status } : null,
      }
    }),
    total,
    page: Number(page),
    limit: Number(limit),
  })
})

// How many of the customer's own orders were decided but they haven't
// looked at yet — drives the "Min side" notification badge.
router.get("/unseen-count", async (req, res) => {
  if (req.user.role !== "customer") return res.json({ count: 0 })
  const count = await Order.countDocuments({
    customerId: req.user._id,
    status: { $in: ["approved", "rejected", "completed"] },
    customerSeenAt: null,
  })
  res.json({ count })
})

// Called when the customer opens "Mine bestillinger" — clears the badge.
router.post("/mark-seen", async (req, res) => {
  await Order.updateMany(
    { customerId: req.user._id, status: { $in: ["approved", "rejected", "completed"] }, customerSeenAt: null },
    { customerSeenAt: new Date() }
  )
  res.status(204).end()
})

router.get("/:id", async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ error: "Order not found" })
  if (req.user.role === "customer" && String(order.customerId) !== String(req.user._id)) {
    return res.status(403).json({ error: "Not your order" })
  }
  const inv = await Invoice.findOne({ orderId: order._id }).select("invoiceNumber status")
  res.json({
    order: {
      ...order.toObject(),
      invoice: inv ? { _id: inv._id, invoiceNumber: inv.invoiceNumber, status: inv.status } : null,
    },
  })
})

router.post("/", requireRole(["administrator", "owner"]), async (req, res) => {
  const {
    customerName,
    customerEmail,
    service,
    specification,
    amount,
    items,
    discount,
    expectedDeliveryDate,
    internalNote,
    attachments,
    source,
    appointmentId,
  } = req.body || {}
  if (!customerName || !customerEmail || !service || !specification) {
    return res.status(400).json({ error: "customerName, customerEmail, service and specification are required" })
  }

  // If the admin knows the customer's account email, link the order to it
  // so it shows up under that customer's "Mine bestillinger".
  let customerId = null
  if (customerEmail) {
    const match = await User.findOne({ email: customerEmail.trim().toLowerCase() })
    if (match) customerId = match._id
  }

  // If this order was registered off the back of a booked meeting, link it
  // so approving/rejecting it can also resolve that appointment.
  let linkedAppointment = null
  if (appointmentId) {
    linkedAppointment = await Appointment.findById(appointmentId)
    if (!linkedAppointment) return res.status(400).json({ error: "Appointment not found" })
  }

  // Itemized service breakdown is optional — an order without any items
  // behaves exactly as before, using the manually entered `amount`.
  const { items: cleanItems, subtotal: itemsSubtotal, vatAmount: itemsVat } = buildItemTotals(items)
  const discountAmount = Math.max(0, Number(discount) || 0)
  const hasItems = cleanItems.length > 0
  const grandTotal = hasItems ? Math.max(0, itemsSubtotal - discountAmount) + itemsVat : Number(amount) || 0

  const order = await Order.create({
    orderNumber: await nextOrderNumber(),
    customerName,
    customerEmail: customerEmail || "",
    customerId,
    appointmentId: linkedAppointment?._id || null,
    service,
    specification,
    items: cleanItems,
    discount: hasItems ? discountAmount : 0,
    subtotal: hasItems ? itemsSubtotal : grandTotal,
    vatAmount: hasItems ? itemsVat : 0,
    grandTotal,
    amount: grandTotal,
    expectedDeliveryDate: expectedDeliveryDate || null,
    internalNote: internalNote || "",
    attachments: attachments || [],
    source: source || (linkedAppointment ? "meeting" : "admin"),
    createdBy: req.user._id,
  })

  // An administrator registering an order needs the owner to approve it —
  // if the owner registered it themselves, they already know.
  if (req.user.role !== "owner") {
    notifyRole("owner", {
      type: "order_created",
      title: "Ny ordre venter på godkjenning",
      message: `${order.customerName} — ${order.service}`,
      link: "/dashboard/owner/ordreoversikt",
    })
  }

  res.status(201).json({ order })
})

router.patch("/:id/status", requireRole(["administrator", "owner"]), async (req, res) => {
  const { status } = req.body || {}
  if (!["approved", "rejected", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved', 'rejected' or 'completed'" })
  }

  // "completed" is a follow-up milestone on an already-approved order, not
  // a new decision — decidedAt/decidedBy must stay pinned to the original
  // approval, otherwise the revenue would silently move to whatever month
  // the order happens to get marked complete in.
  const update =
    status === "completed"
      ? { status, completedAt: new Date(), customerSeenAt: null }
      : { status, decidedBy: req.user._id, decidedAt: new Date(), customerSeenAt: null }

  const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
  if (!order) return res.status(404).json({ error: "Order not found" })

  // The meeting this order came from has now served its purpose either way
  // — mark it completed so it drops off the customer's "Mine avtaler" and
  // its join link disappears.
  if (order.appointmentId) {
    await Appointment.findByIdAndUpdate(order.appointmentId, { status: "completed" })
  }

  // Completing an order used to require a separate "Opprett faktura" form
  // before the invoice existed at all — issue it automatically instead
  // (default terms: due in 14 days, no discount) so the order list shows
  // the real invoice the moment it's completed, no extra step. Best-effort:
  // an invoicing hiccup must never block the order from completing, and the
  // "Opprett faktura" button still covers manual creation as a fallback.
  let invoiceSummary = null
  if (order.status === "completed") {
    try {
      const existingInvoice = await Invoice.findOne({ orderId: order._id })
      const invoice = existingInvoice || (await createInvoiceFromOrder(order, { createdBy: req.user._id }))
      invoiceSummary = { _id: invoice._id, invoiceNumber: invoice.invoiceNumber, status: invoice.status }
    } catch (err) {
      console.error("Auto-invoice creation failed for order", order._id.toString(), ":", err.message)
    }
  }

  notifyCustomerOfDecision(order)

  if (order.customerId) {
    const titleByStatus = {
      approved: "Bestillingen din er godkjent",
      rejected: "Bestillingen din ble avvist",
      completed: "Bestillingen din er fullført",
    }
    notifyUser(order.customerId, {
      type: "order_decided",
      title: titleByStatus[order.status],
      message: `#${order.orderNumber} — ${order.service}`,
      link: `/mine-bestillinger/${order._id}`,
    })
  }

  res.json({ order: { ...order.toObject(), invoice: invoiceSummary } })
})

export default router
