import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, type RawSeed } from "./data";
import { toGraph } from "./graph";

test("toGraph maps a molecule to exactly {id, kind, name, domain}", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "secret notes" }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "molecule:m", kind: "molecule", name: "M", domain: "music" }]);
  assert.equal("description" in nodes[0], false);
});

test("toGraph maps an atom to exactly {id, kind, name} — no visibility/parents leakage", () => {
  const seed: RawSeed = {
    atoms: [{ slug: "a", name: "A", parents: ["molecule:ghost"], visibility: "private" }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [{ id: "atom:a", kind: "atom", name: "A" }]);
  for (const key of ["visibility", "parents"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph maps a version to exactly {id, kind, name, type, date} — no content leakage", () => {
  const seed: RawSeed = {
    versions: [
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
    { id: "version:v", kind: "version", name: "V", type: "song", date: "2026-01-01" },
  ]);
  for (const key of ["description", "content", "media", "source", "state", "parents", "bpm"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph resolves a localized name to a plain string — GraphNode.name stays string (B1)", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: { en: "M en", fr: "M fr" }, domain: "music", description: { fr: "notes" } }],
    atoms: [{ slug: "a", name: { fr: "A fr" }, parents: ["molecule:m"] }],
    versions: [
      { slug: "v", name: { en: "V en", fr: "V fr" }, type: "song", date: "2026-01-01", description: "", parents: ["atom:a"], state: "published" },
    ],
  };
  const byId = new Map(toGraph(seed).nodes.map((n) => [n.id, n]));
  // Shape unchanged at ALL three kinds: the resolved string sits where the plain
  // string always did, and localized inputs leak no extra fields onto the node.
  assert.deepEqual(byId.get("molecule:m"), { id: "molecule:m", kind: "molecule", name: "M en", domain: "music" });
  assert.deepEqual(byId.get("atom:a"), { id: "atom:a", kind: "atom", name: "A fr" }); // en missing → display fallback
  assert.deepEqual(byId.get("version:v"), {
    id: "version:v",
    kind: "version",
    name: "V en",
    type: "song",
    date: "2026-01-01",
  });
});

test("toGraph includes tags only when non-empty", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "design", description: "", tags: ["x", "y"] }],
    atoms: [{ slug: "a-empty", name: "A", parents: [], tags: [] }],
    versions: [
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
  assert.deepEqual(byId.get("molecule:m")?.tags, ["x", "y"]);
  assert.equal("tags" in byId.get("atom:a-empty")!, false);
  assert.equal("tags" in byId.get("version:v-none")!, false);
  assert.deepEqual(byId.get("version:v-tagged")?.tags, ["z"]);
});

test("toGraph emits containment edges molecule→atom and atom→version, in child input order", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "" }],
    atoms: [
      { slug: "a1", name: "A1", parents: ["molecule:m"] },
      { slug: "a2", name: "A2", parents: ["molecule:m"] },
    ],
    versions: [
      { slug: "v1", name: "V1", type: "song", date: "2026-01-01", description: "", parents: ["atom:a2"], state: "published" },
      { slug: "v2", name: "V2", type: "song", date: "2026-01-02", description: "", parents: ["atom:a1"], state: "published" },
    ],
  };
  const graph = toGraph(seed);
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["molecule:m", "atom:a1", "atom:a2", "version:v1", "version:v2"],
  );
  assert.deepEqual(graph.edges, [
    { source: "molecule:m", target: "atom:a1", kind: "contains" },
    { source: "molecule:m", target: "atom:a2", kind: "contains" },
    { source: "atom:a2", target: "version:v1", kind: "contains" },
    { source: "atom:a1", target: "version:v2", kind: "contains" },
  ]);
});

test("toGraph emits one edge per existing parent for a multi-parent atom", () => {
  const seed: RawSeed = {
    molecules: [
      { slug: "m1", name: "M1", domain: "music", description: "" },
      { slug: "m2", name: "M2", domain: "design", description: "" },
    ],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m1", "molecule:m2"] }],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "molecule:m1", target: "atom:a", kind: "contains" },
    { source: "molecule:m2", target: "atom:a", kind: "contains" },
  ]);
});

test("toGraph emits one edge per existing atom parent for a multi-parent version", () => {
  const seed: RawSeed = {
    atoms: [
      { slug: "a1", name: "A1", parents: [] },
      { slug: "a2", name: "A2", parents: [] },
    ],
    versions: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["atom:a1", "atom:a2"], state: "published" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "atom:a1", target: "version:v", kind: "contains" },
    { source: "atom:a2", target: "version:v", kind: "contains" },
  ]);
});

test("toGraph dedupes duplicate (source, target) pairs", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "" }],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m", "molecule:m"] }],
    versions: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["atom:a", "atom:a"], state: "published" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "molecule:m", target: "atom:a", kind: "contains" },
    { source: "atom:a", target: "version:v", kind: "contains" },
  ]);
});

test("toGraph emits no edge for a dangling parent ref but keeps the node", () => {
  const seed: RawSeed = {
    atoms: [{ slug: "a", name: "A", parents: ["molecule:ghost"] }],
    versions: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["atom:ghost"], state: "published" },
    ],
  };
  const graph = toGraph(seed);
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["atom:a", "version:v"],
  );
  assert.deepEqual(graph.edges, []);
});

test("toGraph ignores parent refs outside the containment grammar", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "" }],
    versions: [
      // "molecule:" is not a valid container for a version — no edge even though both nodes exist.
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["molecule:m"], state: "published" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, []);
});

