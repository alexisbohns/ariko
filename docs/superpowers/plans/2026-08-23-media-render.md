# Media, PR2 — showing them (B3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `media[]` on the public bean page — images as images, derivable embeds as players, everything else as a link card — behind a hardened provider-detection path and a narrow CSP, and derive a bean's cover from its newest sprout carrying an image.

**Architecture:** Provider detection becomes a trust boundary the moment an embed is iframed, so the hardening ships in the same slice as the rendering. `lib/embed-src.ts` is a pure, table-driven URL builder; the CSP's `frame-src` allowlist is generated from that same table so the two cannot drift. `lib/cover.ts` mirrors `lib/article.ts` — a pure scan over newest-first sprouts, with no state re-check because the caller already passes a `filterPublic`-projected dataset.

**Tech Stack:** Next.js 15 (App Router), React 19 server components, TypeScript, `node:test` + `tsx`.

**Spec:** [`../specs/2026-08-23-media-design.md`](../specs/2026-08-23-media-design.md) §5.

**Depends on:** PR1 ([`2026-08-23-media-create.md`](2026-08-23-media-create.md)) — this renders what that writes. It can be *built* independently, but there is nothing to look at until PR1 has created an image.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/embeds.ts` | **Modify.** Exact host matching; both id extractors hardened |
| `lib/inbox.ts` | **Modify.** Provider is always derived, never taken from the payload |
| `lib/embed-src.ts` | **Create.** `embedSrc`, `EMBED_FRAME_HOSTS` — pure, table-driven |
| `lib/cover.ts` | **Create.** `coverFor` |
| `lib/data.ts` | **Modify.** Export `byDateDesc` so the graph can order sprouts the way the dataset does |
| `components/media.tsx` | **Create.** `MediaList` — server-only |
| `next.config.ts` | **Modify.** `frame-src` CSP built from `EMBED_FRAME_HOSTS` |
| `app/(public)/bean/[id]/page.tsx` | **Modify.** Render each sprout's media |
| `lib/entity-resolve.ts` | **Modify.** `cover` on resolved beans |
| `components/entity.tsx` | **Modify.** `EntityCard` thumbnail |
| `app/(public)/page.tsx` | **Modify.** Directory thumbnails |
| `lib/graph.ts` | **Modify.** `cover` on bean nodes |
| `docs/superpowers/ROADMAP.md` | **Modify.** Close B2 and B3 |

---

## Task 1: Harden host matching

**Files:**
- Modify: `lib/embeds.ts`
- Test: `lib/embeds.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/embeds.test.ts`:

```ts
// The reason this slice pairs hardening with rendering: substring matching
// made every one of these detect as a real provider, and a provider is what
// decides whether something gets iframed.
test("a decoy host that merely CONTAINS a provider domain is not that provider", () => {
  assert.equal(detectEmbed("https://vimeo.com.evil.test/123").provider, "link");
  assert.equal(detectEmbed("https://evilvimeo.com/123").provider, "link");
  assert.equal(detectEmbed("https://notyoutu.be/abc").provider, "link");
  assert.equal(detectEmbed("https://youtube.com.attacker.example/watch?v=x").provider, "link");
  assert.equal(detectEmbed("https://spotify.com.evil.test/track/abc").provider, "link");
});

test("a decoy host yields no embedId either", () => {
  assert.equal(detectEmbed("https://vimeo.com.evil.test/123").embedId, undefined);
  assert.equal(detectEmbed("https://notyoutu.be/abc").embedId, undefined);
});

test("real subdomains and bare apexes both still match", () => {
  assert.equal(detectEmbed("https://vimeo.com/123").provider, "vimeo");
  assert.equal(detectEmbed("https://player.vimeo.com/video/123").provider, "vimeo");
  assert.equal(detectEmbed("https://m.youtube.com/watch?v=abc").provider, "youtube");
});

// vimeoId regexed the WHOLE url, so it could lift an id out of a query string
// and picked the wrong segment on a channel URL.
test("the vimeo id comes from a path segment, not from anywhere in the string", () => {
  assert.equal(detectEmbed("https://vimeo.com/123456").embedId, "123456");
  assert.equal(detectEmbed("https://vimeo.com/channels/staffpicks/123456").embedId, "123456");
  assert.equal(detectEmbed("https://vimeo.com/notanumber").embedId, undefined);
});

// AMENDED: this originally asserted 999 for the showcase form, taking the FIRST
// numeric segment. 999 is the showcase's id, so embedSrc would have built
// player.vimeo.com/video/999 and embedded the wrong video. Vimeo nests the
// video id under a collection id in several share forms and the collection's id
// always comes first, so the LAST numeric segment is the right rule.
test("a collection URL yields the video's id, not the collection's", () => {
  assert.equal(detectEmbed("https://vimeo.com/showcase/999/video/123456").embedId, "123456");
  assert.equal(detectEmbed("https://vimeo.com/groups/123/videos/456").embedId, "456");
  assert.equal(detectEmbed("https://vimeo.com/album/999/video/123456").embedId, "123456");
});

