import { test } from "node:test";
import assert from "node:assert/strict";
import { planArticleFold } from "./journal-migration";
import type { Bean, Sprout } from "./data";

const bean = (slug: string, extra: Partial<Bean> = {}): Bean => ({ slug, name: slug, parents: ["plant:p"], ...extra });
const article = (slug: string, bean: string, extra: Partial<Sprout> = {}): Sprout => ({
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
