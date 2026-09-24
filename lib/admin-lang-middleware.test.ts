import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { COOKIE_NAME, createSessionValue } from "./session";
import { LANG_COOKIE } from "./locale";

/**
 * The admin's `?lang=fr` names the half of an article being edited
 * (lib/edit-lang.ts) and shares its NAME with the public zone's reading
 * preference, which middleware.ts turns into a cookie and strips with a
 * redirect. That branch must never see an /admin path: if it did, every French
 * editor would bounce back to English, with nothing failing in tsc, npm test or
 * npm run build — the page would simply always open in English.
 */

const SECRET = "s".repeat(32);

test("an authenticated /admin request keeps ?lang=fr and sets no reading cookie", async (t) => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  t.after(() => {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  });
  process.env.ADMIN_SESSION_SECRET = SECRET;
  const session = await createSessionValue(SECRET, Date.now());
  const response = await middleware(
    new NextRequest("http://localhost/admin/sprout/a?lang=fr", { headers: { cookie: `${COOKIE_NAME}=${session}` } }),
  );
  // NextResponse.next() — a pass-through, not a redirect. The status check is
  // the public-API contract; the header is NextResponse's own implementation
  // detail, checked because it is the one thing that also proves this is
  // `.next()` and not merely a redirect that happens to answer 200.
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.cookies.get(LANG_COOKIE), undefined);
});

test("the public branch still turns ?lang= into a cookie (the contrast this file relies on)", async () => {
  const response = await middleware(new NextRequest("http://localhost/beanstalk?lang=fr"));
  assert.equal(response.status, 307);
  assert.equal(response.cookies.get(LANG_COOKIE)?.value, "fr");
});
