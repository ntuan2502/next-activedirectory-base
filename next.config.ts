import type { NextConfig } from "next";
import os from "os";

// Dynamically retrieve all local IPv4 network interfaces
const getLocalDevOrigins = (): string[] => {
  const interfaces = os.networkInterfaces();
  const origins: string[] = ["localhost", "127.0.0.1"];
  
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        // Only accept IPv4 and exclude loopback address
        if (net.family === "IPv4" && !net.internal) {
          origins.push(net.address);
          origins.push(`${net.address}:3000`); // Next.js allowedDevOrigins handles both IP and IP:Port formats
        }
      }
    }
  }
  return origins;
};

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@prisma/client", "pg"],
  allowedDevOrigins: getLocalDevOrigins()
};

export default nextConfig;


