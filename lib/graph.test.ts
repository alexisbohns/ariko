import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, type RawGarden } from "./data";
import { toGraph } from "./graph";

test("toGraph maps a pod to exactly {id, kind, name, domain}", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "secret notes" }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "pod:m", kind: "pod", name: "M", domain: "music" }]);
  assert.equal("description" in nodes[0], false);
});

test("toGraph maps an bean to exactly {id, kind, name} — no visibility/parents leakage", () => {
  const seed: RawGarden = {
    beans: [{ slug: "a", name: "A", parents: ["pod:ghost"], visibility: "private" }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "bean:a", kind: "bean", name: "A" }]);
  for (const key of ["visibility", "parents"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph maps a sprout to exactly {id, kind, name, type, date} — no content leakage", () => {
  const seed: RawGarden = {
    sprouts: [
      {
        slug: "v",
        name: "V",
        type: "song",
        date: "2026-01-01",
        description: "secret",
        parents: [],
        state: "published",
        content: { en: "secret body" },
        media: [{ kind: "embed", provider: "soundcloud", url: "https://example.com" }],
        source: { kind: "manual" },
        bpm: 128, // flexible per-type property must not leak either
      },
    ],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [
    { id: "sprout:v", kind: "sprout", name: "V", type: "song", date: "2026-01-01" },
  ]);
  for (const key of ["description", "content", "media", "source", "state", "parents", "bpm"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph resolves a localized name to a plain string — GraphNode.name stays string (B1)", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: { en: "M en", fr: "M fr" }, domain: "music", description: { fr: "notes" } }],
    beans: [{ slug: "a", name: { fr: "A fr" }, parents: ["pod:m"] }],
    sprouts: [
      { slug: "v", name: { en: "V en", fr: "V fr" }, type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" },
    ],
  };
  const byId = new Map(toGraph(seed).nodes.map((n) => [n.id, n]));
  // Shape unchanged at ALL three kinds: the resolved string sits where the plain
  // string always did, and localized inputs leak no extra fields onto the node.
  assert.deepEqual(byId.get("pod:m"), { id: "pod:m", kind: "pod", name: "M en", domain: "music" });
  assert.deepEqual(byId.get("bean:a"), { id: "bean:a", kind: "bean", name: "A fr" }); // en missing → display fallback
  assert.deepEqual(byId.get("sprout:v"), {
    id: "sprout:v",
    kind: "sprout",
    name: "V en",
    type: "song",
    date: "2026-01-01",
  });
});

test("toGraph includes tags only when non-empty", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", domain: "design", description: "", tags: ["x", "y"] }],
    beans: [{ slug: "a-empty", name: "A", parents: [], tags: [] }],
    sprouts: [
      { slug: "v-none", name: "V", type: "song", date: "2026-01-01", description: "", parents: [] },
      {
        slug: "v-tagged",
        name: "T",
        type: "song",
        date: "2026-01-02",
        description: "",
        parents: [],
        tags: ["z"],
      },
    ],
  };
  const { nodes } = toGraph(seed);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert.deepEqual(byId.get("pod:m")?.tags, ["x", "y"]);
  assert.equal("tags" in byId.get("bean:a-empty")!, false);
  assert.equal("tags" in byId.get("sprout:v-none")!, false);
  assert.deepEqual(byId.get("sprout:v-tagged")?.tags, ["z"]);
});

test("toGraph emits containment edges pod→atom and bean→sprout, in child input order", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "" }],
    beans: [
      { slug: "a1", name: "A1", parents: ["pod:m"] },
      { slug: "a2", name: "A2", parents: ["pod:m"] },
    ],
    sprouts: [
      { slug: "v1", name: "V1", type: "song", date: "2026-01-01", description: "", parents: ["bean:a2"], state: "published" },
      { slug: "v2", name: "V2", type: "song", date: "2026-01-02", description: "", parents: ["bean:a1"], state: "published" },
    ],
  };
  const graph = toGraph(seed);
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["pod:m", "bean:a1", "bean:a2", "sprout:v1", "sprout:v2"],
  );
  assert.deepEqual(graph.edges, [
    { source: "pod:m", target: "bean:a1", kind: "contains" },
    { source: "pod:m", target: "bean:a2", kind: "contains" },
    { source: "bean:a2", target: "sprout:v1", kind: "contains" },
    { source: "bean:a1", target: "sprout:v2", kind: "contains" },
  ]);
});

