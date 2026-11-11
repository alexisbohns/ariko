# Work Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ariko estimates Alexis's work hours from commit timestamps and shows them publicly on `/hours` and on plant pages. A cron Action keeps the numbers fresh, and the Monday digest gets a one-line hours tally.

**Architecture:**
- A scheduled GitHub Action runs `scripts/hours-sync.ts`. The script mirror-clones the configured GitHub repos (treeless), reads author timestamps, and computes sessions with pure `lib/hours.ts`. It then POSTs a snapshot to a guarded `/api/hours` door.
- Ariko stores one rebuildable snapshot document in Mongo.
- Public pages read it through a tagged Data Cache and derive every aggregate on read with pure `lib/hours-aggregate.ts`.

**Tech stack:** Next.js 15 / React 19 / TypeScript, MongoDB, `node:test` through tsx, js-yaml, Tailwind v4 + shadcn (Base UI), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-11-work-hours-design.md`. Read §2, the method; it is normative.

**Repo rules that apply here (CLAUDE.md):**
- Every public-rendered file joins `SERVER_SAFE` in `lib/server-safe-source.test.ts`. That means no `"use client"`, no `lucide-react`, no `next/link` and no `node:` import in those files.
- Public pages never import `lib/store.ts`.
- Tests run with `npm test`. DB tests run with `npm run test:db`, which uses the scratch DB `beanstalk_scratch` from `.env.local`.
- Commit author `hello@bohns.design`. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Responsibility |
|---|---|
| `data/hours.yml` | Versioned config: identities, excludes, repos→plants, method params |
| `lib/hours-config.ts` (+test) | Parse/validate `hours.yml` (node:fs reader + pure parser) |
| `lib/hours.ts` (+test) | Pure method: select timestamps, sessionize, build/validate snapshot |
| `lib/hours-aggregate.ts` (+test) | Pure aggregates: days/weeks/months/averages/rhythm/streak, week tally, heat level |
| `scripts/hours-sync.ts` | Engine: clone, log, build, POST or dry-run summary |
| `lib/hours-store.ts` | Mongo read/write of the single snapshot doc |
| `lib/hours-cache.ts` | Public cached reader + tag revalidation |
| `app/api/hours/route.ts` (+`lib/hours-route.test.ts`) | GET public snapshot+aggregates; POST guarded ingest |
| `components/heat-calendar.tsx` (+test) | Server-safe 53-week SVG calendar |
| `components/hours-weekly-bars.tsx` | Server-safe weekly bar chart |
| `components/hours-tables.tsx` | Server-safe per-week / per-month tables |
| `app/(public)/(chrome)/hours/page.tsx` | Public `/hours` page |
| `app/(public)/_components/public-chrome.tsx`, `components/public-icons.tsx` | Nav link + calendar glyph |
| `app/(public)/(chrome)/plant/[slug]/page.tsx` | "Work" block |
| `app/api/synthesis/week/route.ts`, `docs/synthesis/weekly-digest-routine.md` | Digest hours tally |
| `.github/workflows/hours-sync.yml` | Cron |

---

### Task 1: Config — `data/hours.yml` + `lib/hours-config.ts`

**Files:**
- Create: `data/hours.yml`, `lib/hours-config.ts`, `lib/hours-config.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/hours-config.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { parseHoursConfig } from "./hours-config";

const base = {
  since: "2026-03-16",
  gapMinutes: 120,
  leadMinutes: 30,
  identities: ["Hello@Bohns.design"],
  exclude: ["\\[bot\\]"],
  repos: [{ repo: "alexisbohns/pbbls", name: "pbbls", plant: "pbbls" }],
};

test("parses a valid config and lowercases identities", () => {
  const c = parseHoursConfig(base);
  assert.equal(c.since, "2026-03-16");
  assert.deepEqual(c.identities, ["hello@bohns.design"]);
  assert.ok(c.exclude[0].test("dependabot[bot] <x@y>"));
  assert.deepEqual(c.repos, [{ repo: "alexisbohns/pbbls", name: "pbbls", plant: "pbbls" }]);
});

test("plant is optional", () => {
  const c = parseHoursConfig({ ...base, repos: [{ repo: "alexisbohns/krabs", name: "krabs" }] });
  assert.equal(c.repos[0].plant, undefined);
});

for (const [label, patch, msg] of [
  ["unknown top-level key", { colour: "green" }, /unknown key "colour"/],
  ["bad since", { since: "16/03/2026" }, /since/],
  ["zero gap", { gapMinutes: 0 }, /gapMinutes/],
  ["negative lead", { leadMinutes: -1 }, /leadMinutes/],
  ["empty identities", { identities: [] }, /identities/],
  ["invalid regex", { exclude: ["("] }, /exclude\[0\]/],
  ["malformed repo", { repos: [{ repo: "pbbls", name: "pbbls" }] }, /owner\/name/],
  ["duplicate repo", { repos: [{ repo: "a/b", name: "b" }, { repo: "a/b", name: "b2" }] }, /duplicate repo/],
  ["bad plant slug", { repos: [{ repo: "a/b", name: "b", plant: "Not A Slug" }] }, /plant/],
  ["unknown repo key", { repos: [{ repo: "a/b", name: "b", colour: 1 }] }, /unknown key "colour"/],
] as const) {
  test(`refuses: ${label}`, () => {
    assert.throws(() => parseHoursConfig({ ...base, ...patch }), msg);
  });
}

