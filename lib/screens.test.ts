import { test } from "node:test";
import assert from "node:assert/strict";
import type { Screen } from "./data";
import {
  screenRows,
  filterScreens,
  distinctScreenPlants,
  distinctScreenBeans,
  distinctScreenTags,
  neighbours,
  screensQuery,
  screensHref,
  newScreenHref,
  activeTileCss,
  filterFieldName,
  SCREEN_FILTER_KEYS,
  type ScreenFilters,
} from "./screens";

function screen(slug: string, over: Partial<Screen> = {}): Screen {
  return {
    slug,
    name: slug,
    image: { kind: "image", storageKey: `k/${slug}`, url: `https://res.cloudinary.com/x/image/upload/v1/${slug}.png` },
    parents: ["plant:paulopus"],
    ...over,
  };
}

const SCREENS: Screen[] = [
  screen("karma-top", {
    name: { en: "Karma top", fr: "Karma haut" },
    relations: [{ kind: "cover", ref: "bean:karma-accountability" }],
    capturedAt: "2026-09-01",
    tags: ["hero"],
  }),
  screen("home-teams", { relations: [{ kind: "shows", ref: "bean:brand-voice" }], capturedAt: "2026-09-02" }),
  screen("orphan", { parents: [], capturedAt: "2026-09-02", tags: ["hero", "wip"] }),
  screen("match-hero", { parents: ["plant:melogram"], capturedAt: "2026-08-30" }),
];

test("rows resolve the name and lift the plant out of parents[]", () => {
  const rows = screenRows(SCREENS);
  const karma = rows.find((r) => r.slug === "karma-top");
  assert.equal(karma?.name, "Karma top");
  assert.equal(karma?.plant, "paulopus");
  assert.equal(rows.find((r) => r.slug === "orphan")?.plant, null);
  // The asset comes through verbatim, and a missing alt is "" rather than
  // undefined — the tile renders `alt=` unconditionally.
  assert.equal(karma?.url, "https://res.cloudinary.com/x/image/upload/v1/karma-top.png");
  assert.equal(karma?.alt, "");
});

test("the related bean comes from a shows relation", () => {
  const rows = screenRows(SCREENS);
  assert.equal(rows.find((r) => r.slug === "home-teams")?.bean, "brand-voice");
  assert.equal(rows.find((r) => r.slug === "home-teams")?.isCover, false);
});

test("a cover relation also names the bean, and marks the row", () => {
  const row = screenRows(SCREENS).find((r) => r.slug === "karma-top");
  assert.equal(row?.bean, "karma-accountability");
  assert.equal(row?.isCover, true);
});

test("a shows relation wins over a cover relation for the bean", () => {
  const rows = screenRows([
    screen("both", {
      relations: [
        { kind: "cover", ref: "bean:one" },
        { kind: "shows", ref: "bean:two" },
      ],
    }),
  ]);
  assert.equal(rows[0].bean, "two");
  assert.equal(rows[0].isCover, true);
});

test("rows sort by capturedAt descending, then slug", () => {
  assert.deepEqual(
    screenRows(SCREENS).map((r) => r.slug),
    ["home-teams", "orphan", "karma-top", "match-hero"],
  );
});

test("a screen with no capturedAt sorts last, not first", () => {
  const rows = screenRows([screen("undated"), screen("dated", { capturedAt: "2020-01-01" })]);
  assert.deepEqual(rows.map((r) => r.slug), ["dated", "undated"]);
});

test("filters by plant, bean and tag; blanks are ignored", () => {
  const rows = screenRows(SCREENS);
  assert.deepEqual(filterScreens(rows, { plant: "paulopus" }).map((r) => r.slug), [
    "home-teams",
    "karma-top",
  ]);
  assert.deepEqual(filterScreens(rows, { bean: "brand-voice" }).map((r) => r.slug), ["home-teams"]);
  assert.deepEqual(filterScreens(rows, { tag: "wip" }).map((r) => r.slug), ["orphan"]);
  assert.equal(filterScreens(rows, { plant: "  " }).length, 4);
});

test('"all" is the sentinel for no filter, not a slug', () => {
  // `screensQuery` and `filterHref` both drop the key rather than emit it, so
  // this URL arrives only by hand — which a scope control that writes ?plant=
  // into every admin URL makes ordinary. Read raw, it emptied the library
  // while the chrome above it read "All".
  const rows = screenRows(SCREENS);
  assert.equal(filterScreens(rows, { plant: "all" }).length, 4);
  assert.equal(filterScreens(rows, { bean: "all" }).length, 4);
  assert.equal(filterScreens(rows, { tag: "all" }).length, 4);
});

test("a non-blank unknown value matches nothing", () => {
  const rows = screenRows(SCREENS);
  assert.deepEqual(filterScreens(rows, { plant: "ghost" }), []);
  assert.deepEqual(filterScreens(rows, { bean: "ghost" }), []);
  assert.deepEqual(filterScreens(rows, { tag: "ghost" }), []);
});

test("filters intersect", () => {
  const rows = screenRows(SCREENS);
  assert.deepEqual(filterScreens(rows, { plant: "paulopus", tag: "hero" }).map((r) => r.slug), [
    "karma-top",
  ]);
});

