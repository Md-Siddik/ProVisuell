import { Router } from "express"
import { Resend } from "resend"
import { Invoice } from "../models/Invoice.js"
import { Order } from "../models/Order.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"
import { notifyUser } from "../lib/notify.js"
import { createInvoiceFromOrder, createStatementInvoice } from "../lib/invoicing.js"

const router = Router()
router.use(verifyFirebaseToken)

function assertOwnInvoice(req, invoice) {
  if (req.user.role === "customer" && String(invoice.customerId) !== String(req.user._id)) {
    const err = new Error("Not your invoice")
    err.status = 403
    throw err
  }
}

// Any status short of actually paid or cancelled still owes money.
const DUE_STATUSES = ["draft", "issued", "unpaid", "partially_paid", "overdue"]

// One row per customer — how many invoices they've paid vs. how many are
// still outstanding, and the invoices behind that "due" count, so owner/
// admin can spot who pays reliably and who's piling up unpaid invoices
// without paging through every invoice individually.
router.get("/by-customer", requireRole(["administrator", "owner"]), async (req, res) => {
  // Statement invoices (see createStatementInvoice) are a rollup of debt
  // that's already counted via the underlying per-order invoices — counting
  // them too would make the due total climb every time "Påminn" is clicked,
  // for the exact same outstanding amount.
  const invoices = await Invoice.find({ type: { $ne: "statement" } })
    .select("customerId customer orderNumber invoiceNumber status grandTotal amountPaid dueDate issueDate")
    .sort({ issueDate: -1 })

  const groups = new Map()
  for (const inv of invoices) {
    const key = inv.customerId ? String(inv.customerId) : `email:${inv.customer?.email || "ukjent"}`
    if (!groups.has(key)) {
      groups.set(key, {
        customerId: inv.customerId || null,
        customerEmail: inv.customer?.email || "",
        customerName: inv.customer?.name || "Ukjent kunde",
        totalInvoices: 0,
        paidCount: 0,
        dueCount: 0,
        dueAmount: 0,
        dueInvoices: [],
      })
    }
    const group = groups.get(key)
    group.totalInvoices += 1
    if (inv.status === "paid") group.paidCount += 1
    if (DUE_STATUSES.includes(inv.status)) {
      const remaining = Math.max(0, inv.grandTotal - (inv.amountPaid || 0))
      group.dueCount += 1
      group.dueAmount += remaining
      group.dueInvoices.push({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        orderNumber: inv.orderNumber,
        amount: remaining,
        dueDate: inv.dueDate,
        status: inv.status,
      })
    }
  }

  const customers = Array.from(groups.values()).sort(
    (a, b) => b.dueCount - a.dueCount || b.dueAmount - a.dueAmount
  )
  res.json({ customers })
})

// Sends one consolidated payment reminder covering every due invoice for a
// customer, rather than resending each invoice individually.
// Rolls every due invoice for a customer into one real statement invoice
// (see createStatementInvoice) and sends that — not just a text summary —
// alongside the in-app notification. Entirely separate from the per-order
// "Fakturer"/"Vis faktura" buttons and the /:id/send route, which are
// unchanged.
router.post("/remind", requireRole(["administrator", "owner"]), async (req, res) => {
  const { invoiceIds, customerId, customerEmail, customerName } = req.body || {}
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: "invoiceIds is required" })
  }

  const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
  if (invoices.length === 0) return res.status(404).json({ error: "No matching invoices found" })

  const dueInvoices = invoices.map((inv) => ({
    _id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    orderNumber: inv.orderNumber,
    amount: Math.max(0, inv.grandTotal - (inv.amountPaid || 0)),
  }))
  const totalDue = dueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const plural = invoices.length > 1

  const statement = await createStatementInvoice({
    customerId,
    customerEmail,
    customerName,
    dueInvoices,
    createdBy: req.user._id,
  })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (apiKey && from && customerEmail) {
    try {
      const resend = new Resend(apiKey)
      const lines = invoices
        .map((inv) => `- ${inv.invoiceNumber}: kr ${inv.grandTotal.toFixed(2)} (forfaller ${inv.dueDate.toLocaleDateString("no-NO")})`)
        .join("\n")
      await resend.emails.send({
        from,
        to: customerEmail,
        subject: `Påminnelse: ${invoices.length} ubetalt${plural ? "e" : ""} faktura${plural ? "er" : ""} fra ProVisuell`,
        text: `Hei ${customerName || ""},\n\nDu har ${invoices.length} ubetalt${plural ? "e" : ""} faktura${plural ? "er" : ""} hos ProVisuell, til sammen kr ${totalDue.toFixed(2)}:\n\n${lines}\n\nVi har samlet dette i én faktura (${statement.invoiceNumber}) som du finner her: ${process.env.CLIENT_URL || ""}/faktura/${statement._id}\n\nVennligst betal snarest mulig.\n\nMvh ProVisuell`,
      })
    } catch (err) {
      console.error("Reminder email failed:", err.message)
    }
  }

  if (customerId) {
    notifyUser(customerId, {
      type: "invoice_reminder",
      title: `Påminnelse om ${invoices.length} ubetalt${plural ? "e" : ""} faktura${plural ? "er" : ""}`,
      message: `Samlefaktura ${statement.invoiceNumber} — kr ${totalDue.toFixed(2)} utestående`,
      link: `/faktura/${statement._id}`,
    })
  }

  res.json({ sent: true, count: invoices.length, totalDue, statement })
})

