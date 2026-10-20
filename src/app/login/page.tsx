import type { Metadata } from "next";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/auth-actions";
import { safeNextPath } from "@/lib/safe-next";
import { SITE_NAME } from "@/lib/site";
import { EmailSignIn } from "./email-sign-in";

export const metadata: Metadata = {
  title: `Sign in · ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again whenever you're ready.",
  exchange: "That sign-in link expired. Please try again.",
  link: "That sign-in link has expired or was already used. Send yourself a new one below.",
  provider: "Google sign-in isn't available right now. Please try again later.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-xl font-bold text-fg">Sign in to {SITE_NAME}</h1>
        <p className="mt-2 text-sm text-muted">
          Keep your claimed deals, hidden vendors and email alerts on every device. Anything you did as a guest comes
          with you.
        </p>
        <Suspense>
          <LoginForm searchParams={searchParams} />
        </Suspense>
        <p className="mt-4 text-xs text-muted">
          No password needed. We only use your email to sign you in, and to send deal alerts if you turn them on.
        </p>
      </div>
    </main>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : "/");
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  return (
    <>
      <form action={signInWithGoogle} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        {error && (
          <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4">
            <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          Continue with Google
        </button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <EmailSignIn next={next} />
    </>
  );
}
