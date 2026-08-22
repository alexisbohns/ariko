# Slice 4 — The article door Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give long-form content an API to arrive through — `POST /api/articles`, drafts only — and use it to post the Paulopus molecule and its eight focuses into Ariko's database.

**Architecture:** A sibling of the synthesis door: pure all-or-nothing validation (`lib/articles.ts`), a store layer that pre-checks every DB refusal before writing anything (`lib/articles-store.ts`), a thin route. The payload carries a container's narrative and its articles together. Nothing about the content is committed to the repo.

**Tech Stack:** Next.js 15 route handlers, MongoDB, `rehype-slug` added to the render pipeline, tests via `node --import tsx --test` (DB-backed ones auto-skip without `MONGODB_URI`).

**Spec:** [`docs/superpowers/specs/2026-08-22-article-door-design.md`](../specs/2026-08-22-article-door-design.md)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/articles.ts` (create) | Pure validation + the payload types. No DB. |
| `lib/articles.test.ts` (create) | The validation matrix. |
| `lib/articles-store.ts` (create) | Refusal pre-checks, then upserts: container narrative, beans, sprouts. |
| `lib/articles-store.test.ts` (create) | DB-backed, auto-skipping. |
| `app/api/articles/route.ts` (create) | Token → shape → store, mirroring the synthesis route. |
| `lib/articles-route.test.ts` (create) | 401 / 400 / 409 / 200. |
| `lib/markdown.ts` (modify) | `rehype-slug`, and `id` allowed on headings. |
| `README.md` (modify) | Document the door beside the other write doors. |

---

## Task 1: Branch and heading anchors

**Files:** `lib/markdown.ts`, `lib/markdown.test.ts`, `package.json`

- [ ] **Step 1: Branch and install**

```bash
git checkout main && git pull && git checkout -b slice-4-article-door
npm install rehype-slug@^6
```

- [ ] **Step 2: Write the failing test**

Append to `lib/markdown.test.ts`:

```ts
test("headings get an id so deep links can land on them", () => {
  const html = render("## Execution\n\ntext");
  assert.match(html, /<h2 id="execution">/);
});

