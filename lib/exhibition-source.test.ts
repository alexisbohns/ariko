import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The zero-value-import rule, enforced rather than written down.
 *
 * `lib/exhibition.ts`'s docblock says NO VALUE IMPORTS, and the reason is a
 * runtime cycle: `lib/data.ts` now imports `exhibitionOrder` from this module
 * at module scope. Add a value import back out of `lib/exhibition.ts` — reach
 * for `resolveText` instead of leaving `ExhibitionRow.name` for the page to
 * fill in, say — and:
 *
 *  - `tsc` passes. A cycle between two modules is valid TypeScript.
 *  - `npm test` passes. Nothing else in this file's own suite notices.
 *  - `npm run build` passes. Next/webpack resolves import cycles; it does not
 *    reject them.
 *
 * It would not reliably fail at runtime either, which is what makes this
 * class of bug worse than a typical cycle: `lib/data.ts` imports
 * `exhibitionOrder` at module scope but only CALLS it inside `buildDataset`,
 * well after both modules have finished initializing. So the cycle resolves
 * cleanly in most module load orderings and only breaks in the one where
 * `lib/exhibition.ts` is still mid-evaluation when `lib/data.ts` needs it —
 * an ordering that depends on which module some future caller imports first,
 * not on anything in either file. The bug would surface as a rare, order-
 * dependent `undefined is not a function`, far from the line that caused it.
 *
 * Source text rather than an import-graph analysis or a render, for the same
 * reason `lib/server-safe-source.test.ts` reads source text: the property to
 * assert ("this file imports no values") is about the file as written, not
 * about anything observable by running it.
 *
 * Line-based, checking only the line that BEGINS an import — and that is
 * sufficient rather than sloppy. A multi-line import's first line is
 * `import {`, with no `type` keyword on it, so a value import broken across
 * lines still fails this exactly where a single-line one would.
 */
const path = "lib/exhibition.ts";
const source = readFileSync(join(process.cwd(), path), "utf8");
const importLines = source.split("\n").filter((line) => /^\s*import\b/.test(line));

test(`${path} has at least one import line`, () => {
  // So this suite cannot pass vacuously if the file is ever restructured to
  // import nothing at all.
  assert.ok(importLines.length > 0, `${path} must still import MediaImage as a type`);
});

test(`${path} imports only types`, () => {
  for (const line of importLines) {
    assert.ok(
      /^\s*import\s+type\b/.test(line),
      `${path} must import only types — found a value import: ${line.trim()}`,
    );
  }
});
