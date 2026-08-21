// Pure synthesis builders (slice 5 spec §3–§4): week math, slug grammar,
// bucketing and batch validation. No I/O — Mongo glue lives in
// synthesis-store.ts, the doors in app/api/synthesis/.

import type { PollenDoc } from "./pollen-sync";
import { BEAN_PREFIX, PLANT_PREFIX } from "./data";

const WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function isValidWeekId(week: string): boolean {
  const m = WEEK_RE.exec(week);
  if (!m) return false;
  const n = Number(m[2]);
  if (n < 1 || n > 53) return false;
  // Week 53 only exists in 53-week years; Dec 28 is always in the last week.
  return n < 53 || isoWeekId(`${m[1]}-12-28`) === `${m[1]}-W53`;
}

// Date-only strings throughout ("YYYY-MM-DD"); computed in UTC, which is
// exact for date-only inputs (the Europe/Paris framing in the spec only
// matters for the routine's run time, not for date arithmetic).
function toDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}
function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoWeekId(day: string): string {
  const d = toDate(day);
  // ISO 8601: the week belongs to the year of its Thursday.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekBounds(week: string): { start: string; end: string } {
  const m = WEEK_RE.exec(week);
  if (!m || !isValidWeekId(week)) throw new Error(`invalid week id: ${week}`);
  const [, year, num] = m;
  // Jan 4 is always in week 1; walk back to its Monday, then forward.
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (Number(num) - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: toDay(start), end: toDay(end) };
}

export function digestSlug(plantSlug: string, week: string): string {
  return `digest-${plantSlug}-${week.toLowerCase()}`;
}

export function wrapSlug(week: string): string {
  return `weekly-wrap-${week.toLowerCase()}`;
}

export const DIGEST_TYPE = "digest";

// The store's flattening of a TimelineEntry — just what narration needs.
export interface WindowSprout {
  slug: string;
  type: string;
  date: string;
  plantSlug: string | null;
  name: string;
  description: string;
}

export interface WeekBuckets {
  plants: Record<string, { envelopes: PollenDoc[]; sprouts: WindowSprout[] }>;
  quiet: string[];
}

// Pure. Date-part comparison on both sides (pollen `at` is a timestamp,
// sprout dates are date-only — same convention as mergeBeanstalk). Sprouts
// of DIGEST_TYPE are excluded: the digest never narrates itself (spec §4).
export function bucketWeek(
  pollen: PollenDoc[],
  sprouts: WindowSprout[],
  roster: string[],
  bounds: { start: string; end: string },
): WeekBuckets {
  const inWindow = (day: string) => day >= bounds.start && day <= bounds.end;
  const plants: WeekBuckets["plants"] = {};
  const bucket = (slug: string) =>
    (plants[slug] ??= { envelopes: [], sprouts: [] });

  for (const p of pollen) {
    if (!inWindow(p.at.slice(0, 10))) continue;
    bucket(p.anchors.plant.slice(PLANT_PREFIX.length)).envelopes.push(p);
  }
  for (const s of sprouts) {
    if (s.type === DIGEST_TYPE) continue;
    if (!s.plantSlug || !inWindow(s.date.slice(0, 10))) continue;
    bucket(s.plantSlug).sprouts.push(s);
  }
  const quiet = roster.filter((slug) => !(slug in plants));
  return { plants, quiet };
}

export interface DraftSprout {
  slug: string;
  name: string;
  date: string;
  parents: string[]; // exactly one "bean:digest-…" / "bean:weekly-wrap" ref
  content: string;
  description?: string;
}

const MAX_CONTENT_BYTES = 32 * 1024;

// Pure, all-or-nothing (spec §4): first failure names the sprout and rejects
// the batch. `state` is checked on the RAW object — the door structurally
// cannot publish, so any state key at all is a refusal, whatever its value.
export function validateDigestBatch(
  week: string,
  sprouts: DraftSprout[],
  digestBeanSlugs: Set<string>,
): { ok: true } | { ok: false; error: string } {
  if (!isValidWeekId(week)) return { ok: false, error: `invalid week id: ${week}` };
  const seen = new Set<string>();
  for (const s of sprouts) {
    if (typeof s !== "object" || s === null || Array.isArray(s))
      return { ok: false, error: "every sprout must be an object" };
    const who = s.slug || "(missing slug)";
    if ("state" in s)
      return { ok: false, error: `${who}: state is not accepted on this door` };
    if (seen.has(s.slug)) return { ok: false, error: `duplicate slug: ${who}` };
    seen.add(s.slug);
    if (!s.name?.trim()) return { ok: false, error: `${who}: name is required` };
    if (typeof s.content !== "string" || s.content.length > MAX_CONTENT_BYTES)
      return { ok: false, error: `${who}: content must be a string of at most 32KiB` };
    if (s.parents?.length !== 1 || !s.parents[0].startsWith(BEAN_PREFIX))
      return { ok: false, error: `${who}: parents must be exactly one bean ref` };
    const beanSlug = s.parents[0].slice(BEAN_PREFIX.length);
    if (!digestBeanSlugs.has(beanSlug))
      return { ok: false, error: `${who}: unknown digest bean ${beanSlug}` };
    // Slug grammar must match the parent bean AND the batch's week.
    const expected =
      beanSlug === "weekly-wrap"
        ? wrapSlug(week)
        : digestSlug(beanSlug.replace(/^digest-/, ""), week);
    if (s.slug !== expected)
      return { ok: false, error: `${who}: slug must be ${expected}` };
  }
  return { ok: true };
}

// Pure. incoming slugs → the subset that must NOT be overwritten because the
// stored sprout has ANY state set (reviewed is a human act; spec §3).
export function refusedOverwrites(
  incoming: string[],
  existingStates: Map<string, string | undefined>,
): string[] {
  return incoming.filter(
    (slug) => existingStates.has(slug) && existingStates.get(slug) !== undefined,
  );
}
