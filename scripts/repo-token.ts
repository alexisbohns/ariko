// scripts/repo-token.ts
//
//   npm run token:mint   -- --plant pbbls [--plant arkaik …] [--env ../pbbls/.env] [--sheet ~/Desktop/ariko-cloud-setup.md] [--label "…"]
//   npm run token:list
//   npm run token:revoke -- --plant pbbls
//
// Spec 2026-11-14 §2. Every guard runs BEFORE the first token is minted — the
// argument rules, an unknown plant, a refused --env or --sheet, an --env file
// whose ariko block cannot be replaced — so a refusal leaves the database
// untouched. Minting writes to the database .env.local points at: production,
// unless MONGODB_DB says otherwise, and the script says which before it starts.

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import { closeDb, getDb } from "../lib/db";
import { listTokens, mintToken, revokePlant } from "../lib/repo-token-store";
import {
  envBlock,
  envTargetProblem,
  setupCard,
  SKILL_SETUP,
  sheetTargetProblem,
  upsertEnvBlock,
  type GitRunner,
} from "../lib/repo-token";

const git: GitRunner = (args, cwd) => spawnSync("git", args, { cwd, stdio: "ignore" });
const expand = (p: string) => resolve(p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
const today = () => new Date().toISOString().slice(0, 10);

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function mint(plants: string[], envPath?: string, sheetPath?: string, label?: string) {
  if (plants.length === 0) fail("--plant is required");
  if (new Set(plants).size !== plants.length) fail("--plant names the same plant twice");
  if (envPath && plants.length !== 1) fail("--env writes ONE repo's .env: pass exactly one --plant with it");

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
      upsertEnvBlock(envBefore, envBlock({ plant: plants[0], token: "ariko_dry_run", date: today() }));
    } catch (err) {
      fail(`${env}: ${err instanceof Error ? err.message : String(err)} — nothing was minted or written`);
    }
  }
  if (sheet) {
    if (!existsSync(dirname(sheet))) fail(`${dirname(sheet)} does not exist`);
    const problem = sheetTargetProblem(sheet, git);
    if (problem) fail(problem);
  }
  const known = new Set(
    (await (await getDb()).collection("plants").find({ slug: { $in: plants } }, { projection: { slug: 1 } }).toArray()).map(
      (p) => p.slug as string,
    ),
  );
  for (const plant of plants) if (!known.has(plant)) fail(`unknown plant: ${plant} — nothing was minted`);

  // --- Mint. ---
  console.log(`Minting in database "${process.env.MONGODB_DB ?? "beanstalk"}" — previous tokens for these plants are revoked.\n`);
  const cards: string[] = [];
  let envBlockText: string | undefined;
  try {
    for (const plant of plants) {
      const token = await mintToken(plant, label ?? `${plant} — ${today()}`);
      cards.push(setupCard({ plant, token }));
      if (env) envBlockText = envBlock({ plant, token, date: today() });
    }
  } catch (err) {
    // Tokens already minted are live and unrecoverable (hashes only): show
    // them, then fail. Earlier ones are NOT rolled back.
    if (cards.length > 0) {
      console.error(`✗ minting stopped after ${cards.length} of ${plants.length} plant(s) — the card(s) minted so far follow`);
      console.log(cards.join("\n---\n\n"));
    }
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
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
      const created = !existsSync(env);
      writeFileSync(env, upsertEnvBlock(envBefore, envBlockText), created ? { mode: 0o600 } : undefined);
      if (created) chmodSync(env, 0o600);
      console.log(`✓ ${env} — ARIKO_TOKEN written (ariko block)`);
    } catch (err) {
      lost(env, err);
    }
  }
  if (sheet) {
    const header =
      `> **Delete this file once the cloud presets are set up.** It holds live tokens.\n` +
      `> Ariko stores only hashes: a lost token is re-minted, never recovered.\n\n` +
      `# Ariko cloud setup — ${today()}\n\n` +
      SKILL_SETUP +
      `\n---\n\n`;
    try {
      // Private BEFORE the tokens land in it: an existing file keeps its old
      // mode through a write, so tighten it first; a new one is created 0600.
      if (existsSync(sheet)) chmodSync(sheet, 0o600);
      writeFileSync(sheet, header + body, { mode: 0o600 });
      chmodSync(sheet, 0o600);
      console.log(`✓ ${sheet} — ${plants.length} setup card(s), mode 600`);
    } catch (err) {
      lost(sheet, err);
    }
  }
  if (!env && !sheet) console.log(SKILL_SETUP + "\n---\n\n" + body);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  let values;
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        plant: { type: "string", multiple: true },
        env: { type: "string" },
        sheet: { type: "string" },
        label: { type: "string" },
      },
    }));
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  const plants = values.plant ?? [];
  try {
    if (command === "mint") await mint(plants, values.env, values.sheet, values.label);
    else if (command === "list") {
      for (const t of await listTokens())
        console.log(
          [t.plant, t.revokedAt ? `revoked ${t.revokedAt.slice(0, 10)}` : "LIVE", t.label,
           `created ${t.createdAt.slice(0, 10)}`, t.lastUsedAt ? `used ${t.lastUsedAt.slice(0, 10)}` : "never used"].join("  ·  "),
        );
    } else if (command === "revoke") {
      if (plants.length === 0) fail("--plant is required");
      for (const plant of plants) console.log(`${plant}: ${await revokePlant(plant)} token(s) revoked`);
    } else fail("usage: repo-token.ts mint|list|revoke [--plant …]");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
