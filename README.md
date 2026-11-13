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

Requirements: Node.js 20+.

1. Register an OAuth App Client in Buffer at **Settings → API** (<https://publish.buffer.com/settings/api>).
   Set the redirect URI to `http://localhost:3000/api/auth/callback` (or your deployed URL + `/api/auth/callback`).
2. Configure the environment:

   ```bash
   cp .env.example .env.local
   # fill in BUFFER_CLIENT_ID (and BUFFER_CLIENT_SECRET for confidential clients)
   # set SESSION_SECRET, e.g. `openssl rand -base64 32`
   ```

3. Install and start:

   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm test`.

### Try it without Buffer credentials

`scripts/mock-buffer.mjs` is a small local stand-in for Buffer's auth and GraphQL endpoints (with one channel that always fails, to exercise error handling):

```bash
node scripts/mock-buffer.mjs &
BUFFER_CLIENT_ID=test \
BUFFER_REDIRECT_URI=http://localhost:3000/api/auth/callback \
SESSION_SECRET=$(openssl rand -base64 32) \
BUFFER_AUTH_URL=http://localhost:4010 \
BUFFER_API_URL=http://localhost:4010/graphql \
npm run dev
```

## How it works

| Piece | Where |
| --- | --- |
| OAuth 2.0 Authorization Code + PKCE (S256), state check, token refresh | `src/lib/oauth.ts`, `src/app/api/auth/*` |
| Tokens kept server-side in an AES-256-GCM encrypted, httpOnly cookie | `src/lib/session.ts`, `src/lib/crypto.ts` |
| `account → organizations`, `channels`, `ideas` queries | `src/lib/buffer.ts`, `src/app/api/channels`, `src/app/api/ideas` |
| Rule-based per-platform adaptation (limits, tone, hashtags, CTAs) | `src/lib/adapt.ts`, `src/lib/platforms.ts` |
| `createIdea`, then one `createPost` per channel with `ideaId`, assets, mode and service metadata | `src/app/api/publish/route.ts`, `src/lib/post-input.ts` |
| Compose → Review → Done UI | `src/app/compose/Cascade.tsx` |

Notes:

- Every mutation selects both the success type and `... on MutationError { message }`; per-channel failures are shown individually and can be retried without duplicating posts or the idea.
- Scheduling modes: `addToQueue`, `customScheduled` (with `dueAt`), and drafts (`addToQueue` + `saveToDraft: true`).
- Media must be a public URL; Buffer fetches it. Instagram, TikTok, YouTube and Pinterest are validated for required media before sending.
- Metrics are not read: they are personal-key only and unavailable to App Clients.

## Status

Built for Buffer Commit 2026.

## Next steps

- Stronger per-platform adaptation
- Multi-image and richer media support
- Thread and first-comment helpers
- Optional personal-key metrics view for the account owner
