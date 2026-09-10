import jwt from "jsonwebtoken"
import jwksClient from "jwks-rsa"
import { User } from "../models/User.js"

const projectId = process.env.FIREBASE_PROJECT_ID

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  cache: true,
  cacheMaxAge: 12 * 60 * 60 * 1000,
})

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key.getPublicKey())
  })
}

function verifyIdToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      },
      (err, decoded) => {
        if (err) return reject(err)
        resolve(decoded)
      }
    )
  })
}

// Verifies the Firebase ID token in the Authorization header, loads (or
// creates) the matching Mongo User document, and attaches it as req.user.
export async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: "Missing bearer token" })

  try {
    const decoded = await verifyIdToken(token)
    // Atomic find-or-create — two requests for the same brand-new user
    // arriving close together (e.g. the frontend's auth sync firing
    // alongside other data fetches on first load) must not both try to
    // insert and collide on the unique firebaseUid index.
    const user = await User.findOneAndUpdate(
      { firebaseUid: decoded.sub },
      { $setOnInsert: { firebaseUid: decoded.sub, email: decoded.email || "", name: decoded.name || "" } },
      { upsert: true, new: true }
    )
    req.firebaseUser = decoded
    req.user = user
    next()
  } catch (err) {
    console.error("Token verification failed:", err.message)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}
