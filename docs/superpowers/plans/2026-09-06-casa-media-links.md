# CASA Gallery & Platform Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both CASA Podcast episodes their Instagram carousels as a swipeable gallery and a row of listen-everywhere links, by adding a `links[]` field distinct from `media[]` and a run-grouping rule in `MediaList`.

**Architecture:** Three independent additions plus content. (1) `lib/platforms.ts` becomes the sole authority on what a platform is, deriving `platform` from a URL host and stripping tracking tokens; `PlatformLink[]` lands on `Plant` and `Sprout`. (2) `MediaList` chunks `media[]` into consecutive runs and renders a run of ≥2 images as one CSS scroll-snap strip — no new field, no client JS. (3) Instagram joins the framable providers. Content arrives through `data/garden.yml` (links, derived at migrate) and a one-off upload script (images).

**Tech Stack:** Next.js 15 / React 19 / TypeScript, MongoDB, Cloudinary, Tailwind v4, `node:test` + `tsx`.

**Spec:** [`docs/superpowers/specs/2026-09-06-casa-media-links-design.md`](../specs/2026-09-06-casa-media-links-design.md)

---

## File Structure

**Create:**
- `lib/platforms.ts` — host→platform table, `detectPlatform`, `normalizeLinkUrl`, `normalizeLinks`, `platformLabel`. The one place a platform is decided.
- `lib/platforms.test.ts`
- `lib/media-runs.ts` — pure chunking of `Media[]` into runs. Nothing else.
- `lib/media-runs.test.ts`
- `components/link-row.tsx` — server-safe chip row for `PlatformLink[]`.
- `components/link-row.test.tsx`
- `scripts/import-casa-media.ts` — one-off Cloudinary upload + `media[]` write.

**Modify:**
- `lib/data.ts` — `PlatformLink`, `Plant.links`, `Sprout.links`, one `filterPublic` comment.
- `lib/data.test.ts` — `links` survives `filterPublic`.
- `lib/embeds.ts` — instagram host row + `instagramId()`.
- `lib/embeds.test.ts` — instagram detection.
- `lib/embed-src.ts` — `"social"` aspect, instagram case, `EMBED_FRAME_HOSTS` entry.
- `lib/embed-src.test.ts` — the new origin.
- `components/media.tsx` — `Gallery`, run-grouped `MediaList`, `FRAME_BOX.social`.
- `components/media.test.tsx` — strip vs single, instagram origin.
- `app/(public)/(chrome)/plant/[slug]/page.tsx` — `<LinkRow>` under the head.
- `app/(public)/(chrome)/bean/[id]/page.tsx` — `<LinkRow>` in each sprout card.
- `scripts/migrate-garden.ts` — `linked()` derivation.
- `data/garden.yml` — the CASA links.
- `package.json` — `import:casa` script.

**Rename:**
- `lib/chrome-source.test.ts` → `lib/server-safe-source.test.ts`, generalized to a file list.

---

### Task 0: Branch

- [ ] **Step 1: Branch off main**

The two spec commits are already on `main` locally and unpushed. Move them onto a feature branch and restore `main` to the remote.

```bash
cd /Users/alexis/code/ariko
git checkout -b casa-gallery-links
git branch -f main origin/main
git status -sb
```

Expected: `## casa-gallery-links` with a clean tree; `git log --oneline -2` shows `15d76b4` and `75b42f1`.

---

### Task 1: `lib/platforms.ts`

**Files:**
- Create: `lib/platforms.ts`
- Test: `lib/platforms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/platforms.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectPlatform, normalizeLinkUrl, normalizeLinks, platformLabel } from "./platforms";

/**
 * The one place a platform is decided, pinned at both ends.
 *
 * `detectPlatform` matters for the same reason `lib/embeds.ts`'s host matching
 * does: `platform` is what indexes PLATFORM_LABEL and what a renderer trusts,
 * so a substring match would let "instagram.com.evil.test" wear Instagram's
 * name on a public page.
 *
 * `normalizeLinkUrl` is not hygiene. The real Instagram URL this slice was
 * built from carried `stkn=…`, Instagram's PRIVATE-SHARE token; storing it puts
 * a credential-ish value in the database and then serves it to the world.
 */

test("detectPlatform reads the host, exactly", () => {
  assert.equal(detectPlatform("https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI"), "spotify");
  assert.equal(detectPlatform("https://podcasts.apple.com/fr/podcast/casa-podcast/id1878359919"), "apple-podcasts");
  assert.equal(detectPlatform("https://www.deezer.com/fr/show/1002670521"), "deezer");
  assert.equal(detectPlatform("https://podcast.ausha.co/casa-podcast"), "ausha");
  assert.equal(detectPlatform("https://www.instagram.com/casa.lepodcast"), "instagram");
  assert.equal(detectPlatform("https://linktr.ee/casa.lepodcast"), "linktree");
});

test("detectPlatform matches a host or its subdomain, never a substring", () => {
  // The whole point. Each of these contains a known host as a substring.
  assert.equal(detectPlatform("https://instagram.com.evil.test/p/ABCDE/"), "link");
  assert.equal(detectPlatform("https://spotify.com.attacker.test/show/x"), "link");
  assert.equal(detectPlatform("https://notlinktr.ee/casa"), "link");
  // A real subdomain still matches.
  assert.equal(detectPlatform("https://podcast.ausha.co/x"), "ausha");
});

test("detectPlatform never throws, and an unknown host is `link`", () => {
  assert.equal(detectPlatform("not a url at all"), "link");
  assert.equal(detectPlatform(""), "link");
  assert.equal(detectPlatform("https://example.test/thing"), "link");
});

test("normalizeLinkUrl strips the share tokens and nothing else", () => {
  assert.equal(
    normalizeLinkUrl("https://www.instagram.com/p/DVAxzXvDNkZ/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA=="),
    "https://www.instagram.com/p/DVAxzXvDNkZ/",
  );
  assert.equal(
    normalizeLinkUrl("https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT?nd=1&dlsi=cbd39d46b8ec47a2"),
    "https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT",
  );
  assert.equal(
    normalizeLinkUrl("https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI?si=3a3ee7415b6941ad"),
    "https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI",
  );
  // Apple's `i` is the EPISODE ID — load-bearing, must survive.
  assert.equal(
    normalizeLinkUrl("https://podcasts.apple.com/fr/podcast/x/id1878359919?i=1000750486031&uo=4"),
    "https://podcasts.apple.com/fr/podcast/x/id1878359919?i=1000750486031&uo=4",
  );
  assert.equal(normalizeLinkUrl("https://example.test/a#frag"), "https://example.test/a");
  // Unparseable input comes back trimmed rather than throwing.
  assert.equal(normalizeLinkUrl("  nonsense  "), "nonsense");
});

test("normalizeLinks derives platform and cleans the url", () => {
  const out = normalizeLinks([
    { url: "https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI?si=abc" },
    // A caller's declared platform is DISCARDED, never trusted.
    { url: "https://linktr.ee/casa.lepodcast", platform: "spotify" },
  ]);
  assert.deepEqual(out, [
    { url: "https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI", platform: "spotify" },
    { url: "https://linktr.ee/casa.lepodcast", platform: "linktree" },
  ]);
});

test("normalizeLinks preserves a label and passes undefined through", () => {
  assert.equal(normalizeLinks(undefined), undefined);
  assert.deepEqual(normalizeLinks([{ url: "https://linktr.ee/x", label: { fr: "Tous les liens" } }]), [
    { url: "https://linktr.ee/x", label: { fr: "Tous les liens" }, platform: "linktree" },
  ]);
});

test("platformLabel is looked up, never derived", () => {
  assert.equal(platformLabel("apple-podcasts"), "Apple Podcasts");
  assert.equal(platformLabel("soundcloud"), "SoundCloud");
  // An unknown platform falls back to its raw slug rather than to a guess —
  // the same stance PROVIDER_LABEL takes in components/media.tsx.
  assert.equal(platformLabel("bandcamp"), "bandcamp");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -A3 "platforms"
```

Expected: FAIL — `Cannot find module './platforms'`.

- [ ] **Step 3: Write `lib/platforms.ts`**

