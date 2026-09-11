import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The server render IS the script-off render: useEffect never runs, so
 * TocRail's `mounted` stays false and the island returns null. The public
 * zone's FIRST client island rests on that one fact, and this file is what
 * makes CLAUDE.md's claim about it true rather than aspirational.
 *
 * What it protects, and it is two distinct things:
 *
 *  - **Nothing at all reaches the script-off HTML.** Not a hidden div, not an
 *    empty <nav>. The claim in the spec is the strong one — the rail's absence
 *    costs nothing because every heading it indexes is already in the prose
 *    beneath it — and a server-rendered shell would quietly weaken it.
 *  - **No dead control, and no undismissable one.** The hover panel is a list
 *    of `#fragment` anchors. Server-render them "so the TOC is there on first
 *    paint" and the page grows a fixed-position list over the text that WORKS
 *    but can never be hidden, because hiding it is the hover state that needs
 *    the script. That failure mode is worse than absence — and it is exactly
 *    what the two assertions below catch, because either shape puts markup into
 *    the script-off HTML.
 *
 * What this file does NOT pin is the outer/inner split itself. The gate lives
 * in an OUTER component so no browser-only hook is ever called during a server
 * render, but what FORCES that split is React's rules of hooks: you cannot
 * early-return before a hook, so the DOM-scan useEffect cannot sit after
 * `if (!mounted) return null` in a single component. Merge them anyway and
 * these tests still pass — useEffect never runs during a server render either
 * way, so the markup is still "". React itself catches that one, at runtime,
 * by throwing on the conditional hook — and `react-hooks/rules-of-hooks`
 * (eslint.config.mjs, added with the rulebook slice) catches it statically,
 * which it could not when this comment was written. What this file catches is
 * the thing it actually asserts, which is the failure mode that matters: that
 * no markup at all reaches the script-off HTML.
 *
 * No jsdom: renderToStaticMarkup is exactly the no-DOM path being exercised,
 * and needing a DOM to run it would defeat the point.
 */

async function renderScriptOff(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

async function rail(): Promise<unknown> {
  const React = await import("react");
  const { TocRail } = await import("@/components/toc-rail");
  return React.createElement(TocRail);
}

test("the TOC rail server-renders nothing at all", async () => {
  const html = await renderScriptOff(await rail());
  assert.equal(html, "");
});

test("no navigation reaches the script-off HTML", async () => {
  const html = await renderScriptOff(await rail());
  assert.ok(!html.includes("<a"), html);
  assert.ok(!html.includes("<nav"), html);
});
