import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const { businessName, phone, email } = data;
    if (!businessName || !phone || !email) {
      return NextResponse.json(
        { error: "Business name, phone, and email are required" },
        { status: 400 }
      );
    }

    // In production, this will write to Firestore:
    // import { submitBusiness } from "@/lib/firestore";
    // const id = await submitBusiness(data);

    console.log("Business submission received:", data);

    return NextResponse.json({ success: true, message: "Business submitted for review" });
  } catch {
    return NextResponse.json({ error: "Failed to submit business" }, { status: 500 });
  }
}
