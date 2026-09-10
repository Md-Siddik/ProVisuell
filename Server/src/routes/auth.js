import { Router } from "express"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"

const router = Router()

// Called right after a successful Firebase login/signup. Upserts the Mongo
// user profile (verifyFirebaseToken already does the upsert) and returns it,
// including the role the dashboards/route-guards key off.
router.post("/sync", verifyFirebaseToken, async (req, res) => {
  const { name, phone } = req.body || {}
  const user = req.user
  if (name && !user.name) user.name = name
  if (phone && !user.phone) user.phone = phone
  await user.save()
  res.json({ user })
})

router.get("/me", verifyFirebaseToken, async (req, res) => {
  res.json({ user: req.user })
})

export default router
