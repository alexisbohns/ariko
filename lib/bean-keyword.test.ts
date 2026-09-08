import test from "node:test";
import assert from "node:assert/strict";
import { buildBeanKeywordPatch } from "./bean-keyword";

const form = (keyword: string, keywordFr: string): FormData => {
  const f = new FormData();
  f.set("keyword", keyword);
  f.set("keywordFr", keywordFr);
  return f;
};

test("en only stores a plain string — simple content stays simple", () => {
  assert.equal(buildBeanKeywordPatch(form("Timeline", "")), "Timeline");
});

test("both parts store the pair", () => {
  assert.deepEqual(buildBeanKeywordPatch(form("Accuracy", "Justesse")), {
    en: "Accuracy",
    fr: "Justesse",
  });
});

test("fr only is valid, and omits the blank en", () => {
  assert.deepEqual(buildBeanKeywordPatch(form("", "Justesse")), { fr: "Justesse" });
});

test("both blank MEANS CLEAR, and crosses the wire as an instruction", () => {
  // The field belongs to a record that already exists, so a blank has to be an
  // instruction rather than an absence — the stance PlantMetaPatch.description
  // takes, for the same reason. Omitting the key would silently leave the old
  // keyword in place.
  assert.equal(buildBeanKeywordPatch(form("", "")), null);
});

test("whitespace is trimmed, and whitespace-only is a clear", () => {
  assert.equal(buildBeanKeywordPatch(form("  Timeline  ", "")), "Timeline");
  assert.equal(buildBeanKeywordPatch(form("   ", "  ")), null);
});

test("absent fields are a clear, not a crash", () => {
  assert.equal(buildBeanKeywordPatch(new FormData()), null);
});
