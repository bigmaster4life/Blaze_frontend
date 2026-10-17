'use client';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import api, {
  authApi,
  apiErrorMessage,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken as refreshToken,
  SESSION_ENDED_EVENT,
  setTokens,
} from '@/utils/api';

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  user_type?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  retrySession: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}
const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const generation = useRef(0);
  const retrySession = useCallback(async () => {
    const run = ++generation.current;
    setIsLoading(true);
    setSessionError(null);
    try {
      if (!getAccessToken() && !getRefreshToken()) {
        setUser(null);
        return;
      }
      if (!getAccessToken()) await refreshToken();
      const { data } = await api.get<User>('/users/me/');
      if (run === generation.current) setUser(data);
    } catch (error) {
      if (run !== generation.current) return;
      setUser(null);
      if (getAccessToken() || getRefreshToken())
        setSessionError(apiErrorMessage(error));
    } finally {
      if (run === generation.current) setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    const requestGeneration = generation;
    const ended = () => {
      generation.current++;
      setUser(null);
      setSessionError(null);
      setIsLoading(false);
    };
    const storage = (event: StorageEvent) => {
      if (
        event.key === 'access_token' ||
        event.key === 'refresh_token' ||
        event.key === null
      )
        void retrySession();
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    window.addEventListener('storage', storage);
    void retrySession();
    return () => {
      requestGeneration.current++;
      window.removeEventListener(SESSION_ENDED_EVENT, ended);
      window.removeEventListener('storage', storage);
    };
  }, [retrySession]);
  const login = useCallback(async (email: string, password: string) => {
    const run = ++generation.current;
    setSessionError(null);
    try {
      const { data } = await authApi.post<{ access: string; refresh: string }>(
        '/token/',
        { email: email.trim().toLowerCase(), password }
      );
      if (run !== generation.current)
        throw new Error('Connexion interrompue. Réessayez.');
      if (!data.access || !data.refresh)
        throw new Error('Réponse de connexion invalide.');
      setTokens(data.access, data.refresh);
      const { data: me } = await api.get<User>('/users/me/');
      if (run !== generation.current)
        throw new Error('Connexion interrompue. Réessayez.');
      setUser(me);
      setIsLoading(false);
    } catch (error) {
      if (run === generation.current) {
        setUser(null);
        setIsLoading(false);
      }
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        error.config?.url === '/token/'
      )
        throw new Error('Adresse email ou mot de passe incorrect.');
      throw new Error(apiErrorMessage(error));
    }
  }, []);
  const logout = useCallback(() => {
    clearTokens();
    router.replace('/login');
  }, [router]);
  const refreshAccessToken = useCallback(async () => {
    try {
      await refreshToken();
      return true;
    } catch {
      return false;
    }
  }, []);
  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionError,
      login,
      logout,
      retrySession,
      refreshAccessToken,
    }),
    [
      user,
      isLoading,
      sessionError,
      login,
      logout,
      retrySession,
      refreshAccessToken,
    ]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
}
