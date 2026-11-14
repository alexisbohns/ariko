# Article door v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sibling repo's agent — local or in a Claude Code cloud container — posts essay sprouts and pod/bean narratives, with images, to Ariko as drafts, using a per-repo token scoped to its pod.

**Architecture:** A `tokens` collection holds sha256 hashes of `ariko_<pod>_…` tokens minted by a CLI. `/api/articles` dispatches on the token: a repo token takes the new `{ essays, narratives }` shape (validated in `lib/articles-v2.ts`, written by `lib/articles-v2-store.ts`), the legacy `ARTICLES_TOKEN` keeps the old shape. Two new routes — `/api/articles/ping` and `/api/articles/assets` — report scope and upload one raster image server-side. A new `ariko-article` plugin teaches agents the flow.

**Tech Stack:** Next.js 15 route handlers, MongoDB driver, Cloudinary (`lib/storage.ts`), `unified` + `remark-parse` + `remark-gfm` for the image rule, `node:test` via tsx.

**Spec:** `docs/superpowers/specs/2026-11-14-article-door-v2-design.md`

**Conventions every task follows**

- Unit tests: `npm test` (glob over `lib/**/*.test.ts`). A single file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/<file>.test.ts`.
- DB tests: `npm run test:db` runs a fixed list against `beanstalk_scratch`. **Never** run a DB test without `MONGODB_DB` set to a scratch DB — `.env.local` points at production. A single DB file: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/<file>.test.ts`.
- DB test files guard with `const hasDb = Boolean(process.env.MONGODB_URI);` and `test(..., { skip: !hasDb }, …)`, so `npm test` without a DB still passes. Copy that from `lib/articles-route.test.ts`.
- Test data uses a file-specific slug prefix and is deleted in `after`.
- Never `next build` in this checkout (the maintainer's dev server shares `.next`); the final task builds in a scratch worktree.
- Commit after every task, message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
|---|---|
| `lib/article-images.ts` (new) | Pure: list image URLs in markdown; the Ariko-hosted rule; Cloudinary cloud name from env. |
| `lib/articles.ts` (modify) | Export `validateText`, `SLUG` for reuse. |
| `lib/articles-v2.ts` (new) | Pure: v2 payload types + validation. |
| `lib/repo-token.ts` (new) | Pure: token generation/hash, setup card, `.env` block, target guards. |
| `lib/repo-token-store.ts` (new) | Mongo: mint, list, revoke, `authorizeRepo`. |
| `lib/articles-store.ts` (modify) | Export `containerStillWritableFilter`. |
| `lib/articles-v2-store.ts` (new) | Mongo: scope checks, refusals, writes for v2. |
| `app/api/articles/route.ts` (modify) | Dispatch legacy vs repo token. |
| `app/api/articles/ping/route.ts` (new) | Scope report. |
| `lib/articles-assets.ts` (new) + `app/api/articles/assets/route.ts` (new) | One-file upload, injectable deps. |
| `scripts/repo-token.ts` (new) | `token:mint` / `token:list` / `token:revoke`. |
| `plugins/ariko-article/**` (new) | The skill, its plugin manifest, the CLAUDE.md snippet. |
| `lib/garden-cache-source.test.ts` (modify) | Register the new writer module. |
| `CLAUDE.md`, `README.md`, `.env.example`, `package.json`, `.claude-plugin/marketplace.json` (modify) | Docs, scripts, marketplace. |

---

### Task 1: The image rule (pure)

**Files:**
- Create: `lib/article-images.ts`
- Test: `lib/article-images.test.ts`
- Modify: `package.json` (add `remark-parse` as a direct dependency)

- [ ] **Step 1: Add the dependency**

`remark-parse` is already installed transitively by `react-markdown`; importing a transitive dependency is fragile, so declare it.

Run: `npm install remark-parse@^11`
Expected: `package.json` gains `"remark-parse": "^11.x"`; no other dependency changes in `package-lock.json` beyond its entry.

- [ ] **Step 2: Write the failing test**

```ts
// lib/article-images.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudinaryCloudName, imageProblems, markdownImages } from "./article-images";

test("markdownImages lists inline image URLs, in order", () => {
  const md = "Intro\n\n![a](https://x.test/1.png)\n\nText ![b](https://x.test/2.png \"t\")";
  assert.deepEqual(markdownImages(md), { urls: ["https://x.test/1.png", "https://x.test/2.png"], references: 0 });
});

test("markdownImages counts reference-style images instead of resolving them", () => {
  const md = "![a][one]\n\n[one]: https://x.test/1.png";
  assert.deepEqual(markdownImages(md), { urls: [], references: 1 });
});

test("markdownImages ignores links and code", () => {
  const md = "[not an image](https://x.test/a.png)\n\n`![x](https://x.test/b.png)`\n\n```\n![x](https://x.test/c.png)\n```";
  assert.deepEqual(markdownImages(md), { urls: [], references: 0 });
});

test("imageProblems accepts Ariko's Cloudinary cloud only", () => {
  const ok = "![a](https://res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png)";
  assert.deepEqual(imageProblems(ok, "ariko"), []);
  const other = "![a](https://res.cloudinary.com/someone-else/image/upload/x.png)";
  assert.equal(imageProblems(other, "ariko").length, 1);
  const hotlink = "![a](https://example.com/x.png)";
  assert.match(imageProblems(hotlink, "ariko")[0], /https:\/\/example\.com\/x\.png is not hosted by Ariko/);
  const data = "![a](data:image/png;base64,AAAA)";
  assert.equal(imageProblems(data, "ariko").length, 1);
  const local = "![a](./shots/a.png)";
  assert.match(imageProblems(local, "ariko")[0], /upload it to \/api\/articles\/assets/);
});

test("imageProblems refuses reference-style images by name", () => {
  assert.match(imageProblems("![a][one]\n\n[one]: https://x.test/1.png", "ariko")[0], /reference-style/);
});

test("imageProblems with no configured cloud refuses every image", () => {
  assert.equal(imageProblems("![a](https://res.cloudinary.com/ariko/x.png)", undefined).length, 1);
  assert.deepEqual(imageProblems("no images here", undefined), []);
});

