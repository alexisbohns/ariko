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
