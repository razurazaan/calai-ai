import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, getToken, setToken } from "./api.js";
import Auth from "./pages/Auth.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Home from "./pages/Home.jsx";
import AddFood from "./pages/AddFood.jsx";
import Progress from "./pages/Progress.jsx";
import Settings from "./pages/Settings.jsx";
import BottomNav from "./components/BottomNav.jsx";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, u) => {
    setToken(token);
    setUser(u);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, login, logout }}>
      {!user ? (
        <Routes>
          <Route path="*" element={<Auth />} />
        </Routes>
      ) : !user.onboarded ? (
        <Routes>
          <Route path="*" element={<Onboarding />} />
        </Routes>
      ) : (
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/add/:mode" element={<AddFood />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </>
      )}
    </AuthCtx.Provider>
  );
}
