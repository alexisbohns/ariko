import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bean, Plant, Pod, RawGarden, Seed, Sprout } from "./data";
import { buildGardenMap, mapViewOf, type GardenMap, type MapNode } from "./garden-map";

// ---- fixtures: a factory per species, defaults chosen to be "complete" so a
// test names only the one thing it makes wrong. -----------------------------

function plant(slug: string, over: Partial<Plant> = {}): Plant {
  return {
    slug,
    name: slug.toUpperCase(),
    natures: ["work"],
    role: { kind: "owner" },
    description: "d",
    content: { en: "Story", fr: "Histoire" },
    visibility: "public",
    ...over,
  };
}
function pod(slug: string, parents: string[], over: Partial<Pod> = {}): Pod {
  return {
    slug,
    name: slug,
    parents,
    description: "d",
    content: { en: "Story", fr: "Histoire" },
    visibility: "public",
    ...over,
  };
}
function bean(slug: string, parents: string[], over: Partial<Bean> = {}): Bean {
  return {
    slug,
    name: slug,
    parents,
    content: { en: "Story", fr: "Histoire" },
    visibility: "public",
    ...over,
  };
}
function sprout(slug: string, over: Partial<Sprout> = {}): Sprout {
  return {
    slug,
    name: slug,
    kind: "log",
    date: "2026-11-01",
    description: "d",
    state: "draft",
    ...over,
  };
}
function seed(id: string, over: Partial<Seed> = {}): Seed {
  return {
    id,
    title: `Seed ${id}`,
    media: [],
    source: { kind: "manual" },
    status: "inbox",
    promotedTo: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

function node(map: GardenMap, id: string): MapNode {
  const found = map.nodes.find((n) => n.id === id);
  assert.ok(found, `node ${id} should exist`);
  return found;
}
function hasEdge(map: GardenMap, source: string, target: string): boolean {
  return map.edges.some((e) => e.source === source && e.target === target);
}

// A complete little garden: nothing waits, nothing is missing.
function tidy(): RawGarden {
  return {
    plants: [plant("ariko")],
    pods: [pod("core", ["plant:ariko"])],
    beans: [bean("editor", ["pod:core"])],
    sprouts: [sprout("shipped", { state: "published", about: ["bean:editor"] })],
  };
}

// ---- structure -------------------------------------------------------------

test("plants, pods and beans are nodes joined by containment edges", () => {
  const map = buildGardenMap(tidy(), []);
  assert.deepEqual(
    map.nodes.map((n) => n.id),
    ["plant:ariko", "pod:core", "bean:editor"],
  );
  assert.ok(hasEdge(map, "plant:ariko", "pod:core"));
  assert.ok(hasEdge(map, "pod:core", "bean:editor"));
});

test("a bean that skips the pod hangs off its plant", () => {
  const raw: RawGarden = { plants: [plant("ariko")], beans: [bean("loose", ["plant:ariko"])] };
  const map = buildGardenMap(raw, []);
  assert.ok(hasEdge(map, "plant:ariko", "bean:loose"));
});

test("a bean with two pods is one node with an edge from each", () => {
  const raw: RawGarden = {
    plants: [plant("ariko")],
    pods: [pod("a", ["plant:ariko"]), pod("b", ["plant:ariko"])],
    beans: [bean("shared", ["pod:a", "pod:b"])],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(map.nodes.filter((n) => n.id === "bean:shared").length, 1);
  assert.ok(hasEdge(map, "pod:a", "bean:shared"));
  assert.ok(hasEdge(map, "pod:b", "bean:shared"));
});

test("node hrefs are the admin pages, encoded", () => {
  const raw: RawGarden = {
    plants: [plant("a b")],
    pods: [pod("p/1", ["plant:a b"])],
    beans: [bean("b?", ["pod:p/1"])],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(node(map, "plant:a b").href, "/admin/plant/a%20b");
  assert.equal(node(map, "pod:p/1").href, "/admin/pod/p%2F1");
  assert.equal(node(map, "bean:b?").href, "/admin/bean/b%3F");
});

// ---- unrooted --------------------------------------------------------------

test("a pod with no resolvable plant and a bean with no parent hang off Unrooted", () => {
  const raw: RawGarden = {
    plants: [plant("ariko")],
    pods: [pod("lost", ["plant:gone"])],
    beans: [bean("orphan", [])],
  };
  const map = buildGardenMap(raw, []);
  const unrooted = node(map, "bucket:unrooted");
  assert.equal(unrooted.kind, "bucket");
  assert.ok(hasEdge(map, "bucket:unrooted", "pod:lost"));
  assert.ok(hasEdge(map, "bucket:unrooted", "bean:orphan"));
});

test("there is no Unrooted node when nothing is unrooted", () => {
  const map = buildGardenMap(tidy(), []);
  assert.equal(map.nodes.some((n) => n.id === "bucket:unrooted"), false);
});

// ---- waiting for review ----------------------------------------------------

test("a plant, pod or bean is waiting when it is not public; absent means public", () => {
  const raw: RawGarden = {
    plants: [plant("a", { visibility: "private" }), plant("b", { visibility: undefined })],
    pods: [pod("p", ["plant:a"], { visibility: "private" })],
    beans: [bean("x", ["pod:p"], { visibility: "private" })],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(node(map, "plant:a").waiting, true);
  assert.equal(node(map, "plant:b").waiting, false);
  assert.equal(node(map, "pod:p").waiting, true);
  assert.equal(node(map, "bean:x").waiting, true);
});

// ---- missing ---------------------------------------------------------------

test("no narrative is flagged on a plant, a pod and a bean", () => {
  const raw: RawGarden = {
    plants: [plant("a", { content: undefined })],
    pods: [pod("p", ["plant:a"], { content: "" })],
    beans: [bean("x", ["pod:p"], { content: { en: "  ", fr: "" } })],
    sprouts: [sprout("s", { state: "published", about: ["bean:x"] })],
  };
  const map = buildGardenMap(raw, []);
  for (const id of ["plant:a", "pod:p", "bean:x"]) {
    assert.deepEqual(node(map, id).gaps, ["no-narrative"], id);
  }
});

test("a missing French half is flagged only when English exists", () => {
  const raw: RawGarden = {
    plants: [plant("a", { content: { en: "Only English" } })],
    pods: [pod("p", ["plant:a"], { content: { fr: "Seulement" } })],
    beans: [bean("x", ["pod:p"], { content: "Plain string is the en half" })],
    sprouts: [sprout("s", { state: "published", about: ["bean:x"] })],
  };
  const map = buildGardenMap(raw, []);
  assert.deepEqual(node(map, "plant:a").gaps, ["no-fr"]);
  assert.deepEqual(node(map, "pod:p").gaps, [], "a French-only narrative has no EN gap to name");
  assert.deepEqual(node(map, "bean:x").gaps, ["no-fr"]);
});

test("no narrative is never also reported as no French", () => {
  const raw: RawGarden = { plants: [plant("a", { content: undefined })], pods: [pod("p", ["plant:a"])] };
  assert.deepEqual(node(buildGardenMap(raw, []), "plant:a").gaps, ["no-narrative"]);
});

test("no children: a plant with nothing in it, a pod with no beans", () => {
  const raw: RawGarden = {
    plants: [plant("empty"), plant("full")],
    pods: [pod("hollow", ["plant:full"])],
  };
  const map = buildGardenMap(raw, []);
  assert.deepEqual(node(map, "plant:empty").gaps, ["no-children"]);
  assert.deepEqual(node(map, "plant:full").gaps, []);
  assert.deepEqual(node(map, "pod:hollow").gaps, ["no-children"]);
});

test("a plant whose only child is a direct bean has children", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    beans: [bean("x", ["plant:a"])],
    sprouts: [sprout("s", { state: "published", about: ["bean:x"] })],
  };
  assert.deepEqual(node(buildGardenMap(raw, []), "plant:a").gaps, []);
});

test("a bean whose only sprout is PUBLISHED has a journal — and draws no sprout node", () => {
  const map = buildGardenMap(tidy(), []);
  assert.deepEqual(node(map, "bean:editor").gaps, []);
  assert.equal(map.nodes.some((n) => n.kind === "sprout"), false);
});

test("a bean with no sprout of any state is flagged no-children", () => {
  const raw: RawGarden = { plants: [plant("a")], beans: [bean("x", ["plant:a"])] };
  assert.deepEqual(node(buildGardenMap(raw, []), "bean:x").gaps, ["no-children"]);
});

test("a projected bean is exempt from every gap", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    beans: [
      bean("pollen", ["plant:a"], {
        content: undefined,
        projected: { source: "s", feedId: "f", firstPollenId: "p" },
      }),
    ],
  };
  assert.deepEqual(node(buildGardenMap(raw, []), "bean:pollen").gaps, []);
});

// ---- sprouts ---------------------------------------------------------------

test("only draft sprouts are drawn; a private or published one is not", () => {
  const raw: RawGarden = {
    ...tidy(),
    sprouts: [
      sprout("d", { about: ["bean:editor"] }),
      sprout("noState", { state: undefined, about: ["bean:editor"] }),
      sprout("held", { state: "private", about: ["bean:editor"] }),
      sprout("out", { state: "published", about: ["bean:editor"] }),
    ],
  };
  const ids = buildGardenMap(raw, []).nodes.filter((n) => n.kind === "sprout").map((n) => n.id);
  assert.deepEqual(ids, ["sprout:d", "sprout:noState"]);
});

test("a draft sprout is waiting, with an edge per about ref", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    pods: [pod("p", ["plant:a"])],
    beans: [bean("x", ["pod:p"])],
    sprouts: [sprout("s", { about: ["pod:p", "bean:x"] })],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(node(map, "sprout:s").waiting, true);
  assert.equal(node(map, "sprout:s").href, "/admin/sprout/s");
  assert.ok(hasEdge(map, "pod:p", "sprout:s"));
  assert.ok(hasEdge(map, "bean:x", "sprout:s"));
});

