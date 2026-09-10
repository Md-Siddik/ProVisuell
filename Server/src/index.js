import "dotenv/config"
import "express-async-errors"
import express from "express"
import cors from "cors"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { connectDB } from "./db.js"

import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import orderRoutes from "./routes/orders.js"
import appointmentRoutes from "./routes/appointments.js"
import expenseRoutes from "./routes/expenses.js"
import reportRoutes from "./routes/reports.js"
import messageRoutes from "./routes/messages.js"
import uploadRoutes from "./routes/uploads.js"
import emailRoutes from "./routes/email.js"
import notificationRoutes from "./routes/notifications.js"
import invoiceRoutes from "./routes/invoices.js"
import siteContentRoutes from "./routes/siteContent.js"
import cmsCollectionsRoutes from "./routes/cmsCollections.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Accept the configured CLIENT_URL plus any localhost dev port (Vite hops
// ports when 5173 is taken), so local dev doesn't break on a port change.
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173"
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === allowedOrigin || /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true)
      }
      callback(new Error("Not allowed by CORS"))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: "2mb" }))
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")))

app.get("/api/health", (req, res) => res.json({ ok: true }))

app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/appointments", appointmentRoutes)
app.use("/api/expenses", expenseRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/messages", messageRoutes)
app.use("/api/uploads", uploadRoutes)
app.use("/api/email", emailRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/invoices", invoiceRoutes)
app.use("/api/site-content", siteContentRoutes)
app.use("/api/cms-collections", cmsCollectionsRoutes)

// Centralized error handler so a thrown/rejected error in a route
// doesn't take the whole process down.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || "Internal server error" })
})

const port = process.env.PORT || 5000

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`ProVisuell API listening on :${port}`))
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message)
    process.exit(1)
  })
