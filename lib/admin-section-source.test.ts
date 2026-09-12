import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Facts about admin pages that nothing else can see.
 *
 * Both are the failure class CLAUDE.md's rules section names: a change that
 * reads as a tidy-up, passes `tsc`, `npm test` and `npm run build`, and leaves
 * the page rendering something plausible while the property it rested on is
 * gone. Source text rather than a render, for `lib/server-safe-source.test.ts`'s
 * reason — "this page hands THAT value to that component" is a property of the
 * file AS WRITTEN, and no `renderToStaticMarkup` can distinguish two numbers
 * that agree on the day the test runs.
 *
 *  - **The inbox hands `SeedOverlay` the UNFILTERED total.** That count is the
 *    overlay's only signal that a save landed: `createSeedAction` redirects to
 *    the page the overlay is rendered on, the navigation is soft, the component
 *    keeps its state, and one more seed than it last saw is what closes it.
 *    `inboxCount={visible.length}` is the obvious-looking edit — the page
 *    already has `visible`, and the heading beside it counts the narrowed set —
 *    and it breaks nothing visible until a scope is active: a capture whose
 *    suggestion falls outside the current plant leaves the narrowed count
 *    unchanged, and the overlay sits open over a seed that was in fact saved.
 *    Both halves are pinned, because `total` could equally be redefined as the
 *    filtered length while the JSX stayed as it is.
 *
 *  - **`/admin/beans` narrows through `beansForPlantDeep`.** A plant's beans
 *    are its direct ones PLUS every one of its pods', and `lib/plant-hub.ts`
 *    exists so that the section and a plant hub's preview report that union
 *    from ONE function rather than from two pieces of arithmetic that agree
 *    today. Narrowing on the row's own `plant` mark instead — which the page
 *    already computes, for a column — looks simpler and is a hub that says 4
 *    over a section that shows 11.
 *
 *  - **The plant's narrative is read STRICTLY, in both places that read it.**
 *    The editor lives on `plant/[slug]/narrative` and the hub draws an excerpt
 *    of the same field. `resolveText` falls back to the other language when the
 *    asked-for half is empty, and either side reaching for it is a quiet,
 *    plausible-looking edit: on the hub it renders a French excerpt over a hub
 *    that claims the English narrative is written, and in the EDITOR it loads
 *    the French half into a field whose next save writes it back as English —
 *    a data-loss bug one keystroke deep. `textPart(plant.content, "en")` is the
 *    read both must make, and the excerpt must be derived from that same call
 *    rather than from a second read of the field.
 */

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const INBOX = "app/admin/(chrome)/inbox/page.tsx";
const BEANS = "app/admin/(chrome)/beans/page.tsx";
const HUB = "app/admin/(chrome)/plant/[slug]/page.tsx";
const NARRATIVE = "app/admin/(chrome)/plant/[slug]/narrative/page.tsx";

test(`${INBOX} hands SeedOverlay the unfiltered seed total`, () => {
  const text = source(INBOX);
  assert.match(
    text,
    /const\s+total\s*=\s*seeds\?\.length\s*\?\?\s*0\s*;/,
    `${INBOX} must define \`total\` as the UNFILTERED seed count — it is the ` +
      `overlay's only evidence that a save landed`,
  );
  assert.match(
    text,
    /inboxCount=\{total\}/,
    `${INBOX} must pass \`total\` to SeedOverlay, never the narrowed count: ` +
      `a capture outside the active scope would leave the count unchanged and ` +
      `the overlay open over a seed that was saved`,
  );
});

test(`${BEANS} narrows the plant dimension through beansForPlantDeep`, () => {
  const text = source(BEANS);
  assert.match(
    text,
    /import\s*\{[^}]*\bbeansForPlantDeep\b[^}]*\}\s*from\s*["']@\/lib\/plant-hub["']/,
    `${BEANS} must import beansForPlantDeep from lib/plant-hub`,
  );
  assert.match(
    text,
    /beansForPlantDeep\(\s*dataset\s*,\s*scope\s*\)/,
    `${BEANS} must build its scoped set from beansForPlantDeep(dataset, scope) ` +
      `— the one function a plant hub's bean preview counts with, so the two ` +
      `cannot report different numbers for the same plant`,
  );
});

test(`${NARRATIVE} loads the plant's own English narrative into the editor`, () => {
  const text = source(NARRATIVE);
  assert.match(
    text,
    /initialMarkdown=\{textPart\(plant\.content,\s*"en"\)\}/,
    `${NARRATIVE} must load the editor with the STRICT en textPart: resolveText ` +
      `falls back to the fr half, and the next save writes it back as en`,
  );
  assert.match(
    text,
    /hidden=\{\{\s*ref:\s*`plant:\$\{plant\.slug\}`\s*\}\}/,
    `${NARRATIVE} must post the ref \`plant:<slug>\` — editContainerContentAction ` +
      `reads the tier off the ref, and it is the only thing telling it which ` +
      `collection to write`,
  );
});

test(`${HUB} previews the same read the narrative editor loads`, () => {
  const text = source(HUB);
  assert.match(
    text,
    /const\s+excerpt\s*=\s*narrativeExcerpt\(textPart\(plant\.content,\s*"en"\)\)\s*;/,
    `${HUB} must derive the excerpt from the STRICT en textPart — the same read ` +
      `${NARRATIVE} loads into the editor`,
  );
  assert.match(
    text,
    /<NarrativePreview\s+excerpt=\{excerpt\}/,
    `${HUB} must hand NarrativePreview that same \`excerpt\`, not a second read ` +
      `of the field`,
  );
  assert.doesNotMatch(
    text,
    /\bProseEditor\b/,
    `${HUB} must not render the prose editor: the narrative has a page of its ` +
      `own (${NARRATIVE}), and two editors over one field is two answers to ` +
      `"what is stored"`,
  );
});

test("a plant's narrative save returns to the page that edits it", () => {
  const text = source("app/admin/actions.ts");
  assert.match(
    text,
    /const\s+back\s*=\s*isPlant\s*\?\s*narrativeHref\(slug\)\s*:/,
    `editContainerContentAction must send a PLANT back to narrativeHref(slug): ` +
      `the hub no longer holds the editor, so both the save and the error ` +
      `redirect would land on a page with no field to show and no banner to ` +
      `put the message in`,
  );
});
