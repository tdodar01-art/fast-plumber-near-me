import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { SITE_ORIGIN } from "@/config/plumbing-routes";
import "./globals.css";

/**
 * Root layout — rebuild design system (02 §1.3): NO webfonts. System sans
 * stack + Georgia serif for editorial judgment only, both defined in
 * globals.css. Zero render-blocking font requests on an emergency page.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Fast Plumber Near Me — Plumbers Ranked by Real Reviews",
    template: "%s | Fast Plumber Near Me",
  },
  description:
    "City-by-city plumber rankings built from real customer reviews — strengths, complaints, and red flags included. Rankings are never for sale.",
  openGraph: {
    type: "website",
    siteName: "Fast Plumber Near Me",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    // favicon.ico is auto-linked by the app-router convention; the PNGs are
    // rendered by src/app/icon-{192,512}.png/route.tsx (manifest + apple).
    apple: "/icon-192.png",
  },
  other: {
    "theme-color": "#17293e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
