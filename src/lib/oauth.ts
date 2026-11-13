import { randomToken, sha256base64url } from "./crypto";

const AUTH_BASE = process.env.BUFFER_AUTH_URL || "https://auth.buffer.com";
export const AUTH_URL = `${AUTH_BASE}/auth`;
export const TOKEN_URL = `${AUTH_BASE}/token`;

// Only what Cascade needs: read channels/account, write ideas and posts, refresh.
export const SCOPES = [
  "account:read",
  "posts:read",
  "posts:write",
  "ideas:read",
  "ideas:write",
  "offline_access",
].join(" ");

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

export function oauthConfig() {
  const clientId = process.env.BUFFER_CLIENT_ID;
  const redirectUri = process.env.BUFFER_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("BUFFER_CLIENT_ID and BUFFER_REDIRECT_URI must be set.");
  }
  return {
    clientId,
    redirectUri,
    clientSecret: process.env.BUFFER_CLIENT_SECRET || undefined,
  };
}

export function createPkce() {
  const verifier = randomToken(32);
  return { verifier, challenge: sha256base64url(verifier), state: randomToken(16) };
}

export function authorizeUrl(challenge: string, state: string): string {
  const { clientId, redirectUri } = oauthConfig();
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
    const reason = (json.error_description || json.error || res.statusText) as string;
    throw new Error(`Buffer token request failed: ${reason}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };
}

export function exchangeCode(code: string, verifier: string): Promise<TokenSet> {
  const { redirectUri } = oauthConfig();
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
