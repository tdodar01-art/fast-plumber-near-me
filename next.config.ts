import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type checking during build — @types/react-dom@19.2.3 has a
  // packaging bug (missing index.d.ts). Types still checked in IDE.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Compress responses
  compress: true,

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Enable React strict mode for catching issues
  reactStrictMode: true,

  // Performance headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/(.*)\\.(js|css|woff2|ico|svg|png|jpg|jpeg)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
