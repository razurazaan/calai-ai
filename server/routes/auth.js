import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { clientPlatform } from "../models/User.js";
import { requireAuth, getJwtSecret, isAdminEmail } from "../middleware/auth.js";
import { computeGoals } from "../utils/goals.js";
import { wrap } from "../utils/wrap.js";
import { deleteUserAndData } from "../utils/deleteUser.js";

const router = Router();
const sign = (user) => jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: "30d" });

// Stamp login stats and promote ADMIN_EMAILS accounts
async function recordLogin(user) {
  const now = new Date();
  user.lastLoginAt = now;
  user.lastActiveAt = now;
  user.loginCount = (user.loginCount || 0) + 1;
  if (user.role !== "admin" && isAdminEmail(user.email)) user.role = "admin";
  await user.save();
}

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

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      signupPlatform: clientPlatform(req),
    });
    await recordLogin(user);
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
    if (user.disabled) return res.status(403).json({ message: "This account has been disabled." });
    await recordLogin(user);
    res.json({ token: sign(user), user });
  })
);

router.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    // Existing sessions pick up ADMIN_EMAILS too, without logging out and in again
    if (user.role !== "admin" && isAdminEmail(user.email)) {
      user.role = "admin";
      await user.save();
    }
    res.json(user);
  })
);

// Delete my account and all of its data (required by the Play Store and App Store).
// The password is asked again so a phone left unlocked can't wipe the account by accident.
router.delete(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const { password = "" } = req.body || {};
    if (typeof password !== "string" || !password)
      return res.status(400).json({ message: "Enter your password to delete your account" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Wrong password", code: "wrong_password" });
    await deleteUserAndData(user._id);
    res.json({ ok: true });
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
    if (goals) user.goals = { ...goals, steps: user.goals?.steps ?? 10000 }; // the step goal isn't derived from the profile

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
    for (const k of ["calories", "protein", "carbs", "fat", "steps"]) {
      // A cleared field means "leave as is", not 0. A calorie or step goal of 0 is never valid.
      const raw = req.body[k];
      if (raw === "" || raw == null) continue;
      const v = Number(raw);
      if (Number.isFinite(v) && v >= (k === "calories" || k === "steps" ? 1 : 0)) user.goals[k] = Math.round(v);
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
