// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ——— Types
interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  user_type?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

// Réponses API typées
interface TokenResponse {
  access?: string;
  refresh?: string;
}
interface ErrorResponse {
  detail?: string;
  message?: string;
  [k: string]: unknown;
}
function isTokenResponse(v: unknown): v is TokenResponse {
  return typeof v === 'object' && v !== null && ('access' in v || 'refresh' in v);
}
function isErrorResponse(v: unknown): v is ErrorResponse {
  return typeof v === 'object' && v !== null;
}

// ——— Contexte
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  refreshAccessToken: async () => false,
});

// ——— Constantes API
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api').replace(/\/+$/,'');
const WHOAMI  = `${API_BASE}/users/me/`;        // adapte si nécessaire
const TOKEN   = `${API_BASE}/token/`;           // SimpleJWT obtain (email + password)
const REFRESH = `${API_BASE}/token/refresh/`;   // SimpleJWT refresh

// ——— Helpers stockage
function safeJSONParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || raw === 'undefined' || raw === 'null') return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function setCookie(name: string, value: string, maxAgeSeconds = 3600) {
  try { document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`; } catch {}
}
function clearCookie(name: string) {
  try { document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`; } catch {}
}

function getAccess(): string | null {
  try { return localStorage.getItem('access_token'); } catch { return null; }
}
function getRefresh(): string | null {
  try { return localStorage.getItem('refresh_token'); } catch { return null; }
}
function setTokens(access: string, refresh?: string | null) {
  try {
    localStorage.setItem('access_token', access);
    setCookie('access_token', access, 3600); // pour le middleware Next
    if (refresh != null) {
      if (typeof refresh === 'string' && refresh.length > 0) {
        localStorage.setItem('refresh_token', refresh);
      } else {
        localStorage.removeItem('refresh_token');
      }
    }
  } catch {}
}
function clearTokens() {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    clearCookie('access_token');
  } catch {}
}

// ——— Provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // GET /users/me/ avec access token
  const fetchMe = useCallback(async (): Promise<User> => {
    const access = getAccess();
    if (!access) throw new Error('NO_ACCESS');
    const res = await fetch(WHOAMI, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${access}` },
      cache: 'no-store',
    });
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data: unknown = await res.json();
    // On suppose que l'API renvoie un User valide :
    return data as User;
  }, []);

  // POST /token/refresh/
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const refresh = getRefresh();
    if (!refresh) return false;
    const res = await fetch(REFRESH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data: unknown = await res.json();
    if (isTokenResponse(data) && typeof data.access === 'string' && data.access.length > 0) {
      setTokens(data.access);
      return true;
    }
    return false;
  }, []);

  // POST /token/ (email + password)
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      let msg = 'Identifiants invalides';
      try {
        const j: unknown = await res.json();
        if (isErrorResponse(j)) {
          msg = j.detail || j.message || msg;
        }
      } catch {
        // garder msg par défaut
      }
      throw new Error(msg);
    }

    const data: unknown = await res.json();
    if (!isTokenResponse(data) || typeof data.access !== 'string' || data.access.length === 0) {
      throw new Error('Réponse login invalide: pas de access token');
    }

    // Stock tokens
    setTokens(data.access, typeof data.refresh === 'string' ? data.refresh : null);

    // Profil utilisateur
    try {
      const me = await fetchMe();
      setUser(me);
      try { localStorage.setItem('user', JSON.stringify(me)); } catch {}
    } catch {
      setUser(null);
      try { localStorage.removeItem('user'); } catch {}
    }

    router.push('/dashboard');
  }, [fetchMe, router]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    try { localStorage.removeItem('user'); } catch {}
    router.push('/');
  }, [router]);

  // Hydratation initiale : tenter /me, puis refresh si 401
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cachedUser = safeJSONParse<User | null>(localStorage.getItem('user'), null);
        if (!cancelled && cachedUser) setUser(cachedUser);

        try {
          const me = await fetchMe();
          if (!cancelled) {
            setUser(me);
            try { localStorage.setItem('user', JSON.stringify(me)); } catch {}
          }
        } catch (e) {
          if (e instanceof Error && e.message === 'UNAUTHORIZED') {
            const ok = await refreshAccessToken();
            if (ok) {
              try {
                const me2 = await fetchMe();
                if (!cancelled) {
                  setUser(me2);
                  try { localStorage.setItem('user', JSON.stringify(me2)); } catch {}
                }
              } catch {
                // /me encore KO après refresh — on garde l’éventuel cache
              }
            } else {
              if (!cancelled) logout();
            }
          }
          // autres erreurs (réseau/5xx) : ne pas déconnecter
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init 1 seule fois

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    logout,
    refreshAccessToken,
  }), [user, isLoading, login, logout, refreshAccessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ——— Hook
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};