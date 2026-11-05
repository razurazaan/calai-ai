import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import os from "node:os";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import logRoutes from "./routes/logs.js";
import aiRoutes from "./routes/ai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../client/dist");
const clientIndex = path.join(clientDist, "index.html");
const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" })); // food photos arrive as base64

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, ai: Boolean(process.env.GEMINI_API_KEY) })
);
app.use("/api/auth", authRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", (_req, res) => res.status(404).json({ message: "API route not found" }));

app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (!existsSync(clientIndex)) return res.status(404).json({ message: "Not found" });
  res.sendFile(clientIndex, (err) => {
    if (err) next(err);
  });
});

app.use((err, _req, res, _next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Image is too large. Please use a smaller photo." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid request body" });
  }
  // Log the message/stack only: body-parser errors carry the raw request body (which may be a photo)
  console.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({ message: status < 500 ? err.message : "Server error" });
});

async function connectDb() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/calai";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log("MongoDB connected successfully");
  } catch (err) {
    if (process.env.NODE_ENV === "production") throw err;
    console.warn(`Could not reach MongoDB (${err.message}).`);
    console.warn("Starting a temporary in-memory MongoDB - data will be lost on restart.");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri("calai"));
    console.log("In-memory MongoDB ready");
  }
}

// LAN addresses, so phones running the Expo app on the same Wi-Fi know where to connect
function lanUrls(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i.address}:${port}`);
}

const PORT = process.env.PORT || 5050;
const HOST = process.env.HOST || "0.0.0.0"; // all interfaces: reachable from phones on the LAN
connectDb()
  .then(() =>
    app.listen(PORT, HOST, () => {
      console.log(`API running on http://localhost:${PORT}`);
      for (const url of lanUrls(PORT)) console.log(`  on your network: ${url}`);
    })
  )
  .catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
