import { Router } from "express";
import User, { clientPlatform, isOnTrial, isPro } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/wrap.js";
import {
  CURRENCY, FREE_DAILY_LIMIT, PRO_DAILY_LIMIT, PRO_PRICES, TRIAL_DAYS, canStartTrial, priceFor, startTrial,
} from "../utils/subscription.js";

const router = Router();
router.use(requireAuth);

const DAY_MS = 86_400_000;

// What the Plans page needs: prices for this platform, the user's plan and whether they can start a trial
function planView(user, platform) {
  const now = Date.now();
  const pro = isPro(user);
  const trial = isOnTrial(user);
  const expiresAt = user.plan?.expiresAt || null;
  return {
    platform,
    currency: CURRENCY,
    price: priceFor(platform), // Pro per month on this platform
    prices: PRO_PRICES,
    trialDays: TRIAL_DAYS,
    limits: { free: FREE_DAILY_LIMIT, pro: PRO_DAILY_LIMIT },
    current: {
      plan: trial ? "trial" : pro ? "pro" : "free",
      period: pro ? user.plan.period : null,
      expiresAt: pro ? expiresAt : null,
      daysLeft: pro && expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS)) : null,
      trialEligible: canStartTrial(user),
      trialUsed: Boolean(user.plan?.trialStartedAt),
      trialEndedAt: !trial && user.plan?.trialStartedAt && !user.plan?.firstProAt ? expiresAt : null,
    },
  };
}

// GET /api/billing/plans
router.get(
  "/plans",
  wrap(async (req, res) => {
    const user = await User.findById(req.userId, "plan");
    res.json(planView(user, clientPlatform(req)));
  })
);

// POST /api/billing/trial -> start the free Pro trial (once per user)
router.post(
  "/trial",
  wrap(async (req, res) => {
    const user = await User.findById(req.userId);
    startTrial(user);
    await user.save();
    res.status(201).json(planView(user, clientPlatform(req)));
  })
);

// POST /api/billing/checkout -> start paying for Pro.
// No payment provider is connected yet. When one is (Google Play Billing for Android, App Store for iOS,
// Razorpay for the website), create the order here and activate Pro from the provider's webhook with
// activatePro() + a Payment row.
router.post(
  "/checkout",
  wrap(async (req, res) => {
    const platform = clientPlatform(req);
    res.status(501).json({
      message: `Online payment for Pro (₹${priceFor(platform)}/month) is coming soon. We'll let you know when you can upgrade.`,
      price: priceFor(platform),
      currency: CURRENCY,
    });
  })
);

export default router;
