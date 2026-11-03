import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import { MACROS } from "../utils.js";

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

  const saveGoals = () => run(() => api("/auth/goals", { method: "PUT", body: goals }), "Goals saved");
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
    </div>
  );
}
