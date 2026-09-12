import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The rules that make the garden cache a cache rather than a decoration, and
 * that keep it off the write path.
 *
 * `lib/server-safe-source.test.ts`'s reasoning, applied to a different
 * invariant: every violation below passes `tsc`, `npm test` and
 * `npm run build`, and most are invisible in development, where Mongo is
 * local and fast.
 *
 *  - A new write door that forgets `revalidateGarden()` writes to Mongo while
 *    the public site keeps serving the pre-write garden. This already
 *    happened once in the design: the audit proposed one call in a shared
 *    action guard, and THREE of the write doors (/api/articles,
 *    /api/synthesis, /api/pollen/sync) do not go through actions at all.
 *
 *  - `app/admin/actions.ts` reading the CACHED garden is the dangerous one.
 *    `editVersionAction` and `promoteSeedAction` re-read after writing so
 *    `publishCascade` sees the just-saved state; a cached read there hands
 *    them the pre-write garden and the cascade publishes the wrong set of
 *    parents. Nothing crashes. A bean silently stays private, or a parent
 *    silently stays public.
 *
 *  - A public page reading `lib/store.ts` directly — `loadRawGarden` OR
 *    `getFullDataset` — is the quiet one: `getFullDataset` skips
 *    `filterPublic` entirely, so that read is not merely slower than the
 *    cache, it is a PRIVACY LEAK, and nothing about it looks wrong locally.
 *
 * Source text rather than a render or a call, for this file's whole subject:
 * "which function does this module import" is a property of the file as
 * written, and neither `renderToStaticMarkup` nor a unit test can see it.
 *
 * ADDING A WRITER HERE IS THE CHEAP HALF. A new write export in
 * `lib/botanical.ts`, or in one of the three FOREIGN_MODULES, belongs in
 * GARDEN_WRITERS (and FOREIGN_WRITERS, if foreign) on the day it is written
 * — and the completeness tests below refuse to let it belong to neither list
 * in its own module, or belong to a module's list without also being in
 * FOREIGN_WRITERS.
 *
 * `app/admin/actions.ts` IS SPECIAL-CASED throughout this file, by path, on
 * purpose: it carries 19 of the 22 `revalidateGarden()` call sites repo-wide
 * (the other 3 are one each in the API routes), so a whole-file "does this
 * string appear anywhere" check would pass as long as ONE of its ~30 actions
 * remembers to invalidate — invisible to the file the next 26th action gets
 * added to. Below, its writers are checked per FUNCTION instead. When the
 * roadmap's planned split of `actions.ts` lands, the hard-coded door list in
 * "the four write doors are all still here", the hard-coded path in "the
 * write path reads the LIVE garden", and the per-function walk here all need
 * to move with it — update them, don't delete them; a fifth door (or a
 * sixth, after a split) should fail loudly here rather than pass by
 * accident.
 *
 * NEXT VERSION THIS WAS VERIFIED AGAINST: 15.3. In Next 13/14,
 * `export const dynamic = "force-dynamic"` implied `fetchCache:
 * "force-no-store"`, which `unstable_cache` honours by skipping the cache
 * read outright. In 15.3 it does not: `workStore.fetchCache` is set only
 * from an explicit `export const fetchCache`, which no page here declares —
 * that is WHY the cache is live rather than a no-op. An explicit
 * `fetchCache` added to a public page, or to a layout above one, would turn
 * `loadCachedGarden` back into a Mongo round trip per visitor while every
 * other check in this file, and in this repo, stayed green. The assertion
 * below catches the half of that regression a human can cause. The other
 * half — a future Next version restoring the old `force-dynamic` →
 * `fetchCache` mapping, or removing it from `unstable_cache` entirely — is
 * not visible in source text and is not catchable here, which is why this
 * paragraph names the version rather than stating the mapping as a fact.
 */

const APP = join(process.cwd(), "app");
const LIB = join(process.cwd(), "lib");
const COMPONENTS = join(process.cwd(), "components");
const ACTIONS_PATH = "app/admin/actions.ts";
const THIS_FILE = "lib/garden-cache-source.test.ts";

/**
 * The WRITE exports reachable from `app/`, botanical or not. Readers are
 * deliberately absent from this set — see GARDEN_READERS below, which names
 * `lib/botanical.ts`'s non-writing exports so that the completeness test can
 * tell "classified as a reader" apart from "not classified at all".
 */
