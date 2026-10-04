import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Let phones on the same network load dev assets via this machine's LAN IP.
// Only affects `next dev`; production builds ignore it.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((iface) => iface?.family === "IPv4" && !iface.internal)
  .map((iface) => iface!.address);

const securityHeaders = [
  // Outbound deal links never leak which page or search sent the visitor.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: lanAddresses,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
