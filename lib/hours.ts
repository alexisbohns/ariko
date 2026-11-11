// The work-hours method (spec §2), pure: no node:, no DB, no clock. The engine
// script feeds it git log lines; the site validates what arrives with it.
//
// Timestamps are the author's LOCAL wall clock as "YYYY-MM-DDTHH:MM:SS" with
// the offset removed — the time Alexis saw. All arithmetic parses them as if
// UTC, which is consistent because every operand is in the same frame.

export interface HoursSession {
  start: string;
  end: string;
  commits: number;
  hours: number;
}

export interface HoursUnit {
  key: string; // "global" | "plant:<slug>" | "repo:<owner/name>"
  name: string;
  plant?: string;
  repos: string[];
  commits: number;
  sessions: HoursSession[];
}

export interface HoursSnapshot {
  v: 1;
  generatedAt: string;
  params: { since: string; gapMinutes: number; leadMinutes: number };
  global: HoursUnit;
  plants: HoursUnit[];
  repos: HoursUnit[];
}

export interface SelectRules {
  identities: string[]; // lowercased
  exclude: RegExp[];
}

export interface SnapshotConfig {
  since: string;
  gapMinutes: number;
  leadMinutes: number;
  repos: { repo: string; name: string; plant?: string }[];
}

export const MAX_SNAPSHOT_BYTES = 512 * 1024;

const STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function localStamp(iso: string): string | null {
  const m = STAMP.exec(iso.trim());
  return m ? m[1] : null;
}

const ms = (local: string) => Date.parse(`${local}Z`);

/** Lines are `git log --format=%aI%x09%an%x09%ae`. Returns sorted unique local stamps. */
export function selectTimestamps(lines: string[], rules: SelectRules): string[] {
  const ids = new Set(rules.identities);
  const out = new Set<string>();
  for (const line of lines) {
    const [date, name, email] = line.split("\t");
    if (!date || name === undefined || email === undefined) continue;
    if (!ids.has(email.trim().toLowerCase())) continue;
    const who = `${name} <${email}>`;
    if (rules.exclude.some((re) => re.test(who))) continue;
    const stamp = localStamp(date);
    if (stamp) out.add(stamp);
  }
  return [...out].sort();
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function sessionize(stamps: string[], gapMinutes: number, leadMinutes: number): HoursSession[] {
  const sorted = [...new Set(stamps)].sort();
  const gap = gapMinutes * 60_000;
  const lead = leadMinutes * 60_000;
  const out: HoursSession[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  let n = 0;
  const close = () => {
    if (start && prev) {
      out.push({ start, end: prev, commits: n, hours: round3((ms(prev) - ms(start) + lead) / 3_600_000) });
    }
  };
  for (const t of sorted) {
    if (prev === null || ms(t) - ms(prev) > gap) {
      close();
      start = t;
      n = 0;
    }
    prev = t;
    n++;
  }
  close();
  return out;
}

function unit(
  key: string,
  name: string,
  repos: string[],
  stamps: string[],
  cfg: SnapshotConfig,
  plant?: string,
): HoursUnit {
  const all = [...new Set(stamps)];
  return {
    key,
    name,
    ...(plant ? { plant } : {}),
    repos,
    commits: all.length,
    sessions: sessionize(all, cfg.gapMinutes, cfg.leadMinutes),
  };
}

export function buildSnapshot(
  cfg: SnapshotConfig,
  stampsByRepo: Record<string, string[]>,
  generatedAt: string,
): HoursSnapshot {
  const of = (repo: string) => stampsByRepo[repo] ?? [];
  const repos = cfg.repos.map((r) => unit(`repo:${r.repo}`, r.name, [r.repo], of(r.repo), cfg, r.plant));
  const byPlant = new Map<string, string[]>();
  for (const r of cfg.repos) {
    if (r.plant) byPlant.set(r.plant, [...(byPlant.get(r.plant) ?? []), r.repo]);
  }
  const plants = [...byPlant].map(([slug, rs]) =>
    unit(`plant:${slug}`, slug, rs, rs.flatMap(of), cfg, slug),
  );
  const allRepos = cfg.repos.map((r) => r.repo);
  return {
    v: 1,
    generatedAt,
    params: { since: cfg.since, gapMinutes: cfg.gapMinutes, leadMinutes: cfg.leadMinutes },
    global: unit("global", "All projects", allRepos, allRepos.flatMap(of), cfg),
    plants,
    repos,
  };
}

type Result = { ok: true; snapshot: HoursSnapshot } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function checkUnit(u: unknown, where: string): string | null {
  if (!isObj(u)) return `${where} must be an object`;
  if (typeof u.key !== "string" || !u.key) return `${where}.key must be a string`;
  if (typeof u.name !== "string" || !u.name) return `${where}.name must be a string`;
  if (u.plant !== undefined && typeof u.plant !== "string") return `${where}.plant must be a string`;
  if (!Array.isArray(u.repos) || !u.repos.every((r) => typeof r === "string")) return `${where}.repos must be strings`;
  if (typeof u.commits !== "number" || u.commits < 0) return `${where}.commits must be a number`;
  if (!Array.isArray(u.sessions)) return `${where}.sessions must be a list`;
  for (let i = 0; i < u.sessions.length; i++) {
    const s = u.sessions[i];
    const at = `${where}.sessions[${i}]`;
    if (!isObj(s)) return `${at} must be an object`;
    if (typeof s.start !== "string" || !LOCAL.test(s.start)) return `${at}.start must be a local timestamp`;
    if (typeof s.end !== "string" || !LOCAL.test(s.end)) return `${at}.end must be a local timestamp`;
    if (s.end < s.start) return `${at} ends before it starts`;
    if (typeof s.commits !== "number" || s.commits < 1) return `${at}.commits must be ≥ 1`;
    if (typeof s.hours !== "number" || !(s.hours > 0) || s.hours > 48) return `${at}.hours must be in (0, 48]`;
  }
  return null;
}

export function validateSnapshot(x: unknown): Result {
  if (!isObj(x)) return { ok: false, error: "snapshot must be an object" };
  if (x.v !== 1) return { ok: false, error: "v must be 1" };
  if (typeof x.generatedAt !== "string" || Number.isNaN(Date.parse(x.generatedAt))) {
    return { ok: false, error: "generatedAt must be an ISO date" };
  }
  const p = x.params;
  if (!isObj(p) || typeof p.since !== "string" || !DAY.test(p.since)) {
    return { ok: false, error: "params.since must be YYYY-MM-DD" };
  }
  if (typeof p.gapMinutes !== "number" || typeof p.leadMinutes !== "number") {
    return { ok: false, error: "params.gapMinutes and leadMinutes must be numbers" };
  }
  const g = checkUnit(x.global, "global");
  if (g) return { ok: false, error: g };
  for (const list of ["plants", "repos"] as const) {
    const arr = x[list];
    if (!Array.isArray(arr)) return { ok: false, error: `${list} must be a list` };
    for (let i = 0; i < arr.length; i++) {
      const e = checkUnit(arr[i], `${list}[${i}]`);
      if (e) return { ok: false, error: e };
    }
  }
  return { ok: true, snapshot: x as unknown as HoursSnapshot };
}
