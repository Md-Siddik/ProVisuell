import { Router } from "express"
import { Expense } from "../models/Expense.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"

const router = Router()
router.use(verifyFirebaseToken, requireRole(["administrator", "owner"]))

router.get("/", async (req, res) => {
  const { from, to } = req.query
  const query = {}
  if (from || to) {
    query.date = {}
    if (from) query.date.$gte = new Date(from)
    if (to) query.date.$lte = new Date(to)
  }
  const expenses = await Expense.find(query).sort({ date: -1 })
  res.json({ expenses })
})

router.post("/", async (req, res) => {
  const { amount, category, date, note } = req.body || {}
  if (!amount || !category || !date) {
    return res.status(400).json({ error: "amount, category and date are required" })
  }
  const expense = await Expense.create({ amount, category, date, note: note || "", createdBy: req.user._id })
  res.status(201).json({ expense })
})

export default router
