import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: String,
    portion: String,
    portionGrams: Number,
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    confidence: { type: String, enum: ["high", "medium", "low"] },
  },
  { _id: false }
);

const foodLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD in the user's local time
    name: { type: String, required: true },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      default: "snack",
    },
    servings: { type: Number, default: 1 },
    portionGrams: Number, // estimated weight of one serving
    confidence: { type: String, enum: ["high", "medium", "low"] }, // AI estimate confidence
    // Nutrition values are per single serving
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    healthScore: { type: Number, min: 0, max: 10 },
    items: [itemSchema],
    notes: String,
    image: String, // small JPEG thumbnail as data URL
    source: { type: String, enum: ["ai-photo", "ai-text", "manual"], default: "manual" },
  },
  { timestamps: true }
);

export default mongoose.model("FoodLog", foodLogSchema);
