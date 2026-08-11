const ACCESS_TOKEN_KEY = "auditflow-access-token";
const REFRESH_TOKEN_KEY = "auditflow-refresh-token";
const REMEMBER_KEY = "auditflow-remember-me";

// Tokens live in sessionStorage, which is private to a single tab, so two different accounts can
// be signed in side by side in two tabs of the same browser without one silently overwriting the
// other's session (localStorage is shared across every tab of the origin - that was the source of
// the cross-account data leakage/403s seen when testing two accounts at once). "Keep me signed in"
// is the deliberate opt-in that also persists to localStorage, so a brand-new tab that hasn't
// established its own session yet can inherit it - matching normal "stay signed in" expectations
// for the common single-account case, without reintroducing cross-tab bleed for the multi-account
// case (a tab that already has its own sessionStorage never looks at localStorage again).
function hydrateFromRememberedSession(): void {
  if (window.sessionStorage.getItem(ACCESS_TOKEN_KEY)) return;
  const rememberedAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const rememberedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (rememberedAccess && rememberedRefresh) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, rememberedAccess);
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, rememberedRefresh);
    window.sessionStorage.setItem(REMEMBER_KEY, "true");
  }
}
hydrateFromRememberedSession();

export function getAccessToken(): string | null {
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

/** `rememberMe` omitted (e.g. a silent refresh-token rotation) preserves whatever this tab's
 * session already decided at login — only an explicit login/accept-invite call sets it. */
export function setTokens(accessToken: string, refreshToken: string, rememberMe?: boolean): void {
  const remember = rememberMe ?? window.sessionStorage.getItem(REMEMBER_KEY) === "true";
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.sessionStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  if (remember) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  const wasRemembered = window.sessionStorage.getItem(REMEMBER_KEY) === "true";
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(REMEMBER_KEY);
  if (wasRemembered) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
