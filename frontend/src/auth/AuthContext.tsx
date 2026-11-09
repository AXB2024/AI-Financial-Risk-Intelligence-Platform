import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, login, logout, onUnauthorized, register } from '../services/api';
import { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = () => {
    setUser(null);
  };

  useEffect(() => onUnauthorized(clearSession), []);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearSession();
      })
      .finally(() => setInitializing(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signIn: async (email: string, password: string) => {
        const session = await login({ email, password });
        setUser(session.user);
      },
      signUp: async (name: string, email: string, password: string) => {
        const session = await register({ name, email, password });
        setUser(session.user);
      },
      signOut: () => {
        void logout().finally(clearSession);
        clearSession();
      },
    }),
    [initializing, user],
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
