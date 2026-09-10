import { Router } from "express"
import multer from "multer"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { SiteContent } from "../models/SiteContent.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, "..", "..", "uploads")
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")
    cb(null, `site_${Date.now()}_${safe}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // covers hero-style background video too
  fileFilter: (req, file, cb) => {
    if (!/^(image|video)\//.test(file.mimetype)) return cb(new Error("Only image or video files are allowed"))
    cb(null, true)
  },
})

const router = Router()

// Public read — every visitor's page load merges this over the static
// translation defaults. No auth required.
router.get("/", async (req, res) => {
  const lang = req.query.lang || "no"
  const docs = await SiteContent.find({ $or: [{ language: lang }, { language: null }] })
  const content = {}
  for (const doc of docs) content[doc.contentKey] = doc.value
  res.json({ content })
})

// Everything below writes content — administrator only.
router.use(verifyFirebaseToken, requireRole(["administrator"]))

router.put("/:key", async (req, res) => {
  const { key } = req.params
  const { value, language, type } = req.body || {}
  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({ error: "value is required" })
  }
  const resolvedType = type === "image" || type === "video" ? type : "text"
  const resolvedLanguage = resolvedType === "text" ? language || "no" : null

  const doc = await SiteContent.findOneAndUpdate(
    { contentKey: key, language: resolvedLanguage },
    { contentKey: key, language: resolvedLanguage, type: resolvedType, value, updatedBy: req.user._id },
    { upsert: true, new: true }
  )
  res.json({ content: doc })
})

router.post("/upload-media", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" })
  res.status(201).json({ url: `/uploads/${req.file.filename}` })
})

router.delete("/:key", async (req, res) => {
  const language = req.query.language || null
  await SiteContent.deleteOne({ contentKey: req.params.key, language })
  res.status(204).end()
})

export default router
