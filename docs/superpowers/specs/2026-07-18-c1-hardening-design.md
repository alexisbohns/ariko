# C1 go-live hardening — inbox endpoint trio

*2026-07-18 — design approved in brainstorming; implementation plan to follow.*

## 1. Intent

The Lab Note pipeline (C1a, PR #17) put `POST /api/inbox` into real production use:
a public repo documents the endpoint, CI posts to it on every merged PR, and the
bearer tokens guarding it are now operationally important. The 2a plan deferred
three hardening items "until the endpoint faces untrusted exposure" — that
moment is now. This slice ships exactly those three, nothing else.

## 2. Decisions (brainstorm outcomes)

| Question | Decision |
|---|---|
| Scope of the body-size guard | **`/api/inbox` only.** `/api/upload` stays as is: Vercel hard-caps every request at ~4.5 MB and Cloudinary enforces its own limits, so an explicit cap there would only rename an existing error (YAGNI). |
| Size limit | **256 KB** (`MAX_INBOX_BODY_BYTES = 256 * 1024`) — ~17× under the platform cap, vastly above any real capture (bilingual content + media lists included). |
| Status-code precedence | **413 wins over 401.** An oversized body is rejected before any auth reasoning: `source.kind` can't be read from a body we refuse to parse, and 413 leaks nothing to an unauthenticated caller. |
| Retry policy on E11000 | **Retry once, no loop.** The upsert race is one-shot: the loser's retry necessarily finds the winner's document and takes the update path. Anything other than code 11000 rethrows immediately. |
| Crypto surface | **`node:crypto`, synchronous.** Both API routes run in the Node runtime; `authorize`/`hasValidToken` keep their sync signatures. (The async Web Crypto pattern in `lib/session.ts` exists for edge middleware and is not needed here.) |

## 3. Item 1 — E11000 concurrent-upsert retry (`lib/captures.ts`)

Two concurrent `POST /api/inbox` calls with the same `(source.kind,
source.externalId)` can both miss the existing document and both take the
insert path of `findOneAndUpdate(..., { upsert: true })`; the loser throws
`MongoServerError` code 11000 from the partial unique index.

- New exported helper in `lib/captures.ts`:
  `withDuplicateKeyRetry<T>(fn: () => Promise<T>): Promise<T>` — awaits `fn()`;
  on an error whose `code === 11000`, awaits `fn()` once more; any other error
  (and a second 11000) propagates unchanged.
- The dedup path of `createOrUpdateCapture` wraps its `findOneAndUpdate` in
  this helper. The manual path (no `externalId`) is untouched — the partial
  index only covers documents with `externalId`, so `insertOne` there cannot
  E11000.
- The retried call returns `created: false` (the winner's document exists by
  then) — correct by construction, since exactly one insert happened.

## 4. Item 2 — constant-time token compare (`lib/auth.ts`)

`tokens.get(candidate)` resolves token equality through hash-map string
comparison, whose timing varies with matching prefix length. Marginal in
practice, but the fix is cheap and the endpoint is now public-facing.

- `parseTokens` and the `Map<token, Set<kind>>` shape are unchanged.
- New internal `timingSafeEqualStr(a, b)`: SHA-256 both strings
  (`node:crypto.createHash`), compare digests with `crypto.timingSafeEqual`.
  Hashing first makes the buffers equal-length, so no length information leaks
  through an early size check.
- `authorize` and `hasValidToken` replace the map lookup with a scan over
  **all** entries, comparing the candidate against every configured token and
  accumulating the matched kinds **without early exit** — iteration count is
  independent of where (or whether) the match occurs. With the 1–5 tokens this
  deployment will ever hold, the scan cost is negligible.
- Behavior is identical: same `ok` / `unauthorized` / `forbidden` results,
  same `*` wildcard semantics, same signatures.

## 5. Item 3 — body-size guard (`app/api/inbox/route.ts`)

`request.json()` currently buffers and parses a body of any size the platform
lets through.

- `MAX_INBOX_BODY_BYTES = 256 * 1024`, exported from `lib/inbox.ts` next to the
  validator (a pure constant; the route imports it, tests reference it).
- Route order becomes:
  1. If the `Content-Length` header is present and exceeds the limit → **413**
     `{ error: "body too large (max 262144 bytes)" }` without reading the body.
  2. Read `await request.text()`; if `Buffer.byteLength(text)` exceeds the
     limit (chunked encoding / lying header) → same **413**.
  3. `JSON.parse(text)` inside the existing try/catch → existing **400**
     `invalid JSON body` on failure.
  4. Everything after (validation, 401-before-400 preference, auth, upsert) is
     unchanged.
- The lab-note CLI already maps 413 to `unreachable`-class failure (non-2xx,
  not 400/401/403 → exit 3, re-runnable) — acceptable: a real Lab Note can
  never approach 256 KB, so a 413 there signals something structurally wrong,
  worth a loud job failure.

## 6. Error handling

| Condition | Response |
|---|---|
| Body over limit (header or measured) | 413 `body too large (max 262144 bytes)` — before auth |
| Invalid JSON under the limit | 400 `invalid JSON body` (unchanged) |
| Concurrent duplicate upsert | invisible to caller — retry returns 200 `created: false` |
| Second consecutive E11000 / other DB error | propagates → 500 (unchanged behavior) |
| Auth outcomes | unchanged (`401` / `403`, constant-time internally) |

## 7. Testing

- **`lib/captures.test.ts`:** `withDuplicateKeyRetry` unit tests
  with fakes — throws-11000-once → second result returned; throws twice →
  second error propagates; non-11000 → propagates immediately, `fn` called
  once; success → `fn` called once.
- **`lib/inbox-route.test.ts`:** 413 via oversized `Content-Length` header
  (body never read); 413 via actual oversized body without the header; a
  valid capture just under boundary conditions still 201/200; existing
  401-before-400 cases unchanged.
- **`lib/auth.test.ts`:** entire existing suite must pass unchanged (the
  change is behavior-preserving); add cases for tokens of different lengths
  and a candidate matching the *last* configured token (exercises the
  no-early-exit scan).
- **Live smoke (post-deploy):** `curl` with a >256 KB body → 413; normal
  lab-note dispatch re-post → still `updated (HTTP 200)`.

## 8. Out of scope

- `/api/upload` size cap (decided against — platform + Cloudinary already bound it).
- Rate limiting, IP allowlists, request signing (no current threat model need).
- Any change to token storage/format or the `INBOX_TOKENS` scheme.
- C1 fan-out (skill/plugin, sibling stubs) — separate slice.
