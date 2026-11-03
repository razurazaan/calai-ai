import { API_URL } from './config';
import { getToken } from './storage';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown };

export async function api<T = any>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Can't reach the server at ${API_URL}. Is the backend running and on the same Wi-Fi?`,
      0
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
  return data as T;
}
