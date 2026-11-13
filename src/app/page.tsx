import { redirect } from "next/navigation";
import { HeroDemo } from "@/components/HeroDemo";
import { Logo } from "@/components/Logo";
import { hasSession } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  access_denied: "You chose not to connect. Connect whenever you're ready.",
  invalid_state: "That sign-in took too long or was interrupted. Please try again.",
  missing_code: "Buffer didn't finish signing you in. Please try again.",
  token_exchange_failed: "We couldn't finish connecting to Buffer. Please try again.",
  session_expired: "You've been signed out. Connect again to continue.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await hasSession().catch(() => false)) redirect("/compose");
  const { error } = await searchParams;

  return (
    <div className="landing">
      <nav className="nav">
        <Logo />
        <a className="btn ghost sm" href="/api/auth/login">
          Sign in
        </a>
      </nav>

      <header className="hero">
        <div>
          <span className="eyebrow">For people who post daily across networks with Buffer</span>
          <h1>
            One idea.
            <br />
            <span className="gradient-text">Every channel.</span>
          </h1>
          <p className="lede">
            X wants it short. LinkedIn wants the story. Instagram wants a caption. Write your idea once, and Cascade turns it
            into a post made for each network, then puts them all in Buffer, scheduled your way.
          </p>
          {error && (
            <p className="notice error" role="alert" style={{ marginTop: "1.2rem" }}>
              {MESSAGES[error] ?? "We couldn't connect to Buffer. Please try again."}
            </p>
          )}
          <div className="hero-cta">
            <a className="btn glow lg" href="/api/auth/login">
              Connect your Buffer account
            </a>
          </div>
          <div className="trust">
            <span>You review every post first</span>
            <span>Your idea is saved to Buffer</span>
            <span>Disconnect anytime</span>
          </div>
        </div>
        <HeroDemo />
      </header>

      <section className="how">
        <h2>From thought to every feed in three steps</h2>
        <div className="how-grid">
          <article className="how-card">
            <span className="num">1</span>
            <h3>Write it once</h3>
            <p>Say what's on your mind and add a photo or video if you like. Or start from an idea you already saved in Buffer.</p>
          </article>
          <article className="how-card">
            <span className="num">2</span>
            <h3>Get posts that fit</h3>
            <p>Short and punchy for X, thoughtful for LinkedIn, caption-ready for Instagram. Every post fits its network's limits.</p>
          </article>
          <article className="how-card">
            <span className="num">3</span>
            <h3>Send to Buffer</h3>
            <p>Edit anything, then queue, schedule, or save as drafts. One click sends them all, linked to your original idea.</p>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        Built on the Buffer API. Not affiliated with Buffer. <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}
