import { test } from "node:test";
import assert from "node:assert/strict";
import type { GardenMap, MapNode, MapNodeKind } from "./garden-map";
import { KIND_SIZE, layoutGardenMap } from "./garden-map-layout";

function n(id: string, kind: MapNodeKind): MapNode {
  return { id, kind, label: id, waiting: false, gaps: [], dim: false };
}
function map(nodes: MapNode[], pairs: Array<[string, string]>): GardenMap {
  return {
    nodes,
    edges: pairs.map(([source, target]) => ({ id: `${source}>${target}`, source, target })),
    stats: { waiting: 0, gaps: 0 },
  };
}
function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test("every node gets a top-left position and its kind's size", () => {
  const out = layoutGardenMap(map([n("plant:a", "plant"), n("pod:p", "pod")], [["plant:a", "pod:p"]]));
  for (const node of out.nodes) {
    assert.equal(typeof node.x, "number");
    assert.equal(typeof node.y, "number");
    assert.equal(node.width, KIND_SIZE[node.kind].width);
    assert.equal(node.height, KIND_SIZE[node.kind].height);
  }
});

test("a child sits to the right of its parent", () => {
  const out = layoutGardenMap(map([n("plant:a", "plant"), n("pod:p", "pod")], [["plant:a", "pod:p"]]));
  const [plant, pod] = out.nodes;
  assert.ok(pod.x > plant.x + plant.width - 1);
});

test("a forest of disconnected trees lays out without overlap", () => {
  const nodes = [
    n("plant:a", "plant"), n("pod:a1", "pod"), n("bean:a2", "bean"),
    n("plant:b", "plant"), n("pod:b1", "pod"),
    n("plant:lonely", "plant"),
    n("bucket:unrooted", "bucket"), n("seed:1", "seed"),
  ];
  const out = layoutGardenMap(
    map(nodes, [["plant:a", "pod:a1"], ["pod:a1", "bean:a2"], ["plant:b", "pod:b1"], ["bucket:unrooted", "seed:1"]]),
  );
  assert.equal(out.nodes.length, nodes.length);
  for (let i = 0; i < out.nodes.length; i++) {
    for (let j = i + 1; j < out.nodes.length; j++) {
      assert.equal(overlaps(out.nodes[i], out.nodes[j]), false, `${out.nodes[i].id} vs ${out.nodes[j].id}`);
    }
  }
});

test("a node with two parents is laid out once", () => {
  const out = layoutGardenMap(
    map(
      [n("plant:a", "plant"), n("pod:x", "pod"), n("pod:y", "pod"), n("bean:s", "bean")],
      [["plant:a", "pod:x"], ["plant:a", "pod:y"], ["pod:x", "bean:s"], ["pod:y", "bean:s"]],
    ),
  );
  assert.equal(out.nodes.filter((node) => node.id === "bean:s").length, 1);
});

test("an empty map lays out to an empty map", () => {
  const out = layoutGardenMap(map([], []));
  assert.deepEqual(out.nodes, []);
  assert.deepEqual(out.edges, []);
});

test("layout keeps the builder's flags, stats and edges untouched", () => {
  const input = map([{ ...n("plant:a", "plant"), waiting: true, gaps: ["no-fr"], dim: true }], []);
  const out = layoutGardenMap(input);
  assert.equal(out.nodes[0].waiting, true);
  assert.deepEqual(out.nodes[0].gaps, ["no-fr"]);
  assert.equal(out.nodes[0].dim, true);
  assert.deepEqual(out.stats, input.stats);
});

test("a realistic garden lays out with finite coordinates and no overlap", () => {
  const nodes = [
    n("plant:a", "plant"),
    n("pod:p1", "pod"), n("pod:p2", "pod"), n("pod:p3", "pod"),
    n("bean:b1", "bean"), n("bean:b2", "bean"), n("bean:b3", "bean"),
    n("bean:b4", "bean"), n("bean:shared", "bean"),
    n("sprout:draft", "sprout"),
    n("bucket:unrooted", "bucket"), n("sprout:orphan", "sprout"),
    n("bucket:inbox", "bucket"), n("seed:1", "seed"), n("seed:2", "seed"),
  ];
  const out = layoutGardenMap(
    map(nodes, [
      ["plant:a", "pod:p1"], ["plant:a", "pod:p2"], ["plant:a", "pod:p3"],
      ["pod:p1", "bean:b1"], ["pod:p1", "bean:shared"],
      ["pod:p2", "bean:b2"], ["pod:p2", "bean:shared"],
      ["pod:p3", "bean:b3"], ["pod:p3", "bean:b4"],
      ["plant:a", "sprout:draft"],
      ["bucket:unrooted", "sprout:orphan"],
      ["bucket:inbox", "seed:1"], ["bucket:inbox", "seed:2"],
    ]),
  );
  assert.equal(out.nodes.length, nodes.length);
  for (const node of out.nodes) {
    assert.ok(Number.isFinite(node.x), `${node.id} x`);
    assert.ok(Number.isFinite(node.y), `${node.id} y`);
  }
  for (let i = 0; i < out.nodes.length; i++) {
    for (let j = i + 1; j < out.nodes.length; j++) {
      assert.equal(overlaps(out.nodes[i], out.nodes[j]), false, `${out.nodes[i].id} vs ${out.nodes[j].id}`);
    }
  }
});