test("toGraph emits one edge per existing parent for a multi-parent bean", () => {
  const seed: RawGarden = {
    pods: [
      { slug: "m1", name: "M1", domain: "music", description: "" },
      { slug: "m2", name: "M2", domain: "design", description: "" },
    ],
    beans: [{ slug: "a", name: "A", parents: ["pod:m1", "pod:m2"] }],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "pod:m1", target: "bean:a", kind: "contains" },
    { source: "pod:m2", target: "bean:a", kind: "contains" },
  ]);
});

test("toGraph emits one edge per existing bean parent for a multi-parent sprout", () => {
  const seed: RawGarden = {
    beans: [
      { slug: "a1", name: "A1", parents: [] },
      { slug: "a2", name: "A2", parents: [] },
    ],
    sprouts: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a1", "bean:a2"], state: "published" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "bean:a1", target: "sprout:v", kind: "contains" },
    { source: "bean:a2", target: "sprout:v", kind: "contains" },
  ]);
});

test("toGraph dedupes duplicate (source, target) pairs", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m", "pod:m"] }],
    sprouts: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a", "bean:a"], state: "published" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "pod:m", target: "bean:a", kind: "contains" },
    { source: "bean:a", target: "sprout:v", kind: "contains" },
  ]);
});

test("toGraph emits no edge for a dangling parent ref but keeps the node", () => {
  const seed: RawGarden = {
    beans: [{ slug: "a", name: "A", parents: ["pod:ghost"] }],
    sprouts: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:ghost"], state: "published" },
    ],
  };
  const graph = toGraph(seed);
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["bean:a", "sprout:v"],
  );
  assert.deepEqual(graph.edges, []);
});

test("toGraph ignores parent refs outside the containment grammar", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "" }],
    sprouts: [
      // "pod:" is not a valid container for a version — no edge even though both nodes exist.
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["pod:m"], state: "published" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, []);
});

test("toGraph returns an empty graph for empty or absent collections", () => {
  assert.deepEqual(toGraph({}), { nodes: [], edges: [] });
  assert.deepEqual(toGraph({ pods: [], beans: [], sprouts: [] }), { nodes: [], edges: [] });
});

// Projection composition — the exact pipeline the route runs. Draft/stateless
// versions and privacy cascades must yield neither nodes nor edges.
const mixed: RawGarden = {
  pods: [
    { slug: "m-pub", name: "Pub", domain: "music", description: "" },
    { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
  ],
  beans: [
    { slug: "a-pub", name: "A pub", parents: ["pod:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["pod:m-pub"], visibility: "private" },
    { slug: "a-under-priv", name: "A cascaded", parents: ["pod:m-priv"] },
  ],
  sprouts: [
    { slug: "v-published", name: "Published", type: "song", date: "2026-01-01", description: "", parents: ["bean:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["bean:a-pub"], state: "draft" },
    { slug: "v-nostate", name: "No state", type: "song", date: "2026-01-03", description: "", parents: ["bean:a-pub"] },
    // Published, but its only atom parent is private — cascades out with it.
    { slug: "v-under-priv", name: "Hidden", type: "song", date: "2026-01-04", description: "", parents: ["bean:a-priv"], state: "published" },
  ],
};

test("toGraph(filterPublic(raw)) emits only published content", () => {
  const graph = toGraph(filterPublic(mixed));
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["pod:m-pub", "bean:a-pub", "sprout:v-published"],
  );
  assert.deepEqual(graph.edges, [
    { source: "pod:m-pub", target: "bean:a-pub", kind: "contains" },
    { source: "bean:a-pub", target: "sprout:v-published", kind: "contains" },
  ]);
});

// relations[] edges (G2): one edge per relation, kind passed through verbatim,
// emitted AFTER all containment edges, gated on both ends being nodes.
test("toGraph emits relation edges with their kind, after containment edges", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m"] }],
    sprouts: [
      { slug: "v0", name: "V0", type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" },
      {
        slug: "v1",
        name: "V1",
        type: "song",
        date: "2026-01-02",
        description: "",
        parents: ["bean:a"],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "sprout:v0" },
          { kind: "related-to", ref: "bean:a" },
          { kind: "featured-in", ref: "pod:m" },
        ],
      },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "pod:m", target: "bean:a", kind: "contains" },
    { source: "bean:a", target: "sprout:v0", kind: "contains" },
    { source: "bean:a", target: "sprout:v1", kind: "contains" },
    { source: "sprout:v1", target: "sprout:v0", kind: "evolves-from" },
    { source: "sprout:v1", target: "bean:a", kind: "related-to" },
    { source: "sprout:v1", target: "pod:m", kind: "featured-in" },
  ]);
});

