import { Router } from "express"
import { CmsItem } from "../models/CmsItem.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"

const ALLOWED_COLLECTIONS = ["services", "portfolioItems", "featuredProjects", "headerNav", "heroServices", "socialLinks"]

function validCollection(req, res, next) {
  if (!ALLOWED_COLLECTIONS.includes(req.params.collection)) {
    return res.status(404).json({ error: "Unknown collection" })
  }
  next()
}

function resolveTranslations(translations, lang) {
  const out = {}
  const entries = translations instanceof Map ? translations.entries() : Object.entries(translations || {})
  for (const [field, values] of entries) {
    out[field] = values?.[lang] || values?.no || Object.values(values || {}).find(Boolean) || ""
  }
  return out
}

const router = Router()

// Public read — only published items, translations resolved to one
// language. No auth required; this is what the live marketing site loads.
router.get("/:collection", validCollection, async (req, res) => {
  const lang = req.query.lang || "no"
  const items = await CmsItem.find({ collectionKey: req.params.collection, published: true }).sort({ order: 1 })
  res.json({
    items: items.map((item) => ({
      _id: item._id,
      ...resolveTranslations(item.translations, lang),
      link: item.link,
      image: item.image,
      video: item.video,
      order: item.order,
    })),
  })
})

// Everything below writes or reveals unpublished content — administrator only.
router.use(verifyFirebaseToken, requireRole(["administrator"]))

// Admin read — every item (published + hidden) with raw per-language data,
// used by the Website Editor so every language tab can be edited.
router.get("/:collection/admin", validCollection, async (req, res) => {
  const items = await CmsItem.find({ collectionKey: req.params.collection }).sort({ order: 1 })
  res.json({ items })
})

router.post("/:collection", validCollection, async (req, res) => {
  const { language, fields, link, image, video, published } = req.body || {}
  const translations = {}
  if (language && fields) {
    for (const [fieldName, value] of Object.entries(fields)) {
      translations[fieldName] = { [language]: value }
    }
  }
  const last = await CmsItem.findOne({ collectionKey: req.params.collection }).sort({ order: -1 })
  const item = await CmsItem.create({
    collectionKey: req.params.collection,
    translations,
    link: link || "",
    image: image || "",
    video: video || "",
    published: published !== undefined ? published : true,
    order: (last?.order ?? -1) + 1,
    updatedBy: req.user._id,
  })
  res.status(201).json({ item })
})

router.put("/:collection/:id", validCollection, async (req, res) => {
  const { language, fields, link, image, video, published } = req.body || {}
  const item = await CmsItem.findOne({ _id: req.params.id, collectionKey: req.params.collection })
  if (!item) return res.status(404).json({ error: "Not found" })

  if (language && fields) {
    for (const [fieldName, value] of Object.entries(fields)) {
      const current = { ...(item.translations.get(fieldName) || {}) }
      current[language] = value
      item.translations.set(fieldName, current)
    }
    item.markModified("translations")
  }
  if (link !== undefined) item.link = link
  if (image !== undefined) item.image = image
  if (video !== undefined) item.video = video
  if (published !== undefined) item.published = published
  item.updatedBy = req.user._id

  await item.save()
  res.json({ item })
})

router.delete("/:collection/:id", validCollection, async (req, res) => {
  await CmsItem.deleteOne({ _id: req.params.id, collectionKey: req.params.collection })
  res.status(204).end()
})

// Reorder — body is the full list of item ids in their new display order.
router.post("/:collection/reorder", validCollection, async (req, res) => {
  const { ids } = req.body || {}
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array required" })
  await Promise.all(
    ids.map((id, index) => CmsItem.updateOne({ _id: id, collectionKey: req.params.collection }, { order: index }))
  )
  res.status(204).end()
})

export default router
