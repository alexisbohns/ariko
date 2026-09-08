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