const GARDEN_WRITERS = new Set([
  "createPod",
  "createBean",
  "createScreen",
  "writeExhibition",
  "updateScreenMeta",
  "updateScreenImage",
  "deleteScreen",
  "createSprout",
  "updateVersion",
  "deleteSprout",
  "updateSproutMeta",
  "updateSproutState",
  "updateSproutDate",
  "updateSproutType",
  "setPublic",
  "setPrivate",
  "updateSproutContent",
  "updatePlantContent",
  "updatePodContent",
  "updatePlantRole",
  "updatePlantMeta",
  "updatePlantLogo",
  "updateBeanCover",
  "updateBeanKeyword",
  "updatePlantStatus",
  "updatePlantVisibility",
  "updateSproutMedia",
  "writeArticles",
  "upsertDigestDrafts",
  "runSync",
  "makeSink",
  "deleteFeedData",
]);

/**
 * The writers above that do NOT live in `lib/botanical.ts` — the article,
 * synthesis and pollen stores, plus `runSync` (`lib/pollen-run.ts`, a single-
 * export module with nothing left to reconcile). Named here once so the
 * completeness test can subtract them before comparing GARDEN_WRITERS
 * against `lib/botanical.ts`'s own export list.
 *
 * `makeSink` and `deleteFeedData` (`lib/pollen-store.ts`) both belong here:
 * `makeSink`'s returned sink writes the `beans` collection in `projectBeans`,
 * and `deleteFeedData` deletes from it. Neither is imported from `app/`
 * today — `lib/pollen-run.ts`'s `runSync` is the only caller — so there is no
 * live hole. But `scripts/pollen-rebuild.ts` already contemplates an admin
 * rebuild button, and wiring `deleteFeedData` to one would satisfy every
 * OTHER check in this file while the public site served deleted beans for up
 * to GARDEN_TTL seconds.
 */
const FOREIGN_WRITERS = new Set([
  "writeArticles",
  "upsertDigestDrafts",
  "runSync",
  "makeSink",
  "deleteFeedData",
]);

/**
 * The READ exports of `lib/botanical.ts` — named explicitly, exactly like
 * GARDEN_WRITERS, so a new export must be sorted into one list or the other
 * by a human rather than silently satisfying neither. Verified against the
 * real file below, not trusted on faith.
 */
const GARDEN_READERS = new Set([
  "ensureBotanicalIndexes",
  "listPlants",
  "listPods",
  "listBeans",
  "listScreensForPlant",
  "getScreen",
  "getSprout",
]);

/**
 * The reader/writer split for every FOREIGN module — one entry per module in
 * FOREIGN_WRITERS, `lib/pollen-run.ts` excepted (it exports only `runSync`,
 * which leaves nothing to reconcile). Mirrors the `lib/botanical.ts`
 * completeness test below: every export of each module must be classified
 * here as a writer or a reader, verified against the file rather than
 * trusted on faith. This is what keeps FOREIGN_WRITERS from being the one
 * hand-maintained list with no equivalent check.
 */
const FOREIGN_MODULES: { path: string; writers: Set<string>; readers: Set<string> }[] = [
  {
    path: "lib/articles-store.ts",
    writers: new Set(["writeArticles"]),
    readers: new Set([]),
  },
  {
    path: "lib/synthesis-store.ts",
    writers: new Set(["upsertDigestDrafts"]),
    readers: new Set(["loadWeekMaterial", "listDigestBeanSlugs"]),
  },
  {
    path: "lib/pollen-store.ts",
    writers: new Set(["makeSink", "deleteFeedData"]),
    readers: new Set([
      "ensurePollenIndexes",
      "listPollen",
      "listCursors",
      "countRefusalsByFeed",
      "listRefusals",
    ]),
  },
];

/**
 * Functions in `app/admin/actions.ts` that call a garden writer but never
 * call `revalidateGarden()` in their OWN body, because a function they call
 * does it on their behalf. Adding a name here is meant to feel like a
 * decision, not a formality — each entry says who invalidates for it, and
 * the test below checks the delegate still exists.
 */
const DELEGATES_INVALIDATION: Record<string, string> = {
  setPlantStatusAction: "delegates to flipPlantField, which calls revalidateGarden() after it",
  setPlantVisibilityAction: "delegates to flipPlantField, which calls revalidateGarden() after it",
  applyExhibition:
    "a shared helper — both its callers, toggleScreenExhibitAction and " +
    "reorderExhibitionAction, call revalidateGarden() after it returns",
};

/**
 * Every `.ts`/`.tsx` file under `dir`, walked with Dirent so a directory
 * check never costs a second `stat` per entry and a symlink is never
 * followed into — the idiom `lib/screen-sheet-source.test.ts` already uses.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

type ImportStmt = { names: string[]; module: string };

/**
 * Every braced import statement in `source`, as the names it binds AND the
 * module specifier it binds them from — the pairing is what lets a test ask
 * "does this file import ANYTHING from lib/store" rather than only "does it
 * import this one particular name from it", which `getFullDataset` would
 * otherwise slip past unnoticed.
 */
