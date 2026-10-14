import type { NextConfig } from "next";

const urlBackend = process.env.URL_BACKEND_PRODUCCION || "http://localhost:3000";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${urlBackend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
