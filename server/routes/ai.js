import { Router } from "express";
import { GoogleGenAI, ApiError, ThinkingLevel } from "@google/genai";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/wrap.js";

const router = Router();
router.use(requireAuth);

// ---- Config (all overridable from .env) -------------------------------------------------
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Tried in order when the main model is overloaded or down (comma-separated in .env)
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL);
const DAILY_LIMIT = Number(process.env.AI_DAILY_SCAN_LIMIT) || 20;
const PER_MINUTE_LIMIT = Number(process.env.AI_SCANS_PER_MINUTE) || 5;
const MAX_IMAGE_BYTES = (Number(process.env.AI_MAX_IMAGE_MB) || 4) * 1024 * 1024;
const MAX_DESCRIPTION = 500;
const TIMEOUT_MS = 60_000;
// Per-model limit while fallbacks remain: an overloaded model can take ~40 s just to return 503
const ATTEMPT_TIMEOUT_MS = 25_000;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// ---- Structured output schema -----------------------------------------------------------
const CONFIDENCE = { type: "string", enum: ["high", "medium", "low"] };
const nutrients = {
  calories: { type: "number", description: "kcal" },
  protein: { type: "number", description: "grams" },
  carbs: { type: "number", description: "grams of carbohydrate" },
  fat: { type: "number", description: "grams" },
};

const resultSchema = {
  type: "object",
  properties: {
    isFood: { type: "boolean", description: "false if the input contains no food or drink" },
    foodName: { type: "string", description: "Short meal name, e.g. 'Chicken Biryani with Raita'" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portionGrams: { type: "number", description: "estimated weight in grams" },
          portionDescription: { type: "string", description: "e.g. '2 medium chapatis', '1 katori (150 g)'" },
          ...nutrients,
          confidence: CONFIDENCE,
        },
        required: ["name", "portionGrams", "portionDescription", "calories", "protein", "carbs", "fat", "confidence"],
      },
    },
    portionGrams: { type: "number", description: "total estimated weight of the whole meal in grams" },
    ...nutrients,
    confidence: CONFIDENCE,
    uncertainty: {
      type: "string",
      description: "What is uncertain (dish identity, hidden oil/ghee, portion size). Empty if confident.",
    },
    healthScore: { type: "integer", description: "0-10, how healthy this meal is" },
    notes: { type: "string", description: "One short sentence of feedback for the user" },
  },
  required: [
    "isFood", "foodName", "items", "portionGrams", "calories", "protein", "carbs", "fat",
    "confidence", "uncertainty", "healthScore", "notes",
  ],
};

const SYSTEM = `You are a nutrition analyst inside a calorie-tracking app used heavily in India.
Given a food photo and/or a text description:
1. Identify every food item. Recognise Indian dishes precisely (e.g. biryani, pulao, dosa, masala dosa,
   idli, vada, uttapam, chapati/roti, paratha, naan, puri, plain rice, dal, sambar, rasam, paneer dishes,
   chicken/mutton/fish curry, sabzi, raita, chutney, poha, upma, khichdi, chole, rajma) as well as global foods.
2. Estimate each portion in grams, using plates, katoris, cutlery and hands for scale.
   Typical references: 1 chapati ~40 g, 1 idli ~40 g, 1 plain dosa ~90 g, 1 katori dal/curry ~150 g,
   1 cup cooked rice ~150 g, 1 plate biryani ~300-350 g.
3. Estimate calories, protein, carbs and fat for each item. Account for cooking oil, ghee and butter,
   which are often hidden in Indian dishes.
4. Top-level totals must equal the sum of the items and describe ONE serving of exactly what is shown.
5. Set confidence honestly: "high" only if the dish and portion are clear; "medium" if the portion or a
   hidden ingredient is a guess; "low" if the dish itself is unclear. Explain the main doubt in "uncertainty".
If the user's description adds detail (brand, quantity, cooking method), trust it over the photo.
If there is no food or drink, set isFood to false and use zeros.`;

