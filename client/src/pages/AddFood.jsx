import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import FoodEditor from "../components/FoodEditor.jsx";
import { dateStr, resizeImage, shrinkDataUrl } from "../utils.js";

const TITLES = { scan: "Scan food", describe: "Describe your meal", manual: "Add manually" };

// Re-mount when the mode changes (e.g. "Add manually instead") so state resets
export default function AddFood() {
  const { mode } = useParams();
  return <AddFoodScreen key={mode} />;
}

function AddFoodScreen() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const date = sessionStorage.getItem("calsnap_date") || dateStr();

  const [image, setImage] = useState(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(mode === "manual" ? { source: "manual" } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (mode !== "manual") api("/ai/usage").then(setUsage).catch(() => {});
  }, [mode]);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setResult(null);
    try {
      setImage(await resizeImage(file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const r = await api("/ai/analyze", {
        method: "POST",
        body: { image: mode === "scan" ? image : undefined, description },
      });
      const thumb = image && mode === "scan" ? await shrinkDataUrl(image) : undefined;
      setResult({ ...r, image: thumb, source: mode === "scan" ? "ai-photo" : "ai-text" });
      setUsage((u) => u && { ...u, left: r.scansLeft });
    } catch (err) {
      setError(err.message);
      api("/ai/usage").then(setUsage).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const done = () => navigate("/");

  return (
    <div className="app stack">
      <div className="row">
        <button className="btn secondary sm" onClick={() => navigate(-1)}>←</button>
        <h2>{TITLES[mode] || "Add food"}</h2>
      </div>

      {date !== dateStr() && <div className="small muted">Logging for {date}</div>}

      {result ? (
        <>
          {mode !== "manual" && (
            <button className="btn secondary sm" style={{ alignSelf: "flex-start" }} onClick={() => setResult(null)}>
              ↺ Re-analyze
            </button>
          )}
          <FoodEditor initial={result} date={date} onSaved={done} />
        </>
      ) : (
        <>
          {mode === "scan" && (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
              <button className={`dropzone ${busy ? "scanning" : ""}`} onClick={() => !busy && fileRef.current.click()}>
                {image ? (
                  <img src={image} alt="Your meal" />
                ) : (
                  <>
                    <div style={{ fontSize: 48 }}>📸</div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>Take or upload a photo</div>
                    <div className="small">Make sure the whole plate is visible</div>
                  </>
                )}
              </button>
              {image && !busy && (
                <button className="btn secondary sm" style={{ alignSelf: "center" }} onClick={() => fileRef.current.click()}>
                  Choose another photo
                </button>
              )}
            </>
          )}

          <textarea
            className="input"
            rows={mode === "describe" ? 4 : 2}
            placeholder={
              mode === "describe"
                ? "e.g. 2 scrambled eggs, 2 slices of whole wheat toast with butter, and a black coffee"
                : "Optional: add details (e.g. 'cooked in olive oil', 'large portion')"
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {error && <div className="error">{error}</div>}
          {error && mode !== "manual" && (
            <button className="btn secondary" onClick={() => navigate("/add/manual")}>
              Add manually instead
            </button>
          )}

          <button
            className="btn"
            disabled={busy || (mode === "scan" ? !image : !description.trim())}
            onClick={analyze}
          >
            {busy ? <><div className="spinner" /> Analyzing…</> : "✨ Analyze with AI"}
          </button>

          {usage && (
            <div className="small muted center">
              {!usage.enabled
                ? "AI scanning isn't set up on the server yet. You can still add food manually."
                : `${usage.left} of ${usage.limit} AI scans left today`}
            </div>
          )}
          {usage && usage.left === 0 && !error && (
            <button className="btn secondary" onClick={() => navigate("/add/manual")}>Add manually instead</button>
          )}
        </>
      )}
    </div>
  );
}
