import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fastplumbernearme.com"),
  title: {
    default: "Fast Plumber Near Me — Find Verified Emergency Plumbers",
    template: "%s | Fast Plumber Near Me",
  },
  description:
    "Find verified, responsive emergency plumbers near you. We AI-verify every plumber to make sure they actually pick up the phone and show up. 24/7 service.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
