import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { retierGarden, PROMOTED, CREATED, SEED_BEES } from "./retier";
import type { RawGarden } from "./data";

function currentGarden(): RawGarden {
  const file = readFileSync(join(process.cwd(), "data", "garden.yml"), "utf8");
  return (yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawGarden) ?? {};
}

test("retierGarden promotes the six project pods to plants and removes them from pods", () => {
  const out = retierGarden(currentGarden());
  const plantSlugs = new Set((out.plants ?? []).map((p) => p.slug));
  const podSlugs = new Set((out.pods ?? []).map((p) => p.slug));
  for (const { slug } of PROMOTED) {
    assert.ok(plantSlugs.has(slug), `${slug} must be a plant`);
    assert.equal(podSlugs.has(slug), false, `${slug} must no longer be a pod`);
  }
});

test("retierGarden creates the authored plants with their natures and relations", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.plants ?? []).map((p) => [p.slug, p]));
  for (const def of CREATED) assert.ok(bySlug.has(def.slug), `${def.slug} must exist`);
  assert.deepEqual(bySlug.get("melogram")?.natures, ["work", "tool"]);
  assert.deepEqual(bySlug.get("melogram")?.relations, [{ kind: "distributes", ref: "plant:bohns-music" }]);
  assert.deepEqual(bySlug.get("arkaik")?.relations, [
    { kind: "chronicles", ref: "plant:pbbls" },
    { kind: "chronicles", ref: "plant:femfolk" },
  ]);
});

test("retierGarden keeps the albums as pods under plant:bohns-music", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.pods ?? []).map((p) => [p.slug, p]));
  for (const slug of ["wait-for-the-sun", "celesta", "republic-of-masquerade"]) {
    assert.ok(bySlug.get(slug)?.parents?.includes("plant:bohns-music"), `${slug} must root under bohns-music`);
  }
});

test("retierGarden re-parents promoted pods' beans to plant: refs and leaves album beans on pod: refs", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.beans ?? []).map((b) => [b.slug, b]));
  assert.deepEqual(bySlug.get("pbbls-webapp")?.parents, ["plant:pbbls"]);
  assert.deepEqual(bySlug.get("felina")?.parents, ["pod:celesta"]);
});

test("retierGarden leaves no domain key on any pod or plant", () => {
  const out = retierGarden(currentGarden());
  for (const p of out.pods ?? []) assert.equal("domain" in p, false, `${p.slug} still has domain`);
  for (const p of out.plants ?? []) assert.equal("domain" in p, false, `${p.slug} still has domain`);
});

test("retierGarden seeds the bees — live ones public, planned ones default-private", () => {
  const out = retierGarden(currentGarden());
  const bySlug = new Map((out.bees ?? []).map((b) => [b.slug, b]));
  for (const bee of SEED_BEES) assert.ok(bySlug.has(bee.slug), `${bee.slug} must exist`);
  assert.equal(bySlug.get("lab-note-pipeline")?.visibility, "public");
  assert.equal(bySlug.get("song-identifier")?.visibility, "public");
  assert.equal(bySlug.get("arkaik-adapter")?.visibility, undefined);
});

test("retierGarden is idempotent and pure", () => {
  const input = currentGarden();
  const snapshot = structuredClone(input);
  const once = retierGarden(input);
  assert.deepEqual(input, snapshot); // pure
  assert.deepEqual(retierGarden(structuredClone(once)), once); // idempotent
});