function imports(source: string): ImportStmt[] {
  const out: ImportStmt[] = [];
  for (const m of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    const names = m[1]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    out.push({ names, module: m[2] });
  }
  return out;
}

/**
 * Names bound by a braced import, which is NOT the same as "the file contains
 * this substring". `screen-create-form.tsx` imports `createScreenAction`, and
 * a substring match would read that as importing the writer `createScreen` and
 * demand a `revalidateGarden()` in a component that writes nothing.
 */
function importedNames(source: string): Set<string> {
  return new Set(imports(source).flatMap((i) => i.names));
}

/** Whether `source` imports anything at all from a module ending in `suffix`. */
function importsFromModule(source: string, suffix: string): boolean {
  return imports(source).some((i) => i.module.endsWith(suffix));
}

/**
 * Every top-level `function` declaration in `source`, with its own body
 * sliced out by brace DEPTH rather than by the position of the next
 * declaration. The latter would fold the next function's leading doc
 * comment into THIS function's body — and this file's doc comments are long
 * enough in prose to contain a stray "revalidateGarden(" or a writer's name
 * followed by a parenthesis, which would misattribute credit or blame to
 * the wrong function entirely.
 */
function topLevelFunctions(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const braceStart = source.indexOf("{", re.lastIndex);
    let depth = 0;
    let end = braceStart;
    for (; end < source.length; end++) {
      if (source[end] === "{") depth++;
      else if (source[end] === "}") {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    out.push({ name: m[1], body: source.slice(m.index, end) });
  }
  return out;
}

const FILES = sourceFiles(APP).map((path) => ({
  path: relative(process.cwd(), path),
  text: readFileSync(path, "utf8"),
}));

test("every file under app/ (other than app/admin/actions.ts) that imports a garden writer also invalidates the garden", () => {
  // app/admin/actions.ts is excluded here on purpose: it is checked per
  // FUNCTION below, which is the only granularity that means anything in a
  // ~30-action, ~1000-line file. Every other file under app/ is a single
  // page or a single route handler, where file-granular and
  // function-granular happen to be the same check.
  const offenders = FILES.filter(
    (f) =>
      f.path !== ACTIONS_PATH &&
      [...importedNames(f.text)].some((n) => GARDEN_WRITERS.has(n)) &&
      !f.text.includes("revalidateGarden("),
  ).map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    `these files write the garden but never call revalidateGarden() — the ` +
      `public site will serve the pre-write garden until GARDEN_TTL expires`,
  );
});

test("every function in app/admin/actions.ts that calls a garden writer also invalidates the garden, itself or by a named delegate", () => {
  const actions = FILES.find((f) => f.path === ACTIONS_PATH);
  assert.ok(actions, `${ACTIONS_PATH} must exist`);

  const functions = topLevelFunctions(actions.text);

  // `topLevelFunctions` finds a function's end by counting braces, which a
  // stray `{` inside a string literal would throw off — and the failure would
  // be a FALSE PASS, not a false alarm: a collapsed split yields one giant
  // body that contains both a writer and a `revalidateGarden()`, so every
  // offender hides inside it and the assertion below passes vacuously. That
  // is the exact shape this whole file exists to prevent, so the split is
  // checked before it is trusted.
  assert.ok(
    functions.length > 20,
    `the function splitter found only ${functions.length} functions in ` +
      `${ACTIONS_PATH} — it has collapsed, and the check below would pass ` +
      `vacuously rather than fail`,
  );
  for (const known of ["createSeedAction", "flipPlantField", "reorderExhibitionAction"]) {
    // One from the top of the file, one non-exported helper in the middle, one
    // from the bottom: a split that survives all three is splitting, not
    // swallowing a run of the file into a neighbour.
    assert.ok(
      functions.some((fn) => fn.name === known),
      `the function splitter lost ${known} — see above`,
    );
  }

  // Keeps DELEGATES_INVALIDATION honest: an entry naming a function that no
  // longer exists (renamed, deleted) would silently exempt nothing and mean
  // nothing, and this is the only thing that would ever notice.
  const functionNames = new Set(functions.map((fn) => fn.name));
  const staleAllowlistEntries = Object.keys(DELEGATES_INVALIDATION).filter(
    (n) => !functionNames.has(n),
  );
  assert.deepEqual(
    staleAllowlistEntries,
    [],
    "DELEGATES_INVALIDATION names a function that no longer exists in " +
      `${ACTIONS_PATH} — update or remove the entry`,
  );

  const offenders = functions
    .filter((fn) => {
      const callsWriter = [...GARDEN_WRITERS].some((w) =>
        new RegExp(`\\b${w}\\s*\\(`).test(fn.body),
      );
      if (!callsWriter) return false;
      if (fn.body.includes("revalidateGarden(")) return false;
      return !(fn.name in DELEGATES_INVALIDATION);
    })
    .map((fn) => fn.name);

  assert.deepEqual(
    offenders,
    [],
    `these functions in ${ACTIONS_PATH} call a garden writer but never call ` +
      "revalidateGarden() — directly, or through a named entry in " +
      "DELEGATES_INVALIDATION — which the file-level check above cannot " +
      "catch, because it only asks whether revalidateGarden( appears " +
      "ANYWHERE in the file, a bar any ONE of its ~30 actions can clear for " +
      "all the others",
  );
});

