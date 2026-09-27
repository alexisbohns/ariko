import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ExhibitionRow } from "@/lib/exhibition";

/**
 * The server render IS the script-off render: useEffect never runs, so
 * ScreenLightbox's `mounted` stays false and the island returns null. The
 * public zone's third client island rests on that one fact, exactly as the
 * first does (lib/toc-mount.test.ts, whose docblock this file inherits).
 *
 * What it protects is the island's whole admissibility. Every screen is
 * already a real anchor to its full image, server-rendered by
 * components/screen-strip.tsx; the lightbox INTERCEPTS those clicks. So its
 * absence costs nothing, and the claim stays true only while:
 *
 *  - **Nothing reaches the script-off HTML.** Not a hidden dialog, not a
 *    pre-rendered image. A server-rendered overlay would be a second copy of
 *    every screen in the markup, and a closed one that could never open.
 *  - **The island supplies no destination.** Its source holds no `href`: the
 *    destinations are the gallery's. The day it grows one, a visitor without
 *    script loses something the island made them depend on.
 *  - **It reads the anchors by the strip's own constant.** The other half of
 *    that contract is in components/screen-strip.test.tsx.
 *
 * No jsdom: renderToStaticMarkup is exactly the no-DOM path being exercised.
 */

const rows: ExhibitionRow[] = [
  {
    slug: "one",
    name: "One",
    legend: "The first screen",
    image: {
      kind: "image",
      storageKey: "k/one",
      url: "https://res.cloudinary.com/demo/image/upload/v1/one.png",
      width: 1179,
      height: 2556,
    },
  },
];

async function renderScriptOff(): Promise<string> {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ScreenLightbox } = await import("@/app/(public)/_components/screen-lightbox");
  return renderToStaticMarkup(React.createElement(ScreenLightbox, { rows, plantName: "Paulopus" }));
}

// COMMENT-STRIPPED, as lib/pwa-source.test.ts does and for its reason: the
// docblock is obliged to talk about the anchors' `href`, and a check that
// matched prose would fail on the explanation rather than on the code.
const SOURCE = readFileSync(
  join(process.cwd(), "app/(public)/_components/screen-lightbox.tsx"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

test("the lightbox server-renders nothing at all", async () => {
  assert.equal(await renderScriptOff(), "");
});

test("no image and no dialog reach the script-off HTML", async () => {
  const html = await renderScriptOff();
  assert.ok(!html.includes("<img"), html);
  assert.ok(!html.includes("dialog"), html);
});

test("the island supplies no destination of its own", () => {
  // Behaviour, never destinations: the anchors are the gallery's.
  assert.ok(!/\bhref\b/.test(SOURCE), "screen-lightbox.tsx must not render an href");
  assert.ok(!/from\s+["']next\/link["']/.test(SOURCE), "screen-lightbox.tsx must not link");
});

test("the island finds the anchors by the strip's shared constant", () => {
  assert.match(SOURCE, /import\s*{[^}]*\bSCREEN_ANCHOR_ATTR\b[^}]*}\s*from\s*["']@\/lib\/screen-lightbox["']/);
  assert.ok(!/["']data-screen["']/.test(SOURCE), "spell the attribute through SCREEN_ANCHOR_ATTR, never as a literal");
});
