import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENV_BLOCK_END,
  ENV_BLOCK_START,
  envBlock,
  envTargetProblem,
  type GitRunner,
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

test("upsertEnvBlock removes every block and puts the new one where the first was", () => {
  const old = (t: string) => envBlock({ pod: "p", token: t, date: "2026-11-14" });
  const existing = "A=1\n" + old("ariko_p_one") + "B=2\n" + old("ariko_p_two") + "C=3\n";
  const out = upsertEnvBlock(existing, envBlock({ pod: "p", token: "ariko_p_new", date: "2026-11-15" }));
  assert.equal(out.match(/^# >>> ariko/gm)?.length, 1);
  assert.equal(out.match(/^# <<< ariko/gm)?.length, 1);
  assert.doesNotMatch(out, /ariko_p_one|ariko_p_two/);
  assert.ok(out.indexOf("ariko_p_new") > out.indexOf("A=1"));
  assert.ok(out.indexOf("ariko_p_new") < out.indexOf("B=2"));
  assert.match(out, /B=2\nC=3\n$/);
});

test("upsertEnvBlock throws on a start marker with no end marker", () => {
  assert.throws(
    () => upsertEnvBlock("A=1\n# >>> ariko\nARIKO_TOKEN=x\n", envBlock({ pod: "p", token: "t", date: "d" })),
    /unterminated ariko block/,
  );
});

test("upsertEnvBlock ignores marker text in the middle of another line", () => {
  const existing = "# see # >>> ariko docs\nFOO=1\n";
  const out = upsertEnvBlock(existing, envBlock({ pod: "p", token: "ariko_p_a", date: "d" }));
  assert.ok(out.startsWith("# see # >>> ariko docs\nFOO=1\n\n# >>> ariko"));
  assert.equal(out.match(/^# >>> ariko/gm)?.length, 1);
});

test("upsertEnvBlock leaves a block whose marker merely starts with ours alone", () => {
  const theirs = "# >>> ariko-cli config\nY=1\n# <<< ariko-cli\nZ=1\n";
  const block = envBlock({ pod: "p", token: "ariko_p_a", date: "d" });
  const out = upsertEnvBlock(theirs, block);
  assert.ok(out.startsWith(theirs));
  assert.ok(out.endsWith(block));
});

test("upsertEnvBlock replaces a block in a CRLF file", () => {
  const block = envBlock({ pod: "p", token: "ariko_p_new", date: "d" });
  const existing = "A=1\r\n# >>> ariko (old)\r\nARIKO_TOKEN=old\r\n# <<< ariko\r\nB=2\r\n";
  const out = upsertEnvBlock(existing, block);
  assert.ok(out.includes("ariko_p_new"));
  assert.equal(out.includes("ARIKO_TOKEN=old"), false);
  assert.ok(out.includes("B=2"));
});

test("setupCard has the five steps, the token and the snippets", () => {
  const card = setupCard({ pod: "pbbls", token: "ariko_pbbls_x", claudeSnippet: "## Writing for Ariko\n…" });
  assert.match(card, /^## pbbls$/m);
  assert.match(card, /ARIKO_TOKEN=ariko_pbbls_x/);
  assert.match(card, /www\.ariko\.app/);
  assert.match(card, /"ariko-article@ariko": true/);
  assert.match(card, /## Writing for Ariko/);
  assert.match(card, /ping Ariko/);
  const fenced = card.split("````md\n")[1].split("\n````")[0];
  assert.equal(fenced, "## Writing for Ariko\n…");
});

// A fake git that answers per subcommand (args[0]).
const git = (answers: Record<string, number | null>): GitRunner => (args) => ({
  status: args[0] in answers ? answers[args[0]] : 1,
});

test("envTargetProblem refuses a git-tracked file", () => {
  const r = envTargetProblem("/r/.env", git({ "rev-parse": 0, "ls-files": 0 }));
  assert.match(r ?? "", /tracked by git/);
});

test("envTargetProblem refuses an untracked file that is not gitignored", () => {
  const r = envTargetProblem("/r/.env", git({ "rev-parse": 0, "ls-files": 1, "check-ignore": 1 }));
  assert.match(r ?? "", /is not gitignored — add it to that repo's \.gitignore first/);
});

test("envTargetProblem accepts an untracked, gitignored file", () => {
  assert.equal(envTargetProblem("/r/.env", git({ "rev-parse": 0, "ls-files": 1, "check-ignore": 0 })), null);
});

test("envTargetProblem accepts a path outside any git repository", () => {
  assert.equal(envTargetProblem("/r/.env", git({ "rev-parse": 128 })), null);
});

test("both guards refuse when git could not run", () => {
  assert.match(envTargetProblem("/r/.env", git({ "rev-parse": null })) ?? "", /could not run git to check \/r\/\.env/);
  assert.match(sheetTargetProblem("/r/s.md", git({ "rev-parse": null })) ?? "", /could not run git to check \/r\/s\.md/);
});

test("sheetTargetProblem refuses a path inside a git work tree", () => {
  assert.match(sheetTargetProblem("/r/sheet.md", () => ({ status: 0 })) ?? "", /inside a git repository/);
  assert.equal(sheetTargetProblem("/Desktop/sheet.md", () => ({ status: 128 })), null);
});
