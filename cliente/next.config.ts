import type { NextConfig } from "next";

const urlBackendExterno = process.env.URL_BACKEND_EXTERNO;

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    if (urlBackendExterno) {
      return [
        {
          source: "/api/:path*",
          destination: `${urlBackendExterno}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
