import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The staging blocks render an image as an `<img>` and nothing else (spec
 * 2026-11-15 §5.3): never inlined, never fetched. An SVG is the reason. The
 * door's check (lib/svg-check.ts) refuses scripts and external references,
 * but an `<img>` is the second wall — a browser runs nothing inside an SVG it
 * loads as an image, whatever slipped past the first. A figure that inlined
 * its SVG for crisper theming (`dangerouslySetInnerHTML`), or fetched its
 * bytes to do so, would turn that second wall into a hole, and `tsc`,
 * `npm test` and `npm run build` would all pass while it did.
 *
 * Source text, read as lib/server-safe-source.test.ts reads it, because "does
 * not inline" is not observable from a render of today's fixtures. Comments
 * are stripped first: lib/pwa-source.test.ts once matched a sentence in a
 * docblock instead of the code, and a docblock here explaining the rule would
 * otherwise fail it. Every file in the directory is read, not a list, so a
 * new block is covered the day it is written.
 */
const DIR = "components/staging";

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

test("the comment stripper keeps code and drops comments", () => {
  const stripped = code('// fetch(a)\n/* dangerouslySetInnerHTML */\nconst u = "https://x"; fetch(b);');
  assert.doesNotMatch(stripped, /fetch\(a\)|dangerouslySetInnerHTML/);
  assert.match(stripped, /fetch\(b\)/);
  assert.match(stripped, /https:\/\/x/);
});

const files = readdirSync(join(process.cwd(), DIR)).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

test("components/staging has files to check", () => {
  assert.ok(files.length >= 7, files.join(", "));
});

for (const file of files) {
  const source = code(readFileSync(join(process.cwd(), DIR, file), "utf8"));

  test(`${DIR}/${file} never inlines markup`, () => {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${file} must render images as <img>, never inline them`);
  });

  test(`${DIR}/${file} never fetches`, () => {
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file} must not fetch an image's bytes — the browser loads an <img>`);
  });
}