test("toGraph returns an empty graph for empty or absent collections", () => {
  assert.deepEqual(toGraph({}), { nodes: [], edges: [] });
  assert.deepEqual(toGraph({ molecules: [], atoms: [], versions: [] }), { nodes: [], edges: [] });
});

// Projection composition — the exact pipeline the route runs. Draft/stateless
// versions and privacy cascades must yield neither nodes nor edges.
const mixed: RawSeed = {
  molecules: [
    { slug: "m-pub", name: "Pub", domain: "music", description: "" },
    { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
  ],
  atoms: [
    { slug: "a-pub", name: "A pub", parents: ["molecule:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["molecule:m-pub"], visibility: "private" },
    { slug: "a-under-priv", name: "A cascaded", parents: ["molecule:m-priv"] },
  ],
  versions: [
    { slug: "v-published", name: "Published", type: "song", date: "2026-01-01", description: "", parents: ["atom:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["atom:a-pub"], state: "draft" },
    { slug: "v-nostate", name: "No state", type: "song", date: "2026-01-03", description: "", parents: ["atom:a-pub"] },
    // Published, but its only atom parent is private — cascades out with it.
    { slug: "v-under-priv", name: "Hidden", type: "song", date: "2026-01-04", description: "", parents: ["atom:a-priv"], state: "published" },
  ],
};

test("toGraph(filterPublic(raw)) emits only published content", () => {
  const graph = toGraph(filterPublic(mixed));
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["molecule:m-pub", "atom:a-pub", "version:v-published"],
  );
  assert.deepEqual(graph.edges, [
    { source: "molecule:m-pub", target: "atom:a-pub", kind: "contains" },
    { source: "atom:a-pub", target: "version:v-published", kind: "contains" },
  ]);
});

// relations[] edges (G2): one edge per relation, kind passed through verbatim,
// emitted AFTER all containment edges, gated on both ends being nodes.
test("toGraph emits relation edges with their kind, after containment edges", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "" }],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m"] }],
    versions: [
      { slug: "v0", name: "V0", type: "song", date: "2026-01-01", description: "", parents: ["atom:a"], state: "published" },
      {
        slug: "v1",
        name: "V1",
        type: "song",
        date: "2026-01-02",
        description: "",
        parents: ["atom:a"],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "version:v0" },
          { kind: "related-to", ref: "atom:a" },
          { kind: "featured-in", ref: "molecule:m" },
        ],
      },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "molecule:m", target: "atom:a", kind: "contains" },
    { source: "atom:a", target: "version:v0", kind: "contains" },
    { source: "atom:a", target: "version:v1", kind: "contains" },
    { source: "version:v1", target: "version:v0", kind: "evolves-from" },
    { source: "version:v1", target: "atom:a", kind: "related-to" },
    { source: "version:v1", target: "molecule:m", kind: "featured-in" },
  ]);
});

test("toGraph emits no relation edge when the target is not a node (both-ends prune)", () => {
  const seed: RawSeed = {
    versions: [
      {
        slug: "v",
        name: "V",
        type: "song",
        date: "2026-01-01",
        description: "",
        parents: [],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "version:ghost" },
          { kind: "related-to", ref: "atom:ghost" },
          { kind: "related-to", ref: "not-even-a-ref" },
        ],
      },
    ],
  };
  const graph = toGraph(seed);
  assert.deepEqual(graph.nodes.map((n) => n.id), ["version:v"]);
  assert.deepEqual(graph.edges, []);
});

test("toGraph dedupes relation edges on (source, target, kind) — same pair, two kinds → two edges", () => {
  const seed: RawSeed = {
    versions: [
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
          { kind: "evolves-from", ref: "version:v0" },
          { kind: "evolves-from", ref: "version:v0" }, // identical duplicate → one edge
          { kind: "references", ref: "version:v0" }, // same pair, distinct kind → its own edge
        ],
      },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "version:v1", target: "version:v0", kind: "evolves-from" },
    { source: "version:v1", target: "version:v0", kind: "references" },
  ]);
});

// Composition (spec §3): the scrub upstream plus the both-ends prune — only the
// published sibling's edge survives, and no scrubbed slug appears ANYWHERE in
// the serialized JSON.
test("toGraph(filterPublic(raw)) keeps only relation edges to surviving targets, leaking no slug", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "g-m", name: "M", domain: "music", description: "" }],
    atoms: [
      { slug: "g-a", name: "A", parents: ["molecule:g-m"] },
      { slug: "g-a-hidden", name: "A hidden", parents: ["molecule:g-m"], visibility: "private" },
    ],
    versions: [
      { slug: "g-v-unpub", name: "Draft", type: "song", date: "2026-01-01", description: "", parents: ["atom:g-a"], state: "draft" },
      { slug: "g-v-sibling", name: "Sibling", type: "song", date: "2026-01-02", description: "", parents: ["atom:g-a"], state: "published" },
      {
        slug: "g-v-main",
        name: "Main",
        type: "song",
        date: "2026-01-03",
        description: "",
        parents: ["atom:g-a"],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "version:g-v-unpub" },
          { kind: "related-to", ref: "atom:g-a-hidden" },
          { kind: "evolves-from", ref: "version:g-v-sibling" },
        ],
      },
    ],
  };
  const graph = toGraph(filterPublic(seed));
  assert.deepEqual(
    graph.edges.filter((e) => e.kind !== "contains"),
    [{ source: "version:g-v-main", target: "version:g-v-sibling", kind: "evolves-from" }],
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
    "molecule:m-priv",
    "atom:a-priv",
    "atom:a-under-priv",
    "version:v-draft",
    "version:v-nostate",
    "version:v-under-priv",
  ]) {
    assert.equal(emitted.has(filtered), false, `${filtered} must not be public`);
  }
});