test("cloudinaryCloudName reads the host of CLOUDINARY_URL", () => {
  assert.equal(cloudinaryCloudName("cloudinary://123:abc@ariko"), "ariko");
  assert.equal(cloudinaryCloudName(undefined), undefined);
  assert.equal(cloudinaryCloudName("not a url"), undefined);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/article-images.test.ts`
Expected: FAIL — cannot find module `./article-images`.

- [ ] **Step 4: Implement**

```ts
// lib/article-images.ts
//
// The article door's image rule (spec 2026-11-14 §3.3): every image in posted
// prose must already be on Ariko's own Cloudinary cloud, uploaded through
// POST /api/articles/assets. That is what makes the draft the maintainer
// approved in the sibling session the draft that is stored — a hotlink can
// change or vanish after review, and a local path renders as a broken image.
//
// Parsed with the same remark + GFM grammar the renderer uses, so an image in
// a code span or fence (which renders as text) is correctly NOT an image, and
// a plain link is not one either. Reference-style images are refused rather
// than resolved: the door wants one obvious form, and a definition can sit
// anywhere in a 500 KiB body.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

export function markdownImages(markdown: string): { urls: string[]; references: number } {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const urls: string[] = [];
  let references = 0;
  visit(tree, (node) => {
    if (node.type === "image") urls.push((node as { url: string }).url);
    else if (node.type === "imageReference") references += 1;
  });
  return { urls, references };
}

/** One message per offending image; empty when every image is Ariko-hosted. */
export function imageProblems(markdown: string, cloud: string | undefined): string[] {
  const { urls, references } = markdownImages(markdown);
  const problems: string[] = [];
  if (references > 0)
    problems.push("reference-style images (![alt][id]) are not accepted — use ![alt](url)");
  const prefix = cloud ? `https://res.cloudinary.com/${cloud}/` : null;
  for (const url of urls) {
    if (prefix && url.startsWith(prefix)) continue;
    problems.push(
      `${url} is not hosted by Ariko — upload it to /api/articles/assets and use the URL it returns`,
    );
  }
  return problems;
}

/** `cloudinary://<key>:<secret>@<cloud>` → `<cloud>`. */
export function cloudinaryCloudName(env: string | undefined): string | undefined {
  if (!env) return undefined;
  const match = /^cloudinary:\/\/[^@]+@([a-z0-9-_]+)/i.exec(env);
  return match ? match[1] : undefined;
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/article-images.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/article-images.ts lib/article-images.test.ts
git commit -m "The article door's image rule: Ariko-hosted images only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: v2 payload validation (pure)

**Files:**
- Modify: `lib/articles.ts` (export `validateText` and `SLUG`)
- Create: `lib/articles-v2.ts`
- Test: `lib/articles-v2.test.ts`

- [ ] **Step 1: Export the two helpers from `lib/articles.ts`**

Change `const SLUG = /^[a-z0-9][a-z0-9-]*$/;` to `export const SLUG = /^[a-z0-9][a-z0-9-]*$/;` and `function validateText(` to `export function validateText(`. No behaviour change.

- [ ] **Step 2: Write the failing test**

```ts
// lib/articles-v2.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isV2Shape, validateArticlesV2 } from "./articles-v2";

const CLOUD = "ariko";
const IMG = "https://res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png";
const essay = (over: Record<string, unknown> = {}) => ({
  slug: "feed-redesign",
  date: "2026-11-14",
  name: { en: "Redrawing the feed", fr: "Redessiner le fil" },
  content: { en: `Body\n\n![shot](${IMG})` },
  about: ["pbbls", "feed"],
  ...over,
});
const narrative = (over: Record<string, unknown> = {}) => ({ slug: "feed", content: "Now…", ...over });
const v = (body: unknown) => validateArticlesV2(body, { cloud: CLOUD });

test("isV2Shape keys on essays/narratives", () => {
  assert.equal(isV2Shape({ essays: [] }), true);
  assert.equal(isV2Shape({ narratives: [] }), true);
  assert.equal(isV2Shape({ container: "pod:x" }), false);
  assert.equal(isV2Shape(null), false);
});

test("a valid essay and narrative pass", () => {
  assert.deepEqual(v({ essays: [essay()], narratives: [narrative()] }), { ok: true });
});

test("the payload must carry something", () => {
  assert.equal(v({}).ok, false);
  assert.equal(v({ essays: [], narratives: [] }).ok, false);
});

test("mixing the legacy shape in is refused", () => {
  const r = v({ essays: [essay()], container: "pod:pbbls" });
  assert.deepEqual(r, { ok: false, error: "container is a legacy key — v2 takes essays and narratives only" });
});

for (const key of ["state", "visibility", "kind", "type", "parents", "exhibited"]) {
  test(`refused key on an essay: ${key}`, () => {
    const r = v({ essays: [essay({ [key]: null })] });
    assert.deepEqual(r, { ok: false, error: `feed-redesign: ${key} is not accepted on this door` });
  });
  test(`refused key on a narrative: ${key}`, () => {
    const r = v({ narratives: [narrative({ [key]: "x" })] });
    assert.deepEqual(r, { ok: false, error: `feed: ${key} is not accepted on this door` });
  });
}

test("essay fields", () => {
  assert.match((v({ essays: [essay({ slug: "Bad Slug" })] }) as { error: string }).error, /slug must match/);
  assert.match((v({ essays: [essay({ date: "14/11/2026" })] }) as { error: string }).error, /date is required \(YYYY-MM-DD\)/);
  assert.match((v({ essays: [essay({ name: "  " })] }) as { error: string }).error, /name is required/);
  assert.match((v({ essays: [essay({ content: " " })] }) as { error: string }).error, /content is required/);
  assert.match((v({ essays: [essay({ about: [] })] }) as { error: string }).error, /about must name at least one/);
  assert.match((v({ essays: [essay({ about: ["pod:pbbls"] })] }) as { error: string }).error, /about takes bare slugs/);
  assert.match((v({ essays: [essay({ about: ["feed", "feed"] })] }) as { error: string }).error, /about repeats feed/);
  assert.match((v({ essays: [essay(), essay()] }) as { error: string }).error, /duplicate essay slug: feed-redesign/);
});

test("narrative fields", () => {
  assert.match((v({ narratives: [narrative({ content: "" })] }) as { error: string }).error, /content is required/);
  assert.match((v({ narratives: [narrative(), narrative()] }) as { error: string }).error, /duplicate narrative slug: feed/);
});

test("images: every content part is checked, in both languages", () => {
  const r = v({ essays: [essay({ content: { en: "ok", fr: "![x](https://example.com/a.png)" } })] });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /^feed-redesign: content\.fr: https:\/\/example\.com\/a\.png is not hosted by Ariko/);
  const n = v({ narratives: [narrative({ content: "![x](./a.png)" })] });
  assert.match((n as { error: string }).error, /^feed: content: \.\/a\.png is not hosted by Ariko/);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/articles-v2.test.ts`
Expected: FAIL — cannot find module `./articles-v2`.

- [ ] **Step 4: Implement**

```ts
// lib/articles-v2.ts
//
// Pure validation for the v2 article door (spec 2026-11-14 §3.3): a repo token
// posts essays (draft sprouts of kind `essay`) and narratives (its pod's or a
// bean's `content`). Shape only — scope (is this slug in the token's pod?) is
// the store's, because it needs the database. First failure wins and names
// the offender, as validateArticlesPayload does.
//
// Six keys are refused BY NAME whatever their value, because each is a way to
// do something this door must not: publish (`state`, `visibility`,
// `exhibited`), pick a kind other than essay (`kind`, and `type`, the field
// `kind` replaced), or anchor outside `about` (`parents`).

import { isTimelineDate } from "./sprout-date";
import type { Text } from "./data";
import { SLUG, validateText } from "./articles";
import { imageProblems } from "./article-images";

export interface EssayInput {
  slug: string;
  date: string;
  name: Text;
  description?: Text;
  content: Text;
  about: string[];
}

export interface NarrativeInput {
  slug: string;
  name?: Text;
  description?: Text;
  content: Text;
}

export interface ArticlesV2 {
  essays?: EssayInput[];
  narratives?: NarrativeInput[];
}

type Check = { ok: true } | { ok: false; error: string };

const REFUSED_KEYS = ["state", "visibility", "kind", "type", "parents", "exhibited"] as const;
const LEGACY_KEYS = ["container", "narrative", "articles"] as const;

export function isV2Shape(body: unknown): boolean {
  return typeof body === "object" && body !== null && ("essays" in body || "narratives" in body);
}

function parts(text: Text): [string, string][] {
  return typeof text === "string" ? [["", text]] : Object.entries(text).map(([k, v]) => [k, v ?? ""]);
}

function checkImages(who: string, content: Text, cloud: string | undefined): Check {
  for (const [lang, md] of parts(content)) {
    const problems = imageProblems(md, cloud);
    if (problems.length > 0)
      return { ok: false, error: `${who}: content${lang ? `.${lang}` : ""}: ${problems[0]}` };
  }
  return { ok: true };
}

function checkCommon(raw: Record<string, unknown>, who: string): Check {
  for (const key of REFUSED_KEYS)
    if (key in raw) return { ok: false, error: `${who}: ${key} is not accepted on this door` };
  if (typeof raw.slug !== "string" || !SLUG.test(raw.slug))
    return { ok: false, error: `${who}: slug must match ^[a-z0-9][a-z0-9-]*$` };
  if (raw.description !== undefined) {
    const d = validateText(raw.description, `${who}: description`, { required: false });
    if (!d.ok) return d;
  }
  return validateText(raw.content, `${who}: content`, { required: true });
}

function eachObject(list: unknown, label: string): Check | Record<string, unknown>[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return { ok: false, error: `${label} must be an array` };
  for (const item of list)
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return { ok: false, error: `every ${label.slice(0, -1)} must be an object` };
  return list as Record<string, unknown>[];
}

const whoOf = (raw: Record<string, unknown>) =>
  typeof raw.slug === "string" && raw.slug !== "" ? raw.slug : "(missing slug)";

export function validateArticlesV2(body: unknown, opts: { cloud: string | undefined }): Check {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return { ok: false, error: "body must be an object" };
  const b = body as Record<string, unknown>;
  for (const key of LEGACY_KEYS)
    if (key in b) return { ok: false, error: `${key} is a legacy key — v2 takes essays and narratives only` };

  const essays = eachObject(b.essays, "essays");
  if (!Array.isArray(essays)) return essays;
  const narratives = eachObject(b.narratives, "narratives");
  if (!Array.isArray(narratives)) return narratives;
  if (essays.length + narratives.length === 0)
    return { ok: false, error: "payload must carry at least one essay or narrative" };

  const seenEssays = new Set<string>();
  for (const raw of essays) {
    const who = whoOf(raw);
    const common = checkCommon(raw, who);
    if (!common.ok) return common;
    if (seenEssays.has(raw.slug as string)) return { ok: false, error: `duplicate essay slug: ${raw.slug}` };
    seenEssays.add(raw.slug as string);
    const name = validateText(raw.name, `${who}: name`, { required: true });
    if (!name.ok) return name;
    if (typeof raw.date !== "string" || !isTimelineDate(raw.date))
      return { ok: false, error: `${who}: date is required (YYYY-MM-DD)` };
    if (!Array.isArray(raw.about) || raw.about.length === 0)
      return { ok: false, error: `${who}: about must name at least one of the pod or its beans` };
    const seenAbout = new Set<string>();
    for (const a of raw.about) {
      if (typeof a !== "string" || !SLUG.test(a))
        return { ok: false, error: `${who}: about takes bare slugs (the pod's or a bean's), got ${String(a)}` };
      if (seenAbout.has(a)) return { ok: false, error: `${who}: about repeats ${a}` };
      seenAbout.add(a);
    }
    const images = checkImages(who, raw.content as Text, opts.cloud);
    if (!images.ok) return images;
  }

  const seenNarratives = new Set<string>();
  for (const raw of narratives) {
    const who = whoOf(raw);
    const common = checkCommon(raw, who);
    if (!common.ok) return common;
    if (seenNarratives.has(raw.slug as string))
      return { ok: false, error: `duplicate narrative slug: ${raw.slug}` };
    seenNarratives.add(raw.slug as string);
    if (raw.name !== undefined) {
      const name = validateText(raw.name, `${who}: name`, { required: true });
      if (!name.ok) return name;
    }
    const images = checkImages(who, raw.content as Text, opts.cloud);
    if (!images.ok) return images;
  }
  return { ok: true };
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/articles-v2.test.ts lib/articles.test.ts`
Expected: PASS (both files; `articles.test.ts` proves the export change broke nothing).

- [ ] **Step 6: Commit**

```bash
git add lib/articles.ts lib/articles-v2.ts lib/articles-v2.test.ts
git commit -m "Article door v2: payload validation for essays and narratives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repo token helpers (pure)

**Files:**
- Create: `lib/repo-token.ts`
- Test: `lib/repo-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/repo-token.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENV_BLOCK_END,
  ENV_BLOCK_START,
  envBlock,
  envTargetProblem,
  generateToken,
  hashToken,
  looksLikeRepoToken,
  setupCard,
  sheetTargetProblem,
  upsertEnvBlock,
} from "./repo-token";

test("generateToken: ariko_<pod>_<32 base64url chars>, never twice the same", () => {
  const a = generateToken("pbbls");
  assert.match(a, /^ariko_pbbls_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(a, generateToken("pbbls"));
  assert.equal(looksLikeRepoToken(a), true);
  assert.equal(looksLikeRepoToken("tok_legacy"), false);
});

test("hashToken is sha256 hex and does not contain the token", () => {
  const t = generateToken("pbbls");
  const h = hashToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashToken(t));
  assert.equal(h.includes(t), false);
});

test("envBlock carries the token, the URL and the cloud reminder", () => {
  const block = envBlock({ pod: "pbbls", token: "ariko_pbbls_x", date: "2026-11-14" });
  assert.ok(block.startsWith(ENV_BLOCK_START));
  assert.ok(block.trimEnd().endsWith(ENV_BLOCK_END));
  assert.match(block, /^ARIKO_TOKEN=ariko_pbbls_x$/m);
  assert.match(block, /^ARIKO_URL=https:\/\/www\.ariko\.app$/m);
  assert.match(block, /CLOUD SESSIONS do not see this file/);
  assert.match(block, /allow www\.ariko\.app/);
});

test("upsertEnvBlock appends once, then replaces in place", () => {
  const first = upsertEnvBlock("FOO=1\n", envBlock({ pod: "p", token: "ariko_p_a", date: "2026-11-14" }));
  assert.match(first, /^FOO=1\n\n# >>> ariko/);
  const second = upsertEnvBlock(first + "BAR=2\n", envBlock({ pod: "p", token: "ariko_p_b", date: "2026-11-15" }));
  assert.equal(second.match(/# >>> ariko/g)?.length, 1);
  assert.match(second, /ARIKO_TOKEN=ariko_p_b/);
  assert.doesNotMatch(second, /ariko_p_a/);
  assert.match(second, /BAR=2/);
  assert.equal(upsertEnvBlock("", "X\n"), "X\n");
});

test("setupCard has the five steps, the token and the snippets", () => {
  const card = setupCard({ pod: "pbbls", token: "ariko_pbbls_x", claudeSnippet: "## Writing for Ariko\n…" });
  assert.match(card, /^## pbbls$/m);
  assert.match(card, /ARIKO_TOKEN=ariko_pbbls_x/);
  assert.match(card, /www\.ariko\.app/);
  assert.match(card, /"ariko-article@ariko": true/);
  assert.match(card, /## Writing for Ariko/);
  assert.match(card, /ping Ariko/);
});

test("envTargetProblem refuses a git-tracked file", () => {
  const tracked = () => ({ status: 0 });
  const untracked = () => ({ status: 1 });
  assert.match(envTargetProblem("/r/.env", tracked) ?? "", /tracked by git/);
  assert.equal(envTargetProblem("/r/.env", untracked), null);
});

test("sheetTargetProblem refuses a path inside a git work tree", () => {
  assert.match(sheetTargetProblem("/r/sheet.md", () => ({ status: 0 })) ?? "", /inside a git repository/);
  assert.equal(sheetTargetProblem("/Desktop/sheet.md", () => ({ status: 128 })), null);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/repo-token.test.ts`
Expected: FAIL — cannot find module `./repo-token`.

- [ ] **Step 3: Implement**

```ts
// lib/repo-token.ts
//
// Pure half of the per-repo tokens (spec 2026-11-14 §2): the token's shape,
// its hash, and everything `npm run token:mint` hands the maintainer — the
// setup card for one cloud environment preset, and the marked `.env` block a
// later mint replaces rather than duplicates. The Mongo half is
// lib/repo-token-store.ts.
//
// The `ariko_<pod>_` prefix is for a human reading an .env. Authorization is a
// hash lookup and NEVER parses the prefix as a claim — the pod a token writes
// to is the one stored beside its hash.

import { createHash, randomBytes } from "node:crypto";
import { dirname, basename } from "node:path";

export const ARIKO_URL = "https://www.ariko.app";
export const ENV_BLOCK_START = "# >>> ariko";
export const ENV_BLOCK_END = "# <<< ariko";

export function generateToken(pod: string): string {
  return `ariko_${pod}_${randomBytes(24).toString("base64url")}`;
}

export function looksLikeRepoToken(token: string): boolean {
  return token.startsWith("ariko_");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function envBlock({ pod, token, date }: { pod: string; token: string; date: string }): string {
  return [
    `${ENV_BLOCK_START} (minted ${date} by \`npm run token:mint -- --pod ${pod}\`)`,
    "# Drafts for Ariko: the ariko-article skill reads these.",
    "# CLOUD SESSIONS do not see this file. In the Claude Code cloud environment",
    "# preset for this repo, also:",
    "#   - Environment variables: ARIKO_TOKEN and ARIKO_URL, same values as below",
    "#   - Network access: allow www.ariko.app",
    `ARIKO_TOKEN=${token}`,
    `ARIKO_URL=${ARIKO_URL}`,
    ENV_BLOCK_END,
    "",
  ].join("\n");
}

/** Replace the marked block if present, else append it after a blank line. */
export function upsertEnvBlock(existing: string, block: string): string {
  const start = existing.indexOf(ENV_BLOCK_START);
  const end = existing.indexOf(ENV_BLOCK_END);
  if (start !== -1 && end > start) {
    const after = existing.slice(end + ENV_BLOCK_END.length).replace(/^\n/, "");
    return existing.slice(0, start) + block + after;
  }
  if (existing === "") return block;
  return existing.replace(/\n*$/, "\n\n") + block;
}

const SETTINGS_SNIPPET = `{
  "extraKnownMarketplaces": {
    "ariko": { "source": { "source": "github", "repo": "alexisbohns/ariko" } }
  },
  "enabledPlugins": { "ariko-article@ariko": true }
}`;

export function setupCard({ pod, token, claudeSnippet }: { pod: string; token: string; claudeSnippet: string }): string {
  return [
    `## ${pod}`,
    "",
    "**1. Cloud preset → Environment variables** (paste as is):",
    "",
    "```",
    `ARIKO_TOKEN=${token}`,
    `ARIKO_URL=${ARIKO_URL}`,
    "```",
    "",
    "**2. Cloud preset → Network access:** add `www.ariko.app` to the allowed domains",
    "(or use full access). Nothing else: images go through Ariko.",
    "",
    "**3. Repo → `.claude/settings.json`** (merge into it):",
    "",
    "```json",
    SETTINGS_SNIPPET,
    "```",
    "",
    "**4. Repo → `CLAUDE.md`** (paste this section):",
    "",
    "````md",
    claudeSnippet.trimEnd(),
    "````",
    "",
    "**5. Check:** open a cloud session in this repo and ask it to ping Ariko;",
    `it should answer with the pod \`${pod}\`.`,
    "",
  ].join("\n");
}

export type GitRunner = (args: string[], cwd: string) => { status: number | null };

/** null when the path is safe to write a token into; else why not. */
export function envTargetProblem(path: string, git: GitRunner): string | null {
  const { status } = git(["ls-files", "--error-unmatch", basename(path)], dirname(path));
  return status === 0
    ? `${path} is tracked by git — a token written there would be published on the next push`
    : null;
}

export function sheetTargetProblem(path: string, git: GitRunner): string | null {
  const { status } = git(["rev-parse", "--is-inside-work-tree"], dirname(path));
  return status === 0
    ? `${path} is inside a git repository — write the sheet somewhere no commit can pick it up`
    : null;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/repo-token.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/repo-token.ts lib/repo-token.test.ts
git commit -m "Per-repo tokens: shape, hash, setup card and .env block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Token store and `authorizeRepo` (Mongo)

**Files:**
- Create: `lib/repo-token-store.ts`
- Test: `lib/repo-token-store.test.ts`
- Modify: `package.json` (`test:db` list)

- [ ] **Step 1: Write the failing test**

```ts
// lib/repo-token-store.test.ts
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { getDb, closeDb } from "./db";
import { authorizeRepo, listTokens, mintToken, revokePod } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const POD = "test-repo-token-pod";

async function cleanup() {
  const db = await getDb();
  await db.collection("tokens").deleteMany({ pod: POD });
  await db.collection("pods").deleteMany({ slug: POD });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("pods").insertOne({ slug: POD, name: "T", description: "", parents: [] });
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

test("mint → authorize round-trip; plaintext never stored", { skip: !hasDb }, async () => {
  const token = await mintToken(POD, "test");
  assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: true, pod: POD });
  const db = await getDb();
  const doc = await db.collection("tokens").findOne({ pod: POD, revokedAt: { $exists: false } });
  assert.ok(doc);
  assert.equal(JSON.stringify(doc).includes(token), false);
});

test("minting again revokes the previous token", { skip: !hasDb }, async () => {
  const first = await mintToken(POD, "one");
  const second = await mintToken(POD, "two");
  assert.deepEqual(await authorizeRepo(`Bearer ${first}`), { ok: false });
  assert.deepEqual(await authorizeRepo(`Bearer ${second}`), { ok: true, pod: POD });
  const live = (await listTokens()).filter((t) => t.pod === POD && !t.revokedAt);
  assert.equal(live.length, 1);
});

test("revokePod revokes", { skip: !hasDb }, async () => {
  const token = await mintToken(POD, "x");
  assert.equal(await revokePod(POD), 1);
  assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: false });
});

test("mintToken refuses an unknown pod", { skip: !hasDb }, async () => {
  await assert.rejects(mintToken("test-repo-token-nope", "x"), /unknown pod/);
});

test("authorizeRepo: no header, non-repo token, unknown token", async () => {
  // The first two never touch the database, so they run without one.
  assert.deepEqual(await authorizeRepo(null), { ok: false });
  assert.deepEqual(await authorizeRepo("Bearer tok_legacy"), { ok: false });
  if (hasDb) assert.deepEqual(await authorizeRepo("Bearer ariko_x_unknown"), { ok: false });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/repo-token-store.test.ts`
Expected: FAIL — cannot find module `./repo-token-store`.

- [ ] **Step 3: Implement**

```ts
// lib/repo-token-store.ts
//
// Mongo half of the per-repo tokens (spec 2026-11-14 §2). One live token per
// pod: minting revokes the previous one in the same call. The collection holds
// hashes only — a lost token is re-minted, never recovered.
//
// authorizeRepo answers every refusal identically ({ ok: false } → 401 with
// one body), so a caller cannot tell a revoked token from a mistyped one. A
// bearer that does not look like a repo token is refused WITHOUT a database
// read: the legacy ARTICLES_TOKEN path in app/api/articles/route.ts falls
// through to its own check, and must keep working with no database at all.

import { getDb } from "./db";
import { generateToken, hashToken, looksLikeRepoToken } from "./repo-token";

export interface RepoToken {
  pod: string;
  hash: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

async function tokens() {
  const db = await getDb();
  const col = db.collection<RepoToken>("tokens");
  await col.createIndex({ hash: 1 }, { unique: true });
  await col.createIndex({ pod: 1 });
  return { db, col };
}

export async function mintToken(pod: string, label: string): Promise<string> {
  const { db, col } = await tokens();
  const exists = await db.collection("pods").findOne({ slug: pod }, { projection: { _id: 1 } });
  if (!exists) throw new Error(`unknown pod: ${pod}`);
  const now = new Date().toISOString();
  await col.updateMany({ pod, revokedAt: { $exists: false } }, { $set: { revokedAt: now } });
  const token = generateToken(pod);
  await col.insertOne({ pod, hash: hashToken(token), label, createdAt: now });
  return token;
}

export async function revokePod(pod: string): Promise<number> {
  const { col } = await tokens();
  const res = await col.updateMany(
    { pod, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date().toISOString() } },
  );
  return res.modifiedCount;
}

export async function listTokens(): Promise<Omit<RepoToken, "hash">[]> {
  const { col } = await tokens();
  return col
    .find({}, { projection: { _id: 0, hash: 0 } })
    .sort({ pod: 1, createdAt: -1 })
    .toArray() as Promise<Omit<RepoToken, "hash">[]>;
}

export type RepoAuth = { ok: true; pod: string } | { ok: false };

export async function authorizeRepo(header: string | null): Promise<RepoAuth> {
  if (!header?.startsWith("Bearer ")) return { ok: false };
  const token = header.slice("Bearer ".length).trim();
  if (!looksLikeRepoToken(token)) return { ok: false };
  const { col } = await tokens();
  const doc = await col.findOne({ hash: hashToken(token), revokedAt: { $exists: false } });
  if (!doc) return { ok: false };
  // Best effort: a failed timestamp must not refuse an authorized request.
  col.updateOne({ hash: doc.hash }, { $set: { lastUsedAt: new Date().toISOString() } }).catch(() => {});
  return { ok: true, pod: doc.pod };
}
```

- [ ] **Step 4: Add the file to `test:db`**

In `package.json`, append ` lib/repo-token-store.test.ts` to the end of the `test:db` file list.

- [ ] **Step 5: Run it to see it pass**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/repo-token-store.test.ts`
Expected: PASS, 5 tests. Also `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/repo-token-store.test.ts` (no env file): PASS with 4 skipped.

- [ ] **Step 6: Commit**

```bash
git add lib/repo-token-store.ts lib/repo-token-store.test.ts package.json
git commit -m "Per-repo tokens: mint, revoke, list, authorizeRepo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The v2 store (Mongo)

**Files:**
- Modify: `lib/articles-store.ts` (export `containerStillWritableFilter`)
- Create: `lib/articles-v2-store.ts`
- Test: `lib/articles-v2-store.test.ts`
- Modify: `package.json` (`test:db` list), `lib/garden-cache-source.test.ts`

- [ ] **Step 1: Export the filter**

In `lib/articles-store.ts`, change `function containerStillWritableFilter()` to `export function containerStillWritableFilter()`. Then, in `lib/garden-cache-source.test.ts`, the `lib/articles-store.ts` entry of `FOREIGN_MODULES` must classify the new export: set its `readers` to `new Set(["containerStillWritableFilter"])`.

- [ ] **Step 2: Write the failing test**

```ts
// lib/articles-v2-store.test.ts
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDb, closeDb } from "./db";
import { writeArticlesV2 } from "./articles-v2-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const P = "test-v2-";
const PLANT = `${P}plant`;
const POD = `${P}pod`;
const OTHER_POD = `${P}other`;
const BEAN = `${P}bean`;
const OTHER_BEAN = `${P}other-bean`;

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans", "sprouts"]) await db.collection(c).deleteMany({ slug: rx });
}

beforeEach(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("plants").insertOne({ slug: PLANT, name: "Plant", description: "", visibility: "private" });
  await db.collection("pods").insertMany([
    { slug: POD, name: "Pod", description: "", parents: [`plant:${PLANT}`], visibility: "private" },
    { slug: OTHER_POD, name: "Other", description: "", parents: [`plant:${PLANT}`], visibility: "private" },
  ]);
  await db.collection("beans").insertMany([
    { slug: BEAN, name: "Bean", parents: [`pod:${POD}`], visibility: "private",
      relations: [{ kind: "inspired-by", ref: "plant:x" }] },
    { slug: OTHER_BEAN, name: "Other bean", parents: [`pod:${OTHER_POD}`], visibility: "private" },
  ]);
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

const essay = (over = {}) => ({
  slug: `${P}essay`, date: "2026-11-14", name: "Essay", content: "Body", about: [POD, BEAN], ...over,
});

test("an essay is written as a draft essay with about refs and no parents", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { essays: [essay()] });
  assert.deepEqual(r, { ok: true, essays: [`${P}essay`], narratives: [] });
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.equal(s?.state, "draft");
  assert.equal(s?.kind, "essay");
  assert.deepEqual(s?.about, [`pod:${POD}`, `bean:${BEAN}`]);
  assert.equal(s?.parents, undefined);
  assert.equal(s?.source?.kind, "article-door");
});

test("re-posting replaces a draft", { skip: !hasDb }, async () => {
  await writeArticlesV2(POD, { essays: [essay()] });
  const r = await writeArticlesV2(POD, { essays: [essay({ content: "Second", about: [BEAN] })] });
  assert.equal(r.ok, true);
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.equal(s?.content, "Second");
  assert.deepEqual(s?.about, [`bean:${BEAN}`]);
});

test("a published or private sprout is refused as already reviewed", { skip: !hasDb }, async () => {
  for (const state of ["published", "private"]) {
    await (await getDb()).collection("sprouts").deleteMany({ slug: `${P}essay` });
    await writeArticlesV2(POD, { essays: [essay()] });
    await (await getDb()).collection("sprouts").updateOne({ slug: `${P}essay` }, { $set: { state } });
    const r = await writeArticlesV2(POD, { essays: [essay({ content: "clobber" })] });
    assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (already reviewed)`] });
  }
});

test("a draft from another pod is refused", { skip: !hasDb }, async () => {
  await writeArticlesV2(OTHER_POD, { essays: [essay({ about: [OTHER_POD] })] });
  const r = await writeArticlesV2(POD, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (not in pod ${POD})`] });
});

test("about outside the pod is refused by name", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { essays: [essay({ about: [OTHER_BEAN] })] });
  assert.deepEqual(r, { ok: false, refused: [`${P}essay: about ${OTHER_BEAN} is not in pod ${POD}`] });
});

test("a narrative on a bean of the pod keeps hand-authored relations", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { narratives: [{ slug: BEAN, content: "Now :entity[x]{ref=bean:test-v2-other-bean}" }] });
  assert.equal(r.ok, true);
  const b = await (await getDb()).collection("beans").findOne({ slug: BEAN });
  assert.match(String(b?.content), /^Now/);
  assert.ok(b?.relations.some((x: { kind: string }) => x.kind === "inspired-by"));
});

test("a narrative on the pod itself", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { narratives: [{ slug: POD, content: "Pod story" }] });
  assert.equal(r.ok, true);
  assert.equal((await (await getDb()).collection("pods").findOne({ slug: POD }))?.content, "Pod story");
});

test("a narrative on a new bean creates it privately under the pod; needs a name", { skip: !hasDb }, async () => {
  const nameless = await writeArticlesV2(POD, { narratives: [{ slug: `${P}new`, content: "x" }] });
  assert.deepEqual(nameless, { ok: false, refused: [`bean:${P}new (a new bean needs a name)`] });
  const r = await writeArticlesV2(POD, {
    narratives: [{ slug: `${P}new`, name: "New", content: "x" }],
    essays: [essay({ about: [`${P}new`] })],
  });
  assert.equal(r.ok, true);
  const b = await (await getDb()).collection("beans").findOne({ slug: `${P}new` });
  assert.deepEqual(b?.parents, [`pod:${POD}`]);
  assert.equal(b?.visibility, "private");
});

test("a narrative on another pod's bean is refused", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { narratives: [{ slug: OTHER_BEAN, content: "x" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${OTHER_BEAN} (not in pod ${POD})`] });
});

test("a public bean and a public pod with prose are refused", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne({ slug: BEAN }, { $set: { visibility: "public" } });
  await db.collection("pods").updateOne({ slug: POD }, { $set: { visibility: "public", content: "Live" } });
  const r = await writeArticlesV2(POD, { narratives: [{ slug: BEAN, content: "x" }, { slug: POD, content: "y" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${BEAN} (already reviewed)`, `pod:${POD} (already reviewed)`] });
});

test("one refusal writes nothing at all", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, {
    essays: [essay()],
    narratives: [{ slug: OTHER_BEAN, content: "x" }],
  });
  assert.equal(r.ok, false);
  assert.equal(await (await getDb()).collection("sprouts").countDocuments({ slug: `${P}essay` }), 0);
});

test("an unknown pod refuses everything", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(`${P}gone`, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`pod:${P}gone (unknown)`] });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/articles-v2-store.test.ts`
Expected: FAIL — cannot find module `./articles-v2-store`.

- [ ] **Step 4: Implement**

```ts
// lib/articles-v2-store.ts
//
// Mongo glue for the v2 article door (spec 2026-11-14 §3.3). The token names a
// pod; everything this module writes must be inside it: the pod itself, a bean
// whose parents include `pod:<pod>`, or a bean this same payload creates under
// it. Every refusal is collected before any write (all-or-nothing, as
// writeArticles does), and the writes re-assert their preconditions in their
// filters so a human publishing mid-write turns into a refusal, not a clobber.
//
// It never writes `state: "published"` or `visibility` on anything but a bean
// it creates (private). Relations hand-authored in the admin are kept:
// mergeMirrored over the STORED list, never over `undefined` — the v2 door is
// an edit path for drafts a human may already have touched.

import { getDb } from "./db";
import { resolveText, POD_PREFIX, BEAN_PREFIX, type Bean, type Pod, type Sprout, type Text } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { containerStillWritableFilter } from "./articles-store";
import { createSprout, SlugExistsError } from "./botanical";
import type { ArticlesV2 } from "./articles-v2";

export type V2Result =
  | { ok: true; essays: string[]; narratives: string[] }
  | { ok: false; refused: string[] };

const REPLACEABLE = (state: Sprout["state"]) => state === undefined || state === "draft";

export async function writeArticlesV2(pod: string, payload: ArticlesV2): Promise<V2Result> {
  const db = await getDb();
  const essays = payload.essays ?? [];
  const narratives = payload.narratives ?? [];
  const refused: string[] = [];

  const podDoc = await db
    .collection<Pod>("pods")
    .findOne({ slug: pod }, { projection: { _id: 0, slug: 1, visibility: 1, content: 1, relations: 1 } });
  if (!podDoc) return { ok: false, refused: [`pod:${pod} (unknown)`] };

  const podBeans = await db
    .collection<Bean>("beans")
    .find({ parents: `${POD_PREFIX}${pod}` }, { projection: { _id: 0 } })
    .toArray();
  const beanBySlug = new Map(podBeans.map((b) => [b.slug, b]));

  // --- Narratives: scope and refusals ---
  const narrativeBeanSlugs = narratives.map((n) => n.slug).filter((s) => s !== pod);
  const elsewhere = await db
    .collection<Bean>("beans")
    .find(
      { slug: { $in: narrativeBeanSlugs.filter((s) => !beanBySlug.has(s)) } },
      { projection: { _id: 0, slug: 1 } },
    )
    .toArray();
  const elsewhereSlugs = new Set(elsewhere.map((b) => b.slug));
  const created = new Set<string>();

  for (const n of narratives) {
    if (n.slug === pod) {
      if (podDoc.visibility === "public" && resolveText(podDoc.content).trim() !== "")
        refused.push(`pod:${pod} (already reviewed)`);
      continue;
    }
    const bean = beanBySlug.get(n.slug);
    if (bean) {
      if (bean.visibility === "public") refused.push(`bean:${n.slug} (already reviewed)`);
      else if (bean.projected) refused.push(`bean:${n.slug} (projected)`);
    } else if (elsewhereSlugs.has(n.slug)) {
      refused.push(`bean:${n.slug} (not in pod ${pod})`);
    } else if (n.name === undefined) {
      refused.push(`bean:${n.slug} (a new bean needs a name)`);
    } else {
      created.add(n.slug);
    }
  }

  // --- Essays: scope and refusals ---
  const inScope = (slug: string) => slug === pod || beanBySlug.has(slug) || created.has(slug);
  const toRef = (slug: string) => (slug === pod ? `${POD_PREFIX}${slug}` : `${BEAN_PREFIX}${slug}`);
  const scopeRefs = new Set([`${POD_PREFIX}${pod}`, ...[...beanBySlug.keys()].map((s) => `${BEAN_PREFIX}${s}`)]);

  const stored = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: essays.map((e) => e.slug) } }, { projection: { _id: 0 } })
    .toArray();
  const storedBySlug = new Map(stored.map((s) => [s.slug, s]));

  for (const e of essays) {
    for (const a of e.about) if (!inScope(a)) refused.push(`${e.slug}: about ${a} is not in pod ${pod}`);
    const existing = storedBySlug.get(e.slug);
    if (!existing) continue;
    if (!REPLACEABLE(existing.state)) refused.push(`sprout:${e.slug} (already reviewed)`);
    else if (!existing.about?.length || !existing.about.every((r) => scopeRefs.has(r)))
      refused.push(`sprout:${e.slug} (not in pod ${pod})`);
  }

  if (refused.length > 0) return { ok: false, refused };

  // --- Writes: narratives first, so a bean created here exists for an essay's about ---
  for (const n of narratives) {
    const set: Record<string, unknown> = { content: n.content };
    if (n.name !== undefined) set.name = n.name;
    if (n.description !== undefined && resolveText(n.description).trim() !== "") set.description = n.description;

    if (n.slug === pod) {
      set.relations = mergeMirrored(podDoc.relations, extractRefs(n.content));
      const r = await db.collection("pods").updateOne({ slug: pod, ...containerStillWritableFilter() }, { $set: set });
      if (r.matchedCount === 0) return { ok: false, refused: [`pod:${pod} (already reviewed)`] };
    } else if (created.has(n.slug)) {
      await db.collection("beans").insertOne({
        slug: n.slug,
        ...set,
        relations: mergeMirrored(undefined, extractRefs(n.content)),
        parents: [`${POD_PREFIX}${pod}`],
        visibility: "private",
      });
    } else {
      set.relations = mergeMirrored(beanBySlug.get(n.slug)?.relations, extractRefs(n.content));
      const r = await db
        .collection("beans")
        .updateOne({ slug: n.slug, visibility: { $ne: "public" }, projected: { $exists: false } }, { $set: set });
      if (r.matchedCount === 0) return { ok: false, refused: [`bean:${n.slug} (already reviewed)`] };
    }
  }

  for (const e of essays) {
    const about = e.about.map(toRef);
    const description: Text = e.description ?? "";
    const existing = storedBySlug.get(e.slug);
    if (existing) {
      const r = await db.collection<Sprout>("sprouts").updateOne(
        { slug: e.slug, state: { $nin: ["published", "private"] } },
        {
          $set: {
            name: e.name,
            description,
            content: e.content,
            date: e.date,
            about,
            relations: mergeMirrored(existing.relations, extractRefs(e.content)),
          },
          $unset: { parents: "" },
        },
      );
      if (r.matchedCount === 0) return { ok: false, refused: [`sprout:${e.slug} (already reviewed)`] };
    } else {
      try {
        await createSprout({
          slug: e.slug,
          name: e.name,
          kind: "essay",
          date: e.date,
          description,
          about,
          content: e.content,
          state: "draft",
          media: [],
          source: { kind: "article-door", externalId: pod, capturedAt: new Date().toISOString() },
          relations: mergeMirrored(undefined, extractRefs(e.content)),
        });
      } catch (err) {
        if (err instanceof SlugExistsError) return { ok: false, refused: [`sprout:${e.slug} (created meanwhile)`] };
        throw err;
      }
    }
  }

  return { ok: true, essays: essays.map((e) => e.slug), narratives: narratives.map((n) => n.slug) };
}
```

`SproutInput` (`lib/promote.ts:26`) requires `media` and `source`; `source.kind: "article-door"` with the pod as `externalId` records which repo wrote the entry. Step 2's first test pins it.

- [ ] **Step 5: Register the module in the cache source test**

In `lib/garden-cache-source.test.ts`:
- add `"writeArticlesV2"` to `FOREIGN_WRITERS`;
- add an entry to `FOREIGN_MODULES`:

```ts
  {
    path: "lib/articles-v2-store.ts",
    writers: new Set(["writeArticlesV2"]),
    readers: new Set([]),
  },
```

(`V2Result` is a type export; follow whatever the existing entries do with type exports — `lib/articles-store.ts` exports `WriteResult` and does not list it, so types are not counted.)

- [ ] **Step 6: Add the test file to `test:db`** — append ` lib/articles-v2-store.test.ts` to the `test:db` list in `package.json`.

- [ ] **Step 7: Run tests**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/articles-v2-store.test.ts`
Expected: PASS, 12 tests.
Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-cache-source.test.ts`
Expected: PASS. If "the four write doors" fails, the new module was given a `revalidateGarden()` call — remove it; the route invalidates (Task 6).

- [ ] **Step 8: Commit**

```bash
git add lib/articles-store.ts lib/articles-v2-store.ts lib/articles-v2-store.test.ts lib/garden-cache-source.test.ts package.json
git commit -m "Article door v2 store: essays and narratives, scoped to the token's pod

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dispatch on the token in `/api/articles`

**Files:**
- Modify: `app/api/articles/route.ts`
- Test: `lib/articles-route-v2.test.ts` (new; DB-backed)
- Modify: `package.json` (`test:db` list)

- [ ] **Step 1: Write the failing test**

```ts
// lib/articles-route-v2.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/articles/route";
import { getDb, closeDb } from "./db";
import { mintToken } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const P = "test-route-v2-";
const POD = `${P}pod`;
let token = "";

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/articles", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
}

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans", "sprouts"]) await db.collection(c).deleteMany({ slug: rx });
  await db.collection("tokens").deleteMany({ pod: rx });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("pods").insertOne({ slug: POD, name: "Pod", description: "", parents: [], visibility: "private" });
  token = await mintToken(POD, "route test");
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

const essay = { slug: `${P}essay`, date: "2026-11-14", name: "E", content: "Body", about: [POD] };

test("repo token + v2 shape → written", { skip: !hasDb }, async () => {
  const res = await POST(req({ essays: [essay] }, `Bearer ${token}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    ok: true,
    essays: [`${P}essay`],
    narratives: [],
    admin: [`/admin/sprout/${P}essay`],
  });
});

test("repo token + legacy shape → 400 naming the v2 shape", { skip: !hasDb }, async () => {
  const res = await POST(req({ container: `pod:${POD}`, narrative: "x" }, `Bearer ${token}`));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /essays and narratives/);
});

test("legacy token + v2 shape → 400 asking for a repo token", async () => {
  process.env.ARTICLES_TOKEN = "tok_art_test";
  try {
    const res = await POST(req({ essays: [essay] }, "Bearer tok_art_test"));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /needs a repo token/);
  } finally {
    delete process.env.ARTICLES_TOKEN;
  }
});

test("revoked or unknown repo token → 401", { skip: !hasDb }, async () => {
  assert.equal((await POST(req({ essays: [essay] }, "Bearer ariko_x_nope"))).status, 401);
});

test("scope refusal → 409 with refused", { skip: !hasDb }, async () => {
  const res = await POST(req({ essays: [{ ...essay, slug: `${P}e2`, about: ["somewhere-else"] }] }, `Bearer ${token}`));
  assert.equal(res.status, 409);
  assert.deepEqual((await res.json()).refused, [`${P}e2: about somewhere-else is not in pod ${POD}`]);
});

test("an image not hosted by Ariko → 400", { skip: !hasDb }, async () => {
  const res = await POST(
    req({ essays: [{ ...essay, slug: `${P}e3`, content: "![x](https://example.com/a.png)" }] }, `Bearer ${token}`),
  );
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not hosted by Ariko/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/articles-route-v2.test.ts`
Expected: FAIL — the first test gets 401 (the route does not know repo tokens yet).

- [ ] **Step 3: Implement — replace `app/api/articles/route.ts`**

Keep the existing legacy body verbatim, moved into `legacy()`; the header comment gains the dispatch paragraph.

```ts
import { hasValidToken, singleToken } from "../../../lib/auth";
import { validateArticlesPayload, type ArticlesPayload } from "../../../lib/articles";
import { writeArticles } from "../../../lib/articles-store";
import { isV2Shape, validateArticlesV2, type ArticlesV2 } from "../../../lib/articles-v2";
import { writeArticlesV2 } from "../../../lib/articles-v2-store";
import { authorizeRepo } from "../../../lib/repo-token-store";
import { cloudinaryCloudName } from "../../../lib/article-images";
import { UPLOAD_FOLDER } from "../../../lib/storage";
import { isDuplicateKeyError } from "../../../lib/seeds";
import { revalidateGarden } from "../../../lib/garden-cache";

export const dynamic = "force-dynamic";

// Guarded long-form write door: drafts only, all-or-nothing, never publishes.
//
// Two tokens, two shapes (spec 2026-11-14 §2–3). A per-repo token
// (`ariko_<pod>_…`, lib/repo-token-store.ts) takes the v2 shape — essays and
// narratives scoped to its pod. The legacy ARTICLES_TOKEN keeps the original
// container/narrative/articles shape until it is retired. Each refuses the
// other's shape with a 400 that names the right one, so a sibling halfway
// through the migration learns what to change from the error alone.
export async function POST(request: Request): Promise<Response> {
  const header = request.headers.get("authorization");
  const repo = await authorizeRepo(header);
  const legacyOk = !repo.ok && hasValidToken(header, singleToken(process.env.ARTICLES_TOKEN));
  if (!repo.ok && !legacyOk) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  if (repo.ok) return v2(repo.pod, body);
  if (isV2Shape(body))
    return Response.json(
      { error: "essays/narratives needs a repo token (npm run token:mint in the Ariko repo)" },
      { status: 400 },
    );
  return legacy(body);
}

async function v2(pod: string, body: unknown): Promise<Response> {
  if (!isV2Shape(body))
    return Response.json(
      { error: "a repo token posts { essays, narratives } — see the ariko-article skill" },
      { status: 400 },
    );
  const cloud = cloudinaryCloudName(process.env.CLOUDINARY_URL);
  const valid = validateArticlesV2(body, { host: cloud ? { cloud, folder: UPLOAD_FOLDER } : undefined });
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });

  let result;
  try {
    result = await writeArticlesV2(pod, body as ArticlesV2);
  } catch (err) {
    if (isDuplicateKeyError(err))
      return Response.json(
        { error: "refused: a slug was taken mid-write; re-read with /api/articles/ping and retry" },
        { status: 409 },
      );
    throw err;
  }
  if (!result.ok) {
    // A mid-batch race can leave earlier items written (all private/draft);
    // say so, and invalidate for them, rather than claim nothing happened.
    if (result.written.length > 0) revalidateGarden();
    return Response.json({ error: "refused", refused: result.refused, written: result.written }, { status: 409 });
  }
  revalidateGarden();
  const admin = [
    ...result.narratives.map((s) => (s === pod ? `/admin/pod/${s}` : `/admin/bean/${s}`)),
    ...result.essays.map((s) => `/admin/sprout/${s}`),
  ];
  return Response.json({ ...result, admin });
}

async function legacy(body: unknown): Promise<Response> {
  // ↓ the previous POST body from `const valid = validateArticlesPayload(body);`
  //   to its final `return Response.json(result);`, unchanged, including the
  //   long isDuplicateKeyError comment.
}
```

Fill `legacy()` by moving the existing lines verbatim (the engineer copies them from the current file; they are not reproduced here because they must not change).

Note `revalidateGarden()` now appears twice in this file; the "four write doors" test counts files, not calls, so it still passes.

- [ ] **Step 4: Add the test file to `test:db`** — append ` lib/articles-route-v2.test.ts`.

- [ ] **Step 5: Run tests**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/articles-route-v2.test.ts lib/articles-route.test.ts`
Expected: PASS — all v2 tests, and every legacy route test unchanged.
Run: `npm test`
Expected: PASS (DB tests skip).

- [ ] **Step 6: Commit**

```bash
git add app/api/articles/route.ts lib/articles-route-v2.test.ts package.json
git commit -m "/api/articles: a repo token posts essays and narratives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `GET /api/articles/ping`

**Files:**
- Create: `app/api/articles/ping/route.ts`
- Test: `lib/articles-ping.test.ts`
- Modify: `package.json` (`test:db`)

- [ ] **Step 1: Write the failing test**

```ts
// lib/articles-ping.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/articles/ping/route";
import { getDb, closeDb } from "./db";
import { mintToken } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const P = "test-ping-";
let token = "";

const req = (auth?: string) =>
  new Request("http://localhost/api/articles/ping", { headers: auth ? { authorization: auth } : {} });

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans"]) await db.collection(c).deleteMany({ slug: rx });
  await db.collection("tokens").deleteMany({ pod: rx });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("pods").insertOne({ slug: `${P}pod`, name: { en: "Pod", fr: "Pode" }, description: "", parents: [`plant:${P}plant`] });
  await db.collection("beans").insertMany([
    { slug: `${P}b`, name: "B", parents: [`pod:${P}pod`], visibility: "public" },
    { slug: `${P}a`, name: "A", parents: [`pod:${P}pod`], visibility: "private", projected: { feed: "x" } },
  ]);
  token = await mintToken(`${P}pod`, "ping test");
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

test("ping without a repo token is 401", async () => {
  assert.equal((await GET(req())).status, 401);
  assert.equal((await GET(req("Bearer tok_legacy"))).status, 401);
});

test("ping returns the pod, its plant and its beans", { skip: !hasDb }, async () => {
  const res = await GET(req(`Bearer ${token}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    pod: `${P}pod`,
    plant: `${P}plant`,
    beans: [
      { slug: `${P}a`, name: "A", visibility: "private", projected: true },
      { slug: `${P}b`, name: "B", visibility: "public" },
    ],
  });
});
```

(The `projected` field's real shape is whatever `Bean.projected` is in `lib/data.ts`; the test only needs it truthy. Adjust the fixture to that type if `tsc` complains.)

- [ ] **Step 2: Run it to see it fail**

Run: `MONGODB_DB=beanstalk_scratch TSX_TSCONFIG_PATH=tsconfig.test.json node --env-file=.env.local --import tsx --test --test-concurrency=1 lib/articles-ping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/api/articles/ping/route.ts
//
// The article door's setup check (spec 2026-11-14 §3.1). The ariko-article
// skill calls this before writing a word: a 200 proves the token, the network
// allowlist and the URL in one request, and the body is the scope the agent may
// anchor to. Read-only; reads the pod and its beans directly (never the cached
// garden — a pod planted a minute ago must be visible here).

import { authorizeRepo } from "../../../../lib/repo-token-store";
import { getDb } from "../../../../lib/db";
import { resolveText, parentsWithPrefix, PLANT_PREFIX, POD_PREFIX, type Bean, type Pod } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const repo = await authorizeRepo(request.headers.get("authorization"));
  if (!repo.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const pod = await db.collection<Pod>("pods").findOne({ slug: repo.pod }, { projection: { _id: 0, parents: 1 } });
  if (!pod) return Response.json({ error: `pod ${repo.pod} no longer exists` }, { status: 404 });

  const beans = await db
    .collection<Bean>("beans")
    .find({ parents: `${POD_PREFIX}${repo.pod}` }, { projection: { _id: 0, slug: 1, name: 1, visibility: 1, projected: 1 } })
    .sort({ slug: 1 })
    .toArray();

  return Response.json({
    pod: repo.pod,
    plant: parentsWithPrefix(pod.parents, PLANT_PREFIX)[0] ?? null,
    beans: beans.map((b) => ({
      slug: b.slug,
      name: resolveText(b.name),
      visibility: b.visibility ?? "public",
      ...(b.projected ? { projected: true } : {}),
    })),
  });
}
```

- [ ] **Step 4: Add to `test:db`**, run, expect PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/articles/ping/route.ts lib/articles-ping.test.ts package.json
git commit -m "/api/articles/ping: a repo checks its setup and learns its scope

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `POST /api/articles/assets`

**Files:**
- Create: `lib/articles-assets.ts`, `app/api/articles/assets/route.ts`
- Test: `lib/articles-assets.test.ts` (pure, fakes)

- [ ] **Step 1: Write the failing test**

```ts
// lib/articles-assets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAssetUpload } from "./articles-assets";

const ok = async () => ({ ok: true as const, pod: "pbbls" });
const no = async () => ({ ok: false as const });
const fakeUpload = async () => ({ kind: "image" as const, storageKey: "k", url: "https://res.cloudinary.com/ariko/k.png", width: 10, height: 20 });

function form(file?: Blob, name = "shot.png"): Request {
  const fd = new FormData();
  if (file) fd.append("file", file, name);
  return new Request("http://localhost/api/articles/assets", { method: "POST", headers: { authorization: "Bearer x" }, body: fd });
}

test("401 without a repo token, and nothing uploaded", async () => {
  let called = false;
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), {
    authorize: no,
    upload: async () => { called = true; return fakeUpload(); },
  });
  assert.equal(res.status, 401);
  assert.equal(called, false);
});

test("400 with no file", async () => {
  const res = await handleAssetUpload(form(), { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 400);
});

test("400 for SVG, naming the rule", async () => {
  const res = await handleAssetUpload(form(new Blob(["<svg/>"], { type: "image/svg+xml" }), "a.svg"), { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 400);
});

test("200 returns url, width and height", async () => {
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { url: "https://res.cloudinary.com/ariko/k.png", width: 10, height: 20 });
});

test("an upload failure is a 502 with the message", async () => {
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), {
    authorize: ok,
    upload: async () => { throw new Error("cloudinary down"); },
  });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /cloudinary down/);
});
```

- [ ] **Step 2: Run it to see it fail** — `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/articles-assets.test.ts` → module not found.

- [ ] **Step 3: Implement**

```ts
// lib/articles-assets.ts
//
// One image per request, uploaded server-side (spec 2026-11-14 §3.2). One per
// request because Vercel caps a request body at ~4.5 MB; server-side because
// the Cloudinary credential never leaves Ariko (CLAUDE.md, "Images upload
// through uploadImageAction, never from the browser to a third party" — the
// same rule, for a repo instead of a browser). The same checkUploadFile the
// admin picker uses: 4 MB, raster only.
//
// Not tied to an article: an asset uploaded for a draft that is never posted is
// an orphan, which `npm run check:orphans` sweeps. The skill uploads only after
// the maintainer approves, which keeps that rare.

import { checkUploadFile, uploadedFilename } from "./upload-input";
import type { MediaImage } from "./data";
import type { RepoAuth } from "./repo-token-store";

export interface AssetDeps {
  authorize: (header: string | null) => Promise<RepoAuth>;
  upload: (bytes: Buffer, filename?: string) => Promise<MediaImage>;
}

export async function handleAssetUpload(request: Request, deps: AssetDeps): Promise<Response> {
  const repo = await deps.authorize(request.headers.get("authorization"));
  if (!repo.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "body must be multipart/form-data with a file field" }, { status: 400 });
  }
  if (!(file instanceof Blob)) return Response.json({ error: "no file was sent (field name: file)" }, { status: 400 });

  const check = checkUploadFile({ size: file.size, type: file.type });
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  try {
    const media = await deps.upload(Buffer.from(await file.arrayBuffer()), uploadedFilename(file));
    return Response.json({ url: media.url, width: media.width, height: media.height });
  } catch (err) {
    console.error(`[articles/assets] upload failed for pod ${repo.pod}`, err);
    return Response.json({ error: err instanceof Error ? err.message : "upload failed" }, { status: 502 });
  }
}
```

```ts
// app/api/articles/assets/route.ts
import { handleAssetUpload } from "../../../../lib/articles-assets";
import { authorizeRepo } from "../../../../lib/repo-token-store";
import { uploadImage } from "../../../../lib/storage";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleAssetUpload(request, { authorize: authorizeRepo, upload: uploadImage });
}
```

If `MediaImage`'s `width`/`height` are optional, the response simply omits them; the test fake carries both.

- [ ] **Step 4: Run** — PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/articles-assets.ts lib/articles-assets.test.ts app/api/articles/assets/route.ts
git commit -m "/api/articles/assets: a repo uploads one image, server-side

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The `ariko-article` plugin and its CLAUDE.md snippet

Written before the CLI because the CLI embeds the snippet in every setup card.

**Files:**
- Create: `plugins/ariko-article/.claude-plugin/plugin.json`
- Create: `plugins/ariko-article/skills/ariko-article/SKILL.md`
- Create: `plugins/ariko-article/CLAUDE-SNIPPET.md`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: `plugin.json`**

```json
{
  "name": "ariko-article",
  "description": "Write an essay or a feature narrative about this repo and post it to Ariko as a draft, with images, once the maintainer approves.",
  "version": "0.1.0",
  "author": { "name": "Alexis Bohns" }
}
```

- [ ] **Step 2: Marketplace entry** — append to `plugins` in `.claude-plugin/marketplace.json`:

```json
    {
      "name": "ariko-article",
      "source": "./plugins/ariko-article",
      "description": "Write an essay or a feature narrative and post it to Ariko as a draft — images included, after your approval."
    }
