# Bilingual Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the author switch any article editor (sprout body, plant narrative, pod narrative) to its French half with `?lang=fr`, write it, and save it without touching the English half.

**Architecture:** A pure server-side module (`lib/edit-lang.ts`) reads `?lang=`, decides what an editor opens on, builds the EN/FR hrefs and validates the posted `lang`. `buildContentPatch` gains a required `lang` and writes only that half. `extractRefs` reads both halves. `ProseEditor` draws a small `EditLangSwitch` (disabled while dirty) and a "Start from English" action. Three pages wire it together.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript, Tiptap 3 + `@tiptap/markdown`, `node:test` via `tsx`.

**Spec:** [`docs/superpowers/specs/2026-09-24-bilingual-editing-design.md`](../specs/2026-09-24-bilingual-editing-design.md)

**Branch:** `bilingual-editing` (already created; the spec is committed on it).

**Commands used throughout:**
- One test file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/<file>.test.ts`
- All tests: `npm test`
- Types: `npx tsc --noEmit`
- Lint: `npm run lint`

**Git identity:** before the first commit, run `git config user.email` — it must print `hello@bohns.design`. End every commit message with:

```
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/entity-refs.ts` | modify | `extractRefs` reads the union of both halves |
| `lib/entity-refs.test.ts` | modify | refs from `fr` |
| `lib/content-edit.ts` | modify | `buildContentPatch(current, markdown, lang)` writes one half |
| `lib/content-edit.test.ts` | modify | the French write paths |
| `lib/edit-lang.ts` | create | `editLang`, `editorHalves`, `editLangHrefs`, `parseEditLangField`, `withEditLang` |
| `lib/edit-lang.test.ts` | create | all of the above |
| `lib/admin-lang-middleware.test.ts` | create | `/admin?lang=fr` passes through the middleware intact |
| `app/admin/actions.ts` | modify | both content actions read `lang` and redirect back onto it |
| `components/editor/edit-lang-switch.tsx` | create | the EN/FR links, disabled while dirty |
| `lib/edit-lang-switch-render.test.tsx` | create | SSR of the switch |
| `components/editor/prose-editor.tsx` | modify | `langSwitch`, `seed`, `lang` attribute |
| `lib/edit-lang-source.test.ts` | create | source pins: editor disables on dirty; pages load via `editorHalves` and key on `lang` |
| `app/admin/_components/content-card.tsx` | modify | forwards `lang` / `langHrefs` |
| `app/admin/(chrome)/sprout/[slug]/page.tsx` | modify | wires lang |
| `app/admin/(chrome)/plant/[slug]/narrative/page.tsx` | modify | wires lang |
| `app/admin/(chrome)/pod/[slug]/page.tsx` | modify | wires lang |
| `CLAUDE.md` | modify | one bullet under "Rules the tests pin" |

---

### Task 1: `extractRefs` reads both halves

**Files:**
- Modify: `lib/entity-refs.ts` (the `extractRefs` function, ~line 132, and the import on line 1)
- Test: `lib/entity-refs.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/entity-refs.test.ts`:

```ts
test("a ref that lives only in the fr half is extracted", () => {
  // Once the French body is editable, a card embedded only there must still
  // mirror into relations — or it is off the graph and outside filterPublic.
  assert.deepEqual(
    extractRefs({ en: "just prose", fr: "::entity{ref=bean:k}\n\nvoir :entity[ici]{ref=plant:p}" }),
    [
      { kind: "embeds", ref: "bean:k" },
      { kind: "mentions", ref: "plant:p" },
    ],
  );
});

test("a ref in both halves appears once, English refs first", () => {
  assert.deepEqual(
    extractRefs({ en: "::entity{ref=bean:a}", fr: "::entity{ref=bean:b}\n\n::entity{ref=bean:a}" }),
    [
      { kind: "embeds", ref: "bean:a" },
      { kind: "embeds", ref: "bean:b" },
    ],
  );
});

