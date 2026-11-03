import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../App.jsx";

export default function Auth() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api(`/auth/${mode}`, { method: "POST", body: form });
      login(token, user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", paddingBottom: 16 }}>
      <div className="center" style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 56 }}>🍎</div>
        <h1>CalSnap</h1>
        <p className="muted" style={{ marginTop: 6 }}>Snap a photo. Know your calories.</p>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Sign up</button>
      </div>

      <form className="stack" onSubmit={submit}>
        {mode === "register" && (
          <input className="input" placeholder="Your name" value={form.name} onChange={set("name")} required />
        )}
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required autoComplete="email" />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={set("password")}
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>
          {busy ? <div className="spinner" /> : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
