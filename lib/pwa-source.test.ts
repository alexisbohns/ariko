import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The install surface, pinned by source text. Every failure below passes `tsc`,
 * `npm test` and `npm run build` while being false, and three of the four are
 * invisible to anyone who is not offline or not reading DevTools.
 */

test("every manifest icon exists in public/", () => {
  // A manifest naming a missing icon is not an error anywhere. Chrome simply
  // declines to offer the install, and says why only in the Application panel.
  const source = readFileSync(join(process.cwd(), "app/manifest.ts"), "utf8");
  const srcs = [...source.matchAll(/src:\s*"([^"]+)"/g)].map(([, s]) => s);

  assert.ok(srcs.length >= 3, "expected at least the 192, 512 and maskable icons");

  for (const src of srcs) {
    assert.ok(
      existsSync(join(process.cwd(), "public", src)),
      `app/manifest.ts names ${src}, which does not exist under public/`,
    );
  }
});
