import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import { dateStr } from "../utils.js";

const STEPS = ["gender", "body", "activity", "goal"];

const ACTIVITY = [
  ["sedentary", "Mostly sitting", "Desk job, little exercise"],
  ["light", "Lightly active", "Workouts 1-3 times a week"],
  ["moderate", "Active", "Workouts 3-5 times a week"],
  ["active", "Very active", "Hard training 6-7 times a week"],
];

const GOALS = [
  ["lose", "Lose weight", "About 0.5 kg per week"],
  ["maintain", "Maintain", "Stay where you are"],
  ["gain", "Gain weight", "Lean bulk, slow and steady"],
];

export default function Onboarding() {
  const { user, setUser, logout } = useAuth();
  const [step, setStep] = useState(0);
  const [p, setP] = useState({
    gender: "male", age: "", heightCm: "", weightKg: "", targetWeightKg: "",
    activity: "light", goal: "maintain",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));
  const bodyValid = p.age >= 10 && p.age <= 100 && p.heightCm >= 100 && p.heightCm <= 250 && p.weightKg >= 25 && p.weightKg <= 350;

  async function finish() {
    setBusy(true);
    setError("");
    try {
      const profile = {
        ...p,
        age: Number(p.age),
        heightCm: Number(p.heightCm),
        weightKg: Number(p.weightKg),
        targetWeightKg: p.targetWeightKg ? Number(p.targetWeightKg) : undefined,
      };
      setUser(await api("/auth/profile", { method: "PUT", body: { profile, today: dateStr() } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const choice = (key, [value, title, sub]) => (
    <button key={value} className={`choice ${p[key] === value ? "active" : ""}`} onClick={() => set(key, value)}>
      {title}
      {sub && <small>{sub}</small>}
    </button>
  );

  const name = STEPS[step];
  const canNext = name !== "body" || bodyValid;

  return (
    <div className="app" style={{ paddingBottom: 24, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <button className="btn secondary sm" onClick={() => (step ? setStep(step - 1) : logout())}>←</button>
        <div className="bar grow">
          <div style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "var(--primary)" }} />
        </div>
      </div>

      <div className="stack grow">
        {name === "gender" && (
          <>
            <h1>Hi {user.name.split(" ")[0]}! Choose your gender</h1>
            <p className="muted">Used to calculate your personalised calorie plan.</p>
            {choice("gender", ["male", "Male"])}
            {choice("gender", ["female", "Female"])}
          </>
        )}

        {name === "body" && (
          <>
            <h1>Your body</h1>
            <p className="muted">We use these to estimate how much energy you burn.</p>
            <label className="field">Age
              <input className="input" type="number" inputMode="numeric" value={p.age} onChange={(e) => set("age", e.target.value)} placeholder="e.g. 28" />
            </label>
            <label className="field">Height (cm)
              <input className="input" type="number" inputMode="decimal" value={p.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="e.g. 172" />
            </label>
            <label className="field">Weight (kg)
              <input className="input" type="number" inputMode="decimal" value={p.weightKg} onChange={(e) => set("weightKg", e.target.value)} placeholder="e.g. 74" />
            </label>
          </>
        )}

        {name === "activity" && (
          <>
            <h1>How active are you?</h1>
            {ACTIVITY.map((a) => choice("activity", a))}
          </>
        )}

        {name === "goal" && (
          <>
            <h1>What's your goal?</h1>
            {GOALS.map((g) => choice("goal", g))}
            {p.goal !== "maintain" && (
              <label className="field">Target weight (kg, optional)
                <input className="input" type="number" inputMode="decimal" value={p.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} />
              </label>
            )}
          </>
        )}
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {step < STEPS.length - 1 ? (
        <button className="btn" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button>
      ) : (
        <button className="btn" disabled={busy} onClick={finish}>
          {busy ? <div className="spinner" /> : "Create my plan"}
        </button>
      )}
    </div>
  );
}
