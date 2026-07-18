import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTokens, authorize, hasValidToken } from "./auth";

const env = "*:tok_master,github:tok_gh";

test("parseTokens maps each token to its allowed source kinds", () => {
  const t = parseTokens(env);
  assert.deepEqual([...(t.get("tok_master") ?? [])], ["*"]);
  assert.deepEqual([...(t.get("tok_gh") ?? [])], ["github"]);
});

test("parseTokens tolerates blanks and missing env", () => {
  assert.equal(parseTokens(undefined).size, 0);
  assert.equal(parseTokens("  ").size, 0);
});

test("authorize returns 'unauthorized' for missing or unknown tokens", () => {
  const t = parseTokens(env);
  assert.equal(authorize(null, "github", t), "unauthorized");
  assert.equal(authorize("Bearer nope", "github", t), "unauthorized");
  assert.equal(authorize("tok_gh", "github", t), "unauthorized"); // missing "Bearer " prefix
});

test("authorize allows a wildcard token for any kind", () => {
  const t = parseTokens(env);
  assert.equal(authorize("Bearer tok_master", "github", t), "ok");
  assert.equal(authorize("Bearer tok_master", "manual", t), "ok");
});

test("authorize forbids a kind-bound token used for another kind", () => {
  const t = parseTokens(env);
  assert.equal(authorize("Bearer tok_gh", "github", t), "ok");
  assert.equal(authorize("Bearer tok_gh", "manual", t), "forbidden");
});

test("hasValidToken checks only that the bearer token exists (for /api/upload)", () => {
  const t = parseTokens(env);
  assert.equal(hasValidToken("Bearer tok_gh", t), true);
  assert.equal(hasValidToken("Bearer nope", t), false);
  assert.equal(hasValidToken(null, t), false);
});

test("authorize rejects a non-Bearer or wrong-case scheme", () => {
  const t = parseTokens(env);
  assert.equal(authorize("bearer tok_master", "github", t), "unauthorized"); // lowercase scheme
  assert.equal(authorize("Basic tok_master", "github", t), "unauthorized");  // wrong scheme
});

test("an empty bearer token is never authorized", () => {
  const t = parseTokens(env);
  assert.equal(authorize("Bearer ", "github", t), "unauthorized");
  assert.equal(hasValidToken("Bearer ", t), false);
});

test("authorize matches when the candidate is the last configured token", () => {
  const t = parseTokens("a:tok_a,b:tok_b,github:tok_last");
  assert.equal(authorize("Bearer tok_last", "github", t), "ok");
  assert.equal(authorize("Bearer tok_last", "a", t), "forbidden");
});

test("tokens of different lengths compare safely", () => {
  const t = parseTokens("*:short,github:a_much_longer_token_value_here");
  assert.equal(authorize("Bearer short", "manual", t), "ok");
  assert.equal(authorize("Bearer a_much_longer_token_value_here", "github", t), "ok");
  assert.equal(authorize("Bearer shor", "manual", t), "unauthorized");
  assert.equal(authorize("Bearer short_but_longer", "manual", t), "unauthorized");
  assert.equal(hasValidToken("Bearer a_much_longer_token_value_here", t), true);
  assert.equal(hasValidToken("Bearer nope", t), false);
});
