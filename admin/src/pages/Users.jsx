import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { download } from "../api.js";
import { fmt } from "./charts.jsx";
import { Loading, Pager, PlanBadge, dateOnly, shortPlatform, timeAgo, useApi } from "./shared.jsx";

export default function Users() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const sort = params.get("sort") || "lastActive";
  const status = params.get("status") || "";
  const platform = params.get("platform") || "";
  const page = Number(params.get("page")) || 1;
  const navigate = useNavigate();

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => q !== (params.get("q") || "") && set("q", q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const qs = new URLSearchParams({ sort, page, ...(status && { status }), ...(platform && { platform }), ...(params.get("q") && { q: params.get("q") }) });
  const { data, error, loading } = useApi(`/admin/users?${qs}`);
  const [dlError, setDlError] = useState("");

  return (
    <div className="card">
      <div className="toolbar">
        <input className="input grow" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={status} onChange={(e) => set("status", e.target.value)} aria-label="Filter">
          <option value="">All users</option>
          <option value="pro">★ Pro (paying now)</option>
          <option value="trial">On free trial</option>
          <option value="free">Free plan</option>
          <option value="lapsed">Pro lapsed</option>
          <option value="active7">Active last 7 days</option>
          <option value="inactive">Inactive 30+ days</option>
          <option value="admin">Admins</option>
          <option value="disabled">Disabled</option>
        </select>
        <select className="input" value={platform} onChange={(e) => set("platform", e.target.value)} aria-label="Platform">
          <option value="">All platforms</option>
          <option value="android">Android app</option>
          <option value="ios">iOS app</option>
          <option value="web">Website</option>
        </select>
        <select className="input" value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort">
          <option value="lastActive">Recently active</option>
          <option value="newest">Newest sign-ups</option>
          <option value="oldest">Oldest sign-ups</option>
          <option value="aiCalls">Most AI usage</option>
          <option value="logs">Most food logs</option>
          <option value="name">Name A–Z</option>
          <option value="proSince">Newest Pro</option>
          <option value="expiring">Pro expiring soonest</option>
        </select>
        <button className="btn secondary sm" onClick={() => download("/admin/export/users.csv", "users.csv").catch((e) => setDlError(e.message))}>
          ⬇ Export CSV
        </button>
      </div>
      {dlError && <div className="error" style={{ marginBottom: 12 }}>{dlError}</div>}
      {error && <div className="error">{error}</div>}
      {!data ? <Loading /> : (
        <>
          <div className="small muted" style={{ marginBottom: 8 }}>{fmt(data.total)} users</div>
          <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Platform</th>
                  <th>Joined</th>
                  <th>Last active</th>
                  <th className="num">Photo scans</th>
                  <th className="num">Text AI</th>
                  <th className="num">Failed</th>
                  <th className="num">Today</th>
                  <th className="num">Food logs</th>
                  <th className="num">Days logged</th>
                  <th className="num">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u._id} className="click" onClick={() => navigate(`/users/${u._id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {u.name}{" "}
                        <PlanBadge user={u} />{" "}
                        {u.role === "admin" && <span className="badge good">Admin</span>}{" "}
                        {u.disabled && <span className="badge bad">Disabled</span>}
                      </div>
                      <div className="small muted">{u.email}</div>
                    </td>
                    <td className="small">
                      {u.isPro ? <>{u.plan?.period}<div className="muted">{u.plan?.expiresAt ? `until ${dateOnly(u.plan.expiresAt)}` : "never expires"}</div></> : "Free"}
                    </td>
                    <td className="small">{shortPlatform(u.lastPlatform || u.signupPlatform)}</td>
                    <td className="small">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="small">{timeAgo(u.lastActiveAt)}</td>
                    <td className="num">{fmt(u.stats.aiPhoto)}</td>
                    <td className="num">{fmt(u.stats.aiText)}</td>
                    <td className="num">{fmt(u.stats.aiFailed)}</td>
                    <td className="num">{u.scansToday}/{u.aiLimit}</td>
                    <td className="num">{fmt(u.stats.logs)}</td>
                    <td className="num">{fmt(u.stats.daysLogged)}</td>
                    <td className="num">{fmt(u.stats.tokens)}</td>
                  </tr>
                ))}
                {!data.users.length && (
                  <tr><td colSpan={12} className="muted center" style={{ padding: 24 }}>No users match</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} setPage={(p) => set("page", String(p))} />
        </>
      )}
    </div>
  );
}
