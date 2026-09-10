import { Router } from "express"
import { User } from "../models/User.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"

const router = Router()
router.use(verifyFirebaseToken, requireRole(["administrator", "owner"]))

// Lets admins/owners find a customer's real account when registering an
// order, so the order links to the exact email they signed up with instead
// of a hand-typed guess.
router.get("/customers", async (req, res) => {
  const search = (req.query.search || "").trim()
  const query = { role: "customer" }
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    query.$or = [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }]
  }
  const customers = await User.find(query).select("name email").sort({ name: 1 }).limit(8)
  res.json({ customers })
})

export default router
