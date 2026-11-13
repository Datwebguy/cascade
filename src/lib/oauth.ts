import { randomToken, sha256base64url } from "./crypto";

const AUTH_BASE = process.env.BUFFER_AUTH_URL || "https://auth.buffer.com";
export const AUTH_URL = `${AUTH_BASE}/auth`;
export const TOKEN_URL = `${AUTH_BASE}/token`;

// Only what Cascade needs: read channels/account, write ideas and posts, refresh.
// Narrowest set Cascade needs:
//  account:read  - organizations and channels
//  posts:write   - createPost
//  posts:read    - confirm whether a post landed after a timeout (writes have no idempotency key)
//  ideas:read    - start from a saved Idea
//  ideas:write   - createIdea
//  offline_access - refresh token, so users are not sent back to consent every hour
export const SCOPES = [
  "account:read",
  "posts:write",
  "posts:read",
  "ideas:read",
  "ideas:write",
  "offline_access",
].join(" ");

export class TokenRefreshError extends Error {
  constructor(message: string, readonly permanent: boolean) {
    super(message);
  }
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

export function oauthConfig() {
  const clientId = process.env.BUFFER_CLIENT_ID?.trim();
  if (!clientId) throw new Error("BUFFER_CLIENT_ID must be set.");
  return { clientId, clientSecret: process.env.BUFFER_CLIENT_SECRET?.trim() || undefined };
}

/**
 * The redirect URI for the domain the user is on, so the callback lands on the same host that
 * holds the PKCE cookie. Every domain used must be registered on the Buffer App Client
 * (Buffer compares character for character). BUFFER_REDIRECT_URI is the fallback when the
 * request origin isn't known.
 */
export function redirectUriFor(origin: string | null): string {
  if (origin && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) return `${origin}/api/auth/callback`;
  const fallback = process.env.BUFFER_REDIRECT_URI?.trim();
  if (!fallback) throw new Error("Couldn't determine the redirect URI. Set BUFFER_REDIRECT_URI.");
  return fallback;
}

export function createPkce() {
  const verifier = randomToken(32);
  return { verifier, challenge: sha256base64url(verifier), state: randomToken(16) };
}

export function authorizeUrl(challenge: string, state: string, redirectUri: string): string {
  const { clientId } = oauthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const { clientId, clientSecret } = oauthConfig();
  const body = new URLSearchParams({ client_id: clientId, ...params });
  // Public clients authenticate with PKCE alone and must not send a secret.
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== "string") {
    const code = String(json.error ?? res.status);
    console.error("Buffer token request failed", { status: res.status, error: json.error, description: json.error_description });
    // invalid_grant: code/refresh token expired, used, or revoked -> user must reconnect.
    throw new TokenRefreshError(`Buffer sign-in failed (${code}).`, code === "invalid_grant" || code === "invalid_client");
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };
}

export function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<TokenSet> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
}

/** Refresh tokens are single-use: always persist the new refresh token returned. */
export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}
