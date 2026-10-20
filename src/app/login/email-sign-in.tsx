"use client";

import { Mail } from "lucide-react";
import { useActionState, useState } from "react";
import {
  requestEmailSignIn,
  verifyEmailCode,
  type CodeState,
  type EmailSignInState,
} from "@/app/auth-actions";

/**
 * Email sign-in: one email carries a link (works on any device) and a code
 * (for the installed app, where tapping a link would open the browser).
 */
export function EmailSignIn({ next }: { next: string }) {
  const [sent, sendAction, sending] = useActionState<EmailSignInState, FormData>(requestEmailSignIn, {});
  const [checked, verifyAction, verifying] = useActionState<CodeState, FormData>(verifyEmailCode, {});
  // "Use a different email" applies to the current result only; the next send replaces it.
  const [editingResult, setEditingResult] = useState<EmailSignInState | null>(null);
  const sentTo = editingResult === sent ? undefined : sent.sentTo;

  if (!sentTo) {
    return (
      <form action={sendAction} className="flex flex-col gap-2">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="sign-in-email" className="text-sm font-medium text-fg">
          Email
        </label>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          defaultValue={sent.sentTo ?? sent.email}
          placeholder="you@example.com"
          aria-describedby={sent.error ? "sign-in-email-error" : undefined}
          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        />
        {sent.error && (
          <p id="sign-in-email-error" role="alert" className="text-sm text-rose-300">
            {sent.error}
          </p>
        )}
        <button
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-fg hover:bg-white/5 disabled:opacity-60"
        >
          <Mail aria-hidden className="size-4" />
          {sending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="status" className="rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100">
        <p className="font-medium">Check your email</p>
        <p className="mt-0.5 text-emerald-100/80">
          We sent a sign-in link and a code to <span className="font-medium text-emerald-50">{sentTo}</span>. Open the
          link on any device, or enter the code here.
        </p>
      </div>
      <form action={verifyAction} className="flex flex-col gap-2">
        <input type="hidden" name="email" value={sentTo} />
        <input type="hidden" name="next" value={next} />
        <label htmlFor="sign-in-code" className="text-sm font-medium text-fg">
          Code from the email
        </label>
        <input
          id="sign-in-code"
          name="code"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]{6,12}"
          maxLength={12}
          placeholder="123456"
          aria-describedby={checked.error ? "sign-in-code-error" : undefined}
          className="rounded-xl border border-line bg-bg px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-fg placeholder:text-muted/50 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        />
        {checked.error && (
          <p id="sign-in-code-error" role="alert" className="text-sm text-rose-300">
            {checked.error}
          </p>
        )}
        <button
          disabled={verifying}
          className="rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
        >
          {verifying ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={() => setEditingResult(sent)} className="text-muted underline-offset-4 hover:text-fg hover:underline">
          Use a different email
        </button>
        <form action={sendAction}>
          <input type="hidden" name="email" value={sentTo} />
          <input type="hidden" name="next" value={next} />
          <button disabled={sending} className="text-muted underline-offset-4 hover:text-fg hover:underline disabled:opacity-60">
            {sending ? "Sending…" : "Send a new email"}
          </button>
        </form>
      </div>
    </div>
  );
}
