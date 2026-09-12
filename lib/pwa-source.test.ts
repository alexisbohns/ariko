import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import manifest from "../app/manifest";

/**
 * The install surface, pinned by source text. Every failure below passes `tsc`,
 * `npm test` and `npm run build` while being false, and three of the four are
 * invisible to anyone who is not offline or not reading DevTools.
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
