import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { TABS, buildHref } from "@/lib/tabs";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...TABS.map((tab, i) => ({
      url: new URL(buildHref({ tab: tab.slug }), SITE_URL).toString(),
      changeFrequency: "daily" as const,
      priority: i === 0 ? 1 : 0.8,
    })),
    { url: new URL("/what-qualifies", SITE_URL).toString(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
