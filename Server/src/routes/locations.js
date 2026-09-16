import { Router } from "express"
import { CustomerLocation } from "../models/CustomerLocation.js"
import { Order } from "../models/Order.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"

const router = Router()
router.use(verifyFirebaseToken)

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// A customer may optionally paste a Google Maps share link as a link-only
// fallback (never scraped, never a coordinate source) — this just checks it
// actually points at Google Maps before it's stored.
function isValidGoogleMapsUrl(url) {
  if (!url) return true
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return false
    const host = u.hostname.toLowerCase()
    if (host === "maps.app.goo.gl" || host === "goo.gl" || host === "maps.google.com") return true
    if (/^(www\.)?google\.[a-z.]{2,24}$/.test(host) && u.pathname.startsWith("/maps")) return true
    return false
  } catch {
    return false
  }
}

async function loadOwnedOrder(req, res) {
  const order = await Order.findById(req.params.orderId)
  if (!order) {
    res.status(404).json({ error: "Order not found" })
    return null
  }
  if (req.user.role === "customer" && String(order.customerId) !== String(req.user._id)) {
    res.status(403).json({ error: "Not your order" })
    return null
  }
  return order
}

// Customer: share (or re-share) their current location for one of their own
// orders. Upsert on `order` — sharing again just updates the existing row.
// Name/email always come from the authenticated user's own profile, never
// from the request body.
router.put("/order/:orderId", async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ error: "Only a customer can share their own order's location" })

  const order = await loadOwnedOrder(req, res)
  if (!order) return

  const { lat, lng, locationAccuracy, locatedAt, googleMapsShareUrl } = req.body || {}
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!isValidCoord(latNum, lngNum)) {
    return res.status(400).json({ error: "A valid lat/lng is required" })
  }
  if (!isValidGoogleMapsUrl(googleMapsShareUrl)) {
    return res.status(400).json({ error: "That doesn't look like a Google Maps link" })
  }

  // The GPS reading's own timestamp, when the client has one — falls back
  // to "now" rather than null so a client that can't provide it still gets
  // a sensible display value.
  const locatedAtDate = new Date(locatedAt)
  const locatedAtValue = Number.isFinite(locatedAtDate.getTime()) ? locatedAtDate : new Date()

  const location = await CustomerLocation.findOneAndUpdate(
    { order: order._id },
    {
      customer: req.user._id,
      customerName: req.user.name || req.user.email,
      customerEmail: req.user.email || "",
      order: order._id,
      lat: latNum,
      lng: lngNum,
      locationAccuracy: Number.isFinite(Number(locationAccuracy)) ? Number(locationAccuracy) : null,
      locatedAt: locatedAtValue,
      source: "current_location",
      googleMapsShareUrl: String(googleMapsShareUrl || "").slice(0, 500),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  res.json({ location })
})

// Customer: which of their own orders already have a saved location — used
// by "Mine bestillinger" to show a "location not shared yet" reminder only
// where it's actually missing. Scoped strictly to req.user._id, so this
// never reveals anything about another customer's orders.
router.get("/mine", async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ error: "Only a customer can list their own locations" })
  const locations = await CustomerLocation.find({ customer: req.user._id }).select("order")
  res.json({ orderIds: locations.map((l) => String(l.order)) })
})

// Fetch the saved location for one order — the customer may only read their
// own order's location; staff may read any (needed for the "open full
// order" link from the staff list to work both ways).
router.get("/order/:orderId", async (req, res) => {
  const order = await loadOwnedOrder(req, res)
  if (!order) return

  const location = await CustomerLocation.findOne({ order: order._id })
  res.json({ location: location || null })
})

// Staff-only: every saved location, joined with its order, for the
// "Kundelokasjoner" list. A public/unauthenticated caller — or a plain
// customer — never reaches this: requireRole below 403s them before any
// coordinates are read.
router.get("/", requireRole(["administrator", "owner"]), async (req, res) => {
  const locations = await CustomerLocation.find({})
    .sort({ updatedAt: -1 })
    .populate({
      path: "order",
      select: "orderNumber service status expectedDeliveryDate",
    })

  res.json({ locations: locations.filter((loc) => loc.order) })
})

export default router
