import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { realDay } from "./hours";
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
  if (typeof since !== "string" || !realDay(since)) {
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
