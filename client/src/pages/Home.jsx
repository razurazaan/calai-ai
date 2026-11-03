import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";
import Ring from "../components/Ring.jsx";
import FoodEditor from "../components/FoodEditor.jsx";
import Sheet from "../components/Sheet.jsx";
import { addDays, dateStr, MACROS, parseDate, timeOf } from "../utils.js";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = dateStr();
  const [date, setDate] = useState(() => sessionStorage.getItem("calsnap_date") || today);
  const [data, setData] = useState({ entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
  const [week, setWeek] = useState({});
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const weekStart = addDays(today, -6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    try {
      setError("");
      const [day, summary] = await Promise.all([
        api(`/logs?date=${date}`),
        api(`/logs/summary?from=${weekStart}&to=${today}`),
      ]);
      setData(day);
      setWeek(summary.days);
    } catch (err) {
      setError(err.message);
    }
  }, [date, weekStart, today]);

  useEffect(() => {
    sessionStorage.setItem("calsnap_date", date);
    load();
  }, [date, load]);

  const { goals } = user;
  const t = data.totals;
  const left = goals.calories - t.calories;

  return (
    <div className="app stack" style={{ gap: 16 }}>
      <div className="row between">
        <h1>🍎 CalSnap</h1>
        <div className="muted small">{streak(week, today)}🔥</div>
      </div>

      <div className="week">
        {weekDays.map((d) => {
          const cal = week[d]?.calories || 0;
          const cls = [
            "day",
            d === date && "active",
            cal > 0 && (cal > goals.calories * 1.1 ? "over" : "logged"),
          ].filter(Boolean).join(" ");
          return (
            <button key={d} className={cls} onClick={() => setDate(d)}>
              {parseDate(d).toLocaleDateString([], { weekday: "short" })}
              <div className="num">{parseDate(d).getDate()}</div>
            </button>
          );
        })}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card row between" style={{ padding: "22px 22px" }}>
        <div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5 }}>{Math.abs(left)}</div>
          <div className="muted">{left >= 0 ? "Calories left" : "Calories over"}</div>
          <div className="small muted" style={{ marginTop: 8 }}>
            {t.calories} eaten · {goals.calories} goal
          </div>
        </div>
        <Ring value={t.calories} max={goals.calories} size={110} stroke={10}>
          <span style={{ fontSize: 30 }}>🔥</span>
        </Ring>
      </div>

      <div className="macros">
        {MACROS.map((m) => {
          const left = goals[m.key] - t[m.key];
          return (
            <div key={m.key} className="card macro">
              <div>
                <div className="val">{Math.abs(left)}g</div>
                <div className="small muted">{m.label} {left >= 0 ? "left" : "over"}</div>
              </div>
              <Ring value={t[m.key]} max={goals[m.key]} size={64} stroke={7} color={m.color}>
                <span className="small" style={{ fontWeight: 700 }}>{m.label[0]}</span>
              </Ring>
            </div>
          );
        })}
      </div>

      <div className="row between" style={{ marginTop: 6 }}>
        <h2>{date === today ? "Recently eaten" : parseDate(date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</h2>
      </div>

      {data.entries.length === 0 ? (
        <button className="card center stack" style={{ alignItems: "center", padding: 28 }} onClick={() => navigate("/add/scan")}>
          <div style={{ fontSize: 40 }}>📸</div>
          <div style={{ fontWeight: 600 }}>No food logged yet</div>
          <div className="muted small">Tap + to snap your first meal</div>
        </button>
      ) : (
        data.entries.map((e) => (
          <button key={e._id} className="card food" onClick={() => setEditing(e)}>
            {e.image ? <img className="thumb" src={e.image} alt="" /> : <div className="thumb">🍽️</div>}
            <div className="grow stack" style={{ gap: 6 }}>
              <div className="row between">
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div className="small muted" style={{ flexShrink: 0 }}>{timeOf(e.createdAt)}</div>
              </div>
              <div style={{ fontWeight: 700 }}>🔥 {Math.round(e.calories * e.servings)} kcal</div>
              <div className="chips">
                {MACROS.map((m) => (
                  <span key={m.key}><i className="dot" style={{ background: m.color }} />{Math.round(e[m.key] * e.servings)}g</span>
                ))}
              </div>
            </div>
          </button>
        ))
      )}

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <FoodEditor
            initial={editing}
            onSaved={() => { setEditing(null); load(); }}
            onDeleted={() => { setEditing(null); load(); }}
          />
        </Sheet>
      )}
    </div>
  );
}

// Consecutive days (ending today or yesterday) with something logged
function streak(week, today) {
  let n = 0;
  let d = week[today]?.calories ? today : addDays(today, -1);
  while (week[d]?.calories) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
