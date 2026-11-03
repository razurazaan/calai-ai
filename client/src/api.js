const TOKEN_KEY = "calsnap_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
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
