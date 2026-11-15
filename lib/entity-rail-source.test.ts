import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The claim `entity-rail.tsx`'s docblock rests on, enforced rather than written
 * down: the rail is a SHELL. Its panels' contents are server-rendered by the
 * page and arrive as `ReactNode`s, exactly as `ExhibitionPanel` arrives at
 * `PlantRail` and as `metaForm` arrives at `SproutHero`, so the island learns
 * no field name and builds no payload.
 *
 * `lib/exhibition-panel-source.test.ts` is the same test for the plant's rail
 * and carries the long form of why each way of breaking it is silent. The short
 * form: a server action imported into a client component is legal Next and
 * becomes an RPC, so `tsc`, `npm test` and `npm run build` all pass while the
 * island acquires the ability to compose a write of its own — including the
 * media write, whose `__ready` marker exists precisely because an empty media
 * list is indistinguishable from a deliberate clear-all.
 *
 * This one matters more than its sibling, because this rail carries a DELETE.
 * Which is why the PANELS are pinned here too, and not only the shell: the
 * sentence above is about a specific panel, and that panel being server-rendered
 * is half of what it claims. `"use client"` on one of them — for a typed
 * confirmation, a `useFormStatus` spinner — passes `tsc`, `eslint`, `npm test`
 * and `npm run build`, keeps submitting, and quietly turns `deleteSproutAction`
 * into an RPC a client module holds a reference to. `RAIL_PANELS` is a list
 * rather than a constant because the bean, pod and plant deletes are the same
 * component with a different noun and join it as they land.
 *
 * RAIL_PAGES pins the other direction, and it is the one failure in this file
 * that NOTHING else reports. `RailItem.icon` is a `ComponentType` handed to a
 * client component, and an entity page is a server one, so an icon imported
 * straight from `lucide-react` goes into the flight payload as a bare function
 * and React refuses to serialize it. Every page that uses the rail is
 * `force-dynamic`, so `next build` never renders one — `tsc`, `eslint`,
 * `npm test` AND `npm run build` all pass on a page that 500s on every single
 * request. `app/admin/_components/rail-icons.ts` is the boundary that makes the
 * icons client references; this test is what keeps a page from reaching past
 * it, including the three entity pages queued behind the sprout, whose authors
 * will copy a shape rather than a stack trace.
 */

const ENTITY_RAIL = "app/admin/_components/entity-rail.tsx";

const RAIL_PANELS = [
  "app/admin/_components/sprout-media-form.tsx",
  "app/admin/_components/sprout-about-form.tsx",
  "app/admin/_components/sprout-delete-form.tsx",
];

const RAIL_PAGES = [
  "app/admin/(chrome)/sprout/[slug]/page.tsx",
  "app/admin/(chrome)/bean/[id]/page.tsx",
  // Rails with no items, there to host the staging blocks' panel (§11).
  "app/admin/(chrome)/plant/[slug]/narrative/page.tsx",
  "app/admin/(chrome)/pod/[slug]/page.tsx",
];

// The page-panel door (spec 2026-11-15 §11): what something inside the page
// may hand the rail.
const RAIL_PANEL = "app/admin/_components/rail-panel.tsx";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

for (const file of [ENTITY_RAIL, RAIL_PANEL])
test(`${file} imports no server action and no module that would let it compose a payload`, () => {
  const text = source(file);
  for (const spec of ["../actions", "@/app/admin/actions", "@/lib/data", "@/lib/botanical"]) {
    assert.ok(
      !text.includes(`from "${spec}"`) && !text.includes(`from '${spec}'`),
      `${file} must not import from "${spec}" — its panels are ` +
        `server-rendered by the page and handed down, which is what keeps the ` +
        `island from being able to compose a write (including the delete)`,
    );
  }
});

for (const file of [ENTITY_RAIL, RAIL_PANEL])
test(`${file} names no form field`, () => {
  // The cheap half of the same rule. A field name appearing here is the first
  // symptom of a payload being assembled client-side.
  const text = source(file);
  for (const field of ["\"slug\"", "\"confirm\"", "\"media\"", "\"state\"", "\"src\"", "\"by\"", "\"label\""]) {
    assert.ok(
      !text.includes(field),
      `${file} must not name the form field ${field}`,
    );
  }
});

