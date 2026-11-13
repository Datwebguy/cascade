import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";

const ERRORS: Record<string, string> = {
  access_denied: "You declined access in Buffer. Connect again whenever you're ready.",
  invalid_state: "The sign-in session expired or was tampered with. Please try again.",
  missing_code: "Buffer didn't return an authorization code. Please try again.",
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
          ◢
        </span>
        Cascade
      </div>
      <h1>One idea. Every channel. Ready in Buffer.</h1>
      <p className="lede">
        Write an idea once, add an image or video, and Cascade drafts a version tuned for each of
        your Buffer channels. Review, schedule, and send them all in one step. The original idea is
        saved to Buffer Ideas.
      </p>
      {error && <p className="alert error">{ERRORS[error] ?? error}</p>}
      <a className="btn primary big" href="/api/auth/login">
        Connect Buffer
      </a>
      <ol className="steps">
        <li>Connect with Buffer</li>
        <li>Write one idea</li>
        <li>Review adapted drafts</li>
        <li>Send to Buffer</li>
      </ol>
    </main>
  );
}
