import test from "node:test";
import assert from "node:assert/strict";
import {
  extractLabNoteYaml,
  parseLabNote,
  buildInboxPayload,
  classifyResponse,
  reminderVerdict,
  reminderComment,
  REMINDER_MARKER,
  OPT_OUT_LABEL,
} from "./lib.mjs";

const F = "```";
const note = (heading, lines) => [heading, `${F}yaml`, ...lines, F].join("\n");

test("extractLabNoteYaml: null when there is no Lab Note section", () => {
  assert.equal(extractLabNoteYaml("## Summary\n\nJust a chore PR."), null);
  assert.equal(extractLabNoteYaml(""), null);
  assert.equal(extractLabNoteYaml(undefined), null);
});

test("extractLabNoteYaml: extracts the yaml fence from the section", () => {
  const body = ["## Summary", "stuff", note("## Lab Note", ["en:", "  title: Hello"]), "## After", "tail"].join("\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hello");
});

test("extractLabNoteYaml: matches pbbls' '## Lab Note (EN/FR)' heading", () => {
  const body = note("## Lab Note (EN/FR)", ["en:", "  title: Hi"]);
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

test("extractLabNoteYaml: the section ends at the next level-2 heading", () => {
  const body = ["## Lab Note", "prose only", "## Next", `${F}yaml`, "en:", F].join("\n");
  assert.equal(extractLabNoteYaml(body), null);
});

test("extractLabNoteYaml: a level-3 heading does not end the section", () => {
  const body = ["## Lab Note", "### context", `${F}yaml`, "en:", "  title: Hi", F].join("\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

test("extractLabNoteYaml: first fence wins when the section holds several", () => {
  const body = ["## Lab Note", `${F}yaml`, "a: 1", F, `${F}yaml`, "b: 2", F].join("\n");
  assert.equal(extractLabNoteYaml(body), "a: 1");
});

test("extractLabNoteYaml: null on an unterminated fence", () => {
  const body = ["## Lab Note", `${F}yaml`, "en:"].join("\n");
  assert.equal(extractLabNoteYaml(body), null);
});

test("extractLabNoteYaml: handles CRLF bodies (GitHub sends \\r\\n)", () => {
  const body = ["## Lab Note", `${F}yaml`, "en:", "  title: Hi", F].join("\r\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

test("extractLabNoteYaml: a yaml fence before the Lab Note section is ignored", () => {
  const body = ["## Setup", `${F}yaml`, "not: this", F, "## Lab Note", `${F}yaml`, "en:", "  title: Hi", F].join("\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

test("extractLabNoteYaml: indented fences are tolerated", () => {
  const body = ["## Lab Note", `  ${F}yaml`, "en:", "  title: Hi", `  ${F}`].join("\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

const VALID = [
  "en:",
  "  title: Relations join the public graph",
  "  summary: One or two sentences, user-facing.",
  "fr:",
  "  title: Les relations rejoignent le graphe",
  "  summary: Une ou deux phrases.",
  "suggested:",
  "  molecule: ariko",
  "  atom: public-graph",
  "  type: feature",
  "  tags: [changelog, graph]",
].join("\n");

test("parseLabNote: accepts the full core schema", () => {
  const r = parseLabNote(VALID);
  assert.equal(r.ok, true);
  assert.deepEqual(r.note, {
    en: { title: "Relations join the public graph", summary: "One or two sentences, user-facing." },
    fr: { title: "Les relations rejoignent le graphe", summary: "Une ou deux phrases." },
    suggested: { molecule: "ariko", atom: "public-graph", type: "feature", tags: ["changelog", "graph"] },
  });
});

test("parseLabNote: tolerates the pbbls superset (unknown keys ignored)", () => {
  const superset = VALID + "\nspecies: app\nplatform: ios\npublished: true\nrelease-date: 2026-08-01";
  const r = parseLabNote(superset);
  assert.equal(r.ok, true);
  assert.equal(r.note.en.title, "Relations join the public graph");
  assert.equal("species" in r.note, false);
});

test("parseLabNote: en-only note is valid, fr defaults empty", () => {
  const r = parseLabNote("en:\n  title: Hi\n  summary: A note.");
  assert.equal(r.ok, true);
  assert.deepEqual(r.note.fr, {});
  assert.equal("suggested" in r.note, false);
});

test("parseLabNote: names the exact problem", () => {
  assert.match(parseLabNote("en: [broken").error, /invalid YAML/);
  assert.match(parseLabNote("- just\n- a list").error, /mapping/);
  assert.match(parseLabNote("fr:\n  title: Salut").error, /en\.title/);
  assert.match(parseLabNote("en:\n  title: Hi").error, /en\.summary/);
  assert.match(parseLabNote("en:\n  title: ''\n  summary: s").error, /en\.title/);
});

test("parseLabNote: junk suggested entries are dropped, not fatal", () => {
  const r = parseLabNote("en:\n  title: Hi\n  summary: S.\nsuggested:\n  tags: [1, 2]\n  molecule: 42");
  assert.equal(r.ok, true);
  assert.equal("suggested" in r.note, false);
});

test("buildInboxPayload: full bilingual mapping (spec §4)", () => {
  const { note } = parseLabNote(VALID);
  const p = buildInboxPayload(note, { repo: "alexisbohns/pbbls", number: 12, url: "https://github.com/alexisbohns/pbbls/pull/12" });
  assert.deepEqual(p, {
    title: { en: "Relations join the public graph", fr: "Les relations rejoignent le graphe" },
    body: { en: "One or two sentences, user-facing.", fr: "Une ou deux phrases." },
    source: { kind: "github", url: "https://github.com/alexisbohns/pbbls/pull/12", externalId: "alexisbohns/pbbls#12" },
    suggested: { moleculeSlug: "ariko", atomSlug: "public-graph", type: "feature", tags: ["changelog", "graph"] },
  });
});

test("buildInboxPayload: en-only note maps to a plain-string title", () => {
  const { note } = parseLabNote("en:\n  title: Hi\n  summary: A note.");
  const p = buildInboxPayload(note, { repo: "alexisbohns/ariko", number: 3, url: "u" });
  assert.equal(p.title, "Hi");
  assert.deepEqual(p.body, { en: "A note." });
  assert.equal(p.source.externalId, "alexisbohns/ariko#3");
  assert.equal("suggested" in p, false);
});

test("classifyResponse: maps /api/inbox statuses to outcomes (spec §7)", () => {
  assert.deepEqual(classifyResponse(201), { outcome: "posted", exitCode: 0 });
  assert.deepEqual(classifyResponse(200), { outcome: "updated", exitCode: 0 });
  assert.deepEqual(classifyResponse(400), { outcome: "rejected", exitCode: 2 });
  assert.deepEqual(classifyResponse(401), { outcome: "unauthorized", exitCode: 4 });
  assert.deepEqual(classifyResponse(403), { outcome: "unauthorized", exitCode: 4 });
  assert.deepEqual(classifyResponse(500), { outcome: "unreachable", exitCode: 3 });
});

test("reminderVerdict: ok when a valid note is present", () => {
  const body = note("## Lab Note", ["en:", "  title: Hi", "  summary: A note."]);
  assert.deepEqual(reminderVerdict(body), { state: "ok" });
});

test("reminderVerdict: missing when there is no Lab Note section", () => {
  assert.deepEqual(reminderVerdict("## Summary\n\nJust a chore PR."), { state: "missing" });
  assert.deepEqual(reminderVerdict(""), { state: "missing" });
  assert.deepEqual(reminderVerdict(undefined), { state: "missing" });
});

test("reminderVerdict: invalid surfaces the exact parse error", () => {
  const body = note("## Lab Note", ["en:", "  title: Hi"]); // no summary
  const v = reminderVerdict(body);
  assert.equal(v.state, "invalid");
  assert.match(v.error, /en\.summary/);
});

test("reminderVerdict: draft and opt-out label short-circuit to skipped", () => {
  assert.equal(reminderVerdict("no note here", { isDraft: true }).state, "skipped");
  // opt-out wins even when the note is missing
  assert.equal(reminderVerdict("no note here", { hasOptOutLabel: true }).state, "skipped");
  assert.equal(reminderVerdict("no note here", { hasOptOutLabel: true }).reason, `${OPT_OUT_LABEL} label`);
});

test("reminderComment: null for ok/skipped, marked + actionable for missing/invalid", () => {
  assert.equal(reminderComment({ state: "ok" }), null);
  assert.equal(reminderComment({ state: "skipped", reason: "draft" }), null);

  const missing = reminderComment({ state: "missing" }, { molecule: "femfolk" });
  assert.ok(missing.startsWith(REMINDER_MARKER));
  assert.match(missing, /molecule: femfolk/);
  assert.match(missing, new RegExp(OPT_OUT_LABEL));
  // the skeleton fence is balanced (opening + closing ```yaml/```)
  assert.equal((missing.match(/```/g) || []).length, 2);

  const invalid = reminderComment({ state: "invalid", error: "en.title is required" });
  assert.ok(invalid.startsWith(REMINDER_MARKER));
  assert.match(invalid, /en\.title is required/);
  assert.equal((invalid.match(/```/g) || []).length, 0); // no skeleton on the invalid path
});
