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

## Status

Built for Buffer Commit 2026.

## Next steps

- Stronger per-platform adaptation
- Multi-image and richer media support
- Thread and first-comment helpers
- Optional personal-key metrics view for the account owner