```

- [ ] **Step 3: `CLAUDE-SNIPPET.md`** — the self-sufficient fallback pasted into each sibling's `CLAUDE.md`:

````md
## Writing for Ariko

When asked to write an article about this project for Ariko, post it as a
**draft** through Ariko's API — never commit the article or its images to this
repo. (The `ariko-article` skill has the full guidance; this section is enough
without it.)

- **Env:** `ARIKO_TOKEN` (this repo's token, scoped to its pod) and `ARIKO_URL`
  (default `https://www.ariko.app`). In a cloud session they come from the
  environment preset; `www.ariko.app` must be on its network allowlist.
- **1. Ping first:** `curl -fsS -H "Authorization: Bearer $ARIKO_TOKEN" "$ARIKO_URL/api/articles/ping"`
  returns `{ pod, plant, beans }`. If it fails, stop and say why: token unset,
  Ariko unreachable (allowlist), or 401 (token revoked or mistyped).
- **2. Pick the kind:** an **essay** is a dated piece about the pod and/or some
  of its beans; a **narrative** rewrites what the pod or one feature (bean) *is
  now*. Ask if the request does not say.
- **3. Draft in a temp folder**, markdown, EN and optionally FR (an adaptation
  in "tu", not a literal translation). Images as local paths for now.
