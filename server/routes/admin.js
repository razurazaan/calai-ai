import { Router } from "express";
import mongoose from "mongoose";
import User, { isPro, proActiveQuery, payingQuery, trialQuery, compQuery, PAID_PERIODS as PERIODS, PAYMENT_PROVIDERS as PROVIDERS } from "../models/User.js";
import FoodLog from "../models/FoodLog.js";
import AiEvent from "../models/AiEvent.js";
import Payment from "../models/Payment.js";
import DailyActive from "../models/DailyActive.js";
import { requireAuth, requireAdmin, forgetUserStatus } from "../middleware/auth.js";
import { wrap } from "../utils/wrap.js";
import { deleteUserAndData } from "../utils/deleteUser.js";
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT, PRO_PRICES, activatePro, aiLimitFor, cancelPro, planLimit } from "../utils/subscription.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const DAY_MS = 86_400_000;
const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
const clampDays = (v) => Math.min(365, Math.max(1, Math.round(Number(v)) || 30));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Every UTC day from `since` through today, so charts have no gaps
function dayList(since) {
  const out = [];
  for (let t = Date.parse(utcDay(since)); t <= Date.now(); t += DAY_MS) out.push(utcDay(new Date(t)));
  return out;
}

const dayExpr = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

// { day -> { key -> count } } from an aggregation grouped by day and one field
async function countByDay(Model, match, field) {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { day: dayExpr, key: field ? `$${field}` : "all" }, n: { $sum: 1 } } },
  ]);
  const out = {};
  for (const r of rows) (out[r._id.day] ||= {})[r._id.key ?? "unknown"] = r.n;
  return out;
}

const tally = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? "unknown", r.n]));

// { currency -> { amount, count } } from rows grouped by { currency, ... }
const byCurrency = (rows) =>
  Object.fromEntries(rows.map((r) => [r._id.currency || r._id, { amount: Math.round(r.amount * 100) / 100, count: r.n }]));

