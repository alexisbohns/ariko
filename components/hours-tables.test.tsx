import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthTable, partialMonths, type HoursRow } from "@/components/hours-tables";
import type { UnitAggregate } from "@/lib/hours-aggregate";

const agg = (totalSince: number, months: Record<string, number> = {}): UnitAggregate =>
  ({
    totalSince,
    months,
    avgMonth: 0,
    avgWeek: 0,
    avgActiveWeek: 0,
    activeWeeks: 0,
    peakWeek: null,
  }) as unknown as UnitAggregate;

const rows: HoursRow[] = [{ name: "ariko", agg: agg(5, { "2026-03": 5 }) }];
const total: HoursRow = { name: "All projects", agg: agg(5, { "2026-03": 5 }) };
const months = ["2026-03", "2026-04", "2026-05"];
const stars = (html: string) => (html.match(/<abbr title="partial month">\*<\/abbr>/g) ?? []).length;

test("partialMonths stars a first month that starts mid-month and a last month not yet over", () => {
  assert.deepEqual(partialMonths("2026-03-16", "2026-05-10"), { first: true, last: true });
  assert.deepEqual(partialMonths("2026-03-01", "2026-05-31"), { first: false, last: false });
  assert.deepEqual(partialMonths("2026-03-01", "2026-05-10"), { first: false, last: true });
  assert.deepEqual(partialMonths("2026-03-16", "2024-02-29"), { first: true, last: false });
  assert.deepEqual(partialMonths("2026-03-16", "2026-02-28"), { first: true, last: false });
});

test("MonthTable stars both ends when both are partial", () => {
  const html = renderToStaticMarkup(
    <MonthTable rows={rows} total={total} months={months} since="2026-03-16" today="2026-05-10" />,
  );
  assert.equal(stars(html), 2);
  assert.match(html, />Mar<abbr/);
  assert.match(html, />May<abbr/);
});

test("MonthTable stars nothing when both ends are whole months", () => {
  const html = renderToStaticMarkup(
    <MonthTable rows={rows} total={total} months={months} since="2026-03-01" today="2026-05-31" />,
  );
  assert.equal(stars(html), 0);
});

test("MonthTable stars only the current month when since is a 1st", () => {
  const html = renderToStaticMarkup(
    <MonthTable rows={rows} total={total} months={months} since="2026-03-01" today="2026-05-10" />,
  );
  assert.equal(stars(html), 1);
  assert.match(html, />May<abbr/);
});

test("a single partial month carries one star", () => {
  const html = renderToStaticMarkup(
    <MonthTable rows={rows} total={total} months={["2026-03"]} since="2026-03-16" today="2026-03-20" />,
  );
  assert.equal(stars(html), 1);
});
