import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlantMark } from "@/app/admin/_components/plant-switcher";

/**
 * The scope control is an ICON — a plant's mark when one is scoped, a chevron
 * when none is. So the only place a reader (a screen reader, or anyone
 * hovering) learns what the admin's subject currently IS is that trigger's
 * accessible name.
 *
 * This is `lib/plant-hero-a11y.test.ts`'s property, one cluster over, and it
 * fails the same silent way: the name is set on the control, and the visible
 * hover label is CSS (components/chrome.tsx), so replacing `Plant: Ariko` with
 * a bare `Plant` changes nothing on screen and stops the chrome saying what it
 * is showing. Nothing else in the suite would notice — the switcher's rows,
 * its hrefs and the rail beside it would all still be right.
 *
 * `PlantSwitcher` takes `pathname` and `active` as PROPS rather than calling
 * `usePathname` / `useSearchParams`, which is what makes this test possible at
 * all: `AdminChrome` reads both once and passes them down, so the component
 * renders outside a router. No jsdom — `renderToStaticMarkup` is enough to
 * read an accessible name out of markup, and the trigger is rendered before
 * anything is opened.
 *
 * Only the CLOSED state is asserted. Base UI mounts a popover's contents on
 * open, so the rows are not in this markup; threading an `open` prop through
 * the component purely so a test could see them would be the test changing the
 * component, and the rows' destinations are `lib/admin-scope.ts`'s anyway —
 * `lib/admin-scope.test.ts` already pins every one of them.
 */

const PLANTS: PlantMark[] = [
  { slug: "ariko", name: "Ariko", visibility: "public" },
  { slug: "melogram", name: "Melogram", visibility: "private" },
];

async function render(scope: string | null): Promise<string> {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { PlantSwitcher } = await import("@/app/admin/_components/plant-switcher");
  return renderToStaticMarkup(
    React.createElement(PlantSwitcher, {
      plants: PLANTS,
      scope,
      pathname: scope ? `/admin/plant/${scope}` : "/admin",
      active: {},
    }) as never,
  );
}

test("the trigger names the scoped plant, not merely the field", async () => {
  const html = await render("ariko");
  assert.ok(html.includes("Plant: Ariko"), html);
  assert.ok(!html.includes('aria-label="Plant"'), html);
});

test("unscoped, it says so — All is a value, not an absence of one", async () => {
  const html = await render(null);
  assert.ok(html.includes("Plant: All"), html);
});

test("a scope the garden cannot resolve reads as All rather than as itself", async () => {
  // `?plant=ghost` still narrows the rows below (lib/inbox-filter.ts says why),
  // and the chrome says All because there is no such plant to name. What it
  // must never do is echo the raw slug back as though it were a plant.
  const html = await render("ghost");
  assert.ok(html.includes("Plant: All"), html);
  assert.ok(!html.includes("ghost"), html);
});

test("the closed switcher posts nothing — picking a plant is a navigation", async () => {
  const html = await render("ariko");
  assert.ok(!html.includes("<form"), html);
});