// Pro subscribers, conversion and revenue
async function subscriptionStats(since, totalUsers) {
  const now = new Date();
  const active = proActiveQuery(now); // paying + trial
  const paying = payingQuery(now);
  const soon = new Date(now.getTime() + 7 * DAY_MS);
  const inRange = { createdAt: { $gte: since } };
  const [
    proActive, byPeriod, bySource, newPro, lapsed, expiringSoon,
    paidRange, refundedRange, paidLifetime, mrrRows, newProDaily, revenueDaily,
    onTrial, trialsStarted, trialsEver, trialsConverted, trialsDaily, onComp,
  ] = await Promise.all([
    User.countDocuments(paying),
    User.aggregate([{ $match: active }, { $group: { _id: "$plan.period", n: { $sum: 1 } } }]),
    User.aggregate([{ $match: active }, { $group: { _id: "$plan.source", n: { $sum: 1 } } }]),
    User.countDocuments({ "plan.firstProAt": { $gte: since } }),
    // Paid at some point, not Pro now
    User.countDocuments({ "plan.firstProAt": { $ne: null }, $nor: [active] }),
    User.countDocuments({ $and: [paying, { "plan.expiresAt": { $gt: now, $lte: soon } }] }),
    Payment.aggregate([{ $match: { ...inRange, status: "paid" } }, { $group: { _id: "$currency", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { ...inRange, status: "refunded" } }, { $group: { _id: "$currency", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: "$currency", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    // Monthly recurring revenue: each active Pro user's latest monthly/yearly payment, yearly ÷ 12
    Payment.aggregate([
      { $match: { status: "paid", period: { $in: ["monthly", "yearly"] } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$user", amount: { $first: "$amount" }, currency: { $first: "$currency" }, period: { $first: "$period" } } },
      { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $match: { "u.plan.tier": "pro", $or: [{ "u.plan.expiresAt": null }, { "u.plan.expiresAt": { $gt: now } }] } },
      {
        $group: {
          _id: "$currency",
          amount: { $sum: { $cond: [{ $eq: ["$period", "yearly"] }, { $divide: ["$amount", 12] }, "$amount"] } },
          n: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      { $match: { "plan.firstProAt": { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$plan.firstProAt" } }, n: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { ...inRange, status: "paid" } },
      { $group: { _id: { day: dayExpr, currency: "$currency" }, amount: { $sum: "$amount" } } },
    ]),
    User.countDocuments(trialQuery(now)),
    User.countDocuments({ "plan.trialStartedAt": { $gte: since } }),
    User.countDocuments({ "plan.trialStartedAt": { $ne: null } }),
    User.countDocuments({ "plan.trialStartedAt": { $ne: null }, "plan.firstProAt": { $ne: null } }),
    User.aggregate([
      { $match: { "plan.trialStartedAt": { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$plan.trialStartedAt" } }, n: { $sum: 1 } } },
    ]),
    User.countDocuments(compQuery(now)),
  ]);

  // Charts show one currency: the one with the most lifetime revenue
  const lifetime = byCurrency(paidLifetime);
  const currency = Object.entries(lifetime).sort((a, b) => b[1].amount - a[1].amount)[0]?.[0] || "INR";
  const revenueByDay = {};
  for (const r of revenueDaily) if (r._id.currency === currency) revenueByDay[r._id.day] = r.amount;

  return {
    newProDaily: tally(newProDaily),
    trialsDaily: tally(trialsDaily),
    revenueDaily: revenueByDay,
    summary: {
      active: proActive, // paying Pro (trials and free admin grants not included)
      comp: onComp, // Pro given free by an admin
      free: totalUsers - proActive - onTrial - onComp,
      trial: { active: onTrial, startedInRange: trialsStarted, ever: trialsEver, converted: trialsConverted, conversionRate: trialsEver ? trialsConverted / trialsEver : null },
      prices: PRO_PRICES,
      conversionRate: totalUsers ? proActive / totalUsers : null,
      newInRange: newPro,
      lapsed,
      expiringIn7d: expiringSoon,
      byPeriod: tally(byPeriod),
      bySource: tally(bySource),
      currency,
      revenue: {
        inRange: byCurrency(paidRange),
        refundedInRange: byCurrency(refundedRange),
        lifetime,
        mrr: byCurrency(mrrRows),
      },
    },
  };
}

// Which platforms people use: sign-ups (stored on the user) and active users (daily-activity rows)
async function platformStats(since) {
  const [signups, activeInRange, daily, first] = await Promise.all([
    User.aggregate([{ $group: { _id: { $ifNull: ["$signupPlatform", "unknown"] }, n: { $sum: 1 } } }]),
    DailyActive.aggregate([
      { $match: { day: { $gte: utcDay(since) } } },
      { $unwind: "$platforms" },
      { $group: { _id: "$platforms", users: { $addToSet: "$user" } } },
      { $project: { n: { $size: "$users" } } },
    ]),
    DailyActive.aggregate([
      { $match: { day: { $gte: utcDay(since) } } },
      { $unwind: "$platforms" },
      { $group: { _id: { day: "$day", p: "$platforms" }, n: { $sum: 1 } } },
    ]),
    DailyActive.findOne({}, { day: 1 }).sort({ day: 1 }).lean(),
  ]);
  const byDay = {};
  for (const r of daily) (byDay[r._id.day] ||= {})[r._id.p] = r.n;
  return { signups: tally(signups), activeInRange: tally(activeInRange), daily: byDay, trackingSince: first?.day || null };
}

// ---- GET /api/admin/overview?days=30 ------------------------------------------------------
router.get(
  "/overview",
  wrap(async (req, res) => {
    const days = clampDays(req.query.days);
    const since = new Date(Date.parse(utcDay()) - (days - 1) * DAY_MS);
    const inRange = { createdAt: { $gte: since } };
    const now = Date.now();
    const ago = (ms) => new Date(now - ms);

    const [
      totalUsers, newUsers, admins, disabled, onboarded,
      active1, active7, active30,
      totalLogs, logsBySource, aiByKind, aiByStatus, aiByModel, aiStats,
      signupsDaily, aiDaily, logsDaily, activeDaily, topFoods, topUsers, errors,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments(inRange),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ disabled: true }),
      User.countDocuments({ onboarded: true }),
      User.countDocuments({ lastActiveAt: { $gte: ago(DAY_MS) } }),
      User.countDocuments({ lastActiveAt: { $gte: ago(7 * DAY_MS) } }),
      User.countDocuments({ lastActiveAt: { $gte: ago(30 * DAY_MS) } }),
      FoodLog.countDocuments(inRange),
      FoodLog.aggregate([{ $match: inRange }, { $group: { _id: "$source", n: { $sum: 1 } } }]),
      AiEvent.aggregate([{ $match: inRange }, { $group: { _id: "$kind", n: { $sum: 1 } } }]),
      AiEvent.aggregate([{ $match: inRange }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      AiEvent.aggregate([
        { $match: { ...inRange, status: "success" } },
        { $group: { _id: "$model", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      AiEvent.aggregate([
        { $match: inRange },
        {
          $group: {
            _id: null,
            calls: { $sum: 1 },
            users: { $addToSet: "$user" },
            tokens: { $sum: { $ifNull: ["$tokens.total", 0] } },
            promptTokens: { $sum: { $ifNull: ["$tokens.prompt", 0] } },
            outputTokens: { $sum: { $ifNull: ["$tokens.output", 0] } },
            avgLatency: { $avg: { $cond: [{ $eq: ["$status", "success"] }, "$latencyMs", null] } },
            imageBytes: { $sum: { $ifNull: ["$imageBytes", 0] } },
          },
        },
        { $project: { calls: 1, users: { $size: "$users" }, tokens: 1, promptTokens: 1, outputTokens: 1, avgLatency: 1, imageBytes: 1 } },
      ]),
      countByDay(User, inRange),
      countByDay(AiEvent, inRange, "kind"),
      countByDay(FoodLog, inRange, "source"),
      // Distinct users who used the app per day: daily-activity rows, plus food logs and AI requests
      // (those also cover the days before daily-activity tracking existed)
      FoodLog.aggregate([
        { $match: inRange },
        { $project: { day: dayExpr, user: 1 } },
        {
          $unionWith: {
            coll: AiEvent.collection.name,
            pipeline: [{ $match: inRange }, { $project: { day: dayExpr, user: 1 } }],
          },
        },
        {
          $unionWith: {
            coll: DailyActive.collection.name,
            pipeline: [{ $match: { day: { $gte: utcDay(since) } } }, { $project: { day: 1, user: 1 } }],
          },
        },
        { $group: { _id: "$day", users: { $addToSet: "$user" } } },
        { $project: { n: { $size: "$users" } } },
      ]),
      AiEvent.aggregate([
        { $match: { ...inRange, status: "success" } },
        { $group: { _id: { $toLower: "$result.name" }, n: { $sum: 1 }, kcal: { $avg: "$result.calories" } } },
        { $sort: { n: -1 } },
        { $limit: 10 },
      ]),
      AiEvent.aggregate([
        { $match: inRange },
        {
          $group: {
            _id: "$user",
            calls: { $sum: 1 },
            photo: { $sum: { $cond: [{ $eq: ["$kind", "photo"] }, 1, 0] } },
            text: { $sum: { $cond: [{ $eq: ["$kind", "text"] }, 1, 0] } },
            tokens: { $sum: { $ifNull: ["$tokens.total", 0] } },
          },
        },
        { $sort: { calls: -1 } },
        { $limit: 10 },
        { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "u" } },
        { $project: { calls: 1, photo: 1, text: 1, tokens: 1, name: { $first: "$u.name" }, email: { $first: "$u.email" } } },
      ]),
      AiEvent.aggregate([
        { $match: { ...inRange, status: { $ne: "success" } } },
        { $group: { _id: { status: "$status", error: "$error" }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const subs = await subscriptionStats(since, totalUsers);
    const platforms = await platformStats(since);

    const activeMap = tally(activeDaily);
    const series = dayList(since).map((day) => ({
      newPro: subs.newProDaily[day] || 0,
      trials: subs.trialsDaily[day] || 0,
      revenue: subs.revenueDaily[day] || 0,
      activeWeb: platforms.daily[day]?.web || 0,
      activeAndroid: platforms.daily[day]?.android || 0,
      activeIos: platforms.daily[day]?.ios || 0,
      day,
      signups: signupsDaily[day]?.all || 0,
      aiPhoto: aiDaily[day]?.photo || 0,
      aiText: aiDaily[day]?.text || 0,
      logsPhoto: logsDaily[day]?.["ai-photo"] || 0,
      logsText: logsDaily[day]?.["ai-text"] || 0,
      logsManual: logsDaily[day]?.manual || 0,
      activeUsers: activeMap[day] || 0,
    }));

    const stats = aiStats[0] || {};
    const statusCounts = tally(aiByStatus);
    res.json({
      days,
      since: utcDay(since),
      users: {
        total: totalUsers, new: newUsers, admins, disabled, onboarded, active1, active7, active30,
        stickiness: active30 ? active1 / active30 : null, // DAU / MAU
      },
      subscriptions: subs.summary,
      platforms: { signups: platforms.signups, activeInRange: platforms.activeInRange, trackingSince: platforms.trackingSince },
      logs: { total: totalLogs, bySource: tally(logsBySource) },
      ai: {
        calls: stats.calls || 0,
        users: stats.users || 0,
        byKind: tally(aiByKind),
        byStatus: statusCounts,
        byModel: tally(aiByModel),
        successRate: stats.calls ? (statusCounts.success || 0) / stats.calls : null,
        avgLatencyMs: stats.avgLatency ? Math.round(stats.avgLatency) : null,
        tokens: { total: stats.tokens || 0, prompt: stats.promptTokens || 0, output: stats.outputTokens || 0 },
        imageMB: Math.round(((stats.imageBytes || 0) / 1024 / 1024) * 10) / 10,
        freeDailyLimit: FREE_DAILY_LIMIT,
        proDailyLimit: PRO_DAILY_LIMIT,
      },
      series,
      topFoods: topFoods.map((f) => ({ name: f._id || "unknown", count: f.n, avgCalories: Math.round(f.kcal || 0) })),
      topUsers: topUsers.map((u) => ({ id: u._id, name: u.name, email: u.email, calls: u.calls, photo: u.photo, text: u.text, tokens: u.tokens })),
      errors: errors.map((e) => ({ status: e._id.status, message: e._id.error, count: e.n })),
    });
  })
);

// ---- GET /api/admin/users?q=&sort=&page=&limit= -------------------------------------------
const SORTS = {
  lastActive: { lastActiveAt: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  aiCalls: { "stats.aiCalls": -1 },
  logs: { "stats.logs": -1 },
  proSince: { "plan.since": -1 },
  expiring: { "plan.expiresAt": 1 },
};

function userFilter(q, status, platform) {
  const and = [];
  if (q) {
    const re = new RegExp(escapeRe(String(q).trim()), "i");
    and.push({ $or: [{ name: re }, { email: re }] });
  }
  if (status === "admin") and.push({ role: "admin" });
  if (status === "disabled") and.push({ disabled: true });
  if (status === "active7") and.push({ lastActiveAt: { $gte: new Date(Date.now() - 7 * DAY_MS) } });
  if (status === "inactive") and.push({ $or: [{ lastActiveAt: null }, { lastActiveAt: { $lt: new Date(Date.now() - 30 * DAY_MS) } }] });
  if (status === "pro") and.push(payingQuery());
  if (status === "trial") and.push(trialQuery());
  if (status === "comp") and.push(compQuery());
  if (status === "free") and.push({ $nor: [proActiveQuery()] });
  if (status === "lapsed") and.push({ "plan.firstProAt": { $ne: null } }, { $nor: [proActiveQuery()] });
  if (["web", "android", "ios"].includes(platform)) and.push({ $or: [{ lastPlatform: platform }, { signupPlatform: platform }] });
  return and.length ? { $and: and } : {};
}

// Users with their lifetime counts attached (for lists and CSV)
function usersWithStats(filter, sort, skip, limit) {
  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: AiEvent.collection.name,
        let: { id: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$user", "$$id"] } } },
          {
            $group: {
              _id: null,
              aiCalls: { $sum: 1 },
              aiPhoto: { $sum: { $cond: [{ $eq: ["$kind", "photo"] }, 1, 0] } },
              aiText: { $sum: { $cond: [{ $eq: ["$kind", "text"] }, 1, 0] } },
              aiFailed: { $sum: { $cond: [{ $ne: ["$status", "success"] }, 1, 0] } },
              tokens: { $sum: { $ifNull: ["$tokens.total", 0] } },
              lastAiAt: { $max: "$createdAt" },
            },
          },
        ],
        as: "ai",
      },
    },
    {
      $lookup: {
        from: FoodLog.collection.name,
        let: { id: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$user", "$$id"] } } },
          { $group: { _id: null, logs: { $sum: 1 }, days: { $addToSet: "$date" }, lastLogAt: { $max: "$createdAt" } } },
        ],
        as: "fl",
      },
    },
    {
      $addFields: {
        stats: {
          aiCalls: { $ifNull: [{ $first: "$ai.aiCalls" }, 0] },
          aiPhoto: { $ifNull: [{ $first: "$ai.aiPhoto" }, 0] },
          aiText: { $ifNull: [{ $first: "$ai.aiText" }, 0] },
          aiFailed: { $ifNull: [{ $first: "$ai.aiFailed" }, 0] },
          tokens: { $ifNull: [{ $first: "$ai.tokens" }, 0] },
          lastAiAt: { $first: "$ai.lastAiAt" },
          logs: { $ifNull: [{ $first: "$fl.logs" }, 0] },
          daysLogged: { $size: { $ifNull: [{ $first: "$fl.days" }, []] } },
          lastLogAt: { $first: "$fl.lastLogAt" },
        },
      },
    },
    { $project: { password: 0, ai: 0, fl: 0, weights: 0 } },
    { $sort: { ...sort, _id: -1 } },
  ];
  if (skip) pipeline.push({ $skip: skip });
  if (limit) pipeline.push({ $limit: limit });
  return User.aggregate(pipeline);
}

const scansToday = (u) => (u.scanUsage?.date === utcDay() ? u.scanUsage.count : 0);

router.get(
  "/users",
  wrap(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const page = Math.max(1, Number(req.query.page) || 1);
    let filter = userFilter(req.query.q, req.query.status, req.query.platform);
    const sort = SORTS[req.query.sort] || SORTS.lastActive;
    // "Pro expiring soonest" only lists Pro that is active and has an end date. Otherwise free users and
    // lifetime Pro (no end date) would sort before every real expiry date.
    if (req.query.sort === "expiring")
      filter = { $and: [filter, proActiveQuery(), { "plan.expiresAt": { $ne: null } }] };
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      usersWithStats(filter, sort, (page - 1) * limit, limit),
    ]);
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      users: users.map((u) => ({ ...u, isPro: isPro(u), scansToday: scansToday(u), aiLimit: aiLimitFor(u) })),
    });
  })
);

// ---- GET /api/admin/users/:id?days=30 -----------------------------------------------------
router.get(
  "/users/:id",
  wrap(async (req, res) => {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    delete user.password;

    const days = clampDays(req.query.days);
    const since = new Date(Date.parse(utcDay()) - (days - 1) * DAY_MS);
    const mine = { user: user._id };
    const [[stats], aiDaily, logsDaily, recentAi, recentLogs, logDays, macroAvg, topFoods, payments, activeDays, platformDays] = await Promise.all([
      usersWithStats({ _id: user._id }, { _id: 1 }),
      countByDay(AiEvent, { ...mine, createdAt: { $gte: since } }, "kind"),
      countByDay(FoodLog, { ...mine, createdAt: { $gte: since } }, "source"),
      AiEvent.find(mine).sort({ createdAt: -1 }).limit(50).lean(),
      FoodLog.find(mine).sort({ createdAt: -1 }).limit(30).lean(),
      // Calories eaten per logged day (in the user's own dates)
      FoodLog.aggregate([
        { $match: { ...mine, date: { $gte: utcDay(since) } } },
        {
          $group: {
            _id: "$date",
            calories: { $sum: { $multiply: ["$calories", { $ifNull: ["$servings", 1] }] } },
          },
        },
      ]),
      FoodLog.aggregate([
        { $match: mine },
        { $group: { _id: "$date", c: { $sum: { $multiply: ["$calories", { $ifNull: ["$servings", 1] }] } }, p: { $sum: { $multiply: ["$protein", { $ifNull: ["$servings", 1] }] } }, cb: { $sum: { $multiply: ["$carbs", { $ifNull: ["$servings", 1] }] } }, f: { $sum: { $multiply: ["$fat", { $ifNull: ["$servings", 1] }] } } } },
        { $group: { _id: null, calories: { $avg: "$c" }, protein: { $avg: "$p" }, carbs: { $avg: "$cb" }, fat: { $avg: "$f" } } },
      ]),
      FoodLog.aggregate([
        { $match: mine },
        { $group: { _id: { $toLower: "$name" }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 8 },
      ]),
      Payment.find(mine).sort({ createdAt: -1 }).limit(100).lean(),
      DailyActive.countDocuments({ ...mine, day: { $gte: utcDay(since) } }),
      DailyActive.aggregate([{ $match: mine }, { $unwind: "$platforms" }, { $group: { _id: "$platforms", n: { $sum: 1 } } }]),
    ]);

    const kcalByDay = tally(logDays.map((d) => ({ _id: d._id, n: Math.round(d.calories) })));
    const series = dayList(since).map((day) => ({
      day,
      aiPhoto: aiDaily[day]?.photo || 0,
      aiText: aiDaily[day]?.text || 0,
      logsManual: logsDaily[day]?.manual || 0,
      calories: kcalByDay[day] ?? null,
    }));
    const avg = macroAvg[0];
    res.json({
      user: { ...user, isPro: isPro(user), scansToday: scansToday(user), aiLimit: aiLimitFor(user), defaultLimit: planLimit(user) },
      payments,
      activity: { activeDays, platformDays: tally(platformDays) },
      stats: stats?.stats || {},
      averages: avg
        ? { calories: Math.round(avg.calories), protein: Math.round(avg.protein), carbs: Math.round(avg.carbs), fat: Math.round(avg.fat) }
        : null,
      topFoods: topFoods.map((f) => ({ name: f._id, count: f.n })),
      series,
      recentAi,
      recentLogs,
    });
  })
);

// ---- PATCH /api/admin/users/:id  { role?, disabled?, aiDailyLimit? (null = default), resetScansToday? }
router.patch(
  "/users/:id",
  wrap(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { role, disabled, aiDailyLimit, resetScansToday, plan } = req.body || {};
    const self = String(user._id) === String(req.userId);

    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
      if (self && role !== "admin") return res.status(400).json({ message: "You can't remove your own admin role" });
      user.role = role;
    }
    if (disabled !== undefined) {
      if (self && disabled) return res.status(400).json({ message: "You can't disable your own account" });
      user.disabled = Boolean(disabled);
    }
    if (aiDailyLimit !== undefined) {
      if (aiDailyLimit === null || aiDailyLimit === "") user.aiDailyLimit = undefined;
      else {
        const n = Number(aiDailyLimit);
        if (!Number.isInteger(n) || n < 0 || n > 10000)
          return res.status(400).json({ message: "AI limit must be a whole number from 0 to 10000" });
        user.aiDailyLimit = n;
      }
    }
    if (resetScansToday) user.scanUsage = { date: utcDay(), count: 0 };
    // plan: { tier: "pro", period, source?, expiresAt? (null = never) } | { tier: "free" }
    if (plan) {
      // No payment comes with this, so it is a free grant unless the user is already on paid Pro
      if (plan.tier === "pro")
        activatePro(user, { period: plan.period, source: plan.source || "manual", expiresAt: plan.expiresAt, paid: false });
      else if (plan.tier === "free") cancelPro(user);
      else return res.status(400).json({ message: "Plan must be pro or free" });
    }
    await user.save();
    forgetUserStatus(user._id); // a block / role change applies on the user's next request
    res.json({ ok: true });
  })
);

// ---- DELETE /api/admin/users/:id  (account, food logs and AI history) ----------------------
router.delete(
  "/users/:id",
  wrap(async (req, res) => {
    if (String(req.params.id) === String(req.userId))
      return res.status(400).json({ message: "You can't delete your own account here" });
    // Payments are kept: they are financial records and still count toward revenue
    const deleted = await deleteUserAndData(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ ok: true, deletedLogs: deleted.deletedLogs, deletedAiEvents: deleted.deletedAiEvents });
  })
);

// ---- POST /api/admin/users/:id/payments  { amount, currency?, period, provider?, reference?, note?, activate? }
// Records a payment and (unless activate is false) turns on / extends Pro by one period.
router.post(
  "/users/:id/payments",
  wrap(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { amount, currency = "INR", period, provider = "manual", reference, note, activate = true } = req.body || {};
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return res.status(400).json({ message: "Enter a valid amount" });
    if (!PERIODS.includes(period)) return res.status(400).json({ message: "Choose monthly, yearly or lifetime" });
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ message: "Invalid payment provider" });
    if (!/^[A-Za-z]{3}$/.test(String(currency))) return res.status(400).json({ message: "Currency must be a 3-letter code like INR" });

    const payment = await Payment.create({
      user: user._id, amount: n, currency, period, provider, reference, note, recordedBy: req.userId,
    });
    if (activate) {
      activatePro(user, { period, source: provider });
      await user.save();
    }
    res.status(201).json({ payment, plan: user.plan, isPro: isPro(user) });
  })
);

// ---- PATCH /api/admin/payments/:id  { status: "paid" | "refunded", cancelPro? } -------------------
router.patch(
  "/payments/:id",
  wrap(async (req, res) => {
    const { status, cancelPro: cancel } = req.body || {};
    if (!["paid", "refunded"].includes(status)) return res.status(400).json({ message: "Status must be paid or refunded" });
    const payment = await Payment.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (cancel) {
      const user = await User.findById(payment.user);
      if (user) {
        cancelPro(user);
        await user.save();
      }
    }
    res.json({ payment });
  })
);

// ---- GET /api/admin/payments?status=&provider=&q=&page= ------------------------------------
async function paymentFilter({ status, provider, q, days }) {
  const filter = {};
  if (["paid", "refunded"].includes(status)) filter.status = status;
  if (PROVIDERS.includes(provider)) filter.provider = provider;
  if (days) filter.createdAt = { $gte: new Date(Date.now() - clampDays(days) * DAY_MS) };
  if (q) {
    const re = new RegExp(escapeRe(String(q).trim()), "i");
    const users = await User.find({ $or: [{ name: re }, { email: re }] }, { _id: 1 }).limit(1000).lean();
    filter.$or = [{ reference: re }, { note: re }, { user: { $in: users.map((u) => u._id) } }];
  }
  return filter;
}

router.get(
  "/payments",
  wrap(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const filter = await paymentFilter(req.query);
    const [total, payments, totals] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "name email plan").lean(),
      Payment.aggregate([{ $match: filter }, { $group: { _id: { currency: "$currency", status: "$status" }, amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    ]);
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      payments,
      totals: totals.map((t) => ({ currency: t._id.currency, status: t._id.status, amount: Math.round(t.amount * 100) / 100, count: t.n })),
    });
  })
);

// ---- GET /api/admin/ai-events?kind=&status=&user=&q=&page= --------------------------------
function eventFilter({ kind, status, user, q, days }) {
  const filter = {};
  if (["photo", "text"].includes(kind)) filter.kind = kind;
  if (status === "failed") filter.status = { $ne: "success" };
  else if (status) filter.status = String(status);
  if (user && mongoose.isValidObjectId(user)) filter.user = oid(user);
  if (q) {
    const re = new RegExp(escapeRe(String(q).trim()), "i");
    filter.$or = [{ description: re }, { "result.name": re }, { error: re }];
  }
  if (days) filter.createdAt = { $gte: new Date(Date.now() - clampDays(days) * DAY_MS) };
  return filter;
}

router.get(
  "/ai-events",
  wrap(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const filter = eventFilter(req.query);
    const [total, events] = await Promise.all([
      AiEvent.countDocuments(filter),
      AiEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email")
        .lean(),
    ]);
    res.json({ total, page, pages: Math.max(1, Math.ceil(total / limit)), events });
  })
);

// ---- GET /api/admin/export/users.csv | ai-events.csv ---------------------------------------
const csvCell = (v) => {
  if (v == null) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Text typed by users (names, food descriptions, notes) that starts with = + - @ or a tab would run as a
  // formula when the file is opened in Excel. A leading ' makes Excel show it as plain text.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

router.get(
  "/export/:file",
  wrap(async (req, res) => {
    let csv;
    if (req.params.file === "users.csv") {
      const users = await usersWithStats({}, { createdAt: -1 });
      csv = toCsv(
        ["id", "name", "email", "role", "disabled", "onboarded", "createdAt", "lastLoginAt", "lastActiveAt", "loginCount",
          "signupPlatform", "lastPlatform", "plan", "proActive", "planPeriod", "planSource", "proGivenFree", "proSince", "proExpiresAt", "firstProAt",
          "aiCalls", "aiPhoto", "aiText", "aiFailed", "tokens", "foodLogs", "daysLogged", "aiDailyLimit",
          "gender", "age", "heightCm", "weightKg", "targetWeightKg", "goal", "activity", "calorieGoal"],
        users.map((u) => [u._id, u.name, u.email, u.role, u.disabled, u.onboarded, u.createdAt, u.lastLoginAt, u.lastActiveAt, u.loginCount,
          u.signupPlatform, u.lastPlatform, u.plan?.tier || "free", isPro(u), u.plan?.period, u.plan?.source, Boolean(u.plan?.comp), u.plan?.since, u.plan?.expiresAt, u.plan?.firstProAt,
          u.stats.aiCalls, u.stats.aiPhoto, u.stats.aiText, u.stats.aiFailed, u.stats.tokens, u.stats.logs, u.stats.daysLogged, u.aiDailyLimit,
          u.profile?.gender, u.profile?.age, u.profile?.heightCm, u.profile?.weightKg, u.profile?.targetWeightKg, u.profile?.goal, u.profile?.activity, u.goals?.calories])
      );
    } else if (req.params.file === "ai-events.csv") {
      const events = await AiEvent.find(eventFilter(req.query)).sort({ createdAt: -1 }).limit(50_000).populate("user", "name email").lean();
      csv = toCsv(
        ["time", "userEmail", "userName", "kind", "status", "httpStatus", "model", "latencyMs", "promptTokens", "outputTokens", "totalTokens",
          "imageBytes", "description", "resultName", "calories", "protein", "carbs", "fat", "confidence", "healthScore", "error"],
        events.map((e) => [e.createdAt, e.user?.email, e.user?.name, e.kind, e.status, e.httpStatus, e.model, e.latencyMs, e.tokens?.prompt, e.tokens?.output, e.tokens?.total,
          e.imageBytes, e.description, e.result?.name, e.result?.calories, e.result?.protein, e.result?.carbs, e.result?.fat, e.result?.confidence, e.result?.healthScore, e.error])
      );
    } else if (req.params.file === "payments.csv") {
      const payments = await Payment.find(await paymentFilter(req.query)).sort({ createdAt: -1 }).limit(50_000).populate("user", "name email").lean();
      csv = toCsv(
        ["time", "userEmail", "userName", "amount", "currency", "period", "provider", "status", "reference", "note"],
        payments.map((p) => [p.createdAt, p.user?.email, p.user?.name, p.amount, p.currency, p.period, p.provider, p.status, p.reference, p.note])
      );
    } else {
      return res.status(404).json({ message: "Unknown export" });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.file}"`);
    res.send("﻿" + csv); // BOM so Excel reads UTF-8 names correctly
  })
);

export default router;
