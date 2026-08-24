import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, type RawGarden } from "./data";
import { toGraph } from "./graph";

test("toGraph maps a pod to exactly {id, kind, name}", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", description: "secret notes", parents: ["plant:ghost"] }],
  };
  const { nodes } = toGraph(seed);
  // Slice 2 (describe): description IS emitted — /api/graph composes filterPublic,
  // so every node it serializes is already public HTML. Everything else below
  // stays as strictly withheld as before.
  assert.deepEqual(nodes, [{ id: "pod:m", kind: "pod", name: "M", description: "secret notes" }]);
  for (const key of ["parents", "domain", "visibility"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
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
    { id: "sprout:v", kind: "sprout", name: "V", description: "secret", type: "song", date: "2026-01-01" },
  ]);
  for (const key of ["content", "media", "source", "state", "parents", "bpm"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph resolves a localized name to a plain string — GraphNode.name stays string (B1)", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: { en: "M en", fr: "M fr" }, description: { fr: "notes" } }],
    beans: [{ slug: "a", name: { fr: "A fr" }, parents: ["pod:m"] }],
    sprouts: [
      { slug: "v", name: { en: "V en", fr: "V fr" }, type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" },
    ],
  };
  const byId = new Map(toGraph(seed).nodes.map((n) => [n.id, n]));
  // Shape unchanged at ALL three kinds: the resolved string sits where the plain
  // string always did, and localized inputs leak no extra fields onto the node.
  assert.deepEqual(byId.get("pod:m"), { id: "pod:m", kind: "pod", name: "M en", description: "notes" });
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
    pods: [{ slug: "m", name: "M", description: "", tags: ["x", "y"] }],
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
    pods: [{ slug: "m", name: "M", description: "" }],
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
      { slug: "m1", name: "M1", description: "" },
      { slug: "m2", name: "M2", description: "" },
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
    pods: [{ slug: "m", name: "M", description: "" }],
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
    pods: [{ slug: "m", name: "M", description: "" }],
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
    { slug: "m-pub", name: "Pub", description: "" },
    { slug: "m-priv", name: "Priv", description: "", visibility: "private" },
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
    pods: [{ slug: "m", name: "M", description: "" }],
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
    pods: [{ slug: "g-m", name: "M", description: "" }],
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

// --- Plant + bee projection (PR2). ---

test("toGraph maps a plant to {id, kind, name, natures, description} — relations never leak", () => {
  const seed: RawGarden = {
    plants: [{ slug: "melogram", name: "Melogram", natures: ["work", "tool"], role: { kind: "owner" as const }, description: "secret", relations: [{ kind: "distributes", ref: "plant:bohns-music" }] }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [
    { id: "plant:melogram", kind: "plant", name: "Melogram", natures: ["work", "tool"], description: "secret" },
  ]);
  for (const key of ["relations", "visibility"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph maps a bee to {id, kind, name, type, status, description} — levers/serves/engine never leak", () => {
  const seed: RawGarden = {
    bees: [{ slug: "si", name: "Song identifier", kind: "capability", status: "live", engine: "x", schedule: "daily", levers: [{ label: "l" }], serves: ["plant:femfolk"], description: "d", visibility: "public" }],
  };
  const { nodes } = toGraph(seed);
  assert.deepEqual(nodes, [
    { id: "bee:si", kind: "bee", name: "Song identifier", type: "capability", status: "live", description: "d" },
  ]);
  // A public bee is an explicit per-bee opt-in, so its description is already a
  // deliberate publication (slice 2). Its operational levers still never leak.
  for (const key of ["levers", "serves", "engine", "schedule", "visibility"]) {
    assert.equal(key in nodes[0], false, `${key} must not leak into the node`);
  }
});

test("toGraph emits plant containment for pods and direct beans", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl", "plant:ghost"] }],
    beans: [{ slug: "direct", name: "D", parents: ["plant:pl"] }],
  };
  const { edges } = toGraph(seed);
  assert.deepEqual(edges, [
    { source: "plant:pl", target: "pod:m", kind: "contains" },
    { source: "plant:pl", target: "bean:direct", kind: "contains" },
  ]);
});

test("toGraph renders plant relation edges (distributes/chronicles) with both-ends prune", () => {
  const seed: RawGarden = {
    plants: [
      { slug: "melogram", name: "Mg", natures: ["work", "tool"], role: { kind: "owner" as const }, description: "", relations: [{ kind: "distributes", ref: "plant:bohns-music" }, { kind: "chronicles", ref: "plant:ghost" }] },
      { slug: "bohns-music", name: "BM", natures: ["work"], role: { kind: "owner" as const }, description: "" },
    ],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "plant:melogram", target: "plant:bohns-music", kind: "distributes" },
  ]);
});

test("toGraph renders bee serves edges with both-ends prune", () => {
  const seed: RawGarden = {
    plants: [{ slug: "femfolk", name: "F", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    bees: [{ slug: "si", name: "SI", kind: "capability", status: "live", levers: [], serves: ["plant:femfolk", "plant:ghost"], description: "" }],
  };
  assert.deepEqual(toGraph(seed).edges, [
    { source: "bee:si", target: "plant:femfolk", kind: "serves" },
  ]);
});

test("toGraph composed with filterPublic shows only public bees (the /api/graph contract)", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    bees: [
      { slug: "pub", name: "Pub", kind: "workflow", status: "live", levers: [], serves: ["plant:pl"], description: "", visibility: "public" },
      { slug: "hidden", name: "H", kind: "adapter", status: "planned", levers: [], serves: ["plant:pl"], description: "" },
    ],
  };
  const ids = toGraph(filterPublic(seed)).nodes.map((n) => n.id);
  assert.ok(ids.includes("bee:pub"));
  assert.equal(ids.includes("bee:hidden"), false);
});

test("a blank description emits no key at all", () => {
  const { nodes } = toGraph({
    pods: [{ slug: "m", name: "M", description: "   ", parents: [] }],
    beans: [{ slug: "a", name: "A", description: { en: "" }, parents: [] }],
  });
  for (const node of nodes) {
    assert.equal("description" in node, false, `${node.id} should carry no description key`);
  }
});

test("a localized description resolves en-first, like name", () => {
  const { nodes } = toGraph({
    pods: [{ slug: "m", name: "M", description: { en: "english", fr: "français" }, parents: [] }],
    beans: [{ slug: "a", name: "A", description: { fr: "seulement en français" }, parents: [] }],
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  assert.equal(byId.get("pod:m")?.description, "english");
  assert.equal(byId.get("bean:a")?.description, "seulement en français");
});

test("a public bee's description is emitted too", () => {
  const { nodes } = toGraph({
    bees: [
      {
        slug: "b",
        name: "B",
        kind: "routine",
        status: "live",
        levers: [],
        serves: [],
        description: "what it does",
        visibility: "public",
      },
    ],
  });
  assert.equal(nodes[0].description, "what it does");
  assert.equal("levers" in nodes[0], false, "levers must not leak into the node");
});

test("a bean node carries the cover derived from its newest sprout with an image", () => {
  const graph = toGraph({
    beans: [{ slug: "b", name: "B", parents: [] }],
    sprouts: [
      { slug: "newer", name: "N", type: "t", date: "2026-06-01", description: "", parents: ["bean:b"] },
      {
        slug: "older",
        name: "O",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [
          { kind: "image", storageKey: "k", url: "https://cdn/x.jpg", alt: "a cat", width: 8, height: 6 },
        ],
      },
    ],
  });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.deepEqual(bean?.cover, { url: "https://cdn/x.jpg", alt: "a cat", width: 8, height: 6 });
});

// storageKey is a Cloudinary-internal id with no meaning to a consumer, so the
// public payload is a narrowed view rather than the whole MediaImage.
test("the graph's cover omits storageKey", () => {
  const graph = toGraph({
    beans: [{ slug: "b", name: "B", parents: [] }],
    sprouts: [
      {
        slug: "s",
        name: "S",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [{ kind: "image", storageKey: "secret", url: "https://cdn/x.jpg" }],
      },
    ],
  });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.deepEqual(bean?.cover, { url: "https://cdn/x.jpg" });
  assert.equal(JSON.stringify(graph).includes("secret"), false);
});

// The one cover consumer that cannot vet its own sink: /api/graph hands this
// URL to an unknown client renderer, which may put it in an href. A stored
// media URL is never scheme-checked on the way in (lib/inbox.ts, spec §3), so
// this boundary is the first place it could be.
test("a cover whose URL is not http(s) is not emitted at all", () => {
  const withCover = (url: string) =>
    toGraph({
      beans: [{ slug: "b", name: "B", parents: [] }],
      sprouts: [
        {
          slug: "s",
          name: "S",
          type: "t",
          date: "2026-01-01",
          description: "",
          parents: ["bean:b"],
          media: [{ kind: "image", storageKey: "k", url }],
        },
      ],
    }).nodes.find((n) => n.id === "bean:b")?.cover;

  for (const url of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>1</script>",
    "not a url",
    "",
  ]) {
    assert.equal(withCover(url), undefined, `a ${url || "blank"} cover must not reach the payload`);
  }

  // Non-vacuous, and the guard must not be over-eager either.
  assert.deepEqual(withCover("https://cdn/x.jpg"), { url: "https://cdn/x.jpg" });
  assert.deepEqual(withCover("http://cdn/x.jpg"), { url: "http://cdn/x.jpg" });
});

test("a bean with no images emits no cover key", () => {
  const graph = toGraph({ beans: [{ slug: "b", name: "B", parents: [] }] });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.ok(bean);
  assert.ok(!("cover" in bean!));
});

test("non-bean nodes never carry a cover", () => {
  const graph = toGraph({
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    beans: [{ slug: "b", name: "B", parents: ["plant:p"] }],
    sprouts: [
      {
        slug: "s",
        name: "S",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [{ kind: "image", storageKey: "k", url: "https://cdn/x.jpg" }],
      },
    ],
  });
  assert.ok(!("cover" in graph.nodes.find((n) => n.id === "plant:p")!));
  assert.ok(!("cover" in graph.nodes.find((n) => n.id === "sprout:s")!));
});

// toGraph works from a RawGarden, so it must establish newest-first ordering
// itself — coverFor's contract depends on it, and a RawGarden's sprouts[] is
// in whatever order the database returned.
test("the cover follows sprout DATE, not the order sprouts appear in the raw garden", () => {
  const graph = toGraph({
    beans: [{ slug: "b", name: "B", parents: [] }],
    sprouts: [
      {
        slug: "older",
        name: "O",
        type: "t",
        date: "2020-01-01",
        description: "",
        parents: ["bean:b"],
        media: [{ kind: "image", storageKey: "old", url: "https://cdn/old.jpg" }],
      },
      {
        slug: "newer",
        name: "N",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [{ kind: "image", storageKey: "new", url: "https://cdn/new.jpg" }],
      },
    ],
  });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.equal(bean?.cover?.url, "https://cdn/new.jpg");
});
