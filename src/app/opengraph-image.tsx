import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BADGES = [
  { label: "No Credit Card Required", color: "#6ee7b7", bg: "rgba(16,185,129,0.15)" },
  { label: "Instant-Cancel Safe", color: "#7dd3fc", bg: "rgba(14,165,233,0.15)" },
  { label: "No Affiliate Junk", color: "#c4b5fd", bg: "rgba(139,92,246,0.15)" },
];

export default async function OpenGraphImage() {
  // The pixel-art logo pre-scaled 3× (public/icons/logo-96.png), drawn at its own size so it stays crisp.
  const png = await readFile(join(process.cwd(), "public/icons/logo-96.png"));
  const logo = `data:image/png;base64,${png.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #0f2a22 0%, #0b0d10 55%)",
          color: "#eceef1",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={logo} alt="" width={96} height={96} style={{ borderRadius: 12 }} />
          <div style={{ fontSize: 72, fontWeight: 800 }}>{SITE_NAME}</div>
        </div>
        <div style={{ marginTop: 32, fontSize: 48, color: "#9aa3ae" }}>
          Freebies with zero catches.
        </div>
        <div style={{ marginTop: 48, display: "flex", gap: 16 }}>
          {BADGES.map((b) => (
            <div
              key={b.label}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                fontSize: 26,
                color: b.color,
                background: b.bg,
              }}
            >
              {b.label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