- **4. Show the draft and wait for an explicit yes.** Upload nothing before.
- **5. Upload each image:** `curl -fsS -H "Authorization: Bearer $ARIKO_TOKEN" -F "file=@shot.png" "$ARIKO_URL/api/articles/assets"`
  → `{ url, width, height }`. PNG/JPEG/GIF/WebP/AVIF, 4 MB max; no SVG yet.
  Replace each local path with its `url`. Ariko refuses any other image URL.
- **6. Post** `POST $ARIKO_URL/api/articles` with JSON:
  `{ "essays": [{ "slug", "date": "YYYY-MM-DD", "name", "description"?, "content", "about": ["<pod or bean slug>"] }],
     "narratives": [{ "slug": "<pod or bean slug>", "name"?, "description"?, "content" }] }`.
  `name` / `description` / `content` are a string or `{ "en", "fr" }`. A new
  bean needs `name`. Never send `state`, `visibility`, `kind`, `type`,
  `parents` or `exhibited` — they are refused.
- **7. Report** the `admin` URLs from the response: the maintainer publishes
  there. A 409 lists what was refused and why; nothing was written.
````

- [ ] **Step 4: `SKILL.md`**

````md
---
name: ariko-article
description: >
  Write an essay about THIS repo's project, or rewrite the narrative of the
  project or one of its features, and post it to Ariko as a draft — images
  included — once the maintainer approves it. Use whenever someone asks to
  write, publish, post or draft an article, essay, blog post, write-up or
  feature narrative "for Ariko" or "on the portfolio". Nothing is committed to
  this repo.
