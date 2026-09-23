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

test("the seed action disappears the moment there is anything to lose", () => {
  assert.match(source(PROSE_EDITOR), /onUpdate: \(\{ editor \}\) => \{[\s\S]*?setEmpty\(editor\.isEmpty\)[\s\S]*?setDirty\(true\)/);
});

// Every place a content editor is mounted. ContentCard stands in for the pod
// page, which renders the editor through it.
const EDITOR_MOUNTS = [
  "app/admin/(chrome)/sprout/[slug]/page.tsx",
  "app/admin/(chrome)/plant/[slug]/narrative/page.tsx",
  "app/admin/_components/content-card.tsx",
];

for (const path of EDITOR_MOUNTS) {
  test(`${path} loads through editorHalves, keys on lang, and posts lang`, () => {
    const text = source(path);
    assert.match(text, /editorHalves\(/, "the load goes through editorHalves");
    assert.doesNotMatch(text, /textPart\([^)]*content[^)]*"en"\)/, "no hard-coded English load of content");
    assert.match(text, /key=\{lang\}/, "the editor remounts on a switch");
    assert.match(text, /langSwitch=\{/, "the editor is handed its switch");
    assert.match(text, /hidden=\{\{[^}]*\blang \}\}/, "the save must post which half it is — an absent lang saves as English");
  });
}

test("the pod page hands ContentCard its language", () => {
  const text = source("app/admin/(chrome)/pod/[slug]/page.tsx");
  assert.match(text, /editLang\(/);
  assert.match(text, /langHrefs=\{/);
});
