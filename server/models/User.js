import mongoose from "mongoose";

export const PLATFORMS = ["web", "android", "ios", "unknown"];
export const PAID_PERIODS = ["monthly", "yearly", "lifetime"];
export const PERIODS = [...PAID_PERIODS, "trial"]; // "trial" = free Pro trial, not paid
export const PAYMENT_PROVIDERS = ["manual", "google_play", "app_store", "razorpay", "stripe", "other"];
export const PROVIDERS = [...PAYMENT_PROVIDERS, "trial"];

// The client sends X-Client: web | android | ios
export const clientPlatform = (req) => {
  const p = String(req.headers["x-client"] || "").toLowerCase();
  return PLATFORMS.includes(p) ? p : "unknown";
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    onboarded: { type: Boolean, default: false },
    profile: {
      gender: { type: String, enum: ["male", "female"], default: "male" },
      age: Number,
      heightCm: Number,
      weightKg: Number,
      targetWeightKg: Number,
      activity: {
        type: String,
        enum: ["sedentary", "light", "moderate", "active"],
        default: "light",
      },
      goal: { type: String, enum: ["lose", "maintain", "gain"], default: "maintain" },
    },
    goals: {
      calories: { type: Number, default: 2000 },
      protein: { type: Number, default: 120 },
      carbs: { type: Number, default: 220 },
      fat: { type: Number, default: 65 },
      steps: { type: Number, default: 10000 },
    },
    weights: [{ date: String, kg: Number }],
    // AI scans used today (UTC day), for the per-user daily limit
    scanUsage: {
      date: String,
      count: { type: Number, default: 0 },
    },
    // ---- Admin / tracking ----
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    disabled: { type: Boolean, default: false }, // blocked by an admin: can't log in or use the API
    aiDailyLimit: { type: Number, min: 0 }, // per-user override of AI_DAILY_SCAN_LIMIT (unset = default)
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 },
    lastActiveAt: { type: Date, index: true }, // last authenticated request (updated at most once a minute)
    signupPlatform: { type: String, enum: PLATFORMS, default: "unknown" },
    lastPlatform: { type: String, enum: PLATFORMS },
    // ---- Subscription ----
    // Pro is active while tier is "pro" and expiresAt is empty (lifetime) or in the future.
    plan: {
      tier: { type: String, enum: ["free", "pro"], default: "free", index: true },
      period: { type: String, enum: PERIODS },
      source: { type: String, enum: PROVIDERS },
      comp: { type: Boolean, default: false }, // Pro given by an admin without a payment (not a paying subscriber)
      since: Date, // when the current Pro period started
      expiresAt: { type: Date, index: true },
      firstProAt: Date, // first time this user ever became paying Pro (for conversion analytics)
      trialStartedAt: Date, // when the free trial started (each user gets one trial)
    },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// The same "is Pro right now" rule, for queries and for code
export const proActiveQuery = (now = new Date()) => ({
  "plan.tier": "pro",
  $or: [{ "plan.expiresAt": null }, { "plan.expiresAt": { $gt: now } }],
});
export const isPro = (user, now = new Date()) =>
  user?.plan?.tier === "pro" && (!user.plan.expiresAt || new Date(user.plan.expiresAt) > now);
// Pro right now through a payment (not the free trial, not Pro given free by an admin)
export const payingQuery = (now = new Date()) => ({
  $and: [proActiveQuery(now), { "plan.period": { $ne: "trial" } }, { "plan.comp": { $ne: true } }],
});
// Pro right now because an admin gave it without a payment
export const compQuery = (now = new Date()) => ({ $and: [proActiveQuery(now), { "plan.comp": true }] });
export const trialQuery = (now = new Date()) => ({ $and: [proActiveQuery(now), { "plan.period": "trial" }] });
export const isOnTrial = (user, now = new Date()) => isPro(user, now) && user.plan.period === "trial";

export default mongoose.model("User", userSchema);
