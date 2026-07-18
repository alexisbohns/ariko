# C1 Go-Live Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the now-live `POST /api/inbox`: survive concurrent duplicate upserts, compare bearer tokens in constant time, and cap request bodies at 256 KB.

**Architecture:** Three independent, behavior-preserving-except-where-specified changes: an exported single-retry helper around the dedup upsert in `lib/captures.ts`; a SHA-256 + `timingSafeEqual` no-early-exit scan inside `lib/auth.ts` (signatures unchanged); a two-stage (header, then measured) size gate in `app/api/inbox/route.ts` returning 413 before any auth reasoning.

**Tech Stack:** existing repo conventions — TS, `node --test` via `npm test`, `node:crypto` (routes are Node runtime).

**Spec:** `docs/superpowers/specs/2026-07-18-c1-hardening-design.md`

**Environment notes for executors:**
- Branch `claude/c1-hardening` (exists; holds the spec). Commit there, never push unless a task says to.
- Gates for every task: `npm test 2>&1 | tail -5` (expect 0 fail; currently 200 pass / 20 DB-gated skips — counts grow as tasks add tests) and `npx tsc --noEmit` (clean).
- `.env.local` holds secrets — never print or commit it.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/captures.ts` | Modify | `withDuplicateKeyRetry` helper + wrap the dedup `findOneAndUpdate` |
| `lib/captures.test.ts` | Modify | 4 ungated unit tests for the helper |
| `lib/auth.ts` | Modify | `timingSafeEqualStr` + no-early-exit scans in `authorize`/`hasValidToken` |
| `lib/auth.test.ts` | Modify | last-token-match + mixed-length cases |
| `lib/inbox.ts` | Modify | `MAX_INBOX_BODY_BYTES` constant |
| `app/api/inbox/route.ts` | Modify | 413 size gate before parse/auth |
| `lib/inbox-route.test.ts` | Modify | 413 + boundary cases |
| `README.md` | Modify | one sentence documenting the cap under `POST /api/inbox` |
| `docs/superpowers/ROADMAP.md` | Modify | C1b shipped row + prune the hardening items from the C1 bullet |

---

### Task 1: `withDuplicateKeyRetry` (TDD)

**Files:**
- Modify: `lib/captures.test.ts`
- Modify: `lib/captures.ts`

- [ ] **Step 1: Write the failing tests.** In `lib/captures.test.ts`, add `withDuplicateKeyRetry` to the import from `./captures`, and insert these UNGATED tests (no `{ skip: !hasDb }`) right after the `cleanup` helper, before the first DB-gated test:

```ts
function dupErr(): Error & { code: number } {
  return Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
}

test("withDuplicateKeyRetry returns the second result after a lost upsert race", async () => {
  let calls = 0;
  const result = await withDuplicateKeyRetry(async () => {
    calls += 1;
    if (calls === 1) throw dupErr();
    return "winner";
  });
  assert.equal(result, "winner");
  assert.equal(calls, 2);
});

test("withDuplicateKeyRetry calls fn once on success", async () => {
  let calls = 0;
  assert.equal(await withDuplicateKeyRetry(async () => ++calls), 1);
  assert.equal(calls, 1);
});

test("withDuplicateKeyRetry propagates a second consecutive 11000", async () => {
  let calls = 0;
  await assert.rejects(
    withDuplicateKeyRetry(async () => {
      calls += 1;
      throw dupErr();
    }),
    (err: Error & { code?: number }) => err.code === 11000,
  );
  assert.equal(calls, 2);
});