test("the four write doors are all still here", () => {
  // The converse of the two tests above, which pass vacuously if someone
  // deletes a door's writer import along with its invalidation. Hard-coded
  // by design — a fifth door, or a split of app/admin/actions.ts, must fail
  // loudly here rather than pass by coincidence; see this file's docblock.
  const doors = FILES.filter((f) => f.text.includes("revalidateGarden(")).map((f) => f.path);
  assert.deepEqual(doors.sort(), [
    "app/admin/actions.ts",
    "app/api/articles/route.ts",
    "app/api/pollen/sync/route.ts",
    "app/api/synthesis/route.ts",
  ]);
});

test("the write path reads the LIVE garden, never the cached one", () => {
  const actions = FILES.find((f) => f.path === ACTIONS_PATH);
  assert.ok(actions, `${ACTIONS_PATH} must exist`);
  assert.ok(
    importedNames(actions.text).has("loadRawGarden"),
    `${ACTIONS_PATH} must read the live garden`,
  );
  assert.equal(
    importedNames(actions.text).has("loadCachedGarden"),
    false,
    `${ACTIONS_PATH} must NOT read the cached garden — editVersionAction ` +
      "and promoteSeedAction re-read after writing so publishCascade sees the " +
      "just-saved state, and a cached read there publishes the wrong parents",
  );
});

test("the public zone never imports lib/store directly", () => {
  const publicFiles = FILES.filter(
    (f) => f.path.startsWith("app/(public)/") || f.path === "app/api/graph/route.ts",
  );
  // Guards the assertion below the way the previous test guards its `find`:
  // if app/(public)/ gets renamed, or app/api/graph/route.ts moves, this
  // filter silently returns [] and the assertion after it would pass for
  // having nothing left to check — the exact vacuous-pass this file exists
  // to prevent happening to itself. Deliberately scoped to the app/-side
  // files only: components/ always exists and is never empty, so folding it
  // into this same count would make the guard pass no matter what happened
  // to app/(public)/.
  assert.ok(
    publicFiles.length > 0,
    "no public files were found under app/(public)/ or at app/api/graph/route.ts " +
      "— one of those paths moved, and this test needs to move with it",
  );

  // components/ is added to the candidate set (not the guard above) because
  // the assertion message below makes a repo-wide claim — "outside the
  // admin" — not a app/(public)/-only one. A shared component imported by a
  // public page is exactly as dangerous as the page importing lib/store
  // itself, and app/-only would never see it: nothing under components/
  // starts with "app/".
  const componentFiles = sourceFiles(COMPONENTS).map((path) => ({
    path: relative(process.cwd(), path),
    text: readFileSync(path, "utf8"),
  }));

  const offenders = [...publicFiles, ...componentFiles]
    .filter((f) => importsFromModule(f.text, "/lib/store"))
    .map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    "these files import lib/store directly. loadRawGarden bypasses the Data " +
      "Cache and hits Mongo on every request; getFullDataset does that AND " +
      "skips filterPublic, which is a privacy leak, not just a perf regression. " +
      "lib/garden-cache.ts should be the only importer of lib/store outside the " +
      "admin — route the read through getPublicDataset or loadCachedGarden instead",
  );
});

test("no file under app/(public)/ or app/api/graph/ exports fetchCache", () => {
  const offenders = FILES.filter(
    (f) =>
      (f.path.startsWith("app/(public)/") || f.path.startsWith("app/api/graph/")) &&
      /export\s+const\s+fetchCache\b/.test(f.text),
  ).map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    "these files export fetchCache — as of Next 15.3 that is the only thing " +
      "that makes force-dynamic imply force-no-store for unstable_cache, so " +
      "adding it here turns loadCachedGarden back into a Mongo round trip per " +
      "visitor while every other check in this file stays green (see this " +
      "file's docblock: the OTHER half of this regression, a Next upgrade " +
      "restoring the old mapping, is not catchable from source text at all)",
  );
});

