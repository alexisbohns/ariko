import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENV_BLOCK_END,
  ENV_BLOCK_START,
  envBlock,
  envTargetProblem,
  generateToken,
  hashToken,
  looksLikeRepoToken,
  setupCard,
  sheetTargetProblem,
  upsertEnvBlock,
} from "./repo-token";

test("generateToken: ariko_<pod>_<32 base64url chars>, never twice the same", () => {
  const a = generateToken("pbbls");
  assert.match(a, /^ariko_pbbls_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(a, generateToken("pbbls"));
  assert.equal(looksLikeRepoToken(a), true);
  assert.equal(looksLikeRepoToken("tok_legacy"), false);
});

test("hashToken is sha256 hex and does not contain the token", () => {
  const t = generateToken("pbbls");
  const h = hashToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashToken(t));
  assert.equal(h.includes(t), false);
});

test("envBlock carries the token, the URL and the cloud reminder", () => {
  const block = envBlock({ pod: "pbbls", token: "ariko_pbbls_x", date: "2026-11-14" });
  assert.ok(block.startsWith(ENV_BLOCK_START));
  assert.ok(block.trimEnd().endsWith(ENV_BLOCK_END));
  assert.match(block, /^ARIKO_TOKEN=ariko_pbbls_x$/m);
  assert.match(block, /^ARIKO_URL=https:\/\/www\.ariko\.app$/m);
  assert.match(block, /CLOUD SESSIONS do not see this file/);
  assert.match(block, /allow www\.ariko\.app/);
});

test("upsertEnvBlock appends once, then replaces in place", () => {
  const first = upsertEnvBlock("FOO=1\n", envBlock({ pod: "p", token: "ariko_p_a", date: "2026-11-14" }));
  assert.match(first, /^FOO=1\n\n# >>> ariko/);
  const second = upsertEnvBlock(first + "BAR=2\n", envBlock({ pod: "p", token: "ariko_p_b", date: "2026-11-15" }));
  assert.equal(second.match(/# >>> ariko/g)?.length, 1);
  assert.match(second, /ARIKO_TOKEN=ariko_p_b/);
  assert.doesNotMatch(second, /ariko_p_a/);
  assert.match(second, /BAR=2/);
  assert.equal(upsertEnvBlock("", "X\n"), "X\n");
});

test("setupCard has the five steps, the token and the snippets", () => {
  const card = setupCard({ pod: "pbbls", token: "ariko_pbbls_x", claudeSnippet: "## Writing for Ariko\n…" });
  assert.match(card, /^## pbbls$/m);
  assert.match(card, /ARIKO_TOKEN=ariko_pbbls_x/);
  assert.match(card, /www\.ariko\.app/);
  assert.match(card, /"ariko-article@ariko": true/);
  assert.match(card, /## Writing for Ariko/);
  assert.match(card, /ping Ariko/);
});

test("envTargetProblem refuses a git-tracked file", () => {
  const tracked = () => ({ status: 0 });
  const untracked = () => ({ status: 1 });
  assert.match(envTargetProblem("/r/.env", tracked) ?? "", /tracked by git/);
  assert.equal(envTargetProblem("/r/.env", untracked), null);
});

test("sheetTargetProblem refuses a path inside a git work tree", () => {
  assert.match(sheetTargetProblem("/r/sheet.md", () => ({ status: 0 })) ?? "", /inside a git repository/);
  assert.equal(sheetTargetProblem("/Desktop/sheet.md", () => ({ status: 128 })), null);
});