test("withDuplicateKeyRetry propagates non-duplicate errors immediately", async () => {
  let calls = 0;
  await assert.rejects(
    withDuplicateKeyRetry(async () => {
      calls += 1;
      throw new Error("network down");
    }),
    /network down/,
  );
  assert.equal(calls, 1);
});
```

- [ ] **Step 2:** Run `npm test 2>&1 | tail -10` — the four new tests FAIL (`withDuplicateKeyRetry` not exported); everything else green.

- [ ] **Step 3: Implement.** In `lib/captures.ts`, add above `createOrUpdateCapture`:

```ts
// One retry converges after a lost upsert race: the winner's document exists by
// the time the loser retries, so the second attempt takes the update path.
// Anything but a duplicate-key error (code 11000) — and a second consecutive
// 11000 — propagates unchanged.
export async function withDuplicateKeyRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return fn();
    throw err;
  }
}
```

and wrap the dedup-path call (`const res = await col.findOneAndUpdate(` … `);`) as:

```ts
    const res = await withDuplicateKeyRetry(() =>
      col.findOneAndUpdate(
        { "source.kind": input.source.kind, "source.externalId": input.source.externalId },
        {
          $set: set,
          $setOnInsert: {
            id: crypto.randomUUID(),
            status: "inbox",
            promotedTo: [],
            createdAt: now,
            "source.capturedAt": input.source.capturedAt ?? now,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          includeResultMetadata: true,
          projection: { _id: 0 },
        },
      ),
    );
```

The manual path (no `externalId`) stays untouched — the partial unique index only covers documents with `externalId`, so its `insertOne` cannot E11000.

- [ ] **Step 4:** `npm test 2>&1 | tail -5` → 0 fail. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/captures.ts lib/captures.test.ts
git commit -m "feat: retry the inbox dedup upsert once on E11000 (concurrent-post race)"
```

---

### Task 2: constant-time token compare

Behavior-preserving, so classic red/green does not apply: the new tests pass against the OLD code too. The sequence is: add tests (green) → swap the internals → whole suite still green. The security property (no early exit) is enforced by code shape, verified in review.

**Files:**
- Modify: `lib/auth.test.ts`
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add the new cases** at the end of `lib/auth.test.ts`:

```ts
test("authorize matches when the candidate is the last configured token", () => {
  const t = parseTokens("a:tok_a,b:tok_b,github:tok_last");
  assert.equal(authorize("Bearer tok_last", "github", t), "ok");
  assert.equal(authorize("Bearer tok_last", "a", t), "forbidden");
});

test("tokens of different lengths compare safely", () => {
  const t = parseTokens("*:short,github:a_much_longer_token_value_here");
  assert.equal(authorize("Bearer short", "manual", t), "ok");
  assert.equal(authorize("Bearer a_much_longer_token_value_here", "github", t), "ok");
  assert.equal(authorize("Bearer shor", "manual", t), "unauthorized");
  assert.equal(authorize("Bearer short_but_longer", "manual", t), "unauthorized");
  assert.equal(hasValidToken("Bearer a_much_longer_token_value_here", t), true);
  assert.equal(hasValidToken("Bearer nope", t), false);
});
```

- [ ] **Step 2:** `npm test 2>&1 | tail -5` — all green (these pass pre-change; that is expected).

- [ ] **Step 3: Swap the internals.** In `lib/auth.ts`, add at the top:

```ts
import { createHash, timingSafeEqual } from "node:crypto";
```

add below `bearer`:

```ts
// Equality via SHA-256 digests: the buffers handed to timingSafeEqual are
// always equal-length, so neither the content nor the length of the candidate
// leaks through timing.
function timingSafeEqualStr(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}
```

replace the body of `authorize` after the `bearer` guard:

```ts
export function authorize(
  header: string | null,
  sourceKind: string,
  tokens: Map<string, Set<string>>,
): AuthResult {
  const token = bearer(header);
  if (!token) return "unauthorized";
  // Scan every entry without early exit: iteration count is independent of
  // where (or whether) the candidate matches.
  let matched: Set<string> | null = null;
  for (const [candidate, kinds] of tokens) {
    if (timingSafeEqualStr(token, candidate)) matched = kinds;
  }
  if (!matched) return "unauthorized";
  if (matched.has("*") || matched.has(sourceKind)) return "ok";
  return "forbidden";
}
```

and `hasValidToken`:

```ts
export function hasValidToken(
  header: string | null,
  tokens: Map<string, Set<string>>,
): boolean {
  const token = bearer(header);
  if (token == null) return false;
  let found = false;
  for (const [candidate] of tokens) {
    if (timingSafeEqualStr(token, candidate)) found = true;
  }
  return found;
}
```

`parseTokens` and all signatures stay untouched.

- [ ] **Step 4: Confirm no edge-runtime consumer.** Run: `grep -rn "from \"./auth\"\|lib/auth" middleware.ts app lib --include='*.ts' --include='*.tsx' | grep -v test | grep -v "lib/auth.ts"`
Expected: only `app/api/inbox/route.ts` and `app/api/upload/route.ts` (Node runtime — `node:crypto` is safe). If `middleware.ts` appears, STOP and report (edge runtime cannot import `node:crypto`).

- [ ] **Step 5:** `npm test 2>&1 | tail -5` → 0 fail. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: constant-time bearer-token comparison in inbox auth"
```

---

### Task 3: body-size guard on `/api/inbox` (TDD)

**Files:**
- Modify: `lib/inbox-route.test.ts`
- Modify: `lib/inbox.ts`
- Modify: `app/api/inbox/route.ts`

- [ ] **Step 1: Write the failing tests.** In `lib/inbox-route.test.ts`, add to the route import line nothing (POST already imported) and add after the `req()` helper:

```ts
import { MAX_INBOX_BODY_BYTES } from "./inbox";

test("413 when the declared/actual body exceeds the cap", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  // A string body sets content-length automatically → exercises the header fast-path.
  const res = await POST(req("x".repeat(MAX_INBOX_BODY_BYTES + 1), "Bearer tok_master"));
  assert.equal(res.status, 413);
});

