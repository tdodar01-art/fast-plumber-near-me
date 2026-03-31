import { NextRequest, NextResponse } from "next/server";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

    if (db) {
      await addDoc(collection(db, "businessSubmissions"), {
        ...data,
        createdAt: serverTimestamp(),
        status: "pending",
      });
    }

    return NextResponse.json({ success: true, message: "Business submitted for review" });
  } catch {
    return NextResponse.json({ error: "Failed to submit business" }, { status: 500 });
  }
}
