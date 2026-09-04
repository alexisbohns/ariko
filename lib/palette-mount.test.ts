import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The server render IS the script-off render: useEffect never runs, so
 * CommandPalette's `mounted` stays false and the island returns null. The
 * fourth-exception paragraph in CLAUDE.md rests on that one fact, and until
 * this file nothing pinned it.
 *
 * What it protects, and it is two distinct things:
 *
 *  - **No dead control.** The palette's trigger is a `<button>`, not a link. A
 *    future change that server-rendered it "so the search icon is there on
 *    first paint" would put a pressable button into the script-off HTML that
 *    does exactly nothing when pressed — the one failure mode the "its absence
 *    costs nothing" claim forbids. The current claim is stronger and simpler:
 *    the button is not there at all.
 *  - **No router on a path that has no router.** The gate lives in an OUTER
 *    component so `useRouter()` is never called during a server render. Move
 *    the gate inside and this test fails loudly rather than at request time.
 *
 * No jsdom, unlike lib/editor-mount.test.ts: renderToStaticMarkup is exactly
 * the no-DOM path being exercised, and needing a DOM to run it would defeat
 * the point.
 */

async function renderScriptOff(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(element as any);
}

// Dynamic, and inside the tests: the palette pulls in the Base UI autocomplete
// and dialog trees at module-evaluation time. Keeping it out of the top-level
// import graph means the cost lands only when these tests run.
async function palette(): Promise<unknown> {
  const React = await import("react");
  const { CommandPalette } = await import("@/app/admin/_components/command-palette");
  return React.createElement(CommandPalette);
}

test("the palette server-renders nothing at all", async () => {
  const html = await renderScriptOff(await palette());
  assert.equal(html, "");
});

test("no search trigger reaches the script-off HTML", async () => {
  const html = await renderScriptOff(await palette());
  assert.ok(!html.includes("<button"), html);
  assert.ok(!/Search/i.test(html), html);
});
