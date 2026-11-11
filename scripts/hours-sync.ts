// The hours engine (spec §4). Clones every configured repo treeless, reads
// author timestamps, builds the snapshot, POSTs it to the ingest door.
//
// Usage:
//   npm run hours:sync                         # CI: needs HOURS_GITHUB_TOKEN, HOURS_TOKEN
//   npm run hours:sync -- --dry-run            # clone + compute, print summary, no POST
//   npm run hours:sync -- --dry-run --local ~/code   # use local clones named like the repo
//   HOURS_URL=http://localhost:3333/api/hours npm run hours:sync -- --local ~/code   # seed a local dev server
//
// --local reads LOCAL branches, which differ from the remote refs, so it is for
// --dry-run only and must never POST to production: without --dry-run it is
// accepted only when HOURS_URL points at localhost or 127.0.0.1.

// All or nothing: any clone or log failure exits 1 before anything is sent.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { getHoursConfig } from "../lib/hours-config";
import { buildSnapshot, selectTimestamps } from "../lib/hours";
import { aggregateUnit, parisToday } from "../lib/hours-aggregate";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const localIdx = argv.indexOf("--local");
const localArg = localIdx >= 0 ? argv[localIdx + 1] : undefined;
const url = process.env.HOURS_URL ?? "https://www.ariko.app/api/hours";

function isLoopback(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

function guardFlags(): void {
  if (localIdx < 0) return;
  if (!localArg || localArg.startsWith("--")) throw new Error("--local needs a directory");
  if (!dryRun && !(process.env.HOURS_URL && isLoopback(process.env.HOURS_URL))) {
    throw new Error(
      "--local is for --dry-run only (or HOURS_URL pointing at localhost): local branches must never be POSTed to production",
    );
  }
}
const localDir = localArg?.replace(/^~/, homedir());

function git(args: string[], opts: { env?: NodeJS.ProcessEnv; timeout?: number } = {}): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function logLines(dir: string): string[] {
  return git(["-C", dir, "log", "--all", "--no-merges", "--format=%aI%x09%an%x09%ae"]).split("\n");
}

async function main(): Promise<void> {
  guardFlags();
  const cfg = getHoursConfig();
  const token = process.env.HOURS_GITHUB_TOKEN;
  if (!localDir && !token) throw new Error("HOURS_GITHUB_TOKEN is not set (or pass --local <dir>)");
  // Network mode only: --local never needs a scratch dir.
  const work = localDir ? undefined : mkdtempSync(join(tmpdir(), "hours-"));
  const stampsByRepo: Record<string, string[]> = {};
  try {
    for (const r of cfg.repos) {
      let dir: string;
      if (localDir) {
        dir = join(localDir, r.repo.split("/")[1]);
        if (!existsSync(join(dir, ".git"))) throw new Error(`no local clone at ${dir}`);
      } else {
        dir = join(work as string, r.repo.replace("/", "__"));
        const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
        try {
          // The auth header travels in the environment, never in argv (which
          // `ps` shows to every user on the runner).
          git(
            ["clone", "--mirror", "--filter=blob:none", "--quiet", `https://github.com/${r.repo}.git`, dir],
            {
              timeout: 10 * 60_000,
              env: {
                ...process.env,
                GIT_CONFIG_COUNT: "1",
                GIT_CONFIG_KEY_0: "http.extraheader",
                GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
              },
            },
          );
        } catch (err) {
          // Never echo the header: report the repo and git's own stderr only.
          const stderr = (err as { stderr?: string }).stderr ?? "";
          throw new Error(`clone failed for ${r.repo}: ${stderr.replaceAll(basic, "***").trim()}`);
        }
      }
      stampsByRepo[r.repo] = selectTimestamps(logLines(dir), cfg);
      console.log(`${r.repo}: ${stampsByRepo[r.repo].length} commits`);
    }
  } finally {
    if (work) rmSync(work, { recursive: true, force: true });
  }

  const snapshot = buildSnapshot(cfg, stampsByRepo, new Date().toISOString());
  const today = parisToday();
  for (const u of [snapshot.global, ...snapshot.plants, ...snapshot.repos]) {
    const a = aggregateUnit(u, cfg.since, today);
    console.log(
      `${u.key.padEnd(32)} since ${cfg.since}: ${a.totalSince.toFixed(1)} h, ${a.sessionsSince} sessions, ${a.avgWeek} h/wk`,
    );
  }
  const body = JSON.stringify(snapshot);
  console.log(`snapshot: ${(Buffer.byteLength(body) / 1024).toFixed(1)} KiB`);
  if (dryRun) return;

  const ingest = process.env.HOURS_TOKEN;
  if (!ingest) throw new Error("HOURS_TOKEN is not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ingest}` },
    body,
  });
  const text = await res.text();
  console.log(`POST ${url} → ${res.status} ${text}`);
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