test("a youtu.be lookalike does not reach the short-URL id path", () => {
  // "youtu.be.evil.test/HIJACK" would have had its path read as the video id.
  assert.equal(detectEmbed("https://youtu.be.evil.test/HIJACK").provider, "link");
  assert.equal(detectEmbed("https://youtu.be.evil.test/HIJACK").embedId, undefined);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/embeds.test.ts`
Expected: FAIL — the decoy hosts detect as real providers.

- [ ] **Step 3: Harden all three sites**

In `lib/embeds.ts`, replace the header comment, add the matcher, and rewrite both id extractors and `detectEmbed`'s provider line:

```ts
// Host → provider. First match wins.
const HOST_PROVIDERS: Array<[string, MediaEmbed["provider"]]> = [
  ["soundcloud.com", "soundcloud"],
  ["spotify.com", "spotify"],
  ["deezer.com", "deezer"],
  ["ausha.co", "ausha"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["vimeo.com", "vimeo"],
  ["figma.com", "figma"],
];

/**
 * Exact host, or a subdomain of it. NOT a substring.
 *
 * This was `host.includes(h)` until the media slice, which made
 * "vimeo.com.evil.test" detect as vimeo. That was harmless for as long as
 * nothing rendered an embed; it stopped being harmless the moment `provider`
 * started deciding whether a URL gets loaded into an iframe (lib/embed-src.ts).
 */
export function hostMatches(host: string, base: string): boolean {
  return host === base || host.endsWith("." + base);
}
```

```ts
function youtubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    // hostMatches, not includes(): "youtu.be.evil.test/HIJACK" would otherwise
    // have had its path read as the video id.
    if (hostMatches(u.hostname.toLowerCase(), "youtu.be")) {
      return u.pathname.slice(1) || undefined;
    }
    return u.searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
}

// The LAST numeric path segment. Not the first: Vimeo nests the video id under
// a collection id in several share forms — /showcase/{id}/video/{id},
// /groups/{id}/videos/{id}, /album/{id}/video/{id} — all of which lead with the
// COLLECTION's id, so taking the first embeds the wrong video. The last is
// right for every form, including the bare vimeo.com/123456.
//
// Still a path-segment scan rather than a regex over the whole URL: the regex
// this replaced could lift an id out of a query string.
function vimeoId(url: string): string | undefined {
  try {
    const numeric = new URL(url).pathname.split("/").filter((s) => /^\d+$/.test(s));
    return numeric[numeric.length - 1];
  } catch {
    return undefined;
  }
}
```

and in `detectEmbed`:

```ts
  const provider =
    (host && HOST_PROVIDERS.find(([h]) => hostMatches(host, h))?.[1]) || "link";
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/embeds.test.ts`
Expected: PASS — the new tests plus every pre-existing one (`open.spotify.com`, `podcast.ausha.co`, `www.deezer.com`, `www.figma.com` all match by suffix).

- [ ] **Step 5: Commit**

```bash
git add lib/embeds.ts lib/embeds.test.ts
git commit -m "Media: match embed hosts exactly, not by substring"
```

---

## Task 2: The provider is derived, never declared

Task 1 locks the front door. `lib/inbox.ts`'s `normalizeMedia` is the side one: it passes a **client-declared** `provider` straight through unverified, so a payload could claim `provider: "soundcloud"` on any URL at all and be framed on an allowlisted host. Nothing in the repo sends a provider (verified across `scripts/` and `.github/`), so deriving always costs nothing.

**Files:**
- Modify: `lib/inbox.ts`
- Test: `lib/inbox.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/inbox.test.ts`:

```ts
// provider is a TRUST SIGNAL once embeds are iframed (lib/embed-src.ts), and a
// signal a caller can set is no signal at all.
test("normalizeMedia derives the provider from the url, ignoring a declared one", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "soundcloud", url: "https://evil.test/anything" },
  ]);
  assert.equal(out[0].kind, "embed");
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "link");
    assert.equal(out[0].url, "https://evil.test/anything");
  }
});

test("a declared embedId cannot be smuggled past detection either", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "youtube", embedId: "HIJACKED", url: "https://evil.test/x" },
  ]);
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "link");
    assert.equal(out[0].embedId, undefined);
  }
});

test("a declared provider that agrees with the url is unaffected", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/track/abc" },
  ]);
  if (out[0].kind === "embed") assert.equal(out[0].provider, "spotify");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/inbox.test.ts`
Expected: FAIL — the declared `soundcloud` provider survives.

- [ ] **Step 3: Always derive**

In `lib/inbox.ts`, replace `normalizeMedia` entirely:

```ts
/**
 * Images pass through; every embed's provider is DERIVED from its URL.
 *
 * A declared `provider` (and `embedId`) on an incoming payload is ignored, not
 * trusted. `provider` decides whether a URL is loaded into an iframe
 * (lib/embed-src.ts), so a caller-settable provider would be no trust signal at
 * all — it would let a payload claim "soundcloud" for any URL and be framed on
 * an allowlisted host. Hardening detectEmbed's host matching (lib/embeds.ts)
 * without closing this would lock the front door and leave the side one.
 *
 * The InputMedia type still carries the optional fields because that is the
 * shape /api/inbox ACCEPTS — accepting and honouring are different things, and
 * rejecting a payload for a field we can derive would be a needless break.
 */
export function normalizeMedia(media: InputMedia[]): Media[] {
  return media.map((m) => (m.kind === "image" ? m : detectEmbed(m.url)));
}
```

Then update the pre-existing test at `lib/inbox.test.ts` named **"normalizeMedia leaves an already-typed embed and images untouched"** — its intent is now wrong. Rename and reword it:

```ts
test("normalizeMedia re-derives a typed embed's provider and leaves images untouched", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/x" },
    { kind: "image", storageKey: "k", url: "https://cdn/x.jpg" },
  ]);
  // Same answer as before, but now because the URL says so, not the payload.
  if (out[0].kind === "embed") assert.equal(out[0].provider, "spotify");
  assert.equal(out[1].kind, "image");
});
```

- [ ] **Step 4: Run the inbox and media suites**

Run: `node --import tsx --test lib/inbox.test.ts lib/inbox-route.test.ts lib/media-input.test.ts lib/seed-form.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/inbox.ts lib/inbox.test.ts
git commit -m "Media: derive every embed provider from its url, never from the payload"
```

---

## Task 3: `embedSrc` and the frame allowlist

**Files:**
- Create: `lib/embed-src.ts`
- Test: `lib/embed-src.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/embed-src.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmbed } from "./embeds";
import { EMBED_FRAME_HOSTS, embedSrc } from "./embed-src";

