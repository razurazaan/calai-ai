// Live updates for the Android / iPhone apps (@capgo/capacitor-updater, self-hosted).
// Each time the app opens, it POSTs here with its native version and the bundle it is running.
// If the website has a newer build, the app downloads it and switches to it the next time it goes to
// the background. The bundle is built with the website (client/scripts/make-bundle.js) on every deploy.
import express, { Router } from "express";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const updatesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/updates");
const manifestPath = path.join(updatesDir, "latest.json");

const router = Router();

// latest.json, re-read only when the file changes
let cached = { mtimeMs: 0, manifest: null };
function latestBundle() {
  if (!existsSync(manifestPath)) return null;
  const { mtimeMs } = statSync(manifestPath);
  if (mtimeMs !== cached.mtimeMs) {
    try {
      cached = { mtimeMs, manifest: JSON.parse(readFileSync(manifestPath, "utf8")) };
    } catch {
      cached = { mtimeMs, manifest: null };
    }
  }
  return cached.manifest;
}

// "1.0" and "1.0.0" are the same native version
const normalize = (v) => {
  const parts = String(v || "").trim().split(".").map((n) => Number.parseInt(n, 10));
  if (!parts.length || parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3).join(".");
};

function publicBase(req) {
  const env = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
}

const noUpdate = (res, message) => res.json({ message, error: "no_new_version_available" });

// POST /api/app/update  { platform, version_build (native app version), version_name (bundle or "builtin"), ... }
router.post(
  "/update",
  express.json({ type: () => true }), // whatever Content-Type the plugin sends
  (req, res) => {
    const body = req.body || {};
    const bundle = latestBundle();
    if (!bundle) return noUpdate(res, "No live update has been published");
    if (body.version_name === bundle.version) return noUpdate(res, "Already up to date");
    // A bundle only runs on the native version it was built for: newer web code may need a plugin or
    // permission an older app doesn't have, and an older bundle must not replace a newer app's code.
    // Those users get the change through a Play Store / App Store update instead.
    const native = normalize(body.version_build);
    if (!native || native !== normalize(bundle.nativeVersion)) {
      return noUpdate(res, `This app version (${body.version_build || "unknown"}) needs a store update for new features`);
    }
    res.json({
      version: bundle.version,
      url: `${publicBase(req)}/updates/${encodeURIComponent(bundle.file)}`,
      checksum: bundle.checksum,
    });
  }
);

// GET /api/app/version -> the bundle currently offered (handy for checking a deploy)
router.get("/version", (_req, res) => {
  const bundle = latestBundle();
  if (!bundle) return res.status(404).json({ message: "No live update has been published" });
  const { version, nativeVersion, size, builtAt } = bundle;
  res.json({ version, nativeVersion, size, builtAt });
});

export default router;
