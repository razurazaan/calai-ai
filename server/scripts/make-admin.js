// Usage: node scripts/make-admin.js you@example.com [--remove]
// Promotes (or demotes) an existing account. Uses MONGO_URI from .env.
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node scripts/make-admin.js <email> [--remove]");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/calai", { serverSelectionTimeoutMS: 5000 });
const role = flag === "--remove" ? "user" : "admin";
const user = await User.findOneAndUpdate({ email: email.toLowerCase().trim() }, { role }, { new: true });
console.log(user ? `${user.email} is now: ${role}` : `No account with email ${email}. Sign up in the app first.`);
await mongoose.disconnect();
process.exit(user ? 0 : 1);