const frameFor = (url: string) => embedSrc(detectEmbed(url));

test("youtube frames on the no-cookie host, by id", () => {
  const f = frameFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.ok(f);
  assert.equal(f!.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(f!.aspect, "video");
});

test("vimeo frames on the player host, by id", () => {
  const f = frameFor("https://vimeo.com/123456789");
  assert.equal(f!.src, "https://player.vimeo.com/video/123456789");
  assert.equal(f!.aspect, "video");
});

test("soundcloud frames by handing the widget the share url", () => {
  const f = frameFor("https://soundcloud.com/artist/track");
  assert.equal(
    f!.src,
    "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack",
  );
  assert.equal(f!.aspect, "audio");
});

test("spotify frames from its validated path", () => {
  assert.equal(
    frameFor("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")!.src,
    "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
  );
  assert.equal(
    frameFor("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3")!.src,
    "https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3",
  );
});

test("deezer frames from its validated path", () => {
  assert.equal(
    frameFor("https://www.deezer.com/en/track/3135556")!.src,
    "https://widget.deezer.com/widget/dark/track/3135556",
  );
});

test("a spotify url whose path is not a known type does not frame", () => {
  assert.equal(frameFor("https://open.spotify.com/user/someone"), null);
  assert.equal(frameFor("https://open.spotify.com/"), null);
});

test("a deezer url with a non-numeric id does not frame", () => {
  assert.equal(frameFor("https://www.deezer.com/en/track/abc"), null);
});

// Spec §5.2 — link cards on stated evidence, not oversight.
test("ausha and figma render as link cards for now", () => {
  assert.equal(frameFor("https://podcast.ausha.co/show/episode"), null);
  assert.equal(frameFor("https://www.figma.com/file/abc/Design"), null);
});

test("a link-provider embed never frames", () => {
  assert.equal(frameFor("https://example.com/whatever"), null);
  assert.equal(frameFor("not a url"), null);
});

test("a decoy host never frames — the whole point of the hardening", () => {
  assert.equal(frameFor("https://vimeo.com.evil.test/123"), null);
  assert.equal(frameFor("https://youtu.be.evil.test/HIJACK"), null);
});

test("a provider with no extractable id does not frame", () => {
  // A youtube URL with no v= parameter and no short-URL path.
  assert.equal(frameFor("https://www.youtube.com/results?search_query=x"), null);
});

// The CSP allowlist and this table must never drift — that is the whole reason
// EMBED_FRAME_HOSTS is exported from here rather than typed into next.config.ts.
test("every host embedSrc can emit is in EMBED_FRAME_HOSTS", () => {
  const urls = [
    "https://www.youtube.com/watch?v=abc",
    "https://vimeo.com/123",
    "https://soundcloud.com/a/b",
    "https://open.spotify.com/track/abc",
    "https://www.deezer.com/en/track/123",
  ];
  for (const url of urls) {
    const frame = embedSrc(detectEmbed(url));
    assert.ok(frame, url);
    const origin = new URL(frame!.src).origin;
    assert.ok(
      (EMBED_FRAME_HOSTS as readonly string[]).includes(origin),
      `${origin} is framed but missing from EMBED_FRAME_HOSTS`,
    );
  }
});

test("every allowlisted host is actually reachable by some provider", () => {
  // The mirror of the test above: an entry nothing can emit is an allowlist
  // that grew stale, which is a CSP that permits more than it needs to.
  const emitted = new Set(
    [
      "https://www.youtube.com/watch?v=abc",
      "https://vimeo.com/123",
      "https://soundcloud.com/a/b",
      "https://open.spotify.com/track/abc",
      "https://www.deezer.com/en/track/123",
    ].map((u) => new URL(embedSrc(detectEmbed(u))!.src).origin),
  );
  for (const host of EMBED_FRAME_HOSTS) {
    assert.ok(emitted.has(host), `${host} is allowlisted but nothing emits it`);
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/embed-src.test.ts`
Expected: FAIL — `Cannot find module './embed-src'`.

- [ ] **Step 3: Write the implementation**

Create `lib/embed-src.ts`:

```ts
import type { MediaEmbed } from "./data";

/**
 * Which embeds become an iframe, and what URL they load (spec §5.2).
 *
 * Pure and table-driven so "which providers are framed" is a reviewable list
 * rather than a property scattered across conditionals — this decides what
 * third-party code runs on a public page, which is not a decision that should
 * be reconstructed by reading control flow.
 *
 * `null` is not a failure: it means "render a link card instead"
 * (components/media.tsx). Two known providers return null deliberately —
 * ausha share URLs carry no podcastId and its player requires one, and Figma's
 * current embed contract (www.figma.com/embed vs embed.figma.com) is
 * unverified with no Figma content in the database to test against. Each is
 * one table row and one test away, the day there is something to verify with.
 *
 * SAFETY: this trusts `media.provider`, which is exactly why lib/embeds.ts
 * matches hosts exactly and lib/inbox.ts derives the provider from the URL
 * rather than accepting a declared one. Those two are this file's premise.
 */

export interface EmbedFrame {
  src: string;
  /** The iframe's accessible name. Not fetched — nothing here makes a network call. */
  title: string;
  /** "video" is a 16:9 box; "audio" is a short fixed one, because a player that is 16:9 is mostly empty space. */
  aspect: "video" | "audio";
}

/**
 * Every origin embedSrc can return, and nothing else. next.config.ts builds the
 * CSP frame-src allowlist from THIS array, so the policy and the table cannot
 * drift; lib/embed-src.test.ts asserts the correspondence in both directions.
 */
export const EMBED_FRAME_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://w.soundcloud.com",
  "https://open.spotify.com",
  "https://widget.deezer.com",
] as const;

const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "episode", "show", "artist"]);
const DEEZER_TYPES = new Set(["track", "album", "playlist", "episode", "show", "artist"]);

function segments(url: string): string[] | null {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
}

// The last two path segments as a validated {type, id} pair, or null. Both
// Spotify and Deezer put the type immediately before the id, with Deezer
// optionally prefixing a locale ("/en/track/123").
function typeAndId(
  url: string,
  types: Set<string>,
  idPattern: RegExp,
): { type: string; id: string } | null {
  const parts = segments(url);
  if (!parts || parts.length < 2) return null;
  const [type, id] = parts.slice(-2);
  if (!types.has(type) || !idPattern.test(id)) return null;
  return { type, id };
}

export function embedSrc(media: MediaEmbed): EmbedFrame | null {
  const title = `${media.provider} player`;

  switch (media.provider) {
    case "youtube":
      return media.embedId
        ? {
            src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.embedId)}`,
            title,
            aspect: "video",
          }
        : null;

    case "vimeo":
      return media.embedId
        ? {
            src: `https://player.vimeo.com/video/${encodeURIComponent(media.embedId)}`,
            title,
            aspect: "video",
          }
        : null;

    case "soundcloud":
      // The widget takes the share URL verbatim. Safe because `provider` is
      // only "soundcloud" when the host matched exactly (lib/embeds.ts).
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(media.url)}`,
        title,
        aspect: "audio",
      };

    case "spotify": {
      const found = typeAndId(media.url, SPOTIFY_TYPES, /^[A-Za-z0-9]+$/);
      return found
        ? { src: `https://open.spotify.com/embed/${found.type}/${found.id}`, title, aspect: "audio" }
        : null;
    }

    case "deezer": {
      const found = typeAndId(media.url, DEEZER_TYPES, /^\d+$/);
      return found
        ? {
            src: `https://widget.deezer.com/widget/dark/${found.type}/${found.id}`,
            title,
            aspect: "audio",
          }
        : null;
    }

    default:
      // ausha, figma, link — and anything a future provider adds before its
      // derivation is written. A link card is always a correct answer.
      return null;
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/embed-src.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/embed-src.ts lib/embed-src.test.ts
git commit -m "Media: a pure, table-driven embed URL builder"
```

---

## Task 4: The CSP

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add the header**

In `next.config.ts`, add the import and the `headers` entry:

```ts
import { EMBED_FRAME_HOSTS } from "./lib/embed-src";
```

```ts
  // The repo's first CSP, and deliberately ONE directive.
  //
  // A policy containing only `frame-src` constrains frames and nothing else —
  // there is no `default-src`, so scripts, styles and fonts are untouched and
  // no nonces are needed. That is what makes it safe to add in the same slice
  // as the feature it guards, instead of as its own project.
  //
  // Built from EMBED_FRAME_HOSTS (lib/embed-src.ts) rather than a hand-copied
  // list, so the allowlist and the URL table it mirrors cannot drift.
  // lib/embed-src.test.ts asserts the correspondence in both directions.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: `frame-src 'self' ${EMBED_FRAME_HOSTS.join(" ")};`,
        },
      ],
    },
  ],
