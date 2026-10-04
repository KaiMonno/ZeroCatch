import Link from "next/link";
import { logout } from "./actions";

export function AdminNav({ active }: { active: "review" | "deals" }) {
  const links = [
    { key: "review", href: "/admin/review", label: "Review queue" },
    { key: "deals", href: "/admin/deals", label: "Published deals" },
  ] as const;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
      <nav aria-label="Admin" className="flex gap-1 text-sm">
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            aria-current={link.key === active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 ${
              link.key === active ? "bg-white/10 font-medium text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={logout}>
        <button className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-fg">Sign out</button>
      </form>
    </div>
  );
}
