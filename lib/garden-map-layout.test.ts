import { test } from "node:test";
import assert from "node:assert/strict";
import type { GardenMap, MapNode, MapNodeKind } from "./garden-map";
import { KIND_SIZE, LAYOUT, layoutGardenMap, type PositionedMap, type PositionedNode } from "./garden-map-layout";

function n(id: string, kind: MapNodeKind): MapNode {
  return { id, kind, label: id, waiting: false, gaps: [], dim: false };
}
function map(nodes: MapNode[], pairs: Array<[string, string]>): GardenMap {
  return {
    nodes,
    edges: pairs.map(([source, target]) => ({ id: `${source}>${target}`, source, target })),
    stats: { total: 0, waiting: 0, gaps: 0 },
  };
}
function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function at(out: PositionedMap, id: string): PositionedNode {
  const found = out.nodes.find((node) => node.id === id);
  assert.ok(found, `${id} is positioned`);
  return found;
}
function assertNoOverlap(out: PositionedMap): void {
  for (let i = 0; i < out.nodes.length; i++) {
    for (let j = i + 1; j < out.nodes.length; j++) {
      assert.equal(overlaps(out.nodes[i], out.nodes[j]), false, `${out.nodes[i].id} vs ${out.nodes[j].id}`);
    }
  }
}

const ROW_Y = KIND_SIZE.plant.height + LAYOUT.ROW_GAP;

/** Several plants, pods with many beans, a bean shared by two pods, a plant's
 *  own bean and sprout, a bean's draft sprout and seed count, and both buckets. */
