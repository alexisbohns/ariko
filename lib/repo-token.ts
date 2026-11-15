// lib/repo-token.ts
//
// Pure half of the per-repo tokens (spec 2026-11-14 §2): the token's shape,
// its hash, and everything `npm run token:mint` hands the maintainer — the
// setup card for one cloud environment preset, and the marked `.env` block a
// later mint replaces rather than duplicates. The Mongo half is
// lib/repo-token-store.ts.
//
// The `ariko_<plant>_` prefix is for a human reading an .env. Authorization is a
// hash lookup and NEVER parses the prefix as a claim — the plant a token writes
// to is the one stored beside its hash.

import { createHash, randomBytes } from "node:crypto";
import { dirname, basename } from "node:path";

export const ARIKO_URL = "https://www.ariko.app";
export const ENV_BLOCK_START = "# >>> ariko";
export const ENV_BLOCK_END = "# <<< ariko";

export function generateToken(plant: string): string {
  return `ariko_${plant}_${randomBytes(24).toString("base64url")}`;
}

// A cheap gate, not a verdict: a bearer that does not start `ariko_` is refused without a database read.
export function looksLikeRepoToken(token: string): boolean {
  return token.startsWith("ariko_");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function envBlock({ plant, token, date }: { plant: string; token: string; date: string }): string {
  return [
    `${ENV_BLOCK_START} (minted ${date} by \`npm run token:mint -- --plant ${plant}\`)`,
    "# Drafts for Ariko: the ariko-article skill reads these.",
    "# CLOUD SESSIONS do not see this file. In the Claude Code cloud environment",
    "# preset for this repo, also:",
    "#   - Environment variables: ARIKO_TOKEN and ARIKO_URL, same values as below",
    "#   - Network access: allow www.ariko.app",
    `ARIKO_TOKEN=${token}`,
    `ARIKO_URL=${ARIKO_URL}`,
    ENV_BLOCK_END,
    "",
  ].join("\n");
}

// Whole-word match: `# >>> ariko-cli config` is somebody else's block, not ours.
// A CRLF file leaves a trailing \r on every split line; ignore it for the compare.
const isMarker = (line: string, marker: string) => {
  const l = line.replace(/\r$/, "");
  return l === marker || l.startsWith(marker + " ");
};

/**
 * Replace the marked block, else append it after a blank line. Markers match
 * as whole lines only. Every existing block is removed and the new one takes
 * the first one's place; an unterminated block is refused rather than guessed.
 */
export function upsertEnvBlock(existing: string, block: string): string {
  const lines = existing.split("\n");
  const out: string[] = [];
  let placed = false;
  for (let i = 0; i < lines.length; i++) {
    if (isMarker(lines[i], ENV_BLOCK_START)) {
      let end = -1;
      for (let j = i + 1; j < lines.length; j++)
        if (isMarker(lines[j], ENV_BLOCK_END)) {
          end = j;
          break;
        }
      if (end === -1) throw new Error("env file has an unterminated ariko block — fix it by hand");
      if (!placed) {
        out.push(...block.replace(/\n$/, "").split("\n"));
        placed = true;
      }
      i = end;
      continue;
    }
    out.push(lines[i]);
  }
  if (placed) return out.join("\n");
  if (existing === "") return block;
  return existing.replace(/\n*$/, "\n\n") + block;
}

// Said once at the top of a sheet, not on every card: the skill is NOT a
// per-repo thing. Cloud sessions ignore a repo's `enabledPlugins` and never
// see user-level plugins, but they load skills enabled on the claude.ai
// account — so one upload serves every repo, and an update is one re-upload.
export const SKILL_SETUP = [
  "**The skill, once for every repo (nothing goes in the repos):**",
  "",
  "- **Cloud:** `npm run skill:zip` in the Ariko repo, then upload the zip at",
  "  claude.ai → Settings → Capabilities → Skills. Re-upload when the skill changes.",
  "- **Local:** `/plugin install ariko-article@ariko` once, at user scope.",
  "",
].join("\n");

export function setupCard({ plant, token }: { plant: string; token: string }): string {
  return [
    `## ${plant}`,
    "",
    "**1. Cloud preset → Environment variables** (paste as is):",
    "",
    "```",
    `ARIKO_TOKEN=${token}`,
    `ARIKO_URL=${ARIKO_URL}`,
    "```",
    "",
    "**2. Cloud preset → Network access:** add `www.ariko.app` to the allowed domains",
    "(or use full access). Nothing else: images go through Ariko.",
    "",
    "**3. Check:** open a cloud session in this repo and ask it to ping Ariko;",
    `it should answer with the plant \`${plant}\`.`,
    "",
  ].join("\n");
}

export type GitRunner = (args: string[], cwd: string) => { status: number | null };

const gitFailure = (path: string) => `could not run git to check ${path}`;

/** null when the path is safe to write a token into; else why not. */
export function envTargetProblem(path: string, git: GitRunner): string | null {
  const cwd = dirname(path);
  const base = basename(path);
  const inside = git(["rev-parse", "--is-inside-work-tree"], cwd);
  if (inside.status === null) return gitFailure(path);
  if (inside.status !== 0) return null; // not a repository: nothing can publish it
  const tracked = git(["ls-files", "--error-unmatch", base], cwd);
  if (tracked.status === null) return gitFailure(path);
  if (tracked.status === 0)
    return `${path} is tracked by git — a token written there would be published on the next push`;
  const ignored = git(["check-ignore", "-q", base], cwd);
  if (ignored.status === null) return gitFailure(path);
  return ignored.status === 0
    ? null
    : `${path} is not gitignored — add it to that repo's .gitignore first`;
}

export function sheetTargetProblem(path: string, git: GitRunner): string | null {
  const { status } = git(["rev-parse", "--is-inside-work-tree"], dirname(path));
  if (status === null) return gitFailure(path);
  return status === 0
    ? `${path} is inside a git repository — write the sheet somewhere no commit can pick it up`
    : null;
}
