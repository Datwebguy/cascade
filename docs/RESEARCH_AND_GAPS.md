# Cascade — Research Notes and Gap Audit

This document records what the Buffer Commit rules and the Buffer API documentation require, and where the current Cascade build falls short. It is the checklist for the next round of work. No code changes are made until the plan at the end is agreed.

## 1. Sources read

| Source | Read |
| --- | --- |
| Buffer Commit page — buffer.com/api/commit | In full |
| Buffer Commit Developer Handbook (Notion) | In full |
| Guides: Building Apps, Authentication, Posts & Scheduling, Ideas, Hosting Media, Character Limits, Error Handling, Rate Limits, Efficient API Usage, Data Model, API Standards, Your First Post, REST Migration | In full |
| Examples: Create Idea, Create Video Post | In full |
| Official sample app `bufferapp/buffer-sample-apps/samples/app-client-starter-app` | README only (source code not yet read) |
| API Changelog | Scanned for every entry touching `createPost`, `createIdea`, `ideas`, `channels`, `ShareMode` |
| API Reference | Only targeted type lookups (CreatePostInput, CreateIdeaInput, Channel, PostInputMetaData and related enums) |

Not yet read: Content Items (experimental), Pagination, Tags, Threaded post example, Introduction, GraphQL intro, Buffer API Terms (brand section), the sample app's source.

## 2. Hackathon requirements (Buffer Commit 2026)

**Deadline: 13 November 2026, 11:59pm PT. Submissions cannot be edited after sending.**

Eligibility:

- Works end to end, connects through **Buffer OAuth**, makes **real API calls**.
- Must be an **App Client**, not a personal API key.
- **Publicly available** at submission and through judging (judging starts 16 Nov, winners 7 Dec). A judge must be able to actually use it.
- The deployed version must be the one shown in the video.

Submission checklist:

1. Client ID of the App Client (never the secret)
2. Team details and contact info
3. Live public URL that stays up through judging
4. Two-minute public demo video showing the real product and where the Buffer API is used
5. 300-word summary: the idea, the problem it solves, and what comes next
6. Optional build-in-public posts (Build-in-Public Award)

Judging: usefulness, execution and craft, creativity. Extra Delight Award for most distinctive UX.

Brand rules: may say "Built on the Buffer API" / "Connect your Buffer account". Must **not** use the Buffer logo in our logo, use "Buffer" in the app name, or style the app to look like Buffer.

## 3. API facts that affect Cascade

### OAuth / App Client

- Register under Settings → API → App Clients. Choose a **private (confidential)** client for a web app with a server. PKCE is still required.
- Authorize: `https://auth.buffer.com/auth`; token: `https://auth.buffer.com/token`.
- **Redirect URIs must be HTTPS, including localhost.** `http://localhost` is rejected. URIs are compared character for character at registration, authorize and token exchange. Several URIs can be registered (localhost + production).
- Access token lives about one hour. Store the expiry instant minus a margin.
- `offline_access` is needed for a refresh token. **Refresh tokens rotate; reusing an old one revokes the whole grant.** Concurrent refreshes (two tabs, retries, two instances) collide; one place must own the refresh.
- Tokens must never reach the browser. An encrypted HttpOnly cookie is an acceptable start but cannot coordinate concurrent refreshes; a shared store (Redis/KV/Postgres) is recommended for real traffic.
- Scopes: request the narrowest set. Cascade needs `account:read posts:write ideas:read ideas:write offline_access` (`posts:read` only if we read posts back).

### Rate limits (critical for judging)

- App Client limits are **shared by every user of the app, judges included**. Base: 100 / 15 min, 500 / 24 h, 15,000 / 30 days, plus 10 / 25 / 100 per authorized user (handbook quotes free tier 100 / 250 / 3,000).
- Every response carries `RateLimit` and `RateLimit-Policy` headers. A `429` carries `Retry-After` (header) and `errors[0].extensions.code = RATE_LIMIT_EXCEEDED` with a `window`.
- Guidance: cache organization and channel lists per session, combine queries into one request, select only fields used, do not re-fetch channels to validate an ID (createPost returns a typed `NotFoundError`).
- Writes have **no idempotency key**. Retry a `createPost` only when the error proves it never happened; after a timeout, check before retrying.

