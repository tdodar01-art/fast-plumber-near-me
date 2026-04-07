import { NextRequest, NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { checkRateLimit, checkOrigin } from "@/lib/rate-limit";

const VALID_TYPES = ["view-5s", "view-15s", "view-30s", "quick-bounce"];

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;
  const originBlocked = checkOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const data = await request.json();
    const { plumberId, engagementType, city } = data;

    if (!plumberId || !engagementType || !VALID_TYPES.includes(engagementType)) {
      return NextResponse.json({ error: "Invalid engagement" }, { status: 400 });
    }

    if (isConfigured && db) {
      await addDoc(collection(db, "plumberEngagement"), {
        plumberId,
        engagementType,
        city: city || "",
        createdAt: Timestamp.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
