# Sprout Edition Page Harmonized — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/sprout/[slug]` so its fields live in its head (a title that opens an overlay; three icon triggers for state, date and type), its source/media/delete live on a right-edge rail behind a push panel, and the editor is the page's only body — with a floating commit that tells the truth about whether the document is saved.

**Architecture:** Four narrow server actions and four named-field Mongo writers replace one whole-record write. Two shells are extracted for the three entities queued behind this one: an optional `mark` on the already-shared `components/plant-header.tsx`, and a new `app/admin/_components/entity-rail.tsx` that owns a chrome cluster, a push panel and the page translate, and learns no field name. The head is a client island in `plant-hero.tsx`'s shape; every form it opens is server-rendered by the page and handed down as a prop.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript, MongoDB, Tailwind v4, shadcn on Base UI, Tiptap, `node:test` + `tsx`.

**Design spec:** [`docs/superpowers/specs/2026-09-12-sprout-edition-harmonized-design.md`](../specs/2026-09-12-sprout-edition-harmonized-design.md) — read it before Task 1. Every "why" below is short because the spec carries the long form.

---

## Ground rules for every task

- **Branch:** `sprout-edition-harmonized` (already created; the spec is its first commit). Never commit to `main`.
- **Test command:** `npm test` runs the whole pure suite. A single file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/<file>.test.ts`
- **DB-backed tests** are a separate runner and are NOT part of `npm test`: `npm run test:db`. Only Task 5 touches one.
- **Every commit must be green.** The tasks are ordered additive-first (new actions and writers land beside the old ones) and the dead whole-form path is removed only in Task 14, after the page has stopped calling it. Do not reorder.
- **Commit message attribution.** End every commit message with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **House style.** This repo writes long explanatory docblocks that say *why*, not *what*. Match the files you are editing. A comment that restates the code is worse than no comment; a comment recording a trap is the point.

---

## File structure

**New files**

| Path | Responsibility |
|---|---|
| `lib/sprout-state.ts` | The three-member state vocabulary. Pure, client-safe (no `lib/data.ts` value import). |
| `lib/sprout-state.test.ts` | Pins the vocabulary and `stateOf`'s absent-⇒-draft default. |
| `lib/sprout-meta.ts` | `buildSproutMetaPatch` — the pure form→patch seam for name + description. |
| `lib/sprout-meta.test.ts` | Pins the builder and the blank-name throw. |
| `app/admin/_components/sprout-meta-form.tsx` | Server component. The four bilingual fields, posting to `editSproutMetaAction`. |
| `app/admin/_components/sprout-delete-form.tsx` | Server component. Confirm checkbox + destructive submit, posting to `deleteSproutAction`. |
| `app/admin/_components/sprout-hero.tsx` | Client island. Title→overlay, three fact triggers, `saved` fingerprint, `?form=` reopen. |
| `app/admin/_components/entity-rail.tsx` | Client island. Chrome cluster + push panel + page translate. Shell only — no field names. |
| `lib/sprout-hero-a11y.test.ts` | Pins that each trigger's accessible name states its stored value. |
| `lib/entity-rail-source.test.ts` | Pins that the rail composes no payload. |

**Modified files**

| Path | Change |
|---|---|
| `lib/sprouts.ts` | `STATES` imported from `lib/sprout-state.ts` instead of declared. |
| `lib/glyphs.ts` | `sproutStateLabel`. |
| `lib/glyphs.test.ts` | Sprout state label cases. |
| `components/admin/glyphs.tsx` | `SPROUT_STATE_ICONS`, `SproutStateGlyph`. |
| `components/admin/glyphs.test.tsx` | Sprout state glyph cases. |
| `app/admin/_components/sprout-table.tsx` | `<Badge>` → `<SproutStateGlyph>`. |
| `lib/botanical.ts` | Four narrow writers in; `deleteVersion`→`deleteSprout`; `updateVersion` out (Task 14). |
| `lib/botanical.test.ts` | `deleteVersion`→`deleteSprout`. |
| `lib/garden-cache-source.test.ts` | `GARDEN_WRITERS` reconciled; one stale message string. |
| `app/admin/actions.ts` | Four actions in; `deleteVersionAction`→`deleteSproutAction`; `editVersionAction` out (Task 14). |
| `lib/sprout-edit.ts` | Down to `shouldCascadePublish` (Task 14). |
| `lib/sprout-edit.test.ts` | Down to the `shouldCascadePublish` case (Task 14). |
| `components/plant-header.tsx` | `mark` becomes optional. |
| `lib/server-safe-source.test.ts` | `components/plant-header.tsx` added to `SERVER_SAFE`. |
| `components/editor/prose-editor.tsx` | `float` prop; debounced dirty signal; four appearances. |
| `app/admin/(chrome)/sprout/[slug]/page.tsx` | Rewritten. |
| `lib/media-picker-mount.test.ts` | Stale path in a comment. |
| `CLAUDE.md` | Two invariants extended, one added. |

---

## Task 1: The state vocabulary

**Files:**
- Create: `lib/sprout-state.ts`
- Create: `lib/sprout-state.test.ts`
- Modify: `lib/sprouts.ts` (its `const STATES` line)

- [ ] **Step 1: Write the failing test**

Create `lib/sprout-state.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPROUT_STATES, stateOf, isSproutState } from "./sprout-state";

test("SPROUT_STATES is the vocabulary, in render order", () => {
  assert.deepEqual([...SPROUT_STATES], ["draft", "private", "published"]);
});

test("stateOf reads an absent state as draft", () => {
  // lib/data.ts declares `state?: SproutState` with "absent => NOT published
  // (safe default)", and filterPublic requires state === "published". Draft is
  // the reading every other surface already takes; this is the one place it is
  // written down.
  assert.equal(stateOf({}), "draft");
  assert.equal(stateOf({ state: undefined }), "draft");
});

test("stateOf returns a stored state unchanged", () => {
  assert.equal(stateOf({ state: "private" }), "private");
  assert.equal(stateOf({ state: "published" }), "published");
  assert.equal(stateOf({ state: "draft" }), "draft");
});

test("isSproutState accepts every member and nothing else", () => {
  for (const s of SPROUT_STATES) assert.equal(isSproutState(s), true);
  assert.equal(isSproutState("bogus"), false);
  assert.equal(isSproutState(""), false);
  assert.equal(isSproutState("PUBLISHED"), false);
});

