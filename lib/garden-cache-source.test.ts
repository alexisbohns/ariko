import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The rules that make the garden cache a cache rather than a decoration, and
 * that keep it off the write path.
 *
 * `lib/server-safe-source.test.ts`'s reasoning, applied to a different
 * invariant: every violation below passes `tsc`, `npm test` and
 * `npm run build`, and three of the four are invisible in development, where
 * Mongo is local and fast.
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
 *  - A public page reading the LIVE garden is the quiet one: it is correct in
 *    every sense except the one this slice exists for, and nothing about it
 *    looks wrong locally.
 *
 * Source text rather than a render or a call, for this file's whole subject:
 * "which function does this module import" is a property of the file as
 * written, and neither `renderToStaticMarkup` nor a unit test can see it.
 *
 * ADDING A WRITER HERE IS THE CHEAP HALF. A new write export in
 * `lib/botanical.ts` belongs in GARDEN_WRITERS on the day it is written.
 */

const APP = join(process.cwd(), "app");

/**
 * The WRITE exports reachable from `app/`. Readers are deliberately absent:
 * `lib/botanical.ts` also exports `getSprout`, `getScreen` and `listPlants`,
 * which pages import legitimately and which invalidate nothing.
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
  "deleteVersion",
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
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
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
  const names = new Set<string>();
  for (const m of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const FILES = sourceFiles(APP).map((path) => ({
  path: relative(process.cwd(), path),
  text: readFileSync(path, "utf8"),
}));

test("every file under app/ that imports a garden writer also invalidates the garden", () => {
  const offenders = FILES.filter(
    (f) =>
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

test("the four write doors are all still here", () => {
  // The converse of the test above, which passes vacuously if someone deletes
  // a door's writer import along with its invalidation.
  const doors = FILES.filter((f) => f.text.includes("revalidateGarden(")).map((f) => f.path);
  assert.deepEqual(doors.sort(), [
    "app/admin/actions.ts",
    "app/api/articles/route.ts",
    "app/api/pollen/sync/route.ts",
    "app/api/synthesis/route.ts",
  ]);
});

test("the write path reads the LIVE garden, never the cached one", () => {
  const actions = FILES.find((f) => f.path === "app/admin/actions.ts");
  assert.ok(actions, "app/admin/actions.ts must exist");
  assert.ok(
    importedNames(actions.text).has("loadRawGarden"),
    "app/admin/actions.ts must read the live garden",
  );
  assert.equal(
    importedNames(actions.text).has("loadCachedGarden"),
    false,
    "app/admin/actions.ts must NOT read the cached garden — editVersionAction " +
      "and promoteSeedAction re-read after writing so publishCascade sees the " +
      "just-saved state, and a cached read there publishes the wrong parents",
  );
});

test("the public zone reads the CACHED garden, never the live one", () => {
  const offenders = FILES.filter(
    (f) =>
      (f.path.startsWith("app/(public)/") || f.path === "app/api/graph/route.ts") &&
      importedNames(f.text).has("loadRawGarden"),
  ).map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    "these public files bypass the cache and hit Mongo on every request",
  );
});

test("no revalidatePath survives anywhere under app/", () => {
  const offenders = FILES.filter((f) => f.text.includes("revalidatePath")).map((f) => f.path);
  assert.deepEqual(
    offenders,
    [],
    "revalidatePath invalidated nothing here (every page is force-dynamic) — " +
      "its return means someone reasoned from the pre-cache model",
  );
});
