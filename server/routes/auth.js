import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth, JWT_SECRET } from "../middleware/auth.js";
import { computeGoals } from "../utils/goals.js";
import { wrap } from "../utils/wrap.js";

const router = Router();
const sign = (user) => jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });

router.post(
  "/register",
  wrap(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email and password are required" });
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string")
      return res.status(400).json({ message: "Name, email and password must be text" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ message: "An account with this email already exists" });

    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), user });
  })
);

router.post(
  "/login",
  wrap(async (req, res) => {
    const { email = "", password = "" } = req.body;
    if (typeof email !== "string" || typeof password !== "string")
      return res.status(400).json({ message: "Email and password must be text" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Wrong email or password" });
    res.json({ token: sign(user), user });
  })
);

router.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  })
);

// Save body profile and recompute daily goals (used by onboarding and settings)
router.put(
  "/profile",
  requireAuth,
  wrap(async (req, res) => {
    const user = await User.findById(req.userId);
    const p = req.body.profile || {};
    const fields = ["gender", "age", "heightCm", "weightKg", "targetWeightKg", "activity", "goal"];
    for (const f of fields) if (p[f] !== undefined && p[f] !== "") user.profile[f] = p[f];
    if (req.body.name) user.name = req.body.name;

    const goals = computeGoals(user.profile);
    if (goals) user.goals = goals;

    // First weigh-in comes from onboarding
    if (!user.onboarded && user.profile.weightKg) {
      user.weights.push({ date: req.body.today, kg: user.profile.weightKg });
    }
    user.onboarded = true;
    await user.save();
    res.json(user);
  })
);

// Manually override calorie / macro targets
router.put(
  "/goals",
  requireAuth,
  wrap(async (req, res) => {
    const user = await User.findById(req.userId);
    for (const k of ["calories", "protein", "carbs", "fat"]) {
      // A cleared field means "leave as is", not 0. A calorie goal of 0 is never valid.
      const raw = req.body[k];
      if (raw === "" || raw == null) continue;
      const v = Number(raw);
      if (Number.isFinite(v) && v >= (k === "calories" ? 1 : 0)) user.goals[k] = Math.round(v);
    }
    await user.save();
    res.json(user);
  })
);

router.post(
  "/weight",
  requireAuth,
  wrap(async (req, res) => {
    const kg = Number(req.body.kg);
    const date = req.body.date;
    if (!Number.isFinite(kg) || kg <= 0 || !date)
      return res.status(400).json({ message: "Enter a valid weight" });
    const user = await User.findById(req.userId);
    const existing = user.weights.find((w) => w.date === date);
    if (existing) existing.kg = kg;
    else user.weights.push({ date, kg });
    user.weights.sort((a, b) => a.date.localeCompare(b.date));
    user.profile.weightKg = kg;
    await user.save();
    res.json(user);
  })
);

export default router;
