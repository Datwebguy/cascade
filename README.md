# Cascade

One idea becomes fully adapted, media-ready posts across every channel you use in Buffer.

Cascade is a web app for people who post every day. You start with a single idea, optionally add media, and Cascade produces platform-adapted versions for your real Buffer channels. You review, edit, choose scheduling for each post, and send everything into Buffer in one action. The original idea is saved so it is not lost.

## What it does

1. Connect your Buffer account with OAuth.
2. See your real channels.
3. Enter one idea (or select an existing Idea).
4. Optionally add an image or video URL.
5. Receive adapted drafts for the channels you select.
6. Edit drafts, confirm media, and choose scheduling mode per channel.
7. Confirm — the idea is saved and the posts are created in Buffer.

## Why it exists

Daily posters already rewrite the same idea for different platforms, attach media, and manually get everything into Buffer. Cascade owns that adaptation and hand-off step.

## Buffer API surface

- OAuth 2.0 with PKCE (App Client)
- `channels` query
- `createIdea`
- `createPost` (with assets, scheduling mode, and optional service metadata)

## Run it

Requirements: Node.js 22+, a Buffer account, an OpenAI API key.

1. **Register an App Client** in Buffer: Settings → API → App Clients → New Client.
   - Type: **Private** (Cascade has a server that keeps the secret). PKCE is still used.
   - Permissions: `account:read`, `posts:read`, `posts:write`, `ideas:read`, `ideas:write`, plus offline access.
   - Redirect URIs (HTTPS is required, even locally): `https://localhost:3000/api/auth/callback` and your production URL + `/api/auth/callback`.
2. **Configure**: `cp .env.example .env.local` and fill in the values (see comments in the file).
3. **Run**:

   ```bash
   npm install
   npm run dev     # https://localhost:3000 (self-signed certificate; accept it in the browser)
   ```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm test`.

### Deploying (Vercel)

1. Import the repository into Vercel.
2. Add a Redis store from the Vercel Marketplace (Upstash). It sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
3. Set `BUFFER_CLIENT_ID`, `BUFFER_CLIENT_SECRET`, `BUFFER_REDIRECT_URI`, `SESSION_SECRET` and `OPENAI_API_KEY` in Project → Settings → Environment Variables.
4. Register `https://<your-domain>/api/auth/callback` on the Buffer App Client.
5. Smoke test: connect, pick channels, send with **Save as draft**, disconnect, reconnect.

### Local mock (tests only)

`scripts/mock-buffer.mjs` is a fixture server that imitates Buffer's auth and GraphQL endpoints so the flow can be tested without credentials. Point `BUFFER_AUTH_URL` / `BUFFER_API_URL` at it. It is not used by the app in production.

## How it works

| Piece | Where |
| --- | --- |
| OAuth 2.0 Authorization Code + PKCE (S256), state check | `src/lib/oauth.ts`, `src/app/api/auth/*` |
| Tokens in a shared Redis store; the browser only holds an encrypted session ID. Refresh is locked so a rotated refresh token is never replayed | `src/lib/session.ts`, `src/lib/store.ts` |
| Organizations + channels (with Mastodon limit, X subscription, Pinterest boards), cached per session | `src/lib/buffer.ts`, `src/app/api/handler.ts` |
| Saved Ideas, paginated | `src/app/api/ideas` |
| AI adaptation (OpenAI, structured output), validated against Buffer's counting rules with one targeted rewrite | `src/lib/ai.ts`, `src/app/api/adapt` |
| Character counting per network (X weighting, LinkedIn/Mastodon URL weights, Instagram line breaks, Bluesky graphemes) | `src/lib/count.ts`, `src/lib/platforms.ts` |
| Media URL check: public, direct, HTTPS; type from Content-Type | `src/lib/media.ts` |
| `createIdea`, then one `createPost` per channel with `ideaId`; success + `MutationError` selected; timeouts verified before any retry | `src/app/api/publish/route.ts`, `src/lib/post-input.ts` |
| Rate limits: `Retry-After`, `RateLimit` headers, low-quota warning | `src/lib/buffer.ts` |

Notes:

- Scheduling: add to queue, a custom time in the **channel's** timezone, or save as draft (`saveToDraft`).
- Per-network options: Instagram/Facebook post type, Pinterest board and title, YouTube title and visibility.
- Metrics are not read: they are personal-key only and unavailable to App Clients.
- See `docs/RESEARCH_AND_GAPS.md` for the documentation this is built against.

## Status

Built for Buffer Commit 2026.

## Next steps

- Stronger per-platform adaptation
- Multi-image and richer media support
- Thread and first-comment helpers
- Optional personal-key metrics view for the account owner
