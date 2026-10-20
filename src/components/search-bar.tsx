"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DEBOUNCE_MS = 300;

export function SearchBar({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Searches sent to the URL that haven't come back yet, oldest first. When the
  // URL catches up to one of them it's our own echo (possibly late or out of
  // order), so the text the visitor is still typing is left alone. Only a change
  // from elsewhere (back button, "Clear search") replaces the input.
  const [pending, setPending] = useState<string[]>([]);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    const echo = pending.indexOf(urlQuery);
    if (echo >= 0) {
      setPending(pending.slice(echo + 1));
    } else {
      setPending([]);
      setValue(urlQuery);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(next: string) {
    const sp = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    // A trailing space (or retyping the same thing) doesn't change the results.
    if (trimmed === (pending.at(-1) ?? urlQuery)) return;
    if (trimmed) sp.set("q", trimmed);
    else sp.delete("q");
    const qs = sp.toString();
    setPending((p) => [...p, trimmed]);
    startTransition(() => router.replace(qs ? `/?${qs}` : "/", { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), DEBOUNCE_MS);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        commit(value);
      }}
      className="relative"
    >
      <label htmlFor="deal-search" className="sr-only">
        Search deals
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        id="deal-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-10 text-sm text-fg placeholder:text-muted focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {isPending ? (
          <Loader2 aria-label="Searching" className="m-1.5 size-4 animate-spin text-muted" />
        ) : value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-fg"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
    </form>
  );
}
