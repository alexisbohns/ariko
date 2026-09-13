import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLineage, ADMIN_HREFS, PUBLIC_HREFS } from "@/lib/lineage";
import type { Bean, Plant, Pod } from "@/lib/data";

const plant = (slug: string, name: string, logo?: string): Plant =>
  ({ slug, name, description: "", role: { kind: "owner" }, ...(logo ? { logo: { url: logo } } : {}) }) as unknown as Plant;
const pod = (slug: string, name: string, parents: string[]): Pod =>
  ({ slug, name, description: "", parents }) as unknown as Pod;
const bean = (slug: string, name: string, parents: string[]): Bean =>
  ({ slug, name, parents }) as unknown as Bean;

const GARDEN = {
  plants: [plant("pbbls", "pbbls", "https://res.cloudinary.com/demo/image/upload/v1/p.png")],
  pods: [pod("pbbls-karma", "Karma", ["plant:pbbls"])],
  beans: [
    bean("pbbls-d8", "D8", ["pod:pbbls-karma"]),
    bean("pbbls-loose", "Loose", ["plant:pbbls"]),
  ],
};

test("a sprout climbs bean → pod → plant, outermost first", () => {
  const lineage = resolveLineage(["bean:pbbls-d8"], GARDEN, { lang: "en", hrefs: ADMIN_HREFS });
  assert.deepEqual(lineage.map((tier) => tier.kind), ["plant", "pod", "bean"]);
  assert.deepEqual(lineage[0].entries, [
    { slug: "pbbls", name: "pbbls", href: "/admin/plant/pbbls", logoUrl: "https://res.cloudinary.com/demo/image/upload/v1/p.png" },
  ]);
  assert.deepEqual(lineage[1].entries[0].href, "/admin/pod/pbbls-karma");
  assert.deepEqual(lineage[2].entries[0].href, "/admin/bean/pbbls-d8");
});

test("a pod-less bean omits the pod tier rather than rendering it empty", () => {
  const lineage = resolveLineage(["plant:pbbls"], GARDEN, { lang: "en", hrefs: PUBLIC_HREFS });
  assert.deepEqual(lineage.map((tier) => tier.kind), ["plant"]);
  assert.equal(lineage[0].entries[0].href, "/plant/pbbls");
});

test("a dangling ref is dropped, exactly as publishCascade drops one", () => {
  const lineage = resolveLineage(["bean:ghost", "bean:pbbls-d8"], GARDEN, { lang: "en", hrefs: ADMIN_HREFS });
  const beans = lineage.find((tier) => tier.kind === "bean");
  assert.deepEqual(beans?.entries.map((e) => e.slug), ["pbbls-d8"]);
});

test("two beans under one pod list the pod once", () => {
  const garden = { ...GARDEN, beans: [...GARDEN.beans, bean("pbbls-d9", "D9", ["pod:pbbls-karma"])] };
  const lineage = resolveLineage(["bean:pbbls-d8", "bean:pbbls-d9"], garden, { lang: "en", hrefs: ADMIN_HREFS });
  assert.deepEqual(lineage.find((t) => t.kind === "pod")?.entries.map((e) => e.slug), ["pbbls-karma"]);
  assert.deepEqual(lineage.find((t) => t.kind === "bean")?.entries.map((e) => e.slug), ["pbbls-d8", "pbbls-d9"]);
});

test("a bilingual name resolves to the reading language", () => {
  const garden = { plants: [{ ...plant("x", ""), name: { en: "Accuracy", fr: "Justesse" } } as unknown as Plant] };
  const lineage = resolveLineage(["plant:x"], garden, { lang: "fr", hrefs: PUBLIC_HREFS });
  assert.equal(lineage[0].entries[0].name, "Justesse");
});

test("a slug with a space is encoded in the href", () => {
  const garden = { plants: [plant("a b", "A B")] };
  const lineage = resolveLineage(["plant:a b"], garden, { lang: "en", hrefs: PUBLIC_HREFS });
  assert.equal(lineage[0].entries[0].href, "/plant/a%20b");
});

test("no parents is an empty lineage, not a cluster of nothing", () => {
  assert.deepEqual(resolveLineage(undefined, GARDEN, { lang: "en", hrefs: ADMIN_HREFS }), []);
});

/**
 * The dangling ref one hop UP the climb — the case the test above cannot see.
 *
 * "bean:ghost" is dropped where the entity's own parents are read, which is the
 * obvious guard and the one a reader checks. This is the other one: a pod that
 * exists, naming a plant that does not. It is reached only from inside the
 * climb, so nothing in the entity's own `parents` could have filtered it, and
 * without its own guard the tier would carry an entry linking at a plant page
 * that 404s — or, in the public zone, at a plant deliberately withheld from the
 * filtered garden this resolver was handed.
 */
test("a pod naming a plant the garden does not hold yields no plant tier", () => {
  const garden = {
    pods: [pod("orphan-pod", "Orphan", ["plant:ghost"])],
    beans: [bean("orphan-bean", "Orphan bean", ["pod:orphan-pod"])],
  };

  const lineage = resolveLineage(["bean:orphan-bean"], garden, {
    lang: "en",
    hrefs: ADMIN_HREFS,
  });

  assert.deepEqual(
    lineage.map((tier) => tier.kind),
    ["pod", "bean"],
    "a plant that is absent from the passed garden must not reach the trail — " +
      "in the public zone that absence IS the privacy projection",
  );
});
