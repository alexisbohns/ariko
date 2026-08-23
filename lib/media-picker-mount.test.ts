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
