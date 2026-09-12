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
 */

const ENTITY_RAIL = "app/admin/_components/entity-rail.tsx";

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
