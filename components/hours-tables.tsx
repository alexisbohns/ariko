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
