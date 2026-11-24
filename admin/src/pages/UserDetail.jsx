import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import { AiEventsTable } from "./AiActivity.jsx";
import { HBars, Legend, LineChart, SeriesTable, StackedBars, fmt } from "./charts.jsx";
import PlanCard from "./PlanCard.jsx";
import { Loading, PLATFORM_LABEL, PlanBadge, RangePicker, Tile, dateTime, timeAgo, useApi } from "./shared.jsx";

const AI_SERIES = [
  { key: "aiPhoto", label: "Photo scans", color: "var(--s1)" },
  { key: "aiText", label: "Text analyses", color: "var(--s2)" },
  { key: "logsManual", label: "Manual logs", color: "var(--s3)" },
];
const SOURCE = { "ai-photo": "📸 Photo", "ai-text": "✍️ Text", manual: "🔢 Manual" };

export default function UserDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const { data, error, reload } = useApi(`/admin/users/${id}?days=${days}`);
  const [msg, setMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [limit, setLimit] = useState(null); // null = untouched input

  if (error) return <div className="error">{error} <Link to="/users">Back to users</Link></div>;
  if (!data) return <Loading />;
  const { user: u, stats, series, averages } = data;
  const isMe = u._id === me._id;

  async function act(body, ok) {
    setMsg("");
    setActionError("");
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body });
      setMsg(ok);
      setLimit(null);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${u.email}? This permanently removes the account, all food logs and AI history.`)) return;
    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      navigate("/users", { replace: true });
    } catch (err) {
      setActionError(err.message);
    }
  }

  const p = u.profile || {};
  const bmi = p.heightCm && p.weightKg ? (p.weightKg / (p.heightCm / 100) ** 2).toFixed(1) : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Link to="/users" className="small muted">← All users</Link>

      <div className="card stack">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div className="thumb" style={{ width: 52, height: 52, borderRadius: "50%", fontSize: 22 }}>{u.name[0]?.toUpperCase()}</div>
          <div className="grow">
            <h2>
              {u.name}{" "}
              <PlanBadge user={u} />{" "}
              {u.role === "admin" && <span className="badge good">Admin</span>}{" "}
              {u.disabled && <span className="badge bad">Disabled</span>}{" "}
              {!u.onboarded && <span className="badge warn">Not onboarded</span>}
            </h2>
            <div className="small muted">{u.email}</div>
            <div className="small muted">
              Joined {dateTime(u.createdAt)} · Last login {timeAgo(u.lastLoginAt)} ({fmt(u.loginCount || 0)} logins) · Last active {timeAgo(u.lastActiveAt)}
            </div>
            <div className="small muted">
              Signed up on {PLATFORM_LABEL[u.signupPlatform] || "–"} · Last used {PLATFORM_LABEL[u.lastPlatform] || "–"}
              {Object.keys(data.activity.platformDays).length > 0 && (
                <> · Days active: {Object.entries(data.activity.platformDays).map(([k, v]) => `${PLATFORM_LABEL[k] || k} ${v}`).join(", ")}</>
              )}
            </div>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="btn secondary sm" disabled={isMe} onClick={() => act({ role: u.role === "admin" ? "user" : "admin" }, "Role updated")}>
            {u.role === "admin" ? "Remove admin" : "Make admin"}
          </button>
          <button className="btn secondary sm" disabled={isMe} onClick={() => act({ disabled: !u.disabled }, u.disabled ? "Account enabled" : "Account disabled")}>
            {u.disabled ? "Enable account" : "Disable account"}
          </button>
          <button className="btn secondary sm" onClick={() => act({ resetScansToday: true }, "Today's AI scans reset")}>
            Reset today's scans ({u.scansToday}/{u.aiLimit})
          </button>
          <label className="row small" style={{ gap: 6 }}>
            AI limit/day
            <input
              className="input"
              type="number"
              min="0"
              style={{ width: 90 }}
              value={limit ?? u.aiDailyLimit ?? ""}
              placeholder={`${u.defaultLimit} (default)`}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <button className="btn secondary sm" disabled={limit === null} onClick={() => act({ aiDailyLimit: limit === "" ? null : Number(limit) }, "AI limit saved")}>
            Save limit
          </button>
          <button className="btn danger sm" disabled={isMe} onClick={remove}>Delete user</button>
        </div>
        {msg && <div className="small" style={{ color: "var(--good)" }}>✓ {msg}</div>}
        {actionError && <div className="error">{actionError}</div>}
      </div>

      <PlanCard user={u} payments={data.payments} reload={reload} />

      <div className="admin-grid tiles">
        <Tile label={`Days active (${days}d)`} value={fmt(data.activity.activeDays)} sub="days with any app use" />
        <Tile label="Photo scans" value={fmt(stats.aiPhoto)} sub="lifetime" />
        <Tile label="Text analyses" value={fmt(stats.aiText)} sub="lifetime" />
        <Tile label="Failed AI requests" value={fmt(stats.aiFailed)} sub={`of ${fmt(stats.aiCalls)} total`} />
        <Tile label="Gemini tokens" value={fmt(stats.tokens)} sub={`last AI use ${timeAgo(stats.lastAiAt)}`} />
        <Tile label="Food logs" value={fmt(stats.logs)} sub={`${fmt(stats.daysLogged)} days logged`} />
        <Tile label="Avg daily intake" value={averages ? `${fmt(averages.calories)} kcal` : "–"} sub={averages ? `P${averages.protein} · C${averages.carbs} · F${averages.fat} g` : "no logs"} />
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}><RangePicker days={days} setDays={setDays} /></div>

      <div className="admin-grid two-col">
        <div className="card stack">
          <div className="row between"><h2>Activity per day</h2><Legend series={AI_SERIES} /></div>
          <StackedBars data={series} series={AI_SERIES} />
          <SeriesTable data={series} columns={AI_SERIES} />
        </div>
        <div className="card stack">
          <h2>Calories eaten per day</h2>
          <LineChart data={series} valueKey="calories" label="Calories" unit=" kcal" target={u.goals?.calories} />
          <div className="small muted">Dashed line = calorie goal ({fmt(u.goals?.calories)} kcal). Gaps = nothing logged.</div>
        </div>
        <div className="card stack">
          <h2>Profile & goals</h2>
          <div className="nutri-grid small">
            <div>Gender: <b>{p.gender || "–"}</b></div>
            <div>Age: <b>{p.age ?? "–"}</b></div>
            <div>Height: <b>{p.heightCm ? `${p.heightCm} cm` : "–"}</b></div>
            <div>Weight: <b>{p.weightKg ? `${p.weightKg} kg` : "–"}</b></div>
            <div>Target: <b>{p.targetWeightKg ? `${p.targetWeightKg} kg` : "–"}</b></div>
            <div>BMI: <b>{bmi ?? "–"}</b></div>
            <div>Goal: <b>{p.goal || "–"}</b></div>
            <div>Activity: <b>{p.activity || "–"}</b></div>
          </div>
          <div className="small">
            Daily goals: <b>{fmt(u.goals?.calories)} kcal</b> · P{u.goals?.protein} · C{u.goals?.carbs} · F{u.goals?.fat} g
          </div>
          {u.weights?.length ? (
            <div className="small muted">
              Weight log: {u.weights.slice(-6).map((w) => `${w.date}: ${w.kg} kg`).join(" · ")}
            </div>
          ) : null}
        </div>
        <div className="card stack">
          <h2>Most logged foods</h2>
          <HBars rows={data.topFoods.map((f) => ({ label: f.name, value: f.count }))} empty="Nothing logged yet" />
        </div>
      </div>

      <div className="card stack">
        <div className="row between">
          <h2>AI requests (latest 50)</h2>
          <Link className="small muted" to={`/ai`}>All AI activity →</Link>
        </div>
        <AiEventsTable events={data.recentAi} showUser={false} />
      </div>

      <div className="card stack">
        <h2>Food logs (latest 30)</h2>
        {data.recentLogs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th></th><th>Food</th><th>Date</th><th>Meal</th><th>Source</th><th className="num">kcal</th><th className="num">P / C / F</th><th className="num">Servings</th></tr>
              </thead>
              <tbody>
                {data.recentLogs.map((l) => (
                  <tr key={l._id}>
                    <td>{l.image ? <a href={l.image} target="_blank" rel="noreferrer"><img className="thumb-sm" src={l.image} alt="" /></a> : <div className="thumb-sm">🍽️</div>}</td>
                    <td><div style={{ fontWeight: 600 }}>{l.name}</div>{l.notes && <div className="small muted clip">{l.notes}</div>}</td>
                    <td className="small">{l.date}</td>
                    <td className="small">{l.mealType}</td>
                    <td className="small">{SOURCE[l.source] || l.source}</td>
                    <td className="num">{fmt(Math.round(l.calories * (l.servings || 1)))}</td>
                    <td className="num small">{l.protein} / {l.carbs} / {l.fat}</td>
                    <td className="num">{l.servings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="small muted">No food logged</div>}
      </div>
    </div>
  );
}
