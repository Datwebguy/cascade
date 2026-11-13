import { cookies } from "next/headers";
import { randomToken, seal, unseal } from "./crypto";
import { refreshTokens, TokenRefreshError, type TokenSet } from "./oauth";
import { del, getJson, setJson, tryLock } from "./store";

const SESSION_COOKIE = "cascade_sid";
const PKCE_COOKIE = "cascade_pkce";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days, renewed on refresh
const REFRESH_MARGIN_MS = 2 * 60 * 1000; // refresh 2 minutes before expiry

const cookieBase = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

const tokenKey = (sid: string) => `cascade:tokens:${sid}`;
const lockKey = (sid: string) => `cascade:refresh-lock:${sid}`;
export const cacheKey = (sid: string, name: string) => `cascade:cache:${sid}:${name}`;

export interface PkceState {
  verifier: string;
  state: string;
  redirectUri: string;
}

// ---- PKCE (short-lived, encrypted cookie: survives serverless instance changes) ----

export async function setPkce(value: PkceState) {
  (await cookies()).set(PKCE_COOKIE, seal(value), { ...cookieBase, maxAge: 600 });
}

export async function takePkce(): Promise<PkceState | null> {
  const jar = await cookies();
  const value = unseal<PkceState>(jar.get(PKCE_COOKIE)?.value);
  jar.delete(PKCE_COOKIE);
  return value;
}

// ---- Session ----

export async function sessionId(): Promise<string | null> {
  return unseal<{ sid: string }>((await cookies()).get(SESSION_COOKIE)?.value)?.sid ?? null;
}

export async function startSession(tokens: TokenSet) {
  const sid = randomToken(24);
  await setJson(tokenKey(sid), tokens, SESSION_TTL);
  (await cookies()).set(SESSION_COOKIE, seal({ sid }), { ...cookieBase, maxAge: SESSION_TTL });
}

export async function endSession() {
  const sid = await sessionId();
  if (sid) {
    await del(tokenKey(sid));
    await del(cacheKey(sid, "orgs"));
  }
  (await cookies()).delete(SESSION_COOKIE);
}

/** True when the browser holds a session whose tokens still exist in the store. */
export async function hasSession(): Promise<boolean> {
  const sid = await sessionId();
  return !!sid && (await getJson<TokenSet>(tokenKey(sid))) !== null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns a valid access token for the current session.
 *
 * Buffer refresh tokens rotate and reusing a spent one revokes the whole grant, so exactly one
 * caller refreshes (guarded by a lock in the shared store). Others wait for its result.
 */
export async function getAccessToken(): Promise<{ sid: string; token: string } | null> {
  const sid = await sessionId();
  if (!sid) return null;

  for (let attempt = 0; attempt < 30; attempt++) {
    const tokens = await getJson<TokenSet>(tokenKey(sid));
    if (!tokens) return null;
    if (tokens.expiresAt - Date.now() > REFRESH_MARGIN_MS) return { sid, token: tokens.accessToken };
    if (!tokens.refreshToken) return null;

    if (await tryLock(lockKey(sid), 15_000)) {
      try {
        // Re-read: another request may have refreshed between our read and the lock.
        const latest = await getJson<TokenSet>(tokenKey(sid));
        if (!latest) return null;
        if (latest.expiresAt - Date.now() > REFRESH_MARGIN_MS) return { sid, token: latest.accessToken };
        const next = await refreshTokens(latest.refreshToken!);
        // Persist the rotated refresh token before anything else can use the old one.
        await setJson(tokenKey(sid), { ...next, refreshToken: next.refreshToken ?? latest.refreshToken }, SESSION_TTL);
        return { sid, token: next.accessToken };
      } catch (e) {
        if (e instanceof TokenRefreshError && e.permanent) {
          await del(tokenKey(sid));
          return null;
        }
        throw e;
      } finally {
        await del(lockKey(sid));
      }
    }
    await sleep(300); // someone else is refreshing; wait for their result
  }
  throw new Error("Timed out waiting for the Buffer session to refresh. Please try again.");
}

/** Drop the stored tokens (e.g. after Buffer reports the grant was revoked). */
export async function invalidateSession(sid: string) {
  await del(tokenKey(sid));
  await del(cacheKey(sid, "orgs"));
}
