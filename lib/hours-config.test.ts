import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { parseHoursConfig } from "./hours-config";

const base = {
  since: "2026-03-16",
  gapMinutes: 120,
  leadMinutes: 30,
  identities: ["Hello@Bohns.design"],
  exclude: ["\\[bot\\]"],
  repos: [{ repo: "alexisbohns/pbbls", name: "pbbls", plant: "pbbls" }],
};

test("parses a valid config and lowercases identities", () => {
  const c = parseHoursConfig(base);
  assert.equal(c.since, "2026-03-16");
  assert.deepEqual(c.identities, ["hello@bohns.design"]);
  assert.ok(c.exclude[0].test("dependabot[bot] <x@y>"));
  assert.deepEqual(c.repos, [{ repo: "alexisbohns/pbbls", name: "pbbls", plant: "pbbls" }]);
});

test("plant is optional", () => {
  const c = parseHoursConfig({ ...base, repos: [{ repo: "alexisbohns/krabs", name: "krabs" }] });
  assert.equal(c.repos[0].plant, undefined);
});

for (const [label, patch, msg] of [
  ["unknown top-level key", { colour: "green" }, /unknown key "colour"/],
  ["bad since", { since: "16/03/2026" }, /since/],
  ["since that is not a real day", { since: "2026-02-31" }, /since/],
  ["since month 99", { since: "2026-99-99" }, /since/],
  ["zero gap", { gapMinutes: 0 }, /gapMinutes/],
  ["negative lead", { leadMinutes: -1 }, /leadMinutes/],
  ["empty identities", { identities: [] }, /identities/],
  ["invalid regex", { exclude: ["("] }, /exclude\[0\]/],
  ["malformed repo", { repos: [{ repo: "pbbls", name: "pbbls" }] }, /owner\/name/],
  ["duplicate repo", { repos: [{ repo: "a/b", name: "b" }, { repo: "a/b", name: "b2" }] }, /duplicate repo/],
  ["bad plant slug", { repos: [{ repo: "a/b", name: "b", plant: "Not A Slug" }] }, /plant/],
  ["unknown repo key", { repos: [{ repo: "a/b", name: "b", colour: 1 }] }, /unknown key "colour"/],
] as const) {
  test(`refuses: ${label}`, () => {
    assert.throws(() => parseHoursConfig({ ...base, ...patch }), msg);
  });
}

test("the committed data/hours.yml is valid", () => {
  const raw = yaml.load(readFileSync(join(process.cwd(), "data", "hours.yml"), "utf8"), {
    schema: yaml.CORE_SCHEMA,
  });
  const c = parseHoursConfig(raw);
  assert.ok(c.repos.length >= 10);
});
