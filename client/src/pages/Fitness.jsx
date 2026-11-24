import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../App.jsx";
import MuscleFigure from "../components/MuscleFigure.jsx";
import { MUSCLE_GROUPS, REGIONS } from "../fitness.js";
import { WOMEN_GROUPS, WOMEN_INTRO } from "../fitnessWomen.js";

const TRACKS = [
  { id: "women", label: "Women" },
  { id: "men", label: "Men" },
];

export const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export default function Fitness() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  // Women see the women's section first. The choice is kept in the URL so Back returns to it.
  const track = params.get("for") ?? (user?.profile?.gender === "female" ? "women" : "men");
  const women = track === "women";
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [showFilter, setShowFilter] = useState(false);

  const q = query.trim().toLowerCase();
  const groups = (women ? WOMEN_GROUPS : MUSCLE_GROUPS).filter(
    (g) =>
      (region === "all" || g.region === region) &&
      (!q || g.name.toLowerCase().includes(q) || g.exercises.some((e) => e.name.toLowerCase().includes(q))),
  );

  return (
    <div className="app stack" style={{ gap: 14 }}>
      <div className="ex-header">
        <button className="icon-btn" onClick={() => navigate("/")} aria-label="Back to home">
          <BackIcon />
        </button>
        <h2>Exercises</h2>
        <button
          className={`icon-btn${showFilter || region !== "all" ? " on" : ""}`}
          onClick={() => setShowFilter(!showFilter)}
          aria-label="Filter by body area"
          aria-expanded={showFilter}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" />
          </svg>
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Exercise section">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={track === t.id}
            className={track === t.id ? "active" : ""}
            onClick={() => setParams({ for: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {women && <p className="women-intro">{WOMEN_INTRO}</p>}

      <label className="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Search muscles or exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {showFilter && (
        <div className="filter-chips">
          {REGIONS.map((r) => (
            <button key={r.id} className={region === r.id ? "active" : ""} onClick={() => setRegion(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <Link
          key={g.id}
          to={women ? `/fitness/women/${g.id}` : `/fitness/${g.id}`}
          className={`muscle-card${g.image ? " photo" : ""}`}
          style={g.image && { backgroundImage: `url(${g.image.src})`, backgroundPosition: g.image.position, backgroundSize: g.image.size }}
        >
          <span>{g.name}</span>
          {!g.image && <MuscleFigure className="muscle-figure" {...g.figure} />}
        </Link>
      ))}

      {!groups.length && <p className="muted center">No exercises match “{query}”.</p>}
    </div>
  );
}
