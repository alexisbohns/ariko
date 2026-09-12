import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  "app/admin/_components/sprout-delete-form.tsx",
];

const RAIL_PAGES = ["app/admin/(chrome)/sprout/[slug]/page.tsx"];

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test(`${ENTITY_RAIL} imports no server action and no module that would let it compose a payload`, () => {
  const text = source(ENTITY_RAIL);
  for (const spec of ["../actions", "@/app/admin/actions", "@/lib/data", "@/lib/botanical"]) {
    assert.ok(
      !text.includes(`from "${spec}"`) && !text.includes(`from '${spec}'`),
      `${ENTITY_RAIL} must not import from "${spec}" — its panels are ` +
        `server-rendered by the page and handed down, which is what keeps the ` +
        `island from being able to compose a write (including the delete)`,
    );
  }
});

test(`${ENTITY_RAIL} names no form field`, () => {
  // The cheap half of the same rule. A field name appearing here is the first
  // symptom of a payload being assembled client-side.
  const text = source(ENTITY_RAIL);
  for (const field of ["\"slug\"", "\"confirm\"", "\"media\"", "\"state\""]) {
    assert.ok(
      !text.includes(field),
      `${ENTITY_RAIL} must not name the form field ${field}`,
    );
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
