import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, getToken, setToken } from "./api.js";
import Auth from "./pages/Auth.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Home from "./pages/Home.jsx";
import AddFood from "./pages/AddFood.jsx";
import Progress from "./pages/Progress.jsx";
import Settings from "./pages/Settings.jsx";
import Plans from "./pages/Plans.jsx";
import Fitness from "./pages/Fitness.jsx";
import Muscle from "./pages/Muscle.jsx";
import BottomNav from "./components/BottomNav.jsx";
import { applyTheme } from "./theme.js";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then(setUser)
      // Only drop the token if the server rejected it, not when it's just unreachable
      .catch((err) => {
        if (err.status === 401 || err.status === 404) setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Pink theme for women; back to the default after logout
  const gender = user?.profile?.gender;
  useEffect(() => {
    if (!loading) applyTheme(gender);
  }, [loading, gender]);

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
            <Route path="/plans" element={<Plans />} />
            <Route path="/fitness" element={<Fitness />} />
            <Route path="/fitness/:id" element={<Muscle />} />
            <Route path="/fitness/women/:id" element={<Muscle women />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </>
      )}
    </AuthCtx.Provider>
  );
}
