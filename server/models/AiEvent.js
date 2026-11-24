import mongoose from "mongoose";

// One row per AI analysis request, successful or not. Powers the admin usage analytics.
const aiEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["photo", "text"], required: true }, // photo = scan (with or without text)
    // success | no-food | rate-limited | quota | invalid | error
    status: { type: String, required: true, index: true },
    httpStatus: Number,
    error: String, // user-facing message for failed requests
    model: String, // Gemini model that answered (after fallbacks)
    latencyMs: Number,
    imageBytes: Number,
    description: String, // text the user typed (max 500 chars)
    tokens: { prompt: Number, output: Number, total: Number },
    result: {
      name: String,
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      confidence: String,
      healthScore: Number,
      itemCount: Number,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
aiEventSchema.index({ createdAt: -1 });

export default mongoose.model("AiEvent", aiEventSchema);
