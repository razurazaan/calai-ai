import { useEffect, useState } from "react";
import { api } from "../api.js";

export function timeAgo(d) {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}

export const pct = (x) => (x == null || !Number.isFinite(x) ? "–" : `${Math.round(x * 100)}%`);

export function money(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString()}`;
  }
}

export const PLATFORM_LABEL = { android: "🤖 Android app", ios: "🍎 iOS app", web: "🌐 Website", unknown: "Unknown / older app" };
export const shortPlatform = (p) => ({ android: "Android", ios: "iOS", web: "Web" })[p] || "–";

export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "–");

// "Pro" / "Pro (expired)" / nothing, from a user with plan + isPro from the API
export function PlanBadge({ user }) {
  if (user.isPro && user.plan?.period === "trial") return <span className="badge pro">★ Trial</span>;
  if (user.isPro) return <span className="badge pro">★ Pro</span>;
  if (user.plan?.firstProAt) return <span className="badge warn">Pro lapsed</span>;
  return null;
}

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "–";

const STATUS = {
  success: ["good", "✓ Success"],
  "no-food": ["warn", "No food"],
  "rate-limited": ["warn", "Too fast"],
  quota: ["warn", "Quota hit"],
  invalid: ["bad", "Invalid input"],
  error: ["bad", "✕ Error"],
};
export function StatusBadge({ status }) {
  const [cls, label] = STATUS[status] || ["", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const KindBadge = ({ kind }) => (
  <span className="badge">
    <i className="swatch" style={{ background: kind === "photo" ? "var(--s1)" : "var(--s2)" }} />
    {kind === "photo" ? "📸 Photo" : "✍️ Text"}
  </span>
);

// Fetch on mount and whenever `path` changes. Returns { data, error, loading, reload }.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(path)
      .then((data) => live && setState({ data, error: "", loading: false }))
      .catch((err) => live && setState((s) => ({ ...s, error: err.message, loading: false })));
    return () => {
      live = false;
    };
  }, [path, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Tile({ label, value, sub }) {
  return (
    <div className="card tile">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {sub ? <span className="sub">{sub}</span> : null}
    </div>
  );
}

export function RangePicker({ days, setDays, options = [7, 30, 90, 365] }) {
  return (
    <div className="seg" role="group" aria-label="Date range">
      {options.map((d) => (
        <button key={d} className={d === days ? "active" : ""} onClick={() => setDays(d)}>
          {d === 365 ? "1y" : `${d}d`}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn secondary sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn secondary sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
    </div>
  );
}

// Shown when the backend answers without the Pro / platform data: it is running code from before the admin website
export const OutdatedBackend = () => (
  <div className="card stack">
    <h2>The backend needs a restart</h2>
    <div className="small">
      The CalSnap server is running an older version that doesn't send Pro, revenue or platform data. Stop it
      (Ctrl+C in its terminal) and start it again with <code>cd calai/server</code> then <code>npm run dev</code>.
      On Render, redeploy the <b>calsnap-api</b> service. Then reload this page.
    </div>
  </div>
);

export const Loading = () => (
  <div style={{ display: "grid", placeItems: "center", padding: 40 }}><div className="spinner" /></div>
);
