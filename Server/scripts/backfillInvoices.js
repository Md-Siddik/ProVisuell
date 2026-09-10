// One-off: creates the missing invoice for any order that's already
// "completed" but predates the auto-invoice-on-completion feature, so the
// order list shows "Vis faktura" instead of falling back to the manual
// creation form for pre-existing data.
import "dotenv/config"
import dns from "node:dns"
import mongoose from "mongoose"
import { Order } from "../src/models/Order.js"
import { Invoice } from "../src/models/Invoice.js"
import { User } from "../src/models/User.js"
import { createInvoiceFromOrder } from "../src/lib/invoicing.js"

dns.setServers(["8.8.8.8", "1.1.1.1"])

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 })

// Attribute backfilled invoices to an owner/administrator account, same as
// a real "Opprett faktura" click would — falls back to whichever exists.
const attributedTo = await User.findOne({ role: { $in: ["owner", "administrator"] } })
if (!attributedTo) {
  console.error("No owner/administrator account found to attribute these invoices to.")
  process.exit(1)
}

const completedOrders = await Order.find({ status: "completed" })
let created = 0
for (const order of completedOrders) {
  const existing = await Invoice.findOne({ orderId: order._id })
  if (existing) continue
  const invoice = await createInvoiceFromOrder(order, { createdBy: attributedTo._id })
  console.log(`Created ${invoice.invoiceNumber} for order ${order.orderNumber}`)
  created++
}

console.log(`Done — ${created} invoice(s) backfilled.`)
await mongoose.disconnect()
