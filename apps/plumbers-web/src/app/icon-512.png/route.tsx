import { appIconResponse } from "@/lib/app-icon";

export const runtime = "edge";

export function GET() {
  return appIconResponse(512);
}
