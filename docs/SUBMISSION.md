# Cascade — Buffer Commit submission kit

Deadline: **13 November 2026, 11:59pm Pacific**. Submissions are final once sent.

## Checklist

- [ ] Live app works end to end with a real Buffer account (connect, adapt, send as draft, verify in Buffer)
- [ ] Client ID: `lk8NsttOqb37qhBjV_IsU1fpVSunrzeiFPXurCngZJ0` (never the secret)
- [x] Public URL: https://oncascade.vercel.app (must stay up through judging; judging starts 16 Nov, winners 7 Dec)
- [x] Demo video, public link: https://youtu.be/8lEK_hZaYQM
- [ ] 300-word summary (below)
- [ ] Team details and contact information
- [ ] Optional: build-in-public posts that mention Buffer Commit

## 300-word summary

Cascade is for people who post every day across several social networks with Buffer: founders announcing what they shipped, small businesses sharing today's offer, creators promoting new work.

Buffer already solved the posting. What it leaves to you is the writing. X wants it short, LinkedIn wants the story, Instagram wants a caption. So most people either paste the same text everywhere, which reads badly, or rewrite it by hand for every network, every day. I kept skipping that step, so I built Cascade on the Buffer API.

You sign in with Buffer (OAuth with PKCE, as a private App Client) and your real channels load from Buffer. You write the idea once, in your own words, and add a photo or video, either uploaded from your phone or pasted as a link. Cascade writes a version for each selected network, in that network's style, and checks every draft against Buffer's own character rules, including X Premium limits read from the channel. It never adds hashtags or emojis you didn't write, and Instagram gets a correctly cropped image when needed.

You review and edit each post, choose per channel between your Buffer queue, a set time in that channel's time zone, or a draft, and send. Cascade saves your original idea to Buffer Ideas with createIdea, then creates one Buffer post per channel with createPost. From there Buffer takes over: queued and scheduled posts publish automatically, and drafts wait in Buffer for your final OK. Errors are explained in plain words per channel, failed channels can be retried without duplicating the rest, and if Buffer times out, Cascade checks whether the post landed before offering a retry.

Next: first comments and threads, multi-image posts, saved voice and tone preferences, and a team review step before posts go to Buffer.

## Two-minute demo script

Record at 1080p in a desktop browser, with a test idea ready, a public image URL ready, and your Buffer account logged in. Use **Save as draft** so nothing publishes.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:12 | Connect page | "I post every day, and the slow part is rewriting one idea for every channel. Cascade turns one idea into native posts for all your Buffer channels, in one step." |
| 0:12–0:30 | Click Connect, Buffer consent screen, back in the app | "It connects through Buffer OAuth with PKCE. Tokens stay on the server. These are my real channels, loaded from the channels query." |
| 0:30–0:50 | Type the idea, paste the image URL, tick 4–5 channels | "I write the idea once and add a public image. Cascade checks that Buffer can actually fetch it. I pick my channels." |
| 0:50–1:15 | Click Adapt, show the review screen | "An AI model rewrites it for each network. X is short, LinkedIn is longer with paragraphs, Instagram is a caption. Counters follow Buffer's own rules, so X links and emoji are weighted the way Buffer weights them." |
| 1:15–1:35 | Edit one draft, switch modes, pick a time, pick the Instagram type | "I can edit anything. Per channel I choose queue, a time in that channel's timezone, or draft, plus network options like Instagram post type." |
| 1:35–1:50 | Click send, show the Done screen | "One click calls createIdea to save my original idea, then createPost once per channel." |
| 1:50–2:00 | Open Buffer: drafts and the Idea | "And here they are in Buffer, the drafts and the saved Idea. That's Cascade." |

Tips: rehearse once; keep a failing-channel moment out of the take unless it's real; say "built on the Buffer API" rather than naming Buffer in the app's own branding.

## Build-in-public post ideas (optional, must mention Buffer Commit)

1. "Building Cascade for #BufferCommit: write one idea, get native posts for every Buffer channel. Today: OAuth with PKCE working end to end."
2. "Bug of the day for Buffer Commit: Buffer refresh tokens are single-use, so two browser tabs refreshing at once can log a user out. Fixed with a lock in Redis."
3. "Shipped Cascade for Buffer Commit: one idea, adapted for X, LinkedIn, Instagram and more, with the original saved to Buffer Ideas. Link in the submission."
