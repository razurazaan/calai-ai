import { PAID_PERIODS, PROVIDERS, isPro } from "../models/User.js";

// Daily AI scan limits. Free users get AI_FREE_DAILY_SCAN_LIMIT (default 3); Pro users get
// AI_PRO_DAILY_SCAN_LIMIT (default: the older AI_DAILY_SCAN_LIMIT setting, else 20).
const envInt = (name) => {
  const n = Number(process.env[name]);
  return process.env[name] !== undefined && process.env[name] !== "" && Number.isInteger(n) && n >= 0 ? n : undefined;
};
export const FREE_DAILY_LIMIT = envInt("AI_FREE_DAILY_SCAN_LIMIT") ?? 3;
export const PRO_DAILY_LIMIT = envInt("AI_PRO_DAILY_SCAN_LIMIT") ?? envInt("AI_DAILY_SCAN_LIMIT") ?? 20;

// A user's daily AI limit: an admin's per-user override wins, else the limit of their plan.
// The user document needs the aiDailyLimit and plan fields.
export const planLimit = (user) => (isPro(user) ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT);
export const aiLimitFor = (user) => (Number.isFinite(user?.aiDailyLimit) ? user.aiDailyLimit : planLimit(user));

// Add one billing period to a date (calendar month / year; JS rolls Jan 31 + 1 month into early March)
export function addPeriod(from, period) {
  if (period === "lifetime") return null;
  const d = new Date(from);
  if (period === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

// Turn Pro on (or extend it) for a user document. Does not save.
// - expiresAt given: use it exactly (null = never expires)
// - otherwise: one `period` from now, or from the current expiry if Pro is still active (renewal).
//   An active lifetime plan stays lifetime: adding a month or a year to "never expires" changes nothing.
// - paid: false for Pro an admin gives away without a payment (a "comp" grant). Comp Pro is not counted as
//   a paying subscriber, doesn't set firstProAt, and doesn't use up the free trial. If the user is already
//   on paid Pro, changing it without a payment keeps it paid.
// Use this from a payment webhook too, so every source of Pro behaves the same way.
export function activatePro(user, { period = "monthly", source = "manual", expiresAt, paid = true } = {}) {
  if (!PAID_PERIODS.includes(period)) throw Object.assign(new Error("Invalid plan period"), { status: 400 });
  if (!PROVIDERS.includes(source)) throw Object.assign(new Error("Invalid plan source"), { status: 400 });
  const now = new Date();
  const active = isPro(user, now);
  const plan = user.plan || {};
  const activeLifetime = active && !plan.expiresAt && plan.period !== "trial";

  let expiry;
  let newPeriod = period;
  if (expiresAt !== undefined) {
    expiry = expiresAt === null || expiresAt === "" ? null : new Date(expiresAt);
    if (expiry && Number.isNaN(expiry.getTime())) throw Object.assign(new Error("Invalid expiry date"), { status: 400 });
  } else if (activeLifetime) {
    expiry = null;
    newPeriod = "lifetime";
  } else {
    const base = active && plan.expiresAt ? plan.expiresAt : now;
    expiry = addPeriod(base, period);
  }

  const onPaidPro = active && plan.period !== "trial" && !plan.comp;
  const comp = !paid && !onPaidPro;

  user.plan = {
    tier: "pro",
    period: newPeriod,
    source,
    comp,
    since: active ? plan.since || now : now,
    expiresAt: expiry,
    firstProAt: comp ? plan.firstProAt : plan.firstProAt || now,
    trialStartedAt: plan.trialStartedAt,
  };
}

// ---- Prices and free trial ----
// Pro price per month by platform, in INR. iOS costs more to cover App Store fees.
const envNum = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 && process.env[name] !== "" && process.env[name] !== undefined ? n : fallback;
};
export const CURRENCY = "INR";
export const PRO_PRICES = {
  android: envNum("PRO_PRICE_ANDROID", 30),
  ios: envNum("PRO_PRICE_IOS", 50),
  web: envNum("PRO_PRICE_WEB", 30),
};
export const priceFor = (platform) => PRO_PRICES[platform] ?? PRO_PRICES.web;
export const TRIAL_DAYS = envNum("PRO_TRIAL_DAYS", 10);

// One free trial per user, and only for someone who has never paid
export const canStartTrial = (user) => !user.plan?.trialStartedAt && !user.plan?.firstProAt && !isPro(user);

// Start the free Pro trial (does not save). After TRIAL_DAYS isPro() turns false by itself.
export function startTrial(user) {
  if (!canStartTrial(user)) throw Object.assign(new Error("You've already used your free trial."), { status: 409 });
  const now = new Date();
  user.plan = {
    tier: "pro",
    period: "trial",
    source: "trial",
    since: now,
    expiresAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000),
    firstProAt: user.plan?.firstProAt,
    trialStartedAt: now,
  };
}

// Turn Pro off now (keeps firstProAt so the user still counts as a past subscriber)
export function cancelPro(user) {
  user.set("plan.tier", "free");
  user.set("plan.expiresAt", new Date());
}