test(`${RAIL_PANEL}'s page panel carries a title, a node and a focus target, and its API an id and two verbs — nothing a payload is built from`, () => {
  // The page panel is the door a CLIENT component opens, at run time, so the
  // "server-rendered and handed down" half of this file's rule cannot hold for
  // its content. What can hold is the shape: the rail receives an opaque
  // ReactNode and the things a shell needs to draw and dismiss it. A field
  // added here — an `onSave`, a `value`, a `fields` — is the shell starting
  // to know what is inside it.
  const text = source(RAIL_PANEL);
  const body = /export interface PagePanel \{([\s\S]*?)\n\}/.exec(text)?.[1];
  assert.ok(body, "PagePanel is declared");
  const keys = [...body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ["id", "title", "content", "returnFocus", "onClose"]);
  assert.match(text, /content: ReactNode;/);
  // And the API the rail hands back: state, the panel's DOM id for an
  // opener's aria-controls, and the two verbs. Nothing an opener could post.
  const api = /export interface RailPanelApi \{([\s\S]*?)\n\}/.exec(text)?.[1];
  assert.ok(api, "RailPanelApi is declared");
  const apiKeys = [...api.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
  assert.deepEqual(apiKeys, ["openId", "panelId", "open", "close"]);
  // It imports React and nothing else: the editor's node views import it, and
  // lib/editor.test.ts builds them headless.
  const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["react"]);
});

test(`${ENTITY_RAIL} unmounts a page panel on close and keeps rail panels mounted`, () => {
  // Both halves of §11's "a page panel is not kept mounted". Rail panels are
  // mapped unconditionally and go inert (the media picker's upload-before-Save
  // argument); the page panel renders only while `page` is set, which is what
  // discards a staging form's draft. Flip either and every check passes.
  const text = source(ENTITY_RAIL);
  assert.match(text, /\{page \? \(\s*<PanelShell/, "the page panel is conditional on being open");
  assert.match(text, /items\.map\(\(item\) => \(\s*<PanelShell/, "rail panels are always rendered");
  assert.match(text, /inert=\{!open\}/);
  // One shell for both — the look is literally the same code.
  assert.equal(text.match(/<aside\b/g)?.length, 1, "one <aside>, inside PanelShell");
});

/** Every file under `dir`, recursively, as repo-relative paths. */
function walk(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? walk(path) : [relative(".", path)];
  });
}

test("every admin page that renders the prose editor renders EntityRail around it", () => {
  // The staging blocks open their forms in the rail's panel (§11). A page with
  // the editor and no rail draws every figure, gallery, callout and quote with
  // no way to edit them — `useRailPanel()` returns null and the trigger is
  // inert — and nothing else fails: `tsc`, `npm test` and `npm run build`
  // all pass.
  const files = walk("app").filter((f) => f.endsWith(".tsx"));
  const renders = (f: string, name: string) => new RegExp(`<${name}\\b`).test(source(f));
  // The editor reaches a page directly or through ContentCard, and nothing
  // else. A third wrapper would be a page this test cannot see, so it fails
  // here until it is added to the line below.
  const wrappers = files.filter((f) => !f.endsWith("/page.tsx") && renders(f, "ProseEditor"));
  assert.deepEqual(wrappers, ["app/admin/_components/content-card.tsx"]);
  const pages = files.filter((f) => f.endsWith("/page.tsx") && (renders(f, "ProseEditor") || renders(f, "ContentCard")));
  assert.deepEqual([...pages].sort(), [...RAIL_PAGES].sort(), "the pages hosting the editor are exactly RAIL_PAGES");
  for (const page of pages) {
    assert.ok(renders(page, "EntityRail"), `${page} renders the prose editor and must render <EntityRail>`);
  }
});

for (const panel of RAIL_PANELS) {
  test(`${panel} is not a client component`, () => {
    const text = source(panel);
    assert.ok(
      !/^\s*["']use client["']/m.test(text),
      `${panel} must not be a client component — it is handed to EntityRail as ` +
        `a ReactNode so the payload is composed server-side, which is the whole ` +
        `arrangement for the one write on that rail that cannot be undone`,
    );
  });
}

for (const page of RAIL_PAGES) {
  test(`${page} imports its rail icons across a client boundary`, () => {
    // The same regex lib/server-safe-source.test.ts uses, pointed at a
    // different rule: there it is about bundle weight in the public zone, here
    // it is about a payload that cannot be serialized at all.
    const text = source(page);
    assert.ok(
      !/from\s+["']lucide-react["']/.test(text),
      `${page} must not import lucide-react directly — it is a server ` +
        `component handing icons to the client EntityRail, and a bare icon ` +
        `function cannot cross that boundary. Import from ` +
        `app/admin/_components/rail-icons.ts, which carries "use client".`,
    );
  });
}

test("app/admin/_components/rail-icons.ts is the client boundary it claims to be", () => {
  // Without the directive the re-export is transparent and every page above
  // goes back to passing bare functions — the same 500, reached by a one-line
  // deletion in a file whose whole purpose is that line.
  const text = source("app/admin/_components/rail-icons.ts");
  assert.ok(
    /^\s*["']use client["']/m.test(text),
    `rail-icons.ts must carry "use client" — it exists only to register ` +
      `lucide's icons as client references, and nothing else in the repo ` +
      `would report its absence before a request does`,
  );
});
