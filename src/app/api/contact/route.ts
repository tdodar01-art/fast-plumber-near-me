import { NextRequest, NextResponse } from "next/server";
import { submitContactForm } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const { name, email, subject, message } = data;
    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await submitContactForm({
      name,
      email,
      subject: subject || "General Question",
      message,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit message" }, { status: 500 });
  }
}
