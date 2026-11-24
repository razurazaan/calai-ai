import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import { MACROS } from "../utils.js";

// The admin website is a separate site. In development it runs on port 5174 of this machine.
const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:5174` : "");

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [goals, setGoals] = useState(user.goals);
  const [profile, setProfile] = useState(user.profile);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function run(fn, ok) {
    setMsg("");
    setError("");
    try {
      setUser(await fn());
      setMsg(ok);
    } catch (err) {
      setError(err.message);
    }
  }

  const saveGoals = () =>
    run(async () => {
      const u = await api("/auth/goals", { method: "PUT", body: goals });
      setGoals(u.goals); // a cleared field goes back to its saved value
      return u;
    }, "Goals saved");
  const recalc = () =>
    run(async () => {
      const u = await api("/auth/profile", { method: "PUT", body: { profile } });
      setGoals(u.goals);
      return u;
    }, "Profile saved and goals recalculated");

  const setP = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });

  return (
    <div className="app stack" style={{ gap: 16 }}>
      <h1>Settings</h1>

      <div className="card row">
        <div className="thumb" style={{ width: 52, height: 52, borderRadius: "50%", fontSize: 22 }}>
          {user.name[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>{user.name}</div>
          <div className="small muted">{user.email}</div>
        </div>
      </div>

      <PlanSummary plan={user.plan} />

      {user.role === "admin" && ADMIN_URL && (
        <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="card row between" style={{ textDecoration: "none", color: "inherit" }}>
          <div>
            <div style={{ fontWeight: 700 }}>📊 Admin website</div>
            <div className="small muted">Users, Pro subscribers, revenue and analytics</div>
          </div>
          <span className="muted">↗</span>
        </a>
      )}

      {msg && <div className="card small" style={{ color: "var(--good)" }}>✓ {msg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="card stack">
        <h3>Daily goals</h3>
        <label className="field">🔥 Calories
          <input className="input" type="number" value={goals.calories} onChange={(e) => setGoals({ ...goals, calories: e.target.value })} />
        </label>
        <div className="nutri-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {MACROS.map((m) => (
            <label key={m.key} className="field small">
              <span><i className="dot" style={{ background: m.color }} />{m.label} (g)</span>
              <input className="input" type="number" value={goals[m.key]} onChange={(e) => setGoals({ ...goals, [m.key]: e.target.value })} />
            </label>
          ))}
        </div>
        <label className="field">👟 Steps
          <input className="input" type="number" value={goals.steps ?? 10000} onChange={(e) => setGoals({ ...goals, steps: e.target.value })} />
        </label>
        <button className="btn" onClick={saveGoals}>Save goals</button>
      </div>

      <div className="card stack">
        <h3>Profile</h3>
        <div className="nutri-grid">
          <label className="field small">Age<input className="input" type="number" value={profile.age ?? ""} onChange={setP("age")} /></label>
          <label className="field small">Height (cm)<input className="input" type="number" value={profile.heightCm ?? ""} onChange={setP("heightCm")} /></label>
          <label className="field small">Weight (kg)<input className="input" type="number" value={profile.weightKg ?? ""} onChange={setP("weightKg")} /></label>
          <label className="field small">Target (kg)<input className="input" type="number" value={profile.targetWeightKg ?? ""} onChange={setP("targetWeightKg")} /></label>
          <label className="field small">Gender
            <select className="input" value={profile.gender} onChange={setP("gender")}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="field small">Goal
            <select className="input" value={profile.goal} onChange={setP("goal")}>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
            </select>
          </label>
        </div>
        <label className="field small">Activity
          <select className="input" value={profile.activity} onChange={setP("activity")}>
            <option value="sedentary">Mostly sitting</option>
            <option value="light">Lightly active</option>
            <option value="moderate">Active</option>
            <option value="active">Very active</option>
          </select>
        </label>
        <button className="btn secondary" onClick={recalc}>Save & recalculate goals</button>
      </div>

      <button className="btn danger" onClick={logout}>Log out</button>

      <DeleteAccount onDeleted={logout} />

      <div className="small muted center">
        <a href="/privacypolicy.html" target="_blank" rel="noreferrer" className="muted">Privacy policy</a>
      </div>
    </div>
  );
}

// Permanently deletes the account and all of its data, after asking for the password again
function DeleteAccount({ onDeleted }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/me", { method: "DELETE", body: { password } });
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn danger" style={{ opacity: 0.8 }} onClick={() => setOpen(true)}>
        Delete account
      </button>
    );
  }
  return (
    <form className="card stack" onSubmit={remove}>
      <h3 style={{ color: "var(--danger)" }}>Delete account</h3>
      <p className="small muted" style={{ margin: 0 }}>
        This permanently deletes your account, profile, food logs and photos, weight and step history.
        It can't be undone.
      </p>
      <label className="field small">Enter your password to confirm
        <input className="input" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button type="button" className="btn secondary" disabled={busy}
          onClick={() => { setOpen(false); setPassword(""); setError(""); }}>Cancel</button>
        <button type="submit" className="btn" style={{ background: "var(--danger)" }} disabled={busy || !password}>
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </form>
  );
}

// "Your plan" card linking to the Plans page
function PlanSummary({ plan }) {
  const active = plan?.tier === "pro" && (!plan.expiresAt || new Date(plan.expiresAt) > new Date());
  const days = active && plan.expiresAt ? Math.max(0, Math.ceil((new Date(plan.expiresAt) - new Date()) / 86400000)) : null;
  // Only the server knows if this user can still start a trial (one per user, never after paying)
  // and how long the trial is, so ask it instead of assuming
  const [trial, setTrial] = useState(null);
  useEffect(() => {
    if (active) return;
    api("/billing/plans")
      .then((p) => setTrial({ eligible: p.current?.trialEligible, days: p.trialDays }))
      .catch(() => {});
  }, [active]);
  const [title, sub] = !active
    ? ["Free plan", trial?.eligible && trial.days ? `Try Pro free for ${trial.days} days` : "Upgrade to Pro for more AI scans"]
    : plan.period === "trial"
      ? ["Pro free trial", `${days} day${days === 1 ? "" : "s"} left`]
      : ["Pro", plan.expiresAt ? `Renews on ${new Date(plan.expiresAt).toLocaleDateString()}` : "Never expires"];
  return (
    <Link to="/plans" className="card row between plan-link">
      <div>
        <div className="tag">YOUR PLAN</div>
        <div style={{ fontWeight: 700 }}>{active ? "★ " : ""}{title}</div>
        <div className="small muted">{sub}</div>
      </div>
      <span className="muted">{active ? "Manage →" : "See plans →"}</span>
    </Link>
  );
}
