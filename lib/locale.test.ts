import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLang, resolveLang, otherLang, isLang, DEFAULT_LANG } from "./locale";

test("parseLang accepts the two known languages", () => {
  assert.equal(parseLang("en"), "en");
  assert.equal(parseLang("fr"), "fr");
});

test("parseLang tolerates case, whitespace and a region subtag", () => {
  assert.equal(parseLang(" FR "), "fr");
  assert.equal(parseLang("fr-CA"), "fr");
  assert.equal(parseLang("en-GB"), "en");
});

test("parseLang returns null for anything else, including junk from a URL", () => {
  for (const junk of ["", "de", "xx", "../en", "<script>", 42, null, undefined, {}, ["fr"]]) {
    assert.equal(parseLang(junk), null, `expected null for ${JSON.stringify(junk)}`);
  }
});

test("resolveLang prefers the explicit param over the stored cookie", () => {
  assert.equal(resolveLang("fr", "en"), "fr");
  assert.equal(resolveLang("en", "fr"), "en");
});

test("resolveLang falls back to the cookie, then to English", () => {
  assert.equal(resolveLang(undefined, "fr"), "fr");
  assert.equal(resolveLang(undefined, undefined), DEFAULT_LANG);
  assert.equal(resolveLang("de", "de"), DEFAULT_LANG);
});

test("a junk param does not shadow a valid cookie", () => {
  // ?lang=de with a stored fr preference keeps the reader in French rather
  // than silently resetting them to English.
  assert.equal(resolveLang("de", "fr"), "fr");
});

test("otherLang is the toggle target", () => {
  assert.equal(otherLang("en"), "fr");
  assert.equal(otherLang("fr"), "en");
});

test("isLang is a type guard over the same two values", () => {
  assert.ok(isLang("en"));
  assert.ok(isLang("fr"));
  assert.ok(!isLang("de"));
  assert.ok(!isLang(undefined));
});