test("an author-supplied id on other elements is still stripped", () => {
  const html = render('<p id="sneaky">hi</p>');
  assert.doesNotMatch(html, /sneaky/);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --import tsx --test lib/markdown.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: 1 failure (the second test already passes — raw HTML is inert).

- [ ] **Step 4: Implement**

In `lib/markdown.ts`, import `rehypeSlug from "rehype-slug"`, add `id` to the heading tags in the
schema, and put the plugin **before** sanitization:

```ts
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "entity-card", "entity-link"],
  attributes: {
    ...defaultSchema.attributes,
    // rehype-slug mints these; without them the ids are stripped and every deep
    // link into a narrative lands at the top of the page instead.
    h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    "entity-card": ["data-ref"],
    "entity-link": ["data-ref"],
  },
};

export const rehypePlugins: PluggableList = [rehypeSlug, [rehypeSanitize, sanitizeSchema]];
```

- [ ] **Step 5: Verify and commit**

```bash
node --import tsx --test lib/markdown.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
npx tsc --noEmit
git add package.json package-lock.json lib/markdown.ts lib/markdown.test.ts
git commit -m "feat: headings carry ids, so deep links into a narrative land"
```

---

## Task 2: Pure validation

**Files:** `lib/articles.ts`, `lib/articles.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/articles.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArticlesPayload } from "./articles";

const article = {
  slug: "karma-accountability",
  name: "Karma & Accountability",
  description: "How the octopus keeps score.",
  date: "2026-07-24",
  content: "# Karma\n\nprose",
};
const ok = { container: "plant:paulopus", narrative: "## Context\n\nprose", articles: [article] };

test("a well-formed payload passes", () => {
  assert.deepEqual(validateArticlesPayload(ok), { ok: true });
});

test("narrative-only and articles-only payloads both pass", () => {
  assert.deepEqual(validateArticlesPayload({ container: "pod:celesta", narrative: "x" }), { ok: true });
  assert.deepEqual(validateArticlesPayload({ container: "plant:paulopus", articles: [article] }), {
    ok: true,
  });
});

test("a payload carrying neither half is refused", () => {
  assert.match(
    (validateArticlesPayload({ container: "plant:paulopus" }) as { error: string }).error,
    /narrative or articles/,
  );
});

test("the container must be a plant or pod ref", () => {
  for (const container of ["bean:karma", "paulopus", "plant:", "plant:Bad_Slug", "sprout:x"]) {
    assert.equal(validateArticlesPayload({ ...ok, container }).ok, false, container);
  }
});

test("state is refused whatever its value — the door cannot publish", () => {
  for (const state of ["published", "draft", "private", null, ""]) {
    const result = validateArticlesPayload({ ...ok, articles: [{ ...article, state }] });
    assert.equal(result.ok, false, String(state));
    assert.match((result as { error: string }).error, /state/);
  }
});

test("article fields are checked, and the first failure names the offender", () => {
  const bad = (over: Record<string, unknown>) =>
    validateArticlesPayload({ ...ok, articles: [{ ...article, ...over }] }) as { error: string };
  assert.match(bad({ slug: "Bad Slug" }).error, /Bad Slug/);
  assert.match(bad({ name: "  " }).error, /name/);
  assert.match(bad({ date: "24-07-2026" }).error, /date/);
  assert.match(bad({ content: "x".repeat(64 * 1024 + 1) }).error, /64/);
  assert.match(bad({ content: 42 }).error, /content/);
});

test("duplicate slugs within a batch are refused", () => {
  const result = validateArticlesPayload({ ...ok, articles: [article, { ...article }] });
  assert.match((result as { error: string }).error, /duplicate/);
});

test("unknown top-level keys are ignored, like the pollen envelope", () => {
  assert.deepEqual(validateArticlesPayload({ ...ok, futureThing: 1 }), { ok: true });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --import tsx --test lib/articles.test.ts 2>&1 | grep -E "Cannot find|^ℹ fail"`

- [ ] **Step 3: Implement**

Create `lib/articles.ts`:

```ts
import { PLANT_PREFIX, POD_PREFIX } from "./data";

export interface ArticleInput {
  slug: string;
  name: string;
  description?: string;
  date: string;
  content: string;
}

export interface ArticlesPayload {
  container: string;
  narrative?: string;
  articles?: ArticleInput[];
}

export const MAX_CONTENT_BYTES = 64 * 1024;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function tooBig(value: string): boolean {
  return Buffer.byteLength(value, "utf8") > MAX_CONTENT_BYTES;
}

// Pure, all-or-nothing (spec §4): first failure names the offender and the whole
// payload is refused. Nothing here touches the database — the DB-dependent
// refusals (a reviewed sprout, a published container) live in the store.
export function validateArticlesPayload(
  body: unknown,
): { ok: true } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return { ok: false, error: "body must be an object" };
  const payload = body as Record<string, unknown>;

  const container = typeof payload.container === "string" ? payload.container : "";
  const isContainer =
    (container.startsWith(PLANT_PREFIX) && SLUG.test(container.slice(PLANT_PREFIX.length))) ||
    (container.startsWith(POD_PREFIX) && SLUG.test(container.slice(POD_PREFIX.length)));
  if (!isContainer)
    return { ok: false, error: `container must be a plant: or pod: ref, got ${container || "nothing"}` };

  const hasNarrative = payload.narrative !== undefined;
  const hasArticles = payload.articles !== undefined;
  if (!hasNarrative && !hasArticles)
    return { ok: false, error: "payload must carry narrative or articles (or both)" };

  if (hasNarrative) {
    if (typeof payload.narrative !== "string")
      return { ok: false, error: "narrative must be a string" };
    if (tooBig(payload.narrative))
      return { ok: false, error: "narrative must be at most 64 KiB" };
  }

  if (!hasArticles) return { ok: true };
  if (!Array.isArray(payload.articles)) return { ok: false, error: "articles must be an array" };

  const seen = new Set<string>();
  for (const raw of payload.articles) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return { ok: false, error: "every article must be an object" };
    const a = raw as Record<string, unknown>;
    const who = typeof a.slug === "string" && a.slug ? a.slug : "(missing slug)";
    // Checked on the RAW object: the door structurally cannot publish, so any
    // state key at all is a refusal, whatever its value (spec §2.3).
    if ("state" in a) return { ok: false, error: `${who}: state is not accepted on this door` };
    if (typeof a.slug !== "string" || !SLUG.test(a.slug))
      return { ok: false, error: `${who}: slug must match ^[a-z0-9][a-z0-9-]*$` };
    if (seen.has(a.slug)) return { ok: false, error: `duplicate slug: ${a.slug}` };
    seen.add(a.slug);
    if (typeof a.name !== "string" || !a.name.trim())
      return { ok: false, error: `${who}: name is required` };
    if (a.description !== undefined && typeof a.description !== "string")
      return { ok: false, error: `${who}: description must be a string` };
    if (typeof a.date !== "string" || !DATE.test(a.date))
      return { ok: false, error: `${who}: date is required (YYYY-MM-DD)` };
    if (typeof a.content !== "string")
      return { ok: false, error: `${who}: content must be a string` };
    if (tooBig(a.content)) return { ok: false, error: `${who}: content must be at most 64 KiB` };
  }
  return { ok: true };
}

// The sprout slug an article owns, forever: the garden's existing convention
// (wait-for-the-sun-0). Re-posting an unreviewed article updates this same
// sprout, so a correction is a re-post (spec §2.6).
export function sproutSlugFor(articleSlug: string): string {
  return `${articleSlug}-0`;
}
```

- [ ] **Step 4: Verify and commit**

```bash
node --import tsx --test lib/articles.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
git add lib/articles.ts lib/articles.test.ts
git commit -m "feat: validate an articles payload, drafts only"
```

---

## Task 3: The store

**Files:** `lib/articles-store.ts`, `lib/articles-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/articles-store.test.ts`, following `lib/botanical.test.ts`'s skip pattern
(`const hasDb = !!process.env.MONGODB_URI`, `{ skip: !hasDb }`, a `cleanup` that removes
`__test__`-prefixed docs):

```ts
test("a fresh post creates the bean, the sprout and the narrative", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const result = await writeArticles({
    container: "plant:__test__p",
    narrative: "## Context\n\n::entity{ref=bean:__test__a}",
    articles: [
      { slug: "__test__a", name: "A", description: "One line.", date: "2026-07-24", content: "body" },
    ],
  });
  assert.deepEqual(result, { ok: true, written: 1, narrative: true });

  const db = await getDb();
  const bean = await db.collection("beans").findOne({ slug: "__test__a" });
  const sprout = await db.collection("sprouts").findOne({ slug: "__test__a-0" });
  const plant = await db.collection("plants").findOne({ slug: "__test__p" });
  assert.equal(bean?.visibility, "private"); // never public from a machine
  assert.equal(sprout?.state, undefined); // draft: no state key at all
  assert.deepEqual(sprout?.parents, ["bean:__test__a"]);
  assert.equal(sprout?.content, "body");
  // Refs mirror on this write path like every other one.
  assert.deepEqual(plant?.relations, [{ kind: "embeds", ref: "bean:__test__a" }]);
});

test("a re-post updates in place", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await writeArticles({ container: "plant:__test__p", articles: [base] });
  await writeArticles({ container: "plant:__test__p", articles: [{ ...base, content: "second" }] });
  const db = await getDb();
  assert.equal(await db.collection("sprouts").countDocuments({ slug: "__test__a-0" }), 1);
  assert.equal((await db.collection("sprouts").findOne({ slug: "__test__a-0" }))?.content, "second");
});

test("a reviewed sprout is refused and nothing in the batch is written", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await writeArticles({ container: "plant:__test__p", articles: [base] });
  const db = await getDb();
  await db.collection("sprouts").updateOne({ slug: "__test__a-0" }, { $set: { state: "published" } });

  const result = await writeArticles({
    container: "plant:__test__p",
    articles: [{ ...base, content: "clobber" }, { ...base, slug: "__test__b", name: "B" }],
  });
  assert.deepEqual(result, { ok: false, refused: ["__test__a-0"] });
  assert.equal((await db.collection("sprouts").findOne({ slug: "__test__a-0" }))?.content, "body");
  assert.equal(await db.collection("sprouts").countDocuments({ slug: "__test__b-0" }), 0);
});

test("a public container with a narrative is refused", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__pub", name: "P", natures: ["work"], description: "",
    content: "already live", visibility: "public",
  });
  const result = await writeArticles({ container: "plant:__test__pub", narrative: "rewrite" });
  assert.deepEqual(result, { ok: false, refused: ["plant:__test__pub"] });
});
```

- [ ] **Step 2: Run to see it fail, then implement**

Create `lib/articles-store.ts`:

```ts
import { getDb } from "./db";
import { PLANT_PREFIX, POD_PREFIX, resolveText, type Bean, type Sprout } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { sproutSlugFor, type ArticlesPayload } from "./articles";

export type WriteResult =
  | { ok: true; written: number; narrative: boolean }
  | { ok: false; refused: string[] };

// Every DB-dependent refusal is checked BEFORE any write (spec §4), and one
// refusal aborts the batch — the synthesis door's contract. The writes
// themselves are idempotent upserts, so a re-post after a mid-batch error
// converges.
export async function writeArticles(payload: ArticlesPayload): Promise<WriteResult> {
  const db = await getDb();
  const collection = payload.container.startsWith(PLANT_PREFIX) ? "plants" : "pods";
  const containerSlug = payload.container.slice(
    (payload.container.startsWith(PLANT_PREFIX) ? PLANT_PREFIX : POD_PREFIX).length,
  );
  const articles = payload.articles ?? [];
  const refused: string[] = [];

  // Containers have visibility but no state, so "already public with prose" is
  // the closest available proxy for "a human published this" (spec §2.4).
  if (payload.narrative !== undefined) {
    const existing = await db.collection(collection).findOne({ slug: containerSlug });
    if (!existing) return { ok: false, refused: [`${payload.container} (unknown)`] };
    if (existing.visibility === "public" && resolveText(existing.content ?? "").trim())
      refused.push(payload.container);
  }

  const sproutSlugs = articles.map((a) => sproutSlugFor(a.slug));
  const stored = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: sproutSlugs } }, { projection: { _id: 0, slug: 1, state: 1 } })
    .toArray();
  for (const s of stored) if (s.state !== undefined) refused.push(s.slug);
  if (refused.length > 0) return { ok: false, refused };

  if (payload.narrative !== undefined) {
    await db.collection(collection).updateOne(
      { slug: containerSlug },
      { $set: { content: payload.narrative, relations: mergeMirrored(undefined, extractRefs(payload.narrative)) } },
    );
  }

  for (const a of articles) {
    await db.collection<Bean>("beans").updateOne(
      { slug: a.slug },
      {
        $set: { name: a.name, ...(a.description ? { description: a.description } : {}) },
        // Machine-created beans are private and stay that way: parentage and
        // visibility are set once, on insert, and never re-asserted.
        $setOnInsert: { parents: [payload.container], visibility: "private" },
      },
      { upsert: true },
    );
    await db.collection("sprouts").updateOne(
      { slug: sproutSlugFor(a.slug), state: { $exists: false } },
      {
        $set: {
          name: a.name,
          type: "article",
          date: a.date,
          description: a.description ?? "",
          parents: [`bean:${a.slug}`],
          content: a.content,
          relations: mergeMirrored(undefined, extractRefs(a.content)),
        },
        $unset: { state: "" },
      },
      { upsert: true },
    );
  }

  return { ok: true, written: articles.length, narrative: payload.narrative !== undefined };
}
```

The `state: { $exists: false }` in the sprout filter is deliberate and load-bearing: if a human
publishes mid-batch, the upsert collides on the unique slug index and throws rather than silently
clobbering reviewed work — the same guard `upsertDigestDrafts` uses.

- [ ] **Step 3: Verify and commit**

```bash
node --env-file=.env.local --import tsx --test lib/articles-store.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
git add lib/articles-store.ts lib/articles-store.test.ts
git commit -m "feat: write articles and a container narrative, refusing reviewed work"
```

---

## Task 4: The route

**Files:** `app/api/articles/route.ts`, `lib/articles-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/articles-route.test.ts` in the shape of `lib/synthesis-route.test.ts`: a `req(body, auth)`
helper, then — `ARTICLES_TOKEN` unset refuses everything (401, fail closed); wrong/missing token 401;
malformed JSON 400; a payload failing pure validation 400 with the offending slug in the message; and
a valid payload reaching the store (DB-backed, skipped without `MONGODB_URI`) 200.

- [ ] **Step 2: Implement**

Create `app/api/articles/route.ts`, mirroring `app/api/synthesis/route.ts`:

```ts
import { hasValidToken, singleToken } from "../../../lib/auth";
import { validateArticlesPayload, type ArticlesPayload } from "../../../lib/articles";
import { writeArticles } from "../../../lib/articles-store";

export const dynamic = "force-dynamic";

// Guarded long-form write door (slice 4 spec §2): drafts only, all-or-nothing.
// Validation order: token → JSON → pure payload rules (no DB yet) → the store,
// which pre-checks every DB refusal before writing anything. The door
// structurally cannot publish, and never changes visibility.
export async function POST(request: Request): Promise<Response> {
  const tokens = singleToken(process.env.ARTICLES_TOKEN);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const valid = validateArticlesPayload(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });

  const result = await writeArticles(body as ArticlesPayload);
  if (!result.ok) {
    return Response.json(
      { error: "refused: already reviewed", refused: result.refused },
      { status: 409 },
    );
  }
  return Response.json(result);
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npx tsc --noEmit && npm run build 2>&1 | grep -E "Compiled successfully|/api/articles"
git add app/api/articles lib/articles-route.test.ts
git commit -m "feat: POST /api/articles — the door long-form content arrives through"
```

- [ ] **Step 4: Set the token**

```bash
openssl rand -hex 24   # add as ARTICLES_TOKEN to .env.local and to Vercel's env
```

---

## Task 5: Documentation and PR

**Files:** `README.md`, `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Document the door** beside `/api/inbox` and `/api/synthesis` in the README: the
payload shape, the draft-only rule, the two refusals (reviewed sprout, published container with
prose), and the operating sequence from spec §3 — container private → post → review → publish, whose
cascade lifts the container public.

- [ ] **Step 2: Roadmap** — note that container narrative now has a door, and that Track A still owes
an admin surface for editing one.

- [ ] **Step 3: Sweep, PR**

```bash
npm test && npx tsc --noEmit && npm run build
git push -u origin slice-4-article-door
```

Lab Note benefit: *long-form pieces can be posted straight into the garden instead of being
hand-placed*.

---

## Task 6: Prepare the Paulopus payload — REVIEW GATE

**Files:** none in the repo. The payload is built in the scratchpad and discarded after posting.

- [ ] **Step 1: Re-read the eight verification flags**

Read `../paulopus/content-ops/paulopus/verification-flags.json` and, for each flag, the current prose
in the focus it names. The prose was edited in paulopus `4ea4b3c` **after** the flags were recorded
and the file was never updated, so neither document can be trusted alone. Report, per flag: resolved
in the current text, or still standing. **Stop and show this list.**

- [ ] **Step 2: Draft the eight synopses**

One or two sentences per focus, as its bean `description`. Drafted from the whole article, not lifted
from its opening paragraph. **Stop and show all eight for the author to edit or replace.**

- [ ] **Step 3: Build the payload**

Write `payload.json` into the scratchpad (never the repo) from the nine paulopus markdown files:

- `narrative` ← `molecule.md` body, minus frontmatter and its `# Paulopus` H1 (the page renders the
  name itself).
- Each `focuses/<slug>.md` → one article: `slug` from frontmatter, `name` from `title`, `description`
  from step 2, `date: "2026-07-24"`, `content` the body minus frontmatter and minus the leading
  `Part of the [Paulopus](../molecule.md#…) molecule.` line, which the container relationship now
  expresses structurally.
- The 10 molecule→focus links, all mid-sentence, become inline
  `:entity[<link text>]{ref=bean:<slug>}` — the sentences must read exactly as written.
- Each drawer gains, at its end, a cluster of `::entity{ref=bean:<slug>}` block cards for the focuses
  that drawer compresses, taken from `molecule.md`'s own `drawers[].compresses` frontmatter. Context
  and Intention compress nothing and get no cluster.
- The 6 focus→molecule links become plain links to `/plant/paulopus#<drawer>`, lower-cased —
  Task 1's `rehype-slug` is what makes them land.
- Nothing from `substack/`.

- [ ] **Step 4: Check the payload before sending**

```bash
python3 -c "
import json,sys
p=json.load(open('<scratchpad>/payload.json'))
arts=p['articles']
print('articles:', len(arts), '| narrative KB:', round(len(p['narrative'])/1024,1))
assert len(arts)==8
for a in arts:
    assert a['description'].strip(), a['slug']
    assert '](focuses/' not in a['content'] and '../molecule.md' not in a['content'], a['slug']
print('inline mentions in narrative:', p['narrative'].count(':entity['))
print('card blocks in narrative:', p['narrative'].count('::entity{'))
print('no relative md links left:', '](' not in p['narrative'].split('](/plant')[0] or 'ok')
"
```

Expected: 8 articles, 10 inline mentions, 8 card blocks, every description non-blank, no relative
`.md` link anywhere.

---

## Task 7: Post, review, publish

- [ ] **Step 1: Privatize the container first**

The narrative would otherwise go live on a public plant while its cards resolve to nothing
(spec §3):

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('plants').updateOne({slug:'paulopus'},{\$set:{visibility:'private'}}); console.log('private'); process.exit(0) })"
```

- [ ] **Step 2: Post**

```bash
curl -sS -X POST http://localhost:3000/api/articles \
  -H "authorization: Bearer $ARTICLES_TOKEN" \
  -H "content-type: application/json" \
  --data-binary @<scratchpad>/payload.json | python3 -m json.tool
