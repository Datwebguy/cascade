import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, redirectUriFor } from "./oauth";

test("redirect URI follows the HTTPS origin the user is on", () => {
  assert.equal(redirectUriFor("https://oncascade.vercel.app"), "https://oncascade.vercel.app/api/auth/callback");
  assert.equal(redirectUriFor("https://localhost:3000"), "https://localhost:3000/api/auth/callback");
});

test("non-HTTPS or odd origins fall back to BUFFER_REDIRECT_URI", () => {
  process.env.BUFFER_REDIRECT_URI = " https://example.com/api/auth/callback\n";
  assert.equal(redirectUriFor("http://oncascade.vercel.app"), "https://example.com/api/auth/callback");
  assert.equal(redirectUriFor(null), "https://example.com/api/auth/callback");
  assert.equal(redirectUriFor("https://evil.com/path"), "https://example.com/api/auth/callback");
});

test("authorize URL carries PKCE S256, state, scopes and the redirect URI", () => {
  process.env.BUFFER_CLIENT_ID = "cid";
  const u = new URL(authorizeUrl("chal", "st", "https://oncascade.vercel.app/api/auth/callback"));
  assert.equal(u.origin + u.pathname, "https://auth.buffer.com/auth");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("state"), "st");
  assert.equal(u.searchParams.get("redirect_uri"), "https://oncascade.vercel.app/api/auth/callback");
  assert.match(u.searchParams.get("scope")!, /offline_access/);
});
