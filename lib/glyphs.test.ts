import test from "node:test";
import assert from "node:assert/strict";
import { initialsOf, sourceLabel, tierLabel, visibilityLabel } from "./glyphs";

test("initialsOf takes the first letter of the first two words", () => {
  assert.equal(initialsOf("Wait For The Sun"), "WF");
  assert.equal(initialsOf("Republic of Masquerade"), "RO");
});

test("initialsOf falls back to two letters of a single word", () => {
  assert.equal(initialsOf("pbbls"), "PB");
  assert.equal(initialsOf("Ariko"), "AR");
});

test("a name and its slug produce the same monogram", () => {
  assert.equal(initialsOf("wait-for-the-sun"), initialsOf("Wait For The Sun"));
  assert.equal(initialsOf("pbbls_web"), "PW");
  assert.equal(initialsOf("teale.ios"), "TI");
});

test("initialsOf never returns half a surrogate pair", () => {
  assert.equal(initialsOf("🌱garden"), "🌱G".toUpperCase());
  assert.equal([...initialsOf("🌱garden")].length, 2);
});

test("initialsOf survives a name with nothing in it", () => {
  assert.equal(initialsOf(""), "?");
  assert.equal(initialsOf("   "), "?");
  assert.equal(initialsOf("---"), "?");
});

test("a one-letter name yields one letter, not a padded one", () => {
  assert.equal(initialsOf("k"), "K");
});

test("sourceLabel names the kinds this repo issues", () => {
  assert.equal(sourceLabel("manual"), "Manual");
  assert.equal(sourceLabel("github"), "GitHub");
  assert.equal(sourceLabel("changelog"), "Changelog");
});

test("an unheard-of source kind keeps its own raw name", () => {
  assert.equal(sourceLabel("melogram"), "melogram");
  assert.equal(sourceLabel(""), "Unknown source");
  assert.equal(sourceLabel("   "), "Unknown source");
});

test("visibility and tier each have exactly one display form", () => {
  assert.equal(visibilityLabel("public"), "Public");
  assert.equal(visibilityLabel("private"), "Private");
  assert.equal(tierLabel("plant"), "Plant");
  assert.equal(tierLabel("pod"), "Pod");
});
