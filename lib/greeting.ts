/**
 * The welcome page's one line. Pure so the boundaries are testable — a
 * greeting computed inline in a server component is a string nobody can assert
 * on, and the boundaries are the only thing about it worth asserting.
 *
 * The INSTANT is never wrong; the OFFSET is. `now` names a point in time, and
 * "morning" or "evening" is a claim about a WALL CLOCK reading it in some
 * zone — this repo deploys to Vercel (UTC) while its author reads the page in
 * Paris, so `now.getHours()` (the runtime's own zone) silently answers a
 * different question than the one asked, four hours a day. lib/synthesis.ts
 * draws the same distinction for date arithmetic — computed in UTC, "which is
 * exact for date-only inputs (the Europe/Paris framing... only matters for
 * the routine's run time, not for date arithmetic)" — and this function IS
 * that run-time case: the zone is resolved explicitly rather than inherited
 * from whatever `TZ` the process happens to have.
 *
 * `timeZone` is a parameter, not a hardcoded read, so the decision is visible
 * at the call site instead of buried in the implementation — still one pure
 * function, no island required to know the hour correctly.
 */
export function greeting(now: Date, timeZone = "Europe/Paris"): string {
  const hour = hourIn(now, timeZone);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// `hour12: false` mostly yields 0-23, but some ICU builds hand back "24" for
// midnight rather than "0" — a quirk of the hour cycle it falls back to, not
// of the zone — so it is normalised here rather than left to surface as an
// off-by-one at the one boundary that matters most (midnight IS the morning).
function hourIn(now: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = Number(formatted);
  return hour === 24 ? 0 : hour;
}
