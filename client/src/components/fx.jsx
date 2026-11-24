// Small animated UI pieces in the style of React Bits (reactbits.dev): spotlight card, shiny text,
// count-up number and a glowing border. Written here so the app needs no extra dependency.
// All of them turn their motion off when the user prefers reduced motion.
import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A card with a soft light that follows the pointer
export function SpotlightCard({ className = "", children, ...rest }) {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} className={`spotlight ${className}`} onPointerMove={move} {...rest}>
      {children}
    </div>
  );
}

// Text with a light sweep moving across it
export const ShinyText = ({ children, className = "" }) => <span className={`shiny ${className}`}>{children}</span>;

// A number that counts up to `value` when it appears or changes
export function CountUp({ value, duration = 700, format }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format ? format(shown) : shown}</>;
}

// A rotating gradient border around its child (for the highlighted plan)
export const GlowBorder = ({ active = false, children }) =>
  active ? <div className="glow-border">{children}</div> : children;
