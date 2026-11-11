import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { HeatCalendar, LEVEL_CLASS, yearSummary } from "@/components/heat-calendar";
import { HoursWeeklyBars } from "@/components/hours-weekly-bars";

// 52 full weeks + Mon..Wed of the current one
const ELAPSED = 52 * 7 + 3;
const subpaths = (html: string) => {
  const d = html.match(/<path data-level="0" d="([^"]*)"/)?.[1] ?? "";
  return (d.match(/[Mm]/g) ?? []).length;
};

test("HeatCalendar draws every empty day in one path and a rect per active day, titled in lg", () => {
  const days = { "2026-11-10": { hours: 4.2, sessions: 2 }, "2026-11-02": { hours: 0.5, sessions: 1 } };
  const html = renderToStaticMarkup(<HeatCalendar label="All projects" today="2026-11-11" days={days} />);
  assert.equal((html.match(/<path data-level="0"/g) ?? []).length, 1);
  assert.equal(subpaths(html), ELAPSED - 2);
  assert.equal((html.match(/<rect/g) ?? []).length, 2);
  assert.equal((html.match(/<title>/g) ?? []).length, 2);
  assert.match(html, /<title>Tue 10 Nov 2026 · 4\.2 h · 2 sessions<\/title>/);
  assert.match(html, /<title>Mon 2 Nov 2026 · 0\.5 h · 1 session<\/title>/);
  assert.match(html, /aria-label="All projects/);
  assert.match(html, /data-level="3"/);
});

test("HeatCalendar with no activity draws every elapsed day as empty, and no rect", () => {
  const html = renderToStaticMarkup(<HeatCalendar label="x" today="2026-11-11" days={{}} />);
  assert.equal(subpaths(html), ELAPSED);
  assert.doesNotMatch(html, /<rect/);
});

test("HeatCalendar small size draws no weekday labels and no tooltips", () => {
  const html = renderToStaticMarkup(
    <HeatCalendar label="x" today="2026-11-11" days={{ "2026-11-10": { hours: 2, sessions: 1 } }} size="sm" />,
  );
  assert.doesNotMatch(html, />Mon</);
  assert.doesNotMatch(html, /<title>/);
  assert.equal((html.match(/<rect/g) ?? []).length, 1);
  assert.equal(subpaths(html), ELAPSED - 1);
});

test("HeatCalendar appends the summary to its aria-label", () => {
  const html = renderToStaticMarkup(
    <HeatCalendar label="Ariko" today="2026-11-11" days={{}} size="sm" summary="12 h over 3 active days in the past year" />,
  );
  assert.match(html, /aria-label="Ariko: work hours per day over the past year\. 12 h over 3 active days in the past year"/);
});

test("yearSummary counts only the calendar's window", () => {
  const s = yearSummary(
    {
      "2026-11-10": { hours: 4.25, sessions: 2 },
      "2026-11-09": { hours: 0, sessions: 0 },
      "2025-01-01": { hours: 100, sessions: 9 },
    },
    "2026-11-11",
  );
  assert.equal(s, "4.3 h over 1 active day in the past year");
});

test("heat ramp levels 1–4 mix primary into muted, so it never inverts in dark mode", () => {
  assert.equal(LEVEL_CLASS[0], "fill-muted");
  assert.equal(LEVEL_CLASS[5], "fill-primary");
  [20, 40, 60, 80].forEach((pct, i) => {
    assert.equal(LEVEL_CLASS[i + 1], `fill-[color-mix(in_oklab,var(--primary)_${pct}%,var(--muted))]`);
  });
});

test("HeatCalendar keeps its SVG left-to-right inside an rtl scroller", () => {
  const html = renderToStaticMarkup(<HeatCalendar label="x" today="2026-11-11" days={{}} />);
  assert.match(html, /<svg[^>]*class="[^"]*\[direction:ltr\]/);
});

test("HoursWeeklyBars draws a bar per non-empty week and an average line", () => {
  const html = renderToStaticMarkup(
    <HoursWeeklyBars since="2026-03-16" today="2026-04-12" weeks={{ "2026-03-16": 30, "2026-03-30": 10 }} avg={10} />,
  );
  assert.equal((html.match(/data-week=/g) ?? []).length, 2);
  assert.match(html, /avg 10\.0 h/);
  assert.match(html, /<title>Week of Mon 16 Mar 2026 · 30\.0 h<\/title>/);
  assert.match(html, /aria-label="Hours per week since 2026-03-16, average 10\.0 h per week"/);
});

test("HoursWeeklyBars rounds a long average to one decimal", () => {
  const html = renderToStaticMarkup(
    <HoursWeeklyBars since="2026-03-16" today="2026-04-12" weeks={{ "2026-03-16": 30 }} avg={7.142857} />,
  );
  assert.match(html, /avg 7\.1 h/);
  assert.doesNotMatch(html, /7\.142/);
});

test("HoursWeeklyBars skips a month label too close to the previous one", () => {
  // Week of Mon 23 Mar ends Sun 29 Mar (Mar); week of Mon 30 Mar ends Sun 5 Apr (Apr): one column apart.
  const html = renderToStaticMarkup(
    <HoursWeeklyBars since="2026-03-23" today="2026-05-10" weeks={{ "2026-03-23": 5 }} avg={1} />,
  );
  const labels = [...html.matchAll(/>(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Mar", "May"]);
});
