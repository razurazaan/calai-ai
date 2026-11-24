import { useMemo, useRef, useState } from "react";

export const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString());
export const shortDay = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

// Rect with only the top corners rounded (data end), flat on the baseline side
function topRounded(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const niceMax = (v) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((s) => s * p >= v);
  return m * p;
};

export function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.key}><i className="swatch" style={{ background: s.color }} />{s.label}</span>
      ))}
    </div>
  );
}

/**
 * Daily stacked bars. data: [{ day, ...values }], series: [{ key, label, color }]
 * Hover any column for a tooltip with every series' value for that day.
 */
export function StackedBars({ data, series, height = 180, unit = "" }) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640;
  const pad = { l: 34, r: 4, t: 8, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const totals = data.map((d) => series.reduce((s, x) => s + (d[x.key] || 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const step = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(28, step - 2)); // 2px surface gap between bars
  const y = (v) => pad.t + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Daily ${series.map((s) => s.label).join(", ")}`}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.l - 6} y={y(t) + 4} textAnchor="end">{fmt(Math.round(t))}</text>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.day} x={pad.l + i * step + step / 2} y={height - 6} textAnchor="middle">{shortDay(d.day)}</text>
            ) : null
          )}
        </g>
        {data.map((d, i) => {
          const x = pad.l + i * step;
          let acc = 0;
          const segs = series
            .map((s) => ({ s, v: d[s.key] || 0 }))
            .filter((p) => p.v > 0);
          return (
            <g key={d.day}>
              {/* Full-height hit target, wider than the bar */}
              <rect
                className={`hover-col${hover?.i === i ? " on" : ""}`}
                x={x}
                y={pad.t}
                width={step}
                height={innerH}
                onMouseEnter={(e) => {
                  const box = wrap.current.getBoundingClientRect();
                  const svgBox = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  const scale = svgBox.width / W;
                  setHover({ i, left: (x + step / 2) * scale + (svgBox.left - box.left), top: y(totals[i]) * scale });
                }}
              />
              {segs.map(({ s, v }, j) => {
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const gap = j > 0 ? 2 : 0; // 2px surface gap between stacked segments
                const h = Math.max(0, y0 - y1 - gap);
                const bx = x + (step - barW) / 2;
                const isTop = j === segs.length - 1;
                return isTop ? (
                  <path key={s.key} d={topRounded(bx, y1, barW, h, 4)} fill={s.color} pointerEvents="none" />
                ) : (
                  <rect key={s.key} x={bx} y={y1} width={barW} height={h} fill={s.color} pointerEvents="none" />
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tip" style={{ left: hover.left, top: hover.top }}>
          <b>{shortDay(data[hover.i].day)}</b>
          {series.map((s) => (
            <div className="r" key={s.key}>
              <span><i className="swatch" style={{ background: s.color }} />{s.label}</span>
              <span>{fmt(data[hover.i][s.key] || 0)}{unit}</span>
            </div>
          ))}
          {series.length > 1 && (
            <div className="r" style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
              <span>Total</span><span>{fmt(totals[hover.i])}{unit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Single-series line with crosshair tooltip. Null values leave gaps. */
export function LineChart({ data, valueKey, label, color = "var(--s1)", height = 160, unit = "", target }) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640;
  const pad = { l: 40, r: 8, t: 10, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const vals = data.map((d) => d[valueKey]);
  const max = niceMax(Math.max(0, target || 0, ...vals.filter((v) => v != null)));
  const x = (i) => pad.l + (data.length < 2 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.t + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 8);

  const path = useMemo(() => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)}`;
      pen = true;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, valueKey, max]);

  function onMove(e) {
    const svg = e.currentTarget;
    const box = svg.getBoundingClientRect();
    const scale = box.width / W;
    const px = (e.clientX - box.left) / scale;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - pad.l) / innerW) * (data.length - 1))));
    const wrapBox = wrap.current.getBoundingClientRect();
    setHover({ i, left: x(i) * scale + (box.left - wrapBox.left), top: (vals[i] == null ? pad.t + innerH : y(vals[i])) * scale });
  }

  return (
    <div className="chart" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <g className="grid">
          {ticks.map((t) => <line key={t} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />)}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.l - 6} y={y(t) + 4} textAnchor="end">{fmt(Math.round(t))}</text>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.day} x={x(i)} y={height - 6} textAnchor="middle">{shortDay(d.day)}</text>
            ) : null
          )}
        </g>
        {target ? (
          <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke="var(--muted)" strokeDasharray="4 4" />
        ) : null}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, i) =>
          v != null && (data.length <= 45 || hover?.i === i) ? (
            <circle key={i} cx={x(i)} cy={y(v)} r={hover?.i === i ? 5 : 3} fill={color} stroke="var(--card)" strokeWidth="2" />
          ) : null
        )}
        {hover && <line x1={x(hover.i)} x2={x(hover.i)} y1={pad.t} y2={pad.t + innerH} stroke="var(--muted)" strokeWidth="1" />}
      </svg>
      {hover && (
        <div className="tip" style={{ left: hover.left, top: hover.top }}>
          <b>{shortDay(data[hover.i].day)}</b>
          <div className="r"><span>{label}</span><span>{vals[hover.i] == null ? "–" : `${fmt(vals[hover.i])}${unit}`}</span></div>
          {target ? <div className="r"><span>Goal</span><span>{fmt(target)}{unit}</span></div> : null}
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars: rows [{ label, value, sub? }] */
export function HBars({ rows, color = "var(--s1)", empty = "No data yet" }) {
  if (!rows.length) return <div className="small muted">{empty}</div>;
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar-row" key={r.label} title={`${r.label}: ${fmt(r.value)}`}>
          <span className="clip" style={{ maxWidth: "none" }}>{r.label}</span>
          <div className="track"><div style={{ width: `${(r.value / max) * 100}%`, background: color }} /></div>
          <span className="small" style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmt(r.value)}{r.sub ? <span className="muted"> · {r.sub}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Data table for any daily chart (the accessible / exact-number view) */
export function SeriesTable({ data, columns }) {
  return (
    <details>
      <summary>View as table</summary>
      <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
        <table>
          <thead>
            <tr><th>Day</th>{columns.map((c) => <th key={c.key} className="num">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                {columns.map((c) => <td key={c.key} className="num">{d[c.key] == null ? "–" : fmt(d[c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
