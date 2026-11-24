// Its own storage key, so the admin login is separate from a CalSnap app login in the same browser
const TOKEN_KEY = "calsnap_admin_token";
// Empty in development (Vite proxies /api); in production the backend's address, e.g. https://calsnap-api.onrender.com
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the session lasts until the tab closes */
  }
};

// Called when the server rejects the token, so the app can return to the login screen
let onUnauthorized = () => {};
export const setOnUnauthorized = (fn) => (onUnauthorized = fn);

// X-Client: admin keeps dashboard visits out of the app's daily-active-user numbers
const headers = () => {
  const h = { "Content-Type": "application/json", "X-Client": "admin" };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error(`Can't reach the CalSnap server${API_BASE ? ` at ${API_BASE}` : ""}. Is the backend running?`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && getToken()) onUnauthorized();
    const fallback = !data && res.status >= 500 ? "Can't reach the CalSnap server. Is the backend running?" : `Request failed (${res.status})`;
    const err = new Error(data?.message || fallback);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Download a file from an authenticated endpoint (CSV exports)
export async function download(path, filename) {
  const res = await fetch(`${API_BASE}/api${path}`, { headers: headers() });
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
