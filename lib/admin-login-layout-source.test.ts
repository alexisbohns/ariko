import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **No layout that wraps `/admin/login` may read the garden.**
 *
 * This is a privacy rule, not a performance one, and the difference is the
 * whole reason it is pinned here rather than left to a docblock.
 *
 * WHAT HAPPENED. `app/admin/layout.tsx` read the live garden to compose the
 * plant switcher's marks — slug, name, Cloudinary logo URL, visibility — and
 * handed the finished array to `AdminChrome`, which is `"use client"`. The
 * chrome withdrew on the login page with an early `if (pathname === BARE)
 * return null`, and its docblock claimed the login page "pays for a read it
 * discards".
 *
 * It did not discard it. It published it. **Props to a client component are
 * serialized into the RSC flight payload and inlined into the HTML document
 * before the component is ever called**, so `return null` suppresses the
 * MARKUP and nothing else. `middleware.ts` lets `/admin/login` through
 * unauthenticated, which made an anonymous `GET /admin/login` return all
 * twelve plants — including the one marked `private` — logo URLs and all,
 * to anybody who ran `curl` on the front door.
 *
 * Every check in this repo passed while that was true. `tsc` passes: a plain
 * array is a valid prop. `npm test` passed: nothing rendered the layout.
 * `npm run build` passes: this is ordinary, correct Next. And the page LOOKED
 * right — a login card on an empty ground, no chrome in sight. The only way to
 * see it was to read the bytes.
 *
 * WHAT FIXES IT is structure, not a conditional: `app/admin/(chrome)/` holds
 * every admin route except `login`, so the read happens in a layout the
 * anonymous route never enters. A route group is invisible to the URL, so
 * nothing about `/admin/…` or `middleware.ts`'s matcher changed.
 *
 * WHY THIS TEST IS STRUCTURAL. Asserting "no plant slug appears in the login
 * page's HTML" would pin the symptom: it passes the moment someone renames a
 * field, and it needs a garden to render against. The property is about the
 * ROUTE TREE — which layouts wrap this page — and about the import graph of
 * those layouts, and neither is anything a render can observe. That is
 * `lib/server-safe-source.test.ts`'s argument, applied to a directory
 * structure rather than to a directive.
 *
 * The two ways back in, both silent, both caught below:
 *
 *  - Someone moves `login/` inside `(chrome)/` — tidying the one straggler
 *    left at `app/admin/`. The URL does not change, the page renders, and the
 *    leak is back in full.
 *  - Someone adds a layout at `app/admin/` (or at `app/`) and gives it a
 *    garden read — a "shared admin shell", a preloaded nav. It wraps the login
 *    page by construction, and any client component it feeds leaks the same
 *    way.
 */

const APP = "app";
const LOGIN_ROUTE = "/admin/login";

/** The garden's readers, and the modules they live in. `lib/data.ts` is here
 *  because `getFullDataset` skips `filterPublic` on the way through — see
 *  CLAUDE.md's note on which reader you import being a privacy decision. */
const GARDEN_MODULES = ["lib/store", "lib/garden-cache", "lib/data", "lib/seeds"];
const GARDEN_READERS = /\b(loadRawGarden|loadCachedGarden|getFullDataset|listSeeds)\b/;

/** A file's CODE — comments removed, for `lib/screen-sheet-source.test.ts`'s
 *  reason: this file's own prose names every symbol it forbids, and so does
 *  the layout it checks. */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** A directory segment Next erases from the URL: a `(group)` or a `@slot`. */
function isInvisible(segment: string): boolean {
  return (/^\(.+\)$/.test(segment) && segment !== "(.)") || segment.startsWith("@");
}

/** The URL a directory under `app/` serves, groups and slots removed. */
function routePath(segments: readonly string[]): string {
  return `/${segments.filter((s) => !isInvisible(s)).join("/")}`;
}

const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js"];
const LAYOUT_FILES = ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"];

/** Every directory under `app/` that holds a `page`, with its route and its
 *  path on disk. Walked rather than listed: the file that breaks this rule is
 *  one that does not exist yet. */
