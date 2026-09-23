import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Source pins for the bilingual editor — properties of the files AS WRITTEN,
 * which no render can observe (ProseEditor mounts client-only), on
 * lib/prose-commit-source.test.ts's reasoning.
 *
 * Each of these passes tsc, npm test and npm run build while false:
 *  - a switch that stays live over unsaved text navigates and drops it;
 *  - a page that loads `textPart(content, "en")` edits English whatever the URL says;
 *  - an editor without `key={lang}` keeps the English baseline across the switch;
 *  - an editor mount that forgets `lang` in `hidden`, with `save` no longer
 *    posting it itself, saves French over English with nothing failing anywhere.
 */

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const PROSE_EDITOR = "components/editor/prose-editor.tsx";

test("the editor draws the switch in BOTH commit shapes, and disables it on unsaved text in both", () => {
  const text = source(PROSE_EDITOR);
  const matches = [...text.matchAll(/<EditLangSwitch\b[\s\S]*?\/>/g)];
  assert.equal(matches.length, 2, "one switch per commit shape (float and inline)");
  for (const [element] of matches) {
    const disabled = /disabled=\{([^}]*)\}/.exec(element);
    assert.ok(disabled, `each <EditLangSwitch> must carry a \`disabled\` expression (found: ${element})`);
    // The INVARIANT, not the exact string: the switch must go dead on unsaved
    // text (`dirty`), mid-save (`pending`) and mid-upload (`imageBusy`) — but
    // which of the three is checked first, or how they are combined, is not
    // what this test is protecting.
    for (const token of ["dirty", "pending", "imageBusy"]) {
      assert.ok(
        disabled![1].includes(token),
        `<EditLangSwitch>'s \`disabled\` must reference \`${token}\` (found: ${disabled![1]})`,
      );
    }
  }
});

test("Start from English goes through setContent as markdown, and only when a seed was given", () => {
  const text = source(PROSE_EDITOR);
  // Two invariants, asserted separately rather than as one exact call: the
  // seed goes through the same list-marker workaround `initialMarkdown` does
  // (a hand-typed English body can hit the same empty-list-item parser bug),
  // and it is loaded as markdown rather than plain text. Neither assertion
  // pins the argument order or spacing of the call they both live inside.
  assert.match(
    text,
    /setContent\(normalizeEmptyListMarkers\(seed\)/,
    "Start from English must normalize the seed the same way initialMarkdown is normalized",
  );
  assert.match(text, /contentType:\s*"markdown"/, "the seed must be loaded as markdown");
  assert.match(text, /seed && editor && empty/);
});

test("the editable surface declares its language, for the browser's spellcheck", () => {
  assert.match(source(PROSE_EDITOR), /lang: langSwitch\?\.current \?\? "en"/);
});

test("the seed action disappears the moment there is anything to lose", () => {
  assert.match(source(PROSE_EDITOR), /onUpdate: \(\{ editor \}\) => \{[\s\S]*?setEmpty\(editor\.isEmpty\)[\s\S]*?setDirty\(true\)/);
});

test("save posts the half the editor is drawing itself, after hidden, so it wins", () => {
  const text = source(PROSE_EDITOR);
  const hiddenLoopIndex = text.indexOf("for (const [key, value] of Object.entries(hidden))");
  assert.notEqual(hiddenLoopIndex, -1, `${PROSE_EDITOR} must still copy \`hidden\` onto the FormData`);
  const setLangMarker = 'if (langSwitch) formData.set("lang", langSwitch.current);';
  const setLangIndex = text.indexOf(setLangMarker);
  assert.notEqual(
    setLangIndex,
    -1,
    "save must call formData.set(\"lang\", langSwitch.current) when a langSwitch is present — " +
      "otherwise an editor mount whose page forgot `lang` in `hidden` posts no lang at all, and " +
      "the content actions read an absent lang as English",
  );
  assert.ok(
    setLangIndex > hiddenLoopIndex,
    "formData.set(\"lang\", ...) must come AFTER the hidden loop, so it WINS over any hidden.lang " +
      "the page also posted rather than being overwritten by it",
  );
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
    assert.match(text, /hidden=\{\{[^}]*\blang\s*\}\}/, "the page must still hand the editor a hidden `lang` field (belt-and-braces: `save` now posts it too, but a mount with no switch has only this)");
  });
}

test("the pod page hands ContentCard its language", () => {
  const text = source("app/admin/(chrome)/pod/[slug]/page.tsx");
  assert.match(text, /editLang\(/);
  assert.match(text, /langHrefs=\{/);
});

// Every file under app/ that renders <ProseEditor> or <ContentCard>, found by
// scanning rather than trusted from the hard-coded lists above — so a NEW
// mount that nobody added to EDITOR_MOUNTS (or to the pod-page test above)
// fails loudly here instead of shipping unchecked, exactly the failure class
// this file exists to catch.
const CONTENT_CARD_CALLERS = ["app/admin/(chrome)/pod/[slug]/page.tsx"];

function walkTsx(dir: string): string[] {
  let files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files = files.concat(walkTsx(full));
    else if (entry.endsWith(".tsx")) files.push(full);
  }
  return files;
}

test("every file under app/ that renders <ProseEditor> or <ContentCard> is one this file checks", () => {
  const appDir = join(process.cwd(), "app");
  const files = walkTsx(appDir).map((f) => relative(process.cwd(), f));

  for (const path of files) {
    const text = source(path);
    // A file rendering <ProseEditor> directly must be a caller ProseEditor's
    // own props can be checked on — the EDITOR_MOUNTS loop above.
    if (/<ProseEditor\b/.test(text)) {
      assert.ok(
        EDITOR_MOUNTS.includes(path),
        `${path} renders <ProseEditor> but is not in EDITOR_MOUNTS — add it so this file checks ` +
          "it goes through editorHalves, keys on lang, and hands the editor its langSwitch and lang",
      );
    }
    // A file rendering <ContentCard> instead hands ITS language down through
    // ContentCard's own props (lib/edit-lang.ts's editLang / editLangHrefs),
    // which is what the pod-page test above checks.
    if (/<ContentCard\b/.test(text)) {
      assert.ok(
        CONTENT_CARD_CALLERS.includes(path),
        `${path} renders <ContentCard> but nothing in this file checks it passes lang= and ` +
          "langHrefs= — add it to CONTENT_CARD_CALLERS and a test covering it",
      );
      assert.match(text, /\blang=\{/, `${path} renders <ContentCard> and must pass it lang=`);
      assert.match(text, /langHrefs=\{/, `${path} renders <ContentCard> and must pass it langHrefs=`);
    }
  }
});
