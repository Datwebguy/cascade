export const metadata = { title: "Privacy · Cascade" };

export default function Privacy() {
  return (
    <main className="legal">
      <h1>Privacy</h1>
      <p className="lede">What Cascade does with your data, in plain terms.</p>

      <h2>Your Buffer connection</h2>
      <p>
        When you connect, Buffer gives Cascade an access token and a refresh token for the permissions you approve. They are
        kept only in Cascade&apos;s server-side session store, never in your browser, and are deleted when you
        click Disconnect or after 30 days without use. You can also revoke Cascade at any time in your Buffer settings.
      </p>

      <h2>What Cascade reads and writes</h2>
      <ul>
        <li>Reads your organizations, channels and saved Ideas so you can choose where to post.</li>
        <li>Creates an Idea with your original text, and creates one post per channel you choose.</li>
        <li>Reads recent posts on a channel only to confirm whether a post was created when Buffer didn&apos;t respond in time.</li>
      </ul>
      <p>Cascade does not read post analytics and does not post anything you haven&apos;t reviewed and confirmed.</p>

      <h2>AI drafting</h2>
      <p>
        To adapt your idea, the idea text, optional title, media type and the names and types of the selected channels are
        sent to OpenAI&apos;s API. Cascade does not send your Buffer tokens or media files to OpenAI.
      </p>

      <h2>Media</h2>
      <p>
        Cascade checks that a media URL you paste is publicly reachable. The file itself is fetched by Buffer when your post
        goes out; Cascade does not store it.
      </p>

      <h2>Contact</h2>
      <p>Questions or deletion requests: open an issue on the project&apos;s repository.</p>

      <p>
        <a href="/">← Back to Cascade</a>
      </p>
    </main>
  );
}
