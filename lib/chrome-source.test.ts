import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The two rules that make `components/chrome.tsx` safe to share, enforced
 * rather than written down.
 *
 * Before the shared-surfaces slice, the public zone's chrome and the admin's
 * were separate files, and the public one's constraints — no `"use client"`, no
 * `lucide-react` — were prose in CLAUDE.md guarding a file nobody else touched.
 * Sharing the shell moved a NEW file onto the public zone's critical path, and
 * onto it from the admin side, where both constraints are meaningless: the
 * admin is already a client tree and already imports lucide everywhere.
 *
 * So the failure mode is specific and entirely plausible. Someone adds a
 * `useState` to the chrome for a collapse animation, or reaches for `<ChevronsLeft />`
 * instead of adding a glyph to `components/public-icons.tsx`, and:
 *
 *  - `tsc` passes. Both are valid TypeScript.
 *  - `npm test` passes. Nothing else reads this file.
 *  - `npm run build` passes. A client component in a server tree is legal.
 *  - Every admin page still works, because the admin has script.
 *
 * And the public site becomes unnavigable without JavaScript — the one trade
 * `components/icon-link.tsx` existed to refuse, and which this file inherited
 * responsibility for when that file was folded in. The first person to notice
 * would be a visitor.
 *
 * Source text rather than a render, deliberately. `lib/toc-mount.test.ts` can
 * assert its claim by rendering, because "renders nothing" is observable in the
 * output. "Is not a client component" is not: `renderToStaticMarkup` happily
 * renders a `"use client"` module, and the boundary only exists to Next's
 * bundler. The directive itself is the thing to assert.
 */

const CHROME = readFileSync(join(process.cwd(), "components/chrome.tsx"), "utf8");

test("the shared chrome is not a client component", () => {
  // Anywhere in the file, not just line one: a stray directive lower down is
  // inert, but it is also a sign someone tried.
  assert.ok(
    !/^\s*["']use client["']/m.test(CHROME),
    'components/chrome.tsx must not be a client component — the public zone\'s navigation goes through it',
  );
});

test("the shared chrome imports no lucide icon", () => {
  // lucide-react routes every icon through an Icon.mjs carrying "use client",
  // so one import is one client boundary — components/media.tsx states the rule
  // and components/public-icons.tsx is the way around it.
  assert.ok(
    !/from\s+["']lucide-react["']/.test(CHROME),
    "components/chrome.tsx must not import lucide-react — callers pass their own glyph as children",
  );
});

test("the shared chrome pulls in no server-only module", () => {
  // The other direction, and the one that fails LOUDLY rather than quietly:
  // lib/data.ts opens with node:fs, so a chrome that reached for it would break
  // the admin's client islands at build time. Cheap to pin while we are here.
  assert.ok(!/from\s+["']node:/.test(CHROME), "components/chrome.tsx must stay isomorphic");
});