### Errors

- Typed mutation errors arrive in `data` with HTTP 200; always select `... on MutationError { message }`.
- Non-recoverable errors arrive in `errors[]` with `extensions.code`: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `UNEXPECTED`, `RATE_LIMIT_EXCEEDED`.
- Don't show raw error messages to users; map error types to friendly guidance and log the full response.

### Posts

- `createPost` required: `channelId`, `schedulingType` (`automatic`), `mode`; `text` effectively required. `assets` defaults to `[]`, `needsApproval` defaults to `false`.
- Modes: `addToQueue`, `customScheduled` (+ `dueAt` ISO UTC), `shareNext`, `shareNow`. Drafts: `saveToDraft: true`. The handbook recommends drafts for testing without publishing.
- Per-network `metadata`: threads on X/Bluesky/Threads/Mastodon; first comment on LinkedIn/Facebook/Instagram; Instagram post type (post/story/reel); Pinterest board; Google Business post type; YouTube title etc.
- Supported networks: Instagram, Threads, LinkedIn, X, Facebook, Google Business, Mastodon, YouTube, Pinterest, Bluesky, TikTok, Substack.

### Ideas

- Ideas belong to the organization, not a channel. `createIdea(input: { organizationId, content: { title, text } })` returns `Idea` (select `id`) or a `MutationError`.
- `ideas(input: { organizationId }, first, after)` is a paginated connection.
- `CreatePostInput.ideaId` links a post to its idea.

### Media

- No upload endpoint. Asset URLs must be **public, direct, HTTPS, and stable until the post publishes** (no signed/expiring URLs; Drive/Dropbox share links fail).
- Video thumbnail via `video.metadata.thumbnailOffset` (Instagram, TikTok, Pinterest).
- `linkAttachment` (link card) is mutually exclusive with non-empty `assets`.
- Fetch failures come back as `MutationError`, e.g. "Failed to fetch image dimensions: Not Found".

### Character limits (official)

| Network | Limit | Counting rule |
| --- | --- | --- |
| Facebook | 5,000 | UTF-16 |
| Instagram | 2,196 | UTF-16, line break counts 2 |
| X (free) | 280 (25,000 on paid tiers) | X weighted: URLs 23, emoji 2 |
| LinkedIn | 3,000 | UTF-16, every URL counts 24 |
| Pinterest | 500 (title 100) | UTF-16 |
| TikTok | 4,000 text/photo, 2,200 with video | UTF-16 |
| Threads | 500 (topic 50, no `&` or `.`) | UTF-16 |
| Bluesky | 300 | graphemes; URL = host + up to 16 |
| YouTube | 5,000 description, title 100, no `<` or `>` | UTF-16 |
| Google Business | 4,000 | UTF-16 |
| Mastodon | per server: `MastodonMetadata.maxCharacters` (cap 20,000) | URLs 23 |
| Substack | 10,000 | UTF-16 |

## 4. Audit of the current build

### Wrong (contradicts the docs)

1. README tells users to register `http://localhost:3000/api/auth/callback` — Buffer rejects non-HTTPS redirect URIs.
2. Character limits in `src/lib/platforms.ts` are hard-coded and several are wrong (Instagram, TikTok, Google Business, Substack, Mastodon); counting ignores per-network rules (URL weighting, Instagram line breaks, Bluesky graphemes).
3. Rate-limit handling reads `retryAfter` from the response body; Buffer sends `Retry-After` as a header and `RATE_LIMIT_EXCEEDED` in `errors[]`.
4. `/api/publish` re-fetches all organizations and channels on every publish — wasteful against a quota shared with judges.
5. Media URLs accept `http://`; Buffer requires HTTPS.
6. YouTube text is not checked for `<` / `>`.
7. Raw Buffer error messages are shown to the user verbatim.
8. Scope `posts:read` is requested but never used.

### Hard-coded / assumed without user input

