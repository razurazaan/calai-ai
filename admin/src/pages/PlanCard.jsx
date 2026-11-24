import { useState } from "react";
import { api } from "../api.js";
import { PaymentsTable } from "./Subscriptions.jsx";
import { PlanBadge, dateOnly } from "./shared.jsx";

const PROVIDERS = [
  ["manual", "Manual / cash / UPI"],
  ["google_play", "Google Play"],
  ["app_store", "App Store"],
  ["razorpay", "Razorpay"],
  ["stripe", "Stripe"],
  ["other", "Other"],
];

// Subscription status of one user, with actions to record a payment, give Pro, or cancel it
export default function PlanCard({ user: u, payments, reload }) {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ amount: "", currency: "INR", period: "monthly", provider: "manual", reference: "", note: "", activate: true });
  const [grant, setGrant] = useState({ period: "monthly", expiresAt: "" });
  const plan = u.plan || {};

  async function run(fn, ok) {
    setMsg("");
    setError("");
    setBusy(true);
    try {
      await fn();
      setMsg(ok);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const recordPayment = (e) => {
    e.preventDefault();
    run(async () => {
      await api(`/admin/users/${u._id}/payments`, { method: "POST", body: { ...pay, amount: Number(pay.amount) } });
      setPay((p) => ({ ...p, amount: "", reference: "", note: "" }));
    }, pay.activate ? "Payment recorded and Pro extended" : "Payment recorded");
  };

  const givePro = () =>
    run(
      () =>
        api(`/admin/users/${u._id}`, {
          method: "PATCH",
          body: { plan: { tier: "pro", period: grant.period, source: "manual", ...(grant.expiresAt && { expiresAt: `${grant.expiresAt}T23:59:59Z` }) } },
        }),
      "Pro turned on"
    );

  const cancel = () => {
    if (!window.confirm(`Turn off Pro for ${u.email} now? Their payments stay recorded.`)) return;
    run(() => api(`/admin/users/${u._id}`, { method: "PATCH", body: { plan: { tier: "free" } } }), "Pro turned off");
  };

  const field = (k) => ({ value: pay[k], onChange: (e) => setPay({ ...pay, [k]: e.target.value }) });

  return (
    <div className="card stack">
      <div className="row between" style={{ flexWrap: "wrap" }}>
        <h2>Plan &amp; payments <PlanBadge user={u} /></h2>
        {u.isPro && <button className="btn danger sm" disabled={busy} onClick={cancel}>Cancel Pro now</button>}
      </div>
      <div className="small">
        {u.isPro && plan.period === "trial" ? (
          <>
            <b>Free Pro trial</b> · started {dateOnly(plan.trialStartedAt)} · ends <b>{dateOnly(plan.expiresAt)}</b>
          </>
        ) : u.isPro ? (
          <>
            <b>Pro ({plan.period})</b> {plan.comp ? "given free (no payment)" : <>via {plan.source?.replace("_", " ")}</>} · since {dateOnly(plan.since)} ·{" "}
            {plan.expiresAt ? <>renews / expires <b>{dateOnly(plan.expiresAt)}</b></> : <b>never expires</b>}
          </>
        ) : plan.firstProAt ? (
          <>Free now. Was Pro from {dateOnly(plan.firstProAt)}; ended {dateOnly(plan.expiresAt)}.</>
        ) : (
          <>Free plan. Never paid.</>
        )}
      </div>

      <form className="stack" onSubmit={recordPayment} style={{ gap: 10 }}>
        <div className="small" style={{ fontWeight: 700 }}>Record a payment</div>
        <div className="form-grid">
          <label>Amount<input className="input" type="number" min="0" step="0.01" required placeholder="199" {...field("amount")} /></label>
          <label>Currency<input className="input" maxLength={3} required {...field("currency")} /></label>
          <label>Plan
            <select className="input" {...field("period")}>
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="lifetime">Lifetime</option>
            </select>
          </label>
          <label>Paid via
            <select className="input" {...field("provider")}>{PROVIDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label>Transaction ID<input className="input" placeholder="optional" {...field("reference")} /></label>
          <label>Note<input className="input" placeholder="optional" {...field("note")} /></label>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={pay.activate} onChange={(e) => setPay({ ...pay, activate: e.target.checked })} />
            Also turn on / extend Pro by one {pay.period === "lifetime" ? "lifetime plan" : pay.period === "yearly" ? "year" : "month"}
          </label>
          <button className="btn sm" type="submit" disabled={busy} style={{ marginLeft: "auto" }}>Save payment</button>
        </div>
      </form>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <span className="small" style={{ fontWeight: 700 }}>Give Pro without a payment</span>
        <select className="input" value={grant.period} onChange={(e) => setGrant({ ...grant, period: e.target.value })} aria-label="Pro period">
          <option value="monthly">1 month</option><option value="yearly">1 year</option><option value="lifetime">Lifetime</option>
        </select>
        <label className="row small" style={{ gap: 6 }}>
          or until
          <input className="input" type="date" value={grant.expiresAt} onChange={(e) => setGrant({ ...grant, expiresAt: e.target.value })} />
        </label>
        <button className="btn secondary sm" disabled={busy} onClick={givePro}>{u.isPro ? "Change Pro" : "Give Pro"}</button>
      </div>

      {msg && <div className="small" style={{ color: "var(--good)" }}>✓ {msg}</div>}
      {error && <div className="error">{error}</div>}

      {payments.length ? <PaymentsTable payments={payments} showUser={false} onChange={reload} /> : <div className="small muted">No payments recorded.</div>}
    </div>
  );
}
