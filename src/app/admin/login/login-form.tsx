"use client";

import { useActionState } from "react";
import { login, type ActionState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <label htmlFor="password" className="text-sm text-muted">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
      />
      {state.error && (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
