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

export default function OpenGraphImage() {
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
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#34d399",
              color: "#022c22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 900,
            }}
          >
            0
          </div>
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