```

Expected: `{"ok": true, "written": 8, "narrative": true}`.

- [ ] **Step 3: Review on the page**

`/plant/paulopus` 404s while private — read it in the admin instead: each article at
`/admin/sprout/<slug>-0` renders its prose, and the molecule's cards show as **unresolved** there
(the beans are private) which is the admin's `showUnresolved` doing its job, not a bug.

- [ ] **Step 4: Publish, and let the cascade do the rest**

Publish each of the 8 sprouts from `/admin/sprout/<slug>-0`. `publishCascade` flips each bean **and**
`plant:paulopus` public, so the narrative, the cards and the articles go live together.

- [ ] **Step 5: Verify the live result**

- `/plant/paulopus` — the five drawers, 10 live inline mentions, 8 cards, the "Inside" index.
- A focus page, e.g. `/bean/karma-accountability` — the article with its tables and code intact, and
  its "part of" link landing on `/plant/paulopus#execution`.
- `/api/graph` — `embeds` and `mentions` edges from `plant:paulopus` to the eight beans.
- `/beanstalk` — the eight articles, dated 2026-07-24.

- [ ] **Step 6: Discard the payload**

```bash
rm <scratchpad>/payload.json
```

The content now lives in the database and nowhere else in Ariko; its provenance stays in the paulopus
repo.

---

## Notes for the executor

- **The door cannot publish, and must not learn how.** Every future agent inherits this endpoint.
- **Privatize the container before posting** (Task 7 step 1) or the narrative goes live with dead
  links for as long as the articles stay drafts.
- **The two review gates in Task 6 are hard stops** — the same discipline the original paulopus
  content plan used. Do not build the payload before the author has seen both lists.
- **Nothing about the content gets committed.** No `data/articles/`, no `garden.yml` prose, no
  payload file in the repo.
