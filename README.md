# Cascade

**Write one idea. Get a post made for every network. Ready in Buffer.**

**[Open Cascade](https://oncascade.vercel.app)** · **[Watch the 1-minute demo](https://youtu.be/8lEK_hZaYQM)** · Built on the Buffer API

![The same idea written as a LinkedIn post and an X post, side by side](docs/screenshots/review.webp)

## Contents

- [What Cascade is](#what-cascade-is)
- [Quick start](#quick-start)
- [How to use Cascade](#how-to-use-cascade)
- [What happens after you send](#what-happens-after-you-send)
- [Supported networks](#supported-networks)
- [Your words, nothing added](#your-words-nothing-added)
- [Your data and privacy](#your-data-and-privacy)
- [Questions](#questions)
- [How it's built](#how-its-built)
- [Run it yourself](#run-it-yourself)

## What Cascade is

Cascade turns one idea into a post made for each of your social networks, then puts them all in Buffer.

Every network wants the same idea told its own way. X wants it short, LinkedIn wants the story, Instagram wants a caption. Buffer handles the posting; Cascade handles the writing. You write your idea once, in your own words, and Cascade writes a version for each network, ready to queue, schedule or save as a draft in Buffer.

**Who it's for:** anyone who posts every day across several networks with Buffer.

- **Founders** announcing what they shipped on X, LinkedIn and Threads.
- **Small businesses** sharing today's offer on Instagram, Facebook and Google Business.
- **Creators** promoting a new video or newsletter everywhere they post.
- **Marketers and community managers** running a brand's channels.

## Quick start

1. Open **[oncascade.vercel.app](https://oncascade.vercel.app)** and tap **Connect your Buffer account**.
2. Write your idea and, if you like, add a photo or video.
3. Pick the Buffer channels it should go to and tap **Create posts**.
4. Review each post, then choose **Queue**, **Pick a time** or **Draft** for each one.
5. Tap **Send to Buffer**. Done: your posts are in Buffer and your idea is saved in Buffer Ideas.

You need a Buffer account with at least one channel connected. Cascade works with the channels you already have in Buffer.

## How to use Cascade

### 1. Connect your Buffer account

Tap **Connect your Buffer account**, sign in to Buffer if asked, and approve Cascade. Buffer shows you exactly what Cascade can access: your account, your posts and your ideas. You come straight back to Cascade with your channels loaded.

If you belong to more than one Buffer workspace, choose the one you want under **Buffer workspace**.

### 2. Write your idea

![Writing the idea, adding an image and choosing channels](docs/screenshots/compose.webp)

- Write it the way you'd say it. One sentence is enough; a few paragraphs work too.
- Add a **title** if you want one. It's saved with your idea in Buffer Ideas.
- Any **links, @mentions and #hashtags** you write are kept.
- To reuse something you saved earlier, open **Use a saved idea…** and pick it. Cascade uses that idea as it is, instead of saving a copy.

### 3. Add a photo or video (optional)

- **Upload from your device:** tap **Upload from your device**, or drag a file onto the box on a computer. Images: JPG, PNG, GIF or WebP up to 20 MB. Videos: MP4 or MOV up to 500 MB. Large photos are resized for you so they upload quickly and stay sharp.
- **Or paste a link:** tap **Or paste a link instead** and paste a direct link to the file, starting with `https://`. Cascade checks that Buffer will be able to fetch it. Links to Google Drive, Dropbox or OneDrive pages don't work, because they open a preview page instead of the file.

A preview appears with **Image ready** or **Video ready** when it's attached. Tap **Remove** to take it off.

### 4. Choose your channels

Under **Post to**, tap each Buffer channel the idea should go to, or tap **Select all**. Channels that can't be posted to right now are shown greyed out with the reason, such as **Reconnect in Buffer**. If you've just connected a new channel in Buffer, tap **Refresh**.

Then tap **Create posts**. Cascade writes a version for each channel; it takes a few seconds.

![Cascade writing a post for each network](docs/screenshots/writing.webp)

### 5. Review your posts

Each channel gets its own card. On every card you can:

- **Edit the text** directly. The ring under the text shows how many characters are left for that network, counted the way Buffer counts them.
- Tap **↻** to get a **fresh version** of that post.
- Tap **×** to **leave that channel out** of this send.
- Turn **Include image** on or off for that channel.
- Set network options where they apply:
  - **Instagram and Facebook:** share as a **Post**, **Reel** or **Story**.
  - **Pinterest:** choose the **board**, and add a **title**.
  - **YouTube:** add a **title** and choose **visibility** (public, unlisted or private).

If something needs fixing, for example a post is over the limit or a network needs an image, the card says so in plain words. Sending waits until it's fixed or you remove that channel.

### 6. Choose when each post goes out

For each card, choose:

- **Queue:** the next open slot in that channel's Buffer posting schedule.
- **Pick a time:** an exact date and time, in that channel's time zone.
- **Draft:** saved in Buffer's Drafts, not published.

To set every card at once, use **Set all to** at the top.

### 7. Send to Buffer

Tap **Send to Buffer**. Cascade saves your original idea to Buffer Ideas, then creates one Buffer post for each channel. The final screen shows each post's status, with a **View in Buffer** link and a short **What happens next** summary.

![After sending: each post's status in Buffer and what happens next](docs/screenshots/sent.webp)

## What happens after you send

Cascade hands your posts to Buffer, and **Buffer publishes them**, based on what you chose:

| You chose | What happens |
| --- | --- |
| **Queue** | Buffer publishes it automatically at the next open slot in that channel's schedule. |
| **Pick a time** | Buffer publishes it automatically at that time, in the channel's time zone. |
| **Draft** | It waits in Buffer's Drafts until you schedule or publish it there. |

Queued and scheduled posts go out even if you close Cascade. You can still edit, reschedule or delete any post in Buffer, and your original idea stays in Buffer Ideas, ready to reuse.

**If a post didn't go through,** the final screen says why, in plain words. Tap **Try again** to resend only the posts that didn't go through, or **Edit and resend** to change them first. Posts that already went through are never sent twice.

When you're done, tap **Start a new idea**, or **Sign out** at the top.

## Supported networks

Character limits are the ones Buffer uses for each network.

| Network | Post length | Needs | Options in Cascade |
| --- | --- | --- | --- |
| X | 280 characters (25,000 with X Premium, detected from your account) | | |
| Threads | 500 | | |
| Bluesky | 300 | | |
| Mastodon | Your server's limit, read from your channel | | |
| LinkedIn | 3,000 | | |
| Facebook | 5,000 | | Post, Reel or Story |
| Instagram | 2,196 | An image or video | Post, Reel or Story |
| TikTok | 2,200 with video, 4,000 with photos | An image or video | |
| YouTube | 5,000 (description) | A video and a title | Title, visibility |
| Pinterest | 500 | An image and a board | Board, title |
| Google Business | 4,000 | | |
| Substack | 10,000 | | |

Instagram photos that are too tall or too wide for Instagram are cropped to a shape it accepts, for Instagram only. Every other network gets your original.

<p align="center"><img src="docs/screenshots/mobile.webp" alt="Cascade on a phone" width="260"></p>

Cascade works on phones, tablets and computers, in light and dark mode.

## Your words, nothing added

- Cascade never adds hashtags or emojis you didn't write. Every post is checked for this before you see it.
- Your links and @mentions are kept exactly as written.
- It writes from what you wrote, and is set up never to invent facts, numbers, quotes or offers.
- Nothing reaches Buffer until you tap **Send to Buffer**, and drafts are never published.

## Your data and privacy

- Your Buffer connection is stored securely on Cascade's server, never in your browser. **Sign out** deletes it. You can also remove Cascade anytime from your Buffer account settings.
- To write your posts, your idea, its title and the names and types of the channels you chose are sent to OpenAI. Your Buffer login and your media files are not.
- Photos and videos you upload are stored at a long, hard-to-guess public link, because Buffer needs a public link to fetch them when your post goes out.

Full details: **[Privacy](https://oncascade.vercel.app/privacy)**.

## Questions

**Do I need a Buffer account?**
Yes. Cascade works with the channels in your Buffer account. Connect your social accounts in Buffer first, then sign in to Cascade.

**Will Cascade post without asking me?**
No. You review every post and choose queue, a set time or draft. Buffer then publishes only what you queued or scheduled.

**Can I change a post after sending it?**
Yes, in Buffer. Edit, reschedule or delete it like any other Buffer post.

**Where do I find my original idea?**
In **Buffer Ideas**. You can start a new send from it with **Use a saved idea…**.

**A channel is greyed out. Why?**
Buffer reports it as disconnected or locked. Reconnect it in Buffer, then tap **Refresh** in Cascade.

**My image link doesn't work.**
Use a direct link to the file that opens without signing in, starting with `https://`. Or upload the file from your device instead.

## How it's built

Cascade is a Next.js app built on the Buffer GraphQL API.

| Feature | Buffer API |
| --- | --- |
| Sign in | OAuth 2.0 Authorization Code with PKCE, private App Client, refresh tokens |
| Workspaces and channels | `account { organizations }`, `channels` with channel metadata (Mastodon limit, X subscription, Pinterest boards) |
| Saved ideas | `ideas`, paginated |
| Save the original idea | `createIdea` |
| One post per network | `createPost` with media assets, queue / custom time / draft, and network settings |
| Safe retries | `posts` lookup after a timeout, so a post is never created twice |

- Tokens stay on the server in Redis; the browser only holds an encrypted session ID. Token refreshes are serialised so a rotated refresh token is never reused.
- Character counting follows Buffer's rules for each network, including X weighting, link weights on LinkedIn and Mastodon, Instagram line breaks and Bluesky graphemes.
- Media is hosted on Vercel Blob at stable public URLs.
- Buffer's rate-limit headers and `Retry-After` are honoured, and channel lists are cached per session.
- Posts are written with OpenAI and filtered on the server to keep only the author's own hashtags, emojis and links.

## Run it yourself

Requirements: Node.js 22+, a Buffer App Client (Buffer → Settings → API → App Clients), an OpenAI API key.

```bash
cp .env.example .env.local   # fill in the values; the comments explain each one
npm install
npm run dev                  # https://localhost:3000
```

Register `https://localhost:3000/api/auth/callback` as a redirect URI on your App Client (Buffer requires HTTPS, even locally), plus your production URL. Production also needs a Redis store and a Blob store, both available in Vercel Storage.

Checks: `npm run typecheck` and `npm test`.

## Coming next

First comments and threads, multi-image posts, saved voice and tone preferences, and a team review step before posts go to Buffer.

---

Not affiliated with Buffer.
