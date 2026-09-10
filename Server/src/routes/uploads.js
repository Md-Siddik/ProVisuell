import { Router } from "express"
import multer from "multer"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, "..", "..", "uploads")
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")
    cb(null, `${Date.now()}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB, matches addorder.png's stated limit
})

const router = Router()
router.use(verifyFirebaseToken, requireRole(["administrator", "owner"]))

router.post("/", upload.array("files", 10), (req, res) => {
  const files = (req.files || []).map((f) => ({
    fileName: f.originalname,
    url: `/uploads/${f.filename}`,
    size: f.size,
  }))
  res.status(201).json({ files })
})

export default router
