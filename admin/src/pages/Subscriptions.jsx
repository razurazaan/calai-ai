import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, download } from "../api.js";
import { fmt } from "./charts.jsx";
import { Loading, OutdatedBackend, Pager, Tile, dateOnly, dateTime, money, pct, useApi } from "./shared.jsx";

export function PaymentsTable({ payments, showUser = true, onChange }) {
  const [error, setError] = useState("");
  async function setStatus(p, status) {
    const verb = status === "refunded" ? "Mark this payment as refunded" : "Mark this payment as paid again";
    if (!window.confirm(`${verb}? ${money(p.amount, p.currency)}`)) return;
    const cancelPro = status === "refunded" && window.confirm("Also turn off this user's Pro now?");
    setError("");
    try {
      await api(`/admin/payments/${p._id}`, { method: "PATCH", body: { status, cancelPro } });
      onChange?.();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {showUser && <th>User</th>}
              <th className="num">Amount</th>
              <th>Plan</th>
              <th>Paid via</th>
              <th>Transaction ID / note</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id}>
                <td className="small">{dateTime(p.createdAt)}</td>
                {showUser && (
                  <td>
                    {p.user ? <Link to={`/users/${p.user._id}`} style={{ fontWeight: 600 }}>{p.user.name}</Link> : <span className="muted">Deleted user</span>}
                    {p.user && <div className="small muted">{p.user.email}</div>}
                  </td>
                )}
                <td className="num" style={{ fontWeight: 600, textDecoration: p.status === "refunded" ? "line-through" : "none" }}>{money(p.amount, p.currency)}</td>
                <td className="small">{p.period}</td>
                <td className="small">{p.provider.replace("_", " ")}</td>
                <td className="small"><div className="clip">{p.reference || "–"}</div>{p.note && <div className="muted clip">{p.note}</div>}</td>
                <td>{p.status === "paid" ? <span className="badge good">Paid</span> : <span className="badge bad">Refunded</span>}</td>
                <td>
                  <button className="btn secondary sm" onClick={() => setStatus(p, p.status === "paid" ? "refunded" : "paid")}>
                    {p.status === "paid" ? "Refund" : "Undo refund"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Subscriptions() {
  const overview = useApi("/admin/overview?days=30");
  const pro = useApi("/admin/users?status=pro&sort=expiring&limit=100");
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const status = params.get("status") || "";
  const provider = params.get("provider") || "";
  const page = Number(params.get("page")) || 1;
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => q !== (params.get("q") || "") && set("q", q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const filters = new URLSearchParams({ ...(status && { status }), ...(provider && { provider }), ...(params.get("q") && { q: params.get("q") }) }).toString();
  const payments = useApi(`/admin/payments?${filters}&page=${page}`);
  const [dlError, setDlError] = useState("");

  const subs = overview.data?.subscriptions;
  const cur = subs?.currency || "INR";
  // An old backend answers without subscription data and has no payments route
  if ((overview.data && !subs) || payments.error === "API route not found") return <OutdatedBackend />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {overview.error && <div className="error">{overview.error}</div>}
      {!subs ? <Loading /> : (
        <div className="admin-grid tiles">
          <Tile label="Paying Pro users" value={fmt(subs.active)} sub={`${pct(subs.conversionRate)} of all users`} />
          <Tile label="MRR" value={money(subs.revenue.mrr[cur]?.amount || 0, cur)} sub={`${fmt(subs.revenue.mrr[cur]?.count || 0)} recurring subscribers`} />
          <Tile label="Revenue (30d)" value={money(subs.revenue.inRange[cur]?.amount || 0, cur)} sub={`${fmt(subs.revenue.inRange[cur]?.count || 0)} payments`} />
          <Tile label="Lifetime revenue" value={money(subs.revenue.lifetime[cur]?.amount || 0, cur)} sub={`${fmt(subs.revenue.lifetime[cur]?.count || 0)} payments`} />
          <Tile label="New Pro (30d)" value={fmt(subs.newInRange)} sub="first-time subscribers" />
          <Tile label="Expiring in 7 days" value={fmt(subs.expiringIn7d)} sub={`${fmt(subs.lapsed)} lapsed in total`} />
        </div>
      )}

      <div className="card stack">
        <div className="row between">
          <h2>Pro users (soonest expiry first)</h2>
          <Link className="small muted" to="/users?status=pro">Open in Users →</Link>
        </div>
        {pro.error && <div className="error">{pro.error}</div>}
        {!pro.data ? <Loading /> : pro.data.users.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Plan</th><th>Paid via</th><th>Pro since</th><th>Expires</th></tr></thead>
              <tbody>
                {pro.data.users.map((u) => (
                  <tr key={u._id} className="click" onClick={() => navigate(`/users/${u._id}`)}>
                    <td><div style={{ fontWeight: 600 }}>{u.name}</div><div className="small muted">{u.email}</div></td>
                    <td className="small">{u.plan?.period}</td>
                    <td className="small">{u.plan?.source?.replace("_", " ")}</td>
                    <td className="small">{dateOnly(u.plan?.since)}</td>
                    <td className="small">{u.plan?.expiresAt ? dateOnly(u.plan.expiresAt) : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="small muted">
            No Pro users yet. To make someone Pro, open their page under <Link to="/users">Users</Link> and record a payment or give Pro.
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Payments</h2>
        <div className="toolbar">
          <input className="input grow" placeholder="Search user, transaction ID or note…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
            <option value="">Paid &amp; refunded</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
          <select className="input" value={provider} onChange={(e) => set("provider", e.target.value)} aria-label="Paid via">
            <option value="">Any source</option>
            <option value="manual">Manual</option>
            <option value="google_play">Google Play</option>
            <option value="app_store">App Store</option>
            <option value="razorpay">Razorpay</option>
            <option value="stripe">Stripe</option>
            <option value="other">Other</option>
          </select>
          <button className="btn secondary sm" onClick={() => download(`/admin/export/payments.csv?${filters}`, "payments.csv").catch((e) => setDlError(e.message))}>
            ⬇ Export CSV
          </button>
        </div>
        {dlError && <div className="error" style={{ marginBottom: 12 }}>{dlError}</div>}
        {payments.error && <div className="error">{payments.error}</div>}
        {!payments.data ? <Loading /> : (
          <>
            <div className="small muted" style={{ marginBottom: 8 }}>
              {fmt(payments.data.total)} payments
              {payments.data.totals.map((t) => ` · ${t.status} ${money(t.amount, t.currency)}`).join("")}
            </div>
            {payments.data.payments.length
              ? <PaymentsTable payments={payments.data.payments} onChange={() => { payments.reload(); overview.reload(); pro.reload(); }} />
              : <div className="small muted">No payments match.</div>}
            <Pager page={payments.data.page} pages={payments.data.pages} setPage={(p) => set("page", String(p))} />
          </>
        )}
      </div>
    </div>
  );
}
