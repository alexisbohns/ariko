# Work hours: estimating work time from commit timestamps

Status: approved in brainstorm on 2026-11-11.
Prototype: the "Commit Hours Ledger" artifact, built from local `~/code` on 2026-11-11.

## 1. Goal

Ariko shows how much time Alexis works, globally and per project:
- GitHub-style heat calendars;
- weekly, monthly and yearly averages;
- a short weekly paragraph in the Monday wrap.

The numbers are estimated from the author timestamps of Alexis's own commits. They stay current without any manual step.

Decisions from the brainstorm:

- **Scope: GitHub repos only.** Teale's GitLab repos (`sandbox`, `reviewer`, `meditations`, `wbt-analysis`, `foundation`) are out. No work credential goes into this public repo.
- **Visibility: fully public.** Hours, averages and heat calendars are visible on www.ariko.app.
- **Every repo is shown by name**, including repos whose plant is private (letsgong) and the third-party `OxymoreApp/Oxymore`. A repo's display name comes from the hours config (§3), so the page never has to read a private plant.
- **The engine is deterministic.** A scheduled GitHub Action extracts, computes and POSTs the numbers. Claude's only part is the prose in the existing weekly-digest bee.

Non-goals:
- tracking time outside git (design, meetings, Figma);
- counting commits authored by "Claude" in cloud sessions;
- per-commit detail on the site;
- editing anything from the admin.

## 2. The estimation method (normative)

This is the method the prototype used, frozen here so the numbers stay reproducible.

1. **Commits.**
   - Take `git log --all --no-merges` of each configured repo. The repo is cloned with `--mirror`, so `refs/pull/*` heads are included and branch commits survive branch deletion.
   - Keep a commit when its author email is in `identities` (§3). Then drop it if its author name or email matches `exclude` (bots, `Claude`, Copilot).
   - Drop it too when its committer is `noreply@github.com`: GitHub made it (a squash or rebase merge, or a web edit). A squash merge is stamped at the merge click, not the work; on Oxymore those clicks alone added 23.4 h and 8 sessions. The PR's own commits stay reachable under `refs/pull/*`, so the real work is still counted. Web-editor edits are lost, which is accepted.
2. **Timestamp.**
   - Use the author date. A rebase rewrites the committer date, and the author date survives it.
   - Keep the author's **local wall-clock** time: the ISO string with its offset removed. This is the time Alexis saw.
   - Within one repo, identical timestamps collapse to one. This removes rebase and cherry-pick copies, which keep their author date.
3. **Sessions.**
   - Sort the timestamps. A gap greater than `gapMinutes` (default 120) starts a new session.
   - A session's hours are `(last − first) + leadMinutes` (default 30). The lead stands for the work before the first commit.
