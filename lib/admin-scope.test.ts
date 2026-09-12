import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navItems, resolveNavItem, type NavId } from "./admin-nav";
import { plantFilterGroup, resolveScope, scopeHref, scopeKeysFor } from "./admin-scope";
import type { FilterValues } from "./admin-filters";

function parseHref(href: string): { pathname: string; active: FilterValues } {
  const [pathname, query = ""] = href.split("?");
  const active: FilterValues = {};
  for (const [key, value] of new URLSearchParams(query)) active[key] = value;
  return { pathname, active };
}

test("the hub's own slug is the scope", () => {
  assert.equal(resolveScope("/admin/plant/ariko", {}), "ariko");
  assert.equal(resolveScope("/admin/plant/ariko/", {}), "ariko");
});

test("an encoded slug comes back decoded", () => {
  assert.equal(resolveScope("/admin/plant/a%20b", {}), "a b");
});

test("elsewhere the scope is the query", () => {
  assert.equal(resolveScope("/admin/sprouts", { plant: "pebbles" }), "pebbles");
  assert.equal(resolveScope("/admin/screens", { plant: "  " }), null);
  assert.equal(resolveScope("/admin/screens", {}), null);
});

test("the path wins over a contradicting query", () => {
  assert.equal(resolveScope("/admin/plant/ariko", { plant: "pebbles" }), "ariko");
});

test("a repeated query key cannot become a scope", () => {
  // ?plant=a&plant=b reaches a page as string[]. It must narrow to nothing
  // rather than stringify into "a,b" — unlike filterQuery, which keeps that
  // string on purpose so it matches nothing rather than throws.
  assert.equal(resolveScope("/admin/sprouts", { plant: ["a", "b"] as unknown as string }), null);
});

test("a stray ?plant=all is not a scope named all — it is filterQuery's own sentinel for none", () => {
  assert.equal(resolveScope("/admin/pods", { plant: "all" }), null);
});

test("a malformed escape in a hub path is not a slug", () => {
  assert.equal(resolveScope("/admin/plant/a%ZZ", {}), null);
});

test("a hub child path names the same plant resolveNavItem lights", () => {
  const path = "/admin/plant/ariko/settings";
  assert.equal(resolveScope(path, {}), "ariko");
  assert.equal(resolveNavItem(path), "/admin/plant/ariko");
});

test("a filtering section keeps its other dimensions", () => {
  assert.equal(
    scopeHref("/admin/sprouts", { state: "draft", tag: "wip" }, "pebbles"),
    "/admin/sprouts?state=draft&plant=pebbles&tag=wip",
  );
});

test("All drops the key and keeps the section", () => {
  assert.equal(scopeHref("/admin/sprouts", { state: "draft", plant: "x" }, null), "/admin/sprouts?state=draft");
  assert.equal(scopeHref("/admin/screens", { plant: "x" }, null), "/admin/screens");
});

test("from the root, picking a plant opens its hub", () => {
  assert.equal(scopeHref("/admin", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin", {}, null), "/admin");
});

test("from a hub, switching goes to the other hub and All comes home", () => {
  assert.equal(scopeHref("/admin/plant/ariko", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin/plant/ariko", {}, null), "/admin");
});

test("an unrecognised route is treated as unfilterable, not as a section", () => {
  // A detail page has no filter dimensions to preserve, so switching from one
  // takes you to the plant rather than pinning a query onto a page that would
  // ignore it.
  assert.equal(scopeHref("/admin/bean/abc", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin/bean/abc", {}, null), "/admin");
});

test("a slug with URL syntax survives every href", () => {
  assert.equal(scopeHref("/admin", {}, "a b/c"), "/admin/plant/a%20b%2Fc");
  assert.equal(scopeHref("/admin/pods", {}, "a b"), "/admin/pods?plant=a+b");
});

test("scopeHref then resolveScope recovers the slug it was given, plain, spaced, or slashed", () => {
  for (const slug of ["ariko", "a b", "a b/c"]) {
    for (const path of ["/admin/pods", "/admin", "/admin/plant/other-plant"]) {
      const href = scopeHref(path, {}, slug);
      const { pathname, active } = parseHref(href);
      assert.equal(resolveScope(pathname, active), slug, `${path} -> ${href}`);
    }
  }
});

test("every filtering section names its keys, and plant is one of them", () => {
  for (const item of NAV_ITEMS) {
    const keys = scopeKeysFor(item.href);
    if (item.id === "beanstalk") continue;
    assert.ok(keys?.includes("plant"), item.id);
  }
});

test("a hub page and an unrecognised route admit no filter dimensions", () => {
  assert.equal(scopeKeysFor("/admin/plant/ariko"), undefined);
  assert.equal(scopeKeysFor("/admin/bean/abc"), undefined);
  assert.equal(scopeKeysFor("/admin"), undefined);
});

test("every NavId the rail can render is either scopable with a key list, or explicitly unscopable", () => {
  const everyId = new Set<NavId>([...NAV_ITEMS, ...navItems("any-plant")].map((i) => i.id));
  for (const id of everyId) {
    if (id === "overview" || id === "beanstalk") continue; // explicitly unscopable
    const item = NAV_ITEMS.find((i) => i.id === id);
    assert.ok(item, id);
    assert.ok(scopeKeysFor(item!.href)?.includes("plant"), id);
  }
});

test("plantFilterGroup puts All first, then the slugs deduped and sorted", () => {
  const group = plantFilterGroup("/admin/pods", {}, ["pbbls", "ariko", "pbbls"], null);
  assert.deepEqual(group.options, ["all", "ariko", "pbbls"]);
  assert.equal(group.key, "plant");
  assert.equal(group.current, "all");
  assert.deepEqual(group.hrefs, ["/admin/pods", "/admin/pods?plant=ariko", "/admin/pods?plant=pbbls"]);
});

test("plantFilterGroup's current is the resolved scope, never the raw query", () => {
  // `?plant=all` and a repeated `?plant=` are both "no filter" to resolveScope,
  // and a trigger reading either back as a filter is the chrome contradicting
  // the page — so the page hands the SCOPE down and this only spells it.
  for (const raw of ["all", "", undefined]) {
    const active = { plant: raw };
    const scope = resolveScope("/admin/pods", active);
    assert.equal(plantFilterGroup("/admin/pods", active, ["ariko"], scope).current, "all", String(raw));
  }
  assert.equal(
    plantFilterGroup("/admin/pods", { plant: "ariko" }, ["ariko"], resolveScope("/admin/pods", { plant: "ariko" })).current,
    "ariko",
  );
});

test("plantFilterGroup preserves the route's other dimensions and drops the ones it does not own", () => {
  // /admin/beans declares ["plant", "pod"]; ?error= belongs to no dimension.
  const group = plantFilterGroup(
    "/admin/beans",
    { pod: "tooling", error: "boom" },
    ["ariko"],
    null,
  );
  assert.deepEqual(group.hrefs, ["/admin/beans?pod=tooling", "/admin/beans?plant=ariko&pod=tooling"]);
});

test("plantFilterGroup on a route with no dimensions builds bare hrefs rather than throwing", () => {
  // scopeKeysFor returns undefined for a hub or an unrecognised path; the `?? []`
  // lives in one place now, so a renamed section degrades to unfiltered links
  // instead of "keys is not iterable" inside filterQuery.
  const group = plantFilterGroup("/admin/podz", { plant: "ariko" }, ["ariko"], "ariko");
  assert.deepEqual(group.hrefs, ["/admin/podz", "/admin/podz"]);
});