// ---- Helpers -----------------------------------------------------------------------------
let client;
const getClient = () => (client ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

const utcDay = () => new Date().toISOString().slice(0, 10);
const num = (n) => Math.max(0, Math.round(Number(n) || 0));
const conf = (c) => (["high", "medium", "low"].includes(c) ? c : "medium");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Check the bytes really are the image type they claim to be
function sniffMime(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(4, 8).toString() === "ftyp") return "image/heic"; // HEIC/HEIF container
  return null;
}

function parseImage(dataUrl) {
  if (typeof dataUrl !== "string") throw new HttpError(400, "Invalid image");
  const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new HttpError(400, "Invalid image. Please upload a JPEG, PNG or WebP photo.");
  const [, mimeType, data] = match;
  if (!ALLOWED_MIME.includes(mimeType))
    throw new HttpError(415, "Unsupported image type. Please upload a JPEG, PNG or WebP photo.");
  const buf = Buffer.from(data, "base64");
  if (buf.length > MAX_IMAGE_BYTES)
    throw new HttpError(413, `Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`);
  const sniffed = sniffMime(buf);
  if (!sniffed || (sniffed === "image/heic") !== (mimeType === "image/heic" || mimeType === "image/heif"))
    throw new HttpError(400, "That file doesn't look like a valid image.");
  // Trust the actual bytes over the declared type
  return { mimeType: sniffed === "image/heic" ? mimeType : sniffed, data };
}

// Short-window burst limit, in memory (per server process)
const recent = new Map();
function checkBurst(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < 60_000);
  if (list.length >= PER_MINUTE_LIMIT) {
    throw new HttpError(429, "You're scanning too fast. Please wait a minute and try again.");
  }
  list.push(now);
  recent.set(userId, list);
}

// Atomically reserve one scan from today's quota. Returns scans left after this one.
async function reserveScan(userId) {
  const day = utcDay();
  await User.updateOne(
    { _id: userId, "scanUsage.date": { $ne: day } },
    { $set: { "scanUsage.date": day, "scanUsage.count": 0 } }
  );
  const user = await User.findOneAndUpdate(
    { _id: userId, "scanUsage.date": day, "scanUsage.count": { $lt: DAILY_LIMIT } },
    { $inc: { "scanUsage.count": 1 } },
    { new: true, projection: { scanUsage: 1 } }
  );
  if (!user) {
    throw new HttpError(429, `You've used all ${DAILY_LIMIT} AI scans for today. You can still add food manually.`);
  }
  return DAILY_LIMIT - user.scanUsage.count;
}

const refundScan = (userId) =>
  User.updateOne(
    { _id: userId, "scanUsage.date": utcDay(), "scanUsage.count": { $gt: 0 } },
    { $inc: { "scanUsage.count": -1 } }
  ).catch(() => {});

// Overloaded / server-side / timed-out errors are worth retrying on another model
const isTransient = (err) =>
  (err instanceof ApiError && (err.status >= 500 || err.status === 429)) ||
  err?.name === "AbortError" ||
  /timed? ?out|fetch failed/i.test(err?.message || "");

// Try the main model, then each fallback, until one answers. Returns { response, model }.
async function generateWithFallback(request) {
  const models = [MODEL, ...FALLBACK_MODELS];
  let lastErr;
  for (const [i, model] of models.entries()) {
    const isLast = i === models.length - 1;
    try {
      const response = await getClient().models.generateContent({
        ...request,
        model,
        config: { ...request.config, httpOptions: { timeout: isLast ? TIMEOUT_MS : ATTEMPT_TIMEOUT_MS } },
      });
      return { response, model };
    } catch (err) {
      lastErr = err;
      if (isLast || !isTransient(err)) throw err;
      console.warn(`Gemini model ${model} unavailable (${err.status || err.message}); trying ${models[i + 1]}`);
    }
  }
  throw lastErr;
}

