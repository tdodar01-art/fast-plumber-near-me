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

    const { plumberId, city, clickType, source } = data;
    if (!plumberId || !city || !clickType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await trackLead({
      plumberId,
      city,
      clickType,
      source: source || "",
      createdAt: Timestamp.now(),
      userAgent: request.headers.get("user-agent") || "",
      billed: false,
      billedAmount: null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to track lead" }, { status: 500 });
  }
}
