// Runs after installing the server's dependencies. On Render it also builds the web client, so the
// Express server can serve it whatever build command the dashboard uses ("yarn", "npm install", ...).
// Elsewhere it does nothing, to keep local installs fast (use `npm run build` there).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client");

if (!process.env.RENDER) process.exit(0);
if (!existsSync(path.join(client, "package.json"))) {
  console.warn(`No web client at ${client}; skipping the website build.`);
  process.exit(0);
}
const run = (cmd) => execSync(cmd, { cwd: client, stdio: "inherit" });
console.log("Building the web client...");
// --include=dev: NODE_ENV=production would otherwise skip Vite
run("npm install --include=dev --no-audit --no-fund");
run("npm run build");
// The same build, zipped as a live update for the Android / iPhone apps (served from /updates)
run("npm run bundle");