---

# Writing for Ariko

Ariko is the maintainer's portfolio. This repo is one **pod** there; its
features are **beans**. You write one of two things:

| Kind | What it is | Lands as |
|---|---|---|
| **Essay** | A dated piece — a redesign told, a decision explained, a release looked back on — about the pod and/or some of its beans. | A draft sprout of kind `essay`, shown in the journals of what it is `about`. |
| **Narrative** | What the pod, or one feature, **is now** and how it got there. Rewritten in place, never appended. | The pod's or bean's `content`. |

"Write about how we redesigned the feed" → essay. "Update the feed's
narrative" / "describe what the feed does now" → narrative. If you cannot tell,
ask — one question.

## 0. Before anything: ping

```bash
curl -fsS -H "Authorization: Bearer $ARIKO_TOKEN" "${ARIKO_URL:-https://www.ariko.app}/api/articles/ping"
```

It returns `{ "pod", "plant", "beans": [{ "slug", "name", "visibility", "projected"? }] }`
— your scope. You may only write about that pod and those beans (or a new bean
you create with a narrative in the same post).

If it fails, **stop and say exactly which**:

- `ARIKO_TOKEN` empty → "ARIKO_TOKEN is not set. Locally: the repo's `.env`.
  In a cloud session: the environment preset's variables."
