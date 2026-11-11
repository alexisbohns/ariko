// The hours engine (spec §4). Clones every configured repo treeless, reads
// author timestamps, builds the snapshot, POSTs it to the ingest door.
//
// Usage:
//   npm run hours:sync                         # CI: needs HOURS_GITHUB_TOKEN, HOURS_TOKEN
//   npm run hours:sync -- --dry-run            # clone + compute, print summary, no POST
//   npm run hours:sync -- --dry-run --local ~/code   # use local clones named like the repo
//
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
const localDir = localIdx >= 0 ? argv[localIdx + 1]?.replace(/^~/, homedir()) : undefined;
const url = process.env.HOURS_URL ?? "https://www.ariko.app/api/hours";

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function logLines(dir: string): string[] {
  return git(["-C", dir, "log", "--all", "--no-merges", "--format=%aI%x09%an%x09%ae"]).split("\n");
}

async function main(): Promise<void> {
  const cfg = getHoursConfig();
  const token = process.env.HOURS_GITHUB_TOKEN;
  if (!localDir && !token) throw new Error("HOURS_GITHUB_TOKEN is not set (or pass --local <dir>)");
  const work = mkdtempSync(join(tmpdir(), "hours-"));
  const stampsByRepo: Record<string, string[]> = {};
  try {
    for (const r of cfg.repos) {
      let dir: string;
      if (localDir) {
        dir = join(localDir, r.repo.split("/")[1]);
        if (!existsSync(join(dir, ".git"))) throw new Error(`no local clone at ${dir}`);
      } else {
        dir = join(work, r.repo.replace("/", "__"));
        const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
        try {
          git([
            "-c", `http.extraheader=AUTHORIZATION: basic ${basic}`,
            "clone", "--mirror", "--filter=blob:none", "--quiet",
            `https://github.com/${r.repo}.git`, dir,
          ]);
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
    rmSync(work, { recursive: true, force: true });
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
