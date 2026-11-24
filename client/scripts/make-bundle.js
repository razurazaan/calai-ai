// Packs the built website (dist/) into a live-update bundle for the Android / iPhone apps.
// Run after `npm run build`. Writes:
//   updates/bundle-<version>.zip   the files the app downloads
//   updates/latest.json            what the server's /api/app/update endpoint offers
//
// The version is "<nativeVersion>-<content hash>", so rebuilding the same code gives the same version
// and phones don't download anything. `nativeVersion` (package.json) is the native app version this
// bundle needs: apps whose native version differs are not offered it (see server/routes/app.js).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const out = path.join(root, "updates");
const { nativeVersion } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(nativeVersion || "")) throw new Error(`package.json nativeVersion must look like 1.0.0, not "${nativeVersion}"`);

// All files under dist/, with forward-slash paths relative to it (index.html at the zip root)
function listFiles(dir, prefix = "") {
  return readdirSync(dir).sort().flatMap((name) => {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    return statSync(full).isDirectory() ? listFiles(full, rel) : [rel];
  });
}

let files;
try {
  files = listFiles(dist);
} catch {
  throw new Error("No dist/ folder. Run `npm run build` first.");
}
if (!files.includes("index.html")) throw new Error("dist/index.html is missing. Run `npm run build` first.");

const content = createHash("sha256");
const entries = {};
const mtime = new Date("2020-01-01T00:00:00Z"); // fixed, so the zip is the same for the same files
for (const rel of files) {
  const data = readFileSync(path.join(dist, rel));
  content.update(rel).update("\0").update(data).update("\0");
  entries[rel] = [data, { mtime }];
}
const version = `${nativeVersion}-${content.digest("hex").slice(0, 12)}`;
const zip = zipSync(entries, { level: 9 });
const file = `bundle-${version}.zip`;

rmSync(out, { recursive: true, force: true }); // only the latest bundle is served
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, file), zip);
const manifest = {
  version,
  nativeVersion,
  file,
  checksum: createHash("sha256").update(zip).digest("hex"),
  size: zip.length,
  builtAt: new Date().toISOString(),
};
writeFileSync(path.join(out, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Live-update bundle ${version} (${(zip.length / 1024).toFixed(0)} KB, ${files.length} files) -> updates/${file}`);
