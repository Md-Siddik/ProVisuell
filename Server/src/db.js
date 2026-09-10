import dns from "node:dns"
import mongoose from "mongoose"

// Node's built-in DNS resolver can fail SRV lookups (ECONNREFUSED) on
// networks where the OS-configured nameserver doesn't handle them well,
// even though the OS's own resolver handles the same query fine. Pointing
// Node at a public resolver sidesteps that.
dns.setServers(["8.8.8.8", "1.1.1.1"])

export async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error("MONGO_URI is not set in Server/.env")
  mongoose.set("strictQuery", true)
  await mongoose.connect(uri)
  console.log("MongoDB connected")
}
