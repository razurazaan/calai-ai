import { Router } from "express";
import StepLog, { STEP_SOURCES } from "../models/StepLog.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/wrap.js";

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STEPS = 200_000; // more than anyone walks in a day: anything above is bad data
const MAX_DAYS = 62; // per sync request

const validSteps = (v) => Number.isFinite(v) && v >= 0 && v <= MAX_STEPS;

// GET /api/steps?from=YYYY-MM-DD&to=YYYY-MM-DD -> { days: { "YYYY-MM-DD": { steps, source } } }
router.get(
  "/",
  wrap(async (req, res) => {
    const { from, to } = req.query;
    if (!DATE_RE.test(from || "") || !DATE_RE.test(to || ""))
      return res.status(400).json({ message: "from and to are required" });
    const rows = await StepLog.find({ user: req.userId, date: { $gte: from, $lte: to } }, "date steps source").lean();
    res.json({ days: Object.fromEntries(rows.map((r) => [r.date, { steps: r.steps, source: r.source }])) });
  })
);

// PUT /api/steps/sync { source: "health-connect" | "healthkit", days: { "YYYY-MM-DD": steps } }
// Saves the counts read from the phone's health store. Days the user typed in by hand are kept.
router.put(
  "/sync",
  wrap(async (req, res) => {
    const { source, days } = req.body || {};
    if (!STEP_SOURCES.includes(source) || source === "manual")
      return res.status(400).json({ message: "source must be health-connect or healthkit" });
    const entries = Object.entries(days && typeof days === "object" ? days : {})
      .filter(([d, s]) => DATE_RE.test(d) && validSteps(Number(s)))
      .slice(0, MAX_DAYS);
    if (!entries.length) return res.json({ saved: 0 });

    const manual = new Set(
      await StepLog.distinct("date", { user: req.userId, source: "manual", date: { $in: entries.map(([d]) => d) } })
    );
    const ops = entries
      .filter(([d]) => !manual.has(d))
      .map(([date, steps]) => ({
        updateOne: {
          filter: { user: req.userId, date },
          update: { $set: { steps: Math.round(Number(steps)), source } },
          upsert: true,
        },
      }));
    if (ops.length) await StepLog.bulkWrite(ops, { ordered: false });
    res.json({ saved: ops.length });
  })
);

// PUT /api/steps/:date { steps } -> manual entry for one day (steps: null clears it)
router.put(
  "/:date",
  wrap(async (req, res) => {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    if (req.body?.steps === null) {
      await StepLog.deleteOne({ user: req.userId, date });
      return res.json({ date, steps: 0, source: null });
    }
    const steps = Number(req.body?.steps);
    if (!validSteps(steps)) return res.status(400).json({ message: `steps must be between 0 and ${MAX_STEPS}` });
    const row = await StepLog.findOneAndUpdate(
      { user: req.userId, date },
      { $set: { steps: Math.round(steps), source: "manual" } },
      { upsert: true, new: true }
    );
    res.json({ date, steps: row.steps, source: row.source });
  })
);

export default router;
