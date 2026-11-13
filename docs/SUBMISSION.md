# Cascade — Buffer Commit submission kit

Deadline: **13 November 2026, 11:59pm Pacific**. Submissions are final once sent.

## Checklist

- [ ] Live app works end to end with a real Buffer account (connect, adapt, send as draft, verify in Buffer)
- [ ] Client ID: `lk8NsttOqb37qhBjV_IsU1fpVSunrzeiFPXurCngZJ0` (never the secret)
- [ ] Public URL: https://cascade-three-brown.vercel.app (must stay up through judging; judging starts 16 Nov, winners 7 Dec)
- [ ] Two-minute demo video, public link (YouTube / Loom / Drive)
- [ ] 300-word summary (below)
- [ ] Team details and contact information
- [ ] Optional: build-in-public posts that mention Buffer Commit

## 300-word summary (draft — edit to your own voice)

I post every day, and every day I do the same chore: I have one idea, then I rewrite it for X, LinkedIn, Instagram and the rest, hunt for an image, and paste everything into Buffer one channel at a time. The idea itself usually gets lost in the process.

Cascade does that hand-off step. You connect your Buffer account with OAuth (Authorization Code with PKCE, as a private App Client), write one idea, optionally add a public image or video URL, and choose which of your real Buffer channels to post to. Cascade adapts the idea for each channel with an AI model. X gets something short, LinkedIn something longer with paragraph breaks, Instagram a caption. Every draft is checked against Buffer's own character rules before anything is sent, including how X weights links and emoji, how LinkedIn counts URLs, and how Instagram counts line breaks. Mastodon limits, X subscription type and Pinterest boards are read from each channel's metadata.

On the review screen you edit anything, choose per channel whether to add to queue, schedule for a time in that channel's timezone, or save as draft, and set network options such as Instagram post type or a YouTube title. One click then saves your original idea with `createIdea` and creates one post per channel with `createPost`, each linked to the idea with `ideaId`. Typed mutation errors are shown per channel in plain language, failed channels can be retried without duplicating the rest, and if Buffer times out, Cascade checks whether the post landed before offering a retry, because createPost has no idempotency key.

Under the hood, tokens live server-side in Redis, refresh is locked so rotated refresh tokens are never replayed, channels are cached to protect the shared rate limit, and `Retry-After` is honoured.

Next: first comments and threads, multi-image posts, hosted media upload, and a team workspace.

## Two-minute demo script

Record at 1080p in a desktop browser, with a test idea ready, a public image URL ready, and your Buffer account logged in. Use **Save as draft** so nothing publishes.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:12 | Connect page | "I post every day, and the slow part is rewriting one idea for every channel. Cascade turns one idea into native posts for all your Buffer channels, in one step." |
| 0:12–0:30 | Click Connect, Buffer consent screen, back in the app | "It connects through Buffer OAuth with PKCE. Tokens stay on the server. These are my real channels, loaded from the channels query." |
| 0:30–0:50 | Type the idea, paste the image URL, tick 4–5 channels | "I write the idea once and add a public image. Cascade checks that Buffer can actually fetch it. I pick my channels." |
| 0:50–1:15 | Click Adapt, show the review screen | "An AI model rewrites it for each network. X is short, LinkedIn is longer with paragraphs, Instagram is a caption. Counters follow Buffer's own rules, so X links and emoji are weighted the way Buffer weights them." |
| 1:15–1:35 | Edit one draft, switch modes, pick a time, pick the Instagram type | "I can edit anything. Per channel I choose queue, a time in that channel's timezone, or draft, plus network options like Instagram post type." |
| 1:35–1:50 | Click send, show the Done screen | "One click calls createIdea to save my original idea, then createPost once per channel, each linked to that idea." |
| 1:50–2:00 | Open Buffer: drafts and the Idea | "And here they are in Buffer, the drafts and the saved Idea. That's Cascade." |

Tips: rehearse once; keep a failing-channel moment out of the take unless it's real; say "built on the Buffer API" rather than naming Buffer in the app's own branding.

## Build-in-public post ideas (optional, must mention Buffer Commit)

1. "Building Cascade for #BufferCommit: write one idea, get native posts for every Buffer channel. Today: OAuth with PKCE working end to end."
2. "Bug of the day for Buffer Commit: Buffer refresh tokens are single-use, so two browser tabs refreshing at once can log a user out. Fixed with a lock in Redis."
3. "Shipped Cascade for Buffer Commit: one idea, adapted for X, LinkedIn, Instagram and more, saved to Buffer Ideas and posts linked by ideaId. Link in the submission."
