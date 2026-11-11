import { getCachedHours } from "@/lib/hours-cache";
import { getPublicDataset } from "@/lib/garden-cache";
import { aggregateUnit, parisToday, type UnitAggregate } from "@/lib/hours-aggregate";
import type { HoursUnit } from "@/lib/hours";
import { HeatCalendar, HeatLegend } from "@/components/heat-calendar";
import { HoursWeeklyBars } from "@/components/hours-weekly-bars";
import { MonthTable, WeekTable, type HoursRow } from "@/components/hours-tables";
import { resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { seq } from "@/components/reveal";

export const dynamic = "force-dynamic";

// /hours (spec §6): work time estimated from commit timestamps. Server-only,
// complete with script off. Reads the cached snapshot, never lib/hours-store.

const fmt = (h: number) => (h >= 10 ? Math.round(h).toLocaleString("en") : h.toFixed(1));
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ago(iso: string, now = Date.now()): { text: string; stale: boolean } {
  const h = (now - Date.parse(iso)) / 3_600_000;
  const text = h < 1 ? "less than an hour ago" : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
  return { text, stale: h > 24 };
}

function Bars({ values, labels, every }: { values: number[]; labels: string[]; every: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-28 items-end gap-1" role="img" aria-label={labels.map((l, i) => `${l} ${fmt(values[i])} h`).join(", ")}>
      {values.map((v, i) => (
        <div key={labels[i]} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-sm bg-primary" style={{ height: `${(v / max) * 96}px` }} title={`${labels[i]} · ${fmt(v)} h`} />
          <span className="text-[9px] text-muted-foreground">{i % every === 0 ? labels[i] : " "}</span>
        </div>
      ))}
    </div>
  );
}

export default async function HoursPage() {
  const [snapshot, data, lang] = await Promise.all([getCachedHours(), getPublicDataset(), currentLang()]);

  if (!snapshot) {
    return (
      <article className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Hours</h1>
        <p className="text-muted-foreground">
          No hours synced yet. Once the hourly sync runs, this page shows work time estimated from commit timestamps.
        </p>
      </article>
    );
  }

  const today = parisToday();
  const since = snapshot.params.since;
  const agg = (u: HoursUnit): UnitAggregate => aggregateUnit(u, since, today);
  const g = agg(snapshot.global);
  const publicPlant = (slug?: string) => (slug ? data.getPlant(slug) : undefined);
  const plantName = (u: HoursUnit) => {
    const p = publicPlant(u.plant);
    return p ? resolveText(p.name, lang) : u.name;
  };
  const row = (u: HoursUnit, name: string): HoursRow => ({
    name,
    href: publicPlant(u.plant) ? `/plant/${u.plant}` : undefined,
    agg: agg(u),
  });
  const repoRows = snapshot.repos.map((u) => row(u, u.name)).filter((r) => r.agg.totalSince > 0)
    .sort((a, b) => b.agg.totalSince - a.agg.totalSince);
  const total: HoursRow = { name: "All projects", agg: g };
  const months: string[] = [];
  for (let m = since.slice(0, 7); m <= today.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const units = [...snapshot.plants.map((u) => ({ u, name: plantName(u) })), ...snapshot.repos.filter((u) => !u.plant).map((u) => ({ u, name: u.name }))]
    .map(({ u, name }) => ({ u, name, a: agg(u) }))
    .sort((x, y) => y.u.sessions.reduce((s, z) => s + z.hours, 0) - x.u.sessions.reduce((s, z) => s + z.hours, 0));
  const sumRepos = snapshot.repos.reduce((s, u) => s + agg(u).totalSince, 0);
  const updated = ago(snapshot.generatedAt);

  const section = "flex flex-col gap-3";
  const h2 = "font-heading text-xs uppercase tracking-widest text-muted-foreground";

  return (
    <article className="flex flex-col gap-10">
      <header {...seq(0, "flex flex-col gap-2")}>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Hours</h1>
        <p className="text-muted-foreground">
          Work time estimated from the timestamps of my own commits. Commits less than {snapshot.params.gapMinutes / 60} hours
          apart count as one session, plus {snapshot.params.leadMinutes} minutes for the work before the first commit.
        </p>
        <p className="text-xs text-muted-foreground">
          Updated {updated.text}
          {updated.stale ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5">stale</span> : null}
        </p>
      </header>

      <dl {...seq(1, "grid grid-cols-2 gap-4 sm:grid-cols-5")}>
        {[
          [`${fmt(g.totalSince)} h`, `since ${since}`],
          [`${g.avgWeek.toFixed(1)} h`, "per week"],
          [`${g.avgActiveWeek.toFixed(1)} h`, `per active week (${g.activeWeeks})`],
          [String(g.sessionsSince), "sessions"],
          [`${g.medianSession.toFixed(1)} h`, "median session"],
        ].map(([v, l]) => (
          <div key={l} className="flex flex-col">
            <dt className="order-2 text-xs text-muted-foreground">{l}</dt>
            <dd className="font-heading text-xl tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section className={section}>
        <h2 className={h2}>Past 12 months</h2>
        <div className="overflow-x-auto">
          <HeatCalendar days={g.days} today={today} label="All projects" />
        </div>
        <HeatLegend />
      </section>

      <section className={section}>
        <h2 className={h2}>Hours per week since {since}</h2>
        <div className="overflow-x-auto">
          <HoursWeeklyBars weeks={g.weeks} since={since} today={today} avg={g.avgWeek} />
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>Per week, by project</h2>
        <p className="text-sm text-muted-foreground">
          Per-project hours add up to {fmt(sumRepos)} h, more than the {fmt(g.totalSince)} h total, because a sitting that
          touches two repos counts in each of them.
        </p>
        <div className="overflow-x-auto">
          <WeekTable rows={repoRows} total={total} />
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>Per month, by project</h2>
        <p className="text-sm text-muted-foreground">* The first and current months are partial.</p>
        <div className="overflow-x-auto">
          <MonthTable rows={repoRows} total={total} months={months} />
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>By project</h2>
        {/* One column: a small calendar is 530px and the reading column 720px,
            so two side by side would each hide their most recent months. */}
        <div className="grid gap-6">
          {units.map(({ u, name, a }) => (
            <div key={u.key} className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-sm">
                  {publicPlant(u.plant) ? <a href={`/plant/${u.plant}`} className="underline-offset-4 hover:underline">{name}</a> : name}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmt(a.totalSince)} h · {a.sessionsSince} sessions{u.repos.length > 1 ? ` · ${u.repos.length} repos` : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <HeatCalendar days={a.days} today={today} label={name} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>When sessions start</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Bars values={g.byHour} labels={g.byHour.map((_, h) => `${String(h).padStart(2, "0")}h`)} every={3} />
          <Bars values={g.byWeekday} labels={DAY_NAMES} every={1} />
        </div>
      </section>

      <section className={`${section} text-sm text-muted-foreground`}>
        <h2 className={h2}>How this is measured</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Every branch of each GitHub repo, my own commits only. Bots and commits authored by Claude are left out.</li>
          <li>Each commit's author time, in the timezone where it was made. A session belongs to the day it started.</li>
          <li>Time spent designing, in meetings or away from git doesn&apos;t appear. A squash merge keeps only its merge time.</li>
          <li>When an agent commits every few minutes, a session can run as long as the agent does, so long sessions are an upper bound.</li>
        </ul>
      </section>
    </article>
  );
}
