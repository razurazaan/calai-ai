import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { download } from "../api.js";
import { fmt } from "./charts.jsx";
import { KindBadge, Loading, Pager, StatusBadge, dateTime, useApi } from "./shared.jsx";

export function AiEventsTable({ events, showUser = true }) {
  if (!events.length) return <div className="small muted" style={{ padding: 12 }}>No AI requests</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            {showUser && <th>User</th>}
            <th>Type</th>
            <th>What the user typed</th>
            <th>AI result</th>
            <th>Status</th>
            <th>Model</th>
            <th className="num">Time</th>
            <th className="num">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e._id}>
              <td className="small" style={{ whiteSpace: "nowrap" }}>{dateTime(e.createdAt)}</td>
              {showUser && (
                <td className="small">
                  {e.user ? <Link to={`/users/${e.user._id}`}>{e.user.name}</Link> : <span className="muted">Deleted</span>}
                  <div className="muted">{e.user?.email}</div>
                </td>
              )}
              <td>
                <KindBadge kind={e.kind} />
                {e.imageBytes ? <div className="small muted">{Math.round(e.imageBytes / 1024)} KB</div> : null}
              </td>
              <td className="small"><div className="clip" title={e.description}>{e.description || <span className="muted">–</span>}</div></td>
              <td className="small">
                {e.result?.name ? (
                  <>
                    <div className="clip" title={e.result.name} style={{ fontWeight: 600 }}>{e.result.name}</div>
                    <div className="muted">
                      {fmt(e.result.calories)} kcal · P{e.result.protein} C{e.result.carbs} F{e.result.fat} · {e.result.confidence}
                    </div>
                  </>
                ) : (
                  <div className="clip muted" title={e.error}>{e.error || "–"}</div>
                )}
              </td>
              <td><StatusBadge status={e.status} /></td>
              <td className="small muted">{e.model || "–"}</td>
              <td className="num small">{e.latencyMs != null ? `${(e.latencyMs / 1000).toFixed(1)}s` : "–"}</td>
              <td className="num small">{fmt(e.tokens?.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AiActivity() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const kind = params.get("kind") || "";
  const status = params.get("status") || "";
  const page = Number(params.get("page")) || 1;
  const [dlError, setDlError] = useState("");

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

  const filters = new URLSearchParams({
    ...(kind && { kind }),
    ...(status && { status }),
    ...(params.get("q") && { q: params.get("q") }),
  });
  const { data, error, loading } = useApi(`/admin/ai-events?${filters}&page=${page}`);

  return (
    <div className="card">
      <div className="toolbar">
        <input className="input grow" placeholder="Search typed text, food, or error…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {[["", "All"], ["photo", "📸 Photo"], ["text", "✍️ Text"]].map(([v, l]) => (
            <button key={v} className={kind === v ? "active" : ""} onClick={() => set("kind", v)}>{l}</button>
          ))}
        </div>
        <select className="input" value={status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="success">Success</option>
          <option value="failed">All failures</option>
          <option value="no-food">No food detected</option>
          <option value="quota">Daily quota hit</option>
          <option value="rate-limited">Too fast</option>
          <option value="invalid">Invalid input</option>
          <option value="error">AI / server error</option>
        </select>
        <button
          className="btn secondary sm"
          onClick={() => download(`/admin/export/ai-events.csv?${filters}`, "ai-events.csv").catch((e) => setDlError(e.message))}
        >
          ⬇ Export CSV
        </button>
      </div>
      {dlError && <div className="error" style={{ marginBottom: 12 }}>{dlError}</div>}
      {error && <div className="error">{error}</div>}
      {!data ? <Loading /> : (
        <>
          <div className="small muted" style={{ marginBottom: 8 }}>{fmt(data.total)} requests</div>
          <div style={{ opacity: loading ? 0.6 : 1 }}><AiEventsTable events={data.events} /></div>
          <Pager page={data.page} pages={data.pages} setPage={(p) => set("page", String(p))} />
        </>
      )}
    </div>
  );
}
