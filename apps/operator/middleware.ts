import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gate the entire operator console behind OPERATOR_DEV_MODE. Unless the env
// var is set, every route 404s. This is deliberate — the app has no auth yet
// and the simulated actions in Phase 1 should never be reachable from the
// public internet.
export function middleware(_req: NextRequest) {
  if (!process.env.OPERATOR_DEV_MODE) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // Match everything except static assets so 404 is returned at the edge for
  // any normal request when the gate is off.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
