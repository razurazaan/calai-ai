// Bottom tab bar.
//
// The active-tab "goo" effect (the pill pops in with a bounce and particles merge into it) is
// adapted from GooeyNav by React Bits: https://reactbits.dev
// Copyright (c) 2026 David Haz. MIT + Commons Clause, see REACT-BITS-LICENSE.md next to this file.
//
// Changes from the original:
// - icon + label tabs with the "Log food" button in the middle
// - the active tab follows the current route instead of the last click
// - the goo is an SVG filter instead of a black backdrop + blend mode, so it works on light
//   backgrounds and keeps the theme colours (default, dark and the pink women's theme)
// - particles are scaled down to fit a tab icon, and are skipped with reduced motion
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Sheet from "./Sheet.jsx";

const Icon = ({ d }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const TABS = [
  { to: "/", label: "Home", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { to: "/progress", label: "Progress", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { to: "/fitness", label: "Fitness", icon: "M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11" },
  {
    to: "/settings",
    label: "Settings",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  },
];

// Which tab a route belongs to, e.g. /fitness/women/chest -> Fitness. -1 for pages without a tab.
const tabFor = (path) =>
  TABS.findIndex((t) => (t.to === "/" ? path === "/" : path === t.to || path.startsWith(`${t.to}/`)));

// Particle settings (GooeyNav defaults, distances scaled down for a tab icon)
const ANIMATION_TIME = 600;
const PARTICLE_COUNT = 12;
const PARTICLE_DISTANCES = [46, 6];
const PARTICLE_R = 100;
const TIME_VARIANCE = 300;
const COLORS = [1, 2, 3, 1, 2, 3, 1, 4]; // --gnav-c1 … --gnav-c4 in styles.css

const noise = (n = 1) => n / 2 - Math.random() * n;

const getXY = (distance, pointIndex, totalPoints) => {
  const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
};

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Particles start in a ring around the icon and pull into the pill, where the goo filter merges them
function burst(effect, timers) {
  effect.querySelectorAll(".gnav-particle").forEach((p) => p.remove());
  const [far, near] = PARTICLE_DISTANCES;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const time = ANIMATION_TIME * 2 + noise(TIME_VARIANCE * 2);
    const start = getXY(far, PARTICLE_COUNT - i, PARTICLE_COUNT);
    const end = getXY(near + noise(7), PARTICLE_COUNT - i, PARTICLE_COUNT);
    const r = noise(PARTICLE_R / 10);
    const rotate = r > 0 ? (r + PARTICLE_R / 20) * 10 : (r - PARTICLE_R / 20) * 10;

    const particle = document.createElement("span");
    particle.className = "gnav-particle";
    const s = particle.style;
    s.setProperty("--start-x", `${start[0]}px`);
    s.setProperty("--start-y", `${start[1]}px`);
    s.setProperty("--end-x", `${end[0]}px`);
    s.setProperty("--end-y", `${end[1]}px`);
    s.setProperty("--time", `${time}ms`);
    s.setProperty("--scale", `${1 + noise(0.2)}`);
    s.setProperty("--rotate", `${rotate}deg`);
    s.setProperty("--color", `var(--gnav-c${COLORS[Math.floor(Math.random() * COLORS.length)]})`);
    const point = document.createElement("span");
    point.className = "gnav-point";
    particle.appendChild(point);
    effect.appendChild(particle);
    timers.push(setTimeout(() => particle.remove(), time));
  }
}

export default function BottomNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = tabFor(pathname);

  const layerRef = useRef(null);
  const effectRef = useRef(null);
  const pillRef = useRef(null);
  const tabRefs = useRef([]);
  const prevActive = useRef(active);
  const timers = useRef([]);

  const go = (mode) => {
    setOpen(false);
    navigate(`/add/${mode}`);
  };

  // Centre the pill on the active tab's icon
  const place = useCallback(() => {
    const layer = layerRef.current;
    const effect = effectRef.current;
    const icon = tabRefs.current[active]?.querySelector(".gnav-icon");
    if (!layer || !effect) return;
    effect.classList.toggle("hidden", !icon);
    if (!icon) return;
    const l = layer.getBoundingClientRect();
    const r = icon.getBoundingClientRect();
    effect.style.left = `${r.left - l.left + r.width / 2}px`;
    effect.style.top = `${r.top - l.top + r.height / 2}px`;
  }, [active]);

  useLayoutEffect(() => {
    place();
    const changed = prevActive.current !== active;
    prevActive.current = active;
    if (!changed || active < 0 || reducedMotion()) return;
    const pill = pillRef.current;
    pill.classList.remove("pop");
    void pill.offsetWidth; // restart the pop animation
    pill.classList.add("pop");
    burst(effectRef.current, timers.current);
  }, [active, place]);

  useEffect(() => {
    const ro = new ResizeObserver(place);
    if (layerRef.current) ro.observe(layerRef.current);
    return () => ro.disconnect();
  }, [place]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tab = (t, i) => (
    <NavLink key={t.to} to={t.to} end={t.to === "/"} className="gnav-tab" ref={(el) => (tabRefs.current[i] = el)}>
      <span className="gnav-icon">
        <Icon d={t.icon} />
      </span>
      {t.label}
    </NavLink>
  );

  return (
    <>
      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <div className="gnav-layer" ref={layerRef} aria-hidden="true">
            <span className="gnav-effect" ref={effectRef}>
              <span className="gnav-pill" ref={pillRef} />
            </span>
          </div>
          {TABS.slice(0, 2).map((t, i) => tab(t, i))}
          <button className="fab" onClick={() => setOpen(true)} aria-label="Log food">+</button>
          {TABS.slice(2).map((t, i) => tab(t, i + 2))}
        </div>
      </nav>

      {/* Goo filter: blur, then sharpen the alpha so nearby shapes melt into each other */}
      <svg className="gnav-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="gnav-goo" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
        </defs>
      </svg>

      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <h2 style={{ marginBottom: 14 }}>Log food</h2>
          <div className="add-options">
            <button className="add-option" onClick={() => go("scan")}><span>📸</span>Scan food</button>
            <button className="add-option" onClick={() => go("describe")}><span>✍️</span>Describe</button>
            <button className="add-option" onClick={() => go("manual")}><span>🔢</span>Manual</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
