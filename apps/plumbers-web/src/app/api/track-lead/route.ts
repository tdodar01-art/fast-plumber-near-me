import { NextRequest, NextResponse } from "next/server";
import { trackLead } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { checkRateLimit, checkOrigin } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;
  const originBlocked = checkOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const data = await request.json();

    const { plumberId, city, clickType, source, plumberName, plumberPhone, state, citySlug, pageUrl } = data;
    if (!plumberId || !city || !clickType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await trackLead({
      plumberId,
      plumberName: plumberName || "",
      plumberPhone: plumberPhone || "",
      city,
      state: state || "",
      citySlug: citySlug || "",
      pageUrl: pageUrl || source || "",
      clickType,
      source: source || "",
      createdAt: Timestamp.now(),
      userAgent: request.headers.get("user-agent") || "",
      referrer: request.headers.get("referer") || "",
      billed: false,
      billedAmount: null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to track lead" }, { status: 500 });
  }
}
