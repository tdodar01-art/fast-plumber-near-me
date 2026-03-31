import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const { plumberId, city, clickType, source } = data;
    if (!plumberId || !city || !clickType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // In production, this will write to Firestore:
    // import { trackLead } from "@/lib/firestore";
    // import { Timestamp } from "firebase/firestore";
    // await trackLead({
    //   plumberId,
    //   city,
    //   clickType,
    //   source,
    //   createdAt: Timestamp.now(),
    //   userAgent: request.headers.get("user-agent") || "",
    //   billed: false,
    //   billedAmount: null,
    // });

    console.log("Lead tracked:", { plumberId, city, clickType, source });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to track lead" }, { status: 500 });
  }
}
