import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, login, onUnauthorized, register, setAccessToken } from '../services/api';
import { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'risk-platform-token';
const TOKEN_VERSION_KEY = 'risk-platform-token-version';
const TOKEN_VERSION = 'tenant-v1';

function isTokenExpired(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return true;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(window.atob(normalizedPayload)) as { exp?: number };
    if (!decoded.exp) {
      return true;
    }

    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (localStorage.getItem(TOKEN_VERSION_KEY) !== TOKEN_VERSION) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return localStorage.getItem(TOKEN_KEY);
  });
  const [initializing, setInitializing] = useState(true);

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_VERSION_KEY);
    setAccessToken(null);
    setToken(null);
    setUser(null);
  };

  useEffect(() => onUnauthorized(clearSession), []);

  useEffect(() => {
    if (token && isTokenExpired(token)) {
      clearSession();
      setInitializing(false);
      return;
    }

    setAccessToken(token);

    if (!token) {
      setInitializing(false);
      return;
    }

    getMe()
      .then(setUser)
      .catch(() => {
        clearSession();
      })
      .finally(() => setInitializing(false));
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initializing,
      signIn: async (email: string, password: string) => {
        const session = await login({ email, password });
        localStorage.setItem(TOKEN_KEY, session.accessToken);
        localStorage.setItem(TOKEN_VERSION_KEY, TOKEN_VERSION);
        setAccessToken(session.accessToken);
        setToken(session.accessToken);
        setUser(session.user);
      },
      signUp: async (name: string, email: string, password: string) => {
        const session = await register({ name, email, password });
        localStorage.setItem(TOKEN_KEY, session.accessToken);
        localStorage.setItem(TOKEN_VERSION_KEY, TOKEN_VERSION);
        setAccessToken(session.accessToken);
        setToken(session.accessToken);
        setUser(session.user);
      },
      signOut: () => {
        clearSession();
      },
    }),
    [initializing, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
