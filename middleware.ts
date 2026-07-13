import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, MAX_AGE_MS, verifySessionValue } from "@/lib/session";

// Gate /admin/* on a valid session cookie. /admin/login is exempt (it mints the
// session). Runs in the edge runtime — only imports edge-safe lib/session.
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }
  const secret = process.env.ADMIN_SESSION_SECRET;
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (secret && (await verifySessionValue(secret, value, MAX_AGE_MS, Date.now()))) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
