import { Router } from "express"
import { Notification } from "../models/Notification.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"

const router = Router()
router.use(verifyFirebaseToken)

router.get("/", async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30)
  res.json({ notifications })
})

router.get("/unread-count", async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, read: false })
  res.json({ count })
})

router.post("/:id/read", async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true })
  res.status(204).end()
})

router.post("/mark-all-read", async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true })
  res.status(204).end()
})

export default router
