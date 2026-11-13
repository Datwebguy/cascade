import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";

const ERRORS: Record<string, string> = {
  access_denied: "You declined access in Buffer. Connect again whenever you're ready.",
  invalid_state: "The sign-in session expired or was tampered with. Please try again.",
  missing_code: "Buffer didn't return an authorization code. Please try again.",
  token_exchange_failed: "Buffer sign-in didn't complete. Please try connecting again.",
  session_expired: "Your Buffer connection expired. Please connect again.",
  invalid_scope: "The app requested a permission that isn't enabled for it.",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasSession()) redirect("/compose");
  const { error } = await searchParams;

  return (
    <main className="connect">
      <div className="brand">
        <span className="logo" aria-hidden>
          ≋
        </span>
        Cascade
      </div>
      <h1>One idea. Every channel. Ready in Buffer.</h1>
      <p className="lede">
        Write an idea once, add an image or video, and Cascade adapts it into a native post for each
        of your Buffer channels. Review, schedule, and send them all in one step. Your original idea
        is saved to Buffer Ideas.
      </p>
      {error && <p className="alert error">{ERRORS[error] ?? "Couldn't connect to Buffer. Please try again."}</p>}
      <a className="btn primary big" href="/api/auth/login">
        Connect your Buffer account
      </a>
      <ol className="steps">
        <li>Connect with Buffer</li>
        <li>Write one idea</li>
        <li>Review adapted drafts</li>
        <li>Send to Buffer</li>
      </ol>
      <p className="muted small footer">
        Built on the Buffer API. Not affiliated with or endorsed by Buffer. <a href="/privacy">Privacy</a>
      </p>
    </main>
  );
}
