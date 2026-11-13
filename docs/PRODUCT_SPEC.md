# Cascade — Product Spec

## Description

Cascade turns one idea into adapted, media-ready, scheduled posts for the user’s Buffer channels.

## User journey

1. User connects their Buffer account via OAuth.
2. App loads their channels.
3. User enters or selects an idea and optionally adds a media URL.
4. User selects target channels.
5. App shows adapted drafts.
6. User edits drafts, confirms media, and picks scheduling mode per channel.
7. User confirms. App saves the idea and creates the posts.

## Screens

- **Connect** — OAuth login.
- **Compose** — idea text, media URL, channel selector.
- **Review** — adapted drafts with edit fields, media preview, and scheduling controls.
- **Done** — confirmation.

## Adaptation (v1)

- X / Threads / Bluesky: shorter, conversational.
- LinkedIn: longer, professional.
- Instagram / Facebook: mid-length, caption-style.
- Other channels: sensible default.

## Scheduling options

- Add to queue
- Custom scheduled (datetime)
- Save as draft

## Out of scope for first version

- Multi-user metrics (personal API key only)
- Direct media upload (public URLs only)
- Full research or agent loop
