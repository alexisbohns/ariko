// scripts/repo-token.ts
//
//   npm run token:mint   -- --pod pbbls [--pod arkaik …] [--env ../pbbls/.env] [--sheet ~/Desktop/ariko-cloud-setup.md] [--label "…"]
//   npm run token:list
//   npm run token:revoke -- --pod pbbls
//
// Spec 2026-11-14 §2. Every guard runs BEFORE the first token is minted — the
// argument rules, an unknown pod, a refused --env or --sheet, an --env file
// whose ariko block cannot be replaced — so a refusal leaves the database
// untouched. Minting writes to the database .env.local points at: production,
// unless MONGODB_DB says otherwise, and the script says which before it starts.

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import { closeDb, getDb } from "../lib/db";
import { listTokens, mintToken, revokePod } from "../lib/repo-token-store";
import {
  envBlock,
  envTargetProblem,
  setupCard,
  sheetTargetProblem,
  upsertEnvBlock,
  type GitRunner,
} from "../lib/repo-token";

const git: GitRunner = (args, cwd) => spawnSync("git", args, { cwd, stdio: "ignore" });
const expand = (p: string) => resolve(p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
const today = () => new Date().toISOString().slice(0, 10);
const SNIPPET = resolve(dirname(new URL(import.meta.url).pathname), "../plugins/ariko-article/CLAUDE-SNIPPET.md");

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function mint(pods: string[], envPath?: string, sheetPath?: string, label?: string) {
  if (pods.length === 0) fail("--pod is required");
  if (new Set(pods).size !== pods.length) fail("--pod names the same pod twice");
  if (envPath && pods.length !== 1) fail("--env writes ONE repo's .env: pass exactly one --pod with it");

  // --- Guards. Nothing below this block may fail before the first mint. ---
  const env = envPath ? expand(envPath) : undefined;
  const sheet = sheetPath ? expand(sheetPath) : undefined;
  let envBefore = "";
  if (env) {
    if (!existsSync(dirname(env))) fail(`${dirname(env)} does not exist`);
    const problem = envTargetProblem(env, git);
    if (problem) fail(problem);
    envBefore = existsSync(env) ? readFileSync(env, "utf8") : "";
    try {
      // A dry run with a placeholder: an unterminated ariko block throws here,
      // not after the token already exists.
      upsertEnvBlock(envBefore, envBlock({ pod: pods[0], token: "ariko_dry_run", date: today() }));
    } catch (err) {
      fail(`${env}: ${err instanceof Error ? err.message : String(err)} — nothing was minted or written`);
    }
  }
  if (sheet) {
    if (!existsSync(dirname(sheet))) fail(`${dirname(sheet)} does not exist`);
    const problem = sheetTargetProblem(sheet, git);
    if (problem) fail(problem);
  }
  const snippet = readFileSync(SNIPPET, "utf8");
  const known = new Set(
    (await (await getDb()).collection("pods").find({ slug: { $in: pods } }, { projection: { slug: 1 } }).toArray()).map(
      (p) => p.slug as string,
    ),
  );
  for (const pod of pods) if (!known.has(pod)) fail(`unknown pod: ${pod} — nothing was minted`);

  // --- Mint. ---
  console.log(`Minting in database "${process.env.MONGODB_DB ?? "beanstalk"}" — previous tokens for these pods are revoked.\n`);
  const cards: string[] = [];
  let envBlockText: string | undefined;
  for (const pod of pods) {
    const token = await mintToken(pod, label ?? `${pod} — ${today()}`);
    cards.push(setupCard({ pod, token, claudeSnippet: snippet }));
    if (env) envBlockText = envBlock({ pod, token, date: today() });
  }
  const body = cards.join("\n---\n\n");

  // A token exists from here on and cannot be recovered, so a failed write
  // falls back to printing the cards rather than losing them.
  let printed = !env && !sheet;
  const lost = (target: string, err: unknown) => {
    console.error(`✗ ${target}: ${err instanceof Error ? err.message : String(err)} — nothing was written there; the card(s) follow`);
    if (!printed) console.log(body);
    printed = true;
    process.exitCode = 1;
  };
  if (env && envBlockText) {
    try {
      writeFileSync(env, upsertEnvBlock(envBefore, envBlockText));
      console.log(`✓ ${env} — ARIKO_TOKEN written (ariko block)`);
    } catch (err) {
      lost(env, err);
    }
  }
  if (sheet) {
    const header =
      `> **Delete this file once the cloud presets are set up.** It holds live tokens.\n` +
      `> Ariko stores only hashes: a lost token is re-minted, never recovered.\n\n` +
      `# Ariko cloud setup — ${today()}\n\n`;
    try {
      writeFileSync(sheet, header + body, { mode: 0o600 });
      chmodSync(sheet, 0o600);
      console.log(`✓ ${sheet} — ${pods.length} setup card(s), mode 600`);
    } catch (err) {
      lost(sheet, err);
    }
  }
  if (!env && !sheet) console.log(body);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  let values;
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        pod: { type: "string", multiple: true },
        env: { type: "string" },
        sheet: { type: "string" },
        label: { type: "string" },
      },
    }));
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  const pods = values.pod ?? [];
  try {
    if (command === "mint") await mint(pods, values.env, values.sheet, values.label);
    else if (command === "list") {
      for (const t of await listTokens())
        console.log(
          [t.pod, t.revokedAt ? `revoked ${t.revokedAt.slice(0, 10)}` : "LIVE", t.label,
           `created ${t.createdAt.slice(0, 10)}`, t.lastUsedAt ? `used ${t.lastUsedAt.slice(0, 10)}` : "never used"].join("  ·  "),
        );
    } else if (command === "revoke") {
      if (pods.length === 0) fail("--pod is required");
      for (const pod of pods) console.log(`${pod}: ${await revokePod(pod)} token(s) revoked`);
    } else fail("usage: repo-token.ts mint|list|revoke [--pod …]");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
