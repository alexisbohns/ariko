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
  "components/media.tsx",
  "components/public-icons.tsx",
  "components/link-row.tsx",
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

  test(`${path} pulls in no server-only module`, () => {
    // The other direction, and the one that fails LOUDLY rather than quietly:
    // lib/data.ts opens with node:fs, so a shared file that reached for it
    // would break the admin's client islands at build time.
    assert.ok(!/from\s+["']node:/.test(source), `${path} must stay isomorphic`);
  });
}
