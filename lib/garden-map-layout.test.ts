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
const cx = (node: { x: number; width: number }): number => node.x + node.width / 2;
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


/** A plant whose nine beans hang directly off it, two of them with a draft
 *  sprout, and no pods. */
function wide(): GardenMap {
  const ids = Array.from({ length: 9 }, (_, i) => `bean:w${i + 1}`);
  return map(
    [n("plant:wide", "plant"), ...ids.map((id) => n(id, "bean")), n("sprout:w2", "sprout"), n("seeds:bean:w5", "seed")],
    [
      ...ids.map((id): [string, string] => ["plant:wide", id]),
      ["bean:w2", "sprout:w2"],
      ["bean:w5", "seeds:bean:w5"],
    ],
  );
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

test("the sizes and spacing are the ones the design names", () => {
  assert.deepEqual(
    { ...KIND_SIZE },
    {
      plant: { width: 300, height: 88 },
      pod: { width: 220, height: 124 },
      bean: { width: 220, height: 60 },
      sprout: { width: 180, height: 44 },
      seed: { width: 180, height: 44 },
      bucket: { width: 150, height: 44 },
    },
  );
  assert.deepEqual(
    { ...LAYOUT },
    {
      COLUMN_WIDTH: 220,
      COLUMN_GAP: 28,
      BLOCK_GAP: 96,
      ROW_GAP: 72,
      ITEM_GAP: 28,
      LOOSE_COLS_WITH_PODS: 2,
      LOOSE_COLS_ALONE: 4,
    },
  );
});

test("plants share y = 0 and run left to right in input order", () => {
  const out = layoutGardenMap(realistic());
  const plants = ["plant:a", "plant:b", "plant:lonely"].map((id) => at(out, id));
  for (const plant of plants) assert.equal(plant.y, 0);
  assert.ok(plants[1].x > plants[0].x + plants[0].width, "blocks do not touch");
  assert.ok(plants[2].x > plants[1].x);
});

test("a root is centred over its block", () => {
  const out = layoutGardenMap(realistic());
  // Plant b has one pod column, narrower than the plant card: the pod is under
  // the plant's centre.
  assert.ok(Math.abs(cx(at(out, "plant:b")) - cx(at(out, "pod:b1"))) < 0.5);
  // Plant a's content is wider than its card: the card sits over the middle of
  // everything that hangs from it.
  const below = [
    "pod:a1", "pod:a2", "pod:a3", "bean:a-direct", "sprout:a-draft", "bean:a1x", "bean:a1y", "bean:a1z",
    "bean:shared", "bean:a2x", "bean:a3x", "sprout:a1x-draft", "seeds:bean:a1x",
  ].map((id) => at(out, id));
  const left = Math.min(...below.map((node) => node.x));
  const right = Math.max(...below.map((node) => node.x + node.width));
  assert.ok(Math.abs(cx(at(out, "plant:a")) - (left + right) / 2) < 0.5);
});

test("the pods of a plant share one row below it and run left to right", () => {
  const out = layoutGardenMap(realistic());
  const pods = ["pod:a1", "pod:a2", "pod:a3"].map((id) => at(out, id));
  for (const pod of pods) assert.equal(pod.y, ROW_Y);
  assert.ok(pods[0].x < pods[1].x && pods[1].x < pods[2].x);
  assert.equal(pods[1].x - pods[0].x, LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP);
  assert.ok(ROW_Y >= at(out, "plant:a").y + at(out, "plant:a").height);
});

test("pods of different plants share one row, so rows align across plants", () => {
  const out = layoutGardenMap(realistic());
  assert.equal(at(out, "pod:b1").y, at(out, "pod:a1").y);
});

test("everything in a pod's column shares its centre and stacks downward with the item gap", () => {
  const out = layoutGardenMap(realistic());
  const column = ["pod:a1", "bean:a1x", "sprout:a1x-draft", "seeds:bean:a1x", "bean:a1y", "bean:a1z", "bean:shared"].map((id) =>
    at(out, id),
  );
  for (const item of column) assert.ok(Math.abs(cx(item) - cx(column[0])) < 0.5, `${item.id} is centred in the column`);
  for (let i = 1; i < column.length; i++) {
    assert.equal(column[i].y, column[i - 1].y + column[i - 1].height + LAYOUT.ITEM_GAP, `${column[i].id} follows ${column[i - 1].id}`);
  }
  assert.equal(column[0].y, ROW_Y);
});

test("no card is indented: a bean is centred where its pod is", () => {
  const out = layoutGardenMap(realistic());
  assert.equal(at(out, "bean:a1y").x, at(out, "pod:a1").x);
  assert.equal(at(out, "sprout:a1x-draft").x, at(out, "pod:a1").x + (LAYOUT.COLUMN_WIDTH - KIND_SIZE.sprout.width) / 2);
});

test("a bean's draft sprout and seed count sit directly under it, on its centre", () => {
  const out = layoutGardenMap(realistic());
  const bean = at(out, "bean:a1x");
  const sprout = at(out, "sprout:a1x-draft");
  const seeds = at(out, "seeds:bean:a1x");
  assert.ok(Math.abs(cx(sprout) - cx(bean)) < 0.5);
  assert.ok(Math.abs(cx(seeds) - cx(bean)) < 0.5);
  assert.equal(sprout.y, bean.y + bean.height + LAYOUT.ITEM_GAP);
  assert.equal(seeds.y, sprout.y + sprout.height + LAYOUT.ITEM_GAP);
  // The next bean starts after them, not between.
  assert.equal(at(out, "bean:a1y").y, seeds.y + seeds.height + LAYOUT.ITEM_GAP);
});

test("nine direct beans and no pods fan out as a grid, four across, under the plant", () => {
  const out = layoutGardenMap(wide());
  const beans = Array.from({ length: 9 }, (_, i) => at(out, `bean:w${i + 1}`));
  assert.equal(new Set(beans.map((bean) => bean.x)).size, 4, "four columns");
  assert.equal(new Set(beans.map((bean) => bean.y)).size, 3, "three rows");
  // Row-major in input order: the first four share the first row.
  for (const bean of beans.slice(0, 4)) assert.equal(bean.y, ROW_Y);
  assert.ok(beans[0].x < beans[1].x && beans[1].x < beans[2].x && beans[2].x < beans[3].x);
  assert.equal(beans[1].x - beans[0].x, LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP);
  assert.equal(beans[4].x, beans[0].x);
  assert.ok(beans[4].y > beans[0].y);
  // Centred under the plant: the grid's four columns straddle its centre.
  const plant = at(out, "plant:wide");
  const left = Math.min(...beans.map((bean) => bean.x));
  const right = Math.max(...beans.map((bean) => bean.x + bean.width));
  assert.ok(Math.abs(cx(plant) - (left + right) / 2) < 0.5);
  assert.equal(plant.y, 0);
});

test("a grid row is as tall as its tallest cell, and rows are two item gaps apart", () => {
  const out = layoutGardenMap(wide());
  // Bean 2 carries a draft sprout, so the first row is one sprout taller than a bare bean.
  const row1Height = KIND_SIZE.bean.height + LAYOUT.ITEM_GAP + KIND_SIZE.sprout.height;
  assert.equal(at(out, "bean:w5").y, ROW_Y + row1Height + LAYOUT.ITEM_GAP * 2);
  // Bean 5 carries a seed count: the second row is taller by one seed card.
  const row2Height = KIND_SIZE.bean.height + LAYOUT.ITEM_GAP + KIND_SIZE.seed.height;
  assert.equal(at(out, "bean:w9").y, at(out, "bean:w5").y + row2Height + LAYOUT.ITEM_GAP * 2);
  assert.equal(at(out, "sprout:w2").y, at(out, "bean:w2").y + KIND_SIZE.bean.height + LAYOUT.ITEM_GAP);
});

test("with pods present a plant's own beans are a two-column grid to the LEFT of the pods", () => {
  const nodes = [n("plant:p", "plant"), n("pod:p1", "pod"), n("pod:p2", "pod")];
  const pairs: Array<[string, string]> = [["plant:p", "pod:p1"], ["plant:p", "pod:p2"]];
  for (let i = 1; i <= 5; i++) {
    nodes.push(n(`bean:d${i}`, "bean"));
    pairs.push(["plant:p", `bean:d${i}`]);
  }
  const out = layoutGardenMap(map(nodes, pairs));
  const beans = [1, 2, 3, 4, 5].map((i) => at(out, `bean:d${i}`));
  assert.equal(new Set(beans.map((bean) => bean.x)).size, 2, "two columns");
  assert.equal(new Set(beans.map((bean) => bean.y)).size, 3, "three rows");
  assert.equal(beans[0].y, ROW_Y);
  const rightmost = Math.max(...beans.map((bean) => bean.x + bean.width));
  const firstPod = at(out, "pod:p1");
  assert.equal(firstPod.x, rightmost + LAYOUT.COLUMN_GAP);
  assert.equal(firstPod.y, ROW_Y);
  assert.ok(at(out, "pod:p2").x > firstPod.x);
  assertNoOverlap(out);
});

test("fewer cells than columns use only the columns they need", () => {
  const out = layoutGardenMap(
    map([n("plant:a", "plant"), n("bean:x", "bean"), n("bean:y", "bean")], [["plant:a", "bean:x"], ["plant:a", "bean:y"]]),
  );
  const x = at(out, "bean:x");
  const y = at(out, "bean:y");
  assert.equal(x.y, y.y);
  assert.equal(y.x - x.x, LAYOUT.COLUMN_WIDTH + LAYOUT.COLUMN_GAP);
  assert.ok(Math.abs(cx(at(out, "plant:a")) - (x.x + y.x + y.width) / 2) < 0.5);
});

test("a plant's own sprout is a loose cell like its beans", () => {
  const out = layoutGardenMap(realistic());
  const direct = at(out, "bean:a-direct");
  const sprout = at(out, "sprout:a-draft");
  assert.equal(direct.y, ROW_Y);
  assert.equal(sprout.y, ROW_Y);
  assert.ok(sprout.x > direct.x);
  assert.ok(sprout.x + sprout.width <= at(out, "pod:a1").x, "left of the pods");
});

test("a bean with two parents is placed once, under its first, and keeps its second edge", () => {
  const out = layoutGardenMap(realistic());
  assert.equal(out.nodes.filter((node) => node.id === "bean:shared").length, 1);
  assert.ok(Math.abs(cx(at(out, "bean:shared")) - cx(at(out, "pod:a1"))) < 0.5);
  assert.ok(out.edges.some((edge) => edge.id === "pod:a2>bean:shared"), "the second parent's edge is still drawn");
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
  assert.ok(Math.abs(cx(orphan) - cx(unrooted)) < 0.5);
  assert.equal(at(out, "seeds:inbox").y, ROW_Y);
});

test("edges are exactly the input edges, with no handle fields", () => {
  const input = realistic();
  const out = layoutGardenMap(input);
  assert.deepEqual(out.edges, input.edges);
  for (const edge of out.edges) assert.deepEqual(Object.keys(edge).sort(), ["id", "source", "target"]);
});

test("a realistic garden lays out with finite coordinates and no overlap", () => {
  const input = realistic();
  const extra = wide();
  input.nodes.push(...extra.nodes);
  input.edges.push(...extra.edges);
  const out = layoutGardenMap(input);
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

test("layout keeps the builder's flags, stats, counts and images untouched", () => {
  const input = map(
    [
      { ...n("plant:a", "plant"), waiting: true, gaps: ["no-fr"], dim: true, image: "https://img.test/a.png" },
      { ...n("seeds:plant:a", "seed"), count: 62 },
    ],
    [["plant:a", "seeds:plant:a"]],
  );
  input.stats = { total: 5, waiting: 1, gaps: 2 };
  const out = layoutGardenMap(input);
  assert.equal(out.nodes[0].waiting, true);
  assert.deepEqual(out.nodes[0].gaps, ["no-fr"]);
  assert.equal(out.nodes[0].dim, true);
  assert.equal(out.nodes[0].image, "https://img.test/a.png");
  assert.equal(out.nodes[1].count, 62);
  assert.deepEqual(out.stats, input.stats);
});

test("a run does not mutate the exported size and layout tables", () => {
  const sizes = JSON.stringify(KIND_SIZE);
  const layout = JSON.stringify(LAYOUT);
  layoutGardenMap(realistic());
  layoutGardenMap(wide());
  assert.equal(JSON.stringify(KIND_SIZE), sizes);
  assert.equal(JSON.stringify(LAYOUT), layout);
});
