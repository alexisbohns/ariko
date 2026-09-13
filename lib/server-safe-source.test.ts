import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rules that make a file safe to render in the public zone, enforced rather
 * than written down.
 *
 * This began as `chrome-source.test.ts`, guarding one file. The reasoning has
 * not changed, only its reach: the public zone's constraints — no
 * `"use client"`, no `lucide-react` — used to be prose in CLAUDE.md guarding
 * files nobody else touched, and every slice since has moved another shared
 * file onto the public zone's critical path from the admin side, where both
 * constraints are meaningless. The admin is already a client tree and already
 * imports lucide everywhere.
 *
 * So the failure mode is specific and entirely plausible. Someone adds a
 * `useState` to the chrome for a collapse animation, or reaches for a
 * `<Spotify />` from a brand icon package instead of adding a glyph, and:
 *
 *  - `tsc` passes. Both are valid TypeScript.
 *  - `npm test` passes. Nothing else reads these files.
 *  - `npm run build` passes. A client component in a server tree is legal.
 *  - Every admin page still works, because the admin has script.
 *
 * And the public site loses navigation, or a media list, without JavaScript.
 * The first person to notice would be a visitor.
 *
 * Source text rather than a render, deliberately. `lib/toc-mount.test.ts` can
 * assert its claim by rendering, because "renders nothing" is observable in the
 * output. "Is not a client component" is not: `renderToStaticMarkup` happily
 * renders a `"use client"` module, and the boundary only exists to Next's
 * bundler. The directive itself is the thing to assert.
 *
 * ADDING A FILE HERE IS THE CHEAP HALF. Anything new that the public zone
 * renders belongs in this list on the day it is written, not the day it breaks.
 */
const SERVER_SAFE = [
  "components/chrome.tsx",
  // The parenting chrome. Public bean and pod pages render it, so a
  // lucide import or a next/link here is the public zone's navigation.
  "components/lineage-chrome.tsx",
  "components/media.tsx",
  "components/public-icons.tsx",
  "components/link-row.tsx",
  "components/bean-cover.tsx",
  "components/phone-frame.tsx",
  "components/screen-strip.tsx",
  // The shared entity head. CLAUDE.md names it as one of the four shared
  // surfaces and its own docblock claims server-safety; until the sprout's
  // edition slice nothing checked either. It is rendered by
  // app/(public)/_components/plant-head.tsx — a server component — and by the
  // admin's entity heads, which are client islands, at the same time. That
  // simultaneity is the whole arrangement, and one "use client" here ends it.
  "components/plant-header.tsx",
  // The two brand marks. Generated (scripts/build-brand.ts), rendered by
  // app/(public)/page.tsx and _components/public-chrome.tsx, and never listed
  // here until the PWA slice — which is exactly the omission this list's
  // docblock warns about. A generated file is not exempt: the generator's
  // template is as editable as any other source.
  "components/brand/ariko-icon.tsx",
  "components/brand/ariko-logo.tsx",
  // The registry primitives the public zone renders — all of them, which is
  // the whole point. This list used to stop at components/, so shadcn's stock
  // "use client" on table.tsx cost every prose page 8.5 kB of
  // clsx+tailwind-merge for twenty slices with nothing watching. badge and card
  // carry no directive today; they are here so that stays true the next time
  // `npx shadcn add` overwrites one.
  //
  // separator.tsx is here too, and it is the interesting one. It WRAPS a Base
  // UI primitive whose own module carries "use client", so the boundary does
  // not go away — but the wrapper does not have to be on the far side of it.
  // Dropping its directive left `cn` (and so clsx + tailwind-merge) on the
  // server and took /beanstalk from 113 kB to 105 kB. The lesson generalises:
  // wrapping a client primitive is not a reason for the wrapper to be a client
  // component, and the stock directive shadcn ships assumes otherwise.
  "components/ui/table.tsx", // components/markdown.tsx, for GFM tables
  "components/ui/badge.tsx", // plant-head.tsx, /beanstalk, components/media.tsx
  "components/ui/card.tsx", // bean/[id], components/entity-card.tsx
  "components/ui/separator.tsx", // /beanstalk
  "components/ui/kbd.tsx", // components/chrome.tsx, for the rail's shortcut hints
];

for (const path of SERVER_SAFE) {
  const source = readFileSync(join(process.cwd(), path), "utf8");

  test(`${path} is not a client component`, () => {
    // Anywhere in the file, not just line one: a stray directive lower down is
    // inert, but it is also a sign someone tried.
    assert.ok(
      !/^\s*["']use client["']/m.test(source),
      `${path} must not be a client component — the public zone renders it`,
    );
  });

  test(`${path} imports no lucide icon`, () => {
    // lucide-react routes every icon through an Icon.mjs carrying "use client",
    // so one import is one client boundary — components/media.tsx states the
    // rule and components/public-icons.tsx is the way around it.
    assert.ok(
      !/from\s+["']lucide-react["']/.test(source),
      `${path} must not import lucide-react — use components/public-icons.tsx`,
    );
  });

  test(`${path} imports no next/link`, () => {
    // The third way to put a client boundary in a server-safe file, and the
    // one with no directive to grep for: `next/link` is a client component, so
    // importing it here would drag every public page that renders this file
    // across the boundary — the `components/ui/table.tsx` regression again,
    // arriving by a door the two checks above do not watch.
    //
    // It is worth its own test because the temptation is now REAL rather than
    // hypothetical. The admin's chrome wants a soft navigation (see
    // `app/admin/_components/admin-chrome.tsx` for what a hard one cost it),
    // and the obvious way to give it one is to reach for `Link` in
    // `components/chrome.tsx` — where it would silently be the public zone's
    // navigation too. The way that keeps both zones is `ChromeLink`'s `as`:
    // the ADMIN supplies `Link`, the public zone takes the default `"a"`, and
    // the geometry stays one file. A parameter, per CLAUDE.md's shared-surfaces
    // rule — which is exactly what this assertion protects.
    assert.ok(
      !/from\s+["']next\/link["']/.test(source),
      `${path} must not import next/link — it is a client component, and the ` +
        `public zone renders this file. Take the anchor as a prop instead ` +
        `(components/chrome.tsx's ChromeLink \`as\`) so the admin can pass Link ` +
        `without the public zone paying for it`,
    );
  });

  test(`${path} pulls in no server-only module`, () => {
    // The other direction, and the one that fails LOUDLY rather than quietly:
    // lib/data.ts opens with node:fs, so a shared file that reached for it
    // would break the admin's client islands at build time.
    assert.ok(!/from\s+["']node:/.test(source), `${path} must stay isomorphic`);
  });
}