- connection refused, DNS failure, or a proxy 403 → "Ariko is unreachable —
  add `www.ariko.app` to this cloud environment's allowed domains."
- `401` → "The token was refused — it was revoked or mistyped; re-mint it with
  `npm run token:mint -- --pod <pod>` in the Ariko repo."
- `404` → the pod was deleted in Ariko; tell the maintainer.

## 1. Draft — outside the repo

Write in the session's scratchpad, or `$TMPDIR/ariko-article/<slug>/`. **Never
in the repo, never committed**: the repo does not store content or assets.

- Markdown. GFM tables, `>` quotes, code, headings, `![alt](path)` images.
- Mention another Ariko entity inline with `:entity[Label]{ref=bean:slug}` —
  this is how you point at something outside your pod.
- English always; French when asked, as an **adaptation** in "tu", not a
  literal translation. Both go in `{ "en": "…", "fr": "…" }`.
- Essay slug: kebab-case, specific (`feed-redesign-2026`), not a bean's slug.
  Date: the day the thing happened or the day of writing, `YYYY-MM-DD`.
- Alt text on every image says what the image shows, not "screenshot".

Images: screenshots you can take, files the maintainer points at, exports from
the repo. PNG, JPEG, GIF, WebP or AVIF, 4 MB max each. **No SVG yet** — export
diagrams to PNG at 2×.