test("distincts are sorted and de-duplicated", () => {
  const rows = screenRows(SCREENS);
  assert.deepEqual(distinctScreenPlants(rows), ["melogram", "paulopus"]);
  assert.deepEqual(distinctScreenBeans(rows), ["brand-voice", "karma-accountability"]);
  assert.deepEqual(distinctScreenTags(rows), ["hero", "wip"]);
});

test("neighbours walk the list as ordered, and stop at both ends", () => {
  const rows = screenRows(SCREENS); // home-teams, orphan, karma-top, match-hero
  assert.deepEqual(neighbours(rows, "orphan"), { prev: "home-teams", next: "karma-top" });
  assert.deepEqual(neighbours(rows, "home-teams"), { prev: null, next: "orphan" });
  assert.deepEqual(neighbours(rows, "match-hero"), { prev: "karma-top", next: null });
});

test("neighbours of an unknown slug are both null", () => {
  assert.deepEqual(neighbours(screenRows(SCREENS), "ghost"), { prev: null, next: null });
});

test("neighbours respect a FILTERED list", () => {
  const rows = filterScreens(screenRows(SCREENS), { plant: "paulopus" });
  assert.deepEqual(neighbours(rows, "home-teams"), { prev: null, next: "karma-top" });
});

test("screensQuery keeps the three dimensions and drops everything else", () => {
  assert.equal(screensQuery({ plant: "paulopus", error: "boom" }), "plant=paulopus");
  assert.equal(screensQuery({}), "");
});

test("screensQuery emits the keys in SCREEN_FILTER_KEYS order, not the caller's", () => {
  assert.equal(screensQuery({ tag: "hero", bean: "b", plant: "p" }), "plant=p&bean=b&tag=hero");
});

test("screensHref builds the library, a screen, and an error redirect", () => {
  assert.equal(screensHref(null, ""), "/admin/screens");
  assert.equal(screensHref(null, "plant=paulopus"), "/admin/screens?plant=paulopus");
  assert.equal(screensHref("karma-top", "plant=paulopus"), "/admin/screens/karma-top?plant=paulopus");
  assert.equal(screensHref("karma-top", "", "no image"), "/admin/screens/karma-top?error=no+image");
  assert.equal(
    screensHref("karma-top", "plant=paulopus", "no image"),
    "/admin/screens/karma-top?plant=paulopus&error=no+image",
  );
});

test("screensHref re-canonicalizes the query it is handed", () => {
  // The write forms round-trip the active filters through a hidden field, so
  // `query` can carry anything. Only the three known keys survive, in order.
  assert.equal(
    screensHref("karma-top", "error=xss&tag=hero&rogue=x&plant=paulopus"),
    "/admin/screens/karma-top?plant=paulopus&tag=hero",
  );
  assert.equal(screensHref(null, "rogue=x"), "/admin/screens");
});

test("screensHref encodes a slug", () => {
  assert.equal(screensHref("a b", ""), "/admin/screens/a%20b");
});

test("newScreenHref carries the filters onto the create page, and re-canonicalizes them", () => {
  assert.equal(newScreenHref(""), "/admin/screens/new");
  assert.equal(newScreenHref("plant=paulopus"), "/admin/screens/new?plant=paulopus");
  // Same guard as screensHref, because it is the same body: a hidden field can
  // carry anything, and only the three known keys reach the URL.
  assert.equal(
    newScreenHref("error=xss&rogue=x&tag=hero"),
    "/admin/screens/new?tag=hero",
  );
  assert.equal(
    newScreenHref("plant=paulopus", "that slug is taken: karma-top"),
    "/admin/screens/new?plant=paulopus&error=that+slug+is+taken%3A+karma-top",
  );
});

test("filterFieldName is what both sides of a round trip spell", () => {
  // The point of the function is that filter-fields.tsx and actions.ts map the
  // SAME constant through it. This pins the wire names so a rename is a
  // deliberate act rather than a silent one.
  assert.deepEqual(
    SCREEN_FILTER_KEYS.map(filterFieldName),
    ["q_plant", "q_bean", "q_tag"],
  );
});

test("activeTileCss refuses a slug that cannot be trusted in a selector", () => {
  // A stored slug came from a FILENAME. A quote closes the attribute and the
  // rest of the name writes arbitrary CSS; a space or a dot make the selector
  // mean something other than one tile. All of them lose the ring and nothing
  // else.
  for (const slug of ['a"b', "a b", "a.b", ""]) {
    assert.equal(activeTileCss(slug), null, `${JSON.stringify(slug)} was let through`);
  }
});

test("activeTileCss rings the open tile for a valid slug", () => {
  const css = activeTileCss("match-hero_m104");
  assert.equal(
    css,
    '[data-screen-tile="match-hero_m104"] > div:first-child{outline:2px solid var(--color-ring);outline-offset:2px}',
  );
});

test("filterScreens degrades a repeated query key rather than throwing", () => {
  // `?plant=a&plant=b` reaches a Next page as a string[], which ScreenFilters
  // does not admit but a URL can always produce. The `String(...)` coercion in
  // filterScreens turns it into "a,b" — a value no row can match — rather than
  // reading .trim() off an array and 500ing the page.
  const rows = screenRows(SCREENS);
  const repeated = { plant: ["paulopus", "melogram"] } as unknown as ScreenFilters;
  assert.deepEqual(filterScreens(rows, repeated), []);
});
