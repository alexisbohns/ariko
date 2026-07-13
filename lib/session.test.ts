import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hmacHex,
  timingSafeEqual,
  createSessionValue,
  verifySessionValue,
  verifyPassword,
  MAX_AGE_MS,
} from "./session";

const SECRET = "test-secret-abc";
const NOW = 1_700_000_000_000; // fixed clock for determinism

test("hmacHex is deterministic and hex-encoded", async () => {
  const a = await hmacHex(SECRET, "hello");
  const b = await hmacHex(SECRET, "hello");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/); // SHA-256 → 32 bytes → 64 hex chars
});

test("hmacHex differs for a different secret", async () => {
  const a = await hmacHex(SECRET, "hello");
  const b = await hmacHex("other-secret", "hello");
  assert.notEqual(a, b);
});

test("timingSafeEqual compares by content, false on length mismatch", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
});

test("createSessionValue / verifySessionValue round-trip", async () => {
  const value = await createSessionValue(SECRET, NOW);
  assert.match(value, /^\d+\.[0-9a-f]{64}$/);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW), true);
});

test("a tampered signature is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW);
  const tampered = value.slice(0, -1) + (value.endsWith("0") ? "1" : "0");
  assert.equal(await verifySessionValue(SECRET, tampered, MAX_AGE_MS, NOW), false);
});

test("a tampered issuedAt (reused old signature) is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW);
  const sig = value.slice(value.indexOf(".") + 1);
  const forged = `${NOW + 5000}.${sig}`;
  assert.equal(await verifySessionValue(SECRET, forged, MAX_AGE_MS, NOW + 5000), false);
});

test("a value signed with a different secret is rejected", async () => {
  const value = await createSessionValue("other-secret", NOW);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW), false);
});

test("an expired value is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW + MAX_AGE_MS + 1), false);
});

test("a future-dated value is rejected", async () => {
  const value = await createSessionValue(SECRET, NOW + 10_000);
  assert.equal(await verifySessionValue(SECRET, value, MAX_AGE_MS, NOW), false);
});

test("garbage / missing values are rejected, never throw", async () => {
  assert.equal(await verifySessionValue(SECRET, undefined, MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "", MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "no-dot", MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "123", MAX_AGE_MS, NOW), false);
  assert.equal(await verifySessionValue(SECRET, "abc.def", MAX_AGE_MS, NOW), false);
});

test("verifyPassword matches only the correct password (length-hidden)", async () => {
  assert.equal(await verifyPassword(SECRET, "hunter2", "hunter2"), true);
  assert.equal(await verifyPassword(SECRET, "hunter2", "hunter3"), false);
  assert.equal(await verifyPassword(SECRET, "", "hunter2"), false);
});