test("toGraph emits no relation edge when the target is not a node (both-ends prune)", () => {
  const seed: RawGarden = {
    sprouts: [
      {
        slug: "v",
        name: "V",
        type: "song",
        date: "2026-01-01",
        description: "",
        parents: [],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "sprout:ghost" },
          { kind: "related-to", ref: "bean:ghost" },
          { kind: "related-to", ref: "not-even-a-ref" },
        ],
      },
    ],
  };
  const graph = toGraph(seed);
  assert.deepEqual(graph.nodes.map((n) => n.id), ["sprout:v"]);
  assert.deepEqual(graph.edges, []);
});

test("toGraph dedupes relation edges on (source, target, kind) — same pair, two kinds → two edges", () => {
  const seed: RawGarden = {
    sprouts: [
      { slug: "v0", name: "V0", type: "song", date: "2026-01-01", description: "", parents: [], state: "published" },
      {
        slug: "v1",
        name: "V1",
        type: "song",
        date: "2026-01-02",
        description: "",
        parents: [],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "sprout:v0" },
          { kind: "evolves-from", ref: "sprout:v0" }, // identical duplicate → one edge
          { kind: "references", ref: "sprout:v0" }, // same pair, distinct kind → its own edge
        ],
      },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "sprout:v1", target: "sprout:v0", kind: "evolves-from" },
    { source: "sprout:v1", target: "sprout:v0", kind: "references" },
  ]);
});

// Composition (spec §3): the scrub upstream plus the both-ends prune — only the
// published sibling's edge survives, and no scrubbed slug appears ANYWHERE in
// the serialized JSON.
test("toGraph(filterPublic(raw)) keeps only relation edges to surviving targets, leaking no slug", () => {
  const seed: RawGarden = {
    pods: [{ slug: "g-m", name: "M", domain: "music", description: "" }],
    beans: [
      { slug: "g-a", name: "A", parents: ["pod:g-m"] },
      { slug: "g-a-hidden", name: "A hidden", parents: ["pod:g-m"], visibility: "private" },
    ],
    sprouts: [
      { slug: "g-v-unpub", name: "Draft", type: "song", date: "2026-01-01", description: "", parents: ["bean:g-a"], state: "draft" },
      { slug: "g-v-sibling", name: "Sibling", type: "song", date: "2026-01-02", description: "", parents: ["bean:g-a"], state: "published" },
      {
        slug: "g-v-main",
        name: "Main",
        type: "song",
        date: "2026-01-03",
        description: "",
        parents: ["bean:g-a"],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "sprout:g-v-unpub" },
          { kind: "related-to", ref: "bean:g-a-hidden" },
          { kind: "evolves-from", ref: "sprout:g-v-sibling" },
        ],
      },
    ],
  };
  const graph = toGraph(filterPublic(seed));
  assert.deepEqual(
    graph.edges.filter((e) => e.kind !== "contains"),
    [{ source: "sprout:g-v-main", target: "sprout:g-v-sibling", kind: "evolves-from" }],
  );
  const json = JSON.stringify(graph);
  for (const scrubbed of ["g-v-unpub", "g-a-hidden"]) {
    assert.equal(json.includes(scrubbed), false, `${scrubbed} must not appear anywhere in the graph JSON`);
  }
});

test("toGraph(filterPublic(raw)) never emits a filtered id as a node OR an edge end", () => {
  // (The both-ends rule itself is pinned by the explicit edge assertions above —
  // checking edges against graph.nodes here would be tautological by construction.)
  const graph = toGraph(filterPublic(mixed));
  const emitted = new Set([
    ...graph.nodes.map((n) => n.id),
    ...graph.edges.flatMap((e) => [e.source, e.target]),
  ]);
  for (const filtered of [
    "pod:m-priv",
    "bean:a-priv",
    "bean:a-under-priv",
    "sprout:v-draft",
    "sprout:v-nostate",
    "sprout:v-under-priv",
  ]) {
    assert.equal(emitted.has(filtered), false, `${filtered} must not be public`);
  }
});
