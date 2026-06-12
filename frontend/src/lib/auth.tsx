"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, User } from "./api";
import { cacheStaffStatus, clearStaffCache, clearUserSessionData, isStaff } from "./staff";
import {
  clearStoredTokens,
  getAccessToken,
  getRefreshToken,
  onSessionTokenRefreshed,
  refreshAccessToken,
  storeEmail,
  storeTokens,
} from "./session";

const TOURNAMENT_STORAGE_KEY = "selected_tournament_id";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (username: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (accessToken: string): Promise<User | null> => {
    try {
      const me = await api.me(accessToken);
      cacheStaffStatus(me);
      if (isStaff(me)) {
        localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
      }
      setUser(me);
      setToken(accessToken);
      return me;
    } catch {
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearStoredTokens();
    clearStaffCache();
    setUser(null);
    setToken(null);
  }, []);

  const restoreSession = useCallback(async () => {
    let access = getAccessToken();

    if (access) {
      const me = await loadUser(access);
      if (me) return;
    }

    if (getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const me = await loadUser(refreshed);
        if (me) return;
      }
    }

    clearSession();
  }, [clearSession, loadUser]);

  useEffect(() => {
    onSessionTokenRefreshed((access) => {
      setToken(access);
    });
    return () => onSessionTokenRefreshed(null);
  }, []);

  useEffect(() => {
    restoreSession().finally(() => setLoading(false));
  }, [restoreSession]);

  const login = async (email: string, password: string, rememberMe = true) => {
    const tokens = await api.login(email, password);
    storeTokens(tokens.access, tokens.refresh, rememberMe);
    storeEmail(email);
    const me = await loadUser(tokens.access);
    if (!me) {
      clearSession();
      throw new Error("Login failed");
    }
    return me;
  };

  const register = async (username: string, email: string, password: string) => {
    await api.register({ username, email, password, password_confirm: password });
    return login(email, password, true);
  };

  const logout = async () => {
    const refresh = getRefreshToken();
    const access = getAccessToken();
    if (refresh && access) {
      try {
        await api.logout(refresh, access);
      } catch {
        /* ignore */
      }
    }
    clearUserSessionData();
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
