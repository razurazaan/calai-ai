import { useEffect, useState } from "react";
import { api } from "../api.js";
import { CountUp, ShinyText, SpotlightCard } from "./fx.jsx";
import Sheet from "./Sheet.jsx";
import {
  HEALTH, connectHealth, disconnectHealth, healthAvailable, openHealthSettings, stepStats,
} from "../steps.js";
import { parseDate } from "../utils.js";

const fmt = (n) => Math.round(n).toLocaleString();

// Footprints along the trail, from the bottom-left to the flag. They light up as the day's steps grow.
const PRINTS = [
  [86, 151, -1], [99, 145, 1], [110, 139, -1], [122, 134, 1],
  [135, 130, -1], [150, 126, 1], [165, 120, -1], [179, 114, 1],
];

function TrailScene({ pct, done }) {
  const lit = pct > 0 ? Math.max(1, Math.floor(pct * PRINTS.length)) : 0;
  return (
    <svg className="steps-scene" viewBox="0 0 220 160" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      {[[118, 22], [168, 14], [206, 34], [140, 50], [96, 40]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.1" fill="#fff" opacity="0.5" />
      ))}
      <circle cx="170" cy="52" r="32" style={{ fill: "var(--sun)" }} opacity="0.1" />
      <circle cx="170" cy="52" r="22" style={{ fill: "var(--sun)" }} opacity="0.16" />
      <circle cx="170" cy="52" r="14" style={{ fill: "var(--sun)" }} />
      <path d="M40 116 C90 80 138 88 172 100 S210 90 220 86 V160 H40 Z" style={{ fill: "var(--hill-far)" }} />
      <path d="M146 100 l7 -19 l7 19 z M135 104 l6 -14 l6 14 z M206 92 l5 -13 l5 13 z" style={{ fill: "var(--tree)" }} />
      <path d="M0 160 V138 C50 120 92 126 132 117 S200 110 220 118 V160 Z" style={{ fill: "var(--hill-near)" }} />
      <path d="M0 160 V152 C60 142 120 150 220 140 V160 Z" style={{ fill: "var(--hill-front)" }} opacity="0.6" />
      <path
        d="M70 160 C100 147 96 137 128 131 S176 121 196 109"
        fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.5 6"
      />
      {PRINTS.map(([x, y, side], i) => (
        <ellipse
          key={i}
          className={`foot${i < lit ? " lit" : ""}`}
          style={{ "--i": i }}
          cx={x} cy={y + side * 2.5} rx="2.8" ry="4.6"
          transform={`rotate(62 ${x} ${y + side * 2.5})`}
        />
      ))}
      <line x1="196" y1="109" x2="196" y2="88" stroke="#e8eef2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M196 88 l14 4.5 l-14 4.5 z" style={{ fill: done ? "var(--step-accent)" : "var(--sun)" }} />
    </svg>
  );
}

export default function StepsCard({ date, today, entry, goal, profile, healthOn, onOpen }) {
  const steps = entry?.steps || 0;
  const pct = goal > 0 ? Math.min(1, steps / goal) : 0;
  const done = steps >= goal;
  const { km, kcal } = stepStats(steps, profile);
  const source = entry?.source;

  return (
    <SpotlightCard className="steps-card" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      aria-label={`${fmt(steps)} steps ${date === today ? "today" : "on this day"}. Open steps`}>
      <TrailScene pct={pct} done={done} />
      <div className="steps-fade" />
      <div className="steps-body">
        <div className="steps-label">
          👟 {date === today ? "Steps today" : "Steps"}
          {(healthOn || source === "manual") && (
            <span className="steps-badge">{source === "manual" ? "Manual" : "Synced"}</span>
          )}
        </div>
        <div className="steps-count"><CountUp value={steps} format={fmt} /></div>
        <div className="steps-goal">
          {done ? <ShinyText>Goal reached 🎉</ShinyText> : <>of {fmt(goal)} goal</>}
        </div>
        <div className="steps-bar"><div style={{ width: `${pct * 100}%` }} /></div>
        <div className="steps-meta">
          <span>📍 {km} km</span>
          <span>🔥 {kcal} kcal</span>
        </div>
      </div>
    </SpotlightCard>
  );
}

