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

/** Median of an ascending list; the mean of the two middle values when the count is even. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : r2((sorted[mid - 1] + sorted[mid]) / 2);
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
    medianSession: median(sorted),
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
