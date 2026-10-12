import Link from "next/link";
import { UserRound } from "lucide-react";
import { getViewer } from "@/lib/claims";

/** Header sign-in link, or the signed-in visitor's avatar linking to /account. */
export async function UserMenu() {
  const { user } = await getViewer();
  if (!user) {
    return (
      <Link href="/login" className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:bg-white/5">
        Sign in
      </Link>
    );
  }
  const label = user.name ?? user.email ?? "Account";
  return (
    <Link href="/account" className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-fg hover:bg-white/5">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny Google avatar; next/image would need remotePatterns
        <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-white/10">
          <UserRound aria-hidden className="size-4" />
        </span>
      )}
      <span className="hidden max-w-40 truncate sm:inline">{label}</span>
      <span className="sr-only sm:hidden">Account</span>
    </Link>
  );
}
