import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api').replace(/\/+$/, '');
console.log('[WEB] API_BASE =', API_BASE);

// ── Storage keys (UNIFIÉ)
const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

// ── Cookies helpers
function setCookie(name: string, value: string, maxAgeSeconds = 3600) {
  try { document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`; } catch {}
}
function clearCookie(name: string) {
  try { document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`; } catch {}
}

// ── Tokens helpers (UN SEUL ENDROIT DE VÉRITÉ)
export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function setTokens(access: string, refresh?: string | null) {
  try {
    // LS
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh !== undefined) {
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      else localStorage.removeItem(REFRESH_KEY);
    }
    // COOKIE pour le middleware Next
    setCookie(ACCESS_KEY, access, 3600); // 1h, ajuste si besoin
  } catch {}
}
export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    clearCookie(ACCESS_KEY);
  } catch {}
}

// ── Client axios unique
const api = axios.create({
  baseURL: API_BASE,
  headers: { Accept: 'application/json' },
  withCredentials: false, // on passe en Bearer
});

// ── Ajout Bearer
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = getAccessToken();
  if (access) {
    const headers =
      config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);
    headers.set('Authorization', `Bearer ${access}`);
    config.headers = headers;
  }
  return config;
});

// ── Refresh SimpleJWT auto
let isRefreshing = false;
let waitQueue: Array<() => void> = [];

type RefreshResponse = { access: string };
interface RetryableRequestConfig extends InternalAxiosRequestConfig { _retry?: boolean; }

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError): Promise<AxiosResponse | never> => {
    const original = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const reRequest = () => api.request(original);

      if (isRefreshing) {
        await new Promise<void>((resolve) => waitQueue.push(resolve));
        return reRequest();
      }

      isRefreshing = true;
      try {
        const refresh = getRefreshToken();
        if (!refresh) throw new Error('No refresh token');

        const { data } = await axios.post<RefreshResponse>(`${API_BASE}/token/refresh/`, { refresh });

        // ⬇️ CRUCIAL : mettre aussi le COOKIE à jour pour le middleware
        setTokens(data.access);

        waitQueue.forEach((r) => r());
        waitQueue = [];
        return reRequest();
      } catch (e) {
        clearTokens();
        waitQueue = [];
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
    throw error;
  }
);

export default api;