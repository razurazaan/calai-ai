import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import { addDays, dateStr, parseDate } from "../utils.js";

export default function Progress() {
  const { user, setUser } = useAuth();
  const today = dateStr();
  const [range, setRange] = useState(7);
  const [days, setDays] = useState({});
  const [kg, setKg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/logs/summary?from=${addDays(today, -(range - 1))}&to=${today}`)
      .then((r) => setDays(r.days))
      .catch((e) => setError(e.message));
  }, [range, today]);

  async function logWeight(e) {
    e.preventDefault();
    try {
      setUser(await api("/auth/weight", { method: "POST", body: { kg: Number(kg), date: today } }));
      setKg("");
    } catch (err) {
      setError(err.message);
    }
  }

  const { profile, goals, weights } = user;
  const bmi = profile.weightKg && profile.heightCm ? profile.weightKg / (profile.heightCm / 100) ** 2 : null;
  const dates = Array.from({ length: range }, (_, i) => addDays(today, -(range - 1 - i)));
  const logged = dates.filter((d) => days[d]?.calories);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + days[d].calories, 0) / logged.length) : 0;
  const maxCal = Math.max(goals.calories * 1.3, ...dates.map((d) => days[d]?.calories || 0));

  return (
    <div className="app stack" style={{ gap: 16 }}>
      <h1>Progress</h1>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ gap: 10 }}>
        <div className="card grow">
          <div className="small muted">Current weight</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{profile.weightKg ?? "–"} <span className="small muted">kg</span></div>
          {profile.targetWeightKg && <div className="small muted">Goal: {profile.targetWeightKg} kg</div>}
        </div>
        <div className="card grow">
          <div className="small muted">BMI</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{bmi ? bmi.toFixed(1) : "–"}</div>
          {bmi && <div className="small" style={{ color: bmiColor(bmi) }}>{bmiLabel(bmi)}</div>}
        </div>
      </div>

      <div className="card stack">
        <h3>Weight</h3>
        <WeightChart weights={weights} />
        <form className="row" onSubmit={logWeight}>
          <input className="input grow" type="number" step="0.1" inputMode="decimal" placeholder="Today's weight (kg)" value={kg} onChange={(e) => setKg(e.target.value)} />
          <button className="btn sm" style={{ height: 52 }} disabled={!kg}>Log</button>
        </form>
      </div>

      <div className="card stack">
        <div className="row between">
          <h3>Calories</h3>
          <div className="tabs" style={{ width: 150 }}>
            <button className={range === 7 ? "active" : ""} onClick={() => setRange(7)}>7d</button>
            <button className={range === 30 ? "active" : ""} onClick={() => setRange(30)}>30d</button>
          </div>
        </div>
        <div className="small muted">Average {avg} kcal on logged days · goal {goals.calories}</div>
        <div style={{ position: "relative", height: 160, display: "flex", alignItems: "flex-end", gap: range === 7 ? 10 : 3 }}>
          <div
            style={{
              position: "absolute", left: 0, right: 0, bottom: `${(goals.calories / maxCal) * 100}%`,
              borderTop: "1.5px dashed var(--muted)", opacity: 0.6,
            }}
          />
          {dates.map((d) => {
            const c = days[d]?.calories || 0;
            return (
              <div
                key={d}
                className="chart-bar"
                title={`${d}: ${c} kcal`}
                style={{
                  flex: 1,
                  height: `${Math.max(2, (c / maxCal) * 100)}%`,
                  background: c === 0 ? "var(--soft)" : c > goals.calories * 1.1 ? "var(--protein)" : "var(--primary)",
                  borderRadius: 6,
                }}
              />
            );
          })}
        </div>
        {range === 7 && (
          <div className="row" style={{ gap: 10 }}>
            {dates.map((d) => (
              <div key={d} className="small muted center" style={{ flex: 1 }}>
                {parseDate(d).toLocaleDateString([], { weekday: "narrow" })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WeightChart({ weights }) {
  const pts = weights.slice(-30);
  if (pts.length < 2) return <div className="small muted">Log your weight on a few days to see the trend.</div>;
  const W = 320, H = 110, pad = 8;
  const vals = pts.map((p) => p.kg);
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.kg)}`).join(" ");
  const diff = vals[vals.length - 1] - vals[0];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.kg)} r="3.5" fill="var(--primary)" />)}
      </svg>
      <div className="small muted">
        {diff === 0 ? "No change" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`} since {pts[0].date}
      </div>
    </div>
  );
}

const bmiLabel = (b) => (b < 18.5 ? "Underweight" : b < 25 ? "Healthy" : b < 30 ? "Overweight" : "Obese");
const bmiColor = (b) => (b < 18.5 ? "var(--fat)" : b < 25 ? "var(--good)" : b < 30 ? "var(--carbs)" : "var(--protein)");