test("413 on an oversized chunked body with no content-length header", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const chunk = "x".repeat(64 * 1024);
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 5; i++) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  const res = await POST(
    new Request("http://localhost/api/inbox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  );
  assert.equal(res.status, 413);
});

test("a body exactly at the cap passes the size gate", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  // Exactly MAX bytes of junk: not valid JSON, so the 400 (not 413) proves the
  // gate let it through.
  const res = await POST(req("x".repeat(MAX_INBOX_BODY_BYTES), "Bearer tok_master"));
  assert.equal(res.status, 400);
});
```

Note: the import of `MAX_INBOX_BODY_BYTES` fails to compile until Step 3 — that IS the red state.

- [ ] **Step 2:** Run `npm test 2>&1 | tail -10` — the suite fails on the missing export (module-level failure of this file is the expected red). Everything else green.

- [ ] **Step 3: Implement.** In `lib/inbox.ts`, add after the imports:

```ts
// Hard cap for /api/inbox request bodies (spec 2026-07-18-c1-hardening §5):
// ~17× under Vercel's platform limit, far above any real capture.
export const MAX_INBOX_BODY_BYTES = 256 * 1024;
```

In `app/api/inbox/route.ts`, extend the inbox import to `import { MAX_INBOX_BODY_BYTES, validateInboxPayload } from "../../../lib/inbox";` and replace the body-parsing block (`let body: unknown; try { body = await request.json(); } catch { … }`) with:

```ts
  // Size gate before parsing and before any auth reasoning (spec: 413 wins
  // over 401 — an oversized body yields no source.kind, and 413 leaks nothing).
  const tooLarge = () =>
    Response.json(
      { error: `body too large (max ${MAX_INBOX_BODY_BYTES} bytes)` },
      { status: 413 },
    );
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_INBOX_BODY_BYTES) return tooLarge();

  // The header can lie or be absent (chunked encoding): measure what arrived.
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_INBOX_BODY_BYTES) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
```

Everything after (validation, 401-preference, auth, upsert) is byte-for-byte unchanged.

- [ ] **Step 4:** `npm test 2>&1 | tail -5` → 0 fail. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/inbox.ts lib/inbox-route.test.ts app/api/inbox/route.ts
git commit -m "feat: 256KB body-size guard on /api/inbox (413 before auth)"
```

