# Cascade — Agent Prompt

You are building Cascade, a web app for Buffer Commit.

## Product

Cascade takes one idea and turns it into fully adapted, media-ready posts for the user’s real Buffer channels. It saves the original idea and lets the user choose scheduling per post.

## Requirements

- Use OAuth 2.0 with PKCE (App Client). Do not rely on a personal API key for the main flow.
- Load the user’s channels.
- Accept one idea + optional public media URL.
- Generate adapted drafts per selected channel.
- Let the user edit, attach media, and choose scheduling mode (`addToQueue`, `customScheduled`, or `saveToDraft`).
- On confirm: call `createIdea`, then call `createPost` once per channel.
- Pass `ideaId` on the posts so they stay linked.
- Handle mutation errors properly (select both success and error fragments).

## Constraints

- Media must be a public URL (Buffer fetches it).
- Metrics are personal-key only. Do not attempt to read metrics through an App Client.
- One post per channel per `createPost` call.
- Do not list Claude as author or co-author in any code, comments, commits, or documentation.

## Output

Build a clean, working web app that demonstrates the full journey: OAuth → idea → adapted drafts → media + scheduling → posts created in Buffer.
