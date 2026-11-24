import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import { CountUp, GlowBorder, ShinyText, SpotlightCard } from "../components/fx.jsx";

const PLATFORM_NAME = { android: "Android", ios: "iPhone", web: "the website" };
// Inside the Android / iPhone app, Pro can only be sold through Google Play Billing / Apple In-App
// Purchase, and the app may not point people to cheaper prices elsewhere (store rules). Until store
// billing is connected, the apps show Pro as "coming soon" and don't compare prices.
const IN_APP = Boolean(window.Capacitor?.isNativePlatform?.());
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Check({ children }) {
  return (
    <li>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>
      <span>{children}</span>
    </li>
  );
}

function PlanCard({ name, price, unit = "/month", note, intro, features, badge, current, highlight, action }) {
  return (
    <GlowBorder active={highlight}>
      <SpotlightCard className={`plan ${current ? "current" : ""} ${highlight ? "highlight" : ""}`}>
        <div className="plan-head">
          <h3>{highlight ? <ShinyText>{name}</ShinyText> : name}</h3>
          {current ? <span className="pill current">Current</span> : badge ? <span className="pill">{badge}</span> : null}
        </div>
        <div className="plan-price">
          <span className="amount">₹<CountUp value={price} /></span>
          <span className="unit">{unit}</span>
        </div>
        {note && <div className="plan-note">{note}</div>}
        {intro && <div className="plan-intro">{intro}</div>}
        <ul className="plan-features">{features.map((f, i) => <Check key={i}>{f}</Check>)}</ul>
        <div className="plan-action">{action}</div>
      </SpotlightCard>
    </GlowBorder>
  );
}

export default function Plans() {
  const { setUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api("/billing/plans").then(setData).catch((e) => setError(e.message));
  }, []);

  async function startTrial() {
    setBusy("trial");
    setError("");
    setMsg("");
    try {
      setData(await api("/billing/trial", { method: "POST" }));
      setUser(await api("/auth/me"));
      setMsg("Your free Pro trial has started. Enjoy more AI scans every day! 🎉");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function upgrade() {
    setBusy("pro");
    setError("");
    setMsg("");
    try {
      await api("/billing/checkout", { method: "POST" });
    } catch (e) {
      // 501 until a payment provider is connected: shown as information, not as an error
      if (e.status === 501) setMsg(e.message);
      else setError(e.message);
    } finally {
      setBusy("");
    }
  }

  if (!data) {
    return (
      <div className="plans-page">
        {error ? <div className="error">{error}</div> : <div className="center-load"><div className="spinner" /></div>}
      </div>
    );
  }

  const { current: c, limits, trialDays, price, prices, platform } = data;
  const isTrial = c.plan === "trial";
  const isPaid = c.plan === "pro";

  const freeAction = (
    <button className="plan-btn" disabled>
      {c.plan === "free" ? "Current" : "You return here when Pro ends"}
    </button>
  );

  const trialAction = isTrial ? (
    <>
      <button className="plan-btn" disabled>Current</button>
      <div className="plan-sub">
        {c.daysLeft} day{c.daysLeft === 1 ? "" : "s"} left · ends {shortDate(c.expiresAt)}
      </div>
    </>
  ) : c.trialEligible ? (
    <button className="plan-btn primary" disabled={busy === "trial"} onClick={startTrial}>
      {busy === "trial" ? "Starting…" : `Start ${trialDays}-day free trial`}
    </button>
  ) : (
    <button className="plan-btn" disabled>{isPaid ? "You're on Pro" : "Free trial already used"}</button>
  );

  const proAction = isPaid ? (
    <>
      <button className="plan-btn" disabled>Current</button>
      <div className="plan-sub">{c.expiresAt ? `Renews on ${shortDate(c.expiresAt)}` : "Never expires"}</div>
    </>
  ) : IN_APP ? (
    <button className="plan-btn" disabled>Coming soon</button>
  ) : (
    <button className="plan-btn primary" disabled={busy === "pro"} onClick={upgrade}>
      {busy === "pro" ? "Please wait…" : `Upgrade for ₹${price}/month`}
    </button>
  );

  return (
    <div className="plans-page">
      <Link to="/settings" className="small muted back-link">← Settings</Link>
      <header className="plans-hero">
        <h1><ShinyText>Choose your plan</ShinyText></h1>
        <p className="muted">
          Scan more meals with AI. Try Pro free for {trialDays} days. No payment needed to start.
        </p>
      </header>

      {msg && <div className="plans-msg">{msg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="plans-grid">
        <PlanCard
          name="Free"
          price={0}
          current={c.plan === "free"}
          features={[
            <><b>{limits.free}</b> AI food scans a day (photo or text)</>,
            "Unlimited manual food logging",
            "Personal calorie and macro goals",
            "Weight log, streaks and progress charts",
          ]}
          action={freeAction}
        />
        <PlanCard
          name="Free trial"
          price={0}
          unit={`for ${trialDays} days`}
          note={`Then ₹${price}/month if you choose Pro`}
          badge="Try Pro"
          current={isTrial}
          intro="Everything in Pro, free:"
          features={[
            <><b>{limits.pro}</b> AI food scans a day for <b>{trialDays} days</b></>,
            "No payment details needed to start",
            <>Back to Free automatically after {trialDays} days, unless you pay <b>₹{price}</b></>,
            "One trial per account",
          ]}
          action={trialAction}
        />
        <PlanCard
          name="Pro"
          price={price}
          badge="Best value"
          highlight
          current={isPaid}
          intro="Everything in Free, plus:"
          features={[
            <><b>{limits.pro}</b> AI food scans a day, instead of {limits.free}</>,
            "Scan every meal: breakfast, lunch, dinner and snacks",
            "Photo and text analysis with portion estimates",
            "Supports CalSnap's development",
          ]}
          action={proAction}
        />
      </div>

      <p className="small muted center plans-foot">
        {IN_APP ? (
          "Prices are per month in Indian rupees."
        ) : (
          <>
            Prices are per month in Indian rupees. Pro costs ₹{prices.android} on Android, ₹{prices.web} on the website
            and ₹{prices.ios} on iPhone (App Store fees). You're on {PLATFORM_NAME[platform] || "the website"}.
          </>
        )}
      </p>
    </div>
  );
}
