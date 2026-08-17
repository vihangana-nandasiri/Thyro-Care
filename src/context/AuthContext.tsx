/**
 * Real authentication provider: memory access token + HttpOnly refresh cookie bootstrap.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authService from "@/services/authService";
import { setUnauthorizedHandler } from "@/services/api";
import { clearAccessToken, setAccessToken } from "@/services/tokenStore";
import type {
  AuthContextValue,
  AuthStatus,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  UserRole,
} from "@/types/auth";

export type { UserRole, AuthUser, AuthStatus };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("initializing");

  const applySession = useCallback((accessToken: string, nextUser: AuthUser) => {
    setAccessToken(accessToken);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authService.refresh();
      applySession(result.access_token, result.user);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await authService.refresh();
        if (cancelled) return;
        applySession(result.access_token, result.user);
      } catch {
        if (cancelled) return;
        clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAccessToken();
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const result = await authService.login(payload);
      applySession(result.access_token, result.user);
      return result.user;
    },
    [applySession],
  );

  const googleLogin = useCallback(
    async (credential: string) => {
      const result = await authService.googleLogin({ credential });
      applySession(result.access_token, result.user);
      return result.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const result = await authService.register(payload);
      applySession(result.access_token, result.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Always clear local session even if network logout fails
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated" && user !== null,
      role: user?.role ?? null,
      login,
      googleLogin,
      register,
      logout,
      refreshSession,
    }),
    [user, status, login, googleLogin, register, logout, refreshSession],
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
