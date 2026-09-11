// lib/not-found-pages.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import RootNotFound from "@/app/not-found";
import PublicError from "@/app/(public)/error";

test("the root 404 offers a way back to the site", () => {
  const html = renderToStaticMarkup(<RootNotFound />);
  assert.match(html, /href="\/"/, "a 404 with no way out is a dead end");
});

/**
 * The reset control is the only affordance an error page has. An error page
 * whose one control is broken is worse than Next's default, which at least
 * does not pretend.
 */
test("the public error boundary renders a working reset control", () => {
  let reset = 0;
  const html = renderToStaticMarkup(
    <PublicError error={new Error("boom")} reset={() => { reset += 1; }} />,
  );
  assert.match(html, /<button/, "reset must be a real button");
  assert.match(html, /href="\/"/, "and there must still be a way home");
  assert.equal(reset, 0, "reset must not fire during render");
});

/**
 * The error boundary ships in the client bundle of every public route, in the
 * slice right after the rulebook rewrite took a client boundary OUT of the
 * public zone. These imports are what would make it expensive.
 */
test("the public error boundary imports nothing that costs bytes", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/error.tsx"), "utf8");
  for (const banned of ["lucide-react", "@/lib/utils", "@/components/ui/"]) {
    assert.ok(
      !source.includes(banned),
      `app/(public)/error.tsx must not import ${banned} — it is a client ` +
        `boundary on every public route, so every import is shipped`,
    );
  }
});

test("the public error boundary is a client component, as Next requires", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/error.tsx"), "utf8");
  assert.match(source, /^\s*["']use client["']/m);
});
