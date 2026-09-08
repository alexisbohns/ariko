# Bean phone covers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a bean an explicit cover image and a one-word keyword, and draw a portrait cover as a phone standing in the landing-page frame — word above it, both animating on hover — with an admin surface to author them.

**Architecture:** Two flat optional fields on `Bean` (`cover`, `keyword`). One pure resolver, `lib/bean-cover.ts`, decides *fill* vs *phone* and is the only place the opt-in rule lives. One server-safe component, `components/bean-cover.tsx`, draws whichever it is told; the motion is pure CSS `group-hover`, so `app/(public)` gains no client island. The admin gets two separate forms on the previously read-only `/admin/bean/[id]` — a picker-only Cover card and a zero-client-JS Keyword form — each with its own patch builder, action and narrow Mongo writer, all modelled on the plant's Logo/Meta pair.

**Tech Stack:** Next.js 15 (App Router, server components), React 19, TypeScript, Tailwind v4, MongoDB, Cloudinary, `node:test` + `tsx`.

**Spec:** [`docs/superpowers/specs/2026-09-08-bean-phone-covers-design.md`](../specs/2026-09-08-bean-phone-covers-design.md)

**Branch:** `bean-phone-covers` (already created; the spec is its first commit).

---

## Conventions for every task

- **Run one test file:**
  `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/<name>.test.ts`
- **Run the whole suite:** `npm test`
- **Typecheck:** `npx tsc --noEmit`
- All new `lib/*.ts` modules are **pure** unless stated: no `node:fs`, no Mongo, no React.
- House style: every new file opens with a comment saying *why it exists and what would go wrong without it*, in the voice of `lib/cover.ts` and `lib/plant-logo.ts`. Read one of those before writing one.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/data.ts` *(modify)* | `Bean` gains `cover?: MediaImage` and `keyword?: Text` |
| `lib/bean-cover.ts` *(create)* | Pure. `BeanCover` union, `beanCoverFor`, `podCoverFrom`. The opt-in rule lives here and nowhere else |
| `lib/bean-cover.test.ts` *(create)* | Pins the resolver, exhaustively |
| `components/bean-cover.tsx` *(create)* | Server-safe. Draws a `BeanCover`: the fill image, or the word + phone |
| `components/bean-cover.test.tsx` *(create)* | Pins the markup: derivative URLs, the word, the absence |
| `lib/server-safe-source.test.ts` *(modify)* | `components/bean-cover.tsx` joins `SERVER_SAFE` |
| `app/(public)/page.tsx` *(modify)* | `Entry.cover` becomes a `BeanCover`; frame gains `relative`; renders `<BeanCover>` |
| `lib/bean-cover-edit.ts` *(create)* | Pure. `buildBeanCoverPatch` — the picker's `__ready` marker, dirty gate, failed-save guard |
| `lib/bean-cover-edit.test.ts` *(create)* | Pins all three guards |
| `lib/bean-keyword.ts` *(create)* | Pure. `buildBeanKeywordPatch` — en/fr → `Text \| null` |
| `lib/bean-keyword.test.ts` *(create)* | Pins en-only, fr-only, both, blank-means-clear |
| `lib/botanical.ts` *(modify)* | `updateBeanCover`, `updateBeanKeyword` — one field each, `$unset` on `null` |
| `app/admin/actions.ts` *(modify)* | `editBeanCoverAction`, `editBeanKeywordAction` |
| `app/admin/_components/bean-cover-form.tsx` *(create)* | Picker-only form. The picker owns the submit button |
| `app/admin/_components/bean-keyword-form.tsx` *(create)* | Zero-client-JS form: two inputs, a real button |
| `lib/media-picker-mount.test.ts` *(modify)* | The Cover form server-renders no submit button |
| `app/admin/bean/[id]/page.tsx` *(modify)* | Renders both forms |

---

## Task 1: The resolver

**Files:**
- Modify: `lib/data.ts` (the `Bean` interface, ~line 173)
- Create: `lib/bean-cover.ts`
- Test: `lib/bean-cover.test.ts`

- [ ] **Step 1: Add the two fields to `Bean`**

In `lib/data.ts`, inside `export interface Bean`, after `tags?: string[];`:

```ts
  /**
   * Explicit cover art, OVERRIDING the derivation in lib/cover.ts. Absent on
   * every bean that predates the phone-covers slice, and absent is the normal
   * case: a bean with no `cover` still shows the first image in its newest
   * sprout carrying one.
   *
   * What the field buys is the two things the derivation cannot: cover art that
   * does not drift the day a newer sprout ships an image, and cover art that
   * does not have to live inside a sprout's body to exist.
   */
  cover?: MediaImage;
  /**
   * The one word the cover wears — "Timeline", "Karma". Bilingual, because the
   * words are not language-neutral (Accuracy is Justesse), and because every
   * other thing a bean can say already is.
   *
   * Drawn ONLY on the phone treatment (lib/bean-cover.ts). A word floating over
   * a photograph is a different design.
   */
  keyword?: Text;
```

- [ ] **Step 2: Write the failing test**

Create `lib/bean-cover.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bean, MediaImage, Sprout } from "./data";
import { beanCoverFor, podCoverFrom } from "./bean-cover";

const img = (key: string, size?: { width: number; height: number }): MediaImage => ({
  kind: "image",
  storageKey: key,
  url: `https://res.cloudinary.com/x/image/upload/v1/${key}.png`,
  ...(size ?? {}),
});

const portrait = (key: string) => img(key, { width: 390, height: 844 });
const landscape = (key: string) => img(key, { width: 1600, height: 900 });
const square = (key: string) => img(key, { width: 800, height: 800 });

const bean = (extra: Partial<Bean> = {}): Bean => ({
  slug: "b",
  name: "B",
  parents: ["plant:p"],
  ...extra,
});

const sprout = (media?: Sprout["media"]): Sprout => ({
  slug: "s",
  name: "S",
  type: "release",
  date: "2026-01-01",
  description: "",
  parents: ["bean:b"],
  ...(media ? { media } : {}),
});

