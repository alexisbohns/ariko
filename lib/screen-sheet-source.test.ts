import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The claim the screen library rests on, enforced rather than written down.
 *
 * The side sheet costs no entry on CLAUDE.md's exception list for exactly one
 * reason: **nothing in it exists that is not also a page.** The slot imports
 * the route's own module and wraps it; the tiles are links with real hrefs. So
 * script-off, a click on a tile is an ordinary navigation to the same editors,
 * and the panel's absence costs nothing.
 *
 * Both ways of breaking that are silent. Reimplement the panel's body in the
 * slot "just to tweak the spacing" and the two drift until the no-script page
 * is missing a form nobody noticed. Turn a tile into a <button onClick> to get
 * a nicer transition and the library becomes script-only outright. Neither is a
 * type error, neither fails a render test, and `npm run build` is happy with
 * both — the admin has script, so nobody would see it.
 *
 * Source text rather than a render, for `lib/server-safe-source.test.ts`'s
 * reason: "renders the same module" is a fact about the import graph, and
 * `renderToStaticMarkup` cannot see it.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const SHEET_SLOT_DIR = "app/admin/@sheet";
const SLOT = "app/admin/@sheet/(.)screens/[slug]/page.tsx";
const NEW_SLOT = "app/admin/@sheet/(.)screens/new/page.tsx";
const INDEX = "app/admin/screens/page.tsx";

/**
 * Every `.tsx` under the slot, found rather than listed.
 *
 * The list would be the two pages, and the guard below is aimed at a file that
 * does not exist yet — the reimplemented body someone adds "just to tweak the
 * spacing". A list would not cover it on the day it was written, which is the
 * only day that matters. Walking the directory covers whatever the slot grows.
 */
function slotFiles(dir = SHEET_SLOT_DIR): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? slotFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

test("the sheet renders the screen page's own module", () => {
  const text = source(SLOT);
  assert.match(text, /from "@\/app\/admin\/screens\/\[slug\]\/page"/);
  assert.match(text, /<ScreenPage /);
});

test("the sheet renders the create page's own module", () => {
  const text = source(NEW_SLOT);
  assert.match(text, /from "@\/app\/admin\/screens\/new\/page"/);
  assert.match(text, /<NewScreenPage /);
});

test("no slot file rebuilds a form of its own", () => {
  const files = slotFiles();

  // A sanity check on the walk itself: an empty list would pass the loop below
  // while asserting nothing, and a rename of the slot directory is exactly the
  // sort of change that would empty it.
  assert.ok(files.includes(SLOT), `the walk missed ${SLOT}`);
  assert.ok(files.includes(NEW_SLOT), `the walk missed ${NEW_SLOT}`);

  // `not-found.tsx` and `default.tsx` are in this list and belong in it. They
  // are boundaries — the shell plus a sentence, and nothing at all — so they
  // hold the rule for free; a form appearing in either would be the same drift
  // as a form appearing in a page slot.
  for (const path of files) {
    const text = source(path);
    assert.equal(text.includes("<form"), false, `${path} renders its own form`);
    assert.equal(text.includes("Action"), false, `${path} reaches a server action`);

    // The two above catch a HAND-WRITTEN form in the slot. They do not catch
    // the likelier drift by a distance: composing the editors the page already
    // has — `import { ScreenMetaForm } from "../../../_components/screen-meta-form"`
    // and render it — which is the path of least resistance and which contains
    // neither `<form` nor `Action`. A slot built that way looks right, renders
    // right, and is a second implementation of the panel's body that the
    // standalone page's changes will not reach.
    assert.equal(
      /_components\/screen-\w+-form/.test(text),
      false,
      `${path} composes the editors instead of importing the page`,
    );

    // And the positive half: a page in the slot must RENDER A PAGE. Without
    // this, a slot file that imports nothing at all — an empty shell, a
    // "temporary" placeholder — passes every negative check above while the
    // panel shows nothing the route would have shown.
    if (path.endsWith("/page.tsx")) {
      assert.match(
        text,
        /from "@\/app\/admin\/screens\//,
        `${path} does not render a page's own module`,
      );
    }
  }
});

test("the library's tiles navigate by href, not by a click handler", () => {
  const text = source(INDEX);
  assert.match(text, /data-screen-tile=/);
  assert.equal(text.includes("onClick"), false, "a tile that is a button is a script-only library");
});

test("the tiles are links, and the page is not a client component", () => {
  const text = source(INDEX);
  assert.match(text, /from "next\/link"/);
  assert.equal(text.includes('"use client"'), false);
});
