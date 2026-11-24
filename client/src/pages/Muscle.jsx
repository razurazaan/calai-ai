import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { findGroup } from "../fitness.js";
import { findWomenGroup } from "../fitnessWomen.js";
import { BackIcon } from "./Fitness.jsx";

// `women` shows the women's section (fitnessWomen.js). Its exercises carry extra detail
// (targets, rest, tips, mistakes, easier option); each part only shows when present.
export default function Muscle({ women = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const listUrl = `/fitness?for=${women ? "women" : "men"}`;
  const group = women ? findWomenGroup(id) : findGroup(id);
  if (!group) return <Navigate to={listUrl} replace />;

  return (
    <div className="app stack" style={{ gap: 14 }}>
      <div className="ex-header">
        <button className="icon-btn" onClick={() => navigate(listUrl)} aria-label="Back to exercises">
          <BackIcon />
        </button>
        <h2>{group.name}</h2>
        <span />
      </div>

      {group.image && (
        <div
          className="muscle-banner"
          style={{ backgroundImage: `url(${group.image.src})`, backgroundPosition: group.image.position, backgroundSize: group.image.size }}
          role="img"
          aria-label={`${group.name} workout`}
        />
      )}

      <div className="muscle-hero">
        <p>{group.about}</p>
      </div>

      <h3>{group.exercises.length} exercises</h3>

      {group.exercises.map((ex, i) => {
        const isOpen = open === i;
        return (
          <div key={ex.name} className="card exercise">
            <button className="exercise-head" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
              <div className="grow">
                <div className="exercise-name">{i + 1}. {ex.name}</div>
                <div className="exercise-tags">
                  <span>{ex.equipment}</span>
                  <span>{ex.level}</span>
                  {ex.rest && <span>Rest {ex.rest}</span>}
                </div>
              </div>
              <div className="exercise-sets">
                <strong>{ex.sets} × {ex.reps}</strong>
                <span className="muted small">sets × reps</span>
              </div>
            </button>

            {isOpen && (
              <div className="exercise-detail">
                {ex.about && <p className="exercise-about">{ex.about}</p>}

                {ex.targets && (
                  <div className="exercise-targets">
                    <span className="muted small">Works</span>
                    {ex.targets.map((t) => <span key={t} className="target">{t}</span>)}
                  </div>
                )}

                {ex.tips && <h4>How to do it</h4>}
                <ol className="exercise-steps">
                  {ex.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>

                {ex.tips && (
                  <>
                    <h4>Tips</h4>
                    <ul className="exercise-list tips">
                      {ex.tips.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </>
                )}

                {ex.mistakes && (
                  <>
                    <h4>Avoid</h4>
                    <ul className="exercise-list avoid">
                      {ex.mistakes.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </>
                )}

                {ex.easier && (
                  <p className="exercise-easier">
                    <strong>Easier option: </strong>
                    {ex.easier}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
