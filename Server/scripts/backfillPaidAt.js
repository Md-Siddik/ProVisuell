// One-off: invoices marked "paid" before the paidAt field existed have no
// record of when that happened, which makes them invisible to monthly
// revenue reporting forever. Backfills paidAt from updatedAt (the closest
// available proxy — Mongoose bumps it on the save that set status: "paid").
import "dotenv/config"
import dns from "node:dns"
import mongoose from "mongoose"
import { Invoice } from "../src/models/Invoice.js"

dns.setServers(["8.8.8.8", "1.1.1.1"])

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 })

const paidWithoutDate = await Invoice.find({ status: "paid", paidAt: null })
let updated = 0
for (const inv of paidWithoutDate) {
  inv.paidAt = inv.updatedAt
  await inv.save()
  console.log(`${inv.invoiceNumber}: paidAt set to ${inv.paidAt.toISOString()}`)
  updated++
}

console.log(`Done — ${updated} invoice(s) backfilled.`)
await mongoose.disconnect()