test("a plant-level draft sprout hangs off its plant", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    sprouts: [sprout("s", { parents: ["plant:a"] })],
  };
  assert.ok(hasEdge(buildGardenMap(raw, []), "plant:a", "sprout:s"));
});

test("an ambiguous draft sprout keeps its links; a dangling one falls to Unrooted", () => {
  const raw: RawGarden = {
    plants: [plant("a"), plant("b")],
    pods: [pod("pa", ["plant:a"]), pod("pb", ["plant:b"])],
    sprouts: [
      sprout("two", { about: ["pod:pa", "pod:pb"] }),
      sprout("dangling", { about: ["bean:nothing"] }),
    ],
  };
  const map = buildGardenMap(raw, []);
  assert.ok(hasEdge(map, "pod:pa", "sprout:two"));
  assert.ok(hasEdge(map, "pod:pb", "sprout:two"));
  assert.equal(hasEdge(map, "bucket:unrooted", "sprout:two"), false);
  assert.ok(hasEdge(map, "bucket:unrooted", "sprout:dangling"));
});

test("a sprout about an orphan bean links to that bean, not directly to Unrooted", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    beans: [bean("orphan", [])],
    sprouts: [sprout("s", { about: ["bean:orphan"] })],
  };
  const map = buildGardenMap(raw, []);
  assert.ok(hasEdge(map, "bucket:unrooted", "bean:orphan"));
  assert.ok(hasEdge(map, "bean:orphan", "sprout:s"));
  assert.equal(hasEdge(map, "bucket:unrooted", "sprout:s"), false);
});

