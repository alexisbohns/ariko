import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateFeed, validateIntent, validatePollen } from "./pollen";

const ROOT = join(process.cwd(), "data", "pollen");

test("every valid fixture passes; only noncore-kind warns", () => {
  const files = readdirSync(join(ROOT, "valid")).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 10, "expected the full valid fixture set");
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(ROOT, "valid", file), "utf8"));
    const result = file.startsWith("intent-") ? validateIntent(parsed) : validatePollen(parsed);
    assert.equal(result.ok, true, `${file}: ${result.ok ? "" : result.error}`);
    if (!result.ok) continue;
    if (file === "noncore-kind.json") {
      assert.equal(result.warnings.length, 1, file);
    } else {
      assert.deepEqual(result.warnings, [], file);
    }
  }
});

test("the sample feed validates clean", () => {
  const results = validateFeed(readFileSync(join(ROOT, "valid", "feed-sample.ndjson"), "utf8"));
  assert.equal(results.length, 3);
  for (const { line, result } of results) {
    assert.equal(result.ok, true, `line ${line}: ${result.ok ? "" : result.error}`);
  }
});

test("every invalid fixture fails with its manifest error; no orphans", () => {
  const manifest: { file: string; error: string }[] = JSON.parse(
    readFileSync(join(ROOT, "invalid", "manifest.json"), "utf8"),
  );
  const files = readdirSync(join(ROOT, "invalid"))
    .filter((f) => f.endsWith(".json") && f !== "manifest.json");
  assert.deepEqual(files.sort(), manifest.map((m) => m.file).sort());
  for (const { file, error } of manifest) {
    const parsed = JSON.parse(readFileSync(join(ROOT, "invalid", file), "utf8"));
    const result = validatePollen(parsed);
    assert.equal(result.ok, false, file);
    if (!result.ok) {
      assert.ok(result.error.includes(error), `${file}: got "${result.error}", want "${error}"`);
    }
  }
});
