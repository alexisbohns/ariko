import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, THEME_SCRIPT, THEME_STORAGE_KEY, DEFAULT_THEME } from "@/lib/theme";

/**
 * THEME_SCRIPT is a STRING. That is not an implementation detail — it is the
 * whole reason this file exists.
 *
 * It has to be a string because it runs in <head> before first paint, before
 * any bundle, in both zones; a component would be a boundary and would run too
 * late, which is a flash of the wrong theme on every cold load. But a string is
 * invisible to the compiler: rename THEME_STORAGE_KEY, drop a member of THEMES,
 * or change the class from `dark`, and `tsc`, `npm test` and `npm run build`
 * all pass while the theme silently stops persisting or stops applying. The
 * first person to notice is a visitor whose choice did not stick.
 *
 * So the agreement between the script and the vocabulary beside it is asserted
 * rather than assumed. This is the same class of check as
 * `lib/pwa-source.test.ts`'s count of the cache-write family, and for the same
 * reason.
 */

test("the script reads the key the module exports", () => {
  assert.ok(
    THEME_SCRIPT.includes(THEME_STORAGE_KEY),
    `THEME_SCRIPT must read ${THEME_STORAGE_KEY} — a renamed key strands every stored choice`,
  );
});

test("the script applies the class globals.css actually defines", () => {
  // app/globals.css:6 — `@custom-variant dark (&:is(.dark *))`. Any other
  // class name toggles nothing at all.
  assert.ok(/["']dark["']/.test(THEME_SCRIPT), THEME_SCRIPT);
});

test("every member of the vocabulary appears in the script", () => {
  // A fourth theme added to THEMES that the script cannot resolve would draw
  // as a menu row that silently does nothing.
  for (const theme of THEMES) {
    assert.ok(THEME_SCRIPT.includes(theme), `${theme} is unreachable from THEME_SCRIPT`);
  }
});

test("the script cannot throw — localStorage throws in Safari private mode", () => {
  // An uncaught throw in a blocking <head> script stops the parser. This is not
  // defensive habit; it is the documented behaviour of the API being called.
  assert.ok(/\btry\b/.test(THEME_SCRIPT) && /\bcatch\b/.test(THEME_SCRIPT), THEME_SCRIPT);
});

test("the default is a member of the union", () => {
  assert.ok(THEMES.includes(DEFAULT_THEME));
});

test("the root layout suppresses the hydration warning the script causes", async () => {
  // THEME_SCRIPT mutates <html class> before React hydrates, so the server's
  // className and the client's disagree BY DESIGN. Without
  // suppressHydrationWarning on that element React logs a mismatch error on
  // every cold load in dev — noise that trains people to ignore real ones.
  //
  // Source text rather than a render: the attribute is a directive to React's
  // hydration pass and leaves no trace in renderToStaticMarkup's output, so
  // there is nothing to assert on a rendered tree. lib/server-safe-source.test.ts
  // makes the same argument for the same reason.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const html = source.slice(source.indexOf("<html"), source.indexOf(">", source.indexOf("<html")));
  assert.ok(
    html.includes("suppressHydrationWarning"),
    "app/layout.tsx's <html> must suppress the mismatch THEME_SCRIPT deliberately creates",
  );
});
