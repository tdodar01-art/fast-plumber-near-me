import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type checking during build — @types/react-dom@19.2.3 has a
  // packaging bug (missing index.d.ts). Matches plumbers-web workaround.
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: true,
  compress: true,
};

export default nextConfig;