## 2. Show the draft and wait

Show the whole draft (both languages) with each image path, and ask for
approval. **Upload nothing before an explicit yes.** Revise as often as asked.

## 3. Upload the images

One request per file:

```bash
curl -fsS -H "Authorization: Bearer $ARIKO_TOKEN" \
  -F "file=@/abs/path/shot.png" "${ARIKO_URL:-https://www.ariko.app}/api/articles/assets"
# → { "url": "https://res.cloudinary.com/…", "width": 1170, "height": 2532 }
```

Replace each local path in the markdown with its returned `url`. Ariko refuses
any image URL it did not issue.

## 4. Post

```bash
curl -sS -X POST -H "Authorization: Bearer $ARIKO_TOKEN" -H "content-type: application/json" \
  --data @payload.json "${ARIKO_URL:-https://www.ariko.app}/api/articles"
```

```json
{
  "essays": [{
    "slug": "feed-redesign-2026",
    "date": "2026-11-14",
    "name": { "en": "Redrawing the feed", "fr": "Redessiner le fil" },
    "description": { "en": "One line.", "fr": "Une ligne." },
    "content": { "en": "…", "fr": "…" },
    "about": ["pbbls", "feed"]
  }],
  "narratives": [{
    "slug": "feed",
    "content": { "en": "…", "fr": "…" }
  }]
}
```

- `about`: bare slugs from the ping — the pod's, its beans'. At least one.
- A narrative's `slug` is the pod's or a bean's. A **new** bean needs `name`
  (and should get a `description`); it is created private under the pod.
- **Refused keys** — never send: `state`, `visibility`, `kind`, `type`,
  `parents`, `exhibited`. Publishing is the maintainer's, in the admin.

Responses:

- `200` → `{ ok, essays, narratives, admin: ["/admin/sprout/…", …] }`.
- `400` → the payload's shape; the message names the field.
- `409` → `{ refused: [...] }`: something is already published
  (`already reviewed`), outside the pod, or a new bean lacks a name.
  **Nothing was written.** Fix and re-post the whole payload.

Re-posting an essay slug replaces it **while it is still a draft**; once the
maintainer has published it, a re-post is refused.

## 5. Report

Tell the maintainer what was posted and give the admin links
(`https://www.ariko.app/admin/sprout/<slug>` etc.). It is a draft: they review
and publish it there.
````

- [ ] **Step 5: Commit**

```bash
git add plugins/ariko-article .claude-plugin/marketplace.json
git commit -m "The ariko-article plugin: write, approve, upload, post a draft

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `token:mint` / `token:list` / `token:revoke`

**Files:**
- Create: `scripts/repo-token.ts`
- Modify: `package.json` (three scripts)

The pure parts are tested in Task 3; this file is wiring. It is verified by hand against the scratch DB.

- [ ] **Step 1: Implement**

```ts
// scripts/repo-token.ts
//
//   npm run token:mint   -- --pod pbbls [--pod arkaik …] [--env ../pbbls/.env] [--sheet ~/Desktop/ariko-cloud-setup.md] [--label "…"]
//   npm run token:list
//   npm run token:revoke -- --pod pbbls
//
// Spec 2026-11-14 §2. Every guard runs BEFORE any token is minted, so a
// refused --env or --sheet leaves the database untouched. Minting writes to the
// database .env.local points at — production, unless MONGODB_DB says
// otherwise — and says which before it starts.

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import { closeDb } from "../lib/db";
import { listTokens, mintToken, revokePod } from "../lib/repo-token-store";
import {
  envBlock,
  envTargetProblem,
  setupCard,
  sheetTargetProblem,
  upsertEnvBlock,
  type GitRunner,
} from "../lib/repo-token";