test("the committed data/hours.yml is valid", () => {
  const raw = yaml.load(readFileSync(join(process.cwd(), "data", "hours.yml"), "utf8"), {
    schema: yaml.CORE_SCHEMA,
  });
  const c = parseHoursConfig(raw);
  assert.ok(c.repos.length >= 10);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test 2>&1 | grep -E "hours-config|not ok|Cannot find" | head`
Expected: FAIL because `./hours-config` cannot be found.

- [ ] **Step 3: Write `data/hours.yml`**

```yaml
# Work hours (spec docs/superpowers/specs/2026-11-11-work-hours-design.md).
# Which GitHub repos count, whose commits are Alexis's, and the session method.
# Merging is deploying: the next hours-sync run uses this file.
since: 2026-03-16      # averages start here; calendars always show 53 weeks
gapMinutes: 120        # a longer silence starts a new session
leadMinutes: 30        # credited before each session's first commit
identities:
  - hello@bohns.design
  - alexis.bohn@teale.io
  - alexis@enerfip.fr
  - 58178426+alexisbohns@users.noreply.github.com
exclude:               # case-insensitive, matched on "Name <email>"
  - "\\[bot\\]"
  - "^claude <"
  - "^copilot <"
  - "noreply@anthropic\\.com"
repos:
  - { repo: alexisbohns/pbbls, name: pbbls, plant: pbbls }
  - { repo: alexisbohns/arkaik, name: arkaik, plant: arkaik }
  - { repo: alexisbohns/ariko, name: ariko, plant: ariko }
  - { repo: alexisbohns/femfolk, name: femfolk, plant: femfolk }
  - { repo: alexisbohns/melogram, name: melogram, plant: melogram }
  - { repo: alexisbohns/paulopus, name: paulopus, plant: paulopus }
  - { repo: OxymoreApp/Oxymore, name: Oxymore, plant: oxymore }
  - { repo: alexisbohns/bohnsdesign, name: bohnsdesign }
  - { repo: alexisbohns/letsgong, name: letsgong }
  - { repo: alexisbohns/krabs, name: krabs }
  - { repo: alexisbohns/sparkaik, name: sparkaik }
  - { repo: l855skipi/skillteplait, name: skillteplait }
```

- [ ] **Step 4: Write `lib/hours-config.ts`**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { isObject, nonEmptyString } from "./text-input";

// The hours config (spec §3). A pure parser plus a node:fs reader, split the
// way lib/federation.ts is: the parser is testable on literals, and only the
// engine script and server code call the reader. Throws on any bad shape — a
// broken config must fail the sync loudly, never half-run.

export interface HoursRepo {
  repo: string; // "owner/name" on GitHub
  name: string; // display name, public
  plant?: string; // plant slug the repo rolls up to
}

export interface HoursConfig {
  since: string; // YYYY-MM-DD
  gapMinutes: number;
  leadMinutes: number;
  identities: string[]; // lowercased author emails
  exclude: RegExp[]; // case-insensitive, on "Name <email>"
  repos: HoursRepo[];
}

const TOP_KEYS = new Set(["since", "gapMinutes", "leadMinutes", "identities", "exclude", "repos"]);
const REPO_KEYS = new Set(["repo", "name", "plant"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

function unknownKeys(o: Record<string, unknown>, allowed: Set<string>, where: string): void {
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) throw new Error(`${where}: unknown key "${k}"`);
  }
}

function positiveInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return v;
}

export function parseHoursConfig(raw: unknown): HoursConfig {
  if (!isObject(raw)) throw new Error("hours.yml must be a mapping");
  unknownKeys(raw, TOP_KEYS, "hours.yml");

  // CORE_SCHEMA keeps an unquoted date a string; a Date would mean a different schema.
  const since = raw.since instanceof Date ? raw.since.toISOString().slice(0, 10) : raw.since;
  if (typeof since !== "string" || !DAY.test(since) || Number.isNaN(Date.parse(since))) {
    throw new Error("since must be a YYYY-MM-DD date");
  }
  const gapMinutes = positiveInt(raw.gapMinutes, "gapMinutes");
  const leadMinutes = positiveInt(raw.leadMinutes, "leadMinutes");

  if (!Array.isArray(raw.identities) || raw.identities.length === 0) {
    throw new Error("identities must be a non-empty list");
  }
  const identities = raw.identities.map((e, i) => {
    if (!nonEmptyString(e) || !e.includes("@")) throw new Error(`identities[${i}] must be an email`);
    return e.trim().toLowerCase();
  });

  const excludeRaw = raw.exclude ?? [];
  if (!Array.isArray(excludeRaw)) throw new Error("exclude must be a list");
  const exclude = excludeRaw.map((p, i) => {
    if (!nonEmptyString(p)) throw new Error(`exclude[${i}] must be a regex string`);
    try {
      return new RegExp(p, "i");
    } catch {
      throw new Error(`exclude[${i}] is not a valid regex: ${p}`);
    }
  });

  if (!Array.isArray(raw.repos) || raw.repos.length === 0) throw new Error("repos must be a non-empty list");
  const seen = new Set<string>();
  const repos = raw.repos.map((r, i): HoursRepo => {
    if (!isObject(r)) throw new Error(`repos[${i}] must be a mapping`);
    unknownKeys(r, REPO_KEYS, `repos[${i}]`);
    if (!nonEmptyString(r.repo) || !OWNER_NAME.test(r.repo)) {
      throw new Error(`repos[${i}].repo must be "owner/name"`);
    }
    const key = r.repo.toLowerCase();
    if (seen.has(key)) throw new Error(`duplicate repo "${r.repo}"`);
    seen.add(key);
    if (!nonEmptyString(r.name)) throw new Error(`repos[${i}].name is required`);
    if (r.plant !== undefined && (typeof r.plant !== "string" || !SLUG.test(r.plant))) {
      throw new Error(`repos[${i}].plant must be a plant slug`);
    }
    return { repo: r.repo, name: r.name.trim(), ...(r.plant ? { plant: r.plant as string } : {}) };
  });

  return { since, gapMinutes, leadMinutes, identities, exclude, repos };
}

let cached: HoursConfig | undefined;

export function getHoursConfig(): HoursConfig {
  if (!cached) {
    const file = readFileSync(join(process.cwd(), "data", "hours.yml"), "utf8");
    cached = parseHoursConfig(yaml.load(file, { schema: yaml.CORE_SCHEMA }));
  }
  return cached;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add data/hours.yml lib/hours-config.ts lib/hours-config.test.ts
git commit -m "Work hours: the config that says which repos and which author count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The method — `lib/hours.ts`

**Files:**
- Create: `lib/hours.ts`, `lib/hours.test.ts`

- [ ] **Step 1: Write the failing tests** — `lib/hours.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot,
  localStamp,
  MAX_SNAPSHOT_BYTES,
  selectTimestamps,
  sessionize,
  validateSnapshot,
} from "./hours";

const rules = { identities: ["hello@bohns.design"], exclude: [/\[bot\]/i, /^claude </i] };

test("localStamp keeps the author's wall clock and drops the offset", () => {
  assert.equal(localStamp("2026-08-07T07:53:16+02:00"), "2026-08-07T07:53:16");
  assert.equal(localStamp("2026-11-11T02:41:00-05:30"), "2026-11-11T02:41:00");
  assert.equal(localStamp("2026-01-02T03:04:05Z"), "2026-01-02T03:04:05");
  assert.equal(localStamp("garbage"), null);
});

test("selectTimestamps filters identity and excludes, dedups, sorts", () => {
  const lines = [
    "2026-08-07T09:00:00+02:00\tBohns\tHello@Bohns.design",
    "2026-08-07T08:00:00+02:00\tAlexis\thello@bohns.design",
    "2026-08-07T08:00:00+02:00\tAlexis\thello@bohns.design", // rebase copy
    "2026-08-07T08:30:00+02:00\tdependabot[bot]\thello@bohns.design",
    "2026-08-07T08:40:00+02:00\tClaude\tnoreply@anthropic.com",
    "2026-08-07T08:50:00+02:00\tLara\tlara@example.com",
    "",
    "not a log line",
  ];
  assert.deepEqual(selectTimestamps(lines, rules), ["2026-08-07T08:00:00", "2026-08-07T09:00:00"]);
});

test("sessionize: a single commit is one lead-length session", () => {
  assert.deepEqual(sessionize(["2026-08-07T08:00:00"], 120, 30), [
    { start: "2026-08-07T08:00:00", end: "2026-08-07T08:00:00", commits: 1, hours: 0.5 },
  ]);
});

test("sessionize: a gap of exactly gapMinutes stays in the session, one second more splits", () => {
  const same = sessionize(["2026-08-07T08:00:00", "2026-08-07T10:00:00"], 120, 30);
  assert.equal(same.length, 1);
  assert.equal(same[0].hours, 2.5);
  const split = sessionize(["2026-08-07T08:00:00", "2026-08-07T10:00:01"], 120, 30);
  assert.equal(split.length, 2);
});

test("sessionize sorts its input", () => {
  const s = sessionize(["2026-08-07T09:00:00", "2026-08-07T08:00:00"], 120, 30);
  assert.equal(s[0].start, "2026-08-07T08:00:00");
  assert.equal(s[0].commits, 2);
});

const config = {
  since: "2026-03-16",
  gapMinutes: 120,
  leadMinutes: 30,
  repos: [
    { repo: "a/one", name: "one", plant: "p" },
    { repo: "a/two", name: "two", plant: "p" },
    { repo: "a/three", name: "three" },
  ],
};

test("buildSnapshot: parallel work in two repos counts once globally and per plant", () => {
  const snap = buildSnapshot(
    config,
    {
      "a/one": ["2026-08-07T08:00:00", "2026-08-07T09:00:00"],
      "a/two": ["2026-08-07T08:30:00"],
      "a/three": ["2026-08-09T20:00:00"],
    },
    "2026-11-11T00:00:00.000Z",
  );
  assert.equal(snap.v, 1);
  assert.equal(snap.global.key, "global");
  assert.equal(snap.global.sessions.length, 2);
  assert.equal(snap.global.sessions[0].hours, 1.5); // 08:00→09:00 + lead, not 1.5 + 0.5
  assert.deepEqual(snap.plants.map((p) => [p.key, p.repos]), [["plant:p", ["a/one", "a/two"]]]);
  assert.equal(snap.plants[0].sessions.length, 1);
  assert.deepEqual(snap.repos.map((r) => r.key), ["repo:a/one", "repo:a/two", "repo:a/three"]);
  assert.equal(snap.repos[2].plant, undefined);
  assert.equal(snap.global.commits, 4);
});

test("validateSnapshot accepts what buildSnapshot makes", () => {
  const snap = buildSnapshot(config, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z");
  const r = validateSnapshot(JSON.parse(JSON.stringify(snap)));
  assert.equal(r.ok, true);
});

test("validateSnapshot refuses bad shapes", () => {
  const snap = buildSnapshot(config, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z");
  const bad = (mut: (s: any) => void) => {
    const s = JSON.parse(JSON.stringify(snap));
    mut(s);
    return validateSnapshot(s);
  };
  assert.equal(bad((s) => (s.v = 2)).ok, false);
  assert.equal(bad((s) => (s.global.sessions[0].hours = 0)).ok, false);
  assert.equal(bad((s) => (s.global.sessions[0].end = "2026-08-07T07:00:00")).ok, false);
  assert.equal(bad((s) => (s.global.sessions[0].start = "yesterday")).ok, false);
  assert.equal(bad((s) => (s.params.since = "nope")).ok, false);
  assert.equal(bad((s) => delete s.repos).ok, false);
  assert.equal(validateSnapshot(null).ok, false);
  assert.ok(MAX_SNAPSHOT_BYTES >= 512 * 1024);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: fail > 0, because `./hours` is missing.

- [ ] **Step 3: Write `lib/hours.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/hours.ts lib/hours.test.ts
git commit -m "Work hours: the session method, pure and pinned

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Aggregates — `lib/hours-aggregate.ts`

**Files:**
- Create: `lib/hours-aggregate.ts`, `lib/hours-aggregate.test.ts`

- [ ] **Step 1: Write the failing tests** — `lib/hours-aggregate.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, aggregateUnit, calendarWeeks, heatLevel, mondayOf, weekHours } from "./hours-aggregate";
import type { HoursSnapshot, HoursUnit } from "./hours";

const s = (start: string, end: string, hours: number, commits = 2) => ({ start, end, hours, commits });
const unit = (sessions: HoursUnit["sessions"]): HoursUnit => ({
  key: "global", name: "All", repos: [], commits: 0, sessions,
});

test("mondayOf and addDays handle year boundaries", () => {
  assert.equal(mondayOf("2026-11-11"), "2026-11-09");
  assert.equal(mondayOf("2026-11-09"), "2026-11-09");
  assert.equal(mondayOf("2026-11-15"), "2026-11-09"); // Sunday
  assert.equal(mondayOf("2027-01-01"), "2026-12-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("heatLevel steps at 1, 3, 6, 9 hours", () => {
  assert.deepEqual([0, 0.5, 1, 2.9, 3, 6, 8.9, 9, 20].map(heatLevel), [0, 1, 2, 2, 3, 4, 4, 5, 5]);
});

test("aggregateUnit: days include everything, totals start at since", () => {
  const a = aggregateUnit(
    unit([
      s("2026-03-01T10:00:00", "2026-03-01T11:00:00", 1.5), // before since
      s("2026-03-16T09:00:00", "2026-03-16T10:00:00", 1.5),
      s("2026-03-16T20:00:00", "2026-03-16T21:00:00", 1.5),
      s("2026-03-25T23:00:00", "2026-03-26T01:00:00", 2.5), // crosses midnight → 25th
      s("2026-04-01T08:00:00", "2026-04-01T08:00:00", 0.5),
    ]),
    "2026-03-16",
    "2026-04-12", // 4 weeks since 2026-03-16 (28 days)
  );
  assert.deepEqual(a.days["2026-03-01"], { hours: 1.5, sessions: 1 });
  assert.deepEqual(a.days["2026-03-16"], { hours: 3, sessions: 2 });
  assert.deepEqual(a.days["2026-03-25"], { hours: 2.5, sessions: 1 });
  assert.equal(a.totalSince, 6);
  assert.equal(a.sessionsSince, 4);
  assert.deepEqual(a.weeks, { "2026-03-16": 3, "2026-03-23": 2.5, "2026-03-30": 0.5 });
  assert.deepEqual(a.months, { "2026-03": 5.5, "2026-04": 0.5 });
  assert.equal(a.activeWeeks, 3);
  assert.equal(a.avgWeek, 1.5); // 6 / 4 weeks
  assert.equal(a.avgActiveWeek, 2);
  assert.equal(a.peakWeek?.week, "2026-03-16");
  assert.equal(a.medianSession, 1.5);
  assert.equal(a.longestSession, 2.5);
  assert.equal(a.byWeekday[0], 3); // the only Monday in the window is 2026-03-16
  assert.equal(a.byHour[23], 2.5);
  assert.equal(a.longestStreak, 1);
});

test("aggregateUnit: streak counts consecutive active days", () => {
  const a = aggregateUnit(
    unit([
      s("2026-05-01T10:00:00", "2026-05-01T10:00:00", 0.5),
      s("2026-05-02T10:00:00", "2026-05-02T10:00:00", 0.5),
      s("2026-05-03T10:00:00", "2026-05-03T10:00:00", 0.5),
      s("2026-05-05T10:00:00", "2026-05-05T10:00:00", 0.5),
    ]),
    "2026-03-16",
    "2026-05-10",
  );
  assert.equal(a.longestStreak, 3);
});

test("aggregateUnit on an empty unit is all zeros, no NaN", () => {
  const a = aggregateUnit(unit([]), "2026-03-16", "2026-04-12");
  assert.equal(a.totalSince, 0);
  assert.equal(a.avgActiveWeek, 0);
  assert.equal(a.medianSession, 0);
  assert.equal(a.peakWeek, null);
});

test("calendarWeeks: 53 Monday-first columns ending on today's week, future days null", () => {
  const cols = calendarWeeks("2026-11-11");
  assert.equal(cols.length, 53);
  assert.equal(cols[52][0], "2026-11-09");
  assert.equal(cols[52][2], "2026-11-11");
  assert.equal(cols[52][3], null);
  assert.equal(cols[0][0], "2025-11-10");
});

test("weekHours tallies a week by plant and repo", () => {
  const snap = {
    v: 1, generatedAt: "2026-11-11T00:00:00Z",
    params: { since: "2026-03-16", gapMinutes: 120, leadMinutes: 30 },
    global: { ...unit([s("2026-11-03T10:00:00", "2026-11-03T12:00:00", 2.5), s("2026-11-12T10:00:00", "2026-11-12T10:00:00", 0.5)]) },
    plants: [{ key: "plant:pbbls", name: "pbbls", plant: "pbbls", repos: ["a/pbbls"], commits: 1, sessions: [s("2026-11-03T10:00:00", "2026-11-03T12:00:00", 2.5)] }],
    repos: [{ key: "repo:a/pbbls", name: "pbbls", plant: "pbbls", repos: ["a/pbbls"], commits: 1, sessions: [s("2026-11-03T10:00:00", "2026-11-03T12:00:00", 2.5)] }],
  } satisfies HoursSnapshot;
  assert.deepEqual(weekHours(snap, "2026-11-02", "2026-11-08"), {
    total: 2.5,
    sessions: 1,
    byPlant: [{ plant: "pbbls", hours: 2.5 }],
    byRepo: [{ repo: "pbbls", hours: 2.5 }],
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: fail > 0.

- [ ] **Step 3: Write `lib/hours-aggregate.ts`**

```ts
import type { HoursSession, HoursSnapshot, HoursUnit } from "./hours";

// Aggregates over a snapshot unit (spec §6), pure and clock-free: `today` is a
// parameter. Days are LOCAL dates of a session's first commit. Calendars use
// every session; totals, averages and rhythm start at `since`.

export interface DayCell {
  hours: number;
  sessions: number;
}

export interface UnitAggregate {
  days: Record<string, DayCell>;
  weeks: Record<string, number>; // Monday → hours, since `since`
  months: Record<string, number>; // YYYY-MM → hours, since `since`
  totalSince: number;
  sessionsSince: number;
  weeksElapsed: number;
  monthsElapsed: number;
  avgWeek: number;
  activeWeeks: number;
  avgActiveWeek: number;
  avgMonth: number;
  peakWeek: { week: string; hours: number } | null;
  medianSession: number;
  longestSession: number;
  byWeekday: number[]; // Mon..Sun hours
  byHour: number[]; // 0..23 hours by session start
  longestStreak: number; // consecutive active days, all time
}

const DAY_MS = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function addDays(day: string, n: number): string {
  return toDay(toMs(day) + n * DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(day: string): number {
  return (new Date(toMs(day)).getUTCDay() + 6) % 7;
}

export function mondayOf(day: string): string {
  return addDays(day, -weekdayOf(day));
}

export function heatLevel(hours: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!(hours > 0)) return 0;
  if (hours < 1) return 1;
  if (hours < 3) return 2;
  if (hours < 6) return 3;
  if (hours < 9) return 4;
  return 5;
}

/** Today's date in Europe/Paris, YYYY-MM-DD. The only clock read in this module. */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** 53 week columns (Mon..Sun), the last containing `today`; days after today are null. */
export function calendarWeeks(today: string): (string | null)[][] {
  const lastMonday = mondayOf(today);
  const first = addDays(lastMonday, -52 * 7);
  const cols: (string | null)[][] = [];
  for (let w = 0; w < 53; w++) {
    const col: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(first, w * 7 + d);
      col.push(day <= today ? day : null);
    }
    cols.push(col);
  }
  return cols;
}

const dayOf = (s: HoursSession) => s.start.slice(0, 10);

export function aggregateUnit(unit: HoursUnit, since: string, today: string): UnitAggregate {
  const days: Record<string, DayCell> = {};
  const weeks: Record<string, number> = {};
  const months: Record<string, number> = {};
  const byWeekday = Array<number>(7).fill(0);
  const byHour = Array<number>(24).fill(0);
  const lengths: number[] = [];
  let totalSince = 0;

  for (const s of unit.sessions) {
    const day = dayOf(s);
    const cell = (days[day] ??= { hours: 0, sessions: 0 });
    cell.hours = r2(cell.hours + s.hours);
    cell.sessions += 1;
    if (day < since || day > today) continue;
    totalSince += s.hours;
    lengths.push(s.hours);
    const wk = mondayOf(day);
    weeks[wk] = r2((weeks[wk] ?? 0) + s.hours);
    const mo = day.slice(0, 7);
    months[mo] = r2((months[mo] ?? 0) + s.hours);
    byWeekday[weekdayOf(day)] += s.hours;
    byHour[Number(s.start.slice(11, 13))] += s.hours;
  }

  const spanDays = Math.max(1, (toMs(today) - toMs(since)) / DAY_MS + 1);
  const weeksElapsed = spanDays / 7;
  const monthsElapsed = spanDays / 30.44;
  const activeWeeks = Object.keys(weeks).length;
  const peak = Object.entries(weeks).sort((a, b) => b[1] - a[1])[0];
  const sorted = [...lengths].sort((a, b) => a - b);

  const activeDays = Object.keys(days).sort();
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < activeDays.length; i++) {
    run = i > 0 && addDays(activeDays[i - 1], 1) === activeDays[i] ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  return {
    days,
    weeks,
    months,
    totalSince: r2(totalSince),
    sessionsSince: lengths.length,
    weeksElapsed: r2(weeksElapsed),
    monthsElapsed: r2(monthsElapsed),
    avgWeek: r2(totalSince / weeksElapsed),
    activeWeeks,
    avgActiveWeek: activeWeeks ? r2(totalSince / activeWeeks) : 0,
    avgMonth: r2(totalSince / monthsElapsed),
    peakWeek: peak ? { week: peak[0], hours: peak[1] } : null,
    medianSession: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
    longestSession: sorted.length ? sorted[sorted.length - 1] : 0,
    byWeekday: byWeekday.map(r2),
    byHour: byHour.map(r2),
    longestStreak,
  };
}

export interface WeekTally {
  total: number;
  sessions: number;
  byPlant: { plant: string; hours: number }[];
  byRepo: { repo: string; hours: number }[];
}

const inWeek = (s: HoursSession, start: string, end: string) => {
  const d = dayOf(s);
  return d >= start && d <= end;
};
const sumIn = (u: HoursUnit, start: string, end: string) =>
  r2(u.sessions.filter((s) => inWeek(s, start, end)).reduce((a, s) => a + s.hours, 0));

/** The digest's hours tally for one ISO week [start, end] (spec §7). */
export function weekHours(snap: HoursSnapshot, start: string, end: string): WeekTally {
  const desc = <T extends { hours: number }>(xs: T[]) => xs.filter((x) => x.hours > 0).sort((a, b) => b.hours - a.hours);
  return {
    total: sumIn(snap.global, start, end),
    sessions: snap.global.sessions.filter((s) => inWeek(s, start, end)).length,
    byPlant: desc(snap.plants.map((u) => ({ plant: u.plant ?? u.name, hours: sumIn(u, start, end) }))),
    byRepo: desc(snap.repos.map((u) => ({ repo: u.name, hours: sumIn(u, start, end) }))),
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`. If a number is off, fix the test's arithmetic only when the spec §2/§6 definition supports the code's value.

- [ ] **Step 5: Commit**

```bash
git add lib/hours-aggregate.ts lib/hours-aggregate.test.ts
git commit -m "Work hours: weekly, monthly and rhythm aggregates over a snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Engine script — `scripts/hours-sync.ts`

> **Superseded by the committed `scripts/hours-sync.ts`.** The code below passes the token in git's argv, and it lacks the `--local` guard and the stderr redaction. Do not copy it; read the real script instead.

**Files:**
- Create: `scripts/hours-sync.ts`
- Modify: `package.json`, adding one script

- [ ] **Step 1: Add the npm script.** In `package.json` `scripts`, after `"pollen:rebuild"`, add:

```json
    "hours:sync": "node --import tsx scripts/hours-sync.ts",
```

- [ ] **Step 2: Write `scripts/hours-sync.ts`**

```ts
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
```

- [ ] **Step 3: Run the acceptance check against local clones**

Run: `npm run hours:sync -- --dry-run --local ~/code 2>&1 | grep -E "^global|snapshot"`
Expected: `global … since 2026-03-16: ~917 h, ~343 sessions`. It must be within ±5%: 871–963 h, per spec §2. The snapshot is under 512 KiB.
Local clones are used here because CI tokens aren't available on this machine. `skillteplait` and `Oxymore` resolve to `~/code/skillteplait` and `~/code/Oxymore`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "hours" | head`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add scripts/hours-sync.ts package.json
git commit -m "Work hours: the sync engine that clones, counts and posts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Store, cache, and the `/api/hours` door

**Files:**
- Create: `lib/hours-store.ts`, `lib/hours-cache.ts`, `app/api/hours/route.ts`, `lib/hours-route.test.ts`, `lib/hours-store.test.ts`
- Modify: `package.json` `test:db`, adding `lib/hours-store.test.ts` to its file list

- [ ] **Step 1: Write the failing route tests (no DB)** — `lib/hours-route.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/hours/route";
import { MAX_SNAPSHOT_BYTES } from "./hours";

function req(body: string, auth?: string, extra: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/hours", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}), ...extra },
    body,
  });
}

test("hours door: HOURS_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.HOURS_TOKEN;
  assert.equal((await POST(req("{}", "Bearer anything"))).status, 401);
});

test("hours door: wrong or missing token is 401", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    assert.equal((await POST(req("{}"))).status, 401);
    assert.equal((await POST(req("{}", "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});

test("hours door: oversized body is 413 (declared and measured)", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    const big = "x".repeat(MAX_SNAPSHOT_BYTES + 1);
    assert.equal((await POST(req(big, "Bearer tok_hours_test"))).status, 413);
    const lying = req("{}", "Bearer tok_hours_test", { "content-length": String(MAX_SNAPSHOT_BYTES + 1) });
    assert.equal((await POST(lying)).status, 413);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});

test("hours door: invalid JSON and invalid snapshot are 400 before any DB touch", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    assert.equal((await POST(req("{nope", "Bearer tok_hours_test"))).status, 400);
    const res = await POST(req(JSON.stringify({ v: 2 }), "Bearer tok_hours_test"));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /v must be 1/);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});
```

- [ ] **Step 2: Write the failing DB test** — `lib/hours-store.test.ts`

```ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { closeDb, getDb } from "./db";
import { loadHoursSnapshot, saveHoursSnapshot } from "./hours-store";
import { buildSnapshot } from "./hours";
import { POST } from "../app/api/hours/route";

const cfg = { since: "2026-03-16", gapMinutes: 120, leadMinutes: 30, repos: [{ repo: "a/one", name: "one" }] };
const full = buildSnapshot(cfg, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z");
const empty = buildSnapshot(cfg, {}, "2026-11-11T01:00:00.000Z");

after(async () => {
  await (await getDb()).collection("hours").deleteMany({});
  await closeDb();
});

test("save then load round-trips the snapshot, replacing the previous one", async () => {
  await saveHoursSnapshot(empty);
  await saveHoursSnapshot(full);
  const got = await loadHoursSnapshot();
  assert.deepEqual(got, full);
  assert.equal(await (await getDb()).collection("hours").countDocuments(), 1);
});

test("door refuses a snapshot that would wipe stored sessions, unless forced", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    await saveHoursSnapshot(full);
    const post = (q = "") =>
      POST(new Request(`http://localhost/api/hours${q}`, {
        method: "POST",
        headers: { authorization: "Bearer tok_hours_test", "content-type": "application/json" },
        body: JSON.stringify(empty),
      }));
    assert.equal((await post()).status, 409);
    assert.deepEqual(await loadHoursSnapshot(), full);
    assert.equal((await post("?force=1")).status, 200);
    assert.equal((await loadHoursSnapshot())?.global.sessions.length, 0);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});
```

Add `lib/hours-store.test.ts` to the end of the `test:db` file list in `package.json`.

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: fail > 0, because the route module is missing.

- [ ] **Step 4: Write `lib/hours-store.ts`**

```ts
import { getDb } from "./db";
import type { HoursSnapshot } from "./hours";

// One document, replaced whole on every ingest (spec §6): a rebuildable read
// model — the next hours-sync recreates it from git. Public pages must not
// import this module; they read lib/hours-cache.ts.

const ID = "current";

interface HoursDoc extends HoursSnapshot {
  _id: string;
  receivedAt: string;
}

export async function loadHoursSnapshot(): Promise<HoursSnapshot | null> {
  const doc = await (await getDb()).collection<HoursDoc>("hours").findOne({ _id: ID });
  if (!doc) return null;
  const { _id, receivedAt, ...snapshot } = doc;
  void _id;
  void receivedAt;
  return snapshot;
}

export async function saveHoursSnapshot(snapshot: HoursSnapshot): Promise<void> {
  await (await getDb())
    .collection<HoursDoc>("hours")
    .replaceOne({ _id: ID }, { _id: ID, ...snapshot, receivedAt: new Date().toISOString() }, { upsert: true });
}
```

- [ ] **Step 5: Write `lib/hours-cache.ts`**

```ts
import { revalidateTag, unstable_cache } from "next/cache";
import { isMissingRequestStore } from "./garden-cache";
import { loadHoursSnapshot } from "./hours-store";

// The public zone's read of the hours snapshot, mirroring lib/garden-cache.ts:
// a tagged Data Cache entry, revalidated by the ingest door. The snapshot is
// plain JSON (strings and numbers), so a cache HIT equals a MISS.
export const HOURS_TAG = "hours";

export const getCachedHours = unstable_cache(loadHoursSnapshot, ["hours"], {
  tags: [HOURS_TAG],
  revalidate: 300,
});

/** Called by POST /api/hours after a write. Same narrow catch as revalidateGarden. */
export function revalidateHours(): void {
  try {
    revalidateTag(HOURS_TAG);
  } catch (err) {
    if (!isMissingRequestStore(err)) throw err;
  }
}
```

- [ ] **Step 6: Write `app/api/hours/route.ts`**

```ts
import { hasValidToken, singleToken } from "../../../lib/auth";
import { MAX_SNAPSHOT_BYTES, validateSnapshot } from "../../../lib/hours";
import { aggregateUnit, parisToday } from "../../../lib/hours-aggregate";
import { loadHoursSnapshot, saveHoursSnapshot } from "../../../lib/hours-store";
import { revalidateHours } from "../../../lib/hours-cache";

export const dynamic = "force-dynamic";

// GET: public by decision (spec §1) — the snapshot plus derived aggregates.
export async function GET(): Promise<Response> {
  const snapshot = await loadHoursSnapshot();
  if (!snapshot) return Response.json({ snapshot: null }, { status: 404 });
  const today = parisToday();
  const agg = (u: typeof snapshot.global) => ({ key: u.key, ...aggregateUnit(u, snapshot.params.since, today) });
  return Response.json({
    snapshot,
    today,
    aggregates: [snapshot.global, ...snapshot.plants, ...snapshot.repos].map(agg),
  });
}

// POST: the guarded ingest door the hours-sync Action calls (spec §4, §8).
export async function POST(request: Request): Promise<Response> {
  const tokens = singleToken(process.env.HOURS_TOKEN);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const tooLarge = () =>
    Response.json({ error: `body too large (max ${MAX_SNAPSHOT_BYTES} bytes)` }, { status: 413 });
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_SNAPSHOT_BYTES) return tooLarge();
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = validateSnapshot(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  // The wipe guard (spec §8): an identity misconfiguration must not blank the page.
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && parsed.snapshot.global.sessions.length === 0) {
    const stored = await loadHoursSnapshot();
    if (stored && stored.global.sessions.length > 0) {
      return Response.json(
        { error: "refused: snapshot has no sessions but the stored one does (pass ?force=1)" },
        { status: 409 },
      );
    }
  }
  await saveHoursSnapshot(parsed.snapshot);
  revalidateHours();
  return Response.json({
    ok: true,
    sessions: parsed.snapshot.global.sessions.length,
    generatedAt: parsed.snapshot.generatedAt,
  });
}
```

- [ ] **Step 7: Run both suites**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` and expect `# fail 0`.
Then run: `npm run test:db 2>&1 | grep -E "^# (pass|fail)"` and expect `# fail 0`. This needs `MONGODB_URI` in `.env.local`, and it uses `beanstalk_scratch`.

- [ ] **Step 8: Commit**

```bash
git add lib/hours-store.ts lib/hours-cache.ts app/api/hours/route.ts lib/hours-route.test.ts lib/hours-store.test.ts package.json
git commit -m "Work hours: store the snapshot behind a guarded ingest door

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Server-safe components — calendar, weekly bars, tables

**Files:**
- Create: `components/heat-calendar.tsx`, `components/hours-weekly-bars.tsx`, `components/hours-tables.tsx`, `components/heat-calendar.test.tsx`
- Modify: `lib/server-safe-source.test.ts`, adding the three files to `SERVER_SAFE`

- [ ] **Step 1: Write the failing render test** — `components/heat-calendar.test.tsx`

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { HeatCalendar } from "@/components/heat-calendar";
import { HoursWeeklyBars } from "@/components/hours-weekly-bars";

test("HeatCalendar draws one cell per elapsed day of 53 weeks, with a tooltip each", () => {
  const html = renderToStaticMarkup(
    <HeatCalendar label="All projects" today="2026-11-11" days={{ "2026-11-10": { hours: 4.2, sessions: 2 } }} />,
  );
  // 52 full weeks + Mon..Wed of the current one
  assert.equal((html.match(/<rect/g) ?? []).length, 52 * 7 + 3);
  assert.match(html, /<title>Tue 10 Nov 2026 · 4\.2 h · 2 sessions<\/title>/);
  assert.match(html, /<title>Mon 9 Nov 2026 · no commits<\/title>/);
  assert.match(html, /aria-label="All projects/);
  assert.match(html, /data-level="3"/);
});

test("HeatCalendar small size draws no weekday labels", () => {
  const html = renderToStaticMarkup(<HeatCalendar label="x" today="2026-11-11" days={{}} size="sm" />);
  assert.doesNotMatch(html, />Mon</);
});

test("HoursWeeklyBars draws a bar per non-empty week and an average line", () => {
  const html = renderToStaticMarkup(
    <HoursWeeklyBars since="2026-03-16" today="2026-04-12" weeks={{ "2026-03-16": 30, "2026-03-30": 10 }} avg={10} />,
  );
  assert.equal((html.match(/data-week=/g) ?? []).length, 2);
  assert.match(html, /avg 10 h/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: fail > 0.

- [ ] **Step 3: Write `components/heat-calendar.tsx`**

```tsx
import { calendarWeeks, heatLevel, type DayCell } from "@/lib/hours-aggregate";

// A GitHub-style heat calendar (spec §6), SERVER-SAFE: plain SVG, a native
// <title> per cell for the hover, no client JS. Listed in
// lib/server-safe-source.test.ts. Colour is the theme's --primary at five
// opacities, level 0 is --muted, so both themes are right by construction.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVEL_CLASS = [
  "fill-muted",
  "fill-primary/20",
  "fill-primary/40",
  "fill-primary/60",
  "fill-primary/80",
  "fill-primary",
] as const;

export const HEAT_LEGEND = ["0", "<1 h", "1–3 h", "3–6 h", "6–9 h", "9 h+"];

function describe(day: string, cell?: DayCell): string {
  const d = new Date(`${day}T12:00:00Z`);
  const label = `${WEEKDAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!cell || !cell.sessions) return `${label} · no commits`;
  return `${label} · ${cell.hours.toFixed(1)} h · ${cell.sessions} session${cell.sessions > 1 ? "s" : ""}`;
}

export function HeatCalendar({
  days,
  today,
  label,
  size = "lg",
}: {
  days: Record<string, DayCell>;
  today: string;
  label: string;
  size?: "lg" | "sm";
}) {
  const cell = size === "lg" ? 12 : 8;
  const gap = size === "lg" ? 3 : 2;
  const step = cell + gap;
  const left = size === "lg" ? 28 : 0;
  const top = 14;
  const cols = calendarWeeks(today);
  const width = left + cols.length * step;
  const height = top + 7 * step;
  let lastMonth = -1;

  return (
    <svg
      role="img"
      aria-label={`${label}: work hours per day over the past year`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="block max-w-none"
    >
      {size === "lg"
        ? ["Mon", "Wed", "Fri"].map((d, i) => (
            <text key={d} x={0} y={top + i * 2 * step + cell - 2} className="fill-muted-foreground text-[9px]">
              {d}
            </text>
          ))
        : null}
      {cols.map((col, w) => {
        const first = col[0];
        let monthLabel = null;
        if (first) {
          const m = Number(first.slice(5, 7)) - 1;
          if (m !== lastMonth && Number(first.slice(8, 10)) <= 7) {
            lastMonth = m;
            monthLabel = (
              <text x={left + w * step} y={9} className="fill-muted-foreground text-[9px]">
                {MONTHS[m]}
              </text>
            );
          }
        }
        return (
          <g key={w}>
            {monthLabel}
            {col.map((day, r) =>
              day ? (
                <rect
                  key={day}
                  x={left + w * step}
                  y={top + r * step}
                  width={cell}
                  height={cell}
                  rx={2}
                  data-level={heatLevel(days[day]?.hours ?? 0)}
                  className={LEVEL_CLASS[heatLevel(days[day]?.hours ?? 0)]}
                >
                  <title>{describe(day, days[day])}</title>
                </rect>
              ) : null,
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Less</span>
      {LEVEL_CLASS.map((c, i) => (
        <svg key={c} width={11} height={11} aria-hidden="true">
          <rect width={11} height={11} rx={2} className={c} />
        </svg>
      ))}
      <span>More</span>
      <span className="ml-2">{HEAT_LEGEND.join(" · ")} per day</span>
    </div>
  );
}
```

- [ ] **Step 4: Write `components/hours-weekly-bars.tsx`**

```tsx
import { addDays, mondayOf } from "@/lib/hours-aggregate";

// Weekly hours since `since`, one bar per Monday, a dashed average line.
// SERVER-SAFE (lib/server-safe-source.test.ts): SVG with <title> tooltips.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function HoursWeeklyBars({
  weeks,
  since,
  today,
  avg,
}: {
  weeks: Record<string, number>;
  since: string;
  today: string;
  avg: number;
}) {
  const mondays: string[] = [];
  for (let d = mondayOf(since); d <= today; d = addDays(d, 7)) mondays.push(d);
  const max = Math.max(20, Math.ceil(Math.max(avg, ...Object.values(weeks)) / 20) * 20);
  const L = 34, B = 20, T = 8, bw = 12, gap = 4, H = 200;
  const W = L + mondays.length * (bw + gap) + 56;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = Array.from({ length: max / 20 + 1 }, (_, i) => i * 20);
  let lastMonth = -1;

  return (
    <svg role="img" aria-label="Hours per week" viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-none">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - 50} y1={y(v)} y2={y(v)} className="stroke-border" />
          <text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
            {v}h
          </text>
        </g>
      ))}
      {mondays.map((m, i) => {
        const v = weeks[m] ?? 0;
        const x = L + i * (bw + gap);
        const month = Number(addDays(m, 6).slice(5, 7)) - 1;
        const label =
          month !== lastMonth ? (
            <text x={x} y={H - 5} className="fill-muted-foreground text-[9px]">
              {MONTHS[(lastMonth = month)]}
            </text>
          ) : null;
        return (
          <g key={m}>
            {v > 0 ? (
              <rect data-week={m} x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx={3} className="fill-primary">
                <title>{`Week of ${m} · ${v.toFixed(1)} h`}</title>
              </rect>
            ) : null}
            {label}
          </g>
        );
      })}
      <line x1={L} x2={W - 50} y1={y(avg)} y2={y(avg)} strokeDasharray="4 3" className="stroke-foreground" />
      <text x={W - 46} y={y(avg) + 3} className="fill-foreground text-[9px]">
        {`avg ${avg} h`}
      </text>
    </svg>
  );
}
```

- [ ] **Step 5: Write `components/hours-tables.tsx`**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UnitAggregate } from "@/lib/hours-aggregate";

// Per-week and per-month tables (spec §6). SERVER-SAFE.

export interface HoursRow {
  name: string;
  href?: string;
  agg: UnitAggregate;
}

const fmt = (h: number) => (h >= 10 ? Math.round(h).toLocaleString("en") : h.toFixed(1));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Name({ row }: { row: HoursRow }) {
  return row.href ? (
    <a href={row.href} className="underline-offset-4 hover:underline">
      {row.name}
    </a>
  ) : (
    <>{row.name}</>
  );
}

export function WeekTable({ rows, total }: { rows: HoursRow[]; total: HoursRow }) {
  const line = (r: HoursRow, isTotal = false) => (
    <TableRow key={r.name} className={isTotal ? "font-semibold" : undefined}>
      <TableCell>{isTotal ? r.name : <Name row={r} />}</TableCell>
      <TableCell className="text-right tabular-nums">{fmt(r.agg.totalSince)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {total.agg.totalSince ? `${Math.round((r.agg.totalSince / total.agg.totalSince) * 100)}%` : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{r.agg.avgWeek.toFixed(1)}</TableCell>
      <TableCell className="text-right tabular-nums">{r.agg.activeWeeks}</TableCell>
      <TableCell className="text-right tabular-nums">{r.agg.avgActiveWeek.toFixed(1)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {r.agg.peakWeek ? `${fmt(r.agg.peakWeek.hours)} (${r.agg.peakWeek.week})` : "—"}
      </TableCell>
    </TableRow>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Hours</TableHead>
          <TableHead className="text-right">Share</TableHead>
          <TableHead className="text-right">Avg / week</TableHead>
          <TableHead className="text-right">Active weeks</TableHead>
          <TableHead className="text-right">Avg / active week</TableHead>
          <TableHead className="text-right">Peak week</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => line(r))}
        {line(total, true)}
      </TableBody>
    </Table>
  );
}

export function MonthTable({ rows, total, months }: { rows: HoursRow[]; total: HoursRow; months: string[] }) {
  const line = (r: HoursRow, isTotal = false) => (
    <TableRow key={r.name} className={isTotal ? "font-semibold" : undefined}>
      <TableCell>{isTotal ? r.name : <Name row={r} />}</TableCell>
      {months.map((m) => {
        const h = r.agg.months[m] ?? 0;
        return (
          <TableCell key={m} className={`text-right tabular-nums ${h ? "" : "text-muted-foreground"}`}>
            {h ? fmt(h) : "·"}
          </TableCell>
        );
      })}
      <TableCell className="text-right tabular-nums">{fmt(r.agg.totalSince)}</TableCell>
      <TableCell className="text-right tabular-nums">{r.agg.avgMonth.toFixed(1)}</TableCell>
    </TableRow>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          {months.map((m, i) => (
            <TableHead key={m} className="text-right">
              {MONTHS[Number(m.slice(5, 7)) - 1]}
              {i === 0 || i === months.length - 1 ? "*" : ""}
            </TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Avg / month</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => line(r))}
        {line(total, true)}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: Register the three files in `lib/server-safe-source.test.ts`.** Add these lines to `SERVER_SAFE`, just before the `"components/ui/table.tsx"` group:

```ts
  // The work-hours surfaces (spec 2026-11-11-work-hours §6): /hours and the
  // plant page's Work block render them. SVG + <title>, no island.
  "components/heat-calendar.tsx",
  "components/hours-weekly-bars.tsx",
  "components/hours-tables.tsx",
  "lib/hours-aggregate.ts",
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`

- [ ] **Step 8: Commit**

```bash
git add components/heat-calendar.tsx components/hours-weekly-bars.tsx components/hours-tables.tsx components/heat-calendar.test.tsx lib/server-safe-source.test.ts
git commit -m "Work hours: heat calendar, weekly bars and tables, all server-rendered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The public `/hours` page and its nav link

**Files:**
- Create: `app/(public)/(chrome)/hours/page.tsx`
- Modify: `components/public-icons.tsx` (add `CalendarIcon`), `app/(public)/_components/public-chrome.tsx` (add the link), `lib/server-safe-source.test.ts` (add the page)

- [ ] **Step 1: Add `CalendarIcon`.** Copy `__iconNode` from `node_modules/lucide-react/dist/esm/icons/calendar-days.mjs`, as the file's docblock instructs, and add it after `WaypointsIcon` in the same shape as its siblings. Read `SproutIcon` in `components/public-icons.tsx` lines 66–76 and follow it exactly: same props spread, `aria-hidden`, and the stroke attributes. Update the docblock count from "nine glyphs" to "ten glyphs" and "RE-COPY ALL NINE" to "RE-COPY ALL TEN".

- [ ] **Step 2: Add the nav link** in `app/(public)/_components/public-chrome.tsx`, after the Beanstalk `ChromeLink`:

```tsx
        <ChromeLink href="/hours" label="Hours">
          <CalendarIcon className="size-4" />
        </ChromeLink>
```

Then update the import:

```tsx
import { CalendarIcon, SproutIcon, WaypointsIcon } from "@/components/public-icons";
```

- [ ] **Step 3: Write `app/(public)/(chrome)/hours/page.tsx`**

```tsx
import { getCachedHours } from "@/lib/hours-cache";
import { getPublicDataset } from "@/lib/garden-cache";
import { aggregateUnit, parisToday, type UnitAggregate } from "@/lib/hours-aggregate";
import type { HoursUnit } from "@/lib/hours";
import { HeatCalendar, HeatLegend } from "@/components/heat-calendar";
import { HoursWeeklyBars } from "@/components/hours-weekly-bars";
import { MonthTable, WeekTable, type HoursRow } from "@/components/hours-tables";
import { resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { seq } from "@/components/reveal";

export const dynamic = "force-dynamic";

// /hours (spec §6): work time estimated from commit timestamps. Server-only,
// complete with script off. Reads the cached snapshot, never lib/hours-store.

const fmt = (h: number) => (h >= 10 ? Math.round(h).toLocaleString("en") : h.toFixed(1));
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ago(iso: string, now = Date.now()): { text: string; stale: boolean } {
  const h = (now - Date.parse(iso)) / 3_600_000;
  const text = h < 1 ? "less than an hour ago" : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
  return { text, stale: h > 24 };
}

function Bars({ values, labels, every }: { values: number[]; labels: string[]; every: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-28 items-end gap-1" role="img" aria-label={labels.map((l, i) => `${l} ${fmt(values[i])} h`).join(", ")}>
      {values.map((v, i) => (
        <div key={labels[i]} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-sm bg-primary" style={{ height: `${(v / max) * 96}px` }} title={`${labels[i]} · ${fmt(v)} h`} />
          <span className="text-[9px] text-muted-foreground">{i % every === 0 ? labels[i] : " "}</span>
        </div>
      ))}
    </div>
  );
}

export default async function HoursPage() {
  const [snapshot, data, lang] = await Promise.all([getCachedHours(), getPublicDataset(), currentLang()]);

  if (!snapshot) {
    return (
      <article className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Hours</h1>
        <p className="text-muted-foreground">
          No hours synced yet. Once the hourly sync runs, this page shows work time estimated from commit timestamps.
        </p>
      </article>
    );
  }

  const today = parisToday();
  const since = snapshot.params.since;
  const agg = (u: HoursUnit): UnitAggregate => aggregateUnit(u, since, today);
  const g = agg(snapshot.global);
  const publicPlant = (slug?: string) => (slug ? data.getPlant(slug) : undefined);
  const plantName = (u: HoursUnit) => {
    const p = publicPlant(u.plant);
    return p ? resolveText(p.name, lang) : u.name;
  };
  const row = (u: HoursUnit, name: string): HoursRow => ({
    name,
    href: publicPlant(u.plant) ? `/plant/${u.plant}` : undefined,
    agg: agg(u),
  });
  const repoRows = snapshot.repos.map((u) => row(u, u.name)).filter((r) => r.agg.totalSince > 0)
    .sort((a, b) => b.agg.totalSince - a.agg.totalSince);
  const total: HoursRow = { name: "All projects", agg: g };
  const months: string[] = [];
  for (let m = since.slice(0, 7); m <= today.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const units = [...snapshot.plants.map((u) => ({ u, name: plantName(u) })), ...snapshot.repos.filter((u) => !u.plant).map((u) => ({ u, name: u.name }))]
    .map(({ u, name }) => ({ u, name, a: agg(u) }))
    .sort((x, y) => y.u.sessions.reduce((s, z) => s + z.hours, 0) - x.u.sessions.reduce((s, z) => s + z.hours, 0));
  const sumRepos = snapshot.repos.reduce((s, u) => s + agg(u).totalSince, 0);
  const updated = ago(snapshot.generatedAt);

  const section = "flex flex-col gap-3";
  const h2 = "font-heading text-xs uppercase tracking-widest text-muted-foreground";

  return (
    <article className="flex flex-col gap-10">
      <header {...seq(0, "flex flex-col gap-2")}>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Hours</h1>
        <p className="text-muted-foreground">
          Work time estimated from the timestamps of my own commits. Commits less than {snapshot.params.gapMinutes / 60} hours
          apart count as one session, plus {snapshot.params.leadMinutes} minutes for the work before the first commit.
        </p>
        <p className="text-xs text-muted-foreground">
          Updated {updated.text}
          {updated.stale ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5">stale</span> : null}
        </p>
      </header>

      <dl {...seq(1, "grid grid-cols-2 gap-4 sm:grid-cols-5")}>
        {[
          [`${fmt(g.totalSince)} h`, `since ${since}`],
          [`${g.avgWeek.toFixed(1)} h`, "per week"],
          [`${g.avgActiveWeek.toFixed(1)} h`, `per active week (${g.activeWeeks})`],
          [String(g.sessionsSince), "sessions"],
          [`${g.medianSession.toFixed(1)} h`, "median session"],
        ].map(([v, l]) => (
          <div key={l} className="flex flex-col">
            <dt className="order-2 text-xs text-muted-foreground">{l}</dt>
            <dd className="font-heading text-xl tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section className={section}>
        <h2 className={h2}>Past 12 months</h2>
        <div className="overflow-x-auto">
          <HeatCalendar days={g.days} today={today} label="All projects" />
        </div>
        <HeatLegend />
      </section>

      <section className={section}>
        <h2 className={h2}>Hours per week since {since}</h2>
        <div className="overflow-x-auto">
          <HoursWeeklyBars weeks={g.weeks} since={since} today={today} avg={g.avgWeek} />
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>Per week, by project</h2>
        <p className="text-sm text-muted-foreground">
          Per-project hours add up to {fmt(sumRepos)} h, more than the {fmt(g.totalSince)} h total, because a sitting that
          touches two repos counts in each of them.
        </p>
        <div className="overflow-x-auto">
          <WeekTable rows={repoRows} total={total} />
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>Per month, by project</h2>
        <p className="text-sm text-muted-foreground">* The first and current months are partial.</p>
        <div className="overflow-x-auto">
          <MonthTable rows={repoRows} total={total} months={months} />
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>By project</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {units.map(({ u, name, a }) => (
            <div key={u.key} className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-sm">
                  {publicPlant(u.plant) ? <a href={`/plant/${u.plant}`} className="underline-offset-4 hover:underline">{name}</a> : name}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmt(a.totalSince)} h · {a.sessionsSince} sessions{u.repos.length > 1 ? ` · ${u.repos.length} repos` : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <HeatCalendar days={a.days} today={today} label={name} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>When sessions start</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Bars values={g.byHour} labels={g.byHour.map((_, h) => `${String(h).padStart(2, "0")}h`)} every={3} />
          <Bars values={g.byWeekday} labels={DAY_NAMES} every={1} />
        </div>
      </section>

      <section className={`${section} text-sm text-muted-foreground`}>
        <h2 className={h2}>How this is measured</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Every branch of each GitHub repo, my own commits only. Bots and commits authored by Claude are left out.</li>
          <li>Each commit's author time, in the timezone where it was made. A session belongs to the day it started.</li>
          <li>Time spent designing, in meetings or away from git doesn&apos;t appear. A squash merge keeps only its merge time.</li>
          <li>When an agent commits every few minutes, a session can run as long as the agent does, so long sessions are an upper bound.</li>
        </ul>
      </section>
    </article>
  );
}
```

`Bars` uses an inline `style` height. That's server-rendered and fine. The `title` attribute gives the hover.

- [ ] **Step 4: Register the page and pin the reader split.** Add this line to `SERVER_SAFE` in `lib/server-safe-source.test.ts`:

```ts
  "app/(public)/(chrome)/hours/page.tsx",
```

Then create `lib/hours-cache-source.test.ts`. It pins spec §6: the public zone reads the cached snapshot only.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

for (const path of [
  "app/(public)/(chrome)/hours/page.tsx",
  "app/(public)/(chrome)/plant/[slug]/page.tsx",
]) {
  test(`${path} reads hours through lib/hours-cache, never lib/hours-store`, () => {
    const src = readFileSync(join(process.cwd(), path), "utf8");
    assert.doesNotMatch(src, /hours-store/);
  });
}
```

Task 8 edits the plant page. Until Task 8 lands, the plant-page case passes trivially.

- [ ] **Step 5: Run the tests, then build**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` and expect `# fail 0`.
Run: `npm run build 2>&1 | tail -25` and expect a successful build with `/hours` listed as `ƒ` (dynamic).

- [ ] **Step 6: Look at it.** Run `npm run dev`, then seed the scratch DB. `.env.local` points at prod, so set `MONGODB_DB=beanstalk_scratch` for both commands:

```bash
HOURS_TOKEN=dev HOURS_URL=http://localhost:3333/api/hours npm run hours:sync -- --local ~/code
```

The engine refuses `--local` without `--dry-run` unless `HOURS_URL` points at `localhost` or `127.0.0.1`, as above, so this seeding command is the allowed exception.
Start the dev server with `MONGODB_DB=beanstalk_scratch HOURS_TOKEN=dev npm run dev` first. Then open `http://localhost:3333/hours`.
Check, in light and dark, and at 400px width:
- the calendar scrolls inside its frame;
- the page itself does not scroll sideways;
- the tables are readable.

- [ ] **Step 7: Commit**

```bash
git add lib/hours-cache-source.test.ts "app/(public)/(chrome)/hours/page.tsx" components/public-icons.tsx "app/(public)/_components/public-chrome.tsx" lib/server-safe-source.test.ts
git commit -m "Work hours: the public /hours page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Plant page "Work" block

**Files:**
- Modify: `app/(public)/(chrome)/plant/[slug]/page.tsx`

- [ ] **Step 1: Load the snapshot alongside the dataset.** Replace the `Promise.all` line:

```tsx
  const [data, allPollen, hours] = await Promise.all([getPublicDataset(), listPollen(), getCachedHours()]);
```

Add the imports:

```tsx
import { getCachedHours } from "@/lib/hours-cache";
import { aggregateUnit, parisToday } from "@/lib/hours-aggregate";
import { HeatCalendar } from "@/components/heat-calendar";
```

After the `screens` computation, add:

```tsx
  // The Work block (work-hours spec §6): only when this plant has mapped repos.
  const hoursUnit = hours?.plants.find((u) => u.plant === slug);
  const today = parisToday();
  const work = hoursUnit && hours ? aggregateUnit(hoursUnit, hours.params.since, today) : null;
```

- [ ] **Step 2: Render the block** just before the `{/* Mechanical index` comment:

```tsx
      {work && work.totalSince > 0 ? (
        <section className="reveal flex flex-col gap-2">
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">Work</h2>
          <div className="overflow-x-auto">
            <HeatCalendar days={work.days} today={today} label={resolveText(plant.name, lang)} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {Math.round(work.totalSince)} h since {hours!.params.since} · {work.avgActiveWeek.toFixed(1)} h per active
            week ·{" "}
            <a href="/hours" className="underline-offset-4 hover:underline">
              all hours
            </a>
          </p>
        </section>
      ) : null}
```

- [ ] **Step 3: Build and check**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` and expect `# fail 0`.
Run: `npm run build 2>&1 | tail -5` and expect success.
Then open `http://localhost:3333/plant/pbbls` on the dev server from Task 7 and check that the Work block shows.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/(chrome)/plant/[slug]/page.tsx"
git commit -m "Work hours: a Work block on plant pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Weekly digest hours tally

**Files:**
- Modify: `app/api/synthesis/week/route.ts`, `docs/synthesis/weekly-digest-routine.md`

- [ ] **Step 1: Extend the week door.** In `app/api/synthesis/week/route.ts`, add the imports:

```ts
import { loadHoursSnapshot } from "../../../../lib/hours-store";
import { weekHours } from "../../../../lib/hours-aggregate";
```

Load the snapshot in parallel:

```ts
  const [material, digestBeans, hoursSnapshot] = await Promise.all([
    loadWeekMaterial(),
    listDigestBeanSlugs(),
    loadHoursSnapshot(),
  ]);
```

Add this to the JSON response, after `digestBeans`:

```ts
    // Work-hours tally for the wrap (work-hours spec §7); null before the first sync.
    hours: hoursSnapshot ? weekHours(hoursSnapshot, bounds.start, bounds.end) : null,
```

`weekHours` is already unit-tested in Task 3. The existing `lib/synthesis-week-route.test.ts` DB tests must still pass.

- [ ] **Step 2: Update the routine prompt.** In `docs/synthesis/weekly-digest-routine.md`, step 4, after the tally-line sentence, add:

```markdown
   If the response's `hours` is not null and `hours.total > 0`, add one line
   right after the tally: "Hours: X h over N sessions; most on <name> (Y h)."
   — X = `hours.total` rounded to the hour, N = `hours.sessions`, <name>/Y =
   the first entry of `hours.byRepo`. Skip the line when `hours` is null or 0.
```

- [ ] **Step 3: Run the suites**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` and expect `# fail 0`.
Run: `npm run test:db 2>&1 | grep -E "^# (pass|fail)"` and expect `# fail 0`.

- [ ] **Step 4: Commit**

```bash
git add app/api/synthesis/week/route.ts docs/synthesis/weekly-digest-routine.md
git commit -m "Work hours: the weekly wrap gets an hours line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The cron workflow

**Files:**
- Create: `.github/workflows/hours-sync.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# Work hours (spec docs/superpowers/specs/2026-11-11-work-hours-design.md §4).
# Clones the repos in data/hours.yml treeless, computes sessions, POSTs the
# snapshot. All or nothing: a red run means the site kept the last good one.
name: hours-sync

on:
  schedule:
    - cron: "17 */6 * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Sync hours
        run: npm run hours:sync
        env:
          HOURS_GITHUB_TOKEN: ${{ secrets.HOURS_GITHUB_TOKEN }}
          HOURS_TOKEN: ${{ secrets.HOURS_TOKEN }}
```

- [ ] **Step 2: Validate the YAML**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/hours-sync.yml','utf8'));console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/hours-sync.yml
git commit -m "Work hours: a six-hourly sync workflow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Final verification

- [ ] **Step 1:** `npm run lint` passes with no new errors.
- [ ] **Step 2:** `npm test` and `npm run test:db` both report `# fail 0`.
- [ ] **Step 3:** `npm run build` succeeds.
- [ ] **Step 4:** `npm run hours:sync -- --dry-run --local ~/code` reports global since 2026-03-16 within 871–963 h.
- [ ] **Step 5:** Open the PR. Its body includes a Lab Note (pod `ariko`, type `feature`) and the provisioning steps from spec §11.
