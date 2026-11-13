import { cookies } from "next/headers";
import { seal, unseal } from "./crypto";
import { refreshTokens, type TokenSet } from "./oauth";

const SESSION_COOKIE = "cascade_session";
const PKCE_COOKIE = "cascade_pkce";
const secure = process.env.NODE_ENV === "production";

export interface PkceState {
  verifier: string;
  state: string;
}

export async function setPkce(value: PkceState) {
  (await cookies()).set(PKCE_COOKIE, seal(value), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function takePkce(): Promise<PkceState | null> {
  const jar = await cookies();
  const value = unseal<PkceState>(jar.get(PKCE_COOKIE)?.value);
  jar.delete(PKCE_COOKIE);
  return value;
}

export async function saveTokens(tokens: TokenSet) {
  (await cookies()).set(SESSION_COOKIE, seal(tokens), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Read-only check, safe to use from Server Components. */
export async function hasSession(): Promise<boolean> {
  return unseal<TokenSet>((await cookies()).get(SESSION_COOKIE)?.value) !== null;
}

/**
 * Returns a usable access token, refreshing it if it is about to expire.
 * Only call from Route Handlers (it may write the cookie).
 */
export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const tokens = unseal<TokenSet>(jar.get(SESSION_COOKIE)?.value);
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  try {
    const next = await refreshTokens(tokens.refreshToken);
    // Keep the old refresh token only if Buffer did not issue a new one.
    await saveTokens({ ...next, refreshToken: next.refreshToken ?? tokens.refreshToken });
    return next.accessToken;
  } catch {
    await clearSession();
    return null;
  }
}
