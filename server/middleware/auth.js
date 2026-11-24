import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { clientPlatform } from "../models/User.js";
import "../models/DailyActive.js";

const DEV_SECRET = "dev-secret-change-me";
let secret = process.env.JWT_SECRET || null;

// Call once after MongoDB connects. Without JWT_SECRET in production, a random secret is created once
// and stored in the database, so logins survive restarts. The public dev fallback is never used there.
export async function initJwtSecret() {
  if (secret) return;
  if (process.env.NODE_ENV !== "production") {
    secret = DEV_SECRET;
    return;
  }
  const doc = await mongoose.connection.db
    .collection("appconfig")
    .findOneAndUpdate(
      { _id: "jwtSecret" },
      { $setOnInsert: { value: crypto.randomBytes(48).toString("hex") } },
      { upsert: true, returnDocument: "after" }
    );
  secret = doc.value;
  console.log("JWT_SECRET not set: using the secret stored in the database");
}

export function getJwtSecret() {
  if (!secret) throw new Error("initJwtSecret() must run before handling requests");
  return secret;
}

// Emails in ADMIN_EMAILS (comma-separated) are made admins automatically when they log in
export const isAdminEmail = (email) =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email).toLowerCase());

// userId -> { at, disabled, role }. Avoids a database read on every request; at most once a minute
// per user we re-read the account (so a block takes effect within a minute) and stamp lastActiveAt.
const statusCache = new Map();
const CACHE_MS = 60_000;

export const forgetUserStatus = (userId) => statusCache.delete(String(userId));

async function userStatus(userId) {
  const hit = statusCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const User = mongoose.model("User");
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { lastActiveAt: new Date() } },
    { projection: { disabled: 1, role: 1 } }
  ).lean();
  const status = { at: Date.now(), exists: Boolean(user), disabled: Boolean(user?.disabled), role: user?.role || "user" };
  statusCache.set(userId, status);
  return status;
}

// Daily-active tracking: one DailyActive row per user per UTC day, listing the platforms used.
// The in-memory set means only the first request per user/day/platform touches the database.
let seenDay = "";
const seen = new Set();
function trackActive(userId, platform) {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== seenDay) {
    seen.clear();
    seenDay = day;
  }
  const key = `${userId}|${platform}`;
  if (seen.has(key)) return;
  seen.add(key);
  const user = new mongoose.Types.ObjectId(userId);
  Promise.all([
    mongoose.model("DailyActive").updateOne({ user, day }, { $addToSet: { platforms: platform } }, { upsert: true }),
    platform !== "unknown" && mongoose.model("User").updateOne({ _id: user }, { $set: { lastPlatform: platform } }),
  ]).catch((err) => {
    seen.delete(key); // try again on the next request
    if (err.code !== 11000) console.error("Could not record daily activity:", err.message);
  });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not logged in" });
  try {
    req.userId = jwt.verify(token, getJwtSecret()).id;
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again" });
  }
  try {
    const status = await userStatus(String(req.userId));
    if (!status.exists) return res.status(401).json({ message: "Account not found, please log in again" });
    if (status.disabled) return res.status(403).json({ message: "This account has been disabled." });
    req.userRole = status.role;
    // The admin website sends X-Client: admin; looking at the dashboard isn't app usage
    if (req.headers["x-client"] !== "admin") trackActive(String(req.userId), clientPlatform(req));
    next();
  } catch (err) {
    next(err);
  }
}

// Use after requireAuth. Re-checks the database so a fresh promotion/demotion applies immediately.
export async function requireAdmin(req, res, next) {
  try {
    const user = await mongoose.model("User").findById(req.userId, "role").lean();
    if (user?.role !== "admin") return res.status(403).json({ message: "Admins only" });
    next();
  } catch (err) {
    next(err);
  }
}