---

### Task 4: docs

**Files:**
- Modify: `README.md` (the `### POST /api/inbox` section)
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: README.** In the `### POST /api/inbox` section, append this sentence to the paragraph describing the body (the line starting `Body: \`{ title, body?, content?, …`):

```markdown
Bodies over 256 KB are rejected with `413` before parsing or auth.
```

- [ ] **Step 2: ROADMAP.** Two edits:
- Append to the Shipped table (after the C1a row; `#??` backfilled by Task 5):

```markdown
| **C1b — Inbox go-live hardening** | #?? | E11000 single-retry on the dedup upsert (concurrent posts converge); constant-time bearer-token compare (SHA-256 + `timingSafeEqual`, no-early-exit scan); 256 KB body cap on `/api/inbox` (413 before auth). |
```

- In the Track C `**C1 · Connectors**` bullet, two edits:
  1. The *Explanation* sub-item contains the sentence beginning `Going live here triggers two already-scoped hardening items:` and ending `max-body-size guard before `request.json()`).` — replace that ENTIRE sentence with: `Go-live hardening shipped as **C1b** (see Shipped).` Keep the surrounding sentences and the `*(Origin: …)*` marker intact.
  2. The *Status* sub-item (added when C1a shipped) ends with `and the two go-live hardening items above.` — replace that trailing phrase with `and Arkaik/changelog connectors (hardening shipped as C1b).`, dropping any now-duplicated "Arkaik/changelog connectors" mention earlier in that same sentence so it reads cleanly.

- [ ] **Step 3:** `grep -n "C1b" README.md docs/superpowers/ROADMAP.md` — ROADMAP hits only; `grep -n "256 KB" README.md` — one hit.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/ROADMAP.md
git commit -m "docs: record C1b inbox hardening (README cap note + ROADMAP)"
```

---

### Task 5: PR + post-merge smoke

**Files:** none (operations)

- [ ] **Step 1: Push and open the PR.**

```bash
git push -u origin claude/c1-hardening
```

PR title: `C1b: inbox go-live hardening — upsert retry, constant-time auth, body cap`. Body: summary of the three items, pointer to the spec, gates line, and this Lab Note section (verbatim, fenced yaml):

    ## Lab Note

    ```yaml
    en:
      title: The inbox toughened up
      summary: The changelog pipeline's front door now shrugs off duplicate deliveries, oversized payloads, and timing tricks — invisible today, sturdy for years.
    fr:
      title: L'inbox s'est endurcie
      summary: La porte d'entrée du pipeline encaisse désormais les doublons, les payloads obèses et les attaques par chronométrage — invisible aujourd'hui, solide pour longtemps.
    suggested:
      molecule: ariko
      type: improvement
      tags: [changelog, connectors, hardening]
    ```

End the body with the standard attribution line.

- [ ] **Step 2: Backfill the PR number** into the ROADMAP C1b row (`#??` → `#<N>`), commit `docs: fill C1b PR number in ROADMAP`, push.

- [ ] **Step 3: After review + merge — smoke.**

```bash
# 413 live (no token needed — the gate fires before auth):
head -c 300000 /dev/zero | tr '\0' 'x' > /tmp/big.json
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.ariko.app/api/inbox \
  -H 'Content-Type: application/json' --data-binary @/tmp/big.json   # expect 413
rm /tmp/big.json
# pipeline still healthy — merged PR self-posts its own Lab Note:
gh run list --repo alexisbohns/ariko --workflow=lab-note.yml --limit 1   # expect success
```

Then confirm the new capture ("The inbox toughened up") is in the admin inbox.

---

## Deferred follow-ups (tracked, not in this plan)

- C1 fan-out: authoring-skill plugin, pbbls skill rewrite, sibling caller stubs + secrets.
- Rate limiting / IP allowlisting (no current threat-model need — spec §8).
