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
/**
 * A file's CODE — comments removed.
 *
 * Every assertion here is a substring search, and the files it searches are the
 * most heavily commented in the repo, several of them ABOUT the very things
 * being searched for. Reading the raw text, `// No <SideSheet> here: the panel
 * is the segment's layout` fails the assertion that no page draws a panel, and
 * the honest fix would be to stop writing the comment — which is the wrong way
 * round for a codebase where the comments are the spec.
 *
 * (Tailwind v4 has the same hazard from the other side: it scans source as
 * text, so a utility named inside a comment is minted into the stylesheet.
 * `app/admin/layout.tsx` carries that note.)
 *
 * Block comments go entirely. Line comments go only when the `//` starts the
 * line, so an `https://` inside an href is never mistaken for one.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const SHEET_SLOT_DIR = "app/admin/@sheet";
const SLOT = "app/admin/@sheet/(.)screens/[slug]/page.tsx";
const NEW_SLOT = "app/admin/@sheet/(.)screens/new/page.tsx";
/** The slot's route AT the library — what closes the panel. See its own test. */
const CLEAR_SLOT = "app/admin/@sheet/screens/page.tsx";
/** Where the panel itself is drawn, so the arrows never remount it. */
const SHEET_LAYOUT = "app/admin/@sheet/(.)screens/layout.tsx";
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

    // And the positive half. A page in the slot is one of exactly TWO things,
    // and the test has to admit both or it forbids the file that makes the
    // panel close: a WRAPPER around a page's own module, or a deliberate
    // NOTHING (`@sheet/screens/page.tsx`, which is what the router renders at
    // the library instead of retaining the open panel).
    //
    // What neither of those is, and what this still catches, is the shape in
    // between: a slot page that imports no page module and yet renders a panel
    // — an empty shell or a "temporary" placeholder, which passes every
    // negative check above while showing nothing the route would have shown.
    if (path.endsWith("/page.tsx")) {
      const wrapsAPage = /from "@\/app\/admin\/screens\//.test(text);
      const rendersNothing = /return null;/.test(text) && !text.includes("<SideSheet");
      assert.ok(
        wrapsAPage || rendersNothing,
        `${path} neither renders a page's own module nor deliberately renders nothing`,
      );
    }
  }
});

/**
 * The panel is the segment's LAYOUT, and that is what makes the arrows a
 * content swap.
 *
 * Next keys a route segment by its params, so with the shell inside
 * `[slug]/page.tsx` every move to the next screen unmounted the whole `<aside>`
 * and mounted another: the panel visibly left, came back, and replayed its
 * entry animation on each press of `→`. A layout sits above that boundary and
 * stays mounted while `children` changes underneath it.
 *
 * Moving the shell back down into a page is a one-line change that looks
 * tidier, breaks nothing any other test can see, and restores the flicker.
 */
test("the panel is drawn by the layout, never by a page in the slot", () => {
  assert.match(source(SHEET_LAYOUT), /<SideSheet>/, "the slot's layout must draw the panel");

  for (const path of slotFiles()) {
    if (path === SHEET_LAYOUT) continue;
    assert.equal(
      source(path).includes("<SideSheet"),
      false,
      `${path} draws its own panel — the arrows will remount it`,
    );
  }
});

/**
 * The file that makes the panel close, pinned because nothing about it looks
 * load-bearing.
 *
 * A page component returning `null` reads as dead code, and the obvious tidy —
 * "`default.tsx` already returns null, this is redundant" — silently restores
 * the bug: on a SOFT navigation Next keeps a slot's previously active state and
 * only falls back to `default.tsx` when it cannot resolve the slot at all. With
 * no route matching `/admin/screens` in this slot, pressing Close changed the
 * URL and left the sheet sitting open over the grid.
 *
 * There is no unit test that can catch that — it is router behaviour in a
 * browser — so the existence of the file is the thing to hold.
 */
test("the slot has a route at the library itself, or the panel never closes", () => {
  const text = source(CLEAR_SLOT);
  assert.match(text, /return null;/, `${CLEAR_SLOT} must render nothing`);
  assert.equal(text.includes("<SideSheet"), false, `${CLEAR_SLOT} must not render a panel`);
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
