import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || 'https://be.blazepro.org/api'
).replace(/\/+$/, '');
const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
export const SESSION_ENDED_EVENT = 'blaze:session-ended';
let sessionVersion = 0;

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}
export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}
export function setTokens(
  access: string,
  refresh?: string | null,
  newSession = true
) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
    if (newSession) sessionVersion++;
  }
  // Retire l'ancien cookie : la session est restaurée et vérifiée par l'API.
  if (typeof document !== 'undefined')
    document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
}
export function clearTokens() {
  sessionVersion++;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem('user');
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    if (typeof document !== 'undefined')
      document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
  } finally {
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  }
}

// Auth et données partagent des délais bornés ; l'auth n'intercepte pas ses propres 401.
export const authApi = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});
const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});
let refreshFlight: { version: number; promise: Promise<string> } | null = null;

export function refreshAccessToken(): Promise<string> {
  const version = sessionVersion;
  if (refreshFlight?.version === version) return refreshFlight.promise;
  const refresh = getRefreshToken();
  if (!refresh)
    return Promise.reject(new Error('Session expirée. Reconnectez-vous.'));
  const promise = (async () => {
    try {
      const { data } = await authApi.post<{ access: string; refresh?: string }>(
        '/token/refresh/',
        { refresh }
      );
      if (version !== sessionVersion) throw new Error('Session remplacée.');
      if (!data.access) throw new Error('Réponse de session invalide.');
      setTokens(data.access, data.refresh, false);
      return data.access;
    } catch (error) {
      if (
        version === sessionVersion &&
        axios.isAxiosError(error) &&
        [400, 401].includes(error.response?.status ?? 0)
      )
        clearTokens();
      throw error;
    } finally {
      if (refreshFlight?.version === version) refreshFlight = null;
    }
  })();
  refreshFlight = { version, promise };
  return promise;
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _sessionVersion?: number;
}
api.interceptors.request.use((config: RetryableConfig) => {
  if (
    config._sessionVersion !== undefined &&
    config._sessionVersion !== sessionVersion
  )
    return Promise.reject(new Error('Session remplacée.'));
  config._sessionVersion = sessionVersion;
  config.headers = AxiosHeaders.from(config.headers);
  const access = getAccessToken();
  if (access) config.headers.set('Authorization', `Bearer ${access}`);
  else config.headers.delete('Authorization');
  return config;
});
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    if (error.response?.status !== 401 || !original) throw error;
    if (original._retry) {
      if (
        original._sessionVersion === sessionVersion &&
        AxiosHeaders.from(original.headers).get('Authorization') ===
          `Bearer ${getAccessToken()}`
      )
        clearTokens();
      throw error;
    }
    if (original._sessionVersion !== sessionVersion) throw error;
    if (!getRefreshToken()) {
      clearTokens();
      throw error;
    }
    original._retry = true;
    // Une réponse tardive d'un ancien jeton n'a pas besoin d'un deuxième refresh.
    if (
      AxiosHeaders.from(original.headers).get('Authorization') ===
      `Bearer ${getAccessToken()}`
    )
      await refreshAccessToken();
    // Do not replay a request after the session has been cleared.
    if (!getAccessToken()) throw error;
    original._sessionVersion = sessionVersion;
    return api.request(original);
  }
);

export function apiErrorMessage(
  error: unknown,
  fallback = 'Impossible de terminer cette opération.'
) {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return 'Le serveur met trop de temps à répondre. Réessayez.';
    if (!error.response)
      return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
    if (error.response.status >= 500)
      return 'Le serveur rencontre un problème. Réessayez dans un instant.';
    const data: unknown = error.response.data;
    if (data && typeof data === 'object') {
      const messages = Object.values(data)
        .flat()
        .filter((value): value is string => typeof value === 'string');
      if (messages.length) return messages.join(' ');
    }
  }
  return error instanceof Error ? error.message : fallback;
}
export default api;
