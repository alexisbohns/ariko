import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { isObject, nonEmptyString } from "./text-input";

// Repo-versioned federation config (spec §3): which feeds the read model
// syncs, and which plants exhibit their feed events on the PUBLIC beanstalk.
// Merging a change to data/federation.yml is deploying it (umbrella §11).

export interface FeedConfig {
  id: string; // cursor key — stable forever once synced
  source: string; // emitting tool slug (matches envelope.source)
  transport: "http" | "file";
  url: string;
  tokenEnv?: string; // env var NAME holding the bearer token; required for http
}

export interface FederationConfig {
  feeds: FeedConfig[];
  exhibit: string[]; // "plant:<slug>" refs — the per-plant human exhibition act
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const PLANT = "plant:";

// Throws on any bad shape: a broken config must fail sync loudly, never
// half-run (spec §10 — loud config error).
export function parseFederation(raw: unknown): FederationConfig {
  if (!isObject(raw)) throw new Error("federation.yml must be a mapping");
  const feedsRaw = raw.feeds ?? [];
  if (!Array.isArray(feedsRaw)) throw new Error("feeds must be a list");
  const seen = new Set<string>();
  const feeds = feedsRaw.map((f, i): FeedConfig => {
    if (!isObject(f)) throw new Error(`feeds[${i}] must be a mapping`);
    if (!nonEmptyString(f.id) || !SLUG.test(f.id)) throw new Error(`feeds[${i}].id must be a slug`);
    if (seen.has(f.id)) throw new Error(`duplicate feed id "${f.id}"`);
    seen.add(f.id);
    if (!nonEmptyString(f.source) || !SLUG.test(f.source)) {
      throw new Error(`feed "${f.id}": source must be a slug`);
    }
    if (f.transport !== "http" && f.transport !== "file") {
      throw new Error(`feed "${f.id}": transport must be "http" or "file"`);
    }
    if (!nonEmptyString(f.url)) throw new Error(`feed "${f.id}": url is required`);
    if (f.transport === "http" && !nonEmptyString(f.tokenEnv)) {
      throw new Error(`feed "${f.id}": tokenEnv is required for http feeds`);
    }
    return {
      id: f.id,
      source: f.source,
      transport: f.transport,
      url: f.url,
      ...(nonEmptyString(f.tokenEnv) ? { tokenEnv: f.tokenEnv } : {}),
    };
  });
  const exhibitRaw = raw.exhibit ?? [];
  if (!Array.isArray(exhibitRaw)) throw new Error("exhibit must be a list");
  const exhibit = exhibitRaw.map((e, i) => {
    if (typeof e !== "string" || !e.startsWith(PLANT) || !SLUG.test(e.slice(PLANT.length))) {
      throw new Error(`exhibit[${i}] must be a "plant:<slug>" ref`);
    }
    return e;
  });
  return { feeds, exhibit };
}

let cached: FederationConfig | null = null;

// Reads data/federation.yml once, then caches — same lifecycle as getDataset.
export function getFederation(): FederationConfig {
  if (!cached) {
    const file = readFileSync(join(process.cwd(), "data", "federation.yml"), "utf8");
    cached = parseFederation(yaml.load(file, { schema: yaml.CORE_SCHEMA }));
  }
  return cached;
}
