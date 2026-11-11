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
const GENERATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** A local "YYYY-MM-DDTHH:MM:SS" that exists on the calendar (no month 13, no 25:00, no Feb 31). */
export function realLocal(s: string): boolean {
  if (!LOCAL.test(s)) return false;
  const d = new Date(`${s}Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === s;
}

/** A "YYYY-MM-DD" that exists on the calendar. */
export function realDay(d: string): boolean {
  if (!DAY.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

const MAX_SESSION_HOURS = 168; // sanity bound only; the invariant below is the real check
const HOURS_SLACK = 0.002; // hours are rounded to 3 decimals

export function localStamp(iso: string): string | null {
  const m = STAMP.exec(iso.trim());
  return m ? m[1] : null;
}

const ms = (local: string) => Date.parse(`${local}Z`);

/** Commits GitHub itself created: squash/rebase merges (stamped at the merge click) and web edits. */
const GITHUB_COMMITTER = "noreply@github.com";

/**
 * Lines are `git log --format=%aI%x09%an%x09%ae%x09%ce`. Returns sorted unique local stamps.
 * A commit whose committer is GitHub is dropped (spec §2.1): the PR's own commits, kept
 * under refs/pull/*, already carry the real work times.
 */
export function selectTimestamps(lines: string[], rules: SelectRules): string[] {
  const ids = new Set(rules.identities);
  const out = new Set<string>();
  for (const line of lines) {
    const [date, name, email, committer] = line.split("\t");
    if (!date || name === undefined || email === undefined) continue;
    if (!ids.has(email.trim().toLowerCase())) continue;
    if (committer?.trim().toLowerCase() === GITHUB_COMMITTER) continue;
    const who = `${name.trim()} <${email.trim()}>`;
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
    unit(`plant:${slug}`, cfg.repos.find((r) => r.plant === slug)?.name ?? slug, rs, rs.flatMap(of), cfg, slug),
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

/**
 * Validates one unit and, on success, returns a FRESH object holding only the
 * known fields. Nothing the sender added survives (spec §5: sanitize at the door).
 */
function checkUnit(
  u: unknown,
  where: string,
  leadMinutes: number,
): { error: string } | { unit: HoursUnit } {
  const fail = (error: string) => ({ error });
  if (!isObj(u)) return fail(`${where} must be an object`);
  if (typeof u.key !== "string" || !u.key) return fail(`${where}.key must be a string`);
  if (typeof u.name !== "string" || !u.name) return fail(`${where}.name must be a string`);
  if (u.plant !== undefined && typeof u.plant !== "string") return fail(`${where}.plant must be a string`);
  if (!Array.isArray(u.repos) || !u.repos.every((r) => typeof r === "string")) return fail(`${where}.repos must be strings`);
  if (!Number.isInteger(u.commits) || (u.commits as number) < 0) return fail(`${where}.commits must be a number`);
  if (!Array.isArray(u.sessions)) return fail(`${where}.sessions must be a list`);
  const sessions: HoursSession[] = [];
  for (let i = 0; i < u.sessions.length; i++) {
    const s = u.sessions[i];
    const at = `${where}.sessions[${i}]`;
    if (!isObj(s)) return fail(`${at} must be an object`);
    if (typeof s.start !== "string" || !realLocal(s.start)) return fail(`${at}.start must be a local timestamp`);
    if (typeof s.end !== "string" || !realLocal(s.end)) return fail(`${at}.end must be a local timestamp`);
    if (s.end < s.start) return fail(`${at} ends before it starts`);
    if (!Number.isInteger(s.commits) || (s.commits as number) < 1) return fail(`${at}.commits must be ≥ 1`);
    if (typeof s.hours !== "number" || !Number.isFinite(s.hours) || s.hours <= 0 || s.hours > MAX_SESSION_HOURS) {
      return fail(`${at}.hours must be a finite number in (0, ${MAX_SESSION_HOURS}]`);
    }
    // The method's invariant (spec §2.3): hours = (last − first) + lead.
    const expected = (ms(s.end) - ms(s.start)) / 3_600_000 + leadMinutes / 60;
    if (Math.abs(s.hours - expected) >= HOURS_SLACK) {
      return fail(`${at}.hours ${s.hours} does not match its span plus lead (${round3(expected)})`);
    }
    sessions.push({ start: s.start, end: s.end, commits: s.commits as number, hours: s.hours });
  }
  return {
    unit: {
      key: u.key,
      name: u.name,
      ...(u.plant !== undefined ? { plant: u.plant } : {}),
      repos: [...(u.repos as string[])],
      commits: u.commits as number,
      sessions,
    },
  };
}



export function validateSnapshot(x: unknown): Result {
  if (!isObj(x)) return { ok: false, error: "snapshot must be an object" };
  if (x.v !== 1) return { ok: false, error: "v must be 1" };
  if (typeof x.generatedAt !== "string" || !GENERATED_AT.test(x.generatedAt) || Number.isNaN(Date.parse(x.generatedAt))) {
    return { ok: false, error: "generatedAt must be a UTC ISO date" };
  }
  const p = x.params;
  if (!isObj(p) || typeof p.since !== "string" || !realDay(p.since)) {
    return { ok: false, error: "params.since must be a real YYYY-MM-DD date" };
  }
  const posInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
  if (!posInt(p.gapMinutes)) return { ok: false, error: "params.gapMinutes must be a positive integer" };
  if (!posInt(p.leadMinutes)) return { ok: false, error: "params.leadMinutes must be a positive integer" };
  const lead = p.leadMinutes;
  const g = checkUnit(x.global, "global", lead);
  if ("error" in g) return { ok: false, error: g.error };
  const lists: Record<"plants" | "repos", HoursUnit[]> = { plants: [], repos: [] };
  for (const list of ["plants", "repos"] as const) {
    const arr = x[list];
    if (!Array.isArray(arr)) return { ok: false, error: `${list} must be a list` };
    for (let i = 0; i < arr.length; i++) {
      const e = checkUnit(arr[i], `${list}[${i}]`, lead);
      if ("error" in e) return { ok: false, error: e.error };
      lists[list].push(e.unit);
    }
  }
  return {
    ok: true,
    snapshot: {
      v: 1,
      generatedAt: x.generatedAt,
      params: { since: p.since, gapMinutes: p.gapMinutes, leadMinutes: p.leadMinutes },
      global: g.unit,
      plants: lists.plants,
      repos: lists.repos,
    },
  };
}