```

- [ ] **Step 2: Verify the config compiles and the header ships**

Run: `npm run build`
Expected: build succeeds.

> **De-risked during PR1.** This step originally carried a caveat that Next might not resolve a
> relative import of a project `lib/` module from `next.config.ts`. **It does** — PR1's Task 5
> ships exactly that pattern (`import { MAX_UPLOAD_BYTES } from "./lib/upload-input"`) with a
> clean `npm run build`. The `lib/embed-hosts.ts` fallback is therefore not needed.
>
> The cost of that pattern is a constraint, and it applies here too: **`lib/embed-src.ts` must
> stay dependency-free.** Anything it imports is loaded while Next reads its config, before the
> app exists, so an import needing a server runtime, `server-only`, or an env var would stop the
> config loading in *every* environment at once. Type-only imports are fine. Record the
> constraint in a comment at the top of the file, as `lib/upload-input.ts` does.

Either way: do **not** hand-copy the host list into the config. The whole point is that the CSP and the URL table cannot drift.

- [ ] **Step 3: Confirm the header at runtime**

Run in one terminal: `npx next dev`
Then: `curl -sI http://localhost:3000/ | grep -i content-security-policy`
Expected: `content-security-policy: frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://w.soundcloud.com https://open.spotify.com https://widget.deezer.com;`

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "Media: a frame-src CSP built from the embed allowlist"
```

---

## Task 5: `MediaList`

**Files:**
- Create: `components/media.tsx`

Server-only, no client JS enters the public zone. No unit test — it is a pure presentational server component over `embedSrc`, which Task 3 pins exhaustively.

- [ ] **Step 1: Write the component**

Create `components/media.tsx`:

```tsx
import type { Media } from "@/lib/data";
import { embedSrc } from "@/lib/embed-src";
import { Badge } from "@/components/ui/badge";