test("only pod: and bean: about refs become sprout edges", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    pods: [pod("p", ["plant:a"]), pod("lost", ["plant:gone"])],
    beans: [bean("x", ["pod:p"])],
    sprouts: [
      sprout("s1", { about: ["bean:x"] }),
      sprout("s", { about: ["bean:x", "plant:a", "sprout:s1", "bucket:unrooted"] }),
    ],
  };
  const map = buildGardenMap(raw, []);
  assert.ok(map.nodes.some((n) => n.id === "bucket:unrooted"));
  const incoming = map.edges.filter((e) => e.target === "sprout:s").map((e) => e.source);
  assert.deepEqual(incoming, ["bean:x"]);
});

// ---- seeds -----------------------------------------------------------------

test("an inbox seed attaches to the most specific suggestion that resolves", () => {
  const raw = tidy();
  const map = buildGardenMap(raw, [
    seed("1", { suggested: { beanSlug: "editor", podSlug: "core", plantSlug: "ariko" } }),
    seed("2", { suggested: { beanSlug: "gone", podSlug: "core" } }),
    seed("3", { suggested: { plantSlug: "ariko" } }),
  ]);
  assert.ok(hasEdge(map, "bean:editor", "seed:1"));
  assert.ok(hasEdge(map, "pod:core", "seed:2"), "a dangling bean falls back to the pod");
  assert.ok(hasEdge(map, "plant:ariko", "seed:3"));
  assert.equal(node(map, "seed:1").waiting, true);
  assert.equal(node(map, "seed:1").href, "/admin/triage/1");
});

test("a seed with no resolvable suggestion hangs off the Inbox node", () => {
  const map = buildGardenMap(tidy(), [seed("x"), seed("y", { suggested: { plantSlug: "nope" } })]);
  assert.equal(node(map, "bucket:inbox").kind, "bucket");
  assert.ok(hasEdge(map, "bucket:inbox", "seed:x"));
  assert.ok(hasEdge(map, "bucket:inbox", "seed:y"));
});

test("a promoted or discarded seed is not drawn", () => {
  const map = buildGardenMap(tidy(), [seed("p", { status: "promoted" }), seed("d", { status: "discarded" })]);
  assert.equal(map.nodes.some((n) => n.kind === "seed"), false);
});

