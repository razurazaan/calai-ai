const TOKEN_KEY = "calsnap_token";
// The production server. The website is served by it, so on the web requests stay same-origin (/api).
// The Android / iPhone app loads its pages from the phone, so it needs the full address. One build
// works for both, which lets the same bundle go live on the website and in the apps (live updates).
export const SERVER_URL = "https://calai-ai.onrender.com";
const IS_NATIVE = Boolean(window.Capacitor?.isNativePlatform?.());
const API_BASE = IS_NATIVE ? (import.meta.env.VITE_API_URL || SERVER_URL).replace(/\/$/, "") : "";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

// Download a file from an authenticated endpoint (e.g. admin CSV exports)
export async function download(path, filename) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Download failed (${res.status})`);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Which platform this is, for the admin website's analytics: the Capacitor Android build or the website
const CLIENT = (() => {
  const p = window.Capacitor?.getPlatform?.();
  return p === "android" || p === "ios" ? p : "web";
})();

export async function api(path,{ method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json", "X-Client": CLIENT };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // No JSON body on a 5xx means the dev proxy couldn't reach the backend
    const fallback =
      !data && res.status >= 500
        ? "Can't reach the server. Is the backend running? (cd server && npm run dev)"
        : `Request failed (${res.status})`;
    const err = new Error(data?.message || fallback);
    err.status = res.status;
    throw err;
  }
  return data;
}
