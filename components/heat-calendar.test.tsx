import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { HeatCalendar } from "@/components/heat-calendar";
import { HoursWeeklyBars } from "@/components/hours-weekly-bars";

test("HeatCalendar draws one cell per elapsed day of 53 weeks, with a tooltip each", () => {
  const html = renderToStaticMarkup(
    <HeatCalendar label="All projects" today="2026-11-11" days={{ "2026-11-10": { hours: 4.2, sessions: 2 } }} />,
  );
  // 52 full weeks + Mon..Wed of the current one
  assert.equal((html.match(/<rect/g) ?? []).length, 52 * 7 + 3);
  assert.match(html, /<title>Tue 10 Nov 2026 · 4\.2 h · 2 sessions<\/title>/);
  assert.match(html, /<title>Mon 9 Nov 2026 · no commits<\/title>/);
  assert.match(html, /aria-label="All projects/);
  assert.match(html, /data-level="3"/);
});

test("HeatCalendar small size draws no weekday labels", () => {
  const html = renderToStaticMarkup(<HeatCalendar label="x" today="2026-11-11" days={{}} size="sm" />);
  assert.doesNotMatch(html, />Mon</);
});

test("HoursWeeklyBars draws a bar per non-empty week and an average line", () => {
  const html = renderToStaticMarkup(
    <HoursWeeklyBars since="2026-03-16" today="2026-04-12" weeks={{ "2026-03-16": 30, "2026-03-30": 10 }} avg={10} />,
  );
  assert.equal((html.match(/data-week=/g) ?? []).length, 2);
  assert.match(html, /avg 10 h/);
});