test("GARDEN_WRITERS and GARDEN_READERS classify every export of lib/botanical.ts", () => {
  const botanicalPath = join(LIB, "botanical.ts");
  const text = readFileSync(botanicalPath, "utf8");
  const exported = new Set(
    [...text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
  );

  const botanicalWriters = [...GARDEN_WRITERS].filter((n) => !FOREIGN_WRITERS.has(n));
  const classified = new Set([...botanicalWriters, ...GARDEN_READERS]);

  const unclassified = [...exported].filter((n) => !classified.has(n)).sort();
  assert.deepEqual(
    unclassified,
    [],
    "lib/botanical.ts exports a function that neither GARDEN_WRITERS nor " +
      "GARDEN_READERS names — classify it: does it write the garden (add it " +
      "to GARDEN_WRITERS, and every app/ caller needs revalidateGarden()) or " +
      "only read it (add it to GARDEN_READERS, which invalidates nothing)?",
  );

  const stale = [...classified].filter((n) => !exported.has(n)).sort();
  assert.deepEqual(
    stale,
    [],
    "GARDEN_WRITERS or GARDEN_READERS names a lib/botanical.ts export that no " +
      "longer exists — update the list (every name in FOREIGN_WRITERS is " +
      "expected to be absent here; those live outside lib/botanical.ts, and " +
      "are reconciled against their own modules by FOREIGN_MODULES below)",
  );
});

test("FOREIGN_MODULES classifies every export of the three foreign writer modules", () => {
  for (const mod of FOREIGN_MODULES) {
    const text = readFileSync(join(process.cwd(), mod.path), "utf8");
    const exported = new Set(
      [...text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
    );
    const classified = new Set([...mod.writers, ...mod.readers]);

    const unclassified = [...exported].filter((n) => !classified.has(n)).sort();
    assert.deepEqual(
      unclassified,
      [],
      `${mod.path} exports a function that FOREIGN_MODULES classifies as ` +
        "neither a writer nor a reader — classify it (a writer needs adding " +
        "to FOREIGN_MODULES' entry AND to GARDEN_WRITERS/FOREIGN_WRITERS, and " +
        "every app/ caller needs revalidateGarden())",
    );

    const stale = [...classified].filter((n) => !exported.has(n)).sort();
    assert.deepEqual(
      stale,
      [],
      `FOREIGN_MODULES names an export of ${mod.path} that no longer exists — update the entry`,
    );
  }

  // The two hand-maintained lists could each be internally consistent (every
  // module's own exports fully classified above) while still drifting apart
  // from EACH OTHER — a writer added to a module's entry here but forgotten
  // in FOREIGN_WRITERS would satisfy every assertion above and still leave
  // the whole-file and per-function checks blind to it.
  const moduleWriters = new Set(FOREIGN_MODULES.flatMap((m) => [...m.writers]));
  const missingFromForeignWriters = [...moduleWriters].filter((n) => !FOREIGN_WRITERS.has(n)).sort();
  assert.deepEqual(
    missingFromForeignWriters,
    [],
    "FOREIGN_MODULES lists a writer that FOREIGN_WRITERS (and so GARDEN_WRITERS) " +
      "does not — add it there too, or the writer/invalidate checks above never see it",
  );

  const notAModuleWriter = [...FOREIGN_WRITERS].filter(
    (n) => !moduleWriters.has(n) && n !== "runSync",
  );
  assert.deepEqual(
    notAModuleWriter,
    [],
    "FOREIGN_WRITERS names something that is neither runSync (lib/pollen-run.ts, " +
      "the one foreign writer with no module entry — it has nothing else to " +
      "reconcile) nor a writer any FOREIGN_MODULES entry claims — check it is " +
      "still a real export of the module it is supposed to live in",
  );
});

test("no revalidatePath survives anywhere in app/, lib/ or components/", () => {
  const files = [APP, LIB, COMPONENTS].flatMap(sourceFiles).map((path) => ({
    path: relative(process.cwd(), path),
    text: readFileSync(path, "utf8"),
  }));

  const offenders = files
    // This file's own assertion messages contain the literal string
    // "revalidatePath" (this one included) — without excluding it by path,
    // this test would fail against itself the moment it was written.
    .filter((f) => f.path !== THIS_FILE && f.text.includes("revalidatePath"))
    .map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    "revalidatePath invalidated nothing here (every page is force-dynamic) — " +
      "its return means someone reasoned from the pre-cache model",
  );
});
