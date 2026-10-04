import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · ZeroCatch",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-16 pt-6">{children}</main>;
}