test("lib/sprout-state.ts imports nothing that reaches node:", async () => {
  // The whole reason this module exists rather than an export on
  // lib/sprouts.ts: the state popover is inside a client island, and
  // lib/sprouts.ts imports resolveText as a VALUE from lib/data.ts, which
  // opens with node:fs. A value import added here would fail `npm run build`
  // with UnhandledSchemeError and nothing earlier would notice.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/sprout-state.ts", "utf8");
  assert.equal(
    /^import\s+(?!type\b)/m.test(source),
    false,
    "lib/sprout-state.ts must import only types — see lib/section-keys.ts",
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/sprout-state.test.ts`
Expected: FAIL — `Cannot find module './sprout-state'`.

- [ ] **Step 3: Write the module**

Create `lib/sprout-state.ts`:

```ts
import type { Sprout, SproutState } from "./data";

/**
 * A sprout's state as a vocabulary — the sibling of `lib/plant-status.ts` and
 * `lib/plant-visibility.ts`, written when the sprout's head grew a state
 * control of its own.
 *
 * **This module is client-safe, and that is why it is a module.** The state
 * popover lives in `app/admin/_components/sprout-hero.tsx`, a client island.
 * `lib/sprouts.ts` — where this list used to live — imports `resolveText` as a
 * VALUE from `lib/data.ts`, which opens with `node:fs`, so importing the
 * vocabulary from there would fail `npm run build` with
 * `UnhandledSchemeError` four modules downstream of three strings. That is the
 * `lib/palette.ts` / `lib/palette-items.ts` split and then the
 * `lib/section-keys.ts` one; this is the third time the boundary has bitten
 * and the third time the fix is a client-safe module beside the server one.
 * Everything here is `import type`, which is erased at compile time.
 *
 * The WORDS are not here. `sproutStateLabel` lives in `lib/glyphs.ts`, which is
 * the one place a display form is decided for a value the admin draws — the
 * same split `lib/plant-visibility.ts` makes against `visibilityLabel`.
 */
export const SPROUT_STATES: readonly SproutState[] = ["draft", "private", "published"];

/**
 * The one place absence becomes a value, exactly as `statusOf` is for a plant's
 * status. `Sprout.state` is optional and `lib/data.ts` records the rule as
 * "absent => NOT published (safe default)"; `filterPublic` reads it as
 * `state === "published"`, so the safe default has a name, and the name is
 * `draft`.
 */
export function stateOf(sprout: Pick<Sprout, "state">): SproutState {
  return sprout.state ?? "draft";
}

export function isSproutState(raw: string): raw is SproutState {
  return (SPROUT_STATES as readonly string[]).includes(raw);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/sprout-state.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Rewire `lib/sprouts.ts` to the one list**

In `lib/sprouts.ts`, delete line 4:

```ts
const STATES: SproutState[] = ["draft", "private", "published"];
```

and replace the existing import block at the top of the file so it reads:

```ts
import { resolveText, type TimelineEntry, type SproutState } from "./data";
import { SPROUT_STATES } from "./sprout-state";
```

Then, in `filterSproutEntries`, change the one use:

```ts
  const state = SPROUT_STATES.includes(filters.state as SproutState) ? (filters.state as SproutState) : undefined;
```

Two lists that agree today are two lists that disagree tomorrow; this leaves one.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. If `lib/sprouts.test.ts` fails, the edit to `filterSproutEntries` changed behaviour — it must not; re-read step 5.

- [ ] **Step 7: Commit**

```bash
git add lib/sprout-state.ts lib/sprout-state.test.ts lib/sprouts.ts
git commit -m "$(cat <<'EOF'
A sprout's state becomes a vocabulary

lib/sprout-state.ts, client-safe by construction (type imports only) because
the head's state popover is an island and lib/sprouts.ts is four hops from
node:fs. lib/sprouts.ts's own STATES array is deleted and imported from here,
so there is one list rather than two that agree today.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: The state's words

**Files:**
- Modify: `lib/glyphs.ts`
- Test: `lib/glyphs.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/glyphs.test.ts`:

```ts
test("sproutStateLabel gives one display form per member", () => {
  assert.equal(sproutStateLabel("draft"), "Draft");
  assert.equal(sproutStateLabel("private"), "Private");
  assert.equal(sproutStateLabel("published"), "Published");
});

test("sproutStateLabel and visibilityLabel agree on the word they share", () => {
  // A sprout's `private` means what a plant's `private` means. Two display
  // forms for one concept is a drift nobody sees, because each surface reads
  // correctly on its own.
  assert.equal(sproutStateLabel("private"), visibilityLabel("private"));
});
```

Extend that file's existing import from `./glyphs` to include `sproutStateLabel` and `visibilityLabel` (check what it already imports; do not duplicate a name).

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/glyphs.test.ts`
Expected: FAIL — `sproutStateLabel is not a function`.

- [ ] **Step 3: Add the labels**

In `lib/glyphs.ts`, change the type import on line 17 to bring in `SproutState`:

```ts
import type { SproutState, Visibility } from "./data";
```

and add, directly after `visibilityLabel`:

```ts
/**
 * A sprout's three states, in words.
 *
 * `Private` is deliberately the SAME word `visibilityLabel` gives — a sprout's
 * `private` means exactly what a plant's does, and spelling it "Hidden" here
 * would assert a distinction that does not exist. `Draft` is the one member
 * with no counterpart in the visibility vocabulary, which is the honest reading
 * of it: not a privacy setting, a stage before one.
 */
const SPROUT_STATE_LABELS: Record<SproutState, string> = {
  draft: "Draft",
  private: "Private",
  published: "Published",
};

export function sproutStateLabel(state: SproutState): string {
  return SPROUT_STATE_LABELS[state];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/glyphs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/glyphs.ts lib/glyphs.test.ts
git commit -m "$(cat <<'EOF'
The sprout state gets its words

One display form per member, in the one file where a display form is decided,
and `Private` is the same string visibilityLabel gives because it is the same
concept.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: The state's glyph, and the sprouts table

**Files:**
- Modify: `components/admin/glyphs.tsx`
- Modify: `app/admin/_components/sprout-table.tsx`
- Test: `components/admin/glyphs.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `components/admin/glyphs.test.tsx` (follow the file's existing render helper and import style — read it first):

```tsx
test("every sprout state draws its word in the accessibility tree", async () => {
  const { SproutStateGlyph } = await import("./glyphs");
  for (const [state, word] of [
    ["draft", "Draft"],
    ["private", "Private"],
    ["published", "Published"],
  ] as const) {
    const html = await render(<SproutStateGlyph state={state} />);
    assert.ok(
      html.includes(word),
      `the ${state} glyph must carry the word "${word}" — no value is ever icon-only`,
    );
  }
});

test("SPROUT_STATE_ICONS covers the vocabulary and nothing else", async () => {
  const { SPROUT_STATE_ICONS } = await import("./glyphs");
  const { SPROUT_STATES } = await import("@/lib/sprout-state");
  assert.deepEqual(Object.keys(SPROUT_STATE_ICONS).sort(), [...SPROUT_STATES].sort());
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/admin/glyphs.test.tsx`
Expected: FAIL — `SproutStateGlyph is not a function`.

- [ ] **Step 3: Add the map and the glyph**

In `components/admin/glyphs.tsx`, add `PencilLine` to the existing `lucide-react` import (`Globe` and `Lock` are already imported for `VisibilityGlyph`), import the label and the type, and add after `StatusGlyph`:

```tsx
/**
 * A sprout's state, drawn — and two thirds of it are `VisibilityGlyph`'s own
 * icons, taken deliberately rather than by coincidence.
 *
 * A sprout's state IS its visibility plus a stage before it: `private` on a
 * sprout means what `private` on a plant means, and `published` is what puts it
 * on the public site. Drawing either differently would assert a distinction
 * that does not exist. `PencilLine` is the only new mark, and it is the only
 * member with no counterpart in the visibility vocabulary — which is the
 * honest reading of draft.
 *
 * EXPORTED, and that is the point of it, exactly as `PLANT_STATUS_ICONS` is:
 * `sprout-hero.tsx`'s state trigger imports this map rather than picking the
 * same three lucide names again, so the icon on the head is the icon on the row
 * that links to it. `plant-hero.tsx` records what happens when that is a
 * comment instead of an import.
 */
export const SPROUT_STATE_ICONS: Record<SproutState, ComponentType<{ className?: string }>> = {
  draft: PencilLine,
  private: Lock,
  published: Globe,
};

/**
 * Tone follows `StatusGlyph`'s rule — a lit glyph reads as live — rather than
 * `VisibilityGlyph`'s emphasis-on-the-exception: for a sprout, `published` is
 * the consequential state rather than the unusual one, and `draft` is the
 * at-rest default that should not compete for attention.
 */
export function SproutStateGlyph({ state }: { state: SproutState }) {
  return (
    <IconGlyph
      icon={SPROUT_STATE_ICONS[state]}
      label={sproutStateLabel(state)}
      className={
        state === "published"
          ? "text-primary hover:text-primary"
          : state === "private"
            ? "text-foreground"
            : undefined
      }
    />
  );
}
```

Add to the file's imports: `sproutStateLabel` from `@/lib/glyphs` (join the existing import) and `type SproutState` from `@/lib/data` (join the existing type import).

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/admin/glyphs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Draw the table's state column with it**

In `app/admin/_components/sprout-table.tsx`:

Remove the `Badge` import. Add:

```ts
import { SproutStateGlyph } from "@/components/admin/glyphs";
import { stateOf } from "@/lib/sprout-state";
```

Replace the state cell:

```tsx
            <TableCell>
              <Badge variant="secondary">{e.sprout.state ?? "—"}</Badge>
            </TableCell>
```

with:

```tsx
            <TableCell>
              {/* The glyph, not a word — and the same map the sprout's own head
                  draws from, so the row and the page it links to cannot show
                  one state as two things. `stateOf` is what turns an absent
                  state into the value every other surface already reads it as,
                  rather than an em dash that says "no state" about a sprout
                  that has one by default. */}
              <SproutStateGlyph state={stateOf(e.sprout)} />
            </TableCell>
```

- [ ] **Step 6: Run the table's source guard and the full suite**

Run: `npm test`
Expected: PASS, including `lib/admin-table-source.test.ts` — `sprout-table.tsx` must still be free of `"use client"`. It is: `glyphs.tsx` is the client module, and importing a client component from a server one is an ordinary boundary.

- [ ] **Step 7: Commit**

```bash
git add components/admin/glyphs.tsx components/admin/glyphs.test.tsx app/admin/_components/sprout-table.tsx
git commit -m "$(cat <<'EOF'
The sprout state, drawn

SPROUT_STATE_ICONS beside PLANT_STATUS_ICONS, and /admin/sprouts stops badging
the raw word. Exported so the head imports the table's map rather than picking
the same three lucide names again — the claim plant-hero.tsx could only make
as a comment until there was a map to import.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: The meta patch seam

**Files:**
- Create: `lib/sprout-meta.ts`
- Create: `lib/sprout-meta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/sprout-meta.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSproutMetaPatch, BlankSproutNameError } from "./sprout-meta";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("buildSproutMetaPatch maps and trims name and description", () => {
  const p = buildSproutMetaPatch(form([
    ["name", "  New name "],
    ["description", "  a note "],
  ]));
  assert.deepEqual(p, { name: "New name", description: "a note" });
});

test("buildSproutMetaPatch composes bilingual pairs", () => {
  const p = buildSproutMetaPatch(form([
    ["name", "New name"],
    ["nameFr", "Nouveau nom"],
    ["description", "a note"],
    ["descriptionFr", "une note"],
  ]));
  assert.deepEqual(p.name, { en: "New name", fr: "Nouveau nom" });
  assert.deepEqual(p.description, { en: "a note", fr: "une note" });
});

test("buildSproutMetaPatch keeps an fr-only field fr-only (no en borrowed)", () => {
  const p = buildSproutMetaPatch(form([["nameFr", "Nom"], ["descriptionFr", "note fr"]]));
  assert.deepEqual(p.name, { fr: "Nom" });
  assert.deepEqual(p.description, { fr: "note fr" });
});

test("buildSproutMetaPatch stores exactly \"\" when both description boxes are blank", () => {
  // Sprout.description is REQUIRED in lib/data.ts, unlike Plant.description —
  // so a cleared description is an empty string, never an omitted key and
  // never a $unset. The patch feeds a $set verbatim.
  const p = buildSproutMetaPatch(form([["name", "n"]]));
  assert.equal(p.description, "");
});

test("buildSproutMetaPatch throws when the name is blank in both languages", () => {
  assert.throws(() => buildSproutMetaPatch(form([["description", "d"]])), BlankSproutNameError);
  assert.throws(() => buildSproutMetaPatch(form([["name", "   "], ["nameFr", "  "]])), BlankSproutNameError);
});

test("BlankSproutNameError carries the message the author reads", () => {
  assert.equal(new BlankSproutNameError().message, "a sprout needs a name in at least one language");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/sprout-meta.test.ts`
Expected: FAIL — `Cannot find module './sprout-meta'`.

- [ ] **Step 3: Write the module**

Create `lib/sprout-meta.ts`:

```ts
import { composeText, type Text } from "./data";

/**
 * A sprout's identity fields — and nothing else.
 *
 * The sibling of `lib/plant-meta.ts`, with two deliberate differences that are
 * both about what the stored shape allows:
 *
 *  - There is no `$unset` half and therefore no pure `sproutMetaUpdate` beside
 *    this. `Sprout.description` is REQUIRED in `lib/data.ts`, unlike
 *    `Plant.description`, so a cleared description is the empty string rather
 *    than an instruction to remove a key. `plantMetaUpdate` exists because
 *    composing `$set` and `$unset` inline with a spread silently drops fields;
 *    there is no `$unset` here to compose with, so adding the missing half for
 *    symmetry would be adding the bug's cure to a body that cannot catch it.
 *
 *  - There is no `status` field riding along. The plant's meta form carries one
 *    as a hidden input because `buildPlantMetaPatch` reads an absent status as
 *    `active` and dropping it would reactivate an inactive plant on every name
 *    edit. This patch names two fields and the writer names the same two, so
 *    there is nothing for a missing input to default.
 *
 * `slug` is absent for `lib/plant-meta.ts`'s reason: it is what every
 * `parents[]` ref points at and what a promoted seed's `promotedTo` records, so
 * renaming it from a metadata form would orphan things with no cascade to catch
 * it. A slug change stays a manual, deliberate act.
 */
export interface SproutMetaPatch {
  name: Text;
  description: Text;
}

export class BlankSproutNameError extends Error {
  constructor() {
    super("a sprout needs a name in at least one language");
    this.name = "BlankSproutNameError";
  }
}

/**
 * Pure. Maps the meta overlay's form → the stored fields.
 *
 * The blank name throws rather than falling back, the stance
 * `buildPlantMetaPatch` takes and for the same reason: a nameless sprout is a
 * claim the admin's every table and the public bean page would then render as
 * though it had been authored. The action turns the throw into an `?error`
 * redirect.
 *
 * "Blank" means blank in BOTH languages. `composeText` returns `""` only when
 * neither half survives trimming, so an fr-only name passes — which is the B1
 * rule the paired inputs exist for.
 */
export function buildSproutMetaPatch(form: FormData): SproutMetaPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const name = composeText(get("name"), get("nameFr"));
  if (name === "") throw new BlankSproutNameError();

  return { name, description: composeText(get("description"), get("descriptionFr")) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/sprout-meta.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/sprout-meta.ts lib/sprout-meta.test.ts
git commit -m "$(cat <<'EOF'
The sprout's meta patch, as a pure seam

buildSproutMetaPatch beside buildPlantMetaPatch, minus the $unset half
(Sprout.description is required, so a blank is "" and never a removed key) and
minus the hidden status that the plant's form has to carry.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Four narrow writers

**Files:**
- Modify: `lib/botanical.ts` (add four writers after `updateSproutMedia`; rename `deleteVersion`)
- Modify: `lib/botanical.test.ts` (the `deleteVersion` rename)
- Modify: `app/admin/actions.ts` (the rename's one caller)
- Modify: `lib/garden-cache-source.test.ts` (`GARDEN_WRITERS`)

> **Why the rename lands here:** `lib/garden-cache-source.test.ts` reconciles
> `GARDEN_WRITERS` against `lib/botanical.ts`'s actual export list, so adding
> writers and renaming one have to happen in the same commit as the list edit or
> the suite is red in between.

- [ ] **Step 1: Add the four writers to `GARDEN_WRITERS` and rename the fifth — watch it fail**

In `lib/garden-cache-source.test.ts`, in the `GARDEN_WRITERS` set, replace the line

```ts
  "deleteVersion",
```

with

```ts
  "deleteSprout",
  "updateSproutMeta",
  "updateSproutState",
  "updateSproutDate",
  "updateSproutType",
```

Leave `"updateVersion"` in place — it is still exported until Task 14.

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-cache-source.test.ts`
Expected: FAIL — "GARDEN_WRITERS or GARDEN_READERS names a lib/botanical.ts export that no longer exists", listing the five new names.

- [ ] **Step 2: Write the four writers**

In `lib/botanical.ts`, immediately after `updateSproutMedia`, add:

```ts
/**
 * A sprout's name and description — and nothing else.
 *
 * A SIBLING of `updateSproutMedia` and `updatePlantMeta`, not a widening of
 * anything. The two fields are named explicitly rather than spread, which is
 * the rule `writeContent`'s docblock states from the other side: a spread is
 * what lets a later, widened caller reach `state` or `media` from a form that
 * has no business touching them.
 *
 * No `$unset` half, unlike `updatePlantMeta`: `Sprout.description` is required
 * in `lib/data.ts`, so a cleared description is `""`. See `lib/sprout-meta.ts`.
 */
export async function updateSproutMeta(slug: string, patch: SproutMetaPatch): Promise<void> {
  const db = await getDb();
  await db
    .collection<Sprout>("sprouts")
    .updateOne({ slug }, { $set: { name: patch.name, description: patch.description } });
}

/**
 * A sprout's state — and nothing else.
 *
 * The narrowest writer in this file, and the most consequential: it is the
 * field `filterPublic` reads to decide whether a sprout is on the public site
 * at all, and the field whose transition `setSproutStateAction` runs the
 * publish and unpublish cascades around. It writes one key so that the cascade
 * in the action above it is reasoning about exactly one change.
 */
export async function updateSproutState(slug: string, state: SproutState): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { state } });
}

/** A sprout's date — and nothing else. A sibling of `updateSproutState`. */
export async function updateSproutDate(slug: string, date: string): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { date } });
}

/**
 * A sprout's type — and nothing else. A sibling of `updateSproutState`.
 *
 * `type` is free-form: nothing in the garden validates it against a vocabulary,
 * because there isn't one (`lib/sprouts.ts` filters by state, plant and tag and
 * never by type). The action's only guard is that it is non-empty.
 */
export async function updateSproutType(slug: string, type: string): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").updateOne({ slug }, { $set: { type } });
}
```

Add `SproutMetaPatch` to the file's type imports:

```ts
import type { SproutMetaPatch } from "./sprout-meta";
```

and make sure `SproutState` is among the types imported from `./data` in this file (add it to the existing type import if absent).

- [ ] **Step 3: Rename `deleteVersion` → `deleteSprout`**

In `lib/botanical.ts`, rename the function and update its docblock's first line:

```ts
// Hard delete (roadmap A2). Idempotent — deleting a missing slug is a no-op
// (deleteOne matches 0). Callers needing the visibility recompute must seed the
// sprout's bean parents and state BEFORE calling this; afterwards the sprout no
// longer exists for unpublishCascade to find. Dangling refs to the deleted slug
// (seed promotedTo, future relations[]) are tolerated on all read paths.
//
// Named `deleteSprout` since the sprout's edition slice: the botanical rename
// (#88) never reached this file's write path, and "version" is a word the
// content model stopped using three slices ago.
export async function deleteSprout(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection<Sprout>("sprouts").deleteOne({ slug });
}
```

Then update the two callers of the old name:
- `lib/botanical.test.ts` — the import on line 10 and the three uses in the two `deleteVersion …` tests. Rename the test titles too (`deleteSprout removes only the targeted sprout doc`, `deleteSprout on a missing slug does not throw`).
- `app/admin/actions.ts` — the import, and the one call inside `deleteVersionAction`.

- [ ] **Step 4: Run the source guard and the pure suite**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-cache-source.test.ts`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Run the DB-backed suite**

Run: `npm run test:db`
Expected: PASS. It runs against `beanstalk_scratch`, never the real database. If `MONGODB_URI` is unavailable the `botanical` tests skip themselves (`{ skip: !hasDb }`) — that is a pass, not a silent hole, but say so in the task report.

- [ ] **Step 6: Commit**

```bash
git add lib/botanical.ts lib/botanical.test.ts lib/garden-cache-source.test.ts app/admin/actions.ts
git commit -m "$(cat <<'EOF'
Four narrow sprout writers, and deleteVersion becomes deleteSprout

updateSproutMeta / State / Date / Type, each naming its own fields rather than
spreading a patch — the rule writeContent states from the other side. The
rename finishes the sprout's share of #88 in the write path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Four narrow actions

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/admin/(chrome)/sprout/[slug]/page.tsx` (the rename's import only)

> Additive: `editVersionAction` stays until Task 14, because the page still
> calls it and every commit must be green.

- [ ] **Step 1: Add a shared redirect helper and the meta action**

In `app/admin/actions.ts`, add to the imports:

```ts
import { buildSproutMetaPatch, BlankSproutNameError, type SproutMetaPatch } from "@/lib/sprout-meta";
import { isSproutState } from "@/lib/sprout-state";
import {
  updateSproutMeta,
  updateSproutState,
  updateSproutDate,
  updateSproutType,
} from "@/lib/botanical";
import type { SproutState } from "@/lib/data";
```

(join existing import blocks where they already pull from those modules rather than adding duplicates).

Then, directly after `editSproutMediaAction`, add:

```ts
/**
 * Where a sprout's four head writes go back to, and where a rejected one puts
 * its message.
 *
 * `form` is the surface the author had open — `app/admin/_components/sprout-hero.tsx`
 * reads it back and reopens onto it, because the field that was rejected is
 * behind a closed overlay or popover and the banner would otherwise have
 * nowhere to live. An unknown value opens nothing and falls through to the
 * page-level alert, which is why nothing here has to trust it.
 */
function sproutHref(slug: string, error?: string, form?: string): string {
  const base = `/admin/sprout/${encodeURIComponent(slug)}`;
  if (!error) return base;
  return `${base}?error=${encodeURIComponent(error)}&form=${encodeURIComponent(form ?? "")}`;
}

/**
 * A sprout's name and description — and nothing else.
 *
 * The overlay behind the page title. Split out of `editVersionAction`, which
 * wrote seven fields from one form: that shape was only safe while every field
 * WAS on one form, and the head puts each of them behind its own surface.
 *
 * `buildSproutMetaPatch` throws on a name blank in both languages rather than
 * falling back, so the only rejection here is the one the author can fix.
 */
export async function editSproutMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the redirects below can only ever target a real page
  // and can only interpolate a known-good stored slug.
  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  // Typed `let` + try/catch, exactly as editPlantMetaAction does it: `redirect`
  // is typed `never`, so TypeScript accepts that `patch` is assigned by the
  // time it is used, and a throw that is NOT the one we expect is re-thrown
  // rather than swallowed into a misleading error message.
  let patch: SproutMetaPatch;
  try {
    patch = buildSproutMetaPatch(formData);
  } catch (err) {
    if (!(err instanceof BlankSproutNameError)) throw err;
    redirect(sproutHref(slug, `could not save: ${err.message}`, "meta"));
  }

  await updateSproutMeta(slug, patch);

  revalidateGarden();
  redirect(sproutHref(slug));
}
```

- [ ] **Step 2: Add the state action, with the cascade**

Append after it:

```ts
/**
 * A sprout's state — and the two cascades around it.
 *
 * This is `editVersionAction`'s publish logic, moved verbatim to the one action
 * that can own it, and it is why state is a write of its own rather than a
 * field on the meta overlay: the transition, not the value, is what decides
 * whether the sprout's bean, pod and plant are flipped public or recomputed
 * private. `existing` is read BEFORE the write so `existing.state` is the
 * pre-save state the transition is measured against.
 *
 * Both cascade branches re-read with `loadRawGarden` AFTER `updateSproutState`,
 * never `loadCachedGarden`: the cascade has to see the just-saved state, and a
 * cached read here publishes the wrong parents — a published sprout whose bean
 * silently stays private, or an unpublish that leaves a parent public.
 *
 * The digest gate (`shouldCascadePublish`) is unchanged: publishing a digest
 * marks review sign-off, not public exhibition, and flipping its curated
 * private containers public stays a separate human act.
 *
 * The posted value is a NAMED MEMBER of a vocabulary, re-validated here rather
 * than trusted — the rule `flipPlantField` states for the plant's two enums. A
 * stale page can then only ever name a value this vocabulary already has.
 */
export async function setSproutStateAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const state = String(formData.get("state") ?? "").trim();
  if (!isSproutState(state)) {
    redirect(sproutHref(slug, `unknown state: ${state || "(blank)"}`, "state"));
  }

  await updateSproutState(slug, state as SproutState);

  if (state === "published" && shouldCascadePublish(existing.type)) {
    const { plantSlugs, podSlugs, beanSlugs } = publishCascade(await loadRawGarden(), slug);
    await setPublic(plantSlugs, podSlugs, beanSlugs);
  } else if (existing.state === "published") {
    const { plantSlugs, podSlugs, beanSlugs } = unpublishCascade(await loadRawGarden(), slug);
    await setPrivate(plantSlugs, podSlugs, beanSlugs);
  }

  revalidateGarden();
  redirect(sproutHref(slug));
}
```

Note the one difference from `editVersionAction`: the digest gate now reads
`existing.type` rather than a `type` that arrived on the same form. It is the
same value — this action cannot change the type — and reading it from the
stored document is the only option once the two fields are on two surfaces.

- [ ] **Step 3: Add the date and type actions**

Append after it:

```ts
/**
 * A sprout's date — and nothing else.
 *
 * `required` on the input is UX; this is the guard. A blank date would sort the
 * sprout to the bottom of every timeline the garden builds and would render as
 * an empty cell on four admin tables, which is a worse outcome than a rejected
 * save.
 */
export async function setSproutDateAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const date = String(formData.get("date") ?? "").trim();
  if (!date) redirect(sproutHref(slug, "could not save: a sprout needs a date", "date"));

  await updateSproutDate(slug, date);

  revalidateGarden();
  redirect(sproutHref(slug));
}

/**
 * A sprout's type — and nothing else.
 *
 * Non-empty is the ONLY guard, and deliberately so: `type` is free-form. There
 * is no vocabulary to validate a member of — `lib/sprouts.ts` filters sprouts
 * by state, plant and tag and never by type, and the seed-promotion path writes
 * whatever the source carried. If a vocabulary is ever wanted it arrives as
 * `lib/sprout-type.ts` beside `lib/sprout-state.ts` and this action validates
 * against it; inventing one here would make the UI the definition.
 *
 * One consequence worth naming rather than hiding: this action can move a
 * published sprout off `digest`, and `shouldCascadePublish` — which
 * `setSproutStateAction` consults at publish time — is not re-run here. That is
 * `editVersionAction`'s existing behaviour (a form save carried both fields and
 * only `state === "published"` triggered the cascade), now visible as a gap
 * between two actions rather than hidden inside one.
 */
export async function setSproutTypeAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const type = String(formData.get("type") ?? "").trim();
  if (!type) redirect(sproutHref(slug, "could not save: a sprout needs a type", "type"));

  await updateSproutType(slug, type);

  revalidateGarden();
  redirect(sproutHref(slug));
}
```

- [ ] **Step 4: Rename `deleteVersionAction` → `deleteSproutAction`**

Rename the export in `app/admin/actions.ts` and change its error redirect to go
through the helper, so the rail can reopen onto the Delete panel:

```ts
  // Server-side re-check of the confirm checkbox; the browser `required` is only UX.
  if (String(formData.get("confirm") ?? "") !== "on") {
    redirect(sproutHref(slug, "could not delete: confirm the permanent deletion first", "delete"));
  }
```

Leave everything else in that function alone, including its success redirect to
the bean — a deleted sprout has no page to go back to.

Update the import in `app/admin/(chrome)/sprout/[slug]/page.tsx` and the
`<form action={deleteVersionAction}>` in its Danger zone card to the new name.
That file is rewritten in Task 13; this keeps it compiling until then.

- [ ] **Step 5: Run the guards and the suite**

Run: `npm test`
Expected: PASS — in particular `lib/garden-cache-source.test.ts`'s per-function
walk, which now sees four new functions that each call a garden writer and each
call `revalidateGarden()`. If one of them is reported as an offender, it is
missing its `revalidateGarden()` line.

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/actions.ts "app/admin/(chrome)/sprout/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
Four narrow sprout actions beside the wide one

editSproutMetaAction, setSproutStateAction (which takes the publish and
unpublish cascades with it), setSproutDateAction, setSproutTypeAction. One
sproutHref helper decides where a save returns and which surface a rejection
reopens. deleteVersionAction becomes deleteSproutAction.

editVersionAction stays until the page stops calling it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: An optional mark on the shared head

**Files:**
- Modify: `components/plant-header.tsx`
- Modify: `lib/server-safe-source.test.ts`

- [ ] **Step 1: Add the file to the server-safe list — watch it pass, which is the point**

In `lib/server-safe-source.test.ts`, add to `SERVER_SAFE`, after `components/screen-strip.tsx`:

```ts
  // The shared entity head. CLAUDE.md names it as one of the four shared
  // surfaces and its own docblock claims server-safety; until the sprout's
  // edition slice nothing checked either. It is rendered by
  // app/(public)/_components/plant-head.tsx and by two admin islands at once,
  // which is exactly the arrangement one "use client" would end.
  "components/plant-header.tsx",
```

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/server-safe-source.test.ts`
Expected: PASS — the file already satisfies all three rules. Adding it now is
what keeps that true through this task and the three entities behind it.

- [ ] **Step 2: Make `mark` optional**

In `components/plant-header.tsx`, change the prop's type and its comment:

```tsx
  /**
   * The squircle — a plain `<div>` on the public page, a popover trigger in the
   * admin, and ABSENT for an entity that has no mark.
   *
   * Optional since the sprout's edition slice. The docblock above argues the
   * mark's FALLBACK is not optional, and that still holds: a centred stack whose
   * first element renders empty reads as broken, which is why
   * `PlantMarkContent` draws initials rather than nothing. But a sprout has no
   * logo and no monogram — a two-letter mark for a piece of writing is a
   * decoration standing where a fact belongs — so it has no first element to
   * miss, and the stack simply starts at the title.
   *
   * The distinction to keep: a caller that HAS a mark must always render one.
   * Passing `undefined` is a statement about the entity, never a shortcut for a
   * mark that failed to load.
   */
  mark?: ReactNode;
```

The body needs no change: `{mark}` renders nothing for `undefined`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `app/(public)/_components/plant-head.tsx` and
`app/admin/_components/plant-hero.tsx` both still pass a mark; a required prop
becoming optional breaks no caller.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/plant-header.tsx lib/server-safe-source.test.ts
git commit -m "$(cat <<'EOF'
The shared head's mark becomes optional

One prop change, and the sprout head is the plant head minus the squircle:
same file, same TITLE token, same h1. The file also joins SERVER_SAFE, which
it should have done the day it was written — CLAUDE.md names it as a shared
surface and nothing was checking the directive.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: The meta form

**Files:**
- Create: `app/admin/_components/sprout-meta-form.tsx`

- [ ] **Step 1: Write the component**

Create `app/admin/_components/sprout-meta-form.tsx`:

```tsx
import { textPart, type Sprout } from "@/lib/data";
import { editSproutMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * A sprout's identity: what it is called and what it is in one line.
 *
 * `PlantMetaForm`'s shape exactly — a server component posting to a server
 * action with the field names `buildSproutMetaPatch` reads — and it is handed
 * to `sprout-hero.tsx` as a prop rather than imported by it. That is what keeps
 * the island free of every field name on the sprout: the overlay is the shell,
 * never the write path, which is the line `overlay-sheet.tsx` already draws for
 * every consumer.
 *
 * `slug` is a read-only line rather than an input, for `PlantMetaForm`'s
 * reason: it is what every `parents[]` ref points at and what a promoted seed's
 * `promotedTo` records, so renaming it here would orphan things with no cascade
 * to catch it. It is shown at all because the overlay is where identity is
 * read, and the page's old `slug` / `bean` list has nowhere else to go.
 *
 * No hidden carry-along field, unlike `PlantMetaForm`'s `status`. That one is
 * load-bearing because `buildPlantMetaPatch` reads an absent status as
 * `active`; `buildSproutMetaPatch` names two fields and `updateSproutMeta`
 * writes the same two, so there is nothing a missing input could default.
 */
export function SproutMetaForm({ sprout }: { sprout: Sprout }) {
  return (
    <form action={editSproutMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={sprout.slug} />

      <p className="font-heading text-xs text-muted-foreground">
        <span className="text-muted-foreground/70">slug</span> {sprout.slug}
      </p>

      {/* Prefills use the STRICT textPart — resolveText's fallback would copy
          the fr half into the en box and save it back as en, which is the trap
          the plant's Meta and Role forms both carry a comment about. No
          `required` on the en inputs: an fr-only name is valid (B1) and the
          pair is validated as a whole server-side. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(sprout.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(sprout.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={textPart(sprout.description, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionFr">Description (fr)</Label>
          <Textarea
            id="descriptionFr"
            name="descriptionFr"
            defaultValue={textPart(sprout.description, "fr")}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button type="submit">Save meta</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_components/sprout-meta-form.tsx
git commit -m "$(cat <<'EOF'
The sprout's meta form, server-rendered

PlantMetaForm's shape, minus the hidden status it does not need. Handed to the
head as a prop rather than imported by it, so the island learns no field name.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: The head

**Files:**
- Create: `app/admin/_components/sprout-hero.tsx`
- Create: `lib/sprout-hero-a11y.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/sprout-hero-a11y.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";

/**
 * The sprout head's four editors are icon triggers — a title, a pencil, a
 * calendar, a tag. An icon is not a label, so the only place a reader (a screen
 * reader, or anyone hovering) learns what `state`, `date` and `type` currently
 * ARE is each trigger's accessible name.
 *
 * That is what this file pins, and it is easy to lose by accident: the
 * accessible name is set on the control, not on a visible span (the hover label
 * is CSS — components/chrome.tsx), so nothing on screen changes if someone
 * replaces `State: Draft` with a bare `State`. The page would look identical
 * and would stop saying what it is.
 *
 * lib/plant-hero-a11y.test.ts is the same file for the plant; this is the
 * second entity to need it, which is the point of the head being shared.
 *
 * No jsdom: renderToStaticMarkup is enough to read an accessible name out of
 * the markup, and the head's values are server-rendered.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

async function hero(overrides: Record<string, unknown> = {}): Promise<string> {
  const { SproutHero } = await import("@/app/admin/_components/sprout-hero");
  return render(
    React.createElement(SproutHero, {
      slug: "a-sprout",
      name: "A sprout",
      description: "one line about it",
      state: "draft",
      date: "2026-09-12",
      type: "article",
      metaForm: React.createElement("div", null, "META FORM"),
      saved: "x",
      ...overrides,
    } as any),
  );
}

test("the state trigger names the stored state", async () => {
  assert.match(await hero({ state: "draft" }), /aria-label="State: Draft"/);
  assert.match(await hero({ state: "private" }), /aria-label="State: Private"/);
  assert.match(await hero({ state: "published" }), /aria-label="State: Published"/);
});

test("the date and type triggers name their stored values", async () => {
  const html = await hero({ date: "2026-09-12", type: "article" });
  assert.match(html, /aria-label="Date: 2026-09-12"/);
  assert.match(html, /aria-label="Type: article"/);
});

test("the name and the description are genuinely server-rendered", async () => {
  // Not a script-off claim — the admin is a JavaScript application. It is a
  // check that SproutHero never grows a "renders nothing until it mounts" guard
  // around content that has nowhere else to live: the name is the page's only
  // h1 and the description is the only place the one-line summary appears.
  const html = await hero();
  assert.ok(html.includes("A sprout"), "the name must be in the markup");
  assert.ok(html.includes("one line about it"), "the description must be in the markup");
  assert.match(html, /<h1/, "the name must be inside the page's h1");
});

test("the meta form is rendered from the prop, never composed here", async () => {
  // The corollary of the arrangement: the overlay's contents are server-rendered
  // by the page. If this marker stops appearing, someone replaced the prop with
  // an import and the island now knows the sprout's field names.
  assert.ok((await hero()).includes("META FORM"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/sprout-hero-a11y.test.ts`
Expected: FAIL — `Cannot find module '@/app/admin/_components/sprout-hero'`.

- [ ] **Step 3: Write the island**

Create `app/admin/_components/sprout-hero.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Calendar, Tag } from "lucide-react";
import type { SproutState } from "@/lib/data";
import { SPROUT_STATE_ICONS } from "@/components/admin/glyphs";
import { sproutStateLabel } from "@/lib/glyphs";
import { SPROUT_STATES } from "@/lib/sprout-state";
import { setSproutStateAction, setSproutDateAction, setSproutTypeAction } from "../actions";
import { OverlaySheet } from "./overlay-sheet";
import { PlantHeader } from "@/components/plant-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A sprout's head: the name, the one-line description, and the three things a
 * sprout IS — a state, a date, a type — as three icons under it.
 *
 * `plant-hero.tsx`'s shape, on the entity one tier down, and deliberately beat
 * for beat: an author moving between a plant and a sprout should find the same
 * gestures. The layout is the SAME FILE (`components/plant-header.tsx`), with
 * no mark — a sprout has no logo, and a monogram for a piece of writing is a
 * decoration standing where a fact belongs.
 *
 * The shell is the exception, never the write path. `metaForm` is
 * server-rendered by the page and handed down, so this file never composes a
 * payload for it; the three it renders itself are real `<form>`s posting one
 * field each to a one-field server action.
 *
 * NONE OF THE THREE WRITES ON THE CLICK THAT OPENS IT, and state earns that
 * harder than the plant's two enums do: publishing a sprout cascades upward
 * through its bean, pod and plant, and un-publishing runs the downward
 * recompute. A one-click flip is a mis-click away from publishing a project's
 * whole spine, and the undo is another mis-click on the same pixel.
 */

export interface SproutHeroProps {
  slug: string;
  name: string;
  description: string;
  state: SproutState;
  date: string;
  type: string;
  /** A rejected save's message, and which surface it came from. */
  error?: string;
  errorForm?: Surface;
  /**
   * The server-rendered meta form. A prop rather than an import: it is a server
   * component reaching a server action, and passing it down is what keeps this
   * file free of every field name on the sprout.
   */
  metaForm: ReactNode;
  /**
   * A fingerprint of everything this head can write, computed by the page from
   * the STORED sprout. A successful save redirects to this same route — a soft
   * navigation, so this component keeps its place in the tree and nothing
   * resets itself. The re-render carrying a different fingerprint is the only
   * honest signal that the write landed, so it is what closes the surface. A
   * save that changed nothing leaves it open, which is the truth.
   *
   * It covers ALL FOUR surfaces, which is a correction to `plant-hero.tsx`'s
   * rather than a copy of it: that one fingerprints name, description, role and
   * logo but not status or visibility, so a status save leaves its popover open
   * over a freshly-disabled Save.
   */
  saved: string;
}

/** The surfaces this head can open, one at a time — tracked in one place rather
 *  than in four independently uncontrolled primitives. */
export type Surface = "meta" | "state" | "date" | "type";

export function SproutHero({
  slug,
  name,
  description,
  state,
  date,
  type,
  error,
  errorForm,
  metaForm,
  saved,
}: SproutHeroProps) {
  const [open, setOpen] = useState<Surface | null>(null);
  const [seenSaved, setSeenSaved] = useState(saved);

  // Controlled, so the primitive cannot infer where focus came from: the sheet
  // is opened from the title and reopened by a rejected save.
  const titleRef = useRef<HTMLButtonElement>(null);

  // A rejected save redirects here with ?form=…&error=… and the field it
  // rejected is behind a closed surface, so the banner would have nowhere to
  // live. Reopen onto it rather than land the author on a page that says
  // nothing went wrong. (Their edit is gone either way; the message is what is
  // salvageable.)
  useEffect(() => {
    if (error && errorForm) setOpen(errorForm);
  }, [error, errorForm]);

  // The save signal above.
  useEffect(() => {
    if (saved !== seenSaved) {
      setSeenSaved(saved);
      setOpen(null);
    }
  }, [saved, seenSaved]);

  // A rejected save leaves ?form= and ?error= in the URL and they outlive the
  // surface: close, reload, and the banner comes back about an edit that no
  // longer exists in any field. Dropped with replaceState rather than a router
  // push — this is tidying the URL, not a navigation, and a navigation here
  // would re-render the page under the closing sheet.
  const close = (): void => {
    setOpen(null);
    if (typeof window === "undefined" || !window.location.search) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error") && !url.searchParams.has("form")) return;
    url.searchParams.delete("error");
    url.searchParams.delete("form");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  const surface = (next: Surface | null) => (next ? setOpen(next) : close());

  return (
    <TooltipProvider>
      <PlantHeader
        /* No mark. See components/plant-header.tsx's prop comment: absent is a
           statement about the entity, not a mark that failed to load. */
        title={
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  ref={titleRef}
                  type="button"
                  onClick={() => setOpen("meta")}
                  className="rounded-lg px-2 py-0.5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {name}
                </button>
              }
            />
            <TooltipContent side="bottom">Edit name and description</TooltipContent>
          </Tooltip>
        }
        description={description}
        facts={
          <div className="flex items-center gap-1">
            {/* State. Radios plus a Save disabled until the pick differs from
                what is stored — the second click is a confirmation rather than
                a formality. */}
            <FactPopover
              open={open === "state"}
              onOpenChange={(next) => setOpen(next ? "state" : null)}
              label={`State: ${sproutStateLabel(state)}`}
              icon={SPROUT_STATE_ICONS[state]}
              tone={
                state === "published"
                  ? "text-primary"
                  : state === "private"
                    ? "text-foreground"
                    : undefined
              }
            >
              <StateForm slug={slug} current={state} />
            </FactPopover>

            {/* Date and type. NOT enums: `type` is free-form (lib/sprouts.ts
                filters by state, plant and tag and never by type), so there is
                no vocabulary to draw as radios. A text field's "differs from
                stored" is what the author can already see in the field, so the
                Save is a plain submit. */}
            <FactPopover
              open={open === "date"}
              onOpenChange={(next) => setOpen(next ? "date" : null)}
              label={`Date: ${date}`}
              icon={Calendar}
            >
              <FieldForm
                slug={slug}
                action={setSproutDateAction}
                field="date"
                inputType="date"
                current={date}
                heading="Date"
                hint="When this sprout is dated on every timeline it appears in."
              />
            </FactPopover>

            <FactPopover
              open={open === "type"}
              onOpenChange={(next) => setOpen(next ? "type" : null)}
              label={`Type: ${type}`}
              icon={Tag}
            >
              <FieldForm
                slug={slug}
                action={setSproutTypeAction}
                field="type"
                inputType="text"
                current={type}
                heading="Type"
                hint="Free text. A type of “digest” exempts this sprout from the publish cascade."
              />
            </FactPopover>
          </div>
        }
      />

      <OverlaySheet
        open={open === "meta"}
        onOpenChange={(next) => surface(next ? "meta" : null)}
        label="Edit sprout meta"
        finalFocus={titleRef}
      >
        <div className="flex w-full max-w-xl flex-col gap-6">
          <p className="text-center font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
            {name}
          </p>
          {error && errorForm === "meta" ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {metaForm}
        </div>
      </OverlaySheet>
    </TooltipProvider>
  );
}

/**
 * One fact: an icon that opens its editor, and nothing else.
 *
 * The icon is a trigger and NOT a submit — the whole point. The form lives
 * inside the popover, which Base UI unmounts on close, so an abandoned edit is
 * discarded with nothing to reset by hand. An abandoned edit is not a pending
 * write.
 *
 * `aria-label` states the STORED value, on the control rather than on a visible
 * span, because the hover label is CSS. `lib/sprout-hero-a11y.test.ts` pins it.
 */
function FactPopover({
  open,
  onOpenChange,
  label,
  icon: Icon,
  tone,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button type="button" size="icon" variant="ghost" aria-label={label}>
                  <Icon className={`size-4 ${tone ?? "text-muted-foreground"}`} />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="w-72 text-left">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The state vocabulary, drawn as native radios.
 *
 * The words come from `lib/glyphs.ts` and the icons from the admin tables' own
 * map, so a state reads the same on `/admin/sprouts` and on this head. The
 * hints are the only new prose, and they exist because what each state DOES is
 * invisible from this page.
 *
 * Not the Base UI RadioGroup: that one submits through a script-populated
 * hidden input, and a real radio is what keeps this form a form.
 */
function StateForm({ slug, current }: { slug: string; current: SproutState }) {
  const [picked, setPicked] = useState<SproutState>(current);

  return (
    <form action={setSproutStateAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-col gap-2">
        {SPROUT_STATES.map((option) => {
          const Icon = SPROUT_STATE_ICONS[option];
          const id = `state-${option}`;
          return (
            <ChoiceLabel key={option} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name="state"
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {sproutStateLabel(option)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {STATE_HINTS[option]}
                </span>
              </span>
            </ChoiceLabel>
          );
        })}
      </div>

      <div className="flex justify-end">
        {/* Disabled until the pick differs from what is stored. Without it the
            Save is a formality — two clicks that mean exactly what one click
            meant — and the confirmation this popover exists to add is gone. */}
        <Button type="submit" size="sm" disabled={picked === current}>
          Save
        </Button>
      </div>
    </form>
  );
}

const STATE_HINTS: Record<SproutState, string> = {
  draft: "Being written. Off the public site, and off it for its bean too.",
  private: "Finished but held back. Still off the public site.",
  published:
    "On the public site — and its bean, pod and plant are made public with it, unless it is a digest.",
};

/**
 * One free-text or date field: an input and a Save.
 *
 * No disabled-until-changed guard, unlike `StateForm`. That guard exists to
 * make a second click a confirmation of a choice the author might not have
 * meant; here the author has typed, and what they typed is on screen.
 */
function FieldForm({
  slug,
  action,
  field,
  inputType,
  current,
  heading,
  hint,
}: {
  slug: string;
  action: (formData: FormData) => Promise<void>;
  field: "date" | "type";
  inputType: "date" | "text";
  current: string;
  heading: string;
  hint: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`field-${field}`}>{heading}</Label>
        <Input
          id={`field-${field}`}
          type={inputType}
          name={field}
          defaultValue={current}
          required
        />
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/sprout-hero-a11y.test.ts`
Expected: PASS, 4 tests.

If the popover's trigger does not appear in the static markup, Base UI is
deferring the trigger's render until mount. Check how
`lib/plant-hero-a11y.test.ts` gets at the same assertion for `PlantHero` and
match it — do NOT weaken the assertion to make it pass.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: no errors; PASS.

- [ ] **Step 6: Commit**

```bash
git add app/admin/_components/sprout-hero.tsx lib/sprout-hero-a11y.test.ts
git commit -m "$(cat <<'EOF'
The sprout gets a head

The name in the shared header's h1 with the meta overlay behind it, and state,
date and type as three icons under it — each opening its editor rather than
writing on the click that opened it. The fingerprint covers all four surfaces,
which is the half plant-hero.tsx's leaves out.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: The rail

**Files:**
- Create: `app/admin/_components/entity-rail.tsx`
- Create: `lib/entity-rail-source.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/entity-rail-source.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/entity-rail-source.test.ts`
Expected: FAIL — `ENOENT … entity-rail.tsx`.

- [ ] **Step 3: Write the rail**

Create `app/admin/_components/entity-rail.tsx`:

```tsx
"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { X } from "lucide-react";
import { Chrome, ChromeItem, chromeItemClass } from "@/components/chrome";
import { Button } from "@/components/ui/button";

/**
 * An entity page's own rail — a cluster on the right edge, and one panel the
 * page makes room for.
 *
 * The shell and NOTHING else: no form, no action, no field name. Every panel's
 * contents are server-rendered by the page and arrive as a `ReactNode`, which
 * is `plant-rail.tsx`'s arrangement for `ExhibitionPanel` and
 * `plant-hero.tsx`'s for `metaForm`. `lib/entity-rail-source.test.ts` enforces
 * it, and it matters more here than on the plant's rail, because one of these
 * panels is a DELETE.
 *
 * Written shared on its first use rather than sprout-first, because it is
 * provably generic — it knows only ids, labels, icons and nodes — and three
 * more entities are queued behind the sprout.
 *
 * WHY EVERY PANEL STAYS MOUNTED. Base UI's popovers unmount on close, and
 * `plant-hero.tsx` argues that is correct: an abandoned pick is not a pending
 * write, and unmounting discards it with nothing to reset by hand. This rail
 * takes the opposite side, for one panel's sake. `MediaPicker` uploads to
 * Cloudinary IMMEDIATELY and persists the list only on Save, so unmounting on
 * close would strand real assets in the bucket — the thing
 * `npm run check:orphans` exists to sweep — and would do it on a mis-click,
 * which is the failure mode the two-act rule is itself built to avoid. So the
 * panels are all mounted and the inactive ones are pushed off-screen and made
 * `inert`. React preserves state across both, so closing and reopening returns
 * the author to the list they were building.
 *
 * The cost is that a panel mounts on page load rather than on first open, which
 * is what the media form already did as a card in the document. Nothing
 * regresses, and treating all panels the same is simpler than a rule with one
 * exception in it.
 */

/**
 * The plate, held open while a panel is.
 *
 * `CHROME_PLATE` materializes on hover and focus-within, and neither stays true
 * once a panel opens: focus moves into the panel, which is a sibling of this
 * `<nav>` rather than a descendant, so the plate would ghost away underneath
 * the very panel it opened — the trigger reading as though it had vanished.
 * `aria-expanded` is the honest hook, and it needs no state of its own.
 *
 * A copy of `plant-rail.tsx`'s constant rather than an import of it: that one
 * is private to a file this slice does not otherwise touch, and exporting it
 * would make `plant-rail.tsx` a module this one depends on for one string. It
 * is lifted here when the plant's rail is converted.
 */
const PLATE_WHILE_OPEN =
  "md:has-[[aria-expanded=true]]:border-border md:has-[[aria-expanded=true]]:bg-card/80 " +
  "md:has-[[aria-expanded=true]]:shadow-lg md:has-[[aria-expanded=true]]:backdrop-blur";

/**
 * How far the page moves to make room, and from what width.
 *
 * A TRANSLATE, not padding, and the two halves of that are recorded here the
 * way `RAIL_CLEARANCE` records its own arithmetic.
 *
 * `app/admin/(chrome)/layout.tsx` argues for padding, because a transform does
 * not make room, it MOVES — and its 14rem move pushed a WIDE grid's left edge
 * past the viewport. Both halves invert here. This is the reading column, which
 * has gutters to spare (`plant-rail.tsx`'s case exactly), and the same docblock
 * states the other half outright: "keeps its columns" is a benefit for a prose
 * editor, whose measured width and caret position must not move under the
 * author. Padding re-flows; a transform does not.
 *
 * Padding is also unavailable. This component renders INSIDE `READING_COLUMN`
 * (`AdminMain` → `div.mx-auto.max-w-3xl.px-6` → the page), so a right padding
 * added here lands inside a 768px box and squeezes the editor to roughly 320px.
 * Only the layout can pad, and only for its own `@sheet` slot.
 *
 * The number, with `main`'s `px-20` (160px) and a 448px panel: a 768px column
 * centred has its left edge at (vw − 768)/2 and its right edge at (vw + 768)/2.
 * Moved 224px left, clearing the panel needs (vw + 768)/2 − 224 ≤ vw − 448, and
 * staying on screen needs (vw − 768)/2 − 224 ≥ 0. Both give vw ≥ 1216. Below
 * that there is no translate that does both, so there is none — the panel
 * floats over the prose instead, dismissible, as the screen library's does
 * below `lg`.
 */
const PAGE_ASIDE = "min-[76rem]:-translate-x-56";

export interface RailItem {
  /** Matches `openOnError`, and is the panel's key. Never a field name. */
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Server-rendered by the page. This file renders it and learns nothing from it. */
  panel: ReactNode;
  /** Drawn above the panel's contents, in the chrome's eyebrow face. */
  heading?: string;
}

export function EntityRail({
  label,
  items,
  openOnError,
  children,
}: {
  /** The cluster's accessible name, e.g. "Sprout panels". */
  label: string;
  items: RailItem[];
  /**
   * The panel a rejected save came from, from the page's `?form=`. The panel
   * renders the message itself — this file never sees one. An id that matches
   * no item opens nothing, which is what lets the page fall through to its own
   * banner for an unknown value.
   */
  openOnError?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (openOnError && items.some((i) => i.id === openOnError)) setOpen(openOnError);
    // items is rebuilt every render by the page; depending on it would reopen
    // the panel on every re-render, including the one that closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnError]);

  if (items.length === 0) return <>{children}</>;

  return (
    <>
      {/* The page, moved. `transition-transform` and nothing else: a transform
          does not re-flow the document, so the editor keeps its measure and the
          caret keeps its place while the panel opens. */}
      <div
        className={`transition-transform duration-200 ease-out ${open ? PAGE_ASIDE : ""}`}
      >
        {children}
      </div>

      <Chrome
        magnet="right"
        orientation="vertical"
        label={label}
        className={PLATE_WHILE_OPEN}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const current = open === item.id;
          return (
            <ChromeItem key={item.id} label={item.label}>
              <button
                type="button"
                aria-label={item.label}
                aria-expanded={current}
                onClick={() => setOpen(current ? null : item.id)}
                className={chromeItemClass(current)}
              >
                <Icon className="size-4" />
              </button>
            </ChromeItem>
          );
        })}
      </Chrome>

      {items.map((item) => {
        const current = open === item.id;
        return (
          <aside
            key={item.id}
            aria-label={item.label}
            // `inert` rather than unmounting — see this file's docblock. It also
            // takes the panel out of the accessibility tree and out of the tab
            // order, so a closed panel's fields are unreachable rather than
            // merely off-screen.
            inert={!current}
            className={
              "fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col gap-4 overflow-y-auto " +
              "border-l bg-card/95 p-6 shadow-xl backdrop-blur-xl " +
              "transition-transform duration-200 ease-out lg:w-[28rem] " +
              (current ? "translate-x-0" : "translate-x-full")
            }
          >
            <div className="flex items-start justify-between gap-4">
              {item.heading ? (
                <p className="font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  {item.heading}
                </p>
              ) : (
                <span />
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Close ${item.label}`}
                onClick={() => setOpen(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {item.panel}
          </aside>
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/entity-rail-source.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `inert` is rejected on `<aside>`, the installed
`@types/react` predates React 19's boolean `inert`; use `inert={!current ? "" : undefined}`
and leave a one-line comment saying why.

- [ ] **Step 6: Commit**

```bash
git add app/admin/_components/entity-rail.tsx lib/entity-rail-source.test.ts
git commit -m "$(cat <<'EOF'
A shared rail: a cluster, a push panel, and no field names

Shell only — every panel is server-rendered by the page and handed down, which
matters more here than on the plant's rail because one of these panels is a
delete. Panels stay mounted and go inert rather than unmounting, so the media
picker cannot strand a Cloudinary upload on a mis-click.

The push is a translate gated at 1216px, where the arithmetic says a 768px
column both clears a 28rem panel and stays on screen. Below it the panel
floats, because below it neither is possible.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: The delete form

**Files:**
- Create: `app/admin/_components/sprout-delete-form.tsx`

- [ ] **Step 1: Write the component**

Create `app/admin/_components/sprout-delete-form.tsx`:

```tsx
import { resolveText, type Sprout } from "@/lib/data";
import { deleteSproutAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeCheckbox } from "@/components/ui/native-controls";

/**
 * The delete, extracted from the page's Danger zone card and moved onto the
 * rail.
 *
 * A server component, handed to `EntityRail` as a panel's `ReactNode` — which
 * is the arrangement that keeps the rail unable to compose this particular
 * payload. Of everything on that rail this is the one that cannot be undone.
 *
 * The confirm checkbox is `required` for the browser and re-checked in
 * `deleteSproutAction` for everything else: a POST that never rendered the box
 * has to be refused too. The rejection redirects with `form=delete`, so the
 * rail reopens onto this panel and the message appears where the checkbox is.
 */
export function SproutDeleteForm({ sprout, error }: { sprout: Sprout; error?: string }) {
  return (
    <form action={deleteSproutAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={sprout.slug} />

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ChoiceLabel className="items-start leading-normal">
        <NativeCheckbox name="confirm" required className="mt-0.5" />
        <span>
          Yes, permanently delete the sprout “{resolveText(sprout.name)}” — this cannot be
          undone.
        </span>
      </ChoiceLabel>

      <div>
        <Button type="submit" variant="destructive">
          Delete sprout
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_components/sprout-delete-form.tsx
git commit -m "$(cat <<'EOF'
The sprout's delete, as a panel

Lifted out of the Danger zone card unchanged — confirm box, interpolated name,
destructive submit — and made a server component so the rail that opens it
cannot compose its payload.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: The floating commit

**Files:**
- Modify: `components/editor/prose-editor.tsx`

- [ ] **Step 1: Add the dirty signal**

`unchanged` today only becomes true AFTER a save attempt that found no diff. A
resting state that claims "up to date" needs a real signal, so add one beside
it.

In `ProseEditor`, replace the `unchanged` state declaration with:

```tsx
  // What the button's resting state is a claim about.
  //
  // `onUpdate` fires on every keystroke, and `editor.getMarkdown()` serializes
  // the whole document — so the comparison is DEBOUNCED rather than run per
  // key. 200ms is short enough that the button has settled before the author
  // looks at it and long enough that a burst of typing costs one serialization.
  //
  // Compared against `baselineRef` (the editor's own first serialization), not
  // the stored `initialMarkdown` prop: those differ by normalization on
  // essentially every real document — a blank line between adjacent entity
  // cards, table cell padding, `&` → `&amp;` — which is why comparing against
  // the stored string never detects "unchanged" (spec §2.5). Undo back to the
  // original therefore lands on clean, correctly.
  const [dirty, setDirty] = useState(false);
  const [unchanged, setUnchanged] = useState(false);
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Replace the editor's `onUpdate` with:

```tsx
    onUpdate: ({ editor }) => {
      setUnchanged(false);
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      dirtyTimer.current = setTimeout(() => {
        setDirty(baselineRef.current !== null && editor.getMarkdown() !== baselineRef.current);
      }, DIRTY_DEBOUNCE_MS);
    },
```

Add above the component:

```tsx
/** See `onUpdate` — one serialization per burst of typing, not one per key. */
const DIRTY_DEBOUNCE_MS = 200;
```

Add a cleanup effect inside the component, after the `useEditor` call:

```tsx
  // A pending comparison must not fire into an unmounted component: the author
  // types and immediately navigates, and React would warn about a setState on
  // a tree that is gone.
  useEffect(() => () => {
    if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
  }, []);
```

Import `useEffect` from `react` (join the existing import).

In `save()`, after a successful serialization comparison, keep the existing
`setUnchanged` calls and add `setDirty(false)` on the branch that actually
sends — the baseline is re-established by the redirect's re-render, and leaving
`dirty` true would show "Save" over a document that was just saved:

```tsx
    setUnchanged(false);
    setDirty(false);
    setError(null);
```

and on the early-return branch:

```tsx
      setUnchanged(true);
      setDirty(false);
      return;
```

- [ ] **Step 2: Add the `float` prop**

Add to the props type, after `bare`:

```tsx
  /**
   * The commit as a floating cluster at the bottom of the viewport, instead of
   * a row under the writing surface — for the one page where the editor IS the
   * page (`/admin/sprout/[slug]`).
   *
   * Separate from `bare` on purpose. They happen to be set together there, but
   * they are two decisions: `bare` is about the frame around the writing
   * surface, this is about where the commit lives. The pod and bean pages reach
   * this component through `ContentCard`, where both stay off and the inline
   * row — with its "No changes to save" and "Could not save" lines — is
   * unchanged.
   *
   * ONLY THE COMMIT FLOATS. The `@` / `/` hint and the `/image` command's
   * progress and error lines stay in the document: they are about the caret's
   * neighbourhood rather than about the document's state, and a fixed cluster
   * at the bottom of the viewport is the wrong distance from the thing they
   * describe.
   */
  float?: boolean;
```

and to the destructured parameters: `float = false,`.

- [ ] **Step 3: Draw the four appearances**

Import at the top of the file:

```tsx
import { CloudAlert, CloudCheck, LoaderCircle } from "lucide-react";
import { Chrome } from "@/components/chrome";
```

Extract the existing commit row into a local component and render one or the
other. Replace the existing block:

```tsx
      <div className="flex items-center gap-3">
        {/* Also disabled mid-upload: … */}
        <Button type="button" onClick={save} disabled={pending || imageBusy || !editor}>
          {pending ? "Saving…" : "Save content"}
        </Button>
        {unchanged ? (
          <span className="self-center text-xs text-muted-foreground">No changes to save</span>
        ) : null}
        {error ? (
          <span className="self-center text-xs text-destructive">Could not save: {error}</span>
        ) : null}
      </div>
```

with:

```tsx
      {/* Disabled mid-upload in both shapes: saving now would persist a
          document missing the image that is seconds from being inserted, and
          the author would have to notice and save again. */}
      {float ? (
        <Chrome magnet="bottom-center" content>
          <Button
            type="button"
            onClick={save}
            disabled={pending || imageBusy || !editor || (!dirty && !error)}
            variant={error ? "destructive" : dirty ? "default" : "ghost"}
            size="sm"
            className={error || dirty ? undefined : "text-muted-foreground"}
          >
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" /> Saving…
              </>
            ) : error ? (
              <>
                <CloudAlert /> Couldn&rsquo;t save — {error}
              </>
            ) : dirty ? (
              "Save"
            ) : (
              <>
                <CloudCheck /> Up to date
              </>
            )}
          </Button>
        </Chrome>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={pending || imageBusy || !editor}>
            {pending ? "Saving…" : "Save content"}
          </Button>
          {unchanged ? (
            <span className="self-center text-xs text-muted-foreground">No changes to save</span>
          ) : null}
          {error ? (
            <span className="self-center text-xs text-destructive">Could not save: {error}</span>
          ) : null}
        </div>
      )}
```

Four appearances, three modes: **clean** (`CloudCheck`, ghost, muted,
disabled), **dirty** (primary — which is green, because the theme's primary is
green; hard-coding a colour here would be the first place this page stopped
following the design system), **saving** (`LoaderCircle`, disabled), and
**failed** — which is an appearance rather than a fourth mode, but stays
CLICKABLE so the author can retry, and is why the `disabled` expression has
`&& !error` in it. A save that failed must not read as saved.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: no errors; PASS, including `lib/editor.test.ts` — that file drives a
real headless editor and must be unaffected.

- [ ] **Step 5: Commit**

```bash
git add components/editor/prose-editor.tsx
git commit -m "$(cat <<'EOF'
The editor's commit can float, and "up to date" starts being true

A `float` prop puts the save in a bottom-centre chrome cluster with three
modes and a fourth appearance for failure — which stays clickable, because a
save that failed must not read as saved.

The resting state is a claim about the document, so it needs a signal: a
200ms-debounced comparison against the editor's own first serialization, not
the stored string those differ from on every real document. Undo back to the
original now lands on clean.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: The page

**Files:**
- Modify: `app/admin/(chrome)/sprout/[slug]/page.tsx` (rewrite)
- Modify: `lib/media-picker-mount.test.ts` (a stale path in one comment)

- [ ] **Step 1: Rewrite the page**

Replace the whole of `app/admin/(chrome)/sprout/[slug]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { FileCode2, Images, Trash2 } from "lucide-react";
import { resolveText, textPart, BEAN_PREFIX, parentsWithPrefix } from "@/lib/data";
import { getSprout } from "@/lib/botanical";
import { loadRawGarden } from "@/lib/store";
import { entityOptions } from "@/lib/entity-options";
import { stateOf } from "@/lib/sprout-state";
import { editContentAction, editSproutMediaAction } from "../../../actions";
import { SproutHero, type Surface } from "../../../_components/sprout-hero";
import { SproutMetaForm } from "../../../_components/sprout-meta-form";
import { SproutDeleteForm } from "../../../_components/sprout-delete-form";
import { EntityRail, type RailItem } from "../../../_components/entity-rail";
import { MediaPicker } from "@/components/admin/media-picker";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/**
 * One sprout, as a place you come to in order to WRITE.
 *
 * The sibling of `plant/[slug]/narrative/page.tsx` — a head, a bare editor, one
 * link back — with the difference that a sprout has no hub above it to carry
 * its fields, so its head carries them: the name in the h1 with the meta
 * overlay behind it, and state, date and type as three icons under it.
 *
 * WHAT LEFT THIS PAGE, and why each one left:
 *
 *  - The **Preview card**. The editor is a WYSIWYG over the same markdown
 *    `<Prose>` renders, so a preview beside it was a second rendering of the
 *    same bytes. The one place the two can genuinely disagree is the stored
 *    source, which is still here, on the rail.
 *  - The **metadata card** — seven fields in one form, at the bottom of a page
 *    whose subject is prose. Each field is now behind the thing it edits.
 *  - The **Source collapse**, the **Media card** and the **Danger zone**, all
 *    onto the rail: the first because it is a diagnostic and not a body, the
 *    second because a cover decision is not part of writing, the third because
 *    a delete does not belong in the flow of a document.
 *
 * `loadRawGarden`, never the cached reader — this page loads stored markdown
 * into an editor and posts it back, so a cached read is not a slow page, it is
 * an author saving a stale body over a newer one. It is also the FULL dataset
 * on purpose: in the authoring zone a reference to a draft or private entity
 * should resolve and be visible, not vanish the way it does in public.
 */
export default async function AdminSproutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; form?: string }>;
}) {
  const { slug } = await params;
  const { error, form } = await searchParams;

  const sprout = await getSprout(slug);
  if (!sprout) notFound();

  const raw = await loadRawGarden();

  const beanSlug = parentsWithPrefix(sprout.parents, BEAN_PREFIX)[0];
  const bean = beanSlug ? (raw.beans ?? []).find((b) => b.slug === beanSlug) : undefined;
  const backHref = beanSlug ? `/admin/bean/${encodeURIComponent(beanSlug)}` : "/admin/sprouts";
  const backLabel = bean ? resolveText(bean.name) || beanSlug! : beanSlug ? beanSlug : "sprouts";

  // The stored source, for the rail's diagnostic panel.
  const source = resolveText(sprout.content).trim();

  // Which surface a rejected save came from — narrowed here rather than
  // trusted. The value reaches two islands, and an unknown ?form= opens neither
  // and falls through to the page-level banner below.
  const heroForm: Surface | undefined =
    form === "meta" || form === "state" || form === "date" || form === "type" ? form : undefined;
  const railForm = form === "delete" ? "delete" : undefined;

  const railItems: RailItem[] = [
    {
      id: "source",
      label: "Source",
      heading: "Source",
      icon: FileCode2,
      panel: source ? (
        // Read-only, zero JS. It is not a second rendering of the document — it
        // is the stored bytes, and the diagnostic for when the editor's
        // serializer and <Prose>'s parser disagree.
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-heading text-xs whitespace-pre-wrap">
          {source}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      ),
    },
    {
      id: "media",
      label: "Media",
      heading: "Media",
      icon: Images,
      panel: (
        // Its own form — not the content form, not the meta form — which is what
        // keeps each surface's blast radius to its own fields.
        <form action={editSproutMediaAction} className="flex flex-col gap-4">
          <input type="hidden" name="slug" value={sprout.slug} />
          {/* Order is load-bearing and its consequence is invisible from here:
              the first image becomes the bean's public cover. Saying so on
              screen, not only in a comment, is the difference between an
              authoring act and an accident. */}
          <p className="text-xs text-muted-foreground">
            The first image becomes this bean&apos;s cover.
          </p>
          {/* The key re-seeds the island after a save: MediaPicker reads
              `initial` ONCE, in its useState initializer, so without this React
              reconciles the same instance after the action redirects and the
              picker keeps showing its own local state — including a just-added
              link still carrying provider:"" where the server has since derived
              the real one.

              submitLabel, so the button is rendered BY the island: this form's
              entire meaningful content is the picker, and a server-rendered
              button would let a browser post a form carrying nothing — an empty
              media list is indistinguishable from a deliberate clear-all and
              would delete every stored image. lib/media-picker-mount.test.ts
              pins it. */}
          <MediaPicker
            key={JSON.stringify(sprout.media ?? [])}
            name="media"
            initial={sprout.media ?? []}
            links
            submitLabel="Save media"
          />
        </form>
      ),
    },
    {
      id: "delete",
      label: "Delete",
      heading: "Danger zone",
      icon: Trash2,
      panel: <SproutDeleteForm sprout={sprout} {...(railForm && error ? { error } : {})} />,
    },
  ];

  return (
    // EntityRail wraps the WHOLE body: the panel is fixed and the page moves out
    // from under it, so what moves has to be everything — a head that stayed put
    // while the editor slid would read as a glitch rather than as a push.
    <EntityRail label="Sprout panels" items={railItems} openOnError={railForm}>
      <article className="flex flex-col gap-8">
        <a
          href={backHref}
          className="self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← {backLabel}
        </a>

        <SproutHero
          slug={sprout.slug}
          name={resolveText(sprout.name)}
          description={resolveText(sprout.description).trim()}
          state={stateOf(sprout)}
          date={sprout.date}
          type={sprout.type}
          {...(error ? { error } : {})}
          {...(heroForm ? { errorForm: heroForm } : {})}
          metaForm={<SproutMetaForm sprout={sprout} />}
          // Everything the head can write, as stored. STRICT textPart on both
          // halves of each pair, so an fr-only edit still moves the fingerprint
          // — resolveText would fall back and hide it.
          saved={JSON.stringify([
            textPart(sprout.name, "en"),
            textPart(sprout.name, "fr"),
            textPart(sprout.description, "en"),
            textPart(sprout.description, "fr"),
            sprout.date,
            sprout.type,
            stateOf(sprout),
          ])}
        />

        {/* Only an error no surface will show: the head reopens onto a rejected
            meta/state/date/type save and the rail onto a rejected delete, each
            rendering the message inside, so repeating it here would say it
            twice. */}
        {error && !heroForm && !railForm ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* No ContentCard: a card's header above an editor that is the page's
            only content is a frame around the page. STRICT textPart on the load
            — resolveText's fallback would put the fr half into the editor and
            save it back as en. */}
        <ProseEditor
          bare
          float
          initialMarkdown={textPart(sprout.content, "en")}
          entities={entityOptions(raw, `sprout:${sprout.slug}`)}
          action={editContentAction}
          hidden={{ slug: sprout.slug }}
        />
      </article>
    </EntityRail>
  );
}
```

**Note the one deletion this makes possible.** The old page declared a local
`const ATOM_PREFIX = "bean:"` and filtered `parents` by hand — the exact
identifier [#88](https://github.com/alexisbohns/ariko/issues/88) names.
`lib/data.ts:344` has exported `BEAN_PREFIX` all along, beside `PLANT_PREFIX`
and `POD_PREFIX`, and `parentsWithPrefix` (`lib/data.ts:348`) is the function
the plant hub already uses for the same job. So the literal goes, and #88's
sprout share is closed in the read path as well as the write path.

- [ ] **Step 2: Fix the stale path in the media test's comment**

In `lib/media-picker-mount.test.ts`, the comment reads:

```ts
  // The real shape from app/admin/sprout/[slug]/page.tsx: a hidden slug, and
```

Update it to the real path and the panel:

```ts
  // The real shape from app/admin/(chrome)/sprout/[slug]/page.tsx — now the
  // Media panel on that page's rail: a hidden slug, and the picker carrying
  // the form's only submit button.
```

The assertions are unchanged: the form's shape did not change, only where it
is drawn.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors; PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success. This is the step that catches a `node:` module reaching a
client island — the failure mode `lib/sprout-state.ts` exists to prevent, which
nothing earlier would report.

- [ ] **Step 5: Look at it in a browser**

Run: `npm run dev` and open `http://localhost:3333/admin/sprout/<a real slug>`.

Check, in order:
1. The head shows the name, the description and three icons; hovering each
   shows its stored value.
2. Clicking the title opens the overlay; saving a new name closes it and the h1
   changes.
3. Each icon opens its editor; the state's Save is disabled until the pick
   changes.
4. The three rail icons each open a panel; the page slides left on a window
   wider than 1216px and the editor's line breaks DO NOT move.
5. Below 1216px the panel floats over the page instead.
6. The floating button reads "Up to date"; typing turns it green; saving
   returns it to "Up to date".
7. Adding an image in the Media panel, closing the panel and reopening it keeps
   the pending image in the list.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(chrome)/sprout/[slug]/page.tsx" lib/media-picker-mount.test.ts
git commit -m "$(cat <<'EOF'
The sprout's edition page becomes a place to write

Head and editor in the document; source, media and delete on the rail; the
preview card gone, because a WYSIWYG beside a preview is one document rendered
twice.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Remove the whole-form path

**Files:**
- Modify: `app/admin/actions.ts` (delete `editVersionAction`)
- Modify: `lib/botanical.ts` (delete `updateVersion`)
- Modify: `lib/sprout-edit.ts` (down to `shouldCascadePublish`)
- Modify: `lib/sprout-edit.test.ts` (down to its one case)
- Modify: `lib/garden-cache-source.test.ts` (`GARDEN_WRITERS`, one message string)

> Nothing calls any of this as of Task 13. Dead code that reads as a live rule
> is the thing this repo's guidelines name as the easiest defect to ship, so it
> goes in the same branch that orphaned it.

- [ ] **Step 1: Confirm it is genuinely dead**

Run:

```bash
grep -rn "editVersionAction\|buildSproutPatch\|validateSproutPatch\|updateVersion\|SproutPatch" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . | grep -v "^./docs/"
```

Expected: hits ONLY in `app/admin/actions.ts`, `lib/botanical.ts`,
`lib/sprout-edit.ts`, `lib/sprout-edit.test.ts`, `lib/garden-cache-source.test.ts`
and `CLAUDE.md`. A hit anywhere else means Task 13 left a caller behind — stop
and fix that first.

- [ ] **Step 2: Delete `editVersionAction`**

Remove the whole exported function from `app/admin/actions.ts`, and remove
`buildSproutPatch` and `validateSproutPatch` from the `@/lib/sprout-edit`
import — keep `shouldCascadePublish`, which `setSproutStateAction` uses. Remove
`updateVersion` from the `@/lib/botanical` import.

Update the comment above `editContentAction`, which names the function that no
longer exists:

```ts
// Prose only. Deliberately separate from the head's four writes: content
// touches neither `state` nor `visibility`, so there is no cascade to run here.
```

- [ ] **Step 3: Delete `updateVersion`**

Remove the function from `lib/botanical.ts`, and remove `SproutPatch` from its
type imports.

Its docblock carried a claim worth keeping somewhere, because it is now true of
five writers rather than one. Move the surviving half onto `updateSproutMeta`'s
docblock as a closing line:

```ts
 * None of the four touch `slug`, `parents`, `media`, `source` or `content`, so
 * no edit from the head can re-parent a sprout or drop its carried media. That
 * used to be one writer's comment about a spread it performed carefully; it is
 * now a property of there being no spread at all.
```

- [ ] **Step 4: Trim `lib/sprout-edit.ts`**

The file is down to one function. Replace its whole contents with:

```ts
import { DIGEST_TYPE } from "./synthesis";

/**
 * Pure gate for the publish→visibility cascade (final review C1). Digest
 * publication (spec §3) marks review sign-off, not public exhibition: the
 * digest beans/plants are curated private containers, and flipping them public
 * is a separate human act on the bean/plant itself. Every other sprout type
 * keeps cascading on publish.
 *
 * All that is left of this module. It used to carry `SproutPatch`,
 * `buildSproutPatch` and `validateSproutPatch` — the seam under
 * `editVersionAction`, which wrote a sprout's seven editable fields from one
 * form. The sprout's head put each field behind its own surface, so the patch
 * that carried all seven has no form to come from; `lib/sprout-meta.ts` is the
 * seam for the two that are still edited together, and the other three are
 * validated at their own one-field actions.
 */
export function shouldCascadePublish(type: string): boolean {
  return type !== DIGEST_TYPE;
}
```

- [ ] **Step 5: Trim `lib/sprout-edit.test.ts`**

Replace its whole contents with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldCascadePublish } from "./sprout-edit";
import { DIGEST_TYPE } from "./synthesis";

// The publish cascade gate (final review C1): a digest sprout's publish never
// flips its bean/plant public — review sign-off is not public exhibition.
//
// The rest of this file went with buildSproutPatch and validateSproutPatch. The
// cases they covered did not go with them: the bilingual composition and the
// blank-name rejection are lib/sprout-meta.test.ts's now, the state coercion is
// lib/sprout-state.test.ts's, and the date and type guards are the two
// one-field actions' own.

test("shouldCascadePublish: digest sprouts are exempt; every other type cascades", () => {
  assert.equal(shouldCascadePublish(DIGEST_TYPE), false);
  assert.equal(shouldCascadePublish("song"), true);
  assert.equal(shouldCascadePublish("note"), true);
  assert.equal(shouldCascadePublish(""), true);
});
```

Before deleting, re-read the old file and confirm every assertion it made has a
home: bilingual composition and fr-only names → `lib/sprout-meta.test.ts`
(Task 4); blank description → `lib/sprout-meta.test.ts`; state fallback and
unrecognized values → `lib/sprout-state.test.ts` (Task 1) plus
`setSproutStateAction`'s `isSproutState` guard. **If one has no home, add it to
the right new test file in this commit rather than dropping it.**

- [ ] **Step 6: Reconcile `GARDEN_WRITERS`**

In `lib/garden-cache-source.test.ts`, remove `"updateVersion",` from the set.

Update the stale message in "the write path reads the LIVE garden, never the
cached one":

```ts
    `${ACTIONS_PATH} must NOT read the cached garden — setSproutStateAction ` +
      "and promoteSeedAction re-read after writing so publishCascade sees the " +
      "just-saved state, and a cached read there publishes the wrong parents",
```

- [ ] **Step 7: Typecheck, lint, test, build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: no errors; PASS; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add app/admin/actions.ts lib/botanical.ts lib/sprout-edit.ts lib/sprout-edit.test.ts lib/garden-cache-source.test.ts
git commit -m "$(cat <<'EOF'
Delete the sprout's whole-form write path

editVersionAction, SproutPatch, buildSproutPatch, validateSproutPatch and
updateVersion have had no caller since the head landed. lib/sprout-edit.ts is
down to shouldCascadePublish, and every assertion the old test made has a home
in lib/sprout-meta.test.ts or lib/sprout-state.test.ts.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: The guidelines

**Files:**
- Modify: `CLAUDE.md`

> The rulebook records invariants that pass every check while quietly becoming
> false. This slice creates one and extends two; leaving them out is how the
> next slice deletes them by accident.

- [ ] **Step 1: Extend the shared-surfaces list**

In the "Four things the two zones now DRAW FROM ONE FILE" section, amend the
`plant-header.tsx` bullet so it says what the file now is:

```markdown
  - `components/plant-header.tsx` and `components/entity-card.tsx` — the entity
    head and the entity card. Each takes slots or one extra prop where the admin
    genuinely shows more (`refText` on a card in the editor), and nothing else.
    The head's `mark` is OPTIONAL, which is what lets a sprout — which has no
    logo and wants no monogram — draw its name, description and facts from the
    same file a plant does. Absent is a statement about the entity, never a mark
    that failed to load. It is in `lib/server-safe-source.test.ts` now, which it
    should have been from the day it was written.
```

- [ ] **Step 2: Extend the icon-trigger invariant**

In "Rules the tests pin, and why", amend the **An icon trigger names its stored
value** bullet to cover both entities:

```markdown
- **An icon trigger names its stored value.** The plant header's five editors
  and the sprout header's four are icons; the only place a reader learns what
  `status`, `visibility`, `state`, `date` and `type` currently ARE is each
  trigger's accessible name, set on the control rather than on a visible span
  (the hover label is CSS). Replace `Status: Active` or `State: Draft` with a
  bare word and the page looks identical and stops saying what it is.
  `lib/plant-hero-a11y.test.ts` and `lib/sprout-hero-a11y.test.ts` pin it.
```

- [ ] **Step 3: Extend the enum invariant to the sprout's state**

Amend **Neither plant enum writes on the click that opens it** to name the
third:

```markdown
- **No enum writes on the click that opens it.** Three fields work this way now
  — a plant's `status` and `visibility`, and a sprout's `state`. The icon opens
  the vocabulary as a list of native radios, the author picks a member, and a
  Save button commits it — disabled until the pick differs from what is stored,
  so the second click is a confirmation rather than a formality. A one-click
  flip was the first shape tried and the wrong one: a stray click on the globe
  unpublishes a project, and the undo is another stray click on the same pixel.
  The sprout's `state` earns the rule hardest — publishing cascades upward
  through its bean, pod and plant. All three post **a named member of a
  vocabulary** (`lib/plant-status.ts`, `lib/plant-visibility.ts`,
  `lib/sprout-state.ts`) which the action re-validates rather than trusting. A
  sprout's `date` and `type` share the two-act shape but are NOT enums: `type`
  is free-form, so their actions guard only that the field is non-empty.
```

- [ ] **Step 4: Add the new invariant**

Add a bullet after the Exhibition-panel one:

```markdown
- **An entity rail composes no payload, and its panels stay mounted.**
  `app/admin/_components/entity-rail.tsx` takes ids, labels, icons and
  `ReactNode`s; every panel is server-rendered by the page,
  exactly as `metaForm` and the Exhibition panel are.
  `lib/entity-rail-source.test.ts` pins it, and it matters more than its
  sibling because one of these panels is a delete. The panels do NOT unmount on
  close — they go `inert` and translate off-screen — which is the one place the
  "an abandoned pick is not a pending write" rule is deliberately inverted:
  `MediaPicker` uploads to Cloudinary before Save, so unmounting on a mis-click
  would strand assets `npm run check:orphans` then has to find. The push is a
  translate gated at 1216px, because below that width no translate both clears
  a 28rem panel and keeps a 768px column on screen; padding is not an option at
  all, since the page renders inside `READING_COLUMN` and would squeeze the
  editor to ~320px.
```

- [ ] **Step 5: Fix the two stale references**

`CLAUDE.md`'s garden-cache paragraph names `editVersionAction`, which no longer
exists:

```markdown
  the public zone reads the cached one, the admin and **every server action**
  read the live one — because `setSproutStateAction` and `promoteSeedAction`
  re-read *after* writing so `publishCascade` sees the just-saved state, and a
  cached read there computes the cascade against the pre-write garden
```

Then grep the file for other stale names:

```bash
grep -n "editVersionAction\|deleteVersionAction\|updateVersion\|Edit version\|ATOM_PREFIX" CLAUDE.md README.md docs/superpowers/ROADMAP.md
```

`ATOM_PREFIX` should now have NO hit outside the ROADMAP's description of #88 —
Task 13 deleted the literal. Update the ROADMAP's #88 line to say which half is
left:

```markdown
[#88](https://github.com/alexisbohns/ariko/issues/88) — the botanical rename
never finished in the identifiers, the write path, or the strings the author
reads. The sprout's share is done (the edition slice): `ATOM_PREFIX`,
`editVersionAction`, `deleteVersionAction`, `updateVersion`, `deleteVersion`
and the "Edit version" heading are all gone. What is left is the bean, pod and
screen paths.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/ROADMAP.md
git commit -m "$(cat <<'EOF'
The rulebook learns the sprout's head and the entity rail

One invariant added (the rail composes no payload, and why its panels stay
mounted), two extended to a second entity, and every reference to
editVersionAction removed now that it is gone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Verification and the PR

**Files:** none — this task produces evidence and a pull request.

- [ ] **Step 1: Full verification, in one run**

Run:

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: no type errors, no lint errors, all tests pass, build succeeds.
**Paste the actual tail of the output into the task report.** A claim that the
suite passes is not evidence that it did.

- [ ] **Step 2: DB-backed suite**

Run: `npm run test:db`
Expected: PASS (or a clean skip if no `MONGODB_URI` — say which).

- [ ] **Step 3: Confirm the dead names are gone**

```bash
grep -rn "editVersionAction\|buildSproutPatch\|validateSproutPatch\|updateVersion\|deleteVersion\|ATOM_PREFIX\|Edit version" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . | grep -v "^./docs/"
```

Expected: no hits. Hits under `docs/` are history and stay.

- [ ] **Step 4: Open the PR**

````bash
git push -u origin sprout-edition-harmonized
gh pr create --title "The sprout gets a head, and a rail" --body "$(cat <<'EOF'
The first of the edition-page harmonization. `/admin/sprout/[slug]` was a
heading, a preview, an editor, a media card, a source collapse, a seven-field
metadata form and a danger zone, stacked. It is now a head and an editor.

- The **name** is the page's `h1` with a meta overlay behind it, drawn from
  `components/plant-header.tsx` — the same file the plant's head uses, with the
  mark made optional.
- **State, date and type** are three icon triggers, each opening its own editor
  and committing on a second, deliberate click. State takes the publish and
  unpublish cascades with it.
- **Source, media and delete** move onto a right-edge rail behind a push panel.
- The **editor's commit floats** bottom-centre with three states, and "up to
  date" is now a claim backed by a real comparison rather than a leftover flag.

One whole-record write (`editVersionAction` → `updateVersion`) becomes four
narrow actions over four named-field writers. Two shells are extracted for the
bean, pod and screen pages queued behind this one.

Closes the sprout's share of #88.

Spec: `docs/superpowers/specs/2026-09-12-sprout-edition-harmonized-design.md`
Plan: `docs/superpowers/plans/2026-09-12-sprout-edition-harmonized.md`

## Lab Note

```yaml
en:
  title: Writing a sprout is just writing now
  summary: The sprout editor is a page with your words on it and nothing else. Everything it used to stack underneath — the details, the dates, the images — is one click away at the edge, and a little cloud at the bottom tells you the moment your writing is safe.
fr:
  title: Écrire un sprout, c'est enfin juste écrire
  summary: L'éditeur ne montre plus que ton texte. Les détails, la date, les images : tout est à portée d'un clic sur le bord, et un petit nuage en bas te confirme que c'est sauvegardé.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
````

**The Lab Note is required** — this changes what the author sees and does, so it
is not a chore or a refactor. Lead with the benefit, not the mechanism; the
`fr` half is an adaptation in informal "Tu", never a literal translation.

---

## Self-review notes for the executing agent

Three places where this plan asks you to *verify* rather than *apply*. Do not
skip them; each is a place the plan could be wrong about the codebase:

1. **Task 3, Step 1** — read `components/admin/glyphs.test.tsx`'s existing
   render helper and import style before appending. The snippet assumes a
   `render` helper exists; if it is named something else, match the file.
2. **Task 9, Step 4** — if Base UI defers the popover trigger's render past
   mount, `renderToStaticMarkup` will not see the `aria-label`s. Match whatever
   `lib/plant-hero-a11y.test.ts` does to get at the same assertion. Never weaken
   an assertion to make it pass; if the accessible name genuinely cannot be
   server-rendered, that is a finding to report, not a test to soften.
3. **Task 14, Step 5** — before deleting `lib/sprout-edit.test.ts`'s cases,
   confirm each has a home in the new test files. Add any orphan rather than
   dropping it.
