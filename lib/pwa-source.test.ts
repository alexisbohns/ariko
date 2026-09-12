import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../app/manifest";

/**
 * The install surface: the manifest, the service worker behind it, and the
 * offline page it precaches. Every fact below passes `tsc`, `npm test` and
 * `npm run build` while being false, and four of the five are invisible to
 * anyone who is not offline or not reading DevTools.
 *
 * The five tests reach their subject two different ways, and the split is not
 * a matter of taste. The manifest test IMPORTS AND CALLS `manifest()`, because
 * it can: the module is a pure function over plain constants and a `next` type,
 * so the real icon list is one call away and a regex over the source would
 * merely approximate it. The other four READ FILES AS TEXT, for two distinct
 * reasons. `public/sw.js` cannot be called at all under `node:test` — it is a
 * browser-runtime module whose top level touches `self`, registers event
 * listeners and closes over `caches`, none of which exist here — so its
 * invariant ("the runtime writes to no cache") is asserted the only way it can
 * be, by counting the write family in the shipped bytes. The offline page is
 * text by nature: the fact being pinned is that a hand-written copy of the
 * brand mark still matches the generated `app/icon.svg`, which is a comparison
 * between two files and nothing else.
 *
 * Source-reading has one failure mode, and this file has already had it: a
 * count that matches a docblock rather than the code. The worker tests
 * therefore strip comments before counting — see the invariant test.
 *
 * So: execute what can be executed, read what cannot, and count only code. Do
 * not convert the manifest test back to source-reading, and do not try to
 * import sw.js.
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
  //
  // Counted against CODE only: a docblock naming `caches.open(` must neither
  // satisfy this pin nor break it — it did exactly that before this was fixed,
  // because the real call is a `caches\n.open(VERSION)` chain the old regex
  // could not see, so the sole match was a sentence in a comment. Whitespace
  // is tolerated for the same reason: a formatter may rewrap the chain, and a
  // correctly-shaped worker must not fail because Prettier moved a dot.
  const code = sw()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  assert.equal(
    code.match(/caches\s*\.\s*open\(/g)?.length ?? 0,
    1,
    "public/sw.js must call caches.open exactly once, in install — use caches.match to read",
  );
  assert.equal(
    code.match(/\.put\(/g)?.length ?? 0,
    0,
    "public/sw.js must never put a response into a cache",
  );
  // `.add()` FETCHES and stores. Counting only `.put(` left the whole write
  // family half-covered: hoisting the cache handle out of install keeps
  // `caches.open` at one, and `cacheReady.then((c) => c.add(req))` in the
  // fetch handler then caches authenticated /admin navigations while every
  // other assertion here still passes.
  assert.equal(
    code.match(/\.add\(/g)?.length ?? 0,
    0,
    "public/sw.js must never cache.add at runtime — add() fetches AND stores",
  );
  assert.equal(
    code.match(/\.addAll\(/g)?.length ?? 0,
    1,
    "public/sw.js must addAll exactly once, in install",
  );
  // GET as well as navigate: a form POST is a navigation, and answering a
  // failed one with a 200 offline page reports a submission that never
  // happened. See the fetch handler's own comment.
  assert.match(
    code,
    /if \(event\.request\.mode !== "navigate" \|\| event\.request\.method !== "GET"\) return;/,
    "public/sw.js must leave everything but GET navigations untouched",
  );
  assert.equal(
    code.match(/respondWith\(/g)?.length ?? 0,
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

  // Asserted against the declaration and not the whole file, because the
  // message promises "set VERSION to …": a substring check is satisfied by the
  // digest appearing anywhere, including a comment left over from the last
  // bump, while VERSION itself stays stale.
  assert.match(
    source,
    new RegExp(`const VERSION = "ariko-${digest}";`),
    `public/sw.js precache changed — set VERSION to "ariko-${digest}"`,
  );
});

test("the offline page's inline mark is still the brand's", () => {
  // The offline page carries app/icon.svg's paths inline rather than <img>-ing
  // a precached file, because an <img> cannot read the Cache API: offline, the
  // subresource request goes to the network the worker deliberately does not
  // intercept, and the page renders a broken glyph. Inlining fixes that and
  // introduces the one hazard worth pinning — `npm run brand:build` regenerates
  // app/icon.svg and CANNOT touch this hand-written copy. A stale mark here is
  // invisible by construction: the only people who ever see this page are
  // offline, and cannot report it.
  const offline = readFileSync(join(process.cwd(), "public/offline.html"), "utf8");
  const icon = readFileSync(join(process.cwd(), "app/icon.svg"), "utf8");

  const paths = [...offline.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(paths.length > 0, "public/offline.html must inline the mark as <svg> <path> elements");

  for (const d of paths) {
    assert.ok(
      icon.includes(d),
      `public/offline.html draws a path app/icon.svg does not — re-inline the mark after a rebrand (path starts "${d.slice(0, 40)}…")`,
    );
  }
});
