import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

const ipRequests = new Map<string, { count: number; resetAt: number }>();

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipRequests) {
    if (now > val.resetAt) ipRequests.delete(key);
  }
}, 60_000);

export function checkRateLimit(request: NextRequest): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const now = Date.now();
  const entry = ipRequests.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return null;
}

const ALLOWED_ORIGINS = [
  "https://fastplumbernearme.com",
  "https://www.fastplumbernearme.com",
];

export function checkOrigin(request: NextRequest): NextResponse | null {
  // Skip check in development
  if (process.env.NODE_ENV === "development") return null;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Allow if origin or referer matches our domain
  if (origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) return null;
  if (referer && ALLOWED_ORIGINS.some((o) => referer.startsWith(o))) return null;

  // Allow server-side requests (no origin header)
  if (!origin && !referer) return null;

  return NextResponse.json(
    { error: "Forbidden" },
    { status: 403 }
  );
}