1. Platform table (labels, limits, hashtag caps, "requires media") — partly wrong, partly invented.
2. Adaptation inserts fixed sentences into every post: "What's your take? I'd love to hear how you approach this.", "Save this for later and share it with someone who needs it.", "Follow for more.", "Link in bio.". These are not the user's words.
3. Hashtag caps per network are invented.
4. YouTube posts forced to `privacy: "public"`; Instagram `shouldShareToFeed: true`; Facebook `type: post`; Google Business `type: whats_new`; `source: "cascade"`.
5. Custom schedule default "tomorrow 09:00" in the browser's timezone, ignoring the channel's timezone.
6. Saved Ideas limited to the first 25, no pagination.
7. Media type guessed from the file extension.
8. X limit assumed 280 for every account.
9. Mock Buffer server ships fake channels and ideas (development only, but still in the repo).

### Missing

1. Not deployed — no public URL (eligibility requirement).
2. No App Client registered / client ID — needed for the submission.
3. No HTTPS local development setup.
4. Concurrent refresh protection (refresh-token replay revokes the grant).
5. Rate-limit awareness (`RateLimit` headers, `Retry-After`, friendly wait message).
6. Safe retry: a write that timed out should be checked before retrying to avoid duplicate posts.
7. Per-network options the docs support and the spec mentions as next steps: first comment, threads, Instagram post type choice, Pinterest board, YouTube title, video thumbnail offset.
8. Privacy policy link for the consent screen (optional but recommended).
9. Submission materials: 300-word summary, demo video script.
10. Branding check against Buffer's brand rules.

## 5. Open questions for the product owner

1. **Adaptation engine.** "Fully adapted" posts are the core promise. Rule-based templates produce the hard-coded phrases above. Options: (a) AI adaptation via an LLM API (needs an API key and adds cost), (b) rules that only restructure the user's own words (no injected phrases), (c) both, with AI optional.
2. **What is missing from the idea?** The README and spec describe Connect → Compose → Review → Done. Which parts of the product vision are not yet captured in the docs?
3. **Hosting.** Vercel is available to this session. Confirm the host and the production domain so the redirect URI can be registered.
4. **App Client.** Who registers it (private client), and with which redirect URIs?
5. **Token storage.** Encrypted cookie (simple, acceptable per docs) or a shared store such as Vercel KV/Upstash Redis (handles concurrent refresh properly)?

### Decisions (agreed)

- Adaptation: **AI adaptation** via OpenAI (default model gpt-5.4-mini), constrained by the official per-network limits and counting rules.
- Hosting: **Vercel**.
- Token storage: **shared store (Redis/KV)**, which owns token refresh so concurrent refreshes cannot replay a rotated refresh token.

Still open: question 2 (what is missing from the idea), the production domain, and who registers the App Client.

## 6. Proposed plan (step by step, each step reviewed before the next)

1. Agree answers to section 5.
2. Fix everything under "Wrong" in section 4.
3. Replace hard-coded data: platform rules from the official table, per-channel data from the API (e.g. Mastodon `maxCharacters`, channel timezone), and remove injected phrases.
4. Implement the chosen adaptation engine.
5. Add rate-limit handling, refresh protection, and safe retries.
6. Add per-network options (first comment, Instagram type, YouTube title, etc.) as agreed.
7. Deploy, register the production redirect URI, smoke-test with a real Buffer account using `saveToDraft`.
8. Prepare submission: summary, video script, client ID.

## 7. Status (13 Nov 2026)

Done and verified against a local Buffer mock, real OpenAI, and a real media URL:

- All "Wrong" items in section 4 (HTTPS redirect URIs, official limits and counting, `Retry-After` handling, cached channels, HTTPS-only media, YouTube `<`/`>`, friendly errors, scopes).
- All "Hard-coded" items in section 4 that can be derived from Buffer (limits, Mastodon `maxCharacters`, X subscription, Pinterest boards, channel timezone, Ideas pagination, media type from Content-Type). Stock phrases removed; forced YouTube/Instagram settings removed.
- AI adaptation (OpenAI), Redis token store with refresh lock, safe retry after timeouts, privacy page.
- Deployed to Vercel with Redis connected: https://oncascade.vercel.app. Buffer's login page accepts the app's authorization request.

Not yet verified:

- The complete flow against a **real Buffer account** (token exchange, `channels` with metadata fragments, `ideas`, `createIdea`, `createPost`). The queries follow the published reference but have not run against the live API.

Not built (candidates for "next steps"): first comments, threaded posts, Instagram user tags, video thumbnail offset, multi-image/carousel, team workspace.

Submission kit: see `docs/SUBMISSION.md`.