/**
 * Renders a media[] list (spec §5.4). Server component — no client JS enters
 * the public zone, same rule as components/markdown.tsx.
 *
 * Three cases, in order of how much we trust the thing: an image we host, an
 * embed whose URL we could derive exactly, and everything else — which becomes
 * a link out rather than a frame. `embedSrc` returning null is the ordinary
 * path for ausha, figma and every `link`, not an error.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function MediaItem({ media }: { media: Media }) {
  if (media.kind === "image") {
    return (
      // A plain <img>, not next/image: that would need images.remotePatterns
      // for Cloudinary and put an optimizer in front of the public zone for no
      // gain here. width/height are stored by toMediaImage (lib/storage.ts) and
      // are what stop the page reflowing as images arrive.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.url}
        alt={media.alt ?? ""}
        {...(media.width ? { width: media.width } : {})}
        {...(media.height ? { height: media.height } : {})}
        loading="lazy"
        decoding="async"
        className="h-auto max-w-full rounded-lg"
      />
    );
  }

  const frame = embedSrc(media);
  if (frame) {
    return (
      <div className={frame.aspect === "video" ? "aspect-video w-full" : "h-40 w-full"}>
        <iframe
          src={frame.src}
          title={frame.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full rounded-lg border-0"
        />
      </div>
    );
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
    >
      <Badge variant="secondary">{media.provider}</Badge>
      <span className="min-w-0 break-all text-muted-foreground">{hostOf(media.url)}</span>
    </a>
  );
}

export function MediaList({ media }: { media?: Media[] }) {
  if (!media || media.length === 0) return null;
  return (
    <ul className="not-prose flex flex-col gap-3">
      {media.map((m, i) => (
        <li key={`${m.kind}-${i}-${m.url}`}>
          <MediaItem media={m} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/media.tsx
git commit -m "Media: render images, players and link cards"
```

---

## Task 6: Render media on the bean page

**Files:**
- Modify: `app/(public)/bean/[id]/page.tsx`

- [ ] **Step 1: Add the list to each sprout's card**

Add the import:

```ts
import { MediaList } from "@/components/media";
```

and change the sprout card's `<CardContent>` to:

```tsx
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 font-heading text-xs">{dumpRows(sprout)}</ul>
            {/* One location, no duplication, and no layout bet the exhibition
                slice would overturn: the property dump stays until D1 retires
                it deliberately (umbrella §4), so media belongs beside it. */}
            <MediaList media={sprout.media} />
          </CardContent>
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/bean/[id]/page.tsx"
git commit -m "Media: a bean page shows its sprouts' media"
```

---

## Task 7: The cover

**Files:**
- Create: `lib/cover.ts`
- Modify: `lib/data.ts` (export `byDateDesc`)
- Test: `lib/cover.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/cover.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sprout } from "./data";
import { coverFor } from "./cover";

const sprout = (slug: string, date: string, media?: Sprout["media"]): Sprout => ({
  slug,
  name: slug,
  type: "release",
  date,
  description: "",
  parents: ["bean:x"],
  ...(media ? { media } : {}),
});

const img = (key: string) => ({ kind: "image" as const, storageKey: key, url: `https://cdn/${key}.jpg` });
const embed = (url: string) => ({ kind: "embed" as const, provider: "link", url });

test("no sprouts means no cover", () => {
  assert.equal(coverFor([]), null);
});

test("no images anywhere means no cover", () => {
  assert.equal(coverFor([sprout("a", "2026-01-01"), sprout("b", "2025-01-01", [embed("https://x")])]), null);
});

test("the FIRST image of the newest sprout that has one", () => {
  const cover = coverFor([sprout("a", "2026-01-01", [img("k1"), img("k2")])]);
  assert.equal(cover?.storageKey, "k1");
});

// The umbrella's wording ("the newest published sprout's media[]") could mean
// "strictly the newest, or nothing". Resolved toward its sibling articleFor,
// which returns the first sprout CARRYING content rather than giving up at the
// newest — so a bean whose latest sprout is a text-only changelog entry keeps
// the cover its previous release earned.
test("scans past a newer sprout that has no image", () => {
  const cover = coverFor([
    sprout("changelog", "2026-06-01"),
    sprout("release", "2026-01-01", [img("k9")]),
  ]);
  assert.equal(cover?.storageKey, "k9");
});

test("an embed before an image is skipped — a cover is an image", () => {
  const cover = coverFor([sprout("a", "2026-01-01", [embed("https://x"), img("k3")])]);
  assert.equal(cover?.storageKey, "k3");
});

test("a sprout whose media is only embeds does not stop the scan", () => {
  const cover = coverFor([
    sprout("newer", "2026-06-01", [embed("https://x")]),
    sprout("older", "2026-01-01", [img("k4")]),
  ]);
  assert.equal(cover?.storageKey, "k4");
});

