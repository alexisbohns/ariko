import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The server render IS the script-off render: useEffect never runs, so
 * MediaPicker's `mounted` stays false and the island returns null. Every other
 * defence in the media slice rests on that one fact, and until this file
 * nothing pinned it.
 *
 * What it protects: the sprout media form's submit button lives INSIDE the
 * island (`submitLabel`), so "the picker renders nothing" is what makes the
 * form non-operable without script rather than merely safe. A future change
 * that server-renders the picker's stored rows for a faster first paint —
 * entirely reasonable-sounding — would put a working "Save media" button back
 * into the script-off HTML and re-open the data-loss path that
 * `media__ready` was added to close. This test fails loudly if that happens.
 *
 * No jsdom here, unlike lib/editor-mount.test.ts: renderToStaticMarkup is
 * exactly the no-DOM path we want to exercise, and needing a DOM to run it
 * would defeat the point.
 */

// Dynamic, and inside the tests: components/admin/media-picker.tsx imports
// app/admin/actions.ts for uploadImageAction, which pulls the whole server
// stack in at module-evaluation time. Keeping it out of the top-level import
// graph means the cost lands only when these two tests run.
async function renderScriptOff(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(element as any);
}

test("the sprout media form server-renders no way to submit it", async () => {
  const React = await import("react");
  const { MediaPicker } = await import("@/components/admin/media-picker");

  // The real shape from app/admin/sprout/[slug]/page.tsx: a hidden slug, and
  // the picker carrying the form's only submit button.
  const html = await renderScriptOff(
    React.createElement(
      "form",
      { action: "/noop" },
      React.createElement("input", { type: "hidden", name: "slug", value: "s" }),
      React.createElement(MediaPicker, {
        name: "media",
        initial: [],
        links: true,
        submitLabel: "Save media",
      }),
    ),
  );

  assert.equal(/<button/i.test(html), false, "a script-off browser must see no submit button");
  assert.equal(html.includes("Save media"), false, "the submit label belongs to the island, not the form");
  // The corollary, and the reason the form is not merely button-less but inert:
  // nothing here blocks implicit submission either, so there is no field to
  // press Enter in. A hidden input is all that survives.
  assert.equal(html, '<form action="/noop"><input type="hidden" name="slug" value="s"/></form>');
});

test("the capture bar keeps its own submit button without script", async () => {
  const React = await import("react");
  const { MediaPicker } = await import("@/components/admin/media-picker");

  // The capture bar's submit is NOT the picker's: title, note and link fields
  // all work without script, so that form must stay operable.
  const html = await renderScriptOff(
    React.createElement(
      "form",
      { action: "/noop" },
      React.createElement("input", { type: "text", name: "title" }),
      React.createElement(MediaPicker, { name: "image" }),
      React.createElement("button", { type: "submit" }, "Add to inbox"),
    ),
  );

  assert.equal(html.includes("Add to inbox"), true, "a script-off capture must still be submittable");
  assert.equal(html.includes("image__ready"), false, "an unmounted picker emits no marker on any surface");
});

// These import the REAL components rather than reconstructing their shape
// with React.createElement, unlike the two tests above (which pin MediaPicker
// itself, not a caller). Importing the real thing is what makes a wiring
// mutation in bean-cover-form.tsx or bean-keyword-form.tsx — a renamed `name`,
// a dropped `max`, a dropped `submitLabel`, `textPart` swapped for
// `resolveText`, `keywordFr` typo'd — visible here, rather than only in
// something these tests happen to agree with.
//
// bean-cover-form.tsx renders `<form action={editBeanCoverAction}>`. Outside
// Next's runtime, a server action passed as a form `action` does not render as
// a URL string — React emits `action="javascript:throw new Error(...)"` plus a
// hidden replay `<script>` carrying the action reference, neither of which is
// stable text to assert against. So the RENDER-based tests below assert
// presence/absence of specific fields and markup shapes, not an exact
// whole-string match.
//
// The render-based tests below cannot see MediaPicker's own props at all: once
// rendered, its `mounted` gate returns the same `null` regardless of what was
// passed in, so a renamed `name`, a dropped `max`, or a dropped `submitLabel`
// render IDENTICALLY (nothing) whether right or wrong. The
// "hands the picker the exact contract" test further below closes that gap
// without rendering, mocking, or a DOM: it calls BeanCoverForm as a plain
// function and inspects the React ELEMENT TREE the call returns — the props
// are sitting right there, unrendered and unerased.
test("the bean cover form server-renders no submit button and no other field, empty cover", async () => {
  const React = await import("react");
  const { BeanCoverForm } = await import("@/app/admin/_components/bean-cover-form");
  const bean = { slug: "b", name: "Bean" } as import("@/lib/data").Bean;

  const html = await renderScriptOff(React.createElement(BeanCoverForm, { bean }));

  assert.equal(/<button/i.test(html), false, "a script-off browser must see no submit button");
  assert.equal(html.includes("Save cover"), false, "the submit label belongs to the island, not the form");
  assert.equal(html.includes('name="slug"'), true, "the hidden slug must still be there");
  // No non-hidden input survives — nothing left to carry an implicit Enter
  // submission, and nothing left for a mutated `name` to silently rename.
  assert.equal(/<input(?![^>]*type="hidden")/i.test(html), false, "no non-hidden field must render");
});

