import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The "Grow into a bean" form and `buildBeanFromSeed` agree on field names by
 * convention only: a renamed input posts nothing, the builder reads "", and
 * the action redirects with "bean name is required" for a form that looks
 * filled in. tsc cannot see across a FormData boundary, so this reads both
 * files and pins every name the builder reads to an input the page renders,
 * and the form to the action it must post to.
 */
const page = readFileSync(join(process.cwd(), "app/admin/(chrome)/triage/[id]/page.tsx"), "utf8");
const promote = readFileSync(join(process.cwd(), "lib/promote.ts"), "utf8");

const FIELDS = ["beanSlug", "beanName", "beanNameFr", "beanDescription", "beanDescriptionFr"];

// Bounded on both sides: from the grow form's opening tag to its own
// `</form>`, so a form added below it cannot satisfy the field assertions.
const growSection = () => {
  const at = page.indexOf("<form action={promoteSeedToBeanAction}");
  assert.notEqual(at, -1, "the grow form posts to promoteSeedToBeanAction");
  const end = page.indexOf("</form>", at);
  assert.notEqual(end, -1, "the grow form closes");
  return page.slice(at, end);
};

test("the grow form posts to promoteSeedToBeanAction", () => {
  growSection();
});

test("every field buildBeanFromSeed reads is an input in the grow form", () => {
  const section = growSection();
  for (const name of FIELDS) {
    assert.match(promote, new RegExp(`get\\("${name}"\\)`), `${name} is read by the builder`);
    assert.match(section, new RegExp(`name="${name}"`), `${name} is an input in the grow form`);
  }
});

test("the grow form picks its parents with plantSlug and podSlug, the names the action reads", () => {
  const section = growSection();
  assert.match(section, /name="plantSlug"/);
  assert.match(section, /name="podSlug"/);
});