test("a seed resolves garden-wide, then scope decides whether it is drawn", () => {
  const raw: RawGarden = {
    plants: [plant("a"), plant("b")],
    pods: [pod("pa", ["plant:a"]), pod("pb", ["plant:b"])],
    beans: [bean("xa", ["pod:pa"]), bean("xb", ["pod:pb"])],
  };
  const seeds = [seed("s", { suggested: { beanSlug: "xb", plantSlug: "a" } })];
  const inA = buildGardenMap(raw, seeds, { scope: "a" });
  assert.equal(inA.nodes.some((n) => n.id === "seed:s"), false);
  const inB = buildGardenMap(raw, seeds, { scope: "b" });
  assert.ok(hasEdge(inB, "bean:xb", "seed:s"));
  assert.equal(hasEdge(inB, "plant:a", "seed:s"), false);
  const all = buildGardenMap(raw, seeds);
  assert.ok(hasEdge(all, "bean:xb", "seed:s"));
});

// ---- scope -----------------------------------------------------------------

function twoPlants(): RawGarden {
  return {
    plants: [plant("a"), plant("b")],
    pods: [pod("pa", ["plant:a"]), pod("pb", ["plant:b"])],
    beans: [bean("xa", ["pod:pa"]), bean("xb", ["pod:pb"]), bean("direct", ["plant:a"])],
    sprouts: [
      sprout("sa", { about: ["bean:xa"] }),
      sprout("sb", { about: ["bean:xb"] }),
      sprout("floating"),
    ],
  };
}

test("scoped, only that plant's tree, its draft sprouts and its seeds remain", () => {
  const map = buildGardenMap(
    twoPlants(),
    [seed("mine", { suggested: { beanSlug: "xa" } }), seed("theirs", { suggested: { beanSlug: "xb" } }), seed("none")],
    { scope: "a" },
  );
  assert.deepEqual(
    map.nodes.map((n) => n.id).sort(),
    ["bean:direct", "bean:xa", "plant:a", "pod:pa", "seed:mine", "sprout:sa"].sort(),
  );
  assert.equal(map.nodes.some((n) => n.kind === "bucket"), false, "no Unrooted or Inbox when scoped");
});

test("scoped to a slug nothing resolves, the map is empty", () => {
  const map = buildGardenMap(twoPlants(), [], { scope: "ghost" });
  assert.deepEqual(map.nodes, []);
  assert.deepEqual(map.edges, []);
});

test("every edge joins two nodes that exist", () => {
  for (const scope of [null, "a", "b"]) {
    const map = buildGardenMap(twoPlants(), [seed("s")], { scope });
    const ids = new Set(map.nodes.map((n) => n.id));
    for (const e of map.edges) assert.ok(ids.has(e.source) && ids.has(e.target), `${e.id} (${scope})`);
  }
});

// ---- view + stats ----------------------------------------------------------

test("view dims what does not match and hides nothing", () => {
  const raw: RawGarden = {
    plants: [plant("a", { visibility: "private" }), plant("b")],
    pods: [pod("hollow", ["plant:b"])],
  };
  const all = buildGardenMap(raw, []);
  assert.ok(all.nodes.every((n) => !n.dim));

  const review = buildGardenMap(raw, [], { view: "review" });
  assert.equal(review.nodes.length, all.nodes.length);
  assert.deepEqual(
    review.nodes.filter((n) => !n.dim).map((n) => n.id),
    ["plant:a"],
  );

  const gaps = buildGardenMap(raw, [], { view: "gaps" });
  assert.deepEqual(
    gaps.nodes.filter((n) => !n.dim).map((n) => n.id).sort(),
    ["plant:a", "pod:hollow"].sort(),
  );
});

test("a bucket is never dimmed, whatever the view", () => {
  const raw: RawGarden = { plants: [plant("a")], pods: [pod("lost", ["plant:gone"])] };
  for (const view of ["review", "gaps"] as const) {
    const map = buildGardenMap(raw, [], { view });
    assert.equal(node(map, "bucket:unrooted").dim, false, view);
  }
});

test("stats count the whole map and ignore the view", () => {
  const raw: RawGarden = {
    plants: [plant("a", { visibility: "private" })],
    sprouts: [sprout("s", { parents: ["plant:a"] })],
  };
  const a = buildGardenMap(raw, [seed("1")]);
  const b = buildGardenMap(raw, [seed("1")], { view: "gaps" });
  assert.deepEqual(a.stats, b.stats);
  // plant:a (private), sprout:s and seed:1 wait. plant:a's one gap is
  // no-children: a sprout is not a pod or a bean.
  assert.equal(a.stats.waiting, 3);
  assert.equal(a.stats.gaps, 1);
});

test("mapViewOf accepts the three views and falls back to all", () => {
  assert.equal(mapViewOf("review"), "review");
  assert.equal(mapViewOf("gaps"), "gaps");
  assert.equal(mapViewOf("all"), "all");
  assert.equal(mapViewOf("nonsense"), "all");
  assert.equal(mapViewOf(undefined), "all");
  assert.equal(mapViewOf(["review", "gaps"]), "all");
});
