import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Let phones on the same network load dev assets via this machine's LAN IP.
// Only affects `next dev`; production builds ignore it.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((iface) => iface?.family === "IPv4" && !iface.internal)
  .map((iface) => iface!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