```ts
import { hostMatches } from "./embeds";
import type { PlatformLink } from "./data";

/**
 * Where a thing can be found — the vocabulary, and the one place it is decided.
 *
 * This is NOT lib/embeds.ts's job and must not become it. That file's
 * HOST_PROVIDERS table decides what gets loaded into an IFRAME, and the file is
 * under a dependency-free constraint because next.config.ts imports
 * EMBED_FRAME_HOSTS while Next reads its config, before the app exists.
 * Widening that table so Linktree can have a chip would change framing
 * behaviour to gain a label. So: a second table, and exactly one import from
 * over there — `hostMatches`, because a host check with two implementations has
 * two behaviours.
 *
 * A `platform` string is only ever a member of PLATFORM_HOSTS' second column or
 * the literal "link". That is what makes PLATFORM_LABEL[platform] safe to
 * render, and it holds because `platform` is DERIVED here rather than accepted
 * from a caller — the rule lib/inbox.ts already applies to MediaEmbed.provider.
 */

// Host → platform. First match wins, exactly like HOST_PROVIDERS.
export const PLATFORM_HOSTS: Array<[string, string]> = [
  ["open.spotify.com", "spotify"],
  ["spotify.com", "spotify"],
  ["podcasts.apple.com", "apple-podcasts"],
  ["music.apple.com", "apple-podcasts"],
  ["deezer.com", "deezer"],
  ["ausha.co", "ausha"],
  ["instagram.com", "instagram"],
  ["linktr.ee", "linktree"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["soundcloud.com", "soundcloud"],
];

// Casing is looked up, never derived — "apple-podcasts" → "Apple Podcasts" is
// not a titlecase(). Same table shape and same fallback rule as
// components/media.tsx's PROVIDER_LABEL, for the same reason: an unknown
// platform shows its raw slug instead of a guess.
export const PLATFORM_LABEL: Record<string, string> = {
  spotify: "Spotify",
  "apple-podcasts": "Apple Podcasts",
  deezer: "Deezer",
  ausha: "Ausha",
  instagram: "Instagram",
  linktree: "Linktree",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

/**
 * Query parameters removed on write.
 *
 * `stkn` is the reason this function exists rather than a nicety: it is
 * Instagram's private-share token, and the URL that seeded this slice carried
 * one. Storing it would put a credential-ish value in the database and then
 * serve it on a public page.
 *
 * `si`, `nd` and `dlsi` are Spotify's share-attribution parameters. `utm_*` is
 * handled by prefix.
 *
 * Deliberately an ALLOW-everything-else list rather than a keep-list: Apple
 * Podcasts puts the episode id in `?i=`, so a keep-list would have to know
 * every platform's load-bearing parameter and would silently truncate the first
 * one it had not met.
 */
const STRIPPED_PARAMS = new Set(["stkn", "si", "nd", "dlsi"]);

export function normalizeLinkUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    // Never throws. An unparseable string is stored as typed — LinkRow will
    // render it as inert text rather than as an anchor (lib/url.ts).
    return url.trim();
  }
  // Snapshot the keys: deleting while iterating a URLSearchParams skips entries.
  for (const key of [...u.searchParams.keys()]) {
    if (STRIPPED_PARAMS.has(key) || key.startsWith("utm_")) u.searchParams.delete(key);
  }
  u.hash = "";
  return u.toString();
}

export function detectPlatform(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "link";
  }
  // hostMatches, not includes(): the whole point is that
  // "instagram.com.evil.test" is not Instagram.
  return PLATFORM_HOSTS.find(([h]) => hostMatches(host, h))?.[1] ?? "link";
}

/**
 * The write boundary. Every path that stores links goes through here, so a
 * stored URL is already clean and a stored `platform` is already derived —
 * nothing downstream re-normalizes, and nothing downstream has to.
 *
 * The input's own `platform`, if it has one, is overwritten rather than
 * respected. That is the point.
 */
export function normalizeLinks(
  links: Array<{ url: string } & Partial<PlatformLink>> | undefined,
): PlatformLink[] | undefined {
  if (!links) return undefined;
  return links.map((link) => {
    const url = normalizeLinkUrl(link.url);
    return { ...link, url, platform: detectPlatform(url) };
  });
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test 2>&1 | tail -20
```

Expected: PASS. (`PlatformLink` does not exist yet — Task 2 adds it. If `tsc` is run before Task 2 it will fail; `npm test` does not typecheck, so this passes. Do not skip Task 2.)

- [ ] **Step 5: Commit**

```bash
git add lib/platforms.ts lib/platforms.test.ts
git commit -m "Add lib/platforms.ts — the one place a platform is decided

detectPlatform matches hosts exactly rather than by substring, and
normalizeLinkUrl strips Instagram's stkn private-share token along with
Spotify's share attribution, at the write boundary rather than at render."
```

---

### Task 2: `PlatformLink` on `Plant` and `Sprout`

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/data.test.ts` does not import `filterPublic` yet — add it to the existing
import list (alphabetical, between `composeText` and `getDataset`):

```ts
  filterPublic,
