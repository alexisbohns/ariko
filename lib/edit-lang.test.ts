import { test } from "node:test";
import assert from "node:assert/strict";
import { editLang, editLangHrefs, editorHalves, parseEditLangField, withEditLang } from "./edit-lang";

test("editLang reads the URL tolerantly and defaults to English", () => {
  assert.equal(editLang("fr"), "fr");
  assert.equal(editLang("FR"), "fr");
  assert.equal(editLang("fr-CA"), "fr");
  assert.equal(editLang("en"), "en");
  assert.equal(editLang("de"), "en");
  assert.equal(editLang(undefined), "en");
  // Next hands a repeated parameter over as an array — not a language.
  assert.equal(editLang(["fr", "en"]), "en");
});

test("editorHalves: English opens on the English half, never a seed", () => {
  assert.deepEqual(editorHalves({ en: "e", fr: "f" }, "en"), { initialMarkdown: "e" });
  assert.deepEqual(editorHalves({ fr: "f" }, "en"), { initialMarkdown: "" });
  // A plain string counts as the English half (textPart's rule, not a special case here).
  assert.deepEqual(editorHalves("x", "en"), { initialMarkdown: "x" });
});

test("editorHalves: French over an English-only article opens EMPTY with the English as seed", () => {
  // The whole point of the strict read: the French editor must never open
  // holding English text that a Save would store as French.
  assert.deepEqual(editorHalves("english body", "fr"), { initialMarkdown: "", seed: "english body" });
  assert.deepEqual(editorHalves({ en: "english", fr: "  " }, "fr"), { initialMarkdown: "  ", seed: "english" });
});

test("editorHalves: French with a French half has no seed; nothing to seed from, no seed", () => {
  assert.deepEqual(editorHalves({ en: "e", fr: "f" }, "fr"), { initialMarkdown: "f" });
  assert.deepEqual(editorHalves(undefined, "fr"), { initialMarkdown: "" });
  assert.deepEqual(editorHalves({ en: " ", fr: "" }, "fr"), { initialMarkdown: "" });
});

test("editLangHrefs: en is the clean URL, fr sets lang=fr", () => {
  assert.deepEqual(editLangHrefs("/admin/sprout/a", {}), {
    en: "/admin/sprout/a",
    fr: "/admin/sprout/a?lang=fr",
  });
});

test("editLangHrefs keeps the scope and drops lang, error and form", () => {
  // A switch is a fresh view: a rejected save's banner belongs to the half
  // that received the save.
  const hrefs = editLangHrefs("/admin/pod/p", { plant: "ariko", lang: "fr", error: "boom", form: "meta" });
  assert.deepEqual(hrefs, { en: "/admin/pod/p?plant=ariko", fr: "/admin/pod/p?plant=ariko&lang=fr" });
});

test("editLangHrefs encodes what it keeps", () => {
  assert.equal(editLangHrefs("/admin/pod/p", { q: "a b&c" }).en, "/admin/pod/p?q=a+b%26c");
});

test("editLangHrefs repeats an array value and skips an undefined one", () => {
  const hrefs = editLangHrefs("/admin/pod/p", { plant: ["a", "b"], missing: undefined });
  assert.equal(hrefs.en, "/admin/pod/p?plant=a&plant=b");
});

test("parseEditLangField: absent is English, a language is itself, anything else is refused", () => {
  // Absent: every editor before this slice posted English with no lang field,
  // and a tab left open across the deploy must keep saving where it did.
  assert.deepEqual(parseEditLangField(null), { ok: true, lang: "en" });
  assert.deepEqual(parseEditLangField("en"), { ok: true, lang: "en" });
  assert.deepEqual(parseEditLangField("fr"), { ok: true, lang: "fr" });
  // Strict: the editor posts exactly "en" or "fr". Anything else was not
  // posted by it, and guessing which half it meant is the one thing a write
  // path must not do.
  assert.equal(parseEditLangField("de").ok, false);
  assert.equal(parseEditLangField("FR").ok, false);
  assert.equal(parseEditLangField("").ok, false);
});

test("withEditLang appends lang=fr, and leaves English hrefs alone", () => {
  assert.equal(withEditLang("/admin/pod/p", "en"), "/admin/pod/p");
  assert.equal(withEditLang("/admin/pod/p", "fr"), "/admin/pod/p?lang=fr");
  assert.equal(withEditLang("/admin/pod/p?error=x", "fr"), "/admin/pod/p?error=x&lang=fr");
});

test("withEditLang is a real query edit, not concatenation", () => {
  // A fragment must not swallow the parameter: naive concatenation would
  // produce "/x#y?lang=fr", putting lang inside the hash where no server ever
  // reads it.
  assert.equal(withEditLang("/x#y", "fr"), "/x?lang=fr#y");
  // An existing `lang` must be replaced, not repeated: a repeated parameter
  // comes back to editLang as an array, which it reads as English — so naive
  // concatenation here would silently undo the switch to French.
  assert.equal(withEditLang("/x?lang=en", "fr"), "/x?lang=fr");
});
