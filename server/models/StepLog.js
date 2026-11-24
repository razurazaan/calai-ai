import mongoose from "mongoose";

export const STEP_SOURCES = ["health-connect", "healthkit", "manual"];

// One row per user per day: the day's total step count
const stepLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD in the user's local time
    steps: { type: Number, required: true, min: 0 },
    // Where the number came from. A manual entry is never overwritten by a health sync.
    source: { type: String, enum: STEP_SOURCES, default: "manual" },
  },
  { timestamps: true }
);

stepLogSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("StepLog", stepLogSchema);
