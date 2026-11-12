import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not logged in" });
  try {
    req.userId = jwt.verify(token, getJwtSecret()).id;
    next();
  } catch {
    res.status(401).json({ message: "Session expired, please log in again" });
  }
}