// Turn Gemini SDK / network errors into safe, user-facing messages
function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err instanceof ApiError) {
    // Log status + a trimmed message only (never the request, which contains the photo)
    console.error(`Gemini API error ${err.status}: ${String(err.message).slice(0, 300)}`);
    const msg = String(err.message);
    if (err.status === 429)
      return new HttpError(429, "The AI service is busy or its free-tier limit was reached. Please try again in a minute.");
    if (err.status === 401 || err.status === 403 || /api key/i.test(msg))
      return new HttpError(503, "AI service is not configured correctly (check GEMINI_API_KEY).");
    if (err.status === 404)
      return new HttpError(503, `AI model "${MODEL}" is not available. Check GEMINI_MODEL in .env.`);
    if (err.status === 400)
      return new HttpError(400, "The AI couldn't process this image. Try a different photo.");
    return new HttpError(502, "The AI service is temporarily unavailable. Please try again.");
  }
  if (err?.name === "AbortError" || /timed? ?out/i.test(err?.message || "")) {
    return new HttpError(504, "The AI took too long to respond. Please try again.");
  }
  console.error(`Gemini request failed: ${err?.message}`);
  return new HttpError(502, "Couldn't reach the AI service. Please try again.");
}

// ---- Routes ------------------------------------------------------------------------------

// GET /api/ai/usage -> today's scan quota
router.get(
  "/usage",
  wrap(async (req, res) => {
    const user = await User.findById(req.userId, "scanUsage");
    const used = user?.scanUsage?.date === utcDay() ? user.scanUsage.count : 0;
    res.json({
      enabled: Boolean(process.env.GEMINI_API_KEY),
      limit: DAILY_LIMIT,
      used,
      left: Math.max(0, DAILY_LIMIT - used),
    });
  })
);

// POST /api/ai/analyze  { image?: dataURL, description?: string }
router.post("/analyze", async (req, res) => {
  let reserved = false;
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new HttpError(503, "AI is not configured. Add GEMINI_API_KEY to server/.env and restart the server.");
    }

    const { image, description } = req.body || {};
    const text = typeof description === "string" ? description.trim() : "";
    if (text.length > MAX_DESCRIPTION)
      throw new HttpError(400, `Description is too long (max ${MAX_DESCRIPTION} characters).`);
    if (!image && !text) throw new HttpError(400, "Send a photo or a description");
    const img = image ? parseImage(image) : null;

    checkBurst(req.userId);
    const scansLeft = await reserveScan(req.userId);
    reserved = true;

    const parts = [];
    if (img) parts.push({ inlineData: img });
    parts.push({
      text: text ? `Analyze this meal. User's description: ${text}` : "Analyze this meal.",
    });

    const { response, model } = await generateWithFallback({
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: resultSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    if (response.promptFeedback?.blockReason) {
      throw new HttpError(422, "This image couldn't be analyzed. Please try another photo.");
    }
    let result;
    try {
      result = JSON.parse(response.text || "");
    } catch {
      throw new HttpError(502, "The AI returned an unreadable answer. Please try again.");
    }
    if (!result.isFood) {
      // Still counts as a scan (the request was made), so no refund
      reserved = false;
      throw new HttpError(422, "No food detected. Try a clearer photo or add a description.");
    }

    const items = (Array.isArray(result.items) ? result.items : []).map((i) => ({
      name: String(i.name || "Item"),
      portionGrams: num(i.portionGrams),
      portion: String(i.portionDescription || `${num(i.portionGrams)} g`),
      calories: num(i.calories),
      protein: num(i.protein),
      carbs: num(i.carbs),
      fat: num(i.fat),
      confidence: conf(i.confidence),
    }));
    // Keep totals consistent with the item breakdown the user sees
    const sum = (k) => items.reduce((s, i) => s + i[k], 0);
    const totals = items.length
      ? { portionGrams: sum("portionGrams"), calories: sum("calories"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") }
      : { portionGrams: num(result.portionGrams), calories: num(result.calories), protein: num(result.protein), carbs: num(result.carbs), fat: num(result.fat) };

    res.json({
      name: String(result.foodName || "Meal"),
      ...totals,
      confidence: conf(result.confidence),
      uncertainty: String(result.uncertainty || ""),
      isEstimate: true,
      healthScore: Math.min(10, num(result.healthScore)),
      notes: String(result.notes || ""),
      items,
      scansLeft,
      model,
    });
  } catch (err) {
    if (reserved) await refundScan(req.userId);
    const httpErr = toHttpError(err);
    res.status(httpErr.status).json({ message: httpErr.message });
  }
});

export default router;