function pageDirs(dir = APP, segments: string[] = []): { route: string; dir: string }[] {
  const entries = readdirSync(join(process.cwd(), dir), { withFileTypes: true });
  const here = entries.some((e) => e.isFile() && PAGE_FILES.includes(e.name))
    ? [{ route: routePath(segments), dir }]
    : [];
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .reduce(
      (found, e) => found.concat(pageDirs(`${dir}/${e.name}`, [...segments, e.name])),
      here,
    );
}

/** Every layout that wraps a page directory, innermost first — the chain Next
 *  actually composes, which is simply every ancestor directory up to `app/`. */
function layoutsWrapping(dir: string): string[] {
  const parts = dir.split("/");
  const found: string[] = [];
  for (let i = parts.length; i >= 1; i--) {
    const at = parts.slice(0, i).join("/");
    for (const name of LAYOUT_FILES) {
      if (existsSync(join(process.cwd(), at, name))) found.push(`${at}/${name}`);
    }
  }
  return found;
}

/** Whether a file reads the garden, by import and by identifier. The second
 *  half catches a re-export dressed up as something else. */
function readsGarden(path: string): boolean {
  const text = source(path);
  const imported = GARDEN_MODULES.some((module) =>
    new RegExp(`from\\s+["'][^"']*${module}["']`).test(text),
  );
  return imported || GARDEN_READERS.test(text);
}

function loginDir(): string {
  const matches = pageDirs().filter((page) => page.route === LOGIN_ROUTE);
  assert.equal(
    matches.length,
    1,
    `exactly one page must serve ${LOGIN_ROUTE}; found ${matches.length}` +
      ` (${matches.map((m) => m.dir).join(", ") || "none"})`,
  );
  return matches[0]!.dir;
}

test(`no layout wrapping ${LOGIN_ROUTE} reads the garden`, () => {
  const wrapping = layoutsWrapping(loginDir());

  // The walk itself, checked: an empty chain would pass the loop below while
  // asserting nothing, and the root layout is always in it.
  assert.ok(
    wrapping.includes("app/layout.tsx"),
    `the ancestor walk missed app/layout.tsx — it wraps every page`,
  );

  for (const layout of wrapping) {
    assert.equal(
      readsGarden(layout),
      false,
      `${layout} wraps ${LOGIN_ROUTE} and reads the garden. That page is the ` +
        `one route middleware.ts lets through unauthenticated, and a layout's ` +
        `read does not stay on the server: anything handed to a client ` +
        `component from here is serialized into the flight payload and inlined ` +
        `in the HTML before that component runs, so a chrome that withdraws ` +
        `visually still publishes its props. Put the read in a layout under ` +
        `app/admin/(chrome)/, which the login page does not enter.`,
    );
  }
});

test("the login page sits outside the chrome group", () => {
  const dir = loginDir();
  assert.equal(
    dir.split("/").some(isInvisible),
    false,
    `${dir} must not sit inside a route group: the groups under app/admin/ ` +
      `exist to give the chrome a layout, and that layout reads the garden`,
  );
});

/**
 * The anti-vacuity check, and the reason it is worth its own test: every
 * assertion above is a negative. If `readsGarden` stopped recognising a garden
 * read — a renamed module, a reader reached through a new barrel — the two
 * tests above would pass on a codebase that had regressed completely.
 *
 * So: the layout that DOES read the garden must still be detected as reading
 * it, and must still be one the login page never reaches.
 */
test("the chrome layout still reads the garden, and still does not wrap login", () => {
  const CHROME_LAYOUT = "app/admin/(chrome)/layout.tsx";
  assert.ok(
    existsSync(join(process.cwd(), CHROME_LAYOUT)),
    `${CHROME_LAYOUT} must exist — it is where the admin's garden read belongs`,
  );
  assert.ok(
    readsGarden(CHROME_LAYOUT),
    `${CHROME_LAYOUT} must read the garden — if it no longer does, this file's ` +
      `detection has gone blind and the tests above are asserting nothing`,
  );
  assert.equal(
    layoutsWrapping(loginDir()).includes(CHROME_LAYOUT),
    false,
    `${CHROME_LAYOUT} must not wrap ${LOGIN_ROUTE}`,
  );
});
