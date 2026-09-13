import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";
import { planGarden, renderPlan, type GardenSlugs } from "./garden-plan";

const EMPTY_GARDEN: GardenSlugs = { pods: [], beans: [], sprouts: [] };

const ONE_BEAN_YAML = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A pod }
beans:
  - slug: bean-a
    name: { en: Bean A }
    description: { en: First bean }
    sprouts:
      - slug: sprout-a
        type: note
        date: "2026-01-01"
        name: { en: Sprout A }
        description: { en: First sprout }
`;

const TWO_BEAN_YAML = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A pod }
beans:
  - slug: bean-a
    name: { en: Bean A }
    description: { en: First bean }
    sprouts:
      - slug: sprout-a
        type: note
        date: "2026-01-01"
        name: { en: Sprout A }
        description: { en: First sprout }
  - slug: bean-b
    name: { en: Bean B }
    description: { en: Second bean }
    sprouts:
      - slug: sprout-b
        type: note
        date: "2026-01-02"
        name: { en: Sprout B }
        description: { en: Second sprout }
`;

function parse(yaml: string) {
  const result = parseManifest(yaml);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.manifest;
}

test("empty garden plans create for pod, bean and sprout in order", () => {
  const manifest = parse(ONE_BEAN_YAML);
  const actions = planGarden(manifest, EMPTY_GARDEN, { update: false });
  assert.deepEqual(
    actions.map((a) => [a.action, a.tier, a.slug]),
    [
      ["create", "pod", "krabs"],
      ["create", "bean", "bean-a"],
      ["create", "sprout", "sprout-a"],
    ]
  );
});

test("existing slugs are skipped, not touched; new sprout under existing bean is still created", () => {
  const manifest = parse(ONE_BEAN_YAML);
  const garden: GardenSlugs = {
    pods: [{ slug: "krabs" } as any],
    beans: [{ slug: "bean-a" } as any],
    sprouts: [],
  };
  const actions = planGarden(manifest, garden, { update: false });
  assert.deepEqual(
    actions.map((a) => [a.action, a.tier, a.slug]),
    [
      ["skip", "pod", "krabs"],
      ["skip", "bean", "bean-a"],
      ["create", "sprout", "sprout-a"],
    ]
  );
});

test("{ update: true } turns a skip into an update", () => {
  const manifest = parse(ONE_BEAN_YAML);
  const garden: GardenSlugs = {
    pods: [{ slug: "krabs" } as any],
    beans: [{ slug: "bean-a" } as any],
    sprouts: [{ slug: "sprout-a" } as any],
  };
  const actions = planGarden(manifest, garden, { update: true });
  assert.deepEqual(
    actions.map((a) => [a.action, a.tier, a.slug]),
    [
      ["update", "pod", "krabs"],
      ["update", "bean", "bean-a"],
      ["update", "sprout", "sprout-a"],
    ]
  );
});

test("ordering interleaves per bean: bean A, sprout A, bean B, sprout B", () => {
  const manifest = parse(TWO_BEAN_YAML);
  const actions = planGarden(manifest, EMPTY_GARDEN, { update: false });
  assert.deepEqual(
    actions.map((a) => [a.tier, a.slug]),
    [
      ["pod", "krabs"],
      ["bean", "bean-a"],
      ["sprout", "sprout-a"],
      ["bean", "bean-b"],
      ["sprout", "sprout-b"],
    ]
  );
});

test("parentSlug is set correctly: absent on pod, pod's slug on bean, bean's slug on sprout", () => {
  const manifest = parse(TWO_BEAN_YAML);
  const actions = planGarden(manifest, EMPTY_GARDEN, { update: false });
  const bySlug = new Map(actions.map((a) => [a.slug, a]));
  assert.equal(bySlug.get("krabs")?.parentSlug, undefined);
  assert.equal(bySlug.get("bean-a")?.parentSlug, "krabs");
  assert.equal(bySlug.get("bean-b")?.parentSlug, "krabs");
  assert.equal(bySlug.get("sprout-a")?.parentSlug, "bean-a");
  assert.equal(bySlug.get("sprout-b")?.parentSlug, "bean-b");
});

test("renderPlan output contains the summary counts", () => {
  const manifest = parse(ONE_BEAN_YAML);
  const garden: GardenSlugs = {
    pods: [{ slug: "krabs" } as any],
    beans: [],
    sprouts: [],
  };
  const actions = planGarden(manifest, garden, { update: false });
  // pod: skip, bean: create, sprout: create
  const output = renderPlan(actions);
  assert.match(output, /2 creates?/);
  assert.match(output, /1 skips?/);
  assert.match(output, /0 updates?/);
  assert.match(output, /skip.*pod.*krabs/i);
  assert.match(output, /create.*bean.*bean-a/i);
});
