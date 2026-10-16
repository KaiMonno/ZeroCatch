"use client";

import Link from "next/link";
import { useActionState } from "react";
import { unsubscribeWithToken, type AlertFormState } from "@/app/alert-actions";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AlertFormState, FormData>(unsubscribeWithToken, {});
  if (state.ok) {
    return (
      <p role="status" className="mt-5 text-sm text-emerald-300">
        You&apos;re unsubscribed. <Link href="/" className="text-fg underline underline-offset-4">Back to deals</Link>
      </p>
    );
  }
  return (
    <form action={action} className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
      <button
        disabled={pending || !token}
        className="rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Unsubscribing…" : "Yes, unsubscribe"}
      </button>
    </form>
  );
}