const git: GitRunner = (args, cwd) => spawnSync("git", args, { cwd, stdio: "ignore" });
const expand = (p: string) => resolve(p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
const today = () => new Date().toISOString().slice(0, 10);
const SNIPPET = resolve(dirname(new URL(import.meta.url).pathname), "../plugins/ariko-article/CLAUDE-SNIPPET.md");

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function mint(pods: string[], envPath?: string, sheetPath?: string, label?: string) {
  if (pods.length === 0) fail("--pod is required");
  if (envPath && pods.length !== 1) fail("--env writes ONE repo's .env: pass exactly one --pod with it");

  const env = envPath ? expand(envPath) : undefined;
  const sheet = sheetPath ? expand(sheetPath) : undefined;
  if (env) {
    if (!existsSync(dirname(env))) fail(`${dirname(env)} does not exist`);
    const problem = envTargetProblem(env, git);
    if (problem) fail(problem);
  }
  if (sheet) {
    if (!existsSync(dirname(sheet))) fail(`${dirname(sheet)} does not exist`);
    const problem = sheetTargetProblem(sheet, git);
    if (problem) fail(problem);
  }

  console.log(`Minting in database "${process.env.MONGODB_DB ?? "beanstalk"}" — previous tokens for these pods are revoked.\n`);
  const snippet = readFileSync(SNIPPET, "utf8");
  const cards: string[] = [];
  for (const pod of pods) {
    const token = await mintToken(pod, label ?? `${pod} — ${today()}`);
    cards.push(setupCard({ pod, token, claudeSnippet: snippet }));
    if (env) {
      const before = existsSync(env) ? readFileSync(env, "utf8") : "";
      writeFileSync(env, upsertEnvBlock(before, envBlock({ pod, token, date: today() })));
      console.log(`✓ ${env} — ARIKO_TOKEN written (ariko block)`);
    }
  }

  const body = cards.join("\n---\n\n");
  if (sheet) {
    const header =
      `> **Delete this file once the cloud presets are set up.** It holds live tokens.\n` +
      `> Ariko stores only hashes: a lost token is re-minted, never recovered.\n\n` +
      `# Ariko cloud setup — ${today()}\n\n`;
    writeFileSync(sheet, header + body, { mode: 0o600 });
    chmodSync(sheet, 0o600);
    console.log(`✓ ${sheet} — ${pods.length} setup card(s), mode 600`);
  } else {
    console.log(body);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      pod: { type: "string", multiple: true },
      env: { type: "string" },
      sheet: { type: "string" },
      label: { type: "string" },
    },
  });
  const pods = values.pod ?? [];
  try {
    if (command === "mint") await mint(pods, values.env, values.sheet, values.label);
    else if (command === "list") {
      for (const t of await listTokens())
        console.log(
          [t.pod, t.revokedAt ? `revoked ${t.revokedAt.slice(0, 10)}` : "LIVE", t.label,
           `created ${t.createdAt.slice(0, 10)}`, t.lastUsedAt ? `used ${t.lastUsedAt.slice(0, 10)}` : "never used"].join("  ·  "),
        );
    } else if (command === "revoke") {
      if (pods.length === 0) fail("--pod is required");
      for (const pod of pods) console.log(`${pod}: ${await revokePod(pod)} token(s) revoked`);
    } else fail("usage: repo-token.ts mint|list|revoke [--pod …]");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: npm scripts** — add to `package.json` `scripts`, beside `garden:plant`:

```json
    "token:mint": "node --env-file=.env.local --import tsx scripts/repo-token.ts mint",
    "token:list": "node --env-file=.env.local --import tsx scripts/repo-token.ts list",
    "token:revoke": "node --env-file=.env.local --import tsx scripts/repo-token.ts revoke",
```

- [ ] **Step 3: Verify by hand against the scratch DB**

```bash
# a pod to mint for, in scratch only
MONGODB_DB=beanstalk_scratch node --env-file=.env.local --import tsx -e \
  'import("./lib/db").then(async ({getDb,closeDb})=>{await (await getDb()).collection("pods").updateOne({slug:"test-cli-pod"},{$set:{name:"T",description:"",parents:[]}},{upsert:true});await closeDb()})'
mkdir -p "$TMPDIR/cli-check" && touch "$TMPDIR/cli-check/.env"
MONGODB_DB=beanstalk_scratch npm run token:mint -- --pod test-cli-pod --env "$TMPDIR/cli-check/.env"
MONGODB_DB=beanstalk_scratch npm run token:mint -- --pod test-cli-pod --env "$TMPDIR/cli-check/.env"
grep -c ">>> ariko" "$TMPDIR/cli-check/.env"        # Expected: 1 (replaced, not appended)
MONGODB_DB=beanstalk_scratch npm run token:mint -- --pod test-cli-pod --sheet ./sheet.md   # Expected: ✗ … inside a git repository; nothing minted
MONGODB_DB=beanstalk_scratch npm run token:mint -- --pod test-cli-pod --env ./package.json # Expected: ✗ … tracked by git
MONGODB_DB=beanstalk_scratch npm run token:mint -- --pod test-cli-pod --sheet "$TMPDIR/cli-check/sheet.md"
ls -l "$TMPDIR/cli-check/sheet.md"                   # Expected: -rw-------
MONGODB_DB=beanstalk_scratch npm run token:list      # Expected: one LIVE row for test-cli-pod, older ones revoked
MONGODB_DB=beanstalk_scratch npm run token:revoke -- --pod test-cli-pod
```

Then clean up: delete the `test-cli-pod` pod and its tokens from `beanstalk_scratch`, and `rm -r "$TMPDIR/cli-check"`.

`.env.local` points at production: **every command above must carry `MONGODB_DB=beanstalk_scratch`**.

- [ ] **Step 4: Commit**

```bash
git add scripts/repo-token.ts package.json
git commit -m "token:mint / token:list / token:revoke, with setup cards for cloud presets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `.env.example`

- [ ] **Step 1: `CLAUDE.md`** — add a section right after "## Planting a project from another repo":

```md
## Writing for Ariko from another repo

A sibling repo's agent posts **drafts** to Ariko directly — local or cloud
session, no CI, nothing committed to the sibling
([`specs/2026-11-14-article-door-v2-design.md`](docs/superpowers/specs/2026-11-14-article-door-v2-design.md)).
It holds a **per-repo token** scoped to its pod, minted here:

```bash
npm run token:mint -- --pod pbbls --env ../pbbls/.env
npm run token:mint -- --pod pbbls --pod arkaik --sheet ~/Desktop/ariko-cloud-setup.md
npm run token:list
npm run token:revoke -- --pod pbbls
```

Minting writes to the database `.env.local` names — production. It prints a
setup card per repo for its Claude Code cloud preset (env vars, `www.ariko.app`
on the allowlist, `enabledPlugins`, the `CLAUDE.md` snippet).

Three doors, all token-gated: `GET /api/articles/ping` (scope), `POST
/api/articles/assets` (one raster image, uploaded server-side), `POST
/api/articles` (`{ essays, narratives }`). Rules the tests pin, each of which
passes `tsc` and `npm run build` while quietly becoming false:

- **A repo writes inside its pod only.** `writeArticlesV2` resolves every
  `about` and narrative slug against the token's pod; a slug elsewhere is
  refused by name. The pod is the one stored beside the token's hash — the
  `ariko_<pod>_` prefix is for humans and is never parsed.
- **The door cannot publish.** `state`, `visibility`, `kind`, `type`,
  `parents`, `exhibited` are refused keys; essays are written `draft`; a
  published or private sprout is never replaced.
- **Every image is Ariko-hosted.** `lib/article-images.ts` refuses any image
  URL outside our Cloudinary cloud, so what the maintainer approved is what is
  stored.
- **Hand-authored relations survive a re-post** — `mergeMirrored` over the
  stored list, never over `undefined`.

The legacy `ARTICLES_TOKEN` shape (`container` / `narrative` / `articles`)
still works until it is retired; each token refuses the other's shape by name.
Sibling agents get the flow as `plugins/ariko-article/`; its
`CLAUDE-SNIPPET.md` is the self-sufficient fallback pasted into each sibling's
`CLAUDE.md`.
```

Also in `CLAUDE.md`, the garden section's "Writes invalidate at four doors" sentence stays true (the v2 writes go through `/api/articles`); no change needed there.

- [ ] **Step 2: `.env.example`** — above the existing `ARTICLES_TOKEN=` line add:

```
# LEGACY: the shared article-door token, for the old container/narrative/articles
# shape only. New repos get a per-repo token: `npm run token:mint -- --pod <slug>`.
```

- [ ] **Step 3: `README.md`** — find the section that documents `/api/articles` (`grep -n "api/articles" README.md`) and add one paragraph pointing to the CLAUDE.md section and the three `token:*` scripts. If the README has no such section, add it under the Lab Note pipeline section with the same paragraph.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md .env.example
git commit -m "Docs: writing for Ariko from another repo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Full verification

- [ ] **Step 1:** `npm test` → all pass (DB tests skip).
- [ ] **Step 2:** `npm run test:db` → all pass, including the four new DB files.
- [ ] **Step 3:** `npx tsc --noEmit` and `npm run lint` → clean.
- [ ] **Step 4: Build in a scratch worktree, never here**

```bash
git worktree add "$TMPDIR/ariko-build" HEAD
cd "$TMPDIR/ariko-build" && npm ci && cp /Users/alexis/code/ariko/.env.local . && MONGODB_DB=beanstalk_scratch npm run build
```

Expected: build succeeds; `/api/articles/ping` and `/api/articles/assets` listed as dynamic routes. Then `cd /Users/alexis/code/ariko && git worktree remove --force "$TMPDIR/ariko-build"`.

- [ ] **Step 5: Open the PR** — `gh pr create`, body summarising the three doors, the tokens and the plugin, ending with the attribution line. **No Lab Note**: nothing a visitor sees changes; add the `no-lab-note` label.

- [ ] **Step 6: After merge (maintainer, with confirmation)** — mint the real tokens against production with `--sheet` outside any repo, set up each cloud preset from its card, then confirm in one cloud session that the plugin loads from `enabledPlugins` and that ping answers.