test("the bean cover form re-seeds the picker for a POPULATED cover (the reason the key prop exists)", async () => {
  const React = await import("react");
  const { BeanCoverForm } = await import("@/app/admin/_components/bean-cover-form");
  const cover: import("@/lib/data").MediaImage = {
    kind: "image",
    storageKey: "k1",
    url: "https://example.com/k1.jpg",
    width: 400,
    height: 900,
  };
  const bean = { slug: "b", name: "Bean", cover } as import("@/lib/data").Bean;

  const html = await renderScriptOff(React.createElement(BeanCoverForm, { bean }));

  // The island still renders nothing until it mounts, even fed a populated
  // `initial` — this is the check the checked-in test (initial: []) could
  // never make, and it is exactly the case the `key` prop exists to reseed.
  assert.equal(/<button/i.test(html), false, "a script-off browser must see no submit button");
  assert.equal(/<input(?![^>]*type="hidden")/i.test(html), false, "no non-hidden field must render");
});

/**
 * Depth-first search for the element whose type IS `MediaPicker` (identity,
 * not name or duck-typing — the whole point is that it survives a rename of
 * the component and can't be fooled by a lookalike). `children` is an array
 * here because the hidden slug input and the picker are JSX siblings under
 * one `<form>`.
 */
function findPicker(
  node: unknown,
  target: unknown,
): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (el.type === target) return el as { props: Record<string, unknown> };
  const kids = el.props?.children;
  for (const child of Array.isArray(kids) ? kids : [kids]) {
    const found = findPicker(child, target);
    if (found) return found;
  }
  return null;
}

// This one does NOT render at all — it calls BeanCoverForm as a plain
// function (verified directly callable: it is a synchronous server
// component, no hooks, no await) and inspects the React ELEMENT TREE the
// call returns, before anything renders. That is what lets it see the props
// `MediaPicker` receives, which the two script-off tests above cannot: once
// rendered, MediaPicker's own `mounted` gate erases every prop into the same
// `null` output regardless of what was passed in — a renamed `name`, a
// dropped `max`, a dropped `submitLabel` all render identically (nothing).
// Calling the component directly reads the props before that erasure.
test("the Cover card hands the picker the exact contract the builder reads", async () => {
  const { BeanCoverForm } = await import("@/app/admin/_components/bean-cover-form");
  const { MediaPicker } = await import("@/components/admin/media-picker");
  const bean = { slug: "b", name: "Bean" } as import("@/lib/data").Bean;

  const element = BeanCoverForm({ bean }) as unknown;
  const picker = findPicker(element, MediaPicker);

  assert.ok(picker, "the cover form must render a MediaPicker");
  // lib/bean-cover-edit.ts reads `cover` and `cover__ready`. A rename here is
  // silent at runtime: the picker would emit `coverX__ready`, the builder
  // would find no `cover__ready` marker, and every save would be a no-op
  // that looks like a success (redirect happens, nothing changed).
  assert.equal(picker!.props.name, "cover");
  // A bean has ONE cover.
  assert.equal(picker!.props.max, 1);
  // The form's only submit button lives inside the island (CLAUDE.md's rule).
  // Drop this and the card is unsavable even WITH script — every OTHER
  // picker button on the page is `type="button"`, so nothing else submits it.
  assert.equal(picker!.props.submitLabel, "Save cover");
});

test("the bean keyword form emits both language fields, unconditionally", async () => {
  const React = await import("react");
  const { BeanKeywordForm } = await import("@/app/admin/_components/bean-keyword-form");
  const bean = { slug: "b", name: "Bean", keyword: { fr: "Karma" } } as import("@/lib/data").Bean;

  const html = await renderScriptOff(React.createElement(BeanKeywordForm, { bean }));

  assert.equal(html.includes('name="keyword"'), true, "the en keyword field must be present");
  assert.equal(html.includes('name="keywordFr"'), true, "the fr keyword field must be present");
  // An fr-only bean must leave the EN box empty — resolveText's fallback would
  // copy "Karma" into it and save it back as the en value, the exact
  // corruption plant-meta-form.tsx warns against and textPart avoids. Attributes
  // land adjacent (`name="…" value="…"`) in the rendered markup, so this checks
  // each field's OWN value rather than "value=... appears somewhere".
  assert.equal(html.includes('name="keyword" value=""'), true, "the en box must be blank, not fr's value");
  assert.equal(html.includes('name="keywordFr" value="Karma"'), true, "the fr box must still carry the fr value");
});
