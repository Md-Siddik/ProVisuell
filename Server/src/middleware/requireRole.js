export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Not allowed for your role" })
    }
    next()
  }
}
