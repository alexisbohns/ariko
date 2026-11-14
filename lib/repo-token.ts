// lib/repo-token.ts
//
// Pure half of the per-repo tokens (spec 2026-11-14 §2): the token's shape,
// its hash, and everything `npm run token:mint` hands the maintainer — the
// setup card for one cloud environment preset, and the marked `.env` block a
// later mint replaces rather than duplicates. The Mongo half is
// lib/repo-token-store.ts.
//
// The `ariko_<pod>_` prefix is for a human reading an .env. Authorization is a
// hash lookup and NEVER parses the prefix as a claim — the pod a token writes
// to is the one stored beside its hash.

import { createHash, randomBytes } from "node:crypto";
import { dirname, basename } from "node:path";

export const ARIKO_URL = "https://www.ariko.app";
export const ENV_BLOCK_START = "# >>> ariko";
export const ENV_BLOCK_END = "# <<< ariko";

export function generateToken(pod: string): string {
  return `ariko_${pod}_${randomBytes(24).toString("base64url")}`;
}

export function looksLikeRepoToken(token: string): boolean {
  return token.startsWith("ariko_");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function envBlock({ pod, token, date }: { pod: string; token: string; date: string }): string {
  return [
    `${ENV_BLOCK_START} (minted ${date} by \`npm run token:mint -- --pod ${pod}\`)`,
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

/** Replace the marked block if present, else append it after a blank line. */
export function upsertEnvBlock(existing: string, block: string): string {
  const start = existing.indexOf(ENV_BLOCK_START);
  const end = existing.indexOf(ENV_BLOCK_END);
  if (start !== -1 && end > start) {
    const after = existing.slice(end + ENV_BLOCK_END.length).replace(/^\n/, "");
    return existing.slice(0, start) + block + after;
  }
  if (existing === "") return block;
  return existing.replace(/\n*$/, "\n\n") + block;
}

const SETTINGS_SNIPPET = `{
  "extraKnownMarketplaces": {
    "ariko": { "source": { "source": "github", "repo": "alexisbohns/ariko" } }
  },
  "enabledPlugins": { "ariko-article@ariko": true }
}`;

export function setupCard({ pod, token, claudeSnippet }: { pod: string; token: string; claudeSnippet: string }): string {
  return [
    `## ${pod}`,
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
    "**3. Repo → `.claude/settings.json`** (merge into it):",
    "",
    "```json",
    SETTINGS_SNIPPET,
    "```",
    "",
    "**4. Repo → `CLAUDE.md`** (paste this section):",
    "",
    "````md",
    claudeSnippet.trimEnd(),
    "````",
    "",
    "**5. Check:** open a cloud session in this repo and ask it to ping Ariko;",
    `it should answer with the pod \`${pod}\`.`,
    "",
  ].join("\n");
}

export type GitRunner = (args: string[], cwd: string) => { status: number | null };

/** null when the path is safe to write a token into; else why not. */
export function envTargetProblem(path: string, git: GitRunner): string | null {
  const { status } = git(["ls-files", "--error-unmatch", basename(path)], dirname(path));
  return status === 0
    ? `${path} is tracked by git — a token written there would be published on the next push`
    : null;
}

export function sheetTargetProblem(path: string, git: GitRunner): string | null {
  const { status } = git(["rev-parse", "--is-inside-work-tree"], dirname(path));
  return status === 0
    ? `${path} is inside a git repository — write the sheet somewhere no commit can pick it up`
    : null;
}