// Lets the UI show "Vis faktura" instead of "Opprett faktura" once one
// exists for an order, without a full invoice list round-trip.
router.get("/by-order/:orderId", async (req, res) => {
  const invoice = await Invoice.findOne({ orderId: req.params.orderId }).sort({ createdAt: -1 })
  if (!invoice) return res.json({ invoice: null })
  assertOwnInvoice(req, invoice)
  res.json({ invoice })
})

router.get("/:id", async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) return res.status(404).json({ error: "Invoice not found" })
  assertOwnInvoice(req, invoice)
  res.json({ invoice })
})

// Issues an invoice from an order — snapshots the customer + items +
// totals as they are right now. Any later edit to the order will never
// touch this document again.
// Manual fallback for the rare case auto-creation (see orders.js's
// completed-status handler) didn't happen — e.g. an order completed before
// this existed. dueDate is optional now; omitted, it defaults to +14 days.
router.post("/", requireRole(["administrator", "owner"]), async (req, res) => {
  const { orderId, dueDate, deliveryDate, deliveryPlace, discount, paymentTerms, note, payment } = req.body || {}
  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" })
  }

  const order = await Order.findById(orderId)
  if (!order) return res.status(404).json({ error: "Order not found" })
  if (order.status !== "completed") {
    return res.status(400).json({ error: "Only completed orders can be invoiced" })
  }

  const existing = await Invoice.findOne({ orderId })
  if (existing) {
    return res.status(409).json({ error: "This order already has an invoice", invoice: existing })
  }

  const invoice = await createInvoiceFromOrder(order, {
    dueDate,
    deliveryDate,
    deliveryPlace,
    discount,
    paymentTerms,
    note,
    payment,
    createdBy: req.user._id,
  })

  res.status(201).json({ invoice })
})

// Best-effort email, same graceful-degrade pattern as order-decision and
// contact-form email elsewhere — works without config, sends for real once
// RESEND_API_KEY/RESEND_FROM_EMAIL are set.
router.post("/:id/send", requireRole(["administrator", "owner"]), async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) return res.status(404).json({ error: "Invoice not found" })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (apiKey && from && invoice.customer?.email) {
    try {
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from,
        to: invoice.customer.email,
        subject: `Faktura ${invoice.invoiceNumber} fra ProVisuell`,
        text: `Hei ${invoice.customer.name},\n\nVedlagt finner du faktura ${invoice.invoiceNumber} pålydende kr ${invoice.grandTotal.toFixed(2)}, forfallsdato ${invoice.dueDate.toLocaleDateString("no-NO")}.\n\nMvh ProVisuell`,
      })
    } catch (err) {
      console.error("Invoice email failed:", err.message)
    }
  }

  invoice.sentAt = new Date()
  await invoice.save()

  if (invoice.customerId) {
    notifyUser(invoice.customerId, {
      type: "invoice_sent",
      title: "Ny faktura fra ProVisuell",
      message: `${invoice.invoiceNumber} — forfaller ${invoice.dueDate.toLocaleDateString("no-NO")}`,
      link: `/faktura/${invoice._id}`,
    })
  }

  res.json({ invoice })
})

// Payment status — the one piece of an issued invoice that's expected to
// change over its life.
router.patch("/:id/payment", requireRole(["administrator", "owner"]), async (req, res) => {
  const { status, amountPaid } = req.body || {}
  const allowed = ["unpaid", "partially_paid", "paid", "overdue", "cancelled"]
  const update = {}
  if (status !== undefined) {
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" })
    update.status = status
    // Records when the money actually arrived, so reports can recognize
    // revenue by real payment date instead of invoice date.
    update.paidAt = status === "paid" ? new Date() : null
  }
  if (amountPaid !== undefined) update.amountPaid = Math.max(0, Number(amountPaid) || 0)

  const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, { new: true })
  if (!invoice) return res.status(404).json({ error: "Invoice not found" })
  res.json({ invoice })
})

export default router