4. **Units.**
   - Sessions are computed for each repo, for each plant (all timestamps of the plant's repos merged), and globally (every repo merged).
   - Because of the merge, the global figure counts parallel work in two repos only once. Per-repo totals therefore add up to more than the global total. The page says so.
   - For the same reason the global and plant `commits` count unique timestamps across the merged repos, so they can be lower than the sum of the repos.
   - Durations are wall-clock, so a session that spans a DST switch is off by an hour. This is accepted.
5. **Day bucketing.**
   - A session belongs to the local date of its first commit.
   - A week runs Monday to Sunday (ISO). A month is a calendar month.
6. **Averages.**
   - "Avg / week" is hours ÷ fractional weeks: the days from `since` to today, inclusive, ÷ 7.
   - "Avg / active week" divides by the weeks that have at least one session.
   - "Avg / month" is hours ÷ months elapsed since `since`, where months elapsed = days ÷ 30.44.
   - `since` defaults to 2026-03-16.
   - The heat calendars ignore `since`. They always show the trailing 53 weeks.

**Acceptance baseline.** The prototype, run on local clones on 2026-11-11, gave about 917 h in 343 sessions since 2026-03-16. The GitHub mirrors hold far more of Alexis's commits than those clones did (PR branches deleted after merge survive under `refs/pull/*`; Oxymore had 865 unique stamps remotely against 374 locally), so the remote figure is the reference: with GitHub-committed commits dropped, **928 h in 301 sessions** on 2026-11-11 (Oxymore 119.8 h). A deviation of more than ±5% on the same date is a bug.

## 3. Configuration: `data/hours.yml`

A versioned config in the style of `data/federation.yml`. Merging is deploying.

```yaml
since: 2026-03-16
gapMinutes: 120
leadMinutes: 30
identities:            # author emails that are Alexis
  - hello@bohns.design
  - alexis.bohn@teale.io
  - alexis@enerfip.fr
  - 58178426+alexisbohns@users.noreply.github.com
exclude:               # case-insensitive regexes on "Name <email>"
  - "\\[bot\\]"
  - "^Claude <"
  - "^Copilot <"
  - "noreply@anthropic\\.com"
repos:
  - repo: alexisbohns/pbbls
    name: pbbls
    plant: pbbls        # optional; links to /plant/<slug> when that plant is public
  - repo: alexisbohns/arkaik
    name: arkaik
    plant: arkaik
  # ariko, femfolk, melogram, paulopus, bohnsdesign, krabs, letsgong,
  # sparkaik, OxymoreApp/Oxymore (plant: oxymore), l855skipi/skillteplait
```

`lib/hours-config.ts` parses and validates the config. It refuses:
- an unknown key;
- a duplicate repo;
- a malformed `owner/name`;
- an invalid regex;
- a non-positive gap or lead.

A test validates the committed file, the same way the manifests are guarded.

## 4. Engine: `hours-sync` workflow

`.github/workflows/hours-sync.yml`:
- Triggers: `schedule: "17 3 * * *"` (daily, 03:17 UTC) and `workflow_dispatch`. A full rebuild each run, not an incremental one: a blobless clone of the largest repo (pbbls, ~4,100 commits) takes ~2 s and ~8 MB. Do not switch to `--filter=tree:0`: `git log --all` on femfolk then needs a tree the clone skipped and fails, and a stateless rebuild self-heals after a failed run, a force-push or a `data/hours.yml` change. The calendar's unit is a day, so daily is enough.
- Steps: checkout, Node 22, `npm ci`, then `npm run hours:sync`.

`scripts/hours-sync.ts` does the following:

1. Reads `data/hours.yml`.
2. For each repo, runs `git clone --mirror --filter=blob:none https://github.com/<repo>.git` into a temp dir, with a 10-minute timeout. A treeless clone is enough, because no diff is ever read. The token never appears in the URL or in argv, where `ps` and git's own error text could show it. The auth header travels through the child's environment instead: `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=http.extraheader`, `GIT_CONFIG_VALUE_0=AUTHORIZATION: basic <base64 of x-access-token:$HOURS_GITHUB_TOKEN>`. Any stderr is redacted of that value before it is reported. The `--local <dir>` flag, which reads local clones instead, is guarded: it throws without a directory, and it is `--dry-run` only, because local branches differ from the remote refs and must never be POSTed to production. The one exception is a `HOURS_URL` that points at `localhost` or `127.0.0.1`, which is how a local dev server is seeded.
3. Runs `git log --all --no-merges --format=%aI%x09%an%x09%ae%x09%ce` and applies §2.1–2.2. This is pure code: `lib/hours.ts` `selectTimestamps(lines, config)`.
4. Computes the snapshot (§5) with `lib/hours.ts` `buildSnapshot(config, timestampsByRepo, now)`.
5. POSTs the snapshot to `https://www.ariko.app/api/hours` with `Authorization: Bearer $HOURS_TOKEN`.

**All or nothing.** If any clone or log fails, the script exits non-zero without POSTing. The run goes red, and the site keeps the last good snapshot. A partial snapshot would quietly lower the global numbers.

**Privacy.** No hash, subject, email or name leaves the runner. Only timestamps and aggregates do.

Secrets:
- `HOURS_GITHUB_TOKEN`, an Actions secret. It must be a classic PAT with `repo` scope. A fine-grained token can't reach `OxymoreApp/Oxymore` or `l855skipi/skillteplait` without their owners' approval.
- `HOURS_TOKEN`, an Actions secret that must equal the Vercel production env var of the same name.

The script also works locally with `.env.local` (`npm run hours:sync -- --dry-run` prints the snapshot summary instead of POSTing). That's how the acceptance baseline in §2 is checked.

## 5. Snapshot shape (the contract between engine and site)

```ts
interface HoursSession { start: string; end: string; commits: number; hours: number } // local ISO, no offset
interface HoursUnit { key: string; name: string; plant?: string; repos: string[];
                      commits: number; sessions: HoursSession[] }
interface HoursSnapshot {
  v: 1;
  generatedAt: string;                       // UTC ISO
  params: { since: string; gapMinutes: number; leadMinutes: number };
  global: HoursUnit;                         // key "global"
  plants: HoursUnit[];                       // key "plant:<slug>"; only plants with ≥1 mapped repo
  repos: HoursUnit[];                        // key "repo:<owner/name>"
}
```

The snapshot carries sessions, not aggregates. Every aggregate (§6) is derived on read by pure functions, so a change to how the page aggregates never needs a re-sync. About 500 sessions per unit is a few tens of kilobytes.

`lib/hours.ts` `validateSnapshot(x)` guards the ingest:
- shapes and types;
- `v: 1`;
- a 512 KiB cap;
- the session invariant `start ≤ end`;
- `hours > 0`.

On success it returns a freshly built object holding only the fields above. Unknown keys, such as a body `_id`, are dropped rather than stored and served by the public GET.

## 6. Ariko side

- **Store.** `lib/hours-store.ts` keeps one document `{ _id: "current", ...snapshot, receivedAt }` in the `hours` collection, replaced with `replaceOne(upsert)`. It's a rebuildable read model: the next sync recreates it.
- **Door.** `POST /api/hours` fails closed on `HOURS_TOKEN`, as `singleToken` does. It validates, stores and returns `{ ok, sessions, generatedAt }`. Its answers:
  - `400` with the validator's message;
  - `401` when the token is missing or wrong;
  - `413` above the size cap.
- **Read.** `GET /api/hours` is public, because the data is public by decision. It returns the snapshot plus `aggregates` from `lib/hours-aggregate.ts`.
- **Caching.** Public pages read through `getCachedHours()` in `lib/hours-cache.ts`. It's an `unstable_cache` keyed by the `hours` tag, mirroring `lib/garden-cache.ts`. The ingest door calls `revalidateTag("hours")` after storing.
  - The public zone never imports `lib/hours-store.ts` directly. That's the same reader split CLAUDE.md requires for the garden, and a source test pins it.
  - The rule that a sibling repo writes a file and Ariko plants it doesn't apply here. That rule covers authored content. This snapshot is a machine-written read model like pollen sync, so it gets a guarded door the way `/api/pollen/sync` does.
- **Aggregation.** `lib/hours-aggregate.ts` is pure and has tests. For each unit, given `today` and `since`, it produces:
  - `days`: a map from date to `{ hours, sessions }`;
  - `weeks`: a map from Monday's date to hours;
  - `months`: a map from `YYYY-MM` to hours;
  - `totalSince`, `avgWeek`, `avgActiveWeek`, `activeWeeks`, `avgMonth`, `peakWeek`;
  - `medianSession`, `longestSession`;
  - `byWeekday[7]` and `byHour[24]`, both weighted by hours;
  - `longestStreak`, in days.
- **Components.**
  - `components/heat-calendar.tsx` is server-safe: no `"use client"` and no lucide, per CLAUDE.md. It draws an SVG with 53 columns and Monday-to-Sunday rows. It colors cells with a five-step green ramp from the design-system tokens: `<1 h`, `1–3`, `3–6`, `6–9`, `9+`. Each cell has a `<title>` tooltip with the date, hours and sessions, so there's no client JS. A `size` prop switches between the large global grid and the small per-unit grid.
  - `components/hours-weekly-bars.tsx` is the weekly bar chart with its average line.
  - `components/hours-tables.tsx` holds the per-week and per-month tables.
- **Public page `/hours`** sits in `app/(public)/(chrome)/hours/page.tsx` and contains, in order:
  1. a stat row (hours since `since`, avg/week, avg/active week, sessions, median session);
  2. the global calendar;
  3. weekly bars;
  4. the per-week table by repo;
  5. the per-month table by repo;
  6. per-plant then per-repo calendars;
  7. rhythm by hour and by weekday;
  8. the method and its caveats;
  9. "Updated <relative time>" from `generatedAt`.

  It reads from Mongo through the cached dataset pattern and needs no client island. A missing snapshot renders a designed empty state ("No hours synced yet").
- **Script and server safety.** Every new public-rendered file goes into `lib/server-safe-source.test.ts` on the day it's written: `components/heat-calendar.tsx`, `components/hours-weekly-bars.tsx`, `components/hours-tables.tsx`, and the `/hours` page. That means no `"use client"`, no lucide and no `node:` imports. With script off, the page is complete.
- **Plant pages.** When a public plant has a unit, its page gets a "Work" block with:
  - the small calendar;
  - total hours since `since` and avg/active week;
  - a link to `/hours`.
- **Navigation.** One link to `/hours` in the public chrome.

## 7. Weekly digest

- `GET /api/synthesis/week` gains an `hours` block for the requested week: `{ total, sessions, byPlant: [{ plant, hours }], byRepo: [{ repo, hours }] }`. It's computed from the stored snapshot with the week's bounds, and it's `null` when there is no snapshot.
- `docs/synthesis/weekly-digest-routine.md` step 4 adds one tally line to the wrap: "Hours: X h over N sessions; most on <name> (Y h)." It's omitted when `hours` is null.
- The live routine (`trig_01LSgDZJA2wMhvn91LpgQLod`) is updated from that file after merge.

## 8. Freshness and failure

- **Failed sync.** It shows as a red run in GitHub Actions, the same as `pollen-sync`. The page shows "Updated N hours ago". After 36 h (one missed daily run, with slack for cron delay) it adds a muted "stale" chip.
- **Empty or partial data.** The ingest refuses a snapshot whose global unit has zero sessions while the stored one has some. This protects against an identity misconfiguration wiping the page. The opt-out is the `?force=1` query parameter, which only the bearer token can use.

## 9. Testing

- Unit tests (`node:test`) for:
  - `selectTimestamps`: identity filter, exclude regexes, offset stripping, dedup;
  - `sessionize`: gap boundary at exactly `gapMinutes`, single-commit session = lead, ordering;
  - `buildSnapshot`: global merge counts parallel work once, plant merge;
  - `validateSnapshot`;
  - every aggregate in `hours-aggregate` (week math across years and ISO week 53, `since` mid-week, streaks);
  - `hours-config` against the committed file.
- **Fixture parity.** Satisfied by the `--dry-run --local` acceptance run below, not by a committed TSV fixture.
- **Route tests.** Pure handler tests for auth (401), validation (400), size (413) and the empty-wipe guard.
- **Acceptance.**
  - `npm run hours:sync -- --dry-run` locally matches the §2 baseline.
  - After deploy, one manual `workflow_dispatch` run is green.
  - `/hours` renders in both themes and at phone width.

## 10. Pull request

The PR is user-visible, so its body carries a Lab Note with pod `ariko` and type `feature`.

## 11. Rollout

1. Merge the code. `/hours` shows its empty state.
2. Provisioning, done by hand:
   1. Create a classic PAT and store it as `HOURS_GITHUB_TOKEN`.
   2. Generate a token with `openssl rand -hex 32` and set it as `HOURS_TOKEN` in both Vercel prod and Actions.
   3. Redeploy.
3. Dispatch `hours-sync` once and verify `/hours`.
4. Update the digest routine prompt.