test("input order is respected as given — the caller supplies newest-first", () => {
  // Same as articleFor: ordering is the dataset's guarantee, not this
  // function's job. Given oldest-first, it honestly returns the oldest.
  const cover = coverFor([sprout("old", "2020-01-01", [img("old")]), sprout("new", "2026-01-01", [img("new")])]);
  assert.equal(cover?.storageKey, "old");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/cover.test.ts`
Expected: FAIL — `Cannot find module './cover'`.

- [ ] **Step 3: Write the implementation**

Create `lib/cover.ts`:

```ts
import type { MediaImage, Sprout } from "./data";

/**
 * Pure (umbrella §5). A bean's cover is DERIVED — no field, no authoring step,
 * no migration. Given sprouts in the newest-first order the dataset already
 * guarantees (stable byDateDesc), returns the first MediaImage in the first
 * sprout that has one, or null.
 *
 * The umbrella says "the first MediaImage in its newest published sprout's
 * media[]", which could also be read as "strictly the newest sprout, or
 * nothing". Resolved toward this function's sibling, articleFor
 * (lib/article.ts), which returns the first sprout CARRYING content rather than
 * giving up at the newest: a bean whose latest sprout is a text-only changelog
 * entry keeps the cover its previous release earned.
 *
 * State is NOT re-checked here, exactly as in articleFor: the public page
 * passes the filterPublic-projected dataset, so "published" is already enforced
 * upstream. One projection, one place.
 */
export function coverFor(sprouts: Sprout[]): MediaImage | null {
  for (const sprout of sprouts) {
    const image = (sprout.media ?? []).find((m): m is MediaImage => m.kind === "image");
    if (image) return image;
  }
  return null;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/cover.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Export the comparator for Task 10**

In `lib/data.ts`, change `function byDateDesc` to be exported — `lib/graph.ts` serializes a `RawGarden` and has no `Dataset` to borrow the ordering from, and reimplementing it there would be a second definition of the same contract:

```ts
// Newest first; ties keep input order (stable sort). Exported because
// lib/graph.ts orders a bean's sprouts the same way to derive its cover, and
// it works from a RawGarden rather than a built Dataset.
export function byDateDesc(a: { date: string }, b: { date: string }): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/cover.ts lib/cover.test.ts lib/data.ts
git commit -m "Media: derive a bean's cover from its newest sprout with an image"
```

---

## Task 8: Cover on resolved entities and cards

**Files:**
- Modify: `lib/entity-resolve.ts`
- Modify: `components/entity.tsx`
- Test: `lib/entity-resolve.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/entity-resolve.test.ts` (match the existing file's fixture style — build a `RawGarden`, `buildDataset` it, then resolve):

```ts
test("a bean ref resolves with the cover derived from its newest sprout with an image", () => {
  const data = buildDataset({
    beans: [{ slug: "cover-bean", name: "Cover Bean", parents: [] }],
    sprouts: [
      {
        slug: "newer",
        name: "Newer",
        type: "t",
        date: "2026-06-01",
        description: "",
        parents: ["bean:cover-bean"],
      },
      {
        slug: "older",
        name: "Older",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:cover-bean"],
        media: [{ kind: "image", storageKey: "k9", url: "https://cdn/9.jpg", alt: "nine" }],
      },
    ],
  });
  const resolved = resolveEntity(data, "bean:cover-bean");
  assert.equal(resolved?.cover?.storageKey, "k9");
  assert.equal(resolved?.cover?.alt, "nine");
});

test("a bean with no images resolves with no cover key at all", () => {
  const data = buildDataset({ beans: [{ slug: "bare", name: "Bare", parents: [] }] });
  const resolved = resolveEntity(data, "bean:bare");
  assert.ok(resolved);
  assert.equal(resolved!.cover, undefined);
  assert.ok(!("cover" in resolved!), "an absent cover should be omitted, not set to undefined");
});

test("plant and pod refs never carry a cover — those tiers have no media field", () => {
  const data = buildDataset({
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [{ slug: "po", name: "Po", description: "", parents: ["plant:pl"] }],
  });
  assert.equal(resolveEntity(data, "plant:pl")?.cover, undefined);
  assert.equal(resolveEntity(data, "pod:po")?.cover, undefined);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/entity-resolve.test.ts`
Expected: FAIL — `cover` does not exist on `ResolvedEntity`.

- [ ] **Step 3: Resolve the cover**

In `lib/entity-resolve.ts`, add the imports and the field:

```ts
import { BEAN_PREFIX, PLANT_PREFIX, POD_PREFIX, resolveText, type Dataset, type MediaImage } from "./data";
import { coverFor } from "./cover";
```

```ts
export interface ResolvedEntity {
  ref: string;
  kind: "plant" | "pod" | "bean";
  href: string;
  name: string;
  description?: string;
  /**
   * Beans only, and derived — the first image of the newest sprout that has
   * one (lib/cover.ts). Plants and pods have no media field at all
   * (lib/data.ts), so this is structurally absent for them, not merely unset.
   */
  cover?: MediaImage;
}
```

and in the return of `resolveEntity`, add the cover after `description`:

```ts
  const description = resolveText(found.doc.description ?? "").trim();
  // sproutsForBean is already newest-first (buildDataset sorts with byDateDesc),
  // which is the ordering coverFor documents that it expects.
  const cover = found.kind === "bean" ? coverFor(dataset.sproutsForBean(found.doc.slug)) : null;
  return {
    ref,
    kind: found.kind,
    href: found.base + found.doc.slug,
    name: resolveText(found.doc.name),
    ...(description ? { description } : {}),
    ...(cover ? { cover } : {}),
  };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/entity-resolve.test.ts`
Expected: PASS — the new tests plus every pre-existing one.

- [ ] **Step 5: Show it on the card**

In `components/entity.tsx`, change `EntityCard`'s returned `<Card>` to:

```tsx
  return (
    <Card className="not-prose my-4 overflow-hidden">
      {entity.cover ? (
        <a href={entity.href} aria-hidden="true" tabIndex={-1}>
          {/* Decorative: the link below carries the accessible name, so an
              empty alt here avoids announcing the same destination twice.
              eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entity.cover.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-32 w-full object-cover"
          />
        </a>
      ) : null}
      <CardContent className="flex flex-col gap-1 py-4">
        <a href={entity.href} className="text-sm font-medium underline-offset-4 hover:underline">
          {entity.name}
        </a>
        {entity.description ? (
          <p className="text-xs text-muted-foreground">{entity.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/entity-resolve.ts components/entity.tsx lib/entity-resolve.test.ts
git commit -m "Media: entity cards carry a bean's cover"
```

---

## Task 9: Covers on the Directory

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Add thumbnails to the bean rows**

Add the import:

```ts
import { coverFor } from "@/lib/cover";
```

and replace the `beanList` helper's `<li>` body:

```tsx
  const beanList = (beans: ReturnType<typeof data.beansForPod>) => (
    <ul className="flex flex-col gap-2">
      {beans.map((bean) => {
        // sproutsForBean is newest-first (buildDataset), which is the ordering
        // coverFor expects.
        const cover = coverFor(data.sproutsForBean(bean.slug));
        return (
          <li key={bean.slug} className="flex items-start gap-3">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              <a
                href={`/bean/${bean.slug}`}
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {resolveText(bean.name)}
              </a>
              {/* One muted line, never markdown: descriptions are one-liners, content is not (spec §5). */}
              {resolveText(bean.description ?? "").trim() ? (
                <p className="text-xs text-muted-foreground/80">{resolveText(bean.description)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/page.tsx"
git commit -m "Media: the Directory shows a bean's cover"
```

---

## Task 10: Cover in the graph payload

G1 withheld media from node payloads (`lib/graph.ts:38`) pending exactly this. D1 is the immediate consumer. The projection stays published-only, so the graph still cannot expose more than the public HTML.

**Files:**
- Modify: `lib/graph.ts`
- Test: `lib/graph.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/graph.test.ts`:

```ts
test("a bean node carries the cover derived from its newest sprout with an image", () => {
  const graph = toGraph({
    beans: [{ slug: "b", name: "B", parents: [] }],
    sprouts: [
      { slug: "newer", name: "N", type: "t", date: "2026-06-01", description: "", parents: ["bean:b"] },
      {
        slug: "older",
        name: "O",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [
          { kind: "image", storageKey: "k", url: "https://cdn/x.jpg", alt: "a cat", width: 8, height: 6 },
        ],
      },
    ],
  });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.deepEqual(bean?.cover, { url: "https://cdn/x.jpg", alt: "a cat", width: 8, height: 6 });
});

// storageKey is a Cloudinary-internal id with no meaning to a consumer, so the
// public payload is a narrowed view rather than the whole MediaImage.
test("the graph's cover omits storageKey", () => {
  const graph = toGraph({
    beans: [{ slug: "b", name: "B", parents: [] }],
    sprouts: [
      {
        slug: "s",
        name: "S",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [{ kind: "image", storageKey: "secret", url: "https://cdn/x.jpg" }],
      },
    ],
  });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.deepEqual(bean?.cover, { url: "https://cdn/x.jpg" });
  assert.equal(JSON.stringify(graph).includes("secret"), false);
});

test("a bean with no images emits no cover key", () => {
  const graph = toGraph({ beans: [{ slug: "b", name: "B", parents: [] }] });
  const bean = graph.nodes.find((n) => n.id === "bean:b");
  assert.ok(bean);
  assert.ok(!("cover" in bean!));
});

test("non-bean nodes never carry a cover", () => {
  const graph = toGraph({
    plants: [{ slug: "p", name: "P", natures: ["work"], description: "" }],
    beans: [{ slug: "b", name: "B", parents: ["plant:p"] }],
    sprouts: [
      {
        slug: "s",
        name: "S",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:b"],
        media: [{ kind: "image", storageKey: "k", url: "https://cdn/x.jpg" }],
      },
    ],
  });
  assert.ok(!("cover" in graph.nodes.find((n) => n.id === "plant:p")!));
  assert.ok(!("cover" in graph.nodes.find((n) => n.id === "sprout:s")!));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test lib/graph.test.ts`
Expected: FAIL — `cover` does not exist on `GraphNode`.

- [ ] **Step 3: Implement**

In `lib/graph.ts`, add to the imports from `./data`:

```ts
  BEAN_PREFIX, BEE_PREFIX, PLANT_PREFIX, POD_PREFIX, SPROUT_PREFIX,
  byDateDesc, parentsWithPrefix, resolveText,
  type PlantNature, type RawGarden, type Sprout, type Text,
```

and:

```ts
import { coverFor } from "./cover";
```

Add the field to `GraphNode`:

```ts
export interface GraphNode {
  id: string; // "plant:slug" | "pod:slug" | "bean:slug" | "sprout:slug" | "bee:slug"
  kind: "plant" | "pod" | "bean" | "sprout" | "bee";
  name: string; // resolved at serialization time (B1)
  description?: string; // resolved (B1); emitted only when non-blank (slice 2)
  // Beans only, derived (lib/cover.ts) — G1's withheld-media note pointed here.
  // A NARROWED view of the MediaImage: storageKey is a Cloudinary-internal id
  // with no meaning to a consumer, so it stays out of the public payload.
  cover?: { url: string; alt?: string; width?: number; height?: number };
  natures?: PlantNature[]; // plants only
  type?: string; // sprouts (sprout.type) and bees (bee.kind)
  date?: string; // sprouts only
  status?: string; // bees only
  tags?: string[]; // content kinds (never bees), only when non-empty
}
```

Inside `toGraph`, after the `const bees = raw.bees ?? [];` line, build the lookup:

```ts
  // Sprouts per bean, newest-first — the same ordering buildDataset guarantees
  // (byDateDesc, exported from lib/data.ts for exactly this), because that is
  // the ordering coverFor documents that it expects. toGraph serializes a
  // RawGarden and has no Dataset to borrow it from.
  const sproutsByBean = new Map<string, Sprout[]>();
  for (const sprout of sprouts) {
    for (const slug of parentsWithPrefix(sprout.parents, BEAN_PREFIX)) {
      const list = sproutsByBean.get(slug) ?? [];
      list.push(sprout);
      sproutsByBean.set(slug, list);
    }
  }
  for (const list of sproutsByBean.values()) list.sort(byDateDesc);

  const beanCover = (slug: string): Pick<GraphNode, "cover"> => {
    const cover = coverFor(sproutsByBean.get(slug) ?? []);
    if (!cover) return {};
    return {
      cover: {
        url: cover.url,
        ...(cover.alt ? { alt: cover.alt } : {}),
        ...(typeof cover.width === "number" ? { width: cover.width } : {}),
        ...(typeof cover.height === "number" ? { height: cover.height } : {}),
      },
    };
  };
```

Then change the bean node line to fold it in:

```ts
    ...beans.map((a) =>
      decorate(
        { id: BEAN_PREFIX + a.slug, kind: "bean" as const, name: resolveText(a.name), ...beanCover(a.slug) },
        a,
      ),
    ),
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --import tsx --test lib/graph.test.ts`
Expected: PASS — the new tests plus every pre-existing one (node ordering and edge derivation are untouched).

- [ ] **Step 5: Commit**

```bash
git add lib/graph.ts lib/graph.test.ts
git commit -m "Media: bean nodes carry a cover in the graph payload"
```

---

## Task 11: Roadmap

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Close both entries**

Under **B2**, append to its *Explanation*:

```markdown
    *Status:* **shipped 2026-08-23** — the capture bar and `/admin/sprout/[slug]` both carry the
    media picker, uploads go through `uploadImageAction`, and the editor's `/image` command inserts
    a picture into an article. The picker is the second deliberate client-JS island (`CLAUDE.md`),
    bounded by the rule that it renders nothing until it mounts and no capture ever depends on it.
    Also fixed a latent Cloudinary defect this slice would have triggered: `public_id` was derived
    from the filename, so two same-named uploads silently replaced each other.
```

Under **B3**, append to its *Status*:

```markdown
    **The media half closed 2026-08-23**, and B3 with it. `media[]` renders on `/bean/[id]`:
    images as images, derivable embeds as players (youtube, vimeo, soundcloud, spotify, deezer),
    ausha and figma as link cards until their embed contracts can be verified against real content.
    Host matching hardened from substring to exact — `vimeo.com.evil.test` no longer detects as
    vimeo — and the provider is now DERIVED from the URL rather than accepted from a payload, which
    was the same hole one door over. A `frame-src`-only CSP (the repo's first) is generated from
    the same allowlist `lib/embed-src.ts` builds URLs from, so the two cannot drift. The cover
    convention landed derived, as specced: `coverFor` scans newest-first for the first sprout
    carrying an image, and the Directory, entity cards and `/api/graph` bean nodes all consume it —
    reversing G1's withholding, which had pointed at exactly this. **D1's dependency is satisfied.**
```

In the closing runway paragraph, replace the sentence naming B2 and B3 as remaining with:

```markdown
With A2, G1, B1, G2, B2 and B3 shipped, **D1 — the graph playground — is unblocked**: the graph
payload now carries name, description and cover for every public node, which is what a focused node
needs to show.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "Docs: close B2 and B3; D1 is unblocked"
```

---

## Task 12: Verification and the PR

- [ ] **Step 1: Full gate**

Run: `npm test && npm run build`
Expected: all tests pass, build clean. **Record the actual counts** — do not claim a pass you have not read.

- [ ] **Step 2: Hands-on, against a scratch database**

`.env.local` points at the **production** database. Never write to `beanstalk`.

```bash
MONGODB_DB=media_scratch \
ADMIN_PASSWORD=scratch-pass \
ADMIN_SESSION_SECRET=scratch-secret-scratch-secret \
CLOUDINARY_FOLDER=beanstalk/scratch \
npx next dev
```

Walk through:
1. Create a bean with a published sprout carrying: an uploaded image, a YouTube link, a SoundCloud link, a Figma link, and a plain link.
2. `/bean/<slug>` — confirm the image renders, YouTube and SoundCloud render as **players**, and Figma and the plain link render as **link cards**.
3. Open devtools and confirm **no CSP violation** is logged for the two players.
4. Add a sprout whose media is `https://vimeo.com.evil.test/123`. Confirm it renders as a **link card**, never an iframe.
5. `/` (Directory) — confirm the bean shows its cover thumbnail.
6. `/api/graph` — confirm the bean node carries `cover` with a `url` and **no `storageKey`**.
7. Reorder the sprout's media so a different image is first; reload the Directory and confirm the cover followed.

- [ ] **Step 3: Clean up**

Drop the scratch database, and delete the `beanstalk/scratch` folder from Cloudinary.

- [ ] **Step 4: Open the PR**

Requires a Lab Note (`CLAUDE.md`) — this is visitor-facing. Suggested body section:

````markdown
## Lab Note

```yaml
en:
  title: The work, actually shown
  summary: Pieces can finally show their pictures and play their music — tracks and videos now play right on the page instead of hiding behind a link, and each piece leads with its own image.
fr:
  title: Le travail, enfin visible
  summary: Les projets montrent enfin leurs images et font entendre leur musique — les morceaux et les vidéos se lisent directement sur la page, et chaque projet s'ouvre sur sa propre image.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
````

---

## Notes for the implementer

- **Tasks 1 and 2 are one idea in two places.** Do not ship the rendering without both: `embedSrc` trusts `provider` completely, and that trust is only earned by exact host matching *and* server-side derivation.
- **`embedSrc` returning `null` is the normal path**, not a failure. Ausha, Figma and every `link` take it on every render.
- **Do not hand-copy the CSP host list.** If the `next.config.ts` import fails, extract the constant to its own dependency-free module — Task 4 Step 2 says how.
- **`coverFor` does not sort.** Ordering is the caller's contract, exactly as with `articleFor`. Task 10 sorts explicitly because it has a `RawGarden` rather than a `Dataset`.