// Bottom sheet: last 7 days, health-store connection, and manual entry
export function StepsSheet({ date, today, weekDays, days, goal, healthOn, onHealthChange, onChanged, onClose }) {
  const entry = days[date];
  const [value, setValue] = useState(entry?.steps ? String(entry.steps) : "");
  const [avail, setAvail] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (HEALTH) healthAvailable().then(setAvail);
  }, []);

  const label = date === today ? "today" : parseDate(date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  const max = Math.max(goal, ...weekDays.map((d) => days[d]?.steps || 0));

  const run = (kind, fn) => async () => {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy("");
    }
  };

  const save = run("save", async () => {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0) throw new Error("Enter a step count");
    await api(`/steps/${date}`, { method: "PUT", body: { steps: Math.round(n) } });
    await onChanged();
    onClose();
  });
  const useHealthCount = run("clear", async () => {
    await api(`/steps/${date}`, { method: "PUT", body: { steps: null } });
    await onChanged();
    onClose();
  });
  const connect = run("connect", async () => {
    const ok = await connectHealth();
    onHealthChange(ok);
    if (!ok) throw new Error(`Step access wasn't allowed. You can turn it on in ${HEALTH.name}.`);
    await onChanged();
  });
  const sync = run("sync", onChanged);
  const disconnect = () => {
    disconnectHealth();
    onHealthChange(false);
  };

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <h2>👟 Steps</h2>

        <div className="card">
          <div className="steps-week">
            {weekDays.map((d) => {
              const s = days[d]?.steps || 0;
              return (
                <div key={d} className={`steps-week-day${d === date ? " active" : ""}${s >= goal ? " done" : ""}`}>
                  <div className="steps-week-track">
                    <div style={{ height: `${max > 0 ? (s / max) * 100 : 0}%` }} title={`${fmt(s)} steps`} />
                  </div>
                  <span>{parseDate(d).toLocaleDateString([], { weekday: "narrow" })}</span>
                </div>
              );
            })}
          </div>
          <div className="small muted center" style={{ marginTop: 8 }}>Last 7 days · goal {fmt(goal)}</div>
        </div>

        {error && <div className="error">{error}</div>}

        {HEALTH ? (
          <div className="card stack" style={{ gap: 10 }}>
            {avail && !avail.available ? (
              <>
                <h3>{HEALTH.name} isn't available</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  {HEALTH.source === "health-connect"
                    ? "Install or update Health Connect from the Play Store, then come back to sync your steps."
                    : "This device can't share health data."}
                </p>
                {HEALTH.source === "health-connect" && (
                  <button className="btn secondary sm" onClick={() => openHealthSettings().catch(() => {})}>Open Health Connect</button>
                )}
              </>
            ) : healthOn ? (
              <>
                <div className="row between">
                  <h3>✓ Syncing from {HEALTH.name}</h3>
                  <button className="btn secondary sm" onClick={sync} disabled={!!busy}>
                    {busy === "sync" ? <span className="spinner" /> : "Sync now"}
                  </button>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Steps update each time you open CalSnap. Only your step count is read; nothing is written to {HEALTH.name}.
                </p>
                <button className="btn danger sm" onClick={disconnect}>Stop syncing</button>
              </>
            ) : (
              <>
                <h3>Count steps automatically</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  Connect {HEALTH.name} and CalSnap reads your daily step count from your phone or watch.
                  Only steps are read, and only to show your progress here.
                </p>
                <button className="btn" onClick={connect} disabled={!!busy || !avail}>
                  {busy === "connect" ? <span className="spinner" /> : `Connect ${HEALTH.name}`}
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Automatic step counting works in the CalSnap Android and iPhone apps. Here you can type your steps in.
          </p>
        )}

        <div className="card stack" style={{ gap: 10 }}>
          <label className="field">Steps {label}
            <input
              className="input" type="number" inputMode="numeric" min="0" placeholder="e.g. 6500"
              value={value} onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button className="btn" onClick={save} disabled={!!busy}>
            {busy === "save" ? <span className="spinner" /> : "Save steps"}
          </button>
          {entry?.source === "manual" && healthOn && (
            <button className="btn secondary" onClick={useHealthCount} disabled={!!busy}>
              Use the {HEALTH.name} count instead
            </button>
          )}
          {healthOn && entry?.source !== "manual" && (
            <p className="small muted" style={{ margin: 0 }}>A number you type here replaces the synced count for this day.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
