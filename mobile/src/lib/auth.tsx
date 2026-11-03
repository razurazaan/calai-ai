import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, ApiError } from './api';
import { getToken, setToken } from './storage';
import type { User } from './types';

type AuthValue = {
  user: User | null;
  loading: boolean;
  setUser: (u: User) => void;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Screens behind the auth guard always have a user
export function useUser() {
  const { user } = useAuth();
  if (!user) throw new Error('No logged-in user');
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (await getToken()) setUserState(await api<User>('/auth/me'));
      } catch (err) {
        // Only drop the token if the server rejected it, not when it's just unreachable
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value: AuthValue = {
    user,
    loading,
    setUser: setUserState,
    login: async (token, u) => {
      await setToken(token);
      setUserState(u);
    },
    logout: async () => {
      await setToken(null);
      setUserState(null);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
