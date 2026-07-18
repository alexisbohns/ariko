import test from "node:test";
import assert from "node:assert/strict";
import { extractLabNoteYaml } from "./lib.mjs";

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
