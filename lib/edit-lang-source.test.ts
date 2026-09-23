import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source pins for the bilingual editor — properties of the files AS WRITTEN,
 * which no render can observe (ProseEditor mounts client-only), on
 * lib/prose-commit-source.test.ts's reasoning.
 *
 * Each of these passes tsc, npm test and npm run build while false:
 *  - a switch that stays live over unsaved text navigates and drops it;
 *  - a page that loads `textPart(content, "en")` edits English whatever the URL says;
 *  - an editor without `key={lang}` keeps the English baseline across the switch.
 */

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const PROSE_EDITOR = "components/editor/prose-editor.tsx";

test("the editor draws the switch in BOTH commit shapes, and disables it on unsaved text in both", () => {
  const text = source(PROSE_EDITOR);
  assert.equal(text.match(/<EditLangSwitch/g)?.length, 2, "one switch per commit shape (float and inline)");
  assert.equal(
    text.match(/disabled=\{dirty \|\| pending \|\| imageBusy\}/g)?.length,
    2,
    "each switch must be disabled on dirty, pending and imageBusy",
  );
});

test("Start from English goes through setContent as markdown, and only when a seed was given", () => {
  const text = source(PROSE_EDITOR);
  assert.match(text, /setContent\(normalizeEmptyListMarkers\(seed\), \{ contentType: "markdown" \}\)/);
  assert.match(text, /seed && editor && empty/);
});

test("the editable surface declares its language, for the browser's spellcheck", () => {
  assert.match(source(PROSE_EDITOR), /lang: langSwitch\?\.current \?\? "en"/);
});
