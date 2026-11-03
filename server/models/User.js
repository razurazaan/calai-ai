import mongoose from "mongoose";

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
    },
    weights: [{ date: String, kg: Number }],
    // AI scans used today (UTC day), for the per-user daily limit
    scanUsage: {
      date: String,
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model("User", userSchema);