test("an explicit PORTRAIT cover is the phone treatment, carrying the keyword", () => {
  const cover = beanCoverFor(bean({ cover: portrait("shot"), keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "phone", image: portrait("shot"), keyword: "Timeline" });
});

test("a portrait cover with no keyword is still a phone, just wordless", () => {
  const cover = beanCoverFor(bean({ cover: portrait("shot") }), []);
  assert.deepEqual(cover, { kind: "phone", image: portrait("shot") });
});

test("an explicit LANDSCAPE cover fills, and drops the keyword", () => {
  const cover = beanCoverFor(bean({ cover: landscape("wide"), keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image: landscape("wide") });
});

test("an explicit SQUARE cover fills — taller-than-wide is the whole test", () => {
  const cover = beanCoverFor(bean({ cover: square("sq") }), []);
  assert.deepEqual(cover, { kind: "fill", image: square("sq") });
});

test("an explicit cover with NO stored dimensions fills", () => {
  // A pasted third-party URL carries neither width nor height, and lib/inbox.ts
  // deliberately permits those. The safe failure is "no phone", never "no
  // cover".
  const cover = beanCoverFor(bean({ cover: img("pasted"), keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image: img("pasted") });
});

test("width alone cannot prove portrait, so it fills", () => {
  // isPortrait requires BOTH dimensions. A version that falls back to `?? 0`
  // on the missing one would compare 390 > 0 and draw a phone.
  const image: MediaImage = { ...img("half-w"), width: 390 };
  const cover = beanCoverFor(bean({ cover: image, keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image });
});

test("height alone cannot prove portrait, so it fills", () => {
  // Same defect, the other missing dimension: `?? 0` on width would compare
  // 844 > 0 and draw a phone around an image with no known width at all.
  const image: MediaImage = { ...img("half-h"), height: 844 };
  const cover = beanCoverFor(bean({ cover: image, keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image });
});

test("an explicit cover WINS over an available derivation", () => {
  const cover = beanCoverFor(bean({ cover: portrait("chosen"), keyword: "Timeline" }), [sprout([landscape("derived")])]);
  assert.deepEqual(cover, { kind: "phone", image: portrait("chosen"), keyword: "Timeline" });
});

test("no explicit cover falls back to the derivation, and always fills", () => {
  const cover = beanCoverFor(bean(), [sprout([landscape("derived")])]);
  assert.deepEqual(cover, { kind: "fill", image: landscape("derived") });
});

test("a DERIVED portrait image is never a phone", () => {
  // The load-bearing rule. Deriving the treatment from portrait-ness alone
  // would put a bezel around any portrait photograph a sprout happens to carry
  // — a person, a poster, a book. Setting `cover` IS the opt-in.
  const cover = beanCoverFor(bean({ keyword: "Timeline" }), [sprout([portrait("photo")])]);
  assert.deepEqual(cover, { kind: "fill", image: portrait("photo") });
});

test("nothing anywhere is null", () => {
  assert.equal(beanCoverFor(bean(), []), null);
  assert.equal(beanCoverFor(bean(), [sprout()]), null);
  assert.equal(beanCoverFor(bean({ keyword: "Timeline" }), []), null);
});

test("a pod borrows the first cover it can find", () => {
  const borrowed = podCoverFrom([null, { kind: "fill", image: landscape("a") }, { kind: "fill", image: landscape("b") }]);
  assert.deepEqual(borrowed, { kind: "fill", image: landscape("a") });
});

test("a pod borrowing a phone keeps the image and LOSES the word", () => {
  // The word names the bean. On a pod card it would name the wrong thing.
  const borrowed = podCoverFrom([{ kind: "phone", image: portrait("shot"), keyword: "Timeline" }]);
  assert.deepEqual(borrowed, { kind: "phone", image: portrait("shot") });
});

test("a pod whose beans are all coverless borrows nothing", () => {
  assert.equal(podCoverFrom([null, null]), null);
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/bean-cover.test.ts`
Expected: FAIL — `Cannot find module './bean-cover'`.

- [ ] **Step 4: Write `lib/bean-cover.ts`**

```ts
import type { Bean, MediaImage, Sprout, Text } from "./data";
import { coverFor } from "./cover";

/**
 * Pure. What a card should draw where a bean's cover goes — and, for a portrait
 * cover, that it is a PHONE rather than a picture.
 *
 * The whole opt-in rule lives in this file. `lib/cover.ts` is untouched: a bean
 * with no `cover` still shows the first image in its newest sprout carrying one.
 * What this adds is an override, and one branch off it.
 *
 * The rule that is easy to get wrong, and is pinned by a test: the phone
 * treatment is reachable ONLY through an explicit `bean.cover`. Deriving it
 * from portrait-ness alone reads well until a bean's newest sprout carries a
 * portrait photograph — a person, a poster, a book — and the landing page
 * silently draws a phone bezel around it. Setting the field is the author's
 * opt-in; the image's shape only decides how that opt-in is drawn.
 *
 * `keyword` being present is not the same as it having a word to show: a
 * bilingual `Text` can resolve to `""` for one reader's language while
 * carrying real text for the other's. This resolver is lang-agnostic by
 * design and cannot decide that — "wordless" is a state the consumer
 * completes after resolving the `Text`, not one this union guarantees.
 */
export type BeanCover =
  | { kind: "phone"; image: MediaImage; keyword?: Text }
  | { kind: "fill"; image: MediaImage };

/**
 * `width`/`height` are OPTIONAL on MediaImage. Cloudinary stores both on upload
 * (lib/storage.ts's toMediaImage), but a pasted third-party URL carries
 * neither, and lib/inbox.ts deliberately permits those. An image that cannot
 * prove it is portrait is not portrait — the safe failure here is "no phone",
 * never "no cover".
 */
function isPortrait(image: MediaImage): boolean {
  return (
    typeof image.width === "number" &&
    typeof image.height === "number" &&
    image.height > image.width
  );
}

export function beanCoverFor(bean: Bean, sprouts: Sprout[]): BeanCover | null {
  if (bean.cover) {
    if (!isPortrait(bean.cover)) return { kind: "fill", image: bean.cover };
    return bean.keyword === undefined
      ? { kind: "phone", image: bean.cover }
      : { kind: "phone", image: bean.cover, keyword: bean.keyword };
  }

  const derived = coverFor(sprouts);
  return derived ? { kind: "fill", image: derived } : null;
}

/**
 * A pod has no cover of its own — it borrows the first one its beans can offer,
 * which is what `app/(public)/page.tsx` already did one level down.
 *
 * It borrows the ARTWORK and not the word. A pod showing a phone is right: it
 * is the same image, and the pod really does contain that app. A pod wearing
 * one of its beans' keywords is not — the word names the bean.
 *
 * The keyword is dropped by CONSTRUCTION rather than by assigning undefined, so
 * a deepEqual in the test sees a genuinely absent key.
 *
 * The two branches below look asymmetric — `phone` builds a new object, `fill`
 * returns `borrowed` by reference — because they are doing different jobs, not
 * by oversight: the clone exists solely to drop the keyword, and a `fill` cover
 * has no keyword to drop, so returning it unchanged is the correct behaviour,
 * not a shortcut.
 */
export function podCoverFrom(covers: (BeanCover | null)[]): BeanCover | null {
  const borrowed = covers.find((c): c is BeanCover => c !== null);
  if (!borrowed) return null;
  return borrowed.kind === "phone" ? { kind: "phone", image: borrowed.image } : borrowed;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/bean-cover.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add lib/data.ts lib/bean-cover.ts lib/bean-cover.test.ts
git commit -m "feat: a bean can carry its own cover and a keyword

The phone treatment is reachable only through an explicit cover — a
derived portrait image stays a picture, which is what keeps a portrait
photograph in a sprout from silently growing a bezel."
```

---

## Task 2: The cover, drawn

**Files:**
- Create: `components/bean-cover.tsx`
- Test: `components/bean-cover.test.tsx`
- Modify: `lib/server-safe-source.test.ts` (the `SERVER_SAFE` array)

- [ ] **Step 1: Write the failing tests**

Create `components/bean-cover.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { BeanCover } from "./bean-cover";
import type { BeanCover as BeanCoverValue } from "@/lib/bean-cover";
import type { Lang } from "@/lib/locale";
import type { MediaImage } from "@/lib/data";

/**
 * renderToStaticMarkup, no jsdom — the route components/media.test.tsx and
 * components/link-row.test.tsx already take, and for the same reason: this
 * component is server-only by design and the static markup IS its output.
 */
const img = (key: string, size?: { width: number; height: number }): MediaImage => ({
  kind: "image",
  storageKey: key,
  url: `https://res.cloudinary.com/demo/image/upload/v1/${key}.png`,
  ...(size ?? {}),
});

const html = (cover: BeanCoverValue | null, lang: Lang = "en") =>
  renderToStaticMarkup(<BeanCover cover={cover} lang={lang} />);

const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

test("no cover renders nothing at all", () => {
  assert.equal(html(null), "");
});

test("a fill cover is one image at the 448x336 derivative", () => {
  const markup = html({ kind: "fill", image: img("wide") });
  assert.match(markup, /w_448,h_336,c_fill,q_auto,f_auto/);
  // A class-string assertion, and a deliberate exception to "don't assert
  // Tailwind class strings": object-cover is what makes this a FILL cover
  // rather than a letterboxed one — dropping it changes what the visitor
  // sees, so it is behaviour, not styling. It is not blanket permission to
  // assert the hover/transition classes alongside it.
  assert.match(markup, /object-cover/);
  assert.equal(text(markup), "");
});

test("a phone cover asks for the TALL derivative, not the square one", () => {
  // The phone box is 112x242 CSS px; 224x484 is that doubled for a retina
  // display. Asking for the 448x336 fill derivative here would deliver a
  // landscape crop of a portrait screenshot.
  const markup = html({ kind: "phone", image: img("shot", { width: 390, height: 844 }) });
  assert.match(markup, /w_224,h_484,c_fill,q_auto,f_auto/);
  assert.doesNotMatch(markup, /w_448/);
  // Attributes, not class strings, so the "don't assert Tailwind classes"
  // rule doesn't cover them — and the landing page renders a whole row of
  // these, so an un-pinned loading/decoding pair is real payload weight, not
  // styling.
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /decoding="async"/);
});

test("the keyword is rendered, and hidden from the accessibility tree", () => {
  const markup = html({
    kind: "phone",
    image: img("shot", { width: 390, height: 844 }),
    keyword: "Timeline",
  });
  assert.match(markup, /aria-hidden="true"/);
  assert.equal(text(markup), "Timeline");
});

test("the keyword resolves per language", () => {
  const cover: BeanCoverValue = {
    kind: "phone",
    image: img("shot", { width: 390, height: 844 }),
    keyword: { en: "Accuracy", fr: "Justesse" },
  };
  assert.equal(text(html(cover, "fr")), "Justesse");
  assert.equal(text(html(cover, "en")), "Accuracy");
});

test("a wordless phone renders the bezel and no empty word box", () => {
  const markup = html({ kind: "phone", image: img("shot", { width: 390, height: 844 }) });
  assert.doesNotMatch(markup, /aria-hidden/);
  assert.match(markup, /w_224,h_484/);
});

test("a keyword that resolves to whitespace is the WORDLESS phone", () => {
  // The resolver is lang-agnostic by design (lib/bean-cover.ts's BeanCover doc
  // says so): it hands over whatever Text the bean stores, so "has a word" is a
  // question only this component can answer, and only after resolving. A French
  // keyword with a blank English half must render the bezel alone rather than
  // an empty 34px box holding up the top of the frame.
  const markup = html(
    {
      kind: "phone",
      image: img("shot", { width: 390, height: 844 }),
      keyword: { en: "   ", fr: "Karma" },
    },
    "en",
  );
  assert.doesNotMatch(markup, /aria-hidden/);
  assert.equal(text(markup), "");
  assert.match(markup, /w_224,h_484/);
});

test("every image is decorative — the bean's name carries the accessible name", () => {
  for (const cover of [
    { kind: "fill", image: img("wide") } as const,
    { kind: "phone", image: img("shot", { width: 390, height: 844 }), keyword: "Timeline" } as const,
  ]) {
    assert.match(html(cover), /alt=""/);
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/bean-cover.test.tsx`
Expected: FAIL — `Cannot find module './bean-cover'`.

- [ ] **Step 3: Write `components/bean-cover.tsx`**

```tsx
import type { BeanCover as BeanCoverValue } from "@/lib/bean-cover";
import type { Lang } from "@/lib/locale";
import { resolveText } from "@/lib/data";
import { cloudinaryThumb } from "@/lib/image-url";

// One movement, two elements: the word leaving and the phone rising are the
// same gesture, so they share one duration and one curve by construction —
// tune the curve in one place and both halves of the choreography move
// together instead of silently drifting apart.
const GLIDE =
  "transition-transform duration-[420ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none";

/**
 * The inside of a landing-page cover frame.
 *
 * SERVER-SAFE, and pinned as such in lib/server-safe-source.test.ts: no
 * "use client", no lucide-react. `app/(public)` has exactly one client island
 * (the TOC rail) and this is not it — every move below is CSS `group-hover` on
 * the anchor the card already wears, so a cover that animates costs the public
 * zone no JavaScript at all.
 *
 * It is server-ONLY, not merely server-safe: `resolveText` comes from
 * `@/lib/data`, which opens with `node:fs`. `server-safe-source.test.ts`'s
 * third assertion (no `node:` import in THIS file's own source) passes
 * textually, but the module graph behind it is not isomorphic — a future
 * client island (an admin Cover live-preview, say) that imports this component
 * would fail at build with a confusing bundler error rather than a clear one.
 * This is only ever meant to render on the server.
 *
 * The frame itself stays in app/(public)/page.tsx: `aspect-[4/3] overflow-hidden
 * rounded-lg bg-muted`, plus `group` for this component's hover to hook into.
 * It also carries `relative`, but only as belt-and-braces — the phone branch
 * below establishes its own positioning context, so the frame's copy is never
 * actually needed. What lives here is only what goes inside it.
 *
 * The geometry is tied to the row's `w-56` card (224x168 frame). The phone is
 * half the frame wide — 112px, which for a 390x844 capture is 242px tall, so it
 * runs 132px past the bottom edge and the frame reads as a window onto
 * something taller rather than as a cropped picture. Its bezel is drawn HERE
 * rather than baked into the stored file: baking it would make cloudinaryThumb
 * crop a composite instead of a screen, and turn "re-shoot that screen" into
 * "re-composite that screen".
 *
 * Three more numbers worth naming so they don't read as arbitrary: the frame
 * is 168px tall and the phone should show 110px of screen at rest (the same
 * 110px the hover-transform comment below reckons its math from), which is
 * where `top-[58px]` comes from — 168 - 110 = 58. The word above it is a
 * `pt-[9px]` inset plus `text-[34px]` leading-none text, a ~43px block, so 58
 * leaves it a clean ~15px of headroom before the phone's bezel starts —
 * without that gap the word and the rising phone would overlap mid-transition
 * rather than only trading places at the end of it.
 */
export function BeanCover({
  cover,
  lang,
}: {
  cover: BeanCoverValue | null;
  lang: Lang;
}) {
  if (!cover) return null;

  if (cover.kind === "fill") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // Cloudinary shrinks it for us — 2x the 224px box, so the cover stays
        // sharp on a retina display without shipping the multi-megabyte
        // original. The derivative math is unchanged from what the page
        // rendered inline before this component existed.
        src={cloudinaryThumb(cover.image.url, { width: 448, height: 336 })}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
    );
  }

  const word = resolveText(cover.keyword, lang).trim();

  return (
    // The phone branch's own positioning context. `group` and the frame's
    // shape stay the caller's — this div owns nothing but `relative`, so the
    // two absolutely-positioned children below can never end up positioned
    // against some ancestor further up the tree than intended.
    <div className="relative h-full w-full">
      {word ? (
        <span
          // aria-hidden: the bean's name sits two lines below this and the word
          // is a compressed restatement of it — the same reasoning that puts
          // alt="" on the image beside it.
          //
          // z-10 is load-bearing, not decorative: this span is emitted BEFORE
          // the phone in DOM order, so without it the rising phone would paint
          // OVER the departing word for the middle of the hover transition,
          // rather than the two visibly trading places.
          aria-hidden
          className={`absolute inset-x-0 top-0 z-10 pt-[9px] text-center font-display text-[34px] leading-none tracking-tight text-foreground ${GLIDE} group-hover:-translate-y-[110%]`}
        >
          {word}
        </span>
      ) : null}
      <span
        // The transform is written whole rather than composed from Tailwind's
        // translate-x / translate-y / scale utilities. Those set separate custom
        // properties that a hover variant then has to re-declare in full anyway,
        // and getting one of them wrong centres the phone off-axis for the
        // duration of the transition only — which is exactly the kind of bug
        // that survives review.
        //
        // -46px with a 0.80 scale from `origin-top`: 110px of the screen visible
        // at rest becomes ~156px of a smaller phone on hover, 45% to 80%.
        //
        // bg-neutral-900, not a theme token: this is the one non-token colour
        // in the file, and it is deliberate rather than an oversight. A phone
        // is dark in both themes, so `bg-foreground` (near-white in dark mode)
        // or `bg-card` (vanishes into the page) would both be silently wrong
        // fixes for something that was never broken.
        className={`absolute left-1/2 top-[58px] w-1/2 origin-top rounded-2xl bg-neutral-900 p-1 pb-0 shadow-lg [transform:translateX(-50%)] ${GLIDE} group-hover:[transform:translateX(-50%)_translateY(-46px)_scale(0.8)]`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          // The phone's 112x242 box doubled. The FULL height, not the ~110px
          // visible at rest: hover reveals more of the image, and a derivative
          // sized to the rest state would blur exactly when the visitor leans
          // in.
          src={cloudinaryThumb(cover.image.url, { width: 224, height: 484 })}
          alt=""
          loading="lazy"
          decoding="async"
          className="block w-full rounded-t-xl"
        />
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/bean-cover.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the file to `SERVER_SAFE` and watch that test still pass**

In `lib/server-safe-source.test.ts`, extend the array:

```ts
const SERVER_SAFE = [
  "components/chrome.tsx",
  "components/media.tsx",
  "components/public-icons.tsx",
  "components/link-row.tsx",
  "components/bean-cover.tsx",
];
```

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/server-safe-source.test.ts`
Expected: PASS. (That file's header says adding a name here is the cheap half — do it on the day the file is written, not the day it breaks.)

- [ ] **Step 6: Commit**

```bash
git add components/bean-cover.tsx components/bean-cover.test.tsx lib/server-safe-source.test.ts
git commit -m "feat: draw a portrait cover as a phone in a window

Word above, phone cropped at the bottom, both moving on hover — all CSS
group-hover, so the public zone gains no second island."
```

---

## Task 3: Wire the landing page

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Change the imports**

Replace the `coverFor` import with the resolver and the component. The final import block for these three lines:

```ts
import { beanCoverFor, podCoverFrom, type BeanCover } from "@/lib/bean-cover";
import { cloudinaryThumb } from "@/lib/image-url";
import { BeanCover as BeanCoverArt } from "@/components/bean-cover";
```

`coverFor` is no longer imported here — `lib/bean-cover.ts` calls it now. **Leave `cloudinaryThumb` imported:** the plant logo below still uses it.

- [ ] **Step 2: Change the `Entry` type**

```ts
/** The card face: cover, title, one muted line. */
type Entry = {
  key: string;
  href: string;
  title: string;
  description: string;
  // Not a URL: what to DRAW there. The rule lives in one place, lib/bean-cover.ts.
  // A pod's is its first bean's, minus the word (podCoverFrom).
  cover: BeanCover | null;
};
```

- [ ] **Step 3: Change the two entry builders**

Replace the `beanCover` helper and both builders with:

```ts
  // sproutsForBean is newest-first (buildDataset), which is the ordering
  // coverFor documents that it expects, and which beanCoverFor passes
  // straight through.
  const coverOf = (bean: Bean) => beanCoverFor(bean, data.sproutsForBean(bean.slug));

  const beanEntry = (bean: Bean): Entry => ({
    key: `bean:${bean.slug}`,
    href: `/bean/${bean.slug}`,
    title: resolveText(bean.name, lang),
    // One muted line, never markdown: descriptions are one-liners, content is not (spec §5).
    description: resolveText(bean.description ?? "", lang),
    cover: coverOf(bean),
  });

  // A pod has no cover of its own — it borrows the first one its beans can
  // offer. It borrows the ARTWORK and not the word: the keyword names the bean,
  // so on a pod card it would name the wrong thing (podCoverFrom).
  const podEntry = (pod: Pod): Entry => ({
    key: `pod:${pod.slug}`,
    href: `/pod/${pod.slug}`,
    title: resolveText(pod.name, lang),
    description: resolveText(pod.description ?? "", lang),
    cover: podCoverFrom(data.beansForPod(pod.slug).map(coverOf)),
  });
```

- [ ] **Step 4: Change the frame in `cardRow`**

Replace the whole `<div className="aspect-[4/3] …">…</div>` block with:

```tsx
          // w-56 is 224px, and components/bean-cover.tsx derives its phone
          // geometry from that number — widen the card and the numbers in
          // that file need revisiting.
          <li key={entry.key} className="w-56 shrink-0">
            <a href={entry.href} className="group flex flex-col gap-3">
              {/* `overflow-hidden` is what clips the departing word on its way
                  out and crops the phone at the bottom; `relative` is
                  belt-and-braces since the phone branch establishes its own
                  positioning context. A null cover renders nothing here, so a
                  bean or pod with no cover simply shows this bare `bg-muted`
                  frame, like any other entry. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                <BeanCoverArt cover={entry.cover} lang={lang} />
              </div>
```

(`relative` here is belt-and-braces, not load-bearing: `components/bean-cover.tsx`'s
phone branch establishes its own positioning context, so this frame's copy is
never actually needed. An earlier draft of this step called it "new and
load-bearing" — that was wrong and is corrected here so the two files agree.)

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run build`
Expected: build succeeds. (It will not render any phone cover — no bean has one yet. That is the point: nothing in the garden changes appearance today.)

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add "app/(public)/page.tsx"
git commit -m "feat: the landing row draws covers through the resolver

No bean has an explicit cover yet, so every card renders exactly what it
rendered before."
```

---

## Task 4: The cover patch builder

**Files:**
- Create: `lib/bean-cover-edit.ts`
- Test: `lib/bean-cover-edit.test.ts`

Read `lib/plant-logo.ts` in full first. This is its sibling, one surface over.

- [ ] **Step 1: Write the failing test**

Create `lib/bean-cover-edit.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildBeanCoverPatch } from "./bean-cover-edit";

const img = (storageKey: string): MediaImage => ({
  kind: "image",
  storageKey,
  url: `https://res.cloudinary.com/x/${storageKey}.png`,
  width: 390,
  height: 844,
});

/** The picker's wire format: a ready marker plus one hidden field per entry. */
const form = (entries: unknown[], { ready = true } = {}): FormData => {
  const f = new FormData();
  if (ready) f.set("cover__ready", "1");
  for (const e of entries) f.append("cover", JSON.stringify(e));
  return f;
};

test("opening the card and saving it untouched writes nothing", () => {
  const cover = img("shot");
  assert.deepEqual(buildBeanCoverPatch({ cover }, form([cover])), { dirty: false });
});

test("a submit with no ready marker never writes, even over a stored cover", () => {
  // Script off, or a POST that never rendered a picker: the form does not know
  // what the bean holds, so its empty payload is not a clear.
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form([], { ready: false })), {
    dirty: false,
  });
});

test("removing the row clears the cover", () => {
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form([])), {
    dirty: true,
    cover: null,
  });
});

test("a new image replaces the stored one", () => {
  const next = img("newshot");
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form([next])), {
    dirty: true,
    cover: next,
  });
});

test("setting the first cover on a bean that had none", () => {
  const next = img("shot");
  assert.deepEqual(buildBeanCoverPatch({}, form([next])), { dirty: true, cover: next });
});

test("entries submitted but none of them an image is a FAILED SAVE, not a clear", () => {
  // Removing the row submits ZERO fields; a corrupted or embed-only save
  // submits N. The two are distinguishable without guessing, and writing
  // nothing is the safe failure — the stored cover survives.
  const embedOnly = [{ kind: "embed", url: "https://example.com/x" }];
  assert.deepEqual(buildBeanCoverPatch({ cover: img("shot") }, form(embedOnly)), {
    dirty: false,
  });
});

test("the stored dimensions survive the round trip", () => {
  // Load-bearing: lib/bean-cover.ts reads height > width to decide the phone
  // treatment, so a builder that dropped width/height would store a cover that
  // can never be a phone.
  const result = buildBeanCoverPatch({}, form([img("shot")]));
  assert.equal(result.dirty, true);
  assert.equal(result.dirty && result.cover?.width, 390);
  assert.equal(result.dirty && result.cover?.height, 844);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/bean-cover-edit.test.ts`
Expected: FAIL — `Cannot find module './bean-cover-edit'`.

- [ ] **Step 3: Write `lib/bean-cover-edit.ts`**

```ts
import type { MediaImage } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Bean this module cares about. */
export interface CoverOwner {
  cover?: MediaImage;
}

/** `cover: null` MEANS clear — the writer turns it into an `$unset`. */
export type CoverPatchResult = { dirty: false } | { dirty: true; cover: MediaImage | null };

// Field-order-sensitive, for the reason lib/plant-logo.ts's canonical() gives: a
// stored entry comes back from Mongo and a submitted one is rebuilt by the
// browser, so key order differs and JSON.stringify of the object itself would
// report an untouched cover as dirty. A fixed tuple removes that, and encoding
// rather than joining removes delimiter injection through the free-typed `alt`.
//
// width/height are IN the tuple, and that is load-bearing rather than
// completeness: lib/bean-cover.ts reads them to decide the phone treatment, so
// a re-upload that changed only the dimensions is a real edit.
function canonical(cover: MediaImage | null): string {
  return cover === null
    ? "null"
    : JSON.stringify([
        cover.storageKey,
        cover.url,
        cover.alt ?? "",
        cover.width ?? null,
        cover.height ?? null,
      ]);
}

/**
 * Pure, aside from one diagnostic warning. A SIBLING of buildPlantLogoPatch
 * rather than a generalization of it — the two are the same three guards over a
 * different field, and merging them would mean one function owning two
 * surfaces' field names, which is exactly the drift each hard-codes its own name
 * to prevent.
 *
 * Dirty-gated: opening the bean page and saving the card untouched must write
 * nothing at all.
 */
export function buildBeanCoverPatch(current: CoverOwner, form: FormData): CoverPatchResult {
  const raw = form.getAll("cover").map((v) => String(v));
  const stored = current.cover ?? null;

  // The picker never mounted (script off, or a submit that beat hydration), so
  // this form does not know what the bean holds — it is not a clear. The marker
  // is rendered whenever MediaPicker is mounted, independent of row count, so
  // its ABSENCE is unambiguous where a zero-field submission is not.
  //
  // Defence in depth rather than the sole protection: the card's submit button
  // lives INSIDE the island (MediaPicker's `submitLabel`), so an unmounted
  // picker leaves no button to press. This guard covers what a missing button
  // cannot — a replayed or scripted POST straight to the server action.
  if (!form.has("cover__ready")) return { dirty: false };

  // A cover is an image. An embed is not a candidate, and `links` is off on the
  // picker — but that is the UI saying so, not the contract.
  const next = parseMediaField(raw).find((m): m is MediaImage => m.kind === "image") ?? null;

  // Entries were submitted and NONE of them yielded an image: a failed save, not
  // a clear. Removing the row submits ZERO fields, while a corrupted or
  // embed-only save submits N — the two shapes are distinguishable without
  // guessing. Writing nothing is the safe failure: the stored cover survives.
  if (raw.length > 0 && next === null && stored !== null) {
    console.warn(
      `[media] buildBeanCoverPatch: ${raw.length} submitted field(s) yielded no image — write skipped, stored cover unchanged`,
    );
    return { dirty: false };
  }

  return canonical(stored) === canonical(next) ? { dirty: false } : { dirty: true, cover: next };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/bean-cover-edit.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/bean-cover-edit.ts lib/bean-cover-edit.test.ts
git commit -m "feat: buildBeanCoverPatch — the picker's three guards, one field over"
```

---

## Task 5: The keyword patch builder

**Files:**
- Create: `lib/bean-keyword.ts`
- Test: `lib/bean-keyword.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/bean-keyword.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildBeanKeywordPatch } from "./bean-keyword";

const form = (keyword: string, keywordFr: string): FormData => {
  const f = new FormData();
  f.set("keyword", keyword);
  f.set("keywordFr", keywordFr);
  return f;
};

test("en only stores a plain string — simple content stays simple", () => {
  assert.equal(buildBeanKeywordPatch(form("Timeline", "")), "Timeline");
});

test("both parts store the pair", () => {
  assert.deepEqual(buildBeanKeywordPatch(form("Accuracy", "Justesse")), {
    en: "Accuracy",
    fr: "Justesse",
  });
});

test("fr only is valid, and omits the blank en", () => {
  assert.deepEqual(buildBeanKeywordPatch(form("", "Justesse")), { fr: "Justesse" });
});

test("both blank MEANS CLEAR, and crosses the wire as an instruction", () => {
  // The field belongs to a record that already exists, so a blank has to be an
  // instruction rather than an absence — the stance PlantMetaPatch.description
  // takes, for the same reason. Omitting the key would silently leave the old
  // keyword in place.
  assert.equal(buildBeanKeywordPatch(form("", "")), null);
});

test("whitespace is trimmed, and whitespace-only is a clear", () => {
  assert.equal(buildBeanKeywordPatch(form("  Timeline  ", "")), "Timeline");
  assert.equal(buildBeanKeywordPatch(form("   ", "  ")), null);
});

test("absent fields are a clear, not a crash", () => {
  assert.equal(buildBeanKeywordPatch(new FormData()), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/bean-keyword.test.ts`
Expected: FAIL — `Cannot find module './bean-keyword'`.

- [ ] **Step 3: Write `lib/bean-keyword.ts`**

```ts
import { composeText, type Text } from "./data";

/**
 * Pure. The Keyword form → the stored field.
 *
 * `null` MEANS clear, and that is the whole reason this is a function rather
 * than a `composeText` call at the call site. The field belongs to a record
 * that already exists, so a blank has to cross the wire as an INSTRUCTION
 * rather than as an absence: omitting the key would silently leave the old
 * keyword in place and the author would see their deletion ignored. It is the
 * stance PlantMetaPatch.description takes, one field over.
 *
 * Nothing here throws. A blank name is a public claim the site would render
 * wrongly, which is why buildPlantMetaPatch throws on one — a blank keyword is
 * a cover with no word on it, which is a valid cover.
 */
export function buildBeanKeywordPatch(form: FormData): Text | null {
  const en = String(form.get("keyword") ?? "");
  const fr = String(form.get("keywordFr") ?? "");
  const composed = composeText(en, fr); // trims both parts
  return composed === "" ? null : composed;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/bean-keyword.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/bean-keyword.ts lib/bean-keyword.test.ts
git commit -m "feat: buildBeanKeywordPatch — blank means clear, not absent"
```

---

## Task 6: The two writers

**Files:**
- Modify: `lib/botanical.ts` (after `updatePlantLogo`, ~line 260)

No unit test: these touch Mongo, and every writer in this file is verified the same way — by `tsc`, and by the hands-on pass in Task 10.

- [ ] **Step 1: Add both writers**

```ts
/**
 * Writes a bean's cover — and nothing else. `null` clears it.
 *
 * The first bean writer in this file. Narrow rather than an `updateBeanMeta`
 * that could take several fields, for the reason updatePlantStatus gives: a
 * writer that can touch a field it was not asked about is a writer that
 * eventually does.
 *
 * Clearing is an `$unset` rather than a stored null, so an absent cover has ONE
 * representation and lib/bean-cover.ts only has to handle `cover === undefined`.
 */
export async function updateBeanCover(slug: string, cover: MediaImage | null): Promise<void> {
  const db = await getDb();
  await db
    .collection<Bean>("beans")
    .updateOne({ slug }, (cover === null
      ? { $unset: { cover: "" } }
      : { $set: { cover } }) as UpdateFilter<Bean>);
}

/** Writes a bean's keyword — and nothing else. `null` clears it, as above. */
export async function updateBeanKeyword(slug: string, keyword: Text | null): Promise<void> {
  const db = await getDb();
  await db
    .collection<Bean>("beans")
    .updateOne({ slug }, (keyword === null
      ? { $unset: { keyword: "" } }
      : { $set: { keyword } }) as UpdateFilter<Bean>);
}
```

- [ ] **Step 2: Fix the imports at the top of `lib/botanical.ts`**

Ensure `Bean`, `MediaImage` and `Text` are all in the type import from `./data`. Read the existing import line and add whichever are missing — `Bean` is already there (`listBeans` uses it), `MediaImage` is already there (`updatePlantLogo` uses it); `Text` is the likely addition.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add lib/botanical.ts
git commit -m "feat: updateBeanCover and updateBeanKeyword — one field each"
```

---

## Task 7: The two actions

**Files:**
- Modify: `app/admin/actions.ts`

Read `editPlantLogoAction` (~line 442) first — both of these are its shape.

- [ ] **Step 1: Extend the imports**

Add to the existing `@/lib/botanical` import list: `updateBeanCover`, `updateBeanKeyword`.

Add two new import lines:

```ts
import { buildBeanCoverPatch } from "@/lib/bean-cover-edit";
import { buildBeanKeywordPatch } from "@/lib/bean-keyword";
```

- [ ] **Step 2: Add both actions, after `editPlantLogoAction`**

```ts
/**
 * The bean's cover — and nothing else.
 *
 * `/admin/bean/[id]` was read-only until this slice, so this is the first bean
 * write in the admin. It is editPlantLogoAction's shape exactly: the form is
 * nothing BUT the picker, so the picker renders the submit button
 * (`submitLabel`) and script-off there is no button at all — the card is inert
 * rather than destructive. buildBeanCoverPatch enforces the same thing
 * server-side for a POST that never rendered one.
 */
export async function editBeanCoverAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/vault");

  const result = buildBeanCoverPatch(existing, formData);
  if (result.dirty) await updateBeanCover(slug, result.cover);

  // The landing page is force-dynamic, so it re-reads on the next request; the
  // admin surfaces that list beans are the ones that need telling.
  revalidatePath("/admin");
  revalidatePath("/admin/vault");
  redirect(`/admin/bean/${encodeURIComponent(slug)}`);
}

/**
 * The bean's keyword — and nothing else.
 *
 * A separate form from the Cover card above, and separate on purpose. One form
 * holding the picker AND a text input renders no button script-off (the button
 * is inside the island) but DOES render the input — and a form with one text
 * input and no button permits implicit submission on Enter. The author would
 * type a keyword, press Return, and post a payload carrying no `cover__ready`
 * and no media: nothing destroyed, but the keyword silently lost, with no sign
 * on the page. Two forms make that impossible instead of survivable.
 */
export async function editBeanKeywordAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/vault");

  await updateBeanKeyword(slug, buildBeanKeywordPatch(formData));

  revalidatePath("/admin");
  revalidatePath("/admin/vault");
  redirect(`/admin/bean/${encodeURIComponent(slug)}`);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts
git commit -m "feat: editBeanCoverAction and editBeanKeywordAction"
```

---

## Task 8: The two forms

**Files:**
- Create: `app/admin/_components/bean-cover-form.tsx`
- Create: `app/admin/_components/bean-keyword-form.tsx`
- Modify: `lib/media-picker-mount.test.ts`

- [ ] **Step 1: Write the failing mount test**

Append to `lib/media-picker-mount.test.ts`:

```ts
test("the bean cover form server-renders no way to submit it", async () => {
  const React = await import("react");
  const { MediaPicker } = await import("@/components/admin/media-picker");

  // The real shape from app/admin/_components/bean-cover-form.tsx: a hidden
  // slug, and the picker carrying the form's only submit button. Capped at one
  // — a bean has one cover.
  const html = await renderScriptOff(
    React.createElement(
      "form",
      { action: "/noop" },
      React.createElement("input", { type: "hidden", name: "slug", value: "b" }),
      React.createElement(MediaPicker, {
        name: "cover",
        initial: [],
        max: 1,
        submitLabel: "Save cover",
      }),
    ),
  );

  assert.equal(/<button/i.test(html), false, "a script-off browser must see no submit button");
  assert.equal(html.includes("Save cover"), false, "the submit label belongs to the island, not the form");
  // Inert rather than merely button-less: no field survives that could carry an
  // implicit submission. This is WHY the keyword lives in its own form — put a
  // text input in here and Enter posts a payload with no cover__ready marker.
  assert.equal(html, '<form action="/noop"><input type="hidden" name="slug" value="b"/></form>');
});
```

- [ ] **Step 2: Run it — it should PASS already**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/media-picker-mount.test.ts`
Expected: PASS. This test pins a property of `MediaPicker` that already holds; it exists so that a future change which server-renders the picker's rows fails here rather than in production. Write it first anyway — it is the contract the form in Step 3 is built against.

- [ ] **Step 3: Write `app/admin/_components/bean-cover-form.tsx`**

```tsx
import type { Bean } from "@/lib/data";
import { editBeanCoverAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";

/**
 * The bean's cover art.
 *
 * The sprout media card's case and the plant Logo card's case again, not a new
 * one: the form is nothing BUT the picker, so the picker renders the submit
 * button (`submitLabel`) and a script-off browser sees no button at all — inert
 * rather than destructive, which is CLAUDE.md's rule verbatim.
 * buildBeanCoverPatch enforces the same thing server-side for a POST that never
 * rendered a button.
 *
 * The keyword lives in its OWN form next door. Adding its input here would put a
 * lone text field in a button-less form, which submits on Enter — and that
 * payload carries no cover__ready marker, so the cover survives but the keyword
 * vanishes with nothing on screen to say so.
 */
export function BeanCoverForm({ bean }: { bean: Bean }) {
  return (
    <form action={editBeanCoverAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={bean.slug} />
      {/* The key re-seeds the island after a save, for the reason
          plant-logo-form.tsx gives: MediaPicker reads `initial` ONCE, in its
          useState initializer, so without this React reconciles the same
          instance after the action redirects and the picker keeps showing its
          own local state rather than what the database now holds.
          `links` is omitted — a cover is an image, never an embed. */}
      <MediaPicker
        key={JSON.stringify(bean.cover ?? null)}
        name="cover"
        initial={bean.cover ? [bean.cover] : []}
        max={1}
        submitLabel="Save cover"
      />
    </form>
  );
}
```

- [ ] **Step 4: Write `app/admin/_components/bean-keyword-form.tsx`**

```tsx
import { textPart, type Bean } from "@/lib/data";
import { editBeanKeywordAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The one word a phone cover wears.
 *
 * An ordinary metadata form: zero client JS, a real submit button, works
 * without script. That is still what every admin form but the six exceptions
 * is, and this one has no reason to join them — it is two text inputs.
 *
 * Prefills use the STRICT textPart, never resolveText. The fallback would copy
 * the fr half into the en box and save it back as en, which is the trap
 * plant-meta-form.tsx documents. No `required` on the en input: an fr-only
 * keyword is valid (B1), and both blank MEANS clear.
 */
export function BeanKeywordForm({ bean }: { bean: Bean }) {
  return (
    <form action={editBeanKeywordAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={bean.slug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="keyword">Keyword</Label>
          <Input
            id="keyword"
            type="text"
            name="keyword"
            placeholder="one word — Timeline, Karma"
            defaultValue={textPart(bean.keyword, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="keywordFr">Keyword (fr)</Label>
          <Input
            id="keywordFr"
            type="text"
            name="keywordFr"
            defaultValue={textPart(bean.keyword, "fr")}
          />
        </div>
      </div>
      <div>
        <Button type="submit">Save keyword</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/admin/_components/bean-cover-form.tsx app/admin/_components/bean-keyword-form.tsx lib/media-picker-mount.test.ts
git commit -m "feat: the bean's Cover card and Keyword form

Two forms and not one: a picker plus a lone text input is a form that
submits on Enter with no ready marker and eats the keyword."
```

---

## Task 9: Put both forms on the bean page

**Files:**
- Modify: `app/admin/bean/[id]/page.tsx`

- [ ] **Step 1: Add the imports**

```ts
import { BeanCoverForm } from "@/app/admin/_components/bean-cover-form";
import { BeanKeywordForm } from "@/app/admin/_components/bean-keyword-form";
```

- [ ] **Step 2: Add a Cover section above the existing Versions section**

Between the closing `</div>` of the header block and `<section className="flex flex-col gap-4">` (the Versions section), insert:

```tsx
        {/* The page's first write surface — it was a read-only property dump
            until this slice. Two cards, because they are two forms: see
            bean-cover-form.tsx for why they cannot be one. */}
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg tracking-tight">Cover</h2>
          <Card>
            <CardContent>
              <BeanCoverForm bean={bean} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <BeanKeywordForm bean={bean} />
            </CardContent>
          </Card>
        </section>
```

`Card` and `CardContent` are already imported by this file.

**Note on `bean`:** `beanDetail` resolves `name` (and each sprout's `name`/`description`) to display strings, but spreads everything else through untouched — so `bean.cover` and `bean.keyword` reach the forms as their stored `MediaImage` / `Text`, which is what `textPart` needs.

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/bean/[id]/page.tsx"
git commit -m "feat: the bean admin page can edit its cover and keyword"
```

---

## Task 10: Full verification

**Files:** none — this task only runs things.

- [ ] **Step 1: The whole suite**

Run: `npm test`
Expected: PASS, zero failures. New files contributing: `lib/bean-cover.test.ts` (11), `components/bean-cover.test.tsx` (7), `lib/bean-cover-edit.test.ts` (7), `lib/bean-keyword.test.ts` (6), plus one added to `lib/media-picker-mount.test.ts` and one name added to `lib/server-safe-source.test.ts`.

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 3: Hands-on, against the real admin**

Run: `npm run dev` (port 3333). Then, in a browser:

1. Open `/admin/bean/prediction-timelines`. Both cards render; the Keyword inputs are empty.
2. Type `Timeline` / `Chronologie`, press **Save keyword**. The page redirects back and both inputs are prefilled. **This confirms the strict `textPart` prefill:** the fr box must say `Chronologie`, not `Timeline`.
3. Upload any tall image in the Cover card, press **Save cover**. The picker re-seeds showing the stored image.
4. Open `/` — the bean's card in the Paulopus row now shows the word and the phone. Hover it: the word leaves upward and is clipped; the phone shrinks and rises.
5. Remove the cover row, press **Save cover**. The card returns to the plain muted frame.
6. Clear both keyword inputs, press **Save keyword**. Confirm the field is gone rather than stored blank — the phone would render wordless if a cover were set.

- [ ] **Step 4: Hands-on, script off**

In the browser devtools, disable JavaScript, then reload `/admin/bean/prediction-timelines`:

- The Cover card shows **no picker and no button** — inert, as the mount test claims.
- The Keyword form shows both inputs and a working **Save keyword** button. Save from here and confirm it writes.

Reload `/` with script still off: a bean carrying a cover still shows the word and the phone (it is all CSS), and hovering still animates. This is the claim that `app/(public)` gained no island — verify it rather than trusting it.

- [ ] **Step 5: Commit nothing, report**

If anything above misbehaves, fix it in the task that owns it and re-run. Do not paper over a failure here with a patch in this task.

---

## Task 11: The screenshots (content operation)

**Files:** none in this repo. **Nothing is committed to `/Users/alexis/code/paulopus`.**

This task produces content, not code. It is the last one, and it can be abandoned halfway without leaving the repo broken.

- [ ] **Step 1: Start Paulopus**

```bash
cd /Users/alexis/code/paulopus && pnpm dev
```

Serves on `http://localhost:3000`.

- [ ] **Step 2: Capture the seven reachable screens**

Portrait viewport 390×844, device scale factor 2. Suppress the Next dev overlay. Capture:

| Keyword | Bean slug | Screen |
|---|---|---|
| Match | `match-anatomy` | a `/match/[id]` debrief: hero, verdict chip, "Paulopus predicted X–Y", the three tabs |
| Karma | `karma-accountability` | `/karma`, the grading drawer open — four verdict bands with their weights |
| Data | `live-data-pipeline` | a match Brief tab scrolled to the source chips, with the openfootball credit line beneath |
| Editorial | `agentic-editorial-pipeline` | a match Brief tab showing the structured DetailedBrief (conditions, tactics) |
| Voice | `brand-voice` | `/` Teams tab — the 12 group grids of pixel flags |
| Accuracy | `prediction-performance` | `/karma` scrolled to the accuracy-over-time line and the karma-by-experience histogram |
| Retro | `research-process-reflection` | one of M001 / M002 / M007 / M019: a graded verdict reading "still in its tank" where the prediction should be |

- [ ] **Step 3: The Timeline mock — three edits, in a SCRATCH COPY**

Copy the Paulopus working tree to a scratch directory first. Then, in the copy only:

1. `app/page.tsx` — restore the third tab: a `TabsTrigger` and `TabsContent` for `upcoming`, `TabsList` from `grid-cols-2` to `grid-cols-3`, mapping `splitByKickoff(matches).upcoming` through `toMatchView` exactly as `history` is mapped.
2. `data/matches.json` — copy it, move a handful of `kickoff` values into the future, and **delete those records' `result`, `karma` and `debrief`**. A record that keeps its `result` renders the real score and the graded verdict, so it would read as history inside the Upcoming tab. **Keep `drafts`** — that is what supplies the muted predicted score and the statement bubble.
3. `lib/db.ts` — one line, pointing at the copied JSON.

Then capture the home page on the Upcoming tab for `prediction-timelines`.

**The escape hatch.** If this costs more than those three edits — the tab needs components that no longer exist, the data shape has moved, `splitByKickoff`'s signature has changed — **abandon it**. Capture `/match/[id]`'s Pronostic tab with "How the prediction evolved (4 revisions)" expanded (match M062) and use that for Timeline instead. Half the bean's story at none of the cost; one cover is not worth an excavation. Say which one you did.

- [ ] **Step 4: Author the eight beans**

For each of the eight, in the Ariko admin at `/admin/bean/<slug>`:

- Cover card → upload the PNG → **Save cover**.
- Keyword form → the English word, and the French one (Timeline/Chronologie, Match/Match, Karma/Karma, Data/Données, Editorial/Éditorial, Voice/Voix, Accuracy/Justesse, Retro/Rétro) → **Save keyword**.

Uploads go through `uploadImageAction` — never browser to Cloudinary directly.

- [ ] **Step 5: Look at the landing page**

Open `/`. The Paulopus row shows eight phones under eight words. Hover across them. Then switch the site to French and confirm the words change.

- [ ] **Step 6: Report**

Nothing to commit — this task writes to the database and to Cloudinary, not to the repo. Report which screen each bean got, and whether the Timeline mock was done or the escape hatch taken.

---

## The PR

A visitor-facing change, so the PR body **MUST** carry a Lab Note (CLAUDE.md, *Lab Note requirement*). This repo's pod slug is `ariko`.

```yaml
en:
  title: Project covers that show the actual thing
  summary: The Paulopus write-ups now wear a phone on the front — a real screen from the app, framed like a window, under the one word each piece is about. Hover a card and the word steps aside so you can see more of the screen.
fr:
  title: Des couvertures qui montrent enfin l'appli
  summary: Les articles Paulopus portent maintenant un téléphone en couverture — un vrai écran de l'appli, cadré comme une fenêtre, sous le mot qui résume la pièce. Survole une carte : le mot s'efface et l'écran se dévoile.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