```

Then append the test:

```ts
test("filterPublic keeps links on a public plant and drops them with a private one", () => {
  const raw = {
    plants: [
      {
        slug: "casa",
        name: "CASA Podcast",
        natures: ["work" as const],
        role: { kind: "owner" as const },
        description: "A podcast",
        links: [{ platform: "spotify", url: "https://open.spotify.com/show/abc" }],
      },
      {
        slug: "hidden",
        name: "Hidden",
        natures: ["work" as const],
        role: { kind: "owner" as const },
        description: "Nope",
        visibility: "private" as const,
        links: [{ platform: "spotify", url: "https://open.spotify.com/show/secret" }],
      },
    ],
  };

  const out = filterPublic(raw);

  assert.equal(out.plants?.length, 1);
  // PlatformLink carries no entity refs, so there is nothing to scrub — the
  // array must survive intact rather than be dropped defensively.
  assert.deepEqual(out.plants?.[0].links, [
    { platform: "spotify", url: "https://open.spotify.com/show/abc" },
  ]);
  // And the private plant takes its links with it.
  assert.equal(JSON.stringify(out).includes("secret"), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -B2 -A8 "filterPublic keeps links"
```

Expected: FAIL — TypeScript is not checked by the runner, but the assertion on `out.plants?.[0].links` returns `undefined` only if the field is stripped; more usefully, `npx tsc --noEmit` fails with `'links' does not exist in type 'Plant'`. Run both:

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: an error naming `links`.

- [ ] **Step 3: Add the type and the two fields**

In `lib/data.ts`, immediately after the `Media` union (around line 28), insert:

```ts
/**
 * Where a thing can be found ELSEWHERE — a destination, not an asset.
 *
 * Deliberately not part of `Media`, and `links[]` is deliberately not `media[]`.
 * `media[]` means assets rendered in the body: an image, or a player framed
 * inline. A "Listen on Apple Podcasts" URL is neither, and putting it in the
 * same array would make it indistinguishable from a Spotify episode URL that
 * genuinely IS meant to become a 152px player — with the only thing separating
 * them being a rule living in a renderer's control flow.
 *
 * They also sit at different levels, which one array cannot express: the show's
 * platform row belongs to the Plant, each episode's to its Sprout.
 *
 * `platform` is DERIVED server-side from the URL host (lib/platforms.ts) and a
 * caller's declared value is discarded — the rule lib/inbox.ts already applies
 * to MediaEmbed.provider. It is what indexes PLATFORM_LABEL, so it may only
 * ever be a member of that vocabulary or the literal "link".
 */
export interface PlatformLink {
  platform: string; // spotify | apple-podcasts | deezer | ausha | instagram | linktree | link
  url: string;
  label?: Text; // bilingual override; the platform's own name otherwise
}
```

In `interface Plant`, after the `logo?: MediaImage;` block, add:

```ts
  // Where the plant can be found off-site. NOT `media` — see PlatformLink.
  // A plant has `logo` (one image) and no assets array at all, and inventing
  // one so that six URLs have somewhere to sit would be giving it a body it
  // does not have.
  links?: PlatformLink[];
```

In `interface Sprout`, immediately after `media?: Media[];`, add:

```ts
  links?: PlatformLink[]; // destinations, never rendered inline — see PlatformLink
```

In `filterPublic`, directly above `const plants = keptPlants.map((p) => scrubRelations(p, refSurvives));`, add:

```ts
  // `links` needs no scrub and gets none. PlatformLink holds a URL, a derived
  // platform word and an optional label — no entity refs — so there is nothing
  // in it that could name a private slug. Same property PlantRole has, stated
  // for the same reason: the ABSENCE of a scrub should read as a conclusion
  // someone reached, not as a line someone forgot.
```

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test 2>&1 | tail -5 && npx tsc --noEmit && echo TSC-OK
```

Expected: tests PASS, `TSC-OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/data.test.ts
git commit -m "Add PlatformLink, and links[] on Plant and Sprout

A destination is not an asset: media[] is what renders in the body, and
mixing a listen-on URL into it would leave a renderer guessing. Carries no
entity refs, so filterPublic needs no scrub — stated rather than omitted."
```

---

### Task 3: `lib/media-runs.ts`

**Files:**
- Create: `lib/media-runs.ts`
- Test: `lib/media-runs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/media-runs.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { mediaRuns } from "./media-runs";
import type { Media } from "./data";

/**
 * The gallery's whole decision, isolated from any markup.
 *
 * Pure here and thin in the component, the way lib/toc.ts holds the arithmetic
 * and components/toc-rail.tsx holds the DOM — so a grouping bug and a layout
 * bug are not diagnosed through the same surface.
 *
 * The threshold is TWO, and the one-image case is the load-bearing one: it must
 * come back as a `single`, because that is what keeps every existing sprout's
 * markup byte-for-byte unchanged by this slice.
 */

const img = (n: number): Media => ({ kind: "image", storageKey: `k${n}`, url: `https://cdn.test/${n}.jpg` });
const embed = (n: number): Media => ({ kind: "embed", provider: "spotify", url: `https://open.spotify.com/episode/${n}` });

test("two or more adjacent images become one gallery", () => {
  assert.deepEqual(mediaRuns([img(1), img(2), img(3)]), [
    { kind: "gallery", images: [img(1), img(2), img(3)] },
  ]);
});

test("a lone image stays a single — today's markup, unchanged", () => {
  assert.deepEqual(mediaRuns([img(1)]), [{ kind: "single", item: img(1) }]);
});

test("embeds are never grouped, however many are adjacent", () => {
  assert.deepEqual(mediaRuns([embed(1), embed(2)]), [
    { kind: "single", item: embed(1) },
    { kind: "single", item: embed(2) },
  ]);
});

test("a run is broken by an embed, and both sides group independently", () => {
  assert.deepEqual(mediaRuns([img(1), img(2), embed(1), img(3), img(4)]), [
    { kind: "gallery", images: [img(1), img(2)] },
    { kind: "single", item: embed(1) },
    { kind: "gallery", images: [img(3), img(4)] },
  ]);
});

test("the CASA episode 1 shape: two embeds, then six slides", () => {
  const runs = mediaRuns([embed(1), embed(2), img(1), img(2), img(3), img(4), img(5), img(6)]);
  assert.equal(runs.length, 3);
  assert.equal(runs[0].kind, "single");
  assert.equal(runs[1].kind, "single");
  assert.deepEqual(runs[2], { kind: "gallery", images: [img(1), img(2), img(3), img(4), img(5), img(6)] });
});

test("order is preserved and nothing is dropped", () => {
  const input = [img(1), embed(1), img(2), img(3)];
  const flat = mediaRuns(input).flatMap((r) => (r.kind === "gallery" ? r.images : [r.item]));
  assert.deepEqual(flat, input);
});

test("an empty list yields no runs", () => {
  assert.deepEqual(mediaRuns([]), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -A3 "media-runs"
```

Expected: FAIL — `Cannot find module './media-runs'`.

- [ ] **Step 3: Write `lib/media-runs.ts`**

```ts
import type { Media, MediaImage } from "./data";

/**
 * How `media[]` is grouped for rendering — and the whole of the gallery's
 * decision, kept out of the markup.
 *
 * A set of images is a set. Six 1080×1350 Instagram slides rendered one per
 * row, full width, is six screens of scroll before the reader reaches anything
 * else — so consecutive images collapse into ONE strip that the reader swipes.
 *
 * No new field was needed for that, and that is the point: adjacency in
 * `media[]` already carries the author's intent, so a `gallery: true` flag
 * would be a second source of truth for something the array already says.
 *
 * THE THRESHOLD IS TWO, and the one-image case is load-bearing rather than an
 * edge case: a lone image comes back as a `single` and renders through exactly
 * the markup it always did. That is what makes this change unable to alter any
 * existing page — the only rows affected are rows with an adjacent pair, and
 * before this slice nothing authored one.
 */

export type MediaRun =
  | { kind: "gallery"; images: MediaImage[] }
  | { kind: "single"; item: Media };

export function mediaRuns(media: Media[]): MediaRun[] {
  const runs: MediaRun[] = [];
  let pending: MediaImage[] = [];

  const flush = () => {
    if (pending.length >= 2) runs.push({ kind: "gallery", images: pending });
    else if (pending.length === 1) runs.push({ kind: "single", item: pending[0] });
    pending = [];
  };

  for (const item of media) {
    if (item.kind === "image") {
      pending.push(item);
      continue;
    }
    flush();
    runs.push({ kind: "single", item });
  }
  flush();

  return runs;
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test 2>&1 | tail -10 && npx tsc --noEmit && echo TSC-OK
```

Expected: PASS, `TSC-OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/media-runs.ts lib/media-runs.test.ts
git commit -m "Group consecutive images into runs

Adjacency in media[] already carries the intent, so no gallery flag is
needed. The threshold is two: a lone image stays a single, which is what
keeps every existing sprout's markup unchanged."
```

---

### Task 4: The scroll-snap strip in `MediaList`

**Files:**
- Modify: `components/media.tsx`
- Test: `components/media.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `components/media.test.tsx`:

```ts
test("two adjacent images render as one snap strip, inside one list item", () => {
  const markup = html([
    { kind: "image", storageKey: "a", url: "https://cdn.test/a.jpg", width: 1080, height: 1350 },
    { kind: "image", storageKey: "b", url: "https://cdn.test/b.jpg", width: 1080, height: 1350 },
  ]);

  // One <li>, not two — the strip is a single item in the media list.
  assert.equal(markup.match(/<li\b/g)?.length, 1);
  // The strip's own affordances: horizontal snap, and reachable by keyboard
  // without a line of script.
  assert.match(markup, /snap-x/);
  assert.match(markup, /snap-mandatory/);
  assert.match(markup, /overflow-x-auto/);
  assert.match(markup, /tabindex="0"/i);
  assert.match(markup, /aria-label="[^"]*2[^"]*"/);
  // Both images are still there, in order.
  const srcs = attrs(markup, "img", "src");
  assert.deepEqual(srcs, ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"]);
});

test("a lone image renders exactly the markup it always did", () => {
  const markup = html([
    { kind: "image", storageKey: "a", url: "https://cdn.test/a.jpg", width: 1080, height: 1350 },
  ]);

  assert.equal(markup.match(/<li\b/g)?.length, 1);
  // No strip: this is the guarantee that nothing already published moves.
  assert.doesNotMatch(markup, /snap-x/);
  assert.doesNotMatch(markup, /tabindex/i);
  assert.match(markup, /src="https:\/\/cdn\.test\/a\.jpg"/);
});

test("an embed between two runs keeps its own row", () => {
  const markup = html([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT" },
    { kind: "image", storageKey: "a", url: "https://cdn.test/a.jpg" },
    { kind: "image", storageKey: "b", url: "https://cdn.test/b.jpg" },
  ]);

  // Two rows: the player, then the strip.
  assert.equal(markup.match(/<li\b/g)?.length, 2);
  assert.equal(attrs(markup, "iframe", "src").length, 1);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -A6 "snap strip"
```

Expected: FAIL — two `<li>` found where one was expected, and no `snap-x` in the markup.

- [ ] **Step 3: Add `Gallery` and rewrite `MediaList`**

In `components/media.tsx`, extend the type import on line 1:

```tsx
import type { Media, MediaEmbed, MediaImage } from "@/lib/data";
```

and add, below it:

```tsx
import { mediaRuns } from "@/lib/media-runs";
```

Then replace the whole existing `MediaList` export (the last function in the file) with:

```tsx
/**
 * A run of images, as one horizontally swipeable strip.
 *
 * CSS only — `overflow-x-auto` plus scroll snapping. There is no carousel
 * script here, no dots and no arrows, so there is nothing that stops working
 * without JavaScript: the strip scrolls with a finger, a trackpad, a scrollbar,
 * or the arrow keys once it has focus. That is the whole reason this is a strip
 * rather than a slideshow — a slideshow in the public zone would be its first
 * client island, bought for an affordance the browser already has.
 *
 * `tabIndex={0}` is what makes the keyboard case true. A scroll container is
 * not focusable by default, so without it the arrow keys reach nothing and the
 * slides past the first are unreachable to anyone not using a pointer.
 *
 * The slides keep their stored width/height through MediaItem, so each box is
 * reserved before the bytes land and the row does not reflow as images arrive.
 */
function Gallery({ images }: { images: MediaImage[] }) {
  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`Gallery, ${images.length} images`}
      // -mx-1/px-1 so a focus ring on the strip is not clipped by its own
      // overflow; pb-2 leaves room for the scrollbar rather than over the image.
      className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
    >
      {images.map((image, i) => (
        <div key={`${i}-${image.url}`} className="w-[min(78vw,22rem)] shrink-0 snap-start">
          <MediaItem media={image} />
        </div>
      ))}
    </div>
  );
}

export function MediaList({ media }: { media?: Media[] }) {
  if (!media || media.length === 0) return null;
  // Adjacent images collapse into one strip; everything else — including a
  // lone image — renders exactly as it did before this slice. See
  // lib/media-runs.ts for why the threshold is two.
  const runs = mediaRuns(media);
  return (
    <ul className="not-prose flex flex-col gap-3">
      {runs.map((run, i) =>
        run.kind === "gallery" ? (
          <li key={`gallery-${i}`}>
            <Gallery images={run.images} />
          </li>
        ) : (
          // The index is the only part guaranteeing uniqueness — nothing dedupes
          // media[], so the same url can legitimately appear twice. Safe here
          // because the list is server-rendered, stateless and never mutated
          // client-side.
          <li key={`${run.item.kind}-${i}-${run.item.url}`}>
            <MediaItem media={run.item} />
          </li>
        ),
      )}
    </ul>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test 2>&1 | tail -10 && npx tsc --noEmit && echo TSC-OK
```

Expected: PASS (including every pre-existing `media.test.tsx` test), `TSC-OK`.

- [ ] **Step 5: Commit**

```bash
git add components/media.tsx components/media.test.tsx
git commit -m "Render an image run as a CSS scroll-snap strip

Six portrait slides stacked full-width is six screens of scroll. The strip
is overflow plus snap points and nothing else — no carousel script, so
nothing here stops working without JavaScript. tabIndex makes the arrow
keys reach the slides past the first."
```

---

### Task 5: Instagram detection in `lib/embeds.ts`

**Files:**
- Modify: `lib/embeds.ts`
- Test: `lib/embeds.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/embeds.test.ts`:

```ts
test("an Instagram post detects with its shortcode", () => {
  assert.deepEqual(detectEmbed("https://www.instagram.com/p/DVAxzXvDNkZ/"), {
    kind: "embed",
    provider: "instagram",
    url: "https://www.instagram.com/p/DVAxzXvDNkZ/",
    embedId: "DVAxzXvDNkZ",
  });
});

test("reels and tv posts carry a shortcode too", () => {
  assert.equal(detectEmbed("https://www.instagram.com/reel/ABC123xyz_/").embedId, "ABC123xyz_");
  assert.equal(detectEmbed("https://instagram.com/tv/ABC123xyz-/").embedId, "ABC123xyz-");
});

test("an Instagram URL with no post degrades to a link card", () => {
  // A profile is a destination, not a post. Provider yes, embedId no — which
  // is what makes embedSrc return null and the renderer fall back.
  const profile = detectEmbed("https://www.instagram.com/casa.lepodcast");
  assert.equal(profile.provider, "instagram");
  assert.equal(profile.embedId, undefined);
});

test("a shortcode that is not a shortcode yields no embedId", () => {
  // Validated HERE rather than escaped at the point of use — the discipline
  // YOUTUBE_ID records. A bad code degrades to a link card instead of building
  // a URL on a trusted host out of arbitrary stored text.
  assert.equal(detectEmbed("https://www.instagram.com/p/../../etc/passwd").embedId, undefined);
  assert.equal(detectEmbed("https://www.instagram.com/p/ab/").embedId, undefined);
  assert.equal(detectEmbed(`https://www.instagram.com/p/${"x".repeat(64)}/`).embedId, undefined);
});

test("an instagram-lookalike host is not Instagram", () => {
  assert.equal(detectEmbed("https://instagram.com.evil.test/p/DVAxzXvDNkZ/").provider, "link");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -A5 "Instagram post detects"
```

Expected: FAIL — provider is `"link"`, not `"instagram"`.

- [ ] **Step 3: Add the host row and the extractor**

In `lib/embeds.ts`, add to `HOST_PROVIDERS` after the `figma` row:

```ts
  ["instagram.com", "instagram"],
```

Add, immediately above `detectEmbed`:

```ts
// Instagram shortcodes are base64url-ish and about 11 characters; the bound is
// generous enough to survive a format change while still meaning "a code".
// Validated HERE rather than escaped at the point of use, exactly as YOUTUBE_ID
// is: this is what stops a stored path traversal from ever reaching the URL
// that lib/embed-src.ts builds.
const INSTAGRAM_ID = /^[A-Za-z0-9_-]{5,32}$/;

// Anchored on the keyword rather than positional. All three post forms are
// /{keyword}/{shortcode}/ — a profile (/casa.lepodcast) has no keyword and so
// no id, which is the correct answer: a profile is a destination, not a post,
// and it degrades to a link card.
function instagramId(url: string): string | undefined {
  let parts: string[];
  try {
    parts = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return undefined;
  }
  const anchor = parts.findIndex((s) => s === "p" || s === "reel" || s === "tv");
  if (anchor === -1) return undefined;
  const candidate = parts[anchor + 1];
  return candidate && INSTAGRAM_ID.test(candidate) ? candidate : undefined;
}
```

And in `detectEmbed`, extend the id chain:

```ts
  let embedId: string | undefined;
  if (provider === "youtube") embedId = youtubeId(url);
  else if (provider === "vimeo") embedId = vimeoId(url);
  else if (provider === "instagram") embedId = instagramId(url);
```

- [ ] **Step 4: Keep the probe table complete**

`lib/embed-src.test.ts` holds a `PROBE` record keyed by provider, and a test
iterates `HOST_PROVIDERS` asserting every provider has an entry — so adding a
host row here breaks a test in **that** file until the row is added. Add to
`PROBE`, beside `ausha` and `figma`:

```ts
  // Detected but not framed — a link card by decision, for now. Task 6 gives
  // it a real probe URL when embedSrc learns to frame it.
  instagram: null,
```

Deliberately `null` rather than the real URL: at this point in the sequence
instagram genuinely IS a link card, because nothing frames it yet. A probe URL
here would make `framedOrigins()` assert a frame that does not exist.

- [ ] **Step 5: Run the tests**

```bash
npm test 2>&1 | tail -10
```

Expected: PASS, including `every detectable provider has a probe url`.

- [ ] **Step 6: Commit**

```bash
git add lib/embeds.ts lib/embeds.test.ts lib/embed-src.test.ts
git commit -m "Detect Instagram posts, reels and tv

Anchored on the keyword, so a profile URL yields a provider but no
embedId and degrades to a link card. The shortcode is charset-validated
here, which is what keeps a traversal out of the URL embed-src builds."
```

---

### Task 6: Framing Instagram

**Files:**
- Modify: `lib/embed-src.ts`, `components/media.tsx`
- Test: `lib/embed-src.test.ts`, `components/media.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `lib/embed-src.test.ts`:

```ts
test("an Instagram post frames on instagram.com, and only with a valid id", () => {
  const frame = embedSrc({
    kind: "embed",
    provider: "instagram",
    url: "https://www.instagram.com/p/DVAxzXvDNkZ/",
    embedId: "DVAxzXvDNkZ",
  });
  assert.deepEqual(frame, {
    src: "https://www.instagram.com/p/DVAxzXvDNkZ/embed",
    title: "Instagram post",
    aspect: "social",
  });

  // No id, no frame — a profile URL becomes a link card, not a broken iframe.
  assert.equal(
    embedSrc({ kind: "embed", provider: "instagram", url: "https://www.instagram.com/casa.lepodcast" }),
    null,
  );
});

test("a forged Instagram embedId cannot leave the allowlisted origin", () => {
  // encodeURIComponent flattens a traversal into one escaped path segment. The
  // origin is a literal in every branch, so the worst a forged row produces is
  // the WRONG post on instagram.com — never an unallowlisted host.
  const frame = embedSrc({
    kind: "embed",
    provider: "instagram",
    url: "https://www.instagram.com/p/x/",
    embedId: "../../evil.test/x",
  });
  assert.ok(frame);
  assert.equal(new URL(frame.src).origin, "https://www.instagram.com");
});

test("EMBED_FRAME_HOSTS carries instagram", () => {
  assert.ok((EMBED_FRAME_HOSTS as readonly string[]).includes("https://www.instagram.com"));
});
```

And flip the `PROBE` entry Task 5 left as `null` to the real URL, so the two
correspondence tests below it start covering instagram in both directions:

```ts
  instagram: "https://www.instagram.com/p/DVAxzXvDNkZ/",
```

That is the point of those tests. `every host embedSrc can emit is in
EMBED_FRAME_HOSTS` now reaches instagram's origin, and its mirror — `every
allowlisted host is actually reachable` — is what would have caught the new
`EMBED_FRAME_HOSTS` entry if the switch case had been forgotten.

Append to `components/media.test.tsx`:

```ts
test("a forged instagram row renders on instagram.com and nowhere else", () => {
  const markup = html([
    { kind: "embed", provider: "instagram", url: "https://evil.test/x", embedId: "DVAxzXvDNkZ" },
  ]);
  const srcs = attrs(markup, "iframe", "src");
  assert.equal(srcs.length, 1);
  assert.equal(new URL(srcs[0]).origin, "https://www.instagram.com");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -A5 "Instagram post frames"
```

Expected: FAIL — `embedSrc` returns `null` for provider `instagram`, and
`framedOrigins()` throws `instagram: … should frame`.

- [ ] **Step 3: Widen the aspect, the host list and the switch**

In `lib/embed-src.ts`:

Extend the `aspect` doc comment and union in `EmbedFrame`:

```ts
  /**
   * The frame's shape. "video" is 16:9. The two audio values differ because
   * the providers' own widgets do: Spotify renders a track or episode at 152px
   * and an album, playlist, show or artist at 352px; SoundCloud a single track
   * at 166px and a set at 450px; Deezer a track at ~150px and an album or
   * playlist at ~350px, where it draws a scrollable tracklist. "social" is
   * Instagram's post card — a 4:5 carousel plus its header and action bar.
   *
   * Decided HERE because this is the only place the media's type is known — by
   * the time components/media.tsx has a frame, the type is gone. When it cannot
   * be determined, prefer the taller value: clipping loses content, padding
   * only loses whitespace.
   */
  aspect: "video" | "audio" | "audio-list" | "social";
```

Add the origin to `EMBED_FRAME_HOSTS`:

```ts
export const EMBED_FRAME_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://w.soundcloud.com",
  "https://open.spotify.com",
  "https://widget.deezer.com",
  "https://www.instagram.com",
] as const;
```

Add the case to `embedSrc`, after the `deezer` case:

```ts
    case "instagram":
      // An explicit title rather than the `${provider} player` default: this is
      // a post, not a player, and the iframe's accessible name should say so.
      return media.embedId
        ? {
            src: `https://www.instagram.com/p/${encodeURIComponent(media.embedId)}/embed`,
            title: "Instagram post",
            aspect: "social",
          }
        : null;
```

- [ ] **Step 4: Run tests and watch `FRAME_BOX` fail the typecheck**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: an error on `FRAME_BOX` in `components/media.tsx` — `Property 'social' is missing`. **This is the intended guard**: `FRAME_BOX` is typed `Record<EmbedFrame["aspect"], string>` precisely so a new aspect cannot silently inherit the 166px audio box.

- [ ] **Step 5: Give the new aspect its box**

In `components/media.tsx`, add to `FRAME_BOX`:

```ts
  // Instagram's post card: a 4:5 carousel plus its header and action bar. The
  // taller end, by the same rule as the audio boxes — clipping loses content,
  // padding only loses whitespace.
  social: "h-[720px] w-full",
```

- [ ] **Step 6: Run everything**

```bash
npm test 2>&1 | tail -10 && npx tsc --noEmit && echo TSC-OK
```

Expected: PASS, `TSC-OK`.

- [ ] **Step 7: Verify the CSP picked it up automatically**

```bash
grep -n "EMBED_FRAME_HOSTS" next.config.ts
```

Expected: the existing `frame-src` line. **No edit to `next.config.ts`** — the policy is built from the array, which is the point.

- [ ] **Step 8: Commit**

```bash
git add lib/embed-src.ts lib/embed-src.test.ts components/media.tsx components/media.test.tsx
git commit -m "Frame Instagram posts

The id goes through encodeURIComponent and the origin is a literal, so a
forged row yields the wrong post on instagram.com rather than an
unallowlisted host. The new 'social' aspect failed the build until
FRAME_BOX named its height — which is why that record is typed."
```

---

### Task 7: `components/link-row.tsx`

**Files:**
- Create: `components/link-row.tsx`
- Test: `components/link-row.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/link-row.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { LinkRow } from "./link-row";
import type { PlatformLink } from "@/lib/data";

/**
 * renderToStaticMarkup, no jsdom — the same route components/media.test.tsx
 * takes, and for the same reason: this component is server-only by design and
 * the static markup IS its output.
 */

const html = (links?: PlatformLink[], lang: "en" | "fr" = "en") =>
  renderToStaticMarkup(<LinkRow links={links} lang={lang} />);

const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

test("no links renders nothing at all", () => {
  assert.equal(html(undefined), "");
  assert.equal(html([]), "");
});

test("each link is an anchor carrying its platform's name", () => {
  const markup = html([
    { platform: "spotify", url: "https://open.spotify.com/show/abc" },
    { platform: "apple-podcasts", url: "https://podcasts.apple.com/fr/podcast/x/id1" },
  ]);
  assert.match(markup, /href="https:\/\/open\.spotify\.com\/show\/abc"/);
  assert.match(markup, /href="https:\/\/podcasts\.apple\.com\/fr\/podcast\/x\/id1"/);
  assert.match(text(markup), /Spotify/);
  assert.match(text(markup), /Apple Podcasts/);
});

test("every anchor opens safely, and says so", () => {
  const markup = html([{ platform: "deezer", url: "https://www.deezer.com/fr/show/1" }]);
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /rel="noopener noreferrer"/);
  // The announcement components/media.tsx established as this zone's
  // convention when it opened the repo's first new tab.
  assert.match(text(markup), /\(opens in a new tab\)/);
});

test("a label overrides the platform name, in the reading language", () => {
  const links: PlatformLink[] = [
    { platform: "linktree", url: "https://linktr.ee/x", label: { en: "All the links", fr: "Tous les liens" } },
  ];
  assert.match(text(html(links, "fr")), /Tous les liens/);
  assert.match(text(html(links, "en")), /All the links/);
});

test("a non-http url renders as inert text, never as an anchor", () => {
  // lib/url.ts's rule: still visible, still copyable, simply not clickable.
  const markup = html([{ platform: "link", url: "javascript:alert(1)" }]);
  assert.doesNotMatch(markup, /<a\b/);
  assert.match(text(markup), /link/);
});

test("an unknown platform shows its slug rather than a guess", () => {
  assert.match(text(html([{ platform: "bandcamp", url: "https://bandcamp.test/x" }])), /bandcamp/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | grep -A3 "link-row"
```

Expected: FAIL — `Cannot find module './link-row'`.

- [ ] **Step 3: Write `components/link-row.tsx`**

```tsx
import { resolveText, type PlatformLink } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { platformLabel } from "@/lib/platforms";
// Shared, not local — lib/url.ts records why an href is guarded and an <img src>
// deliberately is not.
import { isHttpUrl } from "@/lib/url";

/**
 * Where a thing can be found — a row of destinations.
 *
 * A SERVER component, and it must stay one. `lib/server-safe-source.test.ts`
 * enforces the two rules that make that true, because a violation passes tsc,
 * npm test AND npm run build: no `"use client"`, and no `lucide-react` (which
 * routes every icon through an Icon.mjs carrying the directive, so one import
 * is one client boundary in a zone whose whole rule is that it has none).
 *
 * TEXT CHIPS, NO BRAND MARKS, and that is a decision rather than a gap.
 * components/public-icons.tsx tells you to copy lucide's `__iconNode` out of
 * node_modules and "do not eyeball it", and its test compares each copy against
 * lucide's own geometry so a drifted path fails rather than shipping. There is
 * no such source in this tree for a Spotify or Instagram mark — lucide has no
 * brand icons, and simple-icons is not a dependency — so drawing five brand
 * paths by hand would be exactly the eyeballing that rule forbids, with nothing
 * able to catch a wrong one. Marks are a follow-up with a real prerequisite.
 *
 * Never framed, never inline. That is the whole difference between this and
 * components/media.tsx, and it is why PlatformLink is not a Media.
 */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-xs uppercase tracking-widest transition-colors";

export function LinkRow({
  links,
  lang = "en",
  label = "Where to find this",
}: {
  links?: PlatformLink[];
  lang?: Lang;
  /** The nav's accessible name. The plant and the sprout say different things. */
  label?: string;
}) {
  // The same contract MediaList has: nothing to show is nothing rendered, not
  // an empty container with a gap around it.
  if (!links || links.length === 0) return null;

  return (
    <nav aria-label={label} className="not-prose flex flex-wrap gap-2">
      {links.map((link, i) => {
        // A stored label wins; the platform's own name is the fallback. Blank
        // parts fall through inside resolveText, so { en: "", fr: "…" } still
        // reads rather than rendering an empty chip.
        const text = resolveText(link.label, lang).trim() || platformLabel(link.platform);

        // Non-http renders as text: visible, copyable, not clickable.
        if (!isHttpUrl(link.url)) {
          return (
            <span key={`${i}-${link.url}`} className={`${CHIP} text-muted-foreground`}>
              {text}
            </span>
          );
        }

        return (
          <a
            key={`${i}-${link.url}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${CHIP} hover:bg-accent`}
          >
            {text}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
npm test 2>&1 | tail -10 && npx tsc --noEmit && echo TSC-OK
```

Expected: PASS, `TSC-OK`.

- [ ] **Step 5: Commit**

```bash
git add components/link-row.tsx components/link-row.test.tsx
git commit -m "Add LinkRow — destinations as text chips

Server-safe: no client directive, no lucide. Brand marks are deferred
rather than hand-drawn, because public-icons.tsx forbids eyeballed path
data and there is no vetted brand source in the tree to copy from."
```

---

### Task 8: Generalize the server-safe source test

**Files:**
- Rename: `lib/chrome-source.test.ts` → `lib/server-safe-source.test.ts`

- [ ] **Step 1: Rename the file**

```bash
git mv lib/chrome-source.test.ts lib/server-safe-source.test.ts
```

- [ ] **Step 2: Replace its body**

Overwrite `lib/server-safe-source.test.ts` with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rules that make a file safe to render in the public zone, enforced rather
 * than written down.
 *
 * This began as `chrome-source.test.ts`, guarding one file. The reasoning has
 * not changed, only its reach: the public zone's constraints — no
 * `"use client"`, no `lucide-react` — used to be prose in CLAUDE.md guarding
 * files nobody else touched, and every slice since has moved another shared
 * file onto the public zone's critical path from the admin side, where both
 * constraints are meaningless. The admin is already a client tree and already
 * imports lucide everywhere.
 *
 * So the failure mode is specific and entirely plausible. Someone adds a
 * `useState` to the chrome for a collapse animation, or reaches for a
 * `<Spotify />` from a brand icon package instead of adding a glyph, and:
 *
 *  - `tsc` passes. Both are valid TypeScript.
 *  - `npm test` passes. Nothing else reads these files.
 *  - `npm run build` passes. A client component in a server tree is legal.
 *  - Every admin page still works, because the admin has script.
 *
 * And the public site loses navigation, or a media list, without JavaScript.
 * The first person to notice would be a visitor.
 *
 * Source text rather than a render, deliberately. `lib/toc-mount.test.ts` can
 * assert its claim by rendering, because "renders nothing" is observable in the
 * output. "Is not a client component" is not: `renderToStaticMarkup` happily
 * renders a `"use client"` module, and the boundary only exists to Next's
 * bundler. The directive itself is the thing to assert.
 *
 * ADDING A FILE HERE IS THE CHEAP HALF. Anything new that the public zone
 * renders belongs in this list on the day it is written, not the day it breaks.
 */
const SERVER_SAFE = [
  "components/chrome.tsx",
  "components/media.tsx",
  "components/public-icons.tsx",
  "components/link-row.tsx",
];

for (const path of SERVER_SAFE) {
  const source = readFileSync(join(process.cwd(), path), "utf8");

  test(`${path} is not a client component`, () => {
    // Anywhere in the file, not just line one: a stray directive lower down is
    // inert, but it is also a sign someone tried.
    assert.ok(
      !/^\s*["']use client["']/m.test(source),
      `${path} must not be a client component — the public zone renders it`,
    );
  });

  test(`${path} imports no lucide icon`, () => {
    // lucide-react routes every icon through an Icon.mjs carrying "use client",
    // so one import is one client boundary — components/media.tsx states the
    // rule and components/public-icons.tsx is the way around it.
    assert.ok(
      !/from\s+["']lucide-react["']/.test(source),
      `${path} must not import lucide-react — use components/public-icons.tsx`,
    );
  });

  test(`${path} pulls in no server-only module`, () => {
    // The other direction, and the one that fails LOUDLY rather than quietly:
    // lib/data.ts opens with node:fs, so a shared file that reached for it
    // would break the admin's client islands at build time.
    assert.ok(!/from\s+["']node:/.test(source), `${path} must stay isomorphic`);
  });
}
```

- [ ] **Step 3: Run the tests**

```bash
npm test 2>&1 | grep -E "components/(chrome|media|public-icons|link-row)" | head -15
```

Expected: twelve passing assertions, four files × three rules.

- [ ] **Step 4: Commit**

```bash
git add -A lib/chrome-source.test.ts lib/server-safe-source.test.ts
git commit -m "Generalize the server-safe source test to a file list

It guarded one file while three more had quietly joined the public zone's
critical path. The rules are unchanged; only the reach is."
```

---

### Task 9: Render the row on both public pages

**Files:**
- Modify: `app/(public)/(chrome)/plant/[slug]/page.tsx`
- Modify: `app/(public)/(chrome)/bean/[id]/page.tsx`

There is no public sprout route — a sprout renders as a `Card` inside its bean's page. Both files below are already server components.

- [ ] **Step 1: Add the row to the plant page**

In `app/(public)/(chrome)/plant/[slug]/page.tsx`, add to the imports:

```tsx
import { LinkRow } from "@/components/link-row";
```

and insert immediately after the closing `/>` of `<PlantHead … />`:

```tsx
      {/* Where the plant can be found off-site. Under the head, above the
          narrative: it is a fact about the plant, not part of its argument. */}
      <div className="flex justify-center">
        <LinkRow links={plant.links} lang={lang} label={`Find ${resolveText(plant.name, lang)} elsewhere`} />
      </div>
```

- [ ] **Step 2: Add the row to each sprout card**

In `app/(public)/(chrome)/bean/[id]/page.tsx`, add to the imports:

```tsx
import { LinkRow } from "@/components/link-row";
```

and inside the sprout `<CardContent>`, between the property-dump `<ul>` and `<MediaList>`:

```tsx
            {/* Destinations before assets: "listen to this" is what a visitor
                came for, and the gallery is what they stay for. `links[]` needs
                no exclusion from the dump above — isScalar rejects arrays, so
                it stays out the same way media[] already does. */}
            <LinkRow links={sprout.links} lang={lang} label={`Listen to ${resolveText(sprout.name, lang)}`} />
```

- [ ] **Step 3: Typecheck and build**

```bash
npx tsc --noEmit && echo TSC-OK && npm run build 2>&1 | tail -15
```

Expected: `TSC-OK` and a successful build.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/(chrome)/plant/[slug]/page.tsx" "app/(public)/(chrome)/bean/[id]/page.tsx"
git commit -m "Render LinkRow on the plant page and in each sprout card

There is no public sprout route — a sprout is a card on its bean's page,
so the episode's row lands there, above its media."
```

---

### Task 10: The links in `data/garden.yml`, derived at migrate

**Files:**
- Modify: `scripts/migrate-garden.ts`, `data/garden.yml`

- [ ] **Step 1: Add the derivation to migrate**

In `scripts/migrate-garden.ts`, add to the imports:

```ts
import { normalizeLinks } from "../lib/platforms";
```

and add, directly below the existing `mirrored` helper:

```ts
  // The yml carries only `url`. `platform` is derived here and a normalized URL
  // is what gets stored, so the "derived server-side, never declared" rule
  // holds through the one path that writes links — and a hand-authored entry
  // cannot get `platform` wrong, because it does not get to say.
  //
  // No return type annotation, same as `mirrored` above: the inferred
  // `T & { links: PlatformLink[] }` spreads into $set without a cast.
  const linked = <T extends { links?: { url: string }[] }>(doc: T) => {
    const links = normalizeLinks(doc.links);
    return links ? { ...doc, links } : doc;
  };
```

Then wrap the plant and sprout documents. Change the plants loop's two `mirrored(p)` calls to `mirrored(linked(p))`:

```ts
  for (const p of raw.plants ?? []) {
    await db.collection("plants").updateOne(
      { slug: p.slug },
      p.visibility
        ? { $set: { ...mirrored(linked(p)) } }
        : { $set: { ...mirrored(linked(p)) }, $setOnInsert: { visibility: "public" } },
      { upsert: true },
    );
  }
```

and the sprouts loop's two `mirrored(v)` calls to `mirrored(linked(v))`:

```ts
  for (const v of raw.sprouts ?? []) {
    await db.collection("sprouts").updateOne(
      { slug: v.slug },
      v.state
        ? { $set: { ...mirrored(linked(v)) } }
        : { $set: { ...mirrored(linked(v)) }, $setOnInsert: { state: "published" } },
      { upsert: true },
    );
  }
```

Leave pods, beans and bees untouched — they carry no `links`.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit && echo TSC-OK
```

Expected: `TSC-OK`.

- [ ] **Step 3: Add the plant's links to `data/garden.yml`**

Find the `casa` plant entry (search for `slug: casa` under `plants:`, around line 798) and extend it to:

```yaml
  - slug: casa
    name: CASA Podcast
    description: A podcast about life questions and debates with 3 friends
    natures:
      - work
    links:
      - url: https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI
      - url: https://podcasts.apple.com/fr/podcast/casa-podcast/id1878359919
      - url: https://www.deezer.com/fr/show/1002670521
      - url: https://podcast.ausha.co/casa-podcast
      - url: https://www.instagram.com/casa.lepodcast
      - url: https://linktr.ee/casa.lepodcast
```

- [ ] **Step 4: Add each episode's links**

Find `slug: casa-dating-0` (under `sprouts:`, around line 463) and extend it to:

```yaml
  - slug: casa-dating-0
    name: CASA Episode 1
    type: episode
    date: '2026-02-18'
    description: >-
      The first episode of the CASA podcast about dating experiences and relationships, featuring
      personal stories and advice from the hosts
    parents:
      - bean:casa-dating
    links:
      - url: https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT
      - url: https://podcasts.apple.com/fr/podcast/dating-jumelles-pizza-et-photos-de-pieds/id1878359919?i=1000750486031
      - url: https://www.deezer.com/fr/episode/846725011
      - url: https://podcast.ausha.co/casa-podcast/dating-jumelles-pizza-et-photos-de-pieds
```

Find `slug: casa-tolerance-0` and extend it to:

```yaml
  - slug: casa-tolerance-0
    name: CASA Episode 2
    type: episode
    date: '2026-02-19'
    description: >-
      The second episode of the CASA podcast about tolerance and acceptance of the partener in a
      relationship, featuring personal stories and advice from the hosts
    parents:
      - bean:casa-tolerance
    links:
      - url: https://open.spotify.com/episode/6haxhA84s8YavAPdMyjn3J
      - url: https://podcasts.apple.com/fr/podcast/couple-accepter-lautre-malgre-la-romantasy-et-les-calamars/id1878359919?i=1000750485891
      - url: https://www.deezer.com/fr/episode/846724991
      - url: https://podcast.ausha.co/casa-podcast/couple-accepter-l-autre-malgre-la-romantasy-et-les-calamars-vampiriques
```

- [ ] **Step 5: Verify the YAML parses and the derivation is right**

```bash
node --import tsx -e '
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { normalizeLinks } from "./lib/platforms.ts";
const raw = yaml.load(readFileSync("data/garden.yml","utf8"), { schema: yaml.CORE_SCHEMA });
const casa = raw.plants.find(p => p.slug === "casa");
const eps  = raw.sprouts.filter(s => s.slug.startsWith("casa-"));
for (const doc of [casa, ...eps]) {
  console.log("\n" + doc.slug);
  for (const l of normalizeLinks(doc.links)) console.log("  ", l.platform.padEnd(16), l.url);
}
'
```

Expected: `casa` shows six links reading `spotify`, `apple-podcasts`, `deezer`, `ausha`, `instagram`, `linktree`; each episode shows four reading `spotify`, `apple-podcasts`, `deezer`, `ausha`. **No `link` anywhere** — a `link` means a host is missing from `PLATFORM_HOSTS`. Apple's `?i=` must still be present on the episode URLs.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-garden.ts data/garden.yml
git commit -m "Author the CASA links, and derive platform at migrate

The yml carries only a url, so a hand-authored entry cannot get platform
wrong — it does not get to say. Six on the show, four on each episode."
```

---

### Task 11: `scripts/import-casa-media.ts`

**Files:**
- Create: `scripts/import-casa-media.ts`
- Modify: `package.json`

- [ ] **Step 1: Read the slides and write their alt text**

The alt text cannot be invented — these slides carry French text and an alt that describes the wrong thing is worse than none. Open each file with the Read tool and write one short French sentence per slide describing what it shows:

```
/Users/alexis/Podcast/01-dating/post/post-dating 1.jpg  … through  post-dating 6.jpg
/Users/alexis/Podcast/02-couple/post-couple-01.jpg      … through  post-couple-08.jpg
```

Keep each under ~120 characters. If a slide is mostly text, the alt is that text, condensed. Hold the fourteen strings for Step 2.

Note the limitation, and do not try to fix it here: `MediaImage.alt` is `string`, not `Text` — it does not localize, so a French alt stays French for an English reader. That is a property of the type, recorded in the spec §2.3.

- [ ] **Step 2: Write the script**

Create `scripts/import-casa-media.ts`, substituting the real alt strings for the `ALT` placeholders from Step 1:

```ts
/**
 * One-off: the CASA episodes' Instagram carousels, into Cloudinary and onto the
 * two sprouts.
 *
 * A script rather than a drag into the admin picker for one reason: ORDER. It
 * is a carousel, so slide 3 must be third, and multi-file drop order is not
 * guaranteed by any browser. Here the order is the filename order, sorted
 * numerically, and it is reproducible.
 *
 * Idempotent by slug: it writes the FULL media[] array, so a second run
 * replaces rather than appends. It does re-upload — Cloudinary mints a fresh
 * public_id every time (lib/storage.ts refuses to derive one from a filename,
 * because that silently overwrote assets a published sprout pointed at) — so
 * the previous run's assets are orphaned rather than replaced. Clean them out
 * of the Cloudinary console if you run this more than twice.
 *
 * Re-running `npm run migrate` afterwards cannot clobber the result: `media` is
 * not a garden.yml field, so it is not in that script's $set document.
 *
 *   node --env-file=.env.local --import tsx scripts/import-casa-media.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../lib/db";
import { uploadImage } from "../lib/storage";
import { detectEmbed } from "../lib/embeds";
import { normalizeLinkUrl } from "../lib/platforms";
import type { Media } from "../lib/data";

interface Episode {
  slug: string;
  folder: string;
  /** Embeds that precede the gallery, in render order. */
  embeds: string[];
  /** One per image, in sorted filename order. Length is asserted below. */
  alts: string[];
}

const EPISODES: Episode[] = [
  {
    slug: "casa-dating-0",
    folder: "/Users/alexis/Podcast/01-dating/post",
    embeds: [
      "https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT",
      // The post's own permalink. Episode 1 therefore shows its carousel twice
      // — Meta's iframe on top, our durable copies below. That was chosen
      // deliberately (spec §3.2): the embed carries live counts, the copies
      // survive the post being deleted.
      "https://www.instagram.com/p/DVAxzXvDNkZ/",
    ],
    alts: [
      "ALT 1", "ALT 2", "ALT 3", "ALT 4", "ALT 5", "ALT 6",
    ],
  },
  {
    slug: "casa-tolerance-0",
    folder: "/Users/alexis/Podcast/02-couple",
    embeds: ["https://open.spotify.com/episode/6haxhA84s8YavAPdMyjn3J"],
    alts: [
      "ALT 1", "ALT 2", "ALT 3", "ALT 4", "ALT 5", "ALT 6", "ALT 7", "ALT 8",
    ],
  },
];

// Numeric-aware, so "post-dating 10.jpg" would sort after 9 rather than after
// 1. Six and eight files today; the rule costs nothing and removes a trap.
const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

const imagesIn = (folder: string): string[] =>
  readdirSync(folder).filter((f) => /\.jpe?g$/i.test(f)).sort(byName);

async function main() {
  const db = await getDb();

  for (const episode of EPISODES) {
    const files = imagesIn(episode.folder);
    if (files.length !== episode.alts.length) {
      throw new Error(
        `${episode.slug}: ${files.length} images in ${episode.folder} but ${episode.alts.length} alt strings. ` +
          `Alt text is positional — refusing to shift it onto the wrong slides.`,
      );
    }

    // Embeds first, in declared order, then the image run. mediaRuns groups the
    // adjacent images into one strip; the embeds keep their own rows.
    const media: Media[] = episode.embeds.map((url) => detectEmbed(normalizeLinkUrl(url)));

    for (const [i, file] of files.entries()) {
      const bytes = readFileSync(join(episode.folder, file));
      const image = await uploadImage(bytes, file);
      media.push({ ...image, alt: episode.alts[i] });
      console.log(`  ${file} → ${image.url}`);
    }

    await db.collection("sprouts").updateOne({ slug: episode.slug }, { $set: { media } });
    console.log(
      `wrote media[${media.length}] → sprout:${episode.slug} ` +
        `(${episode.embeds.length} embeds, ${files.length} images)\n`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add the npm script**

In `package.json`, after `"migrate"`, add:

```json
    "import:casa": "node --env-file=.env.local --import tsx scripts/import-casa-media.ts",
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit && echo TSC-OK
```

Expected: `TSC-OK`.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-casa-media.ts package.json
git commit -m "Add the CASA media import

A script rather than a picker drop, because it is a carousel and slide 3
must be third — filename order, numerically sorted, reproducible. Refuses
to run if the alt count and the file count disagree."
```

---

### Task 12: Run it, verify, open the PR

- [ ] **Step 1: Apply the links**

```bash
npm run migrate
```

Expected: `Migrated N plants, … sprouts, …`.

- [ ] **Step 2: Confirm no existing sprout is affected by the gallery rule**

The spec's one outstanding assumption. Check for a pre-existing adjacent image pair:

```bash
node --env-file=.env.local --import tsx -e '
import { getDb } from "./lib/db.ts";
const db = await getDb();
const rows = await db.collection("sprouts")
  .find({ "media.1": { $exists: true }, slug: { $nin: ["casa-dating-0","casa-tolerance-0"] } },
        { projection: { _id: 0, slug: 1, media: 1 } }).toArray();
console.log(rows.length === 0 ? "none — nothing existing changes" : rows.map(r => r.slug));
process.exit(0);
'
```

Expected: `none — nothing existing changes`. If any slug is listed, open it and check whether the images are adjacent; an adjacent pair now renders as a strip, which is either fine or a reason to raise the threshold — decide it, do not skip it.

- [ ] **Step 3: Upload the images**

```bash
npm run import:casa
```

Expected: fourteen `→ https://res.cloudinary.com/…` lines, then `wrote media[8] → sprout:casa-dating-0` and `wrote media[9] → sprout:casa-tolerance-0`.

- [ ] **Step 4: Confirm both episodes are actually published**

The baseline migration set `state`/`visibility` on insert only, and they may have been changed since.

```bash
node --env-file=.env.local --import tsx -e '
import { getDb } from "./lib/db.ts";
const db = await getDb();
console.log(await db.collection("plants").findOne({slug:"casa"},{projection:{_id:0,slug:1,visibility:1,links:1}}));
console.log(await db.collection("beans").find({slug:{$in:["casa-dating","casa-tolerance"]}},{projection:{_id:0,slug:1,visibility:1}}).toArray());
console.log(await db.collection("sprouts").find({slug:{$in:["casa-dating-0","casa-tolerance-0"]}},{projection:{_id:0,slug:1,state:1,"media":1,links:1}}).toArray().then(r=>r.map(s=>({slug:s.slug,state:s.state,media:s.media?.length,links:s.links?.length}))));
process.exit(0);
'
```

Expected: plant `visibility` not `"private"`, both beans not `"private"`, both sprouts `state: "published"`, media counts 8 and 9, links counts 4 and 4. Anything private must be published through the admin cascade — do not flip it in the database by hand.

- [ ] **Step 5: Look at both pages**

```bash
npm run dev
```

Open `http://localhost:3333/plant/casa`, `http://localhost:3333/bean/casa-dating` and `http://localhost:3333/bean/casa-tolerance`. Check:

- The plant page shows six chips under the head.
- Each episode card shows four chips, then the Spotify player, then (episode 1 only) the Instagram post, then one horizontal strip of slides.
- The strip snaps, and the slides are in the right order.
- Click into the strip and press → : it scrolls.

- [ ] **Step 6: Verify the CSP and the no-script promise**

```bash
curl -sI http://localhost:3333/bean/casa-dating | grep -i content-security-policy
```

Expected: `frame-src` containing `https://www.instagram.com`.

Then disable JavaScript in the browser and reload `/bean/casa-dating`. Expected: the chips still link, the strip still scrolls; only the two iframes are missing. **The gallery working here is the whole claim of this slice** — if it does not scroll without script, something client-side crept in.

- [ ] **Step 7: Final check**

```bash
npm test 2>&1 | tail -5 && npx tsc --noEmit && echo TSC-OK && npm run build 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 8: Push and open the PR**

```bash
git push -u origin casa-gallery-links
gh pr create --title "CASA Podcast: the carousels, and where to listen" --body "$(cat <<'BODY'
Both CASA episodes get their Instagram slides as a swipeable gallery, and a row
of platform links — on the show and on each episode.

**Three additions, one content import.**

- `links[]` on `Plant` and `Sprout`, deliberately not `media[]`: a destination
  is not an asset, and mixing a "listen on Apple Podcasts" URL into the array
  that renders the body would leave `MediaList` guessing. `lib/platforms.ts`
  derives `platform` from the host server-side and strips share tokens on write
   — including the `stkn` private-share token the source Instagram URL carried.
- `MediaList` groups **consecutive images** into a CSS scroll-snap strip.
  No new field — adjacency already says it. The threshold is two, so a lone
  image renders exactly the markup it always did and nothing published moves.
  Zero client JS: the strip is `overflow-x-auto` plus snap points, focusable so
  the arrow keys reach it.
- Instagram joins the framable providers. The shortcode is charset-validated in
  `lib/embeds.ts` and the origin is a literal in `lib/embed-src.ts`, so a forged
  row yields the wrong post on instagram.com, never an unallowlisted host. The
  CSP updated itself from `EMBED_FRAME_HOSTS`.

**No admin editor for `links[]`** — that needs a card on a plant page that is
now a hero with sheets, which is a decision of its own. Links are authored in
`data/garden.yml` and applied by `npm run migrate`.

**No brand marks yet** — `components/public-icons.tsx` forbids eyeballed path
data and its test compares each glyph against lucide's own geometry. There is no
equivalent source in the tree for a Spotify mark, so the chips are text until
`simple-icons` is added as a devDependency and can be copied from properly.

Episode 1 shows its carousel twice, in Meta's iframe and as our own copies.
Chosen: live counts on top, durable copies below.

Spec: `docs/superpowers/specs/2026-09-06-casa-media-links-design.md`

## Lab Note

```yaml
en:
  title: CASA Podcast, with the pictures and the players
  summary: >-
    Both CASA episodes now have their Instagram slides as a swipeable gallery,
    and a row of buttons to listen wherever you already listen — Spotify, Apple
    Podcasts, Deezer or Ausha.
fr:
  title: CASA Podcast, en images et en écoute
  summary: >-
    Les deux épisodes de CASA ont maintenant leurs visuels Instagram en galerie,
    et tu peux lancer l'écoute directement, ou filer sur Spotify, Apple
    Podcasts, Deezer ou Ausha.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Self-review notes

**Spec coverage:** §1.1 → Task 2. §1.2 → Task 2 (doc comment). §1.3/1.4/1.5 → Task 1. §2 → Tasks 3, 4. §2.3 → Task 11 Step 1. §3.1 → Tasks 5, 6. §3.2 → Task 11 (script comment). §4.1 → Task 10. §4.2 → Task 11. §4.3 → Task 7 (doc comment) + PR body. §5 → Tasks 10, 11. §6.1 → Task 7. §6.2 → Task 7 (deferral, with reason). §6.3 → Task 9. §7 → Tasks 1–8. §8 → task order. §9 → Tasks 8, 12. §10 → Task 12 Step 8.

**Naming:** `mediaRuns` / `MediaRun` (Tasks 3, 4); `detectPlatform` / `normalizeLinkUrl` / `normalizeLinks` / `platformLabel` (Tasks 1, 7, 10, 11); `PlatformLink` (Tasks 2, 7, 10); `"social"` aspect and `FRAME_BOX.social` (Task 6); `LinkRow` with `links`/`lang`/`label` props (Tasks 7, 9).

**Two things a reviewer should push back on if they disagree:**
- Task 1's tests pass before `PlatformLink` exists, so `npm test` alone is green at a point where `tsc` is not. Tasks 1 and 2 must land together.
- Task 12 Step 2 is a real gate, not a formality. It is the only check on the claim that no published page changes.
