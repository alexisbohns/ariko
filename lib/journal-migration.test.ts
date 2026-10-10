import { test } from "node:test";
import assert from "node:assert/strict";
import { planArticleFold, planReanchor, type LegacySprout } from "./journal-migration";
import type { Bean } from "./data";

const bean = (slug: string, extra: Partial<Bean> = {}): Bean => ({ slug, name: slug, parents: ["plant:p"], ...extra });
// The fold reads LEGACY documents — `type` and `parents` are what it keys on —
// so its fixtures are typed as the migration finds them, not as the model now is.
const article = (slug: string, bean: string, extra: Partial<LegacySprout> = {}): LegacySprout => ({
  slug,
  name: slug,
  type: "article",
  date: "2026-01-01",
  description: "",
  parents: [`bean:${bean}`],
  content: { en: "body" },
  ...extra,
});

test("an article sprout folds into its bean and is deleted", () => {
  const plan = planArticleFold([bean("b")], [article("b-0", "b", { relations: [{ kind: "mentions", ref: "bean:z" }] })]);
  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.folds, [
    { beanSlug: "b", sproutSlug: "b-0", content: { en: "body" }, relations: [{ kind: "mentions", ref: "bean:z" }] },
  ]);
});

test("a bean that already has content is refused, not overwritten", () => {
  const plan = planArticleFold([bean("b", { content: "mine" })], [article("b-0", "b")]);
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /b-0.*already carries a content field/);
});

test("a bean whose content field is present but blank is refused too — the write filter is $exists", () => {
  const plan = planArticleFold([bean("b", { content: "" })], [article("b-0", "b")]);
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /b-0.*already carries a content field.*interrupted fold/);
});

test("a bean that already carries relations is refused — the write filter requires both fields absent", () => {
  const plan = planArticleFold(
    [bean("b", { relations: [{ kind: "mentions", ref: "bean:z" }] })],
    [article("b-0", "b")],
  );
  assert.deepEqual(plan.folds, []);
  assert.match(plan.refusals[0], /b-0: bean b already carries relations.*clear them first, or fold by hand/);
});

test("an article with no bean: parent is refused by name", () => {
  const plan = planArticleFold([bean("b")], [article("loose", "b", { parents: ["plant:p"] })]);
  assert.equal(plan.folds.length, 0);
  assert.deepEqual(plan.refusals, ["loose: no bean: parent"]);
});

test("two articles under one bean are refused — the fold cannot pick", () => {
  const plan = planArticleFold([bean("b")], [article("b-0", "b"), article("b-1", "b")]);
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /two article sprouts.*retype one in the admin/);
});

test("an article carrying media is refused — the derived cover would change", () => {
  const plan = planArticleFold(
    [bean("b")],
    [article("b-0", "b", { media: [{ kind: "image", storageKey: "k", url: "x" }] })],
  );
  assert.equal(plan.folds.length, 0);
  assert.match(plan.refusals[0], /media.*move the image to the bean's cover first/);
});

test("an article whose bean is missing, or with no content, is refused", () => {
  const plan = planArticleFold([bean("b")], [article("x-0", "x"), article("b-0", "b", { content: "  " })]);
  assert.equal(plan.folds.length, 0);
  assert.equal(plan.refusals.length, 2);
  assert.match(plan.refusals[0], /x-0: bean x not found/);
  assert.match(plan.refusals[1], /b-0: no content to fold/);
});

test("non-article sprouts are untouched", () => {
  const plan = planArticleFold([bean("b")], [article("n", "b", { type: "note" })]);
  assert.deepEqual(plan, { folds: [], refusals: [] });
});

const garden = {
  plants: [{ slug: "p", name: "P", natures: ["work"] as ["work"], role: { kind: "owner" as const }, description: "" }],
  pods: [
    { slug: "pod", name: "Pod", description: "", parents: ["plant:p"] },
    { slug: "krabs", name: "Krabs", description: "", parents: [] },
  ],
  beans: [
    { slug: "b", name: "B", parents: ["pod:pod"] },
    { slug: "kb", name: "KB", parents: ["pod:krabs"] },
  ],
};
const legacy = (over: Partial<LegacySprout>): LegacySprout => ({
  slug: "s", name: "S", date: "2026-01-01", description: "", type: "note", parents: ["bean:b"], ...over,
});

test("planReanchor maps type to kind by the table and parents to about", () => {
  const plan = planReanchor([legacy({ type: "note" }), legacy({ slug: "m", type: "song" }), legacy({ slug: "d", type: "digest" })], garden);
  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.moves, [
    { slug: "s", type: "note", kind: "log", about: ["bean:b"], dropped: [] },
    { slug: "m", type: "song", kind: "milestone", about: ["bean:b"], dropped: [] },
    { slug: "d", type: "digest", kind: "digest", about: ["bean:b"], dropped: [] },
  ]);
});

test("a sprout already carrying kind and no type is skipped (idempotent)", () => {
  const plan = planReanchor([legacy({ type: undefined, kind: "log", parents: undefined, about: ["bean:b"] })], garden);
  assert.deepEqual(plan, { moves: [], refusals: [] });
});

test("refusals: unknown type, article, no bean parent, dangling bean, unrooted plant", () => {
  const plan = planReanchor(
    [
      legacy({ slug: "bla", type: "bla" }),
      legacy({ slug: "proto", type: "constructor" }),
      legacy({ slug: "art", type: "article" }),
      legacy({ slug: "none", parents: [] }),
      legacy({ slug: "dangling", parents: ["bean:nope"] }),
      legacy({ slug: "krabs-1", parents: ["bean:kb"] }),
    ],
    garden,
  );
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.refusals, [
    'bla: type "bla" has no kind — retype or delete it in the admin',
    'proto: type "constructor" has no kind — retype or delete it in the admin',
    "art: an article folds, it does not re-anchor — run the fold first",
    "none: no bean: parent to derive a plant from — re-anchor it by hand",
    "dangling: bean nope not found — re-anchor it by hand",
    "krabs-1: rolls up to no plant (bean kb) — root the pod under a plant in the admin first",
  ]);
});

test("a sprout with two bean parents under one plant keeps both as about; under two plants it is refused", () => {
  const twoPlants = { ...garden, plants: [...garden.plants, { ...garden.plants[0], slug: "p2" }], pods: [...garden.pods, { slug: "pod2", name: "P2", description: "", parents: ["plant:p2"] }], beans: [...garden.beans, { slug: "b2", name: "B2", parents: ["pod:pod2"] }] };
  assert.deepEqual(planReanchor([legacy({ parents: ["bean:b", "bean:b"] })], twoPlants).moves[0].about, ["bean:b"]);
  assert.deepEqual(planReanchor([legacy({ parents: ["bean:b", "bean:b2"] })], twoPlants).refusals, [
    "s: rolls up to two plants (p, p2) — a sprout belongs to one; split it in the admin",
  ]);
});

test("a sprout carrying both type and kind is refused — the move's filter could not match it", () => {
  const plan = planReanchor([legacy({ type: "note", kind: "log" })], garden);
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.refusals, [
    "s: carries both type and kind — unset one by hand (an interrupted write; its pre-image is in the backup)",
  ]);
});

test("a move lists the non-bean parents it drops, and about keeps only the beans", () => {
  const plan = planReanchor([legacy({ parents: ["plant:p", "bean:b", "pod:pod"] })], garden);
  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.moves, [{ slug: "s", type: "note", kind: "log", about: ["bean:b"], dropped: ["plant:p", "pod:pod"] }]);
});
