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
