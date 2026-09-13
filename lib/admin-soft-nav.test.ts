import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE ADMIN NAVIGATES CLIENT-SIDE, and this file is here because reverting that
 * is a one-word edit that breaks nothing a test would otherwise see.
 *
 * Delete an `as={Link}` and: `tsc` passes, `eslint` passes, `npm test` passes,
 * `npm run build` passes. Every href still points where it pointed, every page
 * still renders, every shortcut still works, and `lib/admin-nav.test.ts` and
 * `lib/admin-scope.test.ts` — which pin what the rail contains and where each
 * row goes — are both entirely satisfied. The only thing that changes is that
 * the chrome starts being torn down and rebuilt on every click, which is
 * invisible to the suite and impossible to miss in use.
 *
 * What that cost, measured off a screen recording of five consecutive
 * navigations, was 284–358 ms of visibly broken chrome EACH TIME:
 *
 *   - a white frame, the old document gone and the new one not yet painted;
 *   - the plant switcher's logo flashing its monogram, because Base UI's
 *     `Avatar.Image` holds its status in client state (`useState('idle')`) and
 *     only calls `new Image()` from a layout effect — the `<img>` is never in
 *     the server HTML, so the request cannot even START until the bundle has
 *     downloaded and hydrated;
 *   - the search icon arriving last (`lib/command-palette-mount.test.ts`).
 *
 * A soft navigation does not fix those three. It makes them unreachable: the
 * layout and every island in it stay MOUNTED across a click, so there is no
 * frame in which the chrome is half-built and nothing to re-hydrate. The server
 * cost went with it — the layout's garden read is no longer repeated per
 * navigation, because the layout is no longer re-rendered per navigation.
 *
 * The counterpart assertion lives in `lib/server-safe-source.test.ts`: the
 * admin gets `Link` by PASSING it to `ChromeLink`, never by importing it into
 * `components/chrome.tsx`, which the public zone renders. Both halves matter —
 * this file would be satisfied by the shortcut that file forbids.
 */

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const CHROME = "app/admin/_components/admin-chrome.tsx";
const SWITCHER = "app/admin/_components/plant-switcher.tsx";

test("the rail's items are soft navigations", () => {
  const text = source(CHROME);

  assert.ok(
    /from\s+["']next\/link["']/.test(text),
    `${CHROME} must import next/link — the rail is the admin's main navigation ` +
      `and a hard load there rebuilds the whole chrome`,
  );

  // The rail item is the ChromeLink built from `navHref`, which is the one the
  // author actually clicks between sections. Asserting on that href rather than
  // on a count, so adding or removing a chrome button does not move the goalposts.
  const railItem = /href=\{navHref\(item, scope\)\}[\s\S]{0,200}?as=\{Link\}/.test(text);
  assert.ok(
    railItem,
    `${CHROME}: the rail item (href={navHref(item, scope)}) must carry as={Link}. ` +
      `Without it every section change is a full document load.`,
  );
});

test("the Ariko mark goes home without reloading the document", () => {
  const text = source(CHROME);
  assert.ok(
    /href="\/admin"[^>]*as=\{Link\}/.test(text),
    `${CHROME}: the mark's link to /admin must carry as={Link}`,
  );
});

/**
 * "Public site" is the deliberate exception and is asserted as one, so that its
 * plain `<a>` reads as a decision rather than as the one someone forgot.
 * Following it LEAVES the admin — a different zone, a different chrome, and no
 * reason to carry the admin's router and bundle across.
 */
test("leaving for the public site is still a hard navigation, on purpose", () => {
  const text = source(CHROME);
  assert.ok(
    /href="\/"\s+label="Public site"(?![^>]*as=\{Link\})/.test(text),
    `${CHROME}: "Public site" should NOT be a next/link — it leaves the admin ` +
      `zone entirely, so a soft navigation would only drag the admin's router ` +
      `and bundle into the public site. If this is now deliberate, say so here.`,
  );
});

test("picking a plant does not tear down the switcher that picked it", () => {
  const text = source(SWITCHER);

  assert.ok(
    /from\s+["']next\/link["']/.test(text),
    `${SWITCHER} must import next/link`,
  );

  assert.ok(
    /<Link\s[\s\S]*?href=\{href\}/.test(text),
    `${SWITCHER}: Row must render a <Link>, not a bare <a> — picking a plant is ` +
      `the navigation most likely to be followed by another one`,
  );

  // The half that must NOT change: it is still a real href, so the row stays
  // middle-clickable, copyable, and a description of the view rather than a
  // command. `lib/admin-scope.ts` is still the only thing that composes it.
  assert.ok(
    /href=\{scopeHref\(/.test(text),
    `${SWITCHER}: rows must still take their href from scopeHref — a router.push ` +
      `here would make the URL a consequence of a click rather than the view's name`,
  );
});
