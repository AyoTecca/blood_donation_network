import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getStoredToken, setStoredToken } from "../api";

export type AuthUser = {
  user_id: number;
  email: string;
  role: "admin" | "staff";
};

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type TokenResponse = { access_token: string; token_type: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshMe = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setToken(null);
      setUser(null);
      return;
    }
    setToken(t);
    const me = await apiFetch<AuthUser>("/api/auth/me");
    setUser(me);
  }, []);

  useEffect(() => {
    const t = getStoredToken();
    if (!t) {
      setReady(true);
      return;
    }
    setToken(t);
    apiFetch<AuthUser>("/api/auth/me")
      .then(setUser)
      .catch(() => {
        setStoredToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data = (await res.json()) as TokenResponse;
    setStoredToken(data.access_token);
    setToken(data.access_token);
    const me = await apiFetch<AuthUser>("/api/auth/me");
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data = (await res.json()) as TokenResponse;
    setStoredToken(data.access_token);
    setToken(data.access_token);
    const me = await apiFetch<AuthUser>("/api/auth/me");
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      login,
      register,
      logout,
      refreshMe,
    }),
    [ready, token, user, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
