import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import { restoreTheme } from "./theme.js";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

restoreTheme();

// Live updates: tell the updater this bundle started fine. Without this call within 10 seconds,
// the app rolls back to the previous working version on its own.
if (Capacitor.isNativePlatform()) CapacitorUpdater.notifyAppReady().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
