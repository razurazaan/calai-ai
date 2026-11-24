import mongoose from "mongoose";
import { PLATFORMS } from "./User.js";

// One row per user per UTC day they used the app (any logged-in request), with the platforms used
// that day. Powers DAU / WAU / MAU and the website / Android / iOS split in the admin website.
const dailyActiveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // YYYY-MM-DD (UTC)
  platforms: [{ type: String, enum: PLATFORMS }],
});
dailyActiveSchema.index({ user: 1, day: 1 }, { unique: true });
dailyActiveSchema.index({ day: 1 });

export default mongoose.model("DailyActive", dailyActiveSchema);
