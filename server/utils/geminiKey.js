import mongoose from "mongoose";

// Call once after MongoDB connects. If GEMINI_API_KEY is not set in the environment, load it from the
// database (appconfig/geminiApiKey), so the key can be configured without the hosting dashboard and
// is never committed to the repository.
export async function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return;
  const doc = await mongoose.connection.db.collection("appconfig").findOne({ _id: "geminiApiKey" });
  if (typeof doc?.value === "string" && doc.value.trim()) {
    process.env.GEMINI_API_KEY = doc.value.trim();
    console.log("GEMINI_API_KEY not set: using the key stored in the database");
  } else {
    console.warn("GEMINI_API_KEY is not set: AI food scanning is disabled");
  }
}
