import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The admin website. In development /api is proxied to the CalSnap backend; in production set
// VITE_API_URL to the backend's address (e.g. https://calsnap-api.onrender.com).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    proxy: { "/api": process.env.API_URL || "http://localhost:5050" },
  },
  preview: { port: 5174 },
});
