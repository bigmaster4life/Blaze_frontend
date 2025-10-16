export type Tokens = { access: string; refresh?: string | null };

const ACCESS_KEY = 'access';
const REFRESH_KEY = 'refresh';

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function setTokens(tokens: Tokens) {
  try {
    if (tokens.access) localStorage.setItem(ACCESS_KEY, tokens.access);
    if (tokens.refresh != null) {
      if (tokens.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh);
      else localStorage.removeItem(REFRESH_KEY);
    }
  } catch {}
}
export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {}
}