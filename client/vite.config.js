import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // reachable from your phone on the same Wi-Fi
    proxy: { "/api": process.env.API_URL || "http://localhost:5050" },
  },
});
