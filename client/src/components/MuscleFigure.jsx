import { useId } from "react";

// A simple, stylised body drawn on a 200 x 440 grid (centre line at x = 100).
// Paired parts are drawn once for the left side and mirrored for the right.
const MIRROR = "translate(200 0) scale(-1 1)";

const BODY_PAIRED = [
  "M62,72 Q42,74 38,100 L36,160 Q44,168 52,162 L58,120 Z", // upper arm
  "M36,160 Q30,200 32,236 L44,238 Q50,200 52,162 Z", // forearm
  "M68,230 Q62,280 72,330 L96,330 Q100,290 99,240 Z", // thigh
  "M72,330 Q70,370 78,410 L92,410 Q98,370 96,330 Z", // shin
  "M78,410 L92,410 Q96,422 90,426 L74,426 Q72,418 78,410 Z", // foot
];
const TORSO =
  "M62,70 Q100,60 138,70 Q148,90 144,124 Q138,160 134,196 Q136,214 132,232 Q100,244 68,232 Q64,214 66,196 Q62,160 56,124 Q52,90 62,70 Z";
const NECK = "M92,48 L108,48 L110,66 L90,66 Z";

// Muscles: `paired` paths are mirrored, `single` paths are drawn as is.
const MUSCLES = {
  front: {
    delts: { paired: ["M62,70 Q44,72 39,98 Q50,104 60,96 Q66,82 62,70 Z"] },
    pecs: { paired: ["M99,82 Q80,76 64,84 Q58,102 68,116 Q86,122 99,114 Z"] },
    biceps: { paired: ["M42,104 Q37,130 41,158 Q49,162 53,150 Q58,126 57,104 Q50,100 42,104 Z"] },
    obliques: { paired: ["M70,124 Q66,160 72,200 L84,198 L86,124 Z"] },
    abs: {
      single: [124, 148, 172].flatMap((y) => [
        `M88,${y + 4} Q88,${y} 92,${y} L95,${y} Q99,${y} 99,${y + 4} L99,${y + 16} Q99,${y + 20} 95,${y + 20} L92,${y + 20} Q88,${y + 20} 88,${y + 16} Z`,
        `M101,${y + 4} Q101,${y} 105,${y} L108,${y} Q112,${y} 112,${y + 4} L112,${y + 16} Q112,${y + 20} 108,${y + 20} L105,${y + 20} Q101,${y + 20} 101,${y + 16} Z`,
      ]),
    },
    quads: { paired: ["M70,240 Q64,282 76,326 Q88,330 96,322 Q100,284 98,244 Q84,236 70,240 Z"] },
  },
  back: {
    traps: { paired: ["M100,54 Q90,64 64,72 Q82,84 100,116 Z"] },
    delts: { paired: ["M62,70 Q44,72 39,98 Q50,104 60,96 Q66,82 62,70 Z"] },
    lats: { paired: ["M66,92 Q60,130 76,184 Q90,172 100,152 L100,120 Q84,96 66,92 Z"] },
    triceps: { paired: ["M42,104 Q37,130 41,158 Q49,162 53,150 Q58,126 57,104 Q50,100 42,104 Z"] },
    glutes: { paired: ["M100,224 Q78,220 70,238 Q68,266 88,272 Q100,268 100,252 Z"] },
    hamstrings: { paired: ["M72,276 Q68,302 78,326 Q90,330 96,322 Q98,298 96,276 Q84,272 72,276 Z"] },
    calves: { paired: ["M74,336 Q68,362 80,388 Q92,388 95,362 Q96,342 92,334 Q82,330 74,336 Z"] },
  },
};

export default function MuscleFigure({ view = "front", highlight = [], viewBox = "0 0 200 440", className, fit = "meet" }) {
  const id = useId().replace(/:/g, "");
  const skin = `url(#skin${id})`;
  const hot = `url(#hot${id})`;
  const [vx, vy, vw, vh] = viewBox.split(/[\s,]+/).map(Number);

  const parts = (paths, props, mirror) =>
    paths.map((d, i) => (
      <g key={i}>
        <path d={d} {...props} />
        {mirror && <path d={d} transform={MIRROR} {...props} />}
      </g>
    ));

  return (
    <svg className={className} viewBox={viewBox} preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true">
      <defs>
        <linearGradient id={`skin${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#eef0f2" />
          <stop offset="1" stopColor="#9da5ad" />
        </linearGradient>
        <linearGradient id={`hot${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f08a5d" />
          <stop offset="1" stopColor="#b8432c" />
        </linearGradient>
        {/* Hide anything outside the cropped area, even when the card is wider than the crop */}
        <clipPath id={`crop${id}`}>
          <rect x={vx} y={vy} width={vw} height={vh} />
        </clipPath>
      </defs>

      <g clipPath={`url(#crop${id})`}>
      <g stroke="#7d858d" strokeWidth="0.8" fill={skin}>
        <ellipse cx="100" cy="30" rx="18" ry="23" />
        <path d={NECK} />
        {parts(BODY_PAIRED, {}, true)}
        <ellipse cx="37" cy="250" rx="7" ry="12" />
        <ellipse cx="163" cy="250" rx="7" ry="12" />
        <path d={TORSO} />
      </g>

      {Object.entries(MUSCLES[view]).map(([name, m]) => {
        const on = highlight.includes(name);
        const props = on
          ? { fill: hot, stroke: "#8e2f1f", strokeWidth: 0.8 }
          : { fill: "rgba(60,70,80,0.10)", stroke: "rgba(60,70,80,0.30)", strokeWidth: 0.6 };
        return (
          <g key={name}>
            {parts(m.paired || [], props, true)}
            {parts(m.single || [], props, false)}
          </g>
        );
      })}
      </g>
    </svg>
  );
}
