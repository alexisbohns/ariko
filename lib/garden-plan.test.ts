import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";
import { planGarden, renderPlan, keepsPublishedNarrative, type GardenSlugs } from "./garden-plan";

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
    kind: log
    date: "2026-01-01"
    about: [bean-a]
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
  - slug: bean-b
    name: { en: Bean B }
    description: { en: Second bean }
sprouts:
  - slug: sprout-a
    kind: log
    date: "2026-01-01"
    about: [bean-a]
    name: { en: Sprout A }
    description: { en: First sprout }
  - slug: sprout-b
    kind: log
    date: "2026-01-02"
    about: [bean-b]
    name: { en: Sprout B }
    description: { en: Second sprout }
`;

function parse(yaml: string) {
  const result = parseManifest(yaml);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
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

test("{ update: true } still plans create for an entity the garden does not have", () => {
  const manifest = parse(ONE_BEAN_YAML);
  // The pod is there, the bean and sprout are not. `--update` is a permission to
  // overwrite what EXISTS, never an instruction to update-in-place something
  // that does not: an `update` verb here would reach `updateBeanMeta` on a slug
  // no document carries, write nothing, and print a line saying it had.
  const garden: GardenSlugs = { pods: [{ slug: "krabs" } as any], beans: [], sprouts: [] };
  const actions = planGarden(manifest, garden, { update: true });
  assert.deepEqual(
    actions.map((a) => [a.action, a.tier, a.slug]),
    [
      ["update", "pod", "krabs"],
      ["create", "bean", "bean-a"],
      ["create", "sprout", "sprout-a"],
    ]
  );
});

test("ordering: pod, every bean, then every sprout, in manifest order", () => {
  const manifest = parse(TWO_BEAN_YAML);
  const actions = planGarden(manifest, EMPTY_GARDEN, { update: false });
  assert.deepEqual(
    actions.map((a) => [a.tier, a.slug]),
    [
      ["pod", "krabs"],
      ["bean", "bean-a"],
      ["bean", "bean-b"],
      ["sprout", "sprout-a"],
      ["sprout", "sprout-b"],
    ]
  );
});

test("parentSlug: absent on pod and sprout, the pod's slug on a bean; a sprout carries about instead", () => {
  const manifest = parse(TWO_BEAN_YAML);
  const actions = planGarden(manifest, EMPTY_GARDEN, { update: false });
  const find = (slug: string) => {
    const found = actions.find((a) => a.slug === slug);
    assert.ok(found, `no action for ${slug}`);
    return found;
  };
  // `parentSlug` exists on the bean member of the union only, so it is read
  // through the tier rather than off a widened action — which is the point of
  // the union: the pod and the sprout cannot even be asked the question.
  const parentOf = (slug: string) => {
    const found = find(slug);
    return found.tier === "bean" ? found.parentSlug : undefined;
  };
  assert.equal("parentSlug" in find("krabs"), false);
  assert.equal(parentOf("bean-a"), "krabs");
  assert.equal(parentOf("bean-b"), "krabs");
  // A sprout is not CONTAINED, it is ABOUT: no parentSlug on the action, and
  // the parser's prefixed refs on the entry, which the applier writes verbatim.
  const aboutOf = (slug: string) => {
    const found = find(slug);
    assert.equal(found.tier, "sprout");
    assert.equal("parentSlug" in found, false);
    return found.tier === "sprout" ? found.entry.about : undefined;
  };
  assert.deepEqual(aboutOf("sprout-a"), ["bean:bean-a"]);
  assert.deepEqual(aboutOf("sprout-b"), ["bean:bean-b"]);
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
  // The verbs form a column: every tier word starts at the same offset within
  // its indent level, which is what makes a stray verb scannable.
  const [podLine, beanLine, sproutLine] = output.split("\n");
  assert.equal(podLine, "skip   pod krabs");
  assert.equal(beanLine, "  create bean bean-a");
  // A sprout line also says what it is ABOUT, so a human approving the plan
  // sees the anchor the entry will be written with.
  assert.match(output, /sprout sprout-a about bean:bean-a/);
  assert.equal(sproutLine, "    create sprout sprout-a about bean:bean-a");
});

test("an update of a PUBLIC pod or bean carrying manifest content is marked narrativeKept, and the tree says so", () => {
  const yaml = ONE_BEAN_YAML.replace("  description: { en: A pod }", "  description: { en: A pod }\n  content: { en: Pod prose }").replace(
    "    description: { en: First bean }",
    "    description: { en: First bean }\n    content: { en: Bean prose }",
  );
  const manifest = parse(yaml);
  const garden: GardenSlugs = {
    pods: [{ slug: "krabs", visibility: "public" } as any],
    beans: [{ slug: "bean-a", visibility: "private" } as any],
    sprouts: [],
  };
  const actions = planGarden(manifest, garden, { update: true });
  const [pod, bean] = actions;
  assert.equal(pod.action, "update");
  assert.equal("narrativeKept" in pod && pod.narrativeKept, true);
  // Private: the manifest's text wins, nothing is kept.
  assert.equal(bean.action, "update");
  assert.equal("narrativeKept" in bean, false);

  const output = renderPlan(actions);
  assert.equal(output.split("\n")[0], "update pod krabs (narrative kept: published)");
  assert.equal(output.split("\n")[1], "  update bean bean-a");

  // Without --update the pod is a skip, and a skip keeps nothing to say.
  const skipped = planGarden(manifest, garden, { update: false });
  assert.equal("narrativeKept" in skipped[0], false);
  // A public entity whose manifest entry carries NO content has nothing to keep either.
  assert.equal(keepsPublishedNarrative("update", {}, { visibility: "public" }), false);
  // An absent visibility is not a publish — strict, like /api/articles.
  assert.equal(keepsPublishedNarrative("update", { content: "x" }, { slug: "p" } as any), false);
  assert.equal(keepsPublishedNarrative("create", { content: "x" }, { visibility: "public" }), false);
});
