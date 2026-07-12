import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  transpilePackages: ["@directory-sites/directory-core"],

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

  // trailingSlash is intentionally left at its default (false): trailing-slash
  // URLs are normalized (folded into the middleware's single-hop 301 when a
  // legacy resolution also applies, else Next's built-in 308).

  // Static, pattern-safe redirects only (05 §4.3). These run before middleware
  // at zero function cost; everything data-dependent (state/city resolution,
  // 410s) lives in src/middleware.ts — keep geo logic in ONE place.
  async redirects() {
    return [
      // statusCode 301 (not permanent:true which emits 308) — 05 §7 R9/R10
      // specify 301 and the launch curl suite asserts it.
      { source: "/how-we-verify", destination: "/methodology", statusCode: 301 },
      { source: "/emergency-plumbers", destination: "/plumbers", statusCode: 301 },
    ];
  },

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

export default withAnalyzer(nextConfig);
