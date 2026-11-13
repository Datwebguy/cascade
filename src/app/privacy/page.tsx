import { Logo } from "@/components/Logo";

export const metadata = { title: "Privacy · Cascade" };

export default function Privacy() {
  return (
    <main className="legal">
      <a href="/" aria-label="Cascade home">
        <Logo />
      </a>
      <h1>Privacy</h1>
      <p>What Cascade does with your information, in plain words.</p>

      <h2>Your Buffer connection</h2>
      <p>
        When you connect, Buffer gives Cascade permission to act for you with the access you approve. That permission is
        stored securely on our server, never in your browser. It&apos;s deleted when you sign out, or after 30 days of not
        using Cascade. You can also remove Cascade at any time from your Buffer account settings.
      </p>

      <h2>What Cascade reads and creates</h2>
      <ul>
        <li>Reads your Buffer workspaces, channels and saved ideas, so you can choose where to post.</li>
        <li>Saves your original idea to Buffer Ideas, and creates one post for each channel you choose.</li>
        <li>Looks at recent posts on a channel only to check whether a post went through when Buffer was slow to answer.</li>
      </ul>
      <p>Cascade never posts anything you haven&apos;t reviewed and confirmed, and doesn&apos;t read your analytics.</p>

      <h2>Writing your posts</h2>
      <p>
        To write a post for each channel, your idea, its title, whether you attached an image or video, and the names and
        types of the channels you chose are sent to OpenAI. Your Buffer login and your media files are never sent.
      </p>

      <h2>Images and videos</h2>
      <p>
        Cascade checks that a link you paste can be opened publicly. Buffer downloads the file itself when your post goes
        out. Cascade doesn&apos;t keep a copy.
      </p>

      <h2>Questions</h2>
      <p>Get in touch through the project&apos;s page to ask a question or request that your data be deleted.</p>
    </main>
  );
}