test("a code fence in the fr half hides its refs, as it does in en", () => {
  assert.deepEqual(extractRefs({ en: "", fr: "```\n::entity{ref=bean:k}\n```" }), []);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/entity-refs.test.ts`
Expected: FAIL on the first two new tests (the `fr` refs are missing because `resolveText` reads `en` only).

- [ ] **Step 3: Implement**

In `lib/entity-refs.ts`, replace the whole `extractRefs` function with:

```ts
// Pure. The refs a document points at, as relations ready to mirror.
//
// BOTH halves, English first. It used to read `resolveText(content)` — the en
// half, or fr only when en was blank — which was harmless while nothing could
// write a French body and became a hole the day something could: a card
// embedded only in the French text would never mirror into `relations`, so it
// would be off the graph and outside the scrub filterPublic runs on them.
// English first keeps the output byte-identical for every English-only document.
export function extractRefs(content: Text | undefined): Relation[] {
  const out: Relation[] = [];
  const seen = new Set<string>();
  const add = (kind: string, ref: string) => {
    const key = `${kind} ${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, ref });
  };
  for (const lang of ["en", "fr"] as const) {
    const raw = textPart(content, lang);
    if (!raw.trim()) continue;
    const source = stripCode(raw);
    for (const m of source.matchAll(BLOCK)) add("embeds", m[1]);
    for (const m of source.matchAll(INLINE)) add("mentions", m[1]);
  }
  return out;
}
```

Change line 1's import to take `textPart`. If `resolveText` is no longer used anywhere else in the file (check with `grep -n resolveText lib/entity-refs.ts`), drop it:

```ts
import { textPart, type Relation, type Text } from "./data";
```

- [ ] **Step 4: Run the file, then the suite**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/entity-refs.test.ts`
Expected: PASS, including the existing `"duplicates collapse, and a localized value reads its en part"` test.

Run: `npm test`
Expected: PASS (the article door, the garden-plant script and `buildContentPatch` all call `extractRefs`; the first two already write French bodies and inherit the fix; the suite must still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/entity-refs.ts lib/entity-refs.test.ts
git commit -m "Mirror refs from both halves of an article

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `buildContentPatch` writes one named half

**Files:**
- Modify: `lib/content-edit.ts`
- Modify: `app/admin/actions.ts:306` and `app/admin/actions.ts:564` (pass `"en"` for now; Task 4 threads the real value)
- Test: `lib/content-edit.test.ts`

- [ ] **Step 1: Update the existing calls in the test file and add the failing tests**

In `lib/content-edit.test.ts`, every existing `buildContentPatch(a, b)` becomes `buildContentPatch(a, b, "en")` — the existing tests describe English saves and must keep passing unchanged in meaning. Then append:

```ts
test("a French save over a plain string makes it bilingual", () => {
  const result = buildContentPatch({ content: "english" }, "français", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, { en: "english", fr: "français" });
});

test("a French save leaves the English half byte-identical", () => {
  const en = "  # Title\n\ntrailing spaces kept  \n";
  const result = buildContentPatch({ content: { en, fr: "ancien" } }, "nouveau", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, { en, fr: "nouveau" });
});

test("clearing the French half un-translates the article back to a plain string", () => {
  const result = buildContentPatch({ content: { en: "english", fr: "français" } }, "", "fr");
  assert.equal(result.ok && result.dirty && result.patch.content, "english");
  // Whitespace-only counts as blank.
  const ws = buildContentPatch({ content: { en: "english", fr: "français" } }, " \n ", "fr");
  assert.equal(ws.ok && ws.dirty && ws.patch.content, "english");
});

test("an English-blank document stores only its French half", () => {
  const result = buildContentPatch({}, "seulement", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, { fr: "seulement" });
  const cleared = buildContentPatch({ content: { en: "english", fr: "français" } }, "", "en");
  assert.deepEqual(cleared.ok && cleared.dirty && cleared.patch.content, { fr: "français" });
});

test("an untouched French save is not dirty", () => {
  assert.deepEqual(buildContentPatch({ content: { en: "e", fr: "f" } }, "f", "fr"), { ok: true, dirty: false });
  // Opening the French view of an English-only article and saving it empty
  // writes nothing — the editor's own gate normally stops this first.
  assert.deepEqual(buildContentPatch({ content: "english" }, "", "fr"), { ok: true, dirty: false });
});

test("French refs mirror into relations", () => {
  const result = buildContentPatch({ content: "prose" }, "::entity{ref=bean:k}", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [{ kind: "embeds", ref: "bean:k" }]);
});

test("the ceiling applies to the half being written", () => {
  // Each half may be close to the ceiling: the article door's limit was always
  // about one document in one language.
  const near = "x".repeat(MAX_CONTENT_BYTES - 1);
  const ok = buildContentPatch({ content: { en: near } }, near, "fr");
  assert.equal(ok.ok, true);
  const over = buildContentPatch({ content: "short" }, "x".repeat(MAX_CONTENT_BYTES + 1), "fr");
  assert.equal(over.ok, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/content-edit.test.ts`
Expected: FAIL — the French tests produce `{ en: "français", … }` because the function ignores its third argument.

- [ ] **Step 3: Implement**

Replace `lib/content-edit.ts` from the `buildContentPatch` docblock to the end of the file with:

```ts
/**
 * Pure. Turns the editor's markdown into the fields to write, or says the
 * document is unchanged.
 *
 * Rules, from the Tiptap spec and the bilingual-editing spec:
 *  - §2.5 dirty-gating: an untouched open-and-save writes NOTHING, so reading a
 *    bee-written digest can never silently normalize it.
 *  - Bilingual safety: the editor edits ONE half, named by `lang`, and the
 *    other half is carried back verbatim. `lang` is REQUIRED, never defaulted —
 *    a default of "en" is exactly the value under which a future call site
 *    would silently write French text into the English half.
 *  - §2.10 mirroring: existing relations are PASSED IN, so hand-authored kinds
 *    survive. `lib/articles-store.ts` passes `undefined` here, which is right
 *    for a door that only writes unreviewed sprouts and wrong for an edit path.
 */
export function buildContentPatch(current: ContentOwner, markdown: string, lang: Lang): ContentPatchResult {
  if (new TextEncoder().encode(markdown).length > MAX_CONTENT_BYTES) {
    return { ok: false, error: `content exceeds ${MAX_CONTENT_BYTES / 1024} KiB` };
  }

  const stored = current.content;
  // textPart is STRICT — no fallback across halves, which is exactly what the
  // load side uses (lib/edit-lang.ts `editorHalves`). The two must agree or a
  // save would compare the editor's text against a string it was never given.
  if (textPart(stored, lang) === markdown) return { ok: true, dirty: false };

  const en = lang === "en" ? markdown : textPart(stored, "en");
  const fr = lang === "fr" ? markdown : textPart(stored, "fr");
  const content = composeBody(en, fr);

  return {
    ok: true,
    dirty: true,
    patch: { content, relations: mergeMirrored(current.relations, extractRefs(content)) },
  };
}

/**
 * `composeText`'s shape (lib/data.ts) WITHOUT its trimming: markdown whitespace
 * is meaningful, so a half is stored exactly as the editor serialized it.
 * "Blank" means blank once trimmed. A blank fr collapses to a plain string —
 * clearing the French body un-translates the article, and simple content stays
 * simple.
 */
function composeBody(en: string, fr: string): Text {
  const hasEn = en.trim() !== "";
  if (fr.trim() === "") return hasEn ? en : "";
  return hasEn ? { en, fr } : { fr };
}
```

And update the imports at the top of `lib/content-edit.ts`:

```ts
import type { Relation, Text } from "./data";
import { textPart } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import type { Lang } from "./locale";
```

- [ ] **Step 4: Keep the actions compiling**

In `app/admin/actions.ts`, change both calls (lines ~306 and ~564):

```ts
  const result = buildContentPatch(existing, markdown, "en");
```

(Task 4 replaces `"en"` with the posted language.)

- [ ] **Step 5: Run tests and types**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/content-edit.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/content-edit.ts lib/content-edit.test.ts app/admin/actions.ts
git commit -m "Write one named half of an article at a time

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `lib/edit-lang.ts`

**Files:**
- Create: `lib/edit-lang.ts`
- Test: `lib/edit-lang.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/edit-lang.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { editLang, editLangHrefs, editorHalves, parseEditLangField, withEditLang } from "./edit-lang";

test("editLang reads the URL tolerantly and defaults to English", () => {
  assert.equal(editLang("fr"), "fr");
  assert.equal(editLang("FR"), "fr");
  assert.equal(editLang("fr-CA"), "fr");
  assert.equal(editLang("en"), "en");
  assert.equal(editLang("de"), "en");
  assert.equal(editLang(undefined), "en");
  // Next hands a repeated parameter over as an array — not a language.
  assert.equal(editLang(["fr", "en"]), "en");
});

test("editorHalves: English opens on the English half, never a seed", () => {
  assert.deepEqual(editorHalves({ en: "e", fr: "f" }, "en"), { initialMarkdown: "e" });
  assert.deepEqual(editorHalves({ fr: "f" }, "en"), { initialMarkdown: "" });
});

test("editorHalves: French over an English-only article opens EMPTY with the English as seed", () => {
  // The whole point of the strict read: the French editor must never open
  // holding English text that a Save would store as French.
  assert.deepEqual(editorHalves("english body", "fr"), { initialMarkdown: "", seed: "english body" });
  assert.deepEqual(editorHalves({ en: "english", fr: "  " }, "fr"), { initialMarkdown: "  ", seed: "english" });
});

test("editorHalves: French with a French half has no seed; nothing to seed from, no seed", () => {
  assert.deepEqual(editorHalves({ en: "e", fr: "f" }, "fr"), { initialMarkdown: "f" });
  assert.deepEqual(editorHalves(undefined, "fr"), { initialMarkdown: "" });
  assert.deepEqual(editorHalves({ en: " ", fr: "" }, "fr"), { initialMarkdown: "" });
});

test("editLangHrefs: en is the clean URL, fr sets lang=fr", () => {
  assert.deepEqual(editLangHrefs("/admin/sprout/a", {}), {
    en: "/admin/sprout/a",
    fr: "/admin/sprout/a?lang=fr",
  });
});

test("editLangHrefs keeps the scope and drops lang, error and form", () => {
  // A switch is a fresh view: a rejected save's banner belongs to the half
  // that received the save.
  const hrefs = editLangHrefs("/admin/pod/p", { plant: "ariko", lang: "fr", error: "boom", form: "meta" });
  assert.deepEqual(hrefs, { en: "/admin/pod/p?plant=ariko", fr: "/admin/pod/p?plant=ariko&lang=fr" });
});

test("editLangHrefs encodes what it keeps", () => {
  assert.equal(editLangHrefs("/admin/pod/p", { q: "a b&c" }).en, "/admin/pod/p?q=a+b%26c");
});

test("parseEditLangField: absent is English, a language is itself, anything else is refused", () => {
  // Absent: every editor before this slice posted English with no lang field,
  // and a tab left open across the deploy must keep saving where it did.
  assert.deepEqual(parseEditLangField(null), { ok: true, lang: "en" });
  assert.deepEqual(parseEditLangField("en"), { ok: true, lang: "en" });
  assert.deepEqual(parseEditLangField("fr"), { ok: true, lang: "fr" });
  // Strict: the editor posts exactly "en" or "fr". Anything else was not
  // posted by it, and guessing which half it meant is the one thing a write
  // path must not do.
  assert.equal(parseEditLangField("de").ok, false);
  assert.equal(parseEditLangField("FR").ok, false);
  assert.equal(parseEditLangField("").ok, false);
});

test("withEditLang appends lang=fr, and leaves English hrefs alone", () => {
  assert.equal(withEditLang("/admin/pod/p", "en"), "/admin/pod/p");
  assert.equal(withEditLang("/admin/pod/p", "fr"), "/admin/pod/p?lang=fr");
  assert.equal(withEditLang("/admin/pod/p?error=x", "fr"), "/admin/pod/p?error=x&lang=fr");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang.test.ts`
Expected: FAIL — `Cannot find module './edit-lang'`.

- [ ] **Step 3: Implement**

Create `lib/edit-lang.ts`:

```ts
import { textPart, type Text } from "./data";
import { isLang, parseLang, type Lang } from "./locale";

/**
 * Which half of an article the admin is editing — `?lang=fr` on the editing
 * page, and nothing else.
 *
 * In the URL, per page, and never a cookie: the admin's subject lives in the
 * URL (lib/admin-scope.ts), and a cookie would make one URL mean two different
 * editors — an author typing French into what they believe is the English body
 * is the confusion this exists to prevent.
 *
 * The parameter shares its NAME with the public zone's, and that is safe only
 * because middleware.ts's language branch runs on paths that do not start with
 * /admin. lib/admin-lang-middleware.test.ts pins it.
 *
 * SERVER-SIDE: it reads `Text` through `textPart`, and lib/data.ts opens with
 * `node:fs`. The editor island never imports this file.
 */

const LANG_PARAM = "lang";

/** The URL's answer. Anything that is not a language is English, never an error — it came from a URL bar. */
export function editLang(param: unknown): Lang {
  return parseLang(param) ?? "en";
}

/**
 * What an editor opens on. STRICT `textPart`, so an empty French half opens as
 * an empty editor and never as the English body wearing a French label. When
 * the French half is blank and the English is not, the English comes along as
 * `seed` — the "Start from English" action's material, which writes nothing
 * until the author saves.
 */
export function editorHalves(content: Text | undefined, lang: Lang): { initialMarkdown: string; seed?: string } {
  const initialMarkdown = textPart(content, lang);
  if (lang === "en" || initialMarkdown.trim() !== "") return { initialMarkdown };
  const en = textPart(content, "en");
  return en.trim() !== "" ? { initialMarkdown, seed: en } : { initialMarkdown };
}

// A switch is a fresh view. `error` and `form` describe a rejected save, which
// belongs to the half that received it.
const DROPPED = new Set([LANG_PARAM, "error", "form"]);

/** The switch's two links. Every other parameter (the `?plant=` scope among them) is kept. */
export function editLangHrefs(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): Record<Lang, string> {
  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (DROPPED.has(key) || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) kept.append(key, v);
  }
  const build = (lang: Lang): string => {
    const params = new URLSearchParams(kept);
    if (lang === "fr") params.set(LANG_PARAM, "fr");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  return { en: build("en"), fr: build("fr") };
}

export type EditLangField = { ok: true; lang: Lang } | { ok: false; error: string };

/**
 * The posted half, as the content actions read it. ABSENT is English: every
 * editor before this slice posted no `lang`, and a tab left open across the
 * deploy must keep saving where it always did. PRESENT is strict — the editor
 * posts exactly "en" or "fr", so anything else was not posted by it.
 */
export function parseEditLangField(value: FormDataEntryValue | null): EditLangField {
  if (value === null) return { ok: true, lang: "en" };
  return isLang(value) ? { ok: true, lang: value } : { ok: false, error: "unknown language" };
}

/** A redirect target that lands back on the half that was saved. */
export function withEditLang(href: string, lang: Lang): string {
  if (lang === "en") return href;
  return `${href}${href.includes("?") ? "&" : "?"}${LANG_PARAM}=fr`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/edit-lang.ts lib/edit-lang.test.ts
git commit -m "Name the half of an article being edited

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The content actions save the posted half, and the middleware leaves it alone

**Files:**
- Modify: `app/admin/actions.ts` (`editContentAction` ~line 298, `editContainerContentAction` ~line 548, imports)
- Create: `lib/admin-lang-middleware.test.ts`

- [ ] **Step 1: Write the middleware test**

Create `lib/admin-lang-middleware.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { COOKIE_NAME, createSessionValue } from "./session";
import { LANG_COOKIE } from "./locale";

/**
 * The admin's `?lang=fr` names the half of an article being edited
 * (lib/edit-lang.ts) and shares its NAME with the public zone's reading
 * preference, which middleware.ts turns into a cookie and strips with a
 * redirect. That branch must never see an /admin path: if it did, every French
 * editor would bounce back to English, with nothing failing in tsc, npm test or
 * npm run build — the page would simply always open in English.
 */

const SECRET = "s".repeat(32);

test("an authenticated /admin request keeps ?lang=fr and sets no reading cookie", async () => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
  const session = await createSessionValue(SECRET, Date.now());
  const response = await middleware(
    new NextRequest("http://localhost/admin/sprout/a?lang=fr", { headers: { cookie: `${COOKIE_NAME}=${session}` } }),
  );
  // NextResponse.next() — a pass-through, not a redirect.
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.cookies.get(LANG_COOKIE), undefined);
});

test("the public branch still turns ?lang= into a cookie (the contrast this file relies on)", async () => {
  const response = await middleware(new NextRequest("http://localhost/beanstalk?lang=fr"));
  assert.equal(response.status, 307);
  assert.equal(response.cookies.get(LANG_COOKIE)?.value, "fr");
});
```

- [ ] **Step 2: Run it**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/admin-lang-middleware.test.ts`
Expected: PASS. (It pins behaviour that already exists. To see it fail, temporarily move the `if (!pathname.startsWith("/admin"))` block's condition to `if (true)` in `middleware.ts` and re-run — the first test fails — then revert.)

- [ ] **Step 3: Thread `lang` through `editContentAction`**

In `app/admin/actions.ts`, add to the imports:

```ts
import { parseEditLangField, withEditLang } from "@/lib/edit-lang";
```

Replace `editContentAction` with:

```ts
// Prose only. Deliberately separate from the head's four writes: content
// touches neither `state` nor `visibility`, so there is no cascade to run here.
//
// One HALF of the prose, named by the posted `lang` (lib/edit-lang.ts), and
// every redirect lands back on that half — a French save that returned the
// author to the English editor would read as the French text having vanished.
export async function editContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/sprout/${encodeURIComponent(slug)}`;
  const field = parseEditLangField(formData.get("lang"));
  if (!field.ok) {
    redirect(`${back}?error=${encodeURIComponent(`could not save content: ${field.error}`)}`);
  }

  const result = buildContentPatch(existing, markdown, field.lang);
  if (!result.ok) {
    redirect(
      withEditLang(`${back}?error=${encodeURIComponent(`could not save content: ${result.error}`)}`, field.lang),
    );
  }
  // Dirty-gated (spec §2.5): opening a digest and saving it untouched writes
  // nothing at all, so reading can never normalize what a bee wrote.
  if (result.dirty) await updateSproutContent(slug, result.patch);

  revalidateGarden();
  redirect(withEditLang(back, field.lang));
}
```

- [ ] **Step 4: Thread `lang` through `editContainerContentAction`**

In the same file, inside `editContainerContentAction`, replace everything from `const back = …` to the end of the function with:

```ts
  const back = isPlant ? narrativeHref(slug) : `/admin/pod/${encodeURIComponent(slug)}`;
  const field = parseEditLangField(formData.get("lang"));
  if (!field.ok) {
    redirect(`${back}?error=${encodeURIComponent(`could not save content: ${field.error}`)}`);
  }

  const result = buildContentPatch(existing, markdown, field.lang);
  if (!result.ok) {
    redirect(
      withEditLang(`${back}?error=${encodeURIComponent(`could not save content: ${result.error}`)}`, field.lang),
    );
  }
  if (result.dirty) {
    if (isPlant) await updatePlantContent(slug, result.patch);
    else await updatePodContent(slug, result.patch);
  }

  revalidateGarden();
  redirect(withEditLang(back, field.lang));
}
```

Also add one sentence to that function's docblock (above `export async function editContainerContentAction`), after its last line:

```ts
// One half of the prose, named by the posted `lang`, and every redirect lands
// back on that half — see editContentAction.
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (`field` narrows to `{ ok: true }` after the `redirect`, which returns `never`).

Run: `npm test`
Expected: PASS. Note `lib/garden-cache-source.test.ts` checks `actions.ts` per function for `revalidateGarden()` — both functions still call it.

- [ ] **Step 6: Commit**

```bash
git add app/admin/actions.ts lib/admin-lang-middleware.test.ts
git commit -m "Save the posted half, and land back on it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `EditLangSwitch`

**Files:**
- Create: `components/editor/edit-lang-switch.tsx`
- Test: `lib/edit-lang-switch-render.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/edit-lang-switch-render.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EditLangSwitch } from "@/components/editor/edit-lang-switch";

/**
 * The switch is its own component for a reason that is about testing, not
 * reuse: ProseEditor's float commit renders NOTHING until the editor mounts
 * (`immediatelyRender: false`), so the editor has no server HTML in which to
 * find it.
 */

const HREFS = { en: "/admin/sprout/a", fr: "/admin/sprout/a?lang=fr" };

test("enabled: two real links, the active one marked current", () => {
  const html = renderToStaticMarkup(<EditLangSwitch current="fr" hrefs={HREFS} disabled={false} />);
  assert.match(html, /href="\/admin\/sprout\/a"/);
  assert.match(html, /href="\/admin\/sprout\/a\?lang=fr"/);
  assert.match(html, /aria-current="page"[^>]*>FR</);
  assert.doesNotMatch(html, /aria-current="page"[^>]*>EN</);
  // The accessible name says what the control does, not just the code.
  assert.match(html, /aria-label="Edit English"/);
  assert.match(html, /aria-label="Edit French"/);
});

test("disabled while dirty: no href anywhere, so no click can navigate away from unsaved text", () => {
  const html = renderToStaticMarkup(<EditLangSwitch current="en" hrefs={HREFS} disabled />);
  assert.doesNotMatch(html, /href=/);
  assert.equal(html.match(/aria-disabled="true"/g)?.length, 2);
  assert.match(html, /Save first/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang-switch-render.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/editor/edit-lang-switch.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { LANGS, LANG_SHORT, type Lang } from "@/lib/locale";
import { cn } from "@/lib/utils";

const EDIT_LABEL: Record<Lang, string> = { en: "Edit English", fr: "Edit French" };

/**
 * Which half of the article the editor is on, and the way to the other one.
 *
 * Drawn by ProseEditor, which is the only thing that knows whether there is
 * unsaved text — hence `disabled`. While disabled there is NO `href` at all:
 * the editor has no beforeunload guard, so a live link would navigate, drop the
 * paragraph, and open an editor on the other half that looks exactly like one
 * where the paragraph was never written.
 *
 * `next/link`, like every other admin navigation. Admin-only: nothing in the
 * public zone renders this, so it is not a server-safe file.
 */
export function EditLangSwitch({
  current,
  hrefs,
  disabled,
}: {
  current: Lang;
  hrefs: Record<Lang, string>;
  disabled: boolean;
}) {
  return (
    <nav aria-label="Language being edited" className="flex items-center gap-0.5">
      {LANGS.map((lang) => {
        const active = lang === current;
        const className = buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" });
        return disabled ? (
          <span
            key={lang}
            aria-disabled="true"
            aria-label={EDIT_LABEL[lang]}
            aria-current={active ? "page" : undefined}
            title="Save first"
            className={cn(className, "pointer-events-none opacity-50")}
          >
            {LANG_SHORT[lang]}
          </span>
        ) : (
          <Link
            key={lang}
            href={hrefs[lang]}
            aria-label={EDIT_LABEL[lang]}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {LANG_SHORT[lang]}
          </Link>
        );
      })}
    </nav>
  );
}
```

Check `@/lib/utils` exports `cn` (`grep -n "export function cn" lib/utils.ts`); it is the shadcn helper and `components/ui/button.tsx` already uses it.

- [ ] **Step 4: Run to verify pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang-switch-render.test.tsx`
Expected: PASS. If the `aria-current … >FR<` regex fails because attribute order differs, keep the assertion's meaning (the element carrying `aria-current="page"` is the FR one) and loosen only the pattern — e.g. split the HTML on `</a>` and find the segment containing `aria-current`.

- [ ] **Step 5: Commit**

```bash
git add components/editor/edit-lang-switch.tsx lib/edit-lang-switch-render.test.tsx
git commit -m "Draw the EN/FR switch, dead while there is unsaved text

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `ProseEditor` gains the switch, the seed, and a `lang` attribute

**Files:**
- Modify: `components/editor/prose-editor.tsx`
- Create: `lib/edit-lang-source.test.ts` (editor half; Task 7 extends it)

- [ ] **Step 1: Write the failing source test**

Create `lib/edit-lang-source.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source pins for the bilingual editor — properties of the files AS WRITTEN,
 * which no render can observe (ProseEditor mounts client-only), on
 * lib/prose-commit-source.test.ts's reasoning.
 *
 * Each of these passes tsc, npm test and npm run build while false:
 *  - a switch that stays live over unsaved text navigates and drops it;
 *  - a page that loads `textPart(content, "en")` edits English whatever the URL says;
 *  - an editor without `key={lang}` keeps the English baseline across the switch.
 */

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const PROSE_EDITOR = "components/editor/prose-editor.tsx";

test("the editor draws the switch in BOTH commit shapes, and disables it on unsaved text in both", () => {
  const text = source(PROSE_EDITOR);
  assert.equal(text.match(/<EditLangSwitch/g)?.length, 2, "one switch per commit shape (float and inline)");
  assert.equal(
    text.match(/disabled=\{dirty \|\| pending \|\| imageBusy\}/g)?.length,
    2,
    "each switch must be disabled on dirty, pending and imageBusy",
  );
});

test("Start from English goes through setContent as markdown, and only when a seed was given", () => {
  const text = source(PROSE_EDITOR);
  assert.match(text, /setContent\(normalizeEmptyListMarkers\(seed\), \{ contentType: "markdown" \}\)/);
  assert.match(text, /seed && editor && empty/);
});

test("the editable surface declares its language, for the browser's spellcheck", () => {
  assert.match(source(PROSE_EDITOR), /lang: langSwitch\?\.current \?\? "en"/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang-source.test.ts`
Expected: FAIL on all three.

- [ ] **Step 3: Add the props**

In `components/editor/prose-editor.tsx`, add imports:

```ts
import type { Lang } from "@/lib/locale";
import { EditLangSwitch } from "./edit-lang-switch";
```

Add to the destructured props (after `float = false,`):

```ts
  langSwitch,
  seed,
```

and to the props type (after the `float?: boolean;` member and its docblock):

```ts
  /**
   * Which half of a bilingual article this instance edits, and the links to
   * the other. The page keys the editor on `current`, so switching REMOUNTS it
   * with the other half's baseline rather than diffing French against English.
   * Absent on any caller that has no halves to switch between.
   */
  langSwitch?: { current: Lang; hrefs: Record<Lang, string> };
  /**
   * The English body, handed over ONLY when this is the French half and it is
   * blank (lib/edit-lang.ts `editorHalves`). It powers "Start from English",
   * which loads it as an unsaved draft — the stored value does not change until
   * the author presses Save.
   */
  seed?: string;
```

- [ ] **Step 4: Track emptiness**

After the `const [error, setError] = useState<string | null>(null);` line, add:

```ts
  // Whether the document is empty — "Start from English" is a way IN, not a
  // reset, so it shows only over an empty document and disappears the moment
  // there is anything to lose.
  const [empty, setEmpty] = useState(initialMarkdown.trim() === "");
```

In `onUpdate`, directly after `setUnchanged(false);`, add:

```ts
      setEmpty(editor.isEmpty);
```

- [ ] **Step 5: Declare the language on the editable surface**

In `editorProps.attributes`, add a `lang` member beside `class`:

```ts
        // Spellcheck in the language being written. Read once at mount, like
        // `class` — which is fine because the page keys this editor on it.
        lang: langSwitch?.current ?? "en",
```

- [ ] **Step 6: Render Start from English**

Directly above `<div className={bare ? undefined : "rounded-lg border p-3"}>`, add:

```tsx
      {seed && editor && empty ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          // Replaces the (empty) document; emits an update, so `dirty` goes
          // true and the commit lights. Nothing is written until Save.
          onClick={() => editor.chain().focus().setContent(normalizeEmptyListMarkers(seed), { contentType: "markdown" }).run()}
        >
          Start from English
        </Button>
      ) : null}
```

The test in Step 1 matches `setContent(normalizeEmptyListMarkers(seed), { contentType: "markdown" })` — keep that call on one line exactly as written.

- [ ] **Step 7: Draw the switch in both commit shapes**

In the FLOAT branch, inside `<Chrome magnet="bottom-center" content>`, before `<span aria-live="polite">`, add:

```tsx
            {langSwitch ? (
              <EditLangSwitch
                current={langSwitch.current}
                hrefs={langSwitch.hrefs}
                disabled={dirty || pending || imageBusy}
              />
            ) : null}
```

In the INLINE branch, inside `<div className="flex items-center gap-3">`, as its LAST child (after the `{error ? … : null}` span), add:

```tsx
          {langSwitch ? (
            <div className="ml-auto">
              <EditLangSwitch
                current={langSwitch.current}
                hrefs={langSwitch.hrefs}
                disabled={dirty || pending || imageBusy}
              />
            </div>
          ) : null}
```

Note for the inline shape: `dirty` is maintained by `onUpdate` in both shapes (it is not float-only), so the guard works there too.

- [ ] **Step 8: Verify**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang-source.test.ts lib/prose-commit-source.test.ts`
Expected: PASS — including the existing float-commit pins, which slice from `magnet="bottom-center"` to `</Chrome>` and must still find the Save button's `disabled={pending || imageBusy || (!dirty && !error)}`.

Run: `npx tsc --noEmit`
Expected: no errors. If `setContent`'s options reject `contentType`, confirm `@tiptap/markdown` is imported by `components/editor/editor-extensions.ts` (its module augmentation adds the option); do not cast.

- [ ] **Step 9: Commit**

```bash
git add components/editor/prose-editor.tsx lib/edit-lang-source.test.ts
git commit -m "Give the editor a language, a switch, and a way to start from English

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire the three editing pages

**Files:**
- Modify: `app/admin/_components/content-card.tsx`
- Modify: `app/admin/(chrome)/sprout/[slug]/page.tsx`
- Modify: `app/admin/(chrome)/plant/[slug]/narrative/page.tsx`
- Modify: `app/admin/(chrome)/pod/[slug]/page.tsx`
- Modify: `lib/edit-lang-source.test.ts`

- [ ] **Step 1: Extend the source test**

Append to `lib/edit-lang-source.test.ts`:

```ts
// Every place a content editor is mounted. ContentCard stands in for the pod
// page, which renders the editor through it.
const EDITOR_MOUNTS = [
  "app/admin/(chrome)/sprout/[slug]/page.tsx",
  "app/admin/(chrome)/plant/[slug]/narrative/page.tsx",
  "app/admin/_components/content-card.tsx",
];

for (const path of EDITOR_MOUNTS) {
  test(`${path} loads through editorHalves, keys on lang, and posts lang`, () => {
    const text = source(path);
    assert.match(text, /editorHalves\(/, "the load goes through editorHalves");
    assert.doesNotMatch(text, /textPart\([^)]*content[^)]*"en"\)/, "no hard-coded English load of content");
    assert.match(text, /key=\{lang\}/, "the editor remounts on a switch");
    assert.match(text, /langSwitch=\{/, "the editor is handed its switch");
    assert.match(text, /lang \}\}|lang: lang|, lang\b/, "the save posts which half it is");
  });
}

test("the pod page hands ContentCard its language", () => {
  const text = source("app/admin/(chrome)/pod/[slug]/page.tsx");
  assert.match(text, /editLang\(/);
  assert.match(text, /langHrefs=\{/);
});
```

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang-source.test.ts`
Expected: FAIL on the four new tests.

- [ ] **Step 2: `ContentCard`**

Replace `app/admin/_components/content-card.tsx` with:

```tsx
import type { RawGarden, Text } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { editorHalves } from "@/lib/edit-lang";
import { entityOptions } from "@/lib/entity-options";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The editor in its card. Server component: it builds the entity list from the
 * raw garden the page already loaded and hands it down as a prop, which is why
 * there is no /api/admin/entities endpoint (spec §2.7).
 *
 * The load goes through `editorHalves`, which is STRICT on purpose —
 * resolveText's fallback would load one half into the editor and save it back
 * as the other, corrupting the data exactly the way the name/description
 * prefills already warn about.
 */
export function ContentCard({
  raw,
  content,
  selfRef,
  action,
  hidden,
  lang,
  langHrefs,
}: {
  raw: RawGarden;
  content?: Text;
  /**
   * This entity's own ref, so the picker cannot offer it to itself — matters
   * for plant and pod pages, where entityOptions() does emit a row for the
   * page's own container. The sprout page passes `sprout:${slug}` here too,
   * for consistency, but it excludes nothing: entityOptions() never emits
   * `sprout:` rows at all (a sprout has no public URL to mint a reference
   * to), so there is nothing for that ref to filter out.
   */
  selfRef: string;
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  /** The half being edited, from the page's `?lang=` (lib/edit-lang.ts). */
  lang: Lang;
  langHrefs: Record<Lang, string>;
}) {
  const { initialMarkdown, seed } = editorHalves(content, lang);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Content</CardTitle>
      </CardHeader>
      <CardContent>
        <ProseEditor
          key={lang}
          initialMarkdown={initialMarkdown}
          seed={seed}
          langSwitch={{ current: lang, hrefs: langHrefs }}
          entities={entityOptions(raw, selfRef)}
          action={action}
          hidden={{ ...hidden, lang }}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Pod page**

In `app/admin/(chrome)/pod/[slug]/page.tsx`:

Add the import:

```ts
import { editLang, editLangHrefs } from "@/lib/edit-lang";
```

Change the `searchParams` type and read:

```ts
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { error } = query;
  const lang = editLang(query.lang);
```

Change the `ContentCard` call to:

```tsx
          <ContentCard
            raw={raw}
            content={pod.content}
            selfRef={`pod:${pod.slug}`}
            action={editContainerContentAction}
            hidden={{ ref: `pod:${pod.slug}` }}
            lang={lang}
            langHrefs={editLangHrefs(`/admin/pod/${encodeURIComponent(pod.slug)}`, query)}
          />
```

(`query` is a type literal, so it is assignable to `Record<string, string | string[] | undefined>`; any undeclared runtime parameter such as `?plant=` is still in the object and is kept.)

- [ ] **Step 4: Plant narrative page**

In `app/admin/(chrome)/plant/[slug]/narrative/page.tsx`:

Imports — replace `import { resolveText, textPart } from "@/lib/data";` with:

```ts
import { resolveText } from "@/lib/data";
import { editLang, editLangHrefs, editorHalves } from "@/lib/edit-lang";
```

and change `import { hubHref } from "@/lib/plant-path";` to:

```ts
import { hubHref, narrativeHref } from "@/lib/plant-path";
```

Change the `searchParams` type and read:

```ts
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { error } = query;
  const lang = editLang(query.lang);
```

Replace the editor block (the comment above `<ProseEditor` and the element) with:

```tsx
      {/* Moved from the hub verbatim, `bare` included: this page IS the frame,
          so a card around the editor would be a frame around the only thing on
          it. The load goes through `editorHalves` — STRICT per half, so
          neither half is ever loaded into the other's editor. */}
      <ProseEditor
        key={lang}
        bare
        {...editorHalves(plant.content, lang)}
        langSwitch={{ current: lang, hrefs: editLangHrefs(narrativeHref(plant.slug), query) }}
        entities={entityOptions(raw, `plant:${plant.slug}`)}
        action={editContainerContentAction}
        hidden={{ ref: `plant:${plant.slug}`, lang }}
      />
```

If `resolveText` becomes unused in that file, drop it from the import (`npm run lint` will say).

- [ ] **Step 5: Sprout page**

In `app/admin/(chrome)/sprout/[slug]/page.tsx`:

Add the import:

```ts
import { editLang, editLangHrefs, editorHalves } from "@/lib/edit-lang";
```

Change the `searchParams` type and read:

```ts
  searchParams: Promise<{ error?: string; form?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { error, form } = query;
  const lang = editLang(query.lang);
```

Replace the `source` block (the comment and `const source = textPart(sprout.content, "en").trim();`) with:

```ts
  // What the editor opens on, and the half the rail's diagnostic shows. ONE
  // read serves both: with two, the Source panel could show one half while the
  // editor sat on the other — the diagnostic disagreeing with the surface it
  // exists to diagnose.
  const halves = editorHalves(sprout.content, lang);
  const source = halves.initialMarkdown.trim();
```

Replace the `<ProseEditor … />` element and the comment above it with:

```tsx
          {/* No ContentCard: a card's header above an editor that is the page's
              only content is a frame around the page. The load goes through
              `editorHalves` — STRICT per half, so neither half is ever loaded
              into the other's editor. */}
          <ProseEditor
            key={lang}
            bare
            float
            {...halves}
            langSwitch={{
              current: lang,
              hrefs: editLangHrefs(`/admin/sprout/${encodeURIComponent(sprout.slug)}`, query),
            }}
            // No self-exclusion to do: entityOptions never emits `sprout:` rows
            // at all, because a sprout has no public URL to mint a reference to.
            // Passed anyway, so every content surface reads alike — the sentence
            // ContentCard's `selfRef` docblock carries for the call sites where
            // the argument does filter something.
            entities={entityOptions(raw, `sprout:${sprout.slug}`)}
            action={editContentAction}
            hidden={{ slug: sprout.slug, lang }}
          />
```

`textPart` is still used by the `saved={JSON.stringify([...])}` fingerprint on the name/description — keep its import.

- [ ] **Step 6: Verify**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/edit-lang-source.test.ts`
Expected: PASS. The `lang \}\}|lang: lang|, lang\b` alternative matches `hidden={{ slug: sprout.slug, lang }}`, `hidden={{ ref: …, lang }}` and ContentCard's `hidden={{ ...hidden, lang }}`.

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean.

Also run `npm test` output through a grep for `entity-rail-source` — `lib/entity-rail-source.test.ts` pins the sprout page's `RAIL_PAGES` icons; the rail items are unchanged, so it must still pass.

- [ ] **Step 7: Commit**

```bash
git add app/admin/_components/content-card.tsx "app/admin/(chrome)/sprout/[slug]/page.tsx" "app/admin/(chrome)/plant/[slug]/narrative/page.tsx" "app/admin/(chrome)/pod/[slug]/page.tsx" lib/edit-lang-source.test.ts
git commit -m "Open every article editor on the half the URL names

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Rulebook, full verification, and a real run

**Files:**
- Modify: `CLAUDE.md` (the "Rules the tests pin, and why" list)

- [ ] **Step 1: Add the rule**

In `CLAUDE.md`, under `## Rules the tests pin, and why`, add this as a new bullet directly after the `- **A screen's image cannot be cleared**` bullet:

```markdown
- **An article's halves are edited one at a time, and the URL names which.**
  `?lang=fr` on the sprout, plant-narrative and pod pages opens the editor on
  the French half (`lib/edit-lang.ts`); every page opens in English and the
  choice is never a cookie, so a URL always says which half is on screen. The
  load is `editorHalves` — STRICT per half, so an empty French body opens
  empty with "Start from English" beside it, never as the English body wearing
  a French label — and `buildContentPatch` takes `lang` as a REQUIRED
  parameter and carries the other half back verbatim. Both content actions
  treat an absent `lang` as English (a tab open across the deploy) and refuse
  an unknown one, and both redirect back onto the half that was saved. The
  switch is dead while the editor is dirty, because the editor has no
  `beforeunload` guard. `extractRefs` reads BOTH halves, so a card embedded
  only in French still mirrors into `relations`. The admin's `lang` shares its
  name with the public zone's, which is safe only because `middleware.ts`'s
  language branch never sees an `/admin` path — `lib/admin-lang-middleware.test.ts`
  pins that, and `lib/edit-lang-source.test.ts` pins the editor and the pages.
```

- [ ] **Step 2: Full gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all pass. Report actual counts from `npm test`.

- [ ] **Step 3: Real run in the browser**

Start the dev server (`npm run dev`, background) and, logged into the admin, check on a sprout that has English content only:
1. `/admin/sprout/<slug>` — commit cluster shows `EN` (current) and `FR`.
2. Click `FR` — URL gains `?lang=fr`, editor is empty, "Start from English" is shown.
3. Type one character — both `EN` and `FR` go dim and have no href.
4. Undo back to empty, click "Start from English" — English body appears, Save lights.
5. Edit a word and Save — you land on `?lang=fr` holding the French text. Switch to `EN` — English is unchanged.
6. Repeat step 2 on a plant's `/narrative` and on a pod page (inline commit row).

Use a scratch or private sprout, never a published one: the French half of a published sprout goes live to French readers on save. If there is no suitable private sprout, say so and skip step 5 rather than writing to a public one.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Write down how an article's two halves are edited

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Open the PR (draft) with a Lab Note**

```bash
git push -u origin bilingual-editing
gh pr create --draft --title "Write in French too" --body-file <scratchpad>/pr-body.md
```

The PR body must include a `## Lab Note` section:

````markdown
## Lab Note

```yaml
en:
  title: Write in French too
  summary: Every article now has a French side. Flip the editor to FR, start from the English if you like, and save — the English stays exactly as it was.
fr:
  title: Écris aussi en français
  summary: Chaque article a maintenant sa version française. Bascule l'éditeur sur FR, pars de l'anglais si tu veux, et enregistre — l'anglais ne bouge pas d'un mot.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
````

and end with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
