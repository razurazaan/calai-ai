import { useState } from "react";
import { api } from "../api.js";
import { applyNutrient, applyPortion, commitPortion, makeBase } from "../portion.js";
import { guessMealType, MACROS } from "../utils.js";

const MEALS = ["breakfast", "lunch", "dinner", "snack"];

// Review / edit a food entry. `initial` is either a saved entry (has _id) or an AI result.
export default function FoodEditor({ initial, date, onSaved, onDeleted }) {
  const [f, setF] = useState(() => ({
    name: initial.name || "",
    mealType: initial.mealType || guessMealType(),
    servings: initial.servings || 1,
    portionGrams: initial.portionGrams || "",
    calories: initial.calories ?? "",
    protein: initial.protein ?? "",
    carbs: initial.carbs ?? "",
    fat: initial.fat ?? "",
    base: makeBase(initial),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isNew = !initial._id;

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
  const num = (v) => Math.max(0, Number(v) || 0);
  const servings = num(f.servings) || 1;

  // Correcting the portion weight rescales calories and macros proportionally
  const setPortion = (v) => setF((prev) => applyPortion(prev, v));
  const setNutrient = (k, v) => setF((prev) => applyNutrient(prev, k, v));

  async function save() {
    if (!f.name.trim()) return setError("Give this food a name");
    setBusy(true);
    setError("");
    const body = {
      name: f.name.trim(),
      mealType: f.mealType,
      servings,
      portionGrams: num(f.portionGrams) || undefined,
      calories: num(f.calories),
      protein: num(f.protein),
      carbs: num(f.carbs),
      fat: num(f.fat),
    };
    try {
      if (isNew) {
        await api("/logs", {
          method: "POST",
          body: {
            ...body,
            date,
            items: initial.items,
            healthScore: initial.healthScore,
            confidence: initial.confidence,
            notes: initial.notes,
            image: initial.image,
            source: initial.source || "manual",
          },
        });
      } else {
        await api(`/logs/${initial._id}`, { method: "PUT", body });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this entry?")) return;
    setBusy(true);
    try {
      await api(`/logs/${initial._id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const step = (d) => set("servings", Math.max(0.5, Math.round((servings + d) * 2) / 2));

  return (
    <div className="stack">
      {initial.image && (
        <img src={initial.image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 20 }} />
      )}

      {isNew && initial.isEstimate && (
        <div className="estimate">
          <div className="row between">
            <strong>✨ AI estimate</strong>
            <span className={`conf conf-${initial.confidence}`}>{initial.confidence} confidence</span>
          </div>
          {initial.uncertainty && <div className="small">{initial.uncertainty}</div>}
          <div className="small muted">
            Check the portion and values below. You can correct anything before saving.
          </div>
        </div>
      )}

      <div className="row between">
        <input
          className="input grow"
          style={{ fontWeight: 700, fontSize: 18 }}
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Food name"
        />
        <div className="stepper">
          <button onClick={() => step(-0.5)} aria-label="Fewer servings">−</button>
          <span>{servings}</span>
          <button onClick={() => step(0.5)} aria-label="More servings">+</button>
        </div>
      </div>

      <div className="tabs">
        {MEALS.map((m) => (
          <button key={m} className={f.mealType === m ? "active" : ""} onClick={() => set("mealType", m)} style={{ textTransform: "capitalize", fontSize: 13 }}>
            {m}
          </button>
        ))}
      </div>

      <div className="card row between" style={{ padding: "14px 18px" }}>
        <div>
          <div className="small muted">🔥 Calories per serving</div>
          <input
            type="number"
            inputMode="numeric"
            value={f.calories}
            onChange={(e) => setNutrient("calories", e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 32, fontWeight: 800, width: 140 }}
          />
        </div>
        {servings !== 1 && (
          <div className="center">
            <div className="small muted">Total</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{Math.round(num(f.calories) * servings)}</div>
          </div>
        )}
      </div>

      <div className="nutri">
        <label>⚖️ Portion per serving (g){f.portionGrams !== "" && " · editing rescales the values"}</label>
        <input
          type="number"
          inputMode="numeric"
          placeholder="e.g. 250"
          value={f.portionGrams}
          onChange={(e) => setPortion(e.target.value)}
          onBlur={() => setF(commitPortion)}
        />
      </div>

      <div className="nutri-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {MACROS.map((m) => (
          <div key={m.key} className="nutri">
            <label><i className="dot" style={{ background: m.color }} />{m.label} (g)</label>
            <input type="number" inputMode="decimal" value={f[m.key]} onChange={(e) => setNutrient(m.key, e.target.value)} />
          </div>
        ))}
      </div>

      {initial.healthScore != null && (
        <div className="card stack" style={{ gap: 8 }}>
          <div className="row between">
            <strong>💚 Health score</strong>
            <strong>{initial.healthScore}/10</strong>
          </div>
          <div className="bar">
            <div style={{ width: `${initial.healthScore * 10}%`, background: initial.healthScore >= 7 ? "var(--good)" : initial.healthScore >= 4 ? "var(--carbs)" : "var(--protein)" }} />
          </div>
          {initial.notes && <div className="small muted">{initial.notes}</div>}
        </div>
      )}

      {initial.items?.length > 0 && (
        <div className="card">
          <strong>Ingredients</strong>
          {initial.items.map((i, idx) => (
            <div key={idx} className="list-row small">
              <div>
                <div style={{ fontWeight: 600 }}>
                  {i.name}
                  {i.confidence && i.confidence !== "high" && <span className={`conf conf-${i.confidence}`} style={{ marginLeft: 6 }}>{i.confidence}</span>}
                </div>
                <div className="muted">
                  {i.portion}
                  {i.portionGrams > 0 && !String(i.portion).includes(`${i.portionGrams} g`) && ` · ~${i.portionGrams} g`}
                </div>
                <div className="muted">P {i.protein}g · C {i.carbs}g · F {i.fat}g</div>
              </div>
              <div className="muted" style={{ flexShrink: 0 }}>{i.calories} kcal</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy} onClick={save}>
        {busy ? <div className="spinner" /> : isNew ? "Log it" : "Save changes"}
      </button>
      {!isNew && <button className="btn danger" disabled={busy} onClick={remove}>Delete entry</button>}
    </div>
  );
}
