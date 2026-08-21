// Pure synthesis builders (slice 5 spec §3–§4): week math, slug grammar,
// bucketing and batch validation. No I/O — Mongo glue lives in
// synthesis-store.ts, the doors in app/api/synthesis/.

const WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function isValidWeekId(week: string): boolean {
  const m = WEEK_RE.exec(week);
  if (!m) return false;
  const n = Number(m[2]);
  return n >= 1 && n <= 53;
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
