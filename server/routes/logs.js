import { Router } from "express";
import FoodLog from "../models/FoodLog.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/wrap.js";

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EDITABLE = [
  "date", "name", "mealType", "servings", "calories", "protein", "carbs", "fat",
  "healthScore", "items", "notes", "image", "source", "portionGrams", "confidence",
];

function pick(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

function totalsOf(entries) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    const s = e.servings || 1;
    t.calories += e.calories * s;
    t.protein += e.protein * s;
    t.carbs += e.carbs * s;
    t.fat += e.fat * s;
  }
  for (const k in t) t[k] = Math.round(t[k]);
  return t;
}

// GET /api/logs?date=YYYY-MM-DD -> entries for the day + totals
router.get(
  "/",
  wrap(async (req, res) => {
    const { date } = req.query;
    if (!DATE_RE.test(date || "")) return res.status(400).json({ message: "date is required" });
    const entries = await FoodLog.find({ user: req.userId, date }).sort({ createdAt: -1 });
    res.json({ entries, totals: totalsOf(entries) });
  })
);

// GET /api/logs/summary?from=YYYY-MM-DD&to=YYYY-MM-DD -> per-day totals
router.get(
  "/summary",
  wrap(async (req, res) => {
    const { from, to } = req.query;
    if (!DATE_RE.test(from || "") || !DATE_RE.test(to || ""))
      return res.status(400).json({ message: "from and to are required" });
    const entries = await FoodLog.find(
      { user: req.userId, date: { $gte: from, $lte: to } },
      "date servings calories protein carbs fat"
    );
    const byDay = {};
    for (const e of entries) (byDay[e.date] ||= []).push(e);
    const days = Object.fromEntries(Object.entries(byDay).map(([d, list]) => [d, totalsOf(list)]));
    res.json({ days });
  })
);

// GET /api/logs/streak?today=YYYY-MM-DD -> consecutive logged days ending today or yesterday.
// `today` comes from the client because the day depends on the user's time zone.
router.get(
  "/streak",
  wrap(async (req, res) => {
    const { today } = req.query;
    if (!DATE_RE.test(today || "") || Number.isNaN(Date.parse(`${today}T00:00:00Z`)))
      return res.status(400).json({ message: "today is required" });
    const logged = new Set(
      await FoodLog.distinct("date", { user: req.userId, date: { $lte: today }, calories: { $gt: 0 } })
    );
    const dayBefore = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    let streak = 0;
    let d = logged.has(today) ? today : dayBefore(today);
    while (logged.has(d)) {
      streak++;
      d = dayBefore(d);
    }
    res.json({ streak });
  })
);

router.post(
  "/",
  wrap(async (req, res) => {
    const data = pick(req.body);
    if (!data.name || !DATE_RE.test(data.date || ""))
      return res.status(400).json({ message: "name and date are required" });
    const entry = await FoodLog.create({ ...data, user: req.userId });
    res.status(201).json(entry);
  })
);

router.put(
  "/:id",
  wrap(async (req, res) => {
    const data = pick(req.body);
    if (data.date !== undefined && !DATE_RE.test(data.date))
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    const entry = await FoodLog.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      data,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json(entry);
  })
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    const entry = await FoodLog.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json({ ok: true });
  })
);

export default router;
