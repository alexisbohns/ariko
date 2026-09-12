import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../app/manifest";

/**
 * The install surface: the manifest, and the service worker behind it. Every
 * fact below passes `tsc`, `npm test` and `npm run build` while being false,
 * and three of the four are invisible to anyone who is not offline or not
 * reading DevTools.
 *
 * The four tests reach their subject two different ways, and the split is not
 * a matter of taste. The manifest test IMPORTS AND CALLS `manifest()`, because
 * it can: the module is a pure function over plain constants and a `next` type,
 * so the real icon list is one call away and a regex over the source would
 * merely approximate it. The three worker tests READ `public/sw.js` AS TEXT,
 * because `node:test` cannot call it at all — it is a browser-runtime module
 * whose top level touches `self`, registers event listeners and closes over
 * `caches`, none of which exist here. Its invariant ("the runtime writes to no
 * cache") is therefore asserted the only way it can be: by counting
 * `caches.open`, `.put(` and `respondWith(` in the shipped bytes.
 *
 * So: execute what can be executed, read what cannot. Do not convert the
 * manifest test back to source-reading, and do not try to import sw.js.
 */

test("every manifest icon exists in public/, at the size it claims", () => {
  // A manifest naming a missing icon is not an error anywhere. Chrome simply
  // declines to offer the install, and says why only in the Application panel.
  // A manifest whose `sizes` disagrees with the actual pixels is worse: Chrome
  // trusts the string, picks that file for a slot it does not fit, and the
  // install carries a blurred or cropped mark.
  //
  // IMPORTED AND CALLED, not grepped — do not "simplify" this back to a regex
  // over the source. The sibling pins in `lib/server-safe-source.test.ts` read
  // source text because their facts are not observable by running the code:
  // "is not a client component" is a bundler property, so the directive itself
  // is the only thing there is to assert. This fact is the opposite. `manifest()`
  // is a pure function returning a typed object and the module imports only a
  // type from `next` plus plain constants, so the real answer is one call away.
  // A regex would read `>= 3` literal `src:` strings and so never check a fourth
  // icon built from a constant or a template literal, and would equally count a
  // `src:` that happened to appear in a docblock.
  const icons = manifest().icons ?? [];

  assert.equal(icons.length, 3, "expected the 192, 512 and maskable icons");

  for (const { src, sizes } of icons) {
    assert.ok(
      existsSync(join(process.cwd(), "public", src)),
      `app/manifest.ts names ${src}, which does not exist under public/`,
    );

    // The generator (scripts/build-brand.ts) names each file for its own edge,
    // so the filename is an independent record of the pixels and the `sizes`
    // string can be checked against it without decoding a PNG.
    const edge = /-(\d+)\.png$/.exec(src)?.[1];
    assert.ok(edge, `${src} does not carry its pixel size in its name`);
    assert.equal(
      sizes,
      `${edge}x${edge}`,
      `app/manifest.ts declares sizes "${sizes}" for ${src}, whose name says ${edge}px`,
    );
  }
});

const sw = () => readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

/** The worker's own PRECACHE list, so no test keeps a second copy of it. */
function precache(source: string): string[] {
  const found = source.match(/const PRECACHE = (\[[^\]]*\]);/);
  assert.ok(found, "public/sw.js must declare `const PRECACHE = [...]` on one line");
  return JSON.parse(found[1]) as string[];
}

test("every precached path exists in public/", () => {
  // A typo makes addAll reject, which makes install reject, which means the
  // worker never activates — and NOTHING visibly breaks. The site simply has
  // no offline page, forever, and the only symptom is visible to someone with
  // no network.
  for (const path of precache(sw())) {
    assert.ok(
      existsSync(join(process.cwd(), "public", path)),
      `public/sw.js precaches ${path}, which does not exist under public/`,
    );
  }
});

test("the service worker writes to no cache at runtime", () => {
  // The invariant from sw.js's docblock, as a test rather than a comment.
  // Adding runtime caching is a three-line change that looks like an
  // improvement and is the only way this design can serve a stale — or
  // authenticated — response, because the worker's scope includes /admin.
  const source = sw();

  assert.equal(
    source.match(/caches\.open\(/g)?.length ?? 0,
    1,
    "public/sw.js must call caches.open exactly once, in install — use caches.match to read",
  );
  assert.equal(
    source.match(/\.put\(/g)?.length ?? 0,
    0,
    "public/sw.js must never put a response into a cache",
  );
  assert.match(
    source,
    /if \(event\.request\.mode !== "navigate"\) return;/,
    "public/sw.js must leave everything but top-level navigations untouched",
  );
  assert.equal(
    source.match(/respondWith\(/g)?.length ?? 0,
    1,
    "public/sw.js must respond to navigations and nothing else",
  );
});

test("VERSION carries a digest of the precached bytes", () => {
  // Turns "remember to bump the cache version when you edit the offline page"
  // from discipline into a failing test that prints the string to paste.
  const source = sw();
  const bytes = Buffer.concat(
    precache(source).map((p) => readFileSync(join(process.cwd(), "public", p))),
  );
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);

  assert.ok(
    source.includes(digest),
    `public/sw.js precache changed — set VERSION to "ariko-${digest}"`,
  );
});
