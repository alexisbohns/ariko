# Beanstalk Admin — Edit / Un-publish a Version — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin edit an existing Version's core fields and change its state (including pulling a published Version back to draft/private) from a dedicated `/admin/version/[slug]` page.

**Architecture:** A pure `buildVersionPatch`/`validateVersionPatch` seam (new `lib/version-edit.ts`) feeds a thin server action `editVersionAction` that calls two new write functions `getVersion`/`updateVersion` (`lib/atomic.ts`). Re-publishing reuses the existing upward `publishCascade` + `setPublic`; un-publishing is a bounded, state-only flip (no parent change). The edit form is a `force-dynamic` admin page reached from a per-version link on the atom-detail view. The public site (`force-dynamic`) reflects changes immediately.

**Tech Stack:** Next.js 15 (server components + server actions, route segment config), TypeScript, MongoDB (via existing `lib/db`/`lib/atomic`/`lib/store`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-admin-edit-version-design.md`

**Conventions carried from prior slices:**
- Tests live under `lib/` and run via `npm test` = `node --import tsx --test "lib/**/*.test.ts"`; pure tests need no DB and import by relative path; the `form()` FormData helper mirrors `lib/promote.test.ts`.
- App code imports lib via the `@/*` alias; admin pages are bare functional HTML (no CSS, no client JS) and rely on the existing `/admin/*` middleware for auth; every mutating server action also calls `requireSession()`.
- `params`/`searchParams` in Next 15 pages are `Promise`s and must be awaited. `redirect()` returns `never` (narrows types) and must stay OUT of any `try` (it throws to control flow).
- **Baseline (`main`):** `npm test` → 103 pass / 16 skip; `npx tsc --noEmit` clean.

---

## File Structure

- `lib/version-edit.ts` — **create.** Pure `VersionPatch` type + `buildVersionPatch(form)` + `validateVersionPatch(patch)`.
- `lib/version-edit.test.ts` — **create.** Pure unit tests.
- `lib/atomic.ts` — **modify.** Add `getVersion(slug)` and `updateVersion(slug, patch)`.
- `app/admin/actions.ts` — **modify.** Add `editVersionAction`; extend the `@/lib/atomic` import; import the pure helpers.
- `app/admin/version/[slug]/page.tsx` — **create.** The pre-filled edit form page.
- `app/admin/atom/[id]/page.tsx` — **modify.** Add a per-version `edit` link.
- `README.md` — **modify.** Document the edit/un-publish view.

**Untouched:** `filterPublic`/`getPublicDataset`/`buildDataset`, the public `app/atom/[id]/page.tsx`, `lib/promote.ts`, the create/promote paths, and `lib/data.ts`'s `publishCascade` (reused, not modified).

---

## Task 1: Pure version-edit seam — `lib/version-edit.ts` (TDD)

**Files:**
- Create: `lib/version-edit.ts`
- Test: `lib/version-edit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/version-edit.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVersionPatch, validateVersionPatch } from "./version-edit";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("buildVersionPatch maps and trims the editable fields", () => {
  const p = buildVersionPatch(
    form([
      ["name", "  New name "],
      ["type", " demo "],
      ["date", "2025-05-05"],
      ["description", "  a note "],
      ["state", "published"],
    ]),
  );
  assert.deepEqual(p, {
    name: "New name",
    type: "demo",
    date: "2025-05-05",
    description: "a note",
    state: "published",
  });
});

test("buildVersionPatch: state falls back to draft when missing", () => {
  assert.equal(buildVersionPatch(form([["name", "n"]])).state, "draft");
});

test("buildVersionPatch: state falls back to draft on an unrecognized value", () => {
  assert.equal(buildVersionPatch(form([["state", "bogus"]])).state, "draft");
});

test("buildVersionPatch: accepts private and published", () => {
  assert.equal(buildVersionPatch(form([["state", "private"]])).state, "private");
  assert.equal(buildVersionPatch(form([["state", "published"]])).state, "published");
});

test("validateVersionPatch: passes a complete patch (empty description is allowed)", () => {
  assert.deepEqual(
    validateVersionPatch({ name: "n", type: "t", date: "2025-01-01", description: "", state: "draft" }),
    { ok: true },
  );
});

test("validateVersionPatch: missing name / type / date are each rejected with their message", () => {
  assert.deepEqual(validateVersionPatch({ name: "", type: "t", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "version name is required",
  });
  assert.deepEqual(validateVersionPatch({ name: "n", type: "", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "version type is required",
  });
  assert.deepEqual(validateVersionPatch({ name: "n", type: "t", date: "", description: "", state: "draft" }), {
    ok: false,
    error: "version date is required",
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `./version-edit` cannot be found.

- [ ] **Step 3: Implement `lib/version-edit.ts`**

Create `lib/version-edit.ts`:
```ts
import type { VersionState } from "./data";

// The editable subset of a Version. Structurally the $set payload for updateVersion.
export interface VersionPatch {
  name: string;
  type: string;
  date: string;
  description: string;
  state: VersionState;
}

// Pure. Maps the edit form → the editable subset. Trims strings; state falls back to
// "draft" on a missing/unrecognized value (only "private"/"published" override).
export function buildVersionPatch(form: FormData): VersionPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: VersionState =
    stateRaw === "published" || stateRaw === "private" ? stateRaw : "draft";
  return {
    name: get("name"),
    type: get("type"),
    date: get("date"),
    description: get("description"),
    state,
  };
}

// Pure guard for the required editable fields (slug is immutable / from the route, so
// it is not validated here; description is optional). Mirrors validateVersionInput.
export function validateVersionPatch(
  p: VersionPatch,
): { ok: true } | { ok: false; error: string } {
  if (!p.name) return { ok: false, error: "version name is required" };
  if (!p.type) return { ok: false, error: "version type is required" };
  if (!p.date) return { ok: false, error: "version date is required" };
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — new `version-edit` tests green; existing tests still green (103 → ~110 pass, 16 skip).

- [ ] **Step 5: Commit**

```bash
git add lib/version-edit.ts lib/version-edit.test.ts
git commit -m "feat: pure version-edit seam (buildVersionPatch + validateVersionPatch)"
```

---

## Task 2: Write layer — `getVersion` + `updateVersion` in `lib/atomic.ts`

**Files:**
- Modify: `lib/atomic.ts`

- [ ] **Step 1: Add the import for `VersionPatch`**

At the top of `lib/atomic.ts`, next to the existing `import type { VersionInput } from "./promote";`, add:
```ts
import type { VersionPatch } from "./version-edit";
```

- [ ] **Step 2: Add `getVersion` and `updateVersion`**

Append these two functions to `lib/atomic.ts` (e.g. after `createVersion`):
```ts
// Single-version read for the edit-page prefill (projection drops _id).
export async function getVersion(slug: string): Promise<Version | null> {
  const db = await getDb();
  return db.collection<Version>("versions").findOne({ slug }, { projection: { _id: 0 } });
}

// Updates ONLY the editable fields via $set. Never touches slug / parents / media /
// source / content, so an edit can never re-parent or drop carried media. slug is
// immutable, so there is no unique-index collision path here.
export async function updateVersion(slug: string, patch: VersionPatch): Promise<void> {
  const db = await getDb();
  await db.collection<Version>("versions").updateOne({ slug }, { $set: { ...patch } });
}
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; tests unchanged (110 pass / 16 skip — these are DB functions, exercised by the Task 4 smoke, not new unit tests, per the no-DB-in-`npm test` convention).

- [ ] **Step 4: Commit**

```bash
git add lib/atomic.ts
git commit -m "feat: getVersion + updateVersion (edit write path)"
```

---

## Task 3: The edit page + action + atom-detail link

**Files:**
- Modify: `app/admin/actions.ts`
- Create: `app/admin/version/[slug]/page.tsx`
- Modify: `app/admin/atom/[id]/page.tsx`

- [ ] **Step 1: Add `editVersionAction` to `app/admin/actions.ts`**

First, extend the existing `@/lib/atomic` import to include the two new functions. Change:
```ts
import { createMolecule, createAtom, createVersion, setPublic, SlugExistsError } from "@/lib/atomic";
```
to:
```ts
import {
  createMolecule,
  createAtom,
  createVersion,
  setPublic,
  SlugExistsError,
  getVersion,
  updateVersion,
} from "@/lib/atomic";
```

Then add the pure-helper import (next to the existing `import { resolveParentChoice, buildVersionInput, validateVersionInput } from "@/lib/promote";`):
```ts
import { buildVersionPatch, validateVersionPatch } from "@/lib/version-edit";
```

Then append this action at the end of the file (`publishCascade`, `loadRawSeed`, `redirect`, `revalidatePath`, `requireSession` are already imported):
```ts
export async function editVersionAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const existing = await getVersion(slug);
  if (!existing) redirect("/admin/vault");

  const patch = buildVersionPatch(formData);
  const check = validateVersionPatch(patch);
  if (!check.ok) {
    redirect(`/admin/version/${slug}?error=${encodeURIComponent(check.error)}`);
  }

  await updateVersion(slug, patch);

  // Re-publish reuses the upward, idempotent cascade (same as promote). Un-publishing
  // (draft/private) is state-only — parents are intentionally left as-is.
  if (patch.state === "published") {
    const { moleculeSlugs, atomSlugs } = publishCascade(await loadRawSeed(), slug);
    await setPublic(moleculeSlugs, atomSlugs);
  }

  revalidatePath("/admin");
  const atomSlug = existing.parents
    .filter((p) => p.startsWith("atom:"))
    .map((p) => p.slice("atom:".length))[0];
  redirect(atomSlug ? `/admin/atom/${atomSlug}` : "/admin/vault");
}
```
(`redirect()` returns `never`, so after `if (!existing) redirect(...)` TypeScript narrows `existing` to `Version` — the same pattern `promoteCaptureAction` uses with `capture`.)

- [ ] **Step 2: Create the edit page `app/admin/version/[slug]/page.tsx`**

Bare semantic HTML, no CSS, mirroring the triage form:
```tsx
import { notFound } from "next/navigation";
import { getVersion } from "@/lib/atomic";
import { editVersionAction } from "../../actions";

export const dynamic = "force-dynamic";

const ATOM_PREFIX = "atom:";

export default async function EditVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const version = await getVersion(slug);
  if (!version) notFound();

  const atomSlug = (version.parents ?? [])
    .filter((p) => p.startsWith(ATOM_PREFIX))
    .map((p) => p.slice(ATOM_PREFIX.length))[0];
  const backHref = atomSlug ? `/admin/atom/${atomSlug}` : "/admin/vault";

  return (
    <article>
      <p>
        <a href={backHref}>← back</a>
      </p>
      <h1>Edit version</h1>
      {error ? <p role="alert">Could not save: {error}</p> : null}

      <ul>
        <li>slug: {version.slug}</li>
        <li>atom: {atomSlug ?? "—"}</li>
      </ul>

      <form action={editVersionAction}>
        <input type="hidden" name="slug" value={version.slug} />
        <p>
          <label>
            Name <input type="text" name="name" defaultValue={version.name} required />
          </label>
        </p>
        <p>
          <label>
            Type <input type="text" name="type" defaultValue={version.type} required />
          </label>
        </p>
        <p>
          <label>
            Date <input type="date" name="date" defaultValue={version.date} required />
          </label>
        </p>
        <p>
          <label>
            Description <textarea name="description" defaultValue={version.description} />
          </label>
        </p>
        <fieldset>
          <legend>State</legend>
          <label>
            <input
              type="radio"
              name="state"
              value="draft"
              defaultChecked={version.state === "draft" || version.state == null}
            />{" "}
            draft
          </label>
          <label>
            <input type="radio" name="state" value="private" defaultChecked={version.state === "private"} />{" "}
            private
          </label>
          <label>
            <input type="radio" name="state" value="published" defaultChecked={version.state === "published"} />{" "}
            published
          </label>
        </fieldset>
        <p>
          <button type="submit">Save</button>
        </p>
      </form>
    </article>
  );
}
```

- [ ] **Step 3: Add the per-version `edit` link on the atom-detail page**

In `app/admin/atom/[id]/page.tsx`, inside the `versions.map(...)` block, the version section currently starts:
```tsx
          <section key={version.slug}>
            <h3>{version.name}</h3>
            <p>state: {version.state ?? "—"}</p>
```
Insert an edit link immediately after the `<h3>` line, so it becomes:
```tsx
          <section key={version.slug}>
            <h3>{version.name}</h3>
            <p>
              <a href={`/admin/version/${version.slug}`}>edit</a>
            </p>
            <p>state: {version.state ?? "—"}</p>
```
Change nothing else in the file.

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; tests green (110 pass / 16 skip — pages/actions are glue, exercised by the Task 4 smoke).

- [ ] **Step 5: Commit**

```bash
git add app/admin/actions.ts "app/admin/version/[slug]/page.tsx" "app/admin/atom/[id]/page.tsx"
git commit -m "feat: /admin/version/[slug] edit page + editVersionAction (edit/un-publish)"
```

---

## Task 4: End-to-end smoke + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pure tests pass (incl. the new `version-edit` suite); DB-guarded tests skip; no type errors.

- [ ] **Step 2: Smoke — edit + publish/un-publish (against the dev DB)**

Start the dev server (`npm run dev`), logged in as admin. From `/admin/vault`, open a version's atom-detail page (`/admin/atom/<slug>`), click a version's **edit** link, and:
- Change `name`/`date`/`description` → Save → confirm the redirect lands on the atom-detail page and the new values show; reopen the edit page and confirm they persisted.
- Set a currently-draft version to **published** → Save → confirm it appears on the public `/timeline` and its parent atom/molecule are now public (check `/admin/atom/<slug>` shows `visibility: public`).
- Set a currently-published version back to **draft** → Save → confirm it disappears from the public `/timeline`; the parent atom stays `public` (accepted, per the design's state-only decision).
- Submit with a blank **name** → confirm the `Could not save: version name is required` alert on the edit page and that nothing was written (reload shows the old name).
- Visit `/admin/version/definitely-not-real` → 404; and `/admin/version/<slug>` without a session cookie → 307 redirect.
Clean up any test data you changed (restore states you flipped).

- [ ] **Step 3: Document in the README**

In `README.md`, immediately AFTER the existing `### /admin/atom/[id]` subsection (before the final `See docs/...` line), add:
```markdown
### /admin/version/[slug]

A dedicated edit page for a single Version, reached from each version's `edit` link on the atom-detail view.

* Editable: `name`, `type`, `date`, `description`, and `state` (draft/private/published). The `slug` is immutable (identity); re-parenting, media, source, content, and tags are out of scope.
* Re-publishing (→ `published`) runs the same upward `publishCascade` as promote, flipping the parent atom/molecule public. Un-publishing (→ `draft`/`private`) is state-only — it hides the version from the public site immediately (`force-dynamic`) but leaves parents as-is, so a parent may remain public with no published version (cosmetic, not a leak; a downward "recompute visibility" pass is a later slice).
* Read-only `slug`/atom context is shown; a blank required field re-renders with an error and writes nothing. Gated by the `/admin/*` middleware and the action's `requireSession()`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the admin edit/un-publish Version page"
```

---

## Done — what this delivers

- A pure, unit-tested `buildVersionPatch`/`validateVersionPatch` seam and two write functions (`getVersion`/`updateVersion`) that touch only the editable fields.
- A dedicated `/admin/version/[slug]` edit page (launched from the atom-detail view) + `editVersionAction`: correct a Version's fields, publish it (reusing the upward cascade), or pull it back to draft/private (state-only).
- The public site reflects every change immediately (`force-dynamic`); `filterPublic` and all create/promote paths are untouched.

## Deferred to later specs

- ~~Downward visibility recompute / auto-re-privatizing empty public parents on un-publish.~~
  **Shipped** as A1 (`2026-07-14-beanstalk-admin-recompute-visibility.md`).
- Editing `slug`, re-parenting, `media`, `source`, `content`, `tags`; deleting a Version outright.

## Notes / small risks to watch during execution

- **`redirect()` must stay outside any `try`** (it throws `NEXT_REDIRECT` to control flow). All redirects here are already at statement level. Its `never` return type is what narrows `existing` to non-null after the not-found guard.
- **`updateVersion` `$set` payload is exactly `VersionPatch`** — do not spread `existing` or add fields; the whole point is that `parents`/`media`/`source`/`content` are never rewritten.
- **`existing.parents`** is `string[]` (required on `Version`), so the `atomSlug` computation needs no `?? []`; the page uses `version.parents ?? []` defensively since it reads a fresh doc, which is harmless.
- **Un-publish leaves parents public by design** — verifying "parent stays public" in the smoke is confirming intended behavior, not a bug.
