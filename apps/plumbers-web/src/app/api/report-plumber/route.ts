import { NextRequest, NextResponse } from "next/server";
import { submitPlumberReport } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { checkRateLimit, checkOrigin } from "@/lib/rate-limit";

const VALID_TYPES = ["bad-number", "seems-closed", "answered-fast", "no-answer"];

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;
  const originBlocked = checkOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const data = await request.json();
    const { plumberId, reportType, city } = data;

    if (!plumberId || !reportType || !VALID_TYPES.includes(reportType)) {
      return NextResponse.json({ error: "Invalid report" }, { status: 400 });
    }

    await submitPlumberReport({
      plumberId,
      reportType,
      city: city || "",
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
