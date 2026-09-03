import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, MAX_AGE_MS, verifySessionValue } from "@/lib/session";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANG_PARAM, parseLang } from "@/lib/locale";

// Two jobs, and they never overlap: the admin gate below runs on /admin/*, and
// the language switch runs on the PUBLIC paths in the matcher. Public requests
// return before reaching any auth code.
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    // The switch is a link to `?lang=…`. Store the choice and redirect to the
    // clean URL, so the preference survives navigation without every link in
    // the site having to carry a query string — and so a shared URL is not
    // permanently stuck in one language for whoever opens it.
    const requested = parseLang(request.nextUrl.searchParams.get(LANG_PARAM));
    if (!requested) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.searchParams.delete(LANG_PARAM);
    const response = NextResponse.redirect(url);
    response.cookies.set(LANG_COOKIE, requested, {
      maxAge: LANG_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false, // a reading preference, not a credential
      path: "/",
    });
    return response;
  }

  if (pathname === "/admin/login") {
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
  // The public entries exist only so `?lang=` can be turned into a cookie.
  // They are the exhibition pages that render authored prose — the ones with
  // something to be bilingual about.
  matcher: ["/admin/:path*", "/", "/beanstalk", "/plant/:slug*", "/pod/:slug*", "/bean/:id*"],
};