function realistic(): GardenMap {
  const nodes = [
    n("plant:a", "plant"), n("plant:b", "plant"), n("plant:lonely", "plant"),
    n("pod:a1", "pod"), n("pod:a2", "pod"), n("pod:a3", "pod"),
    n("bean:a1x", "bean"), n("bean:a1y", "bean"), n("bean:a1z", "bean"),
    n("bean:shared", "bean"), n("bean:a2x", "bean"), n("bean:a3x", "bean"),
    n("bean:a-direct", "bean"), n("sprout:a-draft", "sprout"),
    n("sprout:a1x-draft", "sprout"), n("seeds:bean:a1x", "seed"),
    n("pod:b1", "pod"), n("bean:b1x", "bean"),
    n("bucket:unrooted", "bucket"), n("sprout:orphan", "sprout"),
    n("bucket:inbox", "bucket"), n("seeds:inbox", "seed"),
  ];
  return map(nodes, [
    ["plant:a", "pod:a1"], ["plant:a", "pod:a2"], ["plant:a", "pod:a3"],
    ["plant:a", "bean:a-direct"], ["plant:a", "sprout:a-draft"],
    ["pod:a1", "bean:a1x"], ["pod:a1", "bean:a1y"], ["pod:a1", "bean:a1z"], ["pod:a1", "bean:shared"],
    ["pod:a2", "bean:a2x"], ["pod:a2", "bean:shared"],
    ["pod:a3", "bean:a3x"],
    ["bean:a1x", "sprout:a1x-draft"], ["bean:a1x", "seeds:bean:a1x"],
    ["plant:b", "pod:b1"], ["pod:b1", "bean:b1x"],
    ["bucket:unrooted", "sprout:orphan"],
    ["bucket:inbox", "seeds:inbox"],
  ]);
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

test("the layout constants are the ones the spec names", () => {
  assert.deepEqual(
    { ...LAYOUT },
    { INDENT: 28, COLUMN_GAP: 24, BLOCK_GAP: 64, ROW_GAP: 56, ITEM_GAP: 12, COLUMN_WIDTH: 28 + 260 },
  );
});

test("plants share y = 0 and run left to right in input order", () => {
  const out = layoutGardenMap(realistic());
  const plants = ["plant:a", "plant:b", "plant:lonely"].map((id) => at(out, id));
  for (const plant of plants) assert.equal(plant.y, 0);
  assert.equal(plants[0].x, 0);
  assert.ok(plants[1].x > plants[0].x);
  assert.ok(plants[2].x > plants[1].x);
});

test("the pods of a plant share one row below it and run left to right", () => {
  const out = layoutGardenMap(realistic());
  const pods = ["pod:a1", "pod:a2", "pod:a3"].map((id) => at(out, id));
  for (const pod of pods) assert.equal(pod.y, ROW_Y);
  assert.ok(pods[0].x < pods[1].x && pods[1].x < pods[2].x);
  assert.ok(ROW_Y >= at(out, "plant:a").y + at(out, "plant:a").height);
});

test("pods of different plants share one row, so rows align across plants", () => {
  const out = layoutGardenMap(realistic());
  assert.equal(at(out, "pod:b1").y, at(out, "pod:a1").y);
});

test("the beans of a pod form one column under it, indented, never overlapping", () => {
  const out = layoutGardenMap(realistic());
  const pod = at(out, "pod:a1");
  const beans = ["bean:a1x", "bean:a1y", "bean:a1z", "bean:shared"].map((id) => at(out, id));
  // a1x also carries a sprout and a seed count, so only the beans' own order is
  // asserted, not adjacency.
  for (const bean of beans) assert.equal(bean.x, pod.x + LAYOUT.INDENT);
  for (let i = 1; i < beans.length; i++) {
    assert.ok(beans[i].y >= beans[i - 1].y + beans[i - 1].height, `${beans[i].id} below ${beans[i - 1].id}`);
  }
  assert.equal(beans[0].y, pod.y + pod.height + LAYOUT.ITEM_GAP);
});

test("a bean's draft sprout and seed count sit directly under it, indented once more", () => {
  const out = layoutGardenMap(realistic());
  const bean = at(out, "bean:a1x");
  const sprout = at(out, "sprout:a1x-draft");
  const seeds = at(out, "seeds:bean:a1x");
  assert.equal(sprout.x, bean.x + LAYOUT.INDENT);
  assert.equal(seeds.x, bean.x + LAYOUT.INDENT);
  assert.equal(sprout.y, bean.y + bean.height + LAYOUT.ITEM_GAP);
  assert.equal(seeds.y, sprout.y + sprout.height + LAYOUT.ITEM_GAP);
  // The next bean starts after them, not between.
  assert.equal(at(out, "bean:a1y").y, seeds.y + seeds.height + LAYOUT.ITEM_GAP);
});

test("a plant's own beans and sprouts are a first column with no head, indented under the plant row", () => {
  const out = layoutGardenMap(realistic());
  const plant = at(out, "plant:a");
  const direct = at(out, "bean:a-direct");
  const sprout = at(out, "sprout:a-draft");
  const firstPod = at(out, "pod:a1");
  assert.equal(direct.y, ROW_Y);
  assert.equal(direct.x, plant.x + LAYOUT.INDENT);
  assert.equal(sprout.x, plant.x + LAYOUT.INDENT);
  assert.equal(sprout.y, direct.y + direct.height + LAYOUT.ITEM_GAP);
  // The pods start to its right, one column over.
  assert.equal(firstPod.x, plant.x + LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP);
});

test("a bean with two parents is placed once, under its first, and keeps its second edge", () => {
  const out = layoutGardenMap(realistic());
  assert.equal(out.nodes.filter((node) => node.id === "bean:shared").length, 1);
  const shared = at(out, "bean:shared");
  assert.equal(shared.x, at(out, "pod:a1").x + LAYOUT.INDENT);
  const second = out.edges.find((edge) => edge.id === "pod:a2>bean:shared");
  assert.ok(second, "the second parent's edge is still drawn");
  assert.equal(second.sourceHandle, "trunk");
  assert.equal(second.targetHandle, "left");
});

test("the Unrooted and Inbox buckets come after every plant and keep their children below", () => {
  const out = layoutGardenMap(realistic());
  const lastPlant = ["plant:a", "plant:b", "plant:lonely"].map((id) => at(out, id)).reduce((a, b) => (a.x > b.x ? a : b));
  const unrooted = at(out, "bucket:unrooted");
  const inbox = at(out, "bucket:inbox");
  assert.ok(unrooted.x > lastPlant.x + lastPlant.width);
  assert.ok(inbox.x > unrooted.x);
  assert.equal(unrooted.y, 0);
  assert.equal(inbox.y, 0);
  const orphan = at(out, "sprout:orphan");
  assert.equal(orphan.y, ROW_Y);
  assert.equal(orphan.x, unrooted.x + LAYOUT.INDENT);
  assert.equal(at(out, "seeds:inbox").y, ROW_Y);
});

test("plant-to-pod edges leave the bottom and enter the top; every other edge is trunk to left", () => {
  const out = layoutGardenMap(realistic());
  for (const edge of out.edges) {
    const source = at(out, edge.source);
    const target = at(out, edge.target);
    const plantToPod = target.kind === "pod" && (source.kind === "plant" || source.kind === "bucket");
    assert.equal(edge.sourceHandle, plantToPod ? "bottom" : "trunk", edge.id);
    assert.equal(edge.targetHandle, plantToPod ? "top" : "left", edge.id);
  }
  assert.equal(out.edges.find((e) => e.id === "plant:a>pod:a1")?.sourceHandle, "bottom");
  assert.equal(out.edges.find((e) => e.id === "plant:a>bean:a-direct")?.sourceHandle, "trunk");
  assert.equal(out.edges.find((e) => e.id === "pod:a1>bean:a1x")?.targetHandle, "left");
});

test("edges keep their id, source and target", () => {
  const input = realistic();
  const out = layoutGardenMap(input);
  assert.deepEqual(
    out.edges.map(({ id, source, target }) => ({ id, source, target })),
    input.edges,
  );
});

test("a realistic garden lays out with finite coordinates and no overlap", () => {
  const out = layoutGardenMap(realistic());
  for (const node of out.nodes) {
    assert.ok(Number.isFinite(node.x), `${node.id} x`);
    assert.ok(Number.isFinite(node.y), `${node.id} y`);
  }
  assertNoOverlap(out);
});

test("every input node appears exactly once, even one no root reaches", () => {
  const input = realistic();
  // A cycle (no node of it is a root) and a node whose parent does not exist.
  input.nodes.push(n("bean:c1", "bean"), n("bean:c2", "bean"), n("bean:ghost-child", "bean"));
  input.edges.push(
    { id: "bean:c1>bean:c2", source: "bean:c1", target: "bean:c2" },
    { id: "bean:c2>bean:c1", source: "bean:c2", target: "bean:c1" },
    { id: "bean:ghost>bean:ghost-child", source: "bean:ghost", target: "bean:ghost-child" },
  );
  const out = layoutGardenMap(input);
  assert.deepEqual(out.nodes.map((node) => node.id).sort(), input.nodes.map((node) => node.id).sort());
  assertNoOverlap(out);
});

test("an empty map lays out to an empty map", () => {
  const out = layoutGardenMap(map([], []));
  assert.deepEqual(out.nodes, []);
  assert.deepEqual(out.edges, []);
});

test("a lone plant is just its card", () => {
  const out = layoutGardenMap(map([n("plant:a", "plant")], []));
  assert.equal(out.nodes[0].x, 0);
  assert.equal(out.nodes[0].y, 0);
});

test("layout is deterministic", () => {
  assert.deepEqual(layoutGardenMap(realistic()), layoutGardenMap(realistic()));
});

test("layout keeps the builder's flags, stats and counts untouched", () => {
  const input = map(
    [
      { ...n("plant:a", "plant"), waiting: true, gaps: ["no-fr"], dim: true },
      { ...n("seeds:plant:a", "seed"), count: 62 },
    ],
    [["plant:a", "seeds:plant:a"]],
  );
  input.stats = { total: 5, waiting: 1, gaps: 2 };
  const out = layoutGardenMap(input);
  assert.equal(out.nodes[0].waiting, true);
  assert.deepEqual(out.nodes[0].gaps, ["no-fr"]);
  assert.equal(out.nodes[0].dim, true);
  assert.equal(out.nodes[1].count, 62);
  assert.deepEqual(out.stats, input.stats);
});

test("a run does not mutate the exported size and layout tables", () => {
  const sizes = JSON.stringify(KIND_SIZE);
  const layout = JSON.stringify(LAYOUT);
  layoutGardenMap(realistic());
  assert.equal(JSON.stringify(KIND_SIZE), sizes);
  assert.equal(JSON.stringify(LAYOUT), layout);
});
