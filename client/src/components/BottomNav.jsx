import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Sheet from "./Sheet.jsx";

const Icon = ({ d }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export default function BottomNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const go = (mode) => {
    setOpen(false);
    navigate(`/add/${mode}`);
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" end>
            <Icon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
            Home
          </NavLink>
          <NavLink to="/progress">
            <Icon d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            Progress
          </NavLink>
          <button className="fab" onClick={() => setOpen(true)} aria-label="Add food">+</button>
          <NavLink to="/settings">
            <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            Settings
          </NavLink>
        </div>
      </nav>

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
