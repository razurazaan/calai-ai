import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { API_BASE, api, getToken, setOnUnauthorized, setToken } from "./api.js";
import Overview from "./pages/Overview.jsx";
import Users from "./pages/Users.jsx";
import UserDetail from "./pages/UserDetail.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import AiActivity from "./pages/AiActivity.jsx";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState("");

  const logout = (message = "") => {
    setToken(null);
    setUser(null);
    setNotice(message);
  };

  useEffect(() => {
    setOnUnauthorized(() => logout("Your session expired. Please log in again."));
    if (!getToken()) return;
    api("/auth/me")
      .then((u) => (u.role === "admin" ? setUser(u) : logout("This account is not an admin.")))
      .catch((err) => {
        if (err.status === 401 || err.status === 403 || err.status === 404) logout(err.message);
        else setNotice(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Login notice={notice} onLogin={(u) => { setNotice(""); setUser(u); }} />;

  return (
    <AuthCtx.Provider value={{ user, logout }}>
      <div className="admin">
        <header className="admin-head">
          <h1>📊 CalSnap Admin</h1>
          <nav className="admin-nav">
            <NavLink to="/" end>Overview</NavLink>
            <NavLink to="/users">Users</NavLink>
            <NavLink to="/subscriptions">Pro &amp; revenue</NavLink>
            <NavLink to="/ai">AI activity</NavLink>
          </nav>
          <div className="admin-me">
            <span className="small muted">{user.email}</span>
            <button className="btn secondary sm" onClick={() => logout()}>Log out</button>
          </div>
        </header>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="ai" element={<AiActivity />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthCtx.Provider>
  );
}

function Login({ notice, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api("/auth/login", { method: "POST", body: { email, password } });
      if (user.role !== "admin") {
        setError("This account is not an admin. Ask an existing admin to give you access.");
        return;
      }
      setToken(token);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card login stack" onSubmit={submit}>
        <div>
          <h1>📊 CalSnap Admin</h1>
          <p className="small muted">Log in with an admin account of the CalSnap app.</p>
        </div>
        {notice && <div className="error">{notice}</div>}
        <label className="stack small" style={{ gap: 6 }}>
          Email
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="stack small" style={{ gap: 6 }}>
          Password
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        <p className="small muted center">Server: {API_BASE || "this machine (dev proxy)"}</p>
      </form>
    </div>
  );
}
