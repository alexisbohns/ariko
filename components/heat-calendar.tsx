import type { ReactNode } from "react";
import { calendarWeeks, heatLevel, type DayCell } from "@/lib/hours-aggregate";

// A GitHub-style heat calendar (spec §6), SERVER-SAFE: plain SVG, a native
// <title> per active cell on the large size for the hover, no client JS.
// Listed in lib/server-safe-source.test.ts.
//
// Colour: level 0 is --muted, level 5 is --primary, and levels 1–4 mix
// --primary into --muted in oklab. Interpolating between the two tokens
// keeps the ramp monotonic from the ground to the accent in BOTH themes;
// --primary at an opacity over a dark ground would come out darker than
// --muted, so an empty day would look brighter than a light one.
//
// Weight: a page draws a dozen of these, and every node is serialized twice
// (HTML and the flight payload). So all empty days are ONE <path> of square
// subpaths, only active days are <rect>s, and only the large size carries
// <title>s; a small calendar's summary is its aria-label.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const LEVEL_CLASS = [
  "fill-muted",
  "fill-[color-mix(in_oklab,var(--primary)_20%,var(--muted))]",
  "fill-[color-mix(in_oklab,var(--primary)_40%,var(--muted))]",
  "fill-[color-mix(in_oklab,var(--primary)_60%,var(--muted))]",
  "fill-[color-mix(in_oklab,var(--primary)_80%,var(--muted))]",
  "fill-primary",
] as const;

export const HEAT_LEGEND = ["0", "<1 h", "1–3 h", "3–6 h", "6–9 h", "9 h+"];

/** "Mon 16 Mar 2026", the one date format of the hours surfaces. */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function describe(day: string, cell: DayCell): string {
  return `${dayLabel(day)} · ${cell.hours.toFixed(1)} h · ${cell.sessions} session${cell.sessions > 1 ? "s" : ""}`;
}

/** "X h over N active days in the past year", over the calendar's own window. */
export function yearSummary(days: Record<string, DayCell>, today: string): string {
  let hours = 0;
  let active = 0;
  for (const col of calendarWeeks(today))
    for (const day of col) {
      const h = day ? (days[day]?.hours ?? 0) : 0;
      if (h > 0) {
        hours += h;
        active++;
      }
    }
  const total = hours >= 10 ? Math.round(hours).toLocaleString("en") : hours.toFixed(1);
  return `${total} h over ${active} active day${active === 1 ? "" : "s"} in the past year`;
}

export function HeatCalendar({
  days,
  today,
  label,
  summary,
  size = "lg",
}: {
  days: Record<string, DayCell>;
  today: string;
  label: string;
  summary?: string;
  size?: "lg" | "sm";
}) {
  const cell = size === "lg" ? 12 : 8;
  const gap = size === "lg" ? 3 : 2;
  const step = cell + gap;
  const left = size === "lg" ? 28 : 0;
  const top = 14;
  const cols = calendarWeeks(today);
  // Right padding so the last column's month label isn't clipped.
  const width = left + cols.length * step + 16;
  const height = top + 7 * step;
  let lastMonth = -1;

  const labels: ReactNode[] = [];
  const active: ReactNode[] = [];
  // Empty days: square subpaths, each after the first a relative move from
  // the previous one's start (where Z leaves the pen), which gzips to nothing.
  let empty = "";
  let px = 0;
  let py = 0;

  cols.forEach((col, w) => {
    const first = col[0];
    if (first) {
      const m = Number(first.slice(5, 7)) - 1;
      if (m !== lastMonth && Number(first.slice(8, 10)) <= 7) {
        lastMonth = m;
        labels.push(
          <text key={first} x={left + w * step} y={9} className="fill-muted-foreground text-[9px]">
            {MONTHS[m]}
          </text>,
        );
      }
    }
    col.forEach((day, r) => {
      if (!day) return;
      const x = left + w * step;
      const y = top + r * step;
      const c = days[day];
      const level = heatLevel(c?.hours ?? 0);
      if (level === 0) {
        empty += empty ? `m${x - px} ${y - py}` : `M${x} ${y}`;
        empty += `h${cell}v${cell}h-${cell}z`;
        px = x;
        py = y;
        return;
      }
      active.push(
        <rect key={day} x={x} y={y} width={cell} height={cell} rx={2} data-level={level} className={LEVEL_CLASS[level]}>
          {size === "lg" ? <title>{describe(day, c!)}</title> : null}
        </rect>,
      );
    });
  });

  return (
    <svg
      role="img"
      aria-label={`${label}: work hours per day over the past year${summary ? `. ${summary}` : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="mr-auto block max-w-none [direction:ltr]"
    >
      {size === "lg"
        ? ["Mon", "Wed", "Fri"].map((d, i) => (
            <text key={d} x={0} y={top + i * 2 * step + cell - 2} className="fill-muted-foreground text-[9px]">
              {d}
            </text>
          ))
        : null}
      {labels}
      {empty ? <path data-level="0" d={empty} className={LEVEL_CLASS[0]} /> : null}
      {active}
    </svg>
  );
}

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Less</span>
      {LEVEL_CLASS.map((c) => (
        <svg key={c} width={11} height={11} aria-hidden="true">
          <rect width={11} height={11} rx={2} className={c} />
        </svg>
      ))}
      <span>More</span>
      <span className="ml-2">{HEAT_LEGEND.join(" · ")} per day</span>
    </div>
  );
}
