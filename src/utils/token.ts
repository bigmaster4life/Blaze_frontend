// Compatibilité : toutes les pages utilisent les mêmes clés et le même stockage.
import { setTokens as storeTokens } from './api';
export { getAccessToken, getRefreshToken, clearTokens } from './api';
export type Tokens = { access: string; refresh?: string | null };
export function setTokens(tokens: Tokens) {
  storeTokens(tokens.access, tokens.refresh);
}
