# Staging grammar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five staged blocks — figure, gallery, compare, callout, quote — written by the article door, round-tripped by the admin's Tiptap editor, rendered on the public site, plus SVG figures that never enter Ariko's DOM.

**Architecture:** One vocabulary (`lib/staging.ts`) and ONE shape function over the mdast container node (`lib/staging-parse.ts`) serve three consumers: the remark render pass (lenient), the door's validator (strict) and the editor's marked tokenizers, which find a block's extent and hand its raw text to the same parser. Media blocks are editor atoms whose markdown is rebuilt by one serializer (`lib/staging-markdown.ts`); text blocks keep editable children. The public components are server-safe and also draw the editor's preview.

**Tech Stack:** Next.js 15, React 19, TypeScript, remark-directive / react-markdown / rehype-sanitize, Tiptap 3 + @tiptap/markdown (marked), Base UI popover (shadcn registry), svgo 3, Cloudinary, `node:test` via tsx.

**Spec:** `docs/superpowers/specs/2026-11-15-staging-grammar-design.md` — read §2 (grammar, fence behaviour) and §1 (decisions) before any task.

---

## Ground rules for every task

- **Never run `npm run build` or touch `.next` in the main checkout** — the maintainer's dev server shares it. All work happens in the worktree this plan is executed in. `npm test` is safe anywhere.
- Tests are `node:test` + `node:assert/strict`, run by `npm test` (glob over `lib/**/*.test.ts(x)` and `components/**/*.test.ts(x)`). Run one file with `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test <file>`.
- `lib/*.test.ts` files cannot use JSX (tsconfig `jsx: preserve` under tsx) — use `createElement`. `components/*.test.tsx` can.
- Every new public-rendered file goes on `SERVER_SAFE` in `lib/server-safe-source.test.ts` **in the same commit** it is created.
- Commit after each task: `git commit -m "<message>\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Check `git config user.email` is `hello@bohns.design` once at the start.
- Comment style: this repo's docblocks explain WHY, with the failure that motivated a rule. Match it; do not narrate what code does.

## File map

| File | Responsibility |
|---|---|
| `lib/staging.ts` (new) | Vocabulary: block names, frames, sizes, defaults, attribute lists, widths, compare labels, `isSvgUrl`. Pure, client-safe. |
| `lib/staging-parse.ts` (new) | `parseStagedBlock(node, source, { strict })` over an mdast container directive → typed block or a named problem. Pure. |
| `lib/staging-markdown.ts` (new) | Canonical serializer for media blocks + text-block openers. Pure, client-safe. |
| `lib/staging-fence.ts` (new) | `findContainerEnd(src)` — remark's closing rule, for marked. Pure. |
| `lib/staging-fixtures.ts` (new) | Real excerpts + malformed variants, shared by every test. |
| `lib/markdown.ts` (modify) | `remarkStaging` pass + sanitize schema. |
| `lib/image-url.ts` (modify) | Never transform an `.svg`. |
| `components/phone-frame.tsx` (modify) | Quiet outline, every caller. |
| `components/desktop-frame.tsx` (new) | Hairline + three-dot strip. |
| `components/public-icons.tsx` (modify) | `CheckIcon`, `XIcon`. |
| `components/staging/*.tsx` (new) | Figure, gallery, compare, callout, quote, image helper, markdown component map. Server-safe. |
| `components/markdown.tsx` (modify) | Merge the staging component map. |
| `lib/narrative-excerpt.ts` (modify) | Drop fence lines. |
| `lib/staging-editor.ts` (new) | The five Tiptap nodes (headless). |
| `lib/entity-markdown.ts` (modify) | Add the five nodes to `headlessExtensions`; `baseExtensions` unchanged. |
| `components/editor/staging-views.tsx` (new) | Node views + popover forms. |
| `components/editor/editor-extensions.ts`, `prose-editor.tsx` (modify) | `/` rows, node views, upload busy wiring. |
| `lib/svg-check.ts` (new) | Allowlist check (refuse, never strip) + svgo minify. |
| `lib/storage.ts` (modify) | `svgUploadOptions`, `uploadSvg`. |
| `lib/articles-assets.ts`, `app/api/articles/assets/route.ts`, `app/admin/actions.ts` (modify) | SVG upload doors. |
| `lib/article-images.ts` (modify) | SVG only inside `:::figure`. |
| `lib/staging-check.ts` (new) | `stagingProblems(markdown)` for the door. |
| `lib/articles-v2.ts` (modify) | Run `stagingProblems`. |
| `plugins/ariko-article/skills/ariko-article/SKILL.md` (modify) | Teach the grammar. |
| `CLAUDE.md` (modify) | Record the rules the tests pin. |

---

### Task 1: The vocabulary

**Files:**
- Create: `lib/staging.ts`
- Test: `lib/staging.test.ts`
- Modify: `lib/server-safe-source.test.ts` (add `"lib/staging.ts"` to `SERVER_SAFE`)

- [ ] **Step 1: Write the failing test**

```ts
// lib/staging.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAGED_BLOCKS, FRAMES, SIZES, DEFAULT_SIZE, BLOCK_ATTRIBUTES, COMPARE_LABELS,
  isStagedBlock, resolveFrame, resolveSize, isSvgUrl,
} from "./staging";

test("the five blocks, in grammar order", () => {
  assert.deepEqual([...STAGED_BLOCKS], ["figure", "gallery", "compare", "callout", "quote"]);
  assert.equal(isStagedBlock("figure"), true);
  assert.equal(isStagedBlock("do"), false); // a compare side is not a block
  assert.equal(isStagedBlock("warning"), false);
});

test("frame and size are closed vocabularies with defaults", () => {
  assert.deepEqual([...FRAMES], ["phone", "desktop", "none"]);
  assert.deepEqual([...SIZES], ["s", "m", "l", "wide"]);
  assert.equal(resolveFrame("tablet"), "none");
  assert.equal(resolveFrame(undefined), "none");
  assert.equal(resolveSize(undefined, "phone"), "m");
  assert.equal(resolveSize("xl", "desktop"), "l");
  assert.equal(resolveSize("s", "desktop"), "s");
  assert.deepEqual(DEFAULT_SIZE, { phone: "m", desktop: "l", none: "l" });
});

test("each block names the attributes it accepts", () => {
  assert.deepEqual(BLOCK_ATTRIBUTES.figure, ["frame", "size", "dark"]);
  assert.deepEqual(BLOCK_ATTRIBUTES.gallery, ["frame"]);
  assert.deepEqual(BLOCK_ATTRIBUTES.compare, []);
  assert.deepEqual(BLOCK_ATTRIBUTES.callout, []);
  assert.deepEqual(BLOCK_ATTRIBUTES.quote, ["by", "role"]);
});

test("compare labels exist in both languages", () => {
  assert.deepEqual(COMPARE_LABELS.en, { do: "Do", dont: "Don't" });
  assert.deepEqual(COMPARE_LABELS.fr, { do: "À faire", dont: "À éviter" });
});

test("an SVG is recognised by its path, not its query", () => {
  assert.equal(isSvgUrl("https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.svg"), true);
  assert.equal(isSvgUrl("https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.SVG"), true);
  assert.equal(isSvgUrl("https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.png?x=.svg"), false);
  assert.equal(isSvgUrl("not a url.svg"), true);
});
```

- [ ] **Step 2: Run it, expect FAIL** (`Cannot find module './staging'`)

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/staging.test.ts`

- [ ] **Step 3: Implement**

First check `lib/locale.ts` exports `Lang` and imports nothing that reaches `node:fs` (it is imported by public components, so it should not). Then:

```ts
// lib/staging.ts
import type { Lang } from "./locale";

/**
 * The staging grammar's vocabulary (spec 2026-11-15 §2.4) — the one place the
 * five blocks and their closed value lists are named, as lib/plant-status.ts
 * is for its enum. The remark pass, the marked tokenizers, the sanitize
 * schema's value lists, the editor's radios and the door's validator all read
 * this file; nothing re-lists a member. A member spelled twice is how the
 * renderer and the door come to disagree about whether `size=xl` exists.
 *
 * Pure and client-safe: the editor's popovers import it.
 */

export const STAGED_BLOCKS = ["figure", "gallery", "compare", "callout", "quote"] as const;
export type StagedBlock = (typeof STAGED_BLOCKS)[number];

export const COMPARE_SIDES = ["do", "dont"] as const;
export type CompareSide = (typeof COMPARE_SIDES)[number];

export const FRAMES = ["phone", "desktop", "none"] as const;
export type Frame = (typeof FRAMES)[number];

export const SIZES = ["s", "m", "l", "wide"] as const;
export type Size = (typeof SIZES)[number];

export const DEFAULT_FRAME: Frame = "none";

/** A phone is narrow by nature; a desktop screenshot wants the column. */
export const DEFAULT_SIZE: Record<Frame, Size> = { phone: "m", desktop: "l", none: "l" };

/** What each block accepts. Anything else is refused by the door (§6.1) and
 *  ignored on render (§2.2). */
export const BLOCK_ATTRIBUTES: Record<StagedBlock, readonly string[]> = {
  figure: ["frame", "size", "dark"],
  gallery: ["frame"],
  compare: [],
  callout: [],
  quote: ["by", "role"],
};

/** Painted width in CSS px per size. Derivatives ask Cloudinary for twice it. */
export const SIZE_WIDTH: Record<Size, number> = { s: 240, m: 384, l: 768, wide: 960 };

/** The verdict words. Real text in the page's language, never colour alone. */
export const COMPARE_LABELS: Record<Lang, Record<CompareSide, string>> = {
  en: { do: "Do", dont: "Don't" },
  fr: { do: "À faire", dont: "À éviter" },
};

/** The one block an SVG may sit in (spec §5, §6.2). */
export const SVG_BLOCK: StagedBlock = "figure";

const has = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export const isStagedBlock = (v: unknown): v is StagedBlock => has(STAGED_BLOCKS, v);
export const isFrame = (v: unknown): v is Frame => has(FRAMES, v);
export const isSize = (v: unknown): v is Size => has(SIZES, v);

export const resolveFrame = (v: unknown): Frame => (isFrame(v) ? v : DEFAULT_FRAME);
export const resolveSize = (v: unknown, frame: Frame): Size => (isSize(v) ? v : DEFAULT_SIZE[frame]);

/** By the URL's PATH, so a `?x=.svg` query on a PNG is not an SVG. A string
 *  that is not a URL falls back to its own ending — the door refuses it as
 *  unhosted anyway. */
export function isSvgUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return /\.svg$/i.test(url.trim());
  }
}
```

If `Lang` is not `"en" | "fr"`, adjust `COMPARE_LABELS` to its members and tell the reviewer.

- [ ] **Step 4: Run it, expect PASS.** Also add `"lib/staging.ts"` to `SERVER_SAFE` in `lib/server-safe-source.test.ts` with a one-line comment (`// The staging vocabulary — imported by components/staging/*`) and run that test file too.

- [ ] **Step 5: Commit** — `Staging: the vocabulary`

---

### Task 2: The fixtures

**Files:**
- Create: `lib/staging-fixtures.ts`

These are real excerpts. The URLs are live Cloudinary assets from the kosymoz essay.

- [ ] **Step 1: Write the file**

```ts
// lib/staging-fixtures.ts
/**
 * The staging grammar's test material (spec §8), drawn from real articles
 * rather than invented: the kosymoz workshop essay (its phone screenshot, its
 * ramps-and-tints composites, its five "In two words" asides, its
 * reduce-motion rule), the maintainer's own words from pbbls-feed-redesign,
 * and a krabs entry for the short case. Every staging test — parse,
 * serialize, render, round trip, door — runs over this one set, so a block
 * that works in one consumer and not another shows up as one fixture failing
 * in one file.
 */

const LAKE = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691293/beanstalk/cactnyq3vvr5c3qiygp9.png";
const CROMLECH = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691288/beanstalk/d8jrtpogt4p2fpacekvv.png";
const MOON = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691289/beanstalk/kacck30mkzsnt86zqifp.png";
const RAMPS = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691291/beanstalk/w0vrkms6ovvt8m5zqjly.png";
const TINTS = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794691292/beanstalk/zcakvqykvboc8fx0nbxu.png";
export const CLOCK_SVG = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794700000/beanstalk/clock.svg";
export const CLOCK_DARK_SVG = "https://res.cloudinary.com/t5gexxs5/image/upload/v1794700001/beanstalk/clock-dark.svg";

/** Valid blocks, in canonical form — serialize(parse(x)) === x for each. */
export const STAGING_FIXTURES: Record<string, string> = {
  phoneFigure: `:::figure{frame=phone}
![Two scenes framed for a phone: the lake with its two moons, and the abbey with its embers](${LAKE})
Scenes zoom in on the subject when the phone is upright.
:::`,
  desktopFigureSmall: `:::figure{frame=desktop size=s}
![The cromlech scene: standing stones, a crescent moon and a starry sky](${CROMLECH})
:::`,
  darkSvgFigure: `:::figure{size=wide dark}
![The conductor's clock driving picture, sound and haptics](${CLOCK_SVG})
![The conductor's clock, drawn for a dark page](${CLOCK_DARK_SVG})
The audio clock is the reference; *everything else* locks onto it.
:::`,
  gallery: `:::gallery
![The moon drawn with the classic ramp](${MOON} "Classic")
![The same moon in three ramps](${RAMPS} "Three ramps")
![The same moon in four tints](${TINTS} "Four tints")
One moon, drawn four ways.
:::`,
  phoneGallery: `:::gallery{frame=phone}
![The lake scene](${LAKE} "Lake")
![The cromlech scene](${CROMLECH} "Cromlech")
:::`,
  compare: `::::compare
:::do
![An almost still cromlech](${CROMLECH})
Show an almost still picture and drop the events.
:::
:::dont
![The cromlech with shooting stars](${CROMLECH})
Keep every event running and ignore the system setting.
:::
::::`,
  textOnlyCompare: `::::compare
:::do
Keep the stone lit, in the list, on the line.
:::
:::dont
Swap the stone for a flat badge to save a render.
:::
::::`,
  callout: `:::callout[In two words: dithering]
When you only have a few shades of grey to work with, you mix them in a fine pattern so the eye rebuilds the in-between tones. It is the trick of old printed newspapers and early video games.
:::`,
  calloutWithEntity: `:::callout[In two words: haptics]
The fine vibrations of the phone, timed with :entity[the music]{ref=bean:sparkaik-music}.

::entity{ref=bean:sparkaik-haptics}
:::`,
  unlabeledCallout: `:::callout
Deliberately left out, at least for now: multiple accounts, budgets, forecasts, accounts to log into, anything to sync.
:::`,
  quote: `:::quote{by=Alexis role="reviewing the feed explorations"}
The Spine is truly a masterclass. I think I'll only pick the realistic pebbles stones render + the 7 circles for the week in the persons of the week, both from the Stream.
:::`,
  quoteHardBreaks: `:::quote{by=Alexis}
I like the summary idea of the Journal: people of the week and raw table of\\
contents list are perfect for introducing a passed week.

I absolutely love the deck card design.
:::`,
};

/** Valid on render, but NOT canonical: the editor rewrites them on save and
 *  the render must not change. */
export const NONCANONICAL_FIXTURES: Record<string, string> = {
  defaultsSpelled: `:::figure{frame=none size=l}\n![a](${MOON})\n:::`,
  unknownValues: `:::figure{frame=tablet size=xl}\n![a](${MOON})\n:::`,
  captionOnOwnParagraph: `:::figure\n![a](${MOON})\n\nA caption after a blank line.\n:::`,
  quotedBareValue: `:::quote{by="Alexis"}\nq\n:::`,
  unclosed: `:::callout[Open]\nThis callout is never closed.`,
  interruptsParagraph: `Some prose.\n:::callout\nAn aside.\n:::`,
};

/** Malformed: remark unwraps them to their children, the editor leaves them as
 *  text, the door refuses them by name. `problem` is the door's message. */
export const MALFORMED_FIXTURES: Record<string, { md: string; problem: RegExp }> = {
  figureNoImage: { md: `:::figure\nJust words.\n:::`, problem: /figure: needs exactly one image/ },
  figureTwoImages: { md: `:::figure\n![a](${MOON})\n![b](${RAMPS})\n:::`, problem: /figure: needs exactly one image/ },
  darkOneImage: { md: `:::figure{dark}\n![a](${MOON})\n:::`, problem: /figure: dark needs two images/ },
  galleryOfOne: { md: `:::gallery\n![a](${MOON})\n:::`, problem: /gallery: needs at least two images/ },
  imageAfterCaption: { md: `:::figure\n![a](${MOON})\nCaption\n![b](${RAMPS})\n:::`, problem: /an image cannot follow the caption/ },
  headingInFigure: { md: `:::figure\n## Heading\n![a](${MOON})\n:::`, problem: /figure: only images and a caption/ },
  compareMissingDont: { md: `::::compare\n:::do\nYes.\n:::\n::::`, problem: /compare: needs one :::do and one :::dont/ },
  compareSideNoText: { md: `::::compare\n:::do\n![a](${MOON})\n:::\n:::dont\nNo.\n:::\n::::`, problem: /compare: do needs a line of text/ },
  quoteNoBy: { md: `:::quote\nWords.\n:::`, problem: /quote: by is required/ },
  emptyCallout: { md: `:::callout[Label only]\n:::`, problem: /callout: needs some text/ },
};

/** Refused by the door, though remark renders something for each. */
export const DOOR_ONLY_FIXTURES: Record<string, { md: string; problem: RegExp }> = {
  sizeXl: { md: `:::figure{size=xl}\n![a](${MOON})\n:::`, problem: /figure: size=xl is not one of s, m, l, wide/ },
  frameTablet: { md: `:::figure{frame=tablet}\n![a](${MOON})\n:::`, problem: /figure: frame=tablet is not one of phone, desktop, none/ },
  unknownAttr: { md: `:::figure{colour=red}\n![a](${MOON})\n:::`, problem: /figure: unknown attribute colour/ },
  classShorthand: { md: `:::callout{.warn}\nx\n:::`, problem: /callout: unknown attribute class/ },
  labelOnFigure: { md: `:::figure[Label]\n![a](${MOON})\n:::`, problem: /figure takes no \[label\]/ },
  nested: { md: `::::callout\nText.\n:::gallery\n![a](${MOON})\n![b](${RAMPS})\n:::\n::::`, problem: /gallery: a staged block cannot sit inside callout/ },
  doOutsideCompare: { md: `:::do\nYes.\n:::`, problem: /do: only inside ::::compare/ },
  unknownContainer: { md: `:::warning\nCareful.\n:::`, problem: /:::warning is not a staging block/ },
  leafForm: { md: `::figure{frame=phone}`, problem: /::figure must be a container/ },
  unclosed: { md: `:::callout\nNever closed.`, problem: /callout: unclosed/ },
};

/** Not staging at all: must survive every consumer untouched. */
export const INERT_FIXTURES: Record<string, string> = {
  fenceInCode: "```md\n:::figure\n![a](https://example.com/a.png)\n:::\n```",
  inlineCode: "write `:::callout` on its own line",
  timeOfDay: "meet at 10:30 tomorrow",
};
```

- [ ] **Step 2: Typecheck it** — `npx tsc --noEmit -p tsconfig.json` (expect no errors from this file).

- [ ] **Step 3: Commit** — `Staging: test material from the kosymoz, pbbls and krabs articles`

---

### Task 3: The shape function

**Files:**
- Create: `lib/staging-parse.ts`
- Test: `lib/staging-parse.test.ts`

Background you need (verified with remark-directive against this repo):
- `:::figure{frame=phone dark}` parses to `{ type: "containerDirective", name: "figure", attributes: { frame: "phone", dark: "" }, children: [...] }`.
- `![a](u)\n![b](v)\nCap *em*` inside it is ONE paragraph: `image, text("\n"), image, text("\nCap "), emphasis`.
- A `[label]` becomes the container's first child: a paragraph with `data.directiveLabel === true`.
- `{.cls #i}` become `attributes.class` / `attributes.id`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/staging-parse.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { parseStagedBlock, type MdNode } from "./staging-parse";
import { STAGING_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES, NONCANONICAL_FIXTURES } from "./staging-fixtures";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const first = (md: string): MdNode => {
  const root = parser.parse(md) as unknown as MdNode;
  const node = (root.children ?? []).find((n) => n.type === "containerDirective");
  assert.ok(node, "fixture has a container");
  return node;
};
const parse = (md: string, strict = false) => parseStagedBlock(first(md), md, { strict });

test("every valid fixture parses, leniently and strictly", () => {
  for (const [name, md] of Object.entries(STAGING_FIXTURES)) {
    assert.equal(parse(md).ok, true, `${name} (lenient)`);
    assert.equal(parse(md, true).ok, true, `${name} (strict)`);
  }
});

test("a phone figure: frame, default size, one image, caption source verbatim", () => {
  const r = parse(STAGING_FIXTURES.phoneFigure);
  assert.ok(r.ok && r.value.block === "figure");
  assert.equal(r.value.frame, "phone");
  assert.equal(r.value.size, "m");
  assert.match(r.value.image.alt, /^Two scenes framed/);
  assert.equal(r.value.dark, null);
  assert.equal(r.value.caption?.source, "Scenes zoom in on the subject when the phone is upright.");
});

test("a dark figure takes its second image as the twin; markdown in the caption survives as source", () => {
  const r = parse(STAGING_FIXTURES.darkSvgFigure);
  assert.ok(r.ok && r.value.block === "figure");
  assert.match(r.value.dark!.src, /clock-dark\.svg$/);
  assert.equal(r.value.caption?.source, "The audio clock is the reference; *everything else* locks onto it.");
});

test("a gallery keeps each title as its image's caption, and its own caption after", () => {
  const r = parse(STAGING_FIXTURES.gallery);
  assert.ok(r.ok && r.value.block === "gallery");
  assert.deepEqual(r.value.images.map((i) => i.title), ["Classic", "Three ramps", "Four tints"]);
  assert.equal(r.value.caption?.source, "One moon, drawn four ways.");
});

test("a compare holds do then dont, each with an optional image and its text", () => {
  const r = parse(STAGING_FIXTURES.compare);
  assert.ok(r.ok && r.value.block === "compare");
  assert.ok(r.value.do.image && r.value.dont.image);
  assert.equal(r.value.do.text.source, "Show an almost still picture and drop the events.");
  const t = parse(STAGING_FIXTURES.textOnlyCompare);
  assert.ok(t.ok && t.value.block === "compare");
  assert.equal(t.value.do.image, null);
});

test("a callout's label is source and plain text; its body is the rest", () => {
  const r = parse(STAGING_FIXTURES.callout);
  assert.ok(r.ok && r.value.block === "callout");
  assert.equal(r.value.label?.source, "In two words: dithering");
  assert.equal(r.value.labelText, "In two words: dithering");
  assert.equal(r.value.body.length, 1);
  const u = parse(STAGING_FIXTURES.unlabeledCallout);
  assert.ok(u.ok && u.value.block === "callout");
  assert.equal(u.value.label, null);
});

test("a quote's by is required and its role optional", () => {
  const r = parse(STAGING_FIXTURES.quote);
  assert.ok(r.ok && r.value.block === "quote");
  assert.equal(r.value.by, "Alexis");
  assert.equal(r.value.role, "reviewing the feed explorations");
});

test("malformed blocks are refused in both modes, with the door's words", () => {
  for (const [name, { md, problem }] of Object.entries(MALFORMED_FIXTURES)) {
    for (const strict of [false, true]) {
      const r = parse(md, strict);
      assert.equal(r.ok, false, `${name} strict=${strict}`);
      if (!r.ok) assert.match(r.problem, problem, name);
    }
  }
});

test("lenient mode defaults unknown values; strict mode refuses them by name", () => {
  for (const name of ["sizeXl", "frameTablet", "unknownAttr", "classShorthand", "labelOnFigure"] as const) {
    const { md, problem } = DOOR_ONLY_FIXTURES[name];
    assert.equal(parse(md).ok, true, `${name} lenient`);
    const r = parse(md, true);
    assert.equal(r.ok, false, `${name} strict`);
    if (!r.ok) assert.match(r.problem, problem);
  }
  const r = parse(NONCANONICAL_FIXTURES.unknownValues);
  assert.ok(r.ok && r.value.block === "figure");
  assert.equal(r.value.frame, "none");
  assert.equal(r.value.size, "l");
});

test("a caption in its own paragraph is still the caption", () => {
  const r = parse(NONCANONICAL_FIXTURES.captionOnOwnParagraph);
  assert.ok(r.ok && r.value.block === "figure");
  assert.equal(r.value.caption?.source, "A caption after a blank line.");
});

test("a name that is not a block is not this function's", () => {
  const r = parse(DOOR_ONLY_FIXTURES.unknownContainer.md);
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Run, expect FAIL** (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/staging-parse.ts
import {
  BLOCK_ATTRIBUTES, FRAMES, SIZES, isFrame, isSize, isStagedBlock, resolveFrame, resolveSize,
  type Frame, type Size, type StagedBlock,
} from "./staging";

/**
 * THE shape of a staged block (spec §2), decided once over the mdast
 * container node. Three consumers call it and none re-derives it:
 *
 *  - remarkStaging (lib/markdown.ts), leniently, to decide what renders;
 *  - stagingProblems (lib/staging-check.ts), strictly, to refuse a post;
 *  - the editor's tokenizers (lib/staging-editor.ts), leniently, after
 *    finding a block's extent in marked's source — which is what keeps the
 *    editor from claiming a block the renderer would unwrap, or the reverse.
 *
 * Lenient and strict differ ONLY on vocabulary — an unknown attribute or
 * value, a label where none belongs. Shape problems (no image, a missing
 * side, no `by`) are refused in both, because a block with the wrong shape
 * has no right rendering: it unwraps to its children instead, which is what
 * every foreign container does already.
 *
 * Nesting is the callers' business: this function looks at one node.
 *
 * The node type is local, as in lib/markdown.ts: mdast-util-directive's types
 * arrive by declaration merging, and depending on them couples this file to a
 * transitive dependency's type exports.
 */
export interface MdNode {
  type: string;
  name?: string;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  attributes?: Record<string, string | null | undefined> | null;
  children?: MdNode[];
  data?: Record<string, unknown>;
  position?: { start: { offset?: number }; end: { offset?: number } };
}

export interface StagedImage {
  src: string;
  alt: string;
  title: string | null;
}

/** Inline markdown, as nodes (for the renderer) and as the author's own
 *  source text (for the editor, which must give it back byte for byte). */
export interface Phrase {
  nodes: MdNode[];
  source: string;
}

export interface Side {
  image: StagedImage | null;
  text: Phrase;
  node: MdNode;
}

export type ParsedBlock =
  | { block: "figure"; frame: Frame; size: Size; image: StagedImage; dark: StagedImage | null; caption: Phrase | null }
  | { block: "gallery"; frame: Frame; images: StagedImage[]; caption: Phrase | null }
  | { block: "compare"; do: Side; dont: Side }
  | { block: "callout"; label: Phrase | null; labelText: string | null; body: MdNode[] }
  | { block: "quote"; by: string; role: string | null; body: MdNode[] };

export type ParseResult = { ok: true; value: ParsedBlock } | { ok: false; problem: string };

const fail = (problem: string): ParseResult => ({ ok: false, problem });

export function plainText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  if (node.type === "image") return node.alt ?? "";
  return (node.children ?? []).map(plainText).join("");
}

const isLabel = (n: MdNode) => n.type === "paragraph" && n.data?.directiveLabel === true;
const isBlank = (n: MdNode) => (n.type === "text" && !(n.value ?? "").trim()) || n.type === "break";

/** The author's own text for a run of sibling nodes, from the source offsets.
 *  Falls back to plain text when offsets are missing, which loses emphasis
 *  rather than the words. */
function sourceOf(nodes: MdNode[], source: string): string {
  const from = nodes[0]?.position?.start.offset;
  const to = nodes[nodes.length - 1]?.position?.end.offset;
  if (typeof from === "number" && typeof to === "number") return source.slice(from, to).trim();
  return nodes.map(plainText).join("").trim();
}

/** A caption's first text node starts with the newline after the image line;
 *  the renderer should not see it. Clones, never mutates the tree. */
function trimmed(nodes: MdNode[]): MdNode[] {
  return nodes.map((n, i) => {
    if (n.type !== "text") return n;
    let value = n.value ?? "";
    if (i === 0) value = value.replace(/^\s+/, "");
    if (i === nodes.length - 1) value = value.replace(/\s+$/, "");
    return { ...n, value };
  });
}

const toImage = (n: MdNode): StagedImage => ({ src: n.url ?? "", alt: n.alt ?? "", title: n.title ?? null });

/** Images first, then at most one paragraph of caption. */
function splitMedia(
  kids: MdNode[],
  source: string,
  who: string,
): { images: StagedImage[]; caption: Phrase | null } | string {
  const images: StagedImage[] = [];
  let caption: MdNode[] | null = null;
  let captionParagraph = -1;
  for (let p = 0; p < kids.length; p++) {
    const para = kids[p];
    if (para.type !== "paragraph") return `${who}: only images and a caption belong inside`;
    for (const n of para.children ?? []) {
      if (caption === null) {
        if (n.type === "image") images.push(toImage(n));
        else if (n.type === "imageReference") return `${who}: use ![alt](url), not a reference image`;
        else if (!isBlank(n)) {
          caption = [n];
          captionParagraph = p;
        }
      } else {
        if (n.type === "image") return `${who}: an image cannot follow the caption`;
        if (p !== captionParagraph) return `${who}: the caption is one paragraph`;
        caption.push(n);
      }
    }
  }
  return { images, caption: caption ? { nodes: trimmed(caption), source: sourceOf(caption, source) } : null };
}

function vocabularyProblem(node: MdNode, name: StagedBlock): string | null {
  const allowed = BLOCK_ATTRIBUTES[name];
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (!allowed.includes(key)) return `${name}: unknown attribute ${key}`;
    if (key === "frame" && !isFrame(value)) return `${name}: frame=${value} is not one of ${FRAMES.join(", ")}`;
    if (key === "size" && !isSize(value)) return `${name}: size=${value} is not one of ${SIZES.join(", ")}`;
    if (key === "dark" && value) return `${name}: dark takes no value`;
  }
  return null;
}

export function parseStagedBlock(node: MdNode, source: string, opts: { strict: boolean }): ParseResult {
  const name = node.name;
  if (node.type !== "containerDirective" || !isStagedBlock(name)) return fail(`${name}: not a staging block`);

  if (opts.strict) {
    const problem = vocabularyProblem(node, name);
    if (problem) return fail(problem);
  }
  const attrs = node.attributes ?? {};
  const all = node.children ?? [];
  const labelNode = all.find(isLabel) ?? null;
  const kids = all.filter((n) => !isLabel(n));

  if (labelNode && name !== "callout" && opts.strict) return fail(`${name} takes no [label]`);

  switch (name) {
    case "figure": {
      const media = splitMedia(kids, source, "figure");
      if (typeof media === "string") return fail(media);
      const dark = attrs.dark !== undefined && attrs.dark !== null;
      if (dark && media.images.length !== 2) return fail("figure: dark needs two images, light then dark");
      if (!dark && media.images.length !== 1) return fail("figure: needs exactly one image");
      const frame = resolveFrame(attrs.frame);
      return {
        ok: true,
        value: { block: "figure", frame, size: resolveSize(attrs.size, frame), image: media.images[0], dark: dark ? media.images[1] : null, caption: media.caption },
      };
    }
    case "gallery": {
      const media = splitMedia(kids, source, "gallery");
      if (typeof media === "string") return fail(media);
      if (media.images.length < 2) return fail("gallery: needs at least two images");
      return { ok: true, value: { block: "gallery", frame: resolveFrame(attrs.frame), images: media.images, caption: media.caption } };
    }
    case "compare": {
      const sides = kids.filter((n) => !(n.type === "paragraph" && !plainText(n).trim()));
      const [a, b] = sides;
      if (sides.length !== 2 || a.type !== "containerDirective" || a.name !== "do" || b.type !== "containerDirective" || b.name !== "dont")
        return fail("compare: needs one :::do and one :::dont, in that order");
      const side = (n: MdNode, who: "do" | "dont"): Side | string => {
        if (opts.strict && Object.keys(n.attributes ?? {}).length > 0) return `compare: ${who} takes no attributes`;
        const media = splitMedia((n.children ?? []).filter((k) => !isLabel(k)), source, `compare: ${who}`);
        if (typeof media === "string") return media;
        if (media.images.length > 1) return `compare: each side holds at most one image`;
        if (!media.caption) return `compare: ${who} needs a line of text`;
        return { image: media.images[0] ?? null, text: media.caption, node: n };
      };
      const yes = side(a, "do");
      if (typeof yes === "string") return fail(yes);
      const no = side(b, "dont");
      if (typeof no === "string") return fail(no);
      return { ok: true, value: { block: "compare", do: yes, dont: no } };
    }
    case "callout": {
      if (kids.length === 0) return fail("callout: needs some text");
      const label = labelNode && (labelNode.children ?? []).length > 0
        ? { nodes: labelNode.children ?? [], source: sourceOf(labelNode.children ?? [], source) }
        : null;
      return { ok: true, value: { block: "callout", label, labelText: label ? plainText(labelNode!).trim() : null, body: kids } };
    }
    case "quote": {
      const by = (attrs.by ?? "").trim();
      if (!by) return fail("quote: by is required");
      if (kids.length === 0) return fail("quote: needs the quoted words");
      const role = (attrs.role ?? "").trim() || null;
      return { ok: true, value: { block: "quote", by, role, body: kids } };
    }
  }
}
```

Note the compare message is `needs one :::do and one :::dont, in that order` — the fixture regex `compare: needs one :::do and one :::dont` matches it.

- [ ] **Step 4: Run, expect PASS.** If a fixture fails because remark's tree differs from the background above, print the tree (`JSON.stringify(first(md), null, 1)`) and fix the parser, not the fixture — the fixtures are the grammar.

- [ ] **Step 5: Commit** — `Staging: one shape function over the container node`

---

### Task 4: The serializer

**Files:**
- Create: `lib/staging-markdown.ts`
- Test: `lib/staging-markdown.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/staging-markdown.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { parseStagedBlock, type MdNode, type ParsedBlock } from "./staging-parse";
import {
  serializeFigure, serializeGallery, serializeCompare, calloutOpener, quoteOpener,
  figureFields, galleryFields, compareFields,
} from "./staging-markdown";
import { STAGING_FIXTURES } from "./staging-fixtures";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const parsed = (md: string): ParsedBlock => {
  const node = ((parser.parse(md) as unknown as MdNode).children ?? [])[0];
  const r = parseStagedBlock(node, md, { strict: false });
  assert.ok(r.ok, md);
  return r.value;
};

test("media fixtures are canonical: serialize(fields(parse(x))) === x", () => {
  for (const name of ["phoneFigure", "desktopFigureSmall", "darkSvgFigure"] as const) {
    const v = parsed(STAGING_FIXTURES[name]);
    assert.ok(v.block === "figure");
    assert.equal(serializeFigure(figureFields(v)), STAGING_FIXTURES[name], name);
  }
  for (const name of ["gallery", "phoneGallery"] as const) {
    const v = parsed(STAGING_FIXTURES[name]);
    assert.ok(v.block === "gallery");
    assert.equal(serializeGallery(galleryFields(v)), STAGING_FIXTURES[name], name);
  }
  for (const name of ["compare", "textOnlyCompare"] as const) {
    const v = parsed(STAGING_FIXTURES[name]);
    assert.ok(v.block === "compare");
    assert.equal(serializeCompare(compareFields(v)), STAGING_FIXTURES[name], name);
  }
});

test("no image, no markdown — the EntityCard rule", () => {
  assert.equal(serializeFigure({ frame: "none", size: "l", src: "", alt: "", darkSrc: "", darkAlt: "", caption: "x" }), "");
  assert.equal(serializeGallery({ frame: "none", images: [], caption: "" }), "");
  assert.equal(serializeCompare({ do: { src: "", alt: "", text: "" }, dont: { src: "", alt: "", text: "" } }), "");
});

test("a gallery left with one image becomes a figure rather than losing it", () => {
  const md = serializeGallery({ frame: "phone", images: [{ src: "https://e.com/a.png", alt: "A", title: "Lake" }], caption: "Night" });
  assert.equal(md, ":::figure{frame=phone}\n![A](https://e.com/a.png)\nLake — Night\n:::");
});

test("escaping: alt brackets, title quotes, URL spaces and parens, block-starting captions", () => {
  const md = serializeFigure({
    frame: "none", size: "l", src: "https://e.com/a b(1).png", alt: "a [b] c", darkSrc: "", darkAlt: "", caption: "- not a list",
  });
  assert.equal(md, ":::figure\n![a \\[b\\] c](https://e.com/a%20b%281%29.png)\n\\- not a list\n:::");
  const g = serializeGallery({ frame: "none", images: [
    { src: "https://e.com/a.png", alt: "a", title: 'say "hi"' },
    { src: "https://e.com/b.png", alt: "b", title: "" },
  ], caption: "" });
  assert.match(g, /!\[a\]\(https:\/\/e\.com\/a\.png "say \\"hi\\""\)/);
  assert.equal(serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "", darkSrc: "", darkAlt: "", caption: ":::" }),
    ":::figure\n![](https://e.com/a.png)\n\\:::\n:::");
  assert.match(serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "", darkSrc: "", darkAlt: "", caption: "2. second" }), /\n2\\\. second\n/);
});

test("captions are one line", () => {
  const md = serializeFigure({ frame: "none", size: "l", src: "https://e.com/a.png", alt: "x", darkSrc: "", darkAlt: "", caption: "one\n two " });
  assert.match(md, /\none two\n:::$/);
});

test("openers: label escaping, bare and quoted attribute values", () => {
  assert.equal(calloutOpener(null), ":::callout");
  assert.equal(calloutOpener("In two words: dithering"), ":::callout[In two words: dithering]");
  assert.equal(calloutOpener("a [b]"), ":::callout[a \\[b\\]]");
  assert.equal(quoteOpener("Alexis", null), ":::quote{by=Alexis}");
  assert.equal(quoteOpener("Alexis B", 'said "so" & left'), ':::quote{by="Alexis B" role="said &quot;so&quot; &amp; left"}');
});

test("an escaped value parses back to itself", () => {
  const md = `${quoteOpener("Alexis B", 'said "so" & left')}\nq\n:::`;
  const v = parsed(md);
  assert.ok(v.block === "quote");
  assert.equal(v.by, "Alexis B");
  assert.equal(v.role, 'said "so" & left');
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/staging-markdown.ts
import { DEFAULT_FRAME, DEFAULT_SIZE, type Frame, type Size } from "./staging";
import type { ParsedBlock } from "./staging-parse";

/**
 * The canonical markdown of a staged block (spec §2.2), written by the
 * editor's media atoms on save. Media blocks are rebuilt from their fields
 * and never from editing inside them — that is what keeps a block's markdown
 * the size of its fields rather than whatever the editor's serializer makes
 * of a nested document.
 *
 * Pure and client-safe. A field that would change meaning on re-parse is
 * escaped rather than trusted: a caption opening with `- ` becomes a list,
 * one that is `:::` closes the block, and either would turn a valid figure
 * into one that unwraps.
 */

export interface FigureFields { frame: Frame; size: Size; src: string; alt: string; darkSrc: string; darkAlt: string; caption: string }
export interface GalleryImage { src: string; alt: string; title: string }
export interface GalleryFields { frame: Frame; images: GalleryImage[]; caption: string }
export interface SideFields { src: string; alt: string; text: string }
export interface CompareFields { do: SideFields; dont: SideFields }

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
const escapeLead = (s: string) =>
  s.replace(/^(\d+)([.)])/, "$1\\$2").replace(/^([#>+*:-])/, "\\$1");
const escapeAlt = (s: string) => oneLine(s).replace(/[\\[\]]/g, (c) => `\\${c}`);
const escapeTitle = (s: string) => oneLine(s).replace(/["\\]/g, (c) => `\\${c}`);
const escapeUrl = (s: string) => s.trim().replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

export const imageMarkdown = (i: { src: string; alt: string; title?: string | null }) =>
  `![${escapeAlt(i.alt)}](${escapeUrl(i.src)}${i.title && oneLine(i.title) ? ` "${escapeTitle(i.title)}"` : ""})`;

const attrValue = (v: string) =>
  /^[A-Za-z0-9_-]+$/.test(v) ? v : `"${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;

function attrs(pairs: Array<[string, string | true | null]>): string {
  const parts = pairs.flatMap(([k, v]) => (v === null ? [] : [v === true ? k : `${k}=${attrValue(v)}`]));
  return parts.length ? `{${parts.join(" ")}}` : "";
}

const caption = (s: string) => (oneLine(s) ? [escapeLead(oneLine(s))] : []);

export function serializeFigure(f: FigureFields): string {
  if (!f.src.trim()) return "";
  const opener = `:::figure${attrs([
    ["frame", f.frame === DEFAULT_FRAME ? null : f.frame],
    ["size", f.size === DEFAULT_SIZE[f.frame] ? null : f.size],
    ["dark", f.darkSrc.trim() ? true : null],
  ])}`;
  return [
    opener,
    imageMarkdown({ src: f.src, alt: f.alt }),
    ...(f.darkSrc.trim() ? [imageMarkdown({ src: f.darkSrc, alt: f.darkAlt })] : []),
    ...caption(f.caption),
    ":::",
  ].join("\n");
}

export function serializeGallery(g: GalleryFields): string {
  const images = g.images.filter((i) => i.src.trim());
  if (images.length === 0) return "";
  if (images.length === 1) {
    const [only] = images;
    return serializeFigure({
      frame: g.frame, size: DEFAULT_SIZE[g.frame], src: only.src, alt: only.alt, darkSrc: "", darkAlt: "",
      caption: [oneLine(only.title), oneLine(g.caption)].filter(Boolean).join(" — "),
    });
  }
  return [
    `:::gallery${attrs([["frame", g.frame === DEFAULT_FRAME ? null : g.frame]])}`,
    ...images.map(imageMarkdown),
    ...caption(g.caption),
    ":::",
  ].join("\n");
}

const side = (name: "do" | "dont", s: SideFields) =>
  [`:::${name}`, ...(s.src.trim() ? [imageMarkdown({ src: s.src, alt: s.alt })] : []), ...caption(s.text), ":::"];

export function serializeCompare(c: CompareFields): string {
  if (!oneLine(c.do.text) && !oneLine(c.dont.text)) return "";
  return ["::::compare", ...side("do", c.do), ...side("dont", c.dont), "::::"].join("\n");
}

export const calloutOpener = (label: string | null) =>
  label && oneLine(label) ? `:::callout[${oneLine(label).replace(/[\\[\]]/g, (c) => `\\${c}`)}]` : ":::callout";

export const quoteOpener = (by: string, role: string | null) =>
  `:::quote${attrs([["by", oneLine(by)], ["role", role && oneLine(role) ? oneLine(role) : null]])}`;

// ── From a parse to fields: what the editor's atoms store ──────────────────

export function figureFields(v: Extract<ParsedBlock, { block: "figure" }>): FigureFields {
  return {
    frame: v.frame, size: v.size, src: v.image.src, alt: v.image.alt,
    darkSrc: v.dark?.src ?? "", darkAlt: v.dark?.alt ?? "", caption: v.caption?.source ?? "",
  };
}

export function galleryFields(v: Extract<ParsedBlock, { block: "gallery" }>): GalleryFields {
  return { frame: v.frame, images: v.images.map((i) => ({ src: i.src, alt: i.alt, title: i.title ?? "" })), caption: v.caption?.source ?? "" };
}

export function compareFields(v: Extract<ParsedBlock, { block: "compare" }>): CompareFields {
  const f = (s: typeof v.do): SideFields => ({ src: s.image?.src ?? "", alt: s.image?.alt ?? "", text: s.text.source });
  return { do: f(v.do), dont: f(v.dont) };
}
```

Note: `escapeUrl` leaves an already-encoded URL alone except spaces/parens. A title in a fixture without quotes must round trip — the fixtures have none with quotes.

- [ ] **Step 4: Run, expect PASS.** If the escaped-label case fails to re-parse (remark-directive label escaping), prefer stripping `[`/`]` from labels as `EntityMention` does, change the test to match, and say so in the commit message.

- [ ] **Step 5: Commit** — `Staging: the canonical serializer`

---

### Task 5: The remark pass and the sanitize schema

**Files:**
- Modify: `lib/markdown.ts`
- Test: `lib/staging-render.test.ts` (new)

- [ ] **Step 1: Write the failing test** (HTML from the bare pipeline — no components yet, so custom tags appear as-is)

```ts
// lib/staging-render.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";
import { STAGING_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES, INERT_FIXTURES } from "./staging-fixtures";

const render = (md: string) => renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, md));

test("a figure mints its element, its images and its caption", () => {
  const html = render(STAGING_FIXTURES.phoneFigure);
  assert.match(html, /<staged-figure data-frame="phone" data-size="m">/);
  assert.match(html, /<staged-image src="https:\/\/res\.cloudinary\.com\/[^"]+cactnyq3vvr5c3qiygp9\.png" alt="Two scenes framed/);
  assert.match(html, /<staged-caption>Scenes zoom in on the subject when the phone is upright\.<\/staged-caption>/);
});

test("a dark twin is marked; caption markdown renders", () => {
  const html = render(STAGING_FIXTURES.darkSvgFigure);
  assert.match(html, /<staged-figure data-frame="none" data-size="wide">/);
  assert.match(html, /<staged-image[^>]*data-dark="true"/);
  assert.match(html, /<em>everything else<\/em>/);
});

test("gallery titles travel on the image", () => {
  assert.match(render(STAGING_FIXTURES.gallery), /<staged-image[^>]*title="Three ramps"/);
});

test("compare mints its two sides", () => {
  const html = render(STAGING_FIXTURES.compare);
  assert.match(html, /<staged-compare><staged-do><staged-image[^>]*><\/staged-image><staged-text>Show an almost still/);
  assert.match(html, /<staged-dont>/);
});

test("callout and quote carry their text attributes and keep block children", () => {
  const c = render(STAGING_FIXTURES.callout);
  assert.match(c, /<staged-callout data-label="In two words: dithering"><staged-label>In two words: dithering<\/staged-label><p>When you only/);
  const q = render(STAGING_FIXTURES.quote);
  assert.match(q, /<staged-quote data-by="Alexis" data-role="reviewing the feed explorations"><p>The Spine/);
});

test("entity cards and mentions still work inside a callout", () => {
  const html = render(STAGING_FIXTURES.calloutWithEntity);
  assert.match(html, /<entity-link data-ref="bean:sparkaik-music">the music<\/entity-link>/);
  assert.match(html, /<entity-card data-ref="bean:sparkaik-haptics">/);
});

test("a malformed block unwraps to its children, keeping every word and image", () => {
  for (const [name, { md }] of Object.entries(MALFORMED_FIXTURES)) {
    const html = render(md);
    assert.doesNotMatch(html, /<staged-/, name);
    assert.doesNotMatch(html, /<div/, `${name}: an unhandled directive renders as a div`);
  }
  assert.match(render(MALFORMED_FIXTURES.figureNoImage.md), /<p>Just words\.<\/p>/);
  assert.match(render(MALFORMED_FIXTURES.galleryOfOne.md), /<img src="https:\/\/res\.cloudinary\.com/);
});

test("a staged block nested inside another unwraps — the inner one", () => {
  const html = render(DOOR_ONLY_FIXTURES.nested.md);
  assert.match(html, /<staged-callout>/);
  assert.doesNotMatch(html, /<staged-gallery/);
  assert.match(html, /<img /);
});

test("do outside a compare and an unknown container are foreign", () => {
  assert.doesNotMatch(render(DOOR_ONLY_FIXTURES.doOutsideCompare.md), /<staged-/);
  assert.match(render(DOOR_ONLY_FIXTURES.unknownContainer.md), /<p>Careful\.<\/p>/);
});

test("the schema enforces the vocabulary a second time", () => {
  // Only reachable if the pass and the schema disagree; simulated by asserting
  // the lenient pass never emits a non-member and the schema lists only members.
  const html = render(DOOR_ONLY_FIXTURES.sizeXl.md);
  assert.match(html, /data-size="l"/);
});

test("a javascript: image source is stripped by the sanitizer", () => {
  const html = render(":::figure\n![x](javascript:alert(1))\n:::");
  assert.doesNotMatch(html, /javascript:/);
});

test("inert fixtures are untouched", () => {
  assert.match(render(INERT_FIXTURES.fenceInCode), /<code class="language-md">:::figure/);
  assert.match(render(INERT_FIXTURES.timeOfDay), /10:30/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** in `lib/markdown.ts`:

1. Add `unist-util-visit-parents` as a direct dependency (it is already installed under `unist-util-visit`): `npm install unist-util-visit-parents@^6` — check the installed major with `node -e "console.log(require('unist-util-visit-parents/package.json').version)"` and pin that major.
2. Extract the BOM-stripping lines of `remarkRestoreForeignDirectives` into a helper `sourceOf(file)` and use it in both passes.
3. Add the pass, between `remarkEntity` and `remarkRestoreForeignDirectives` in `remarkPlugins`:

```ts
import { visitParents } from "unist-util-visit-parents";
import { FRAMES, SIZES, isStagedBlock } from "./staging";
import { parseStagedBlock, type MdNode, type ParsedBlock, type Phrase, type StagedImage } from "./staging-parse";

// Spec 2026-11-15 §3.1. Claims the five staging containers that are VALID by
// lib/staging-parse.ts and rewrites them into custom elements the renderer
// maps to components/staging/*. An invalid one is left alone, so
// remarkRestoreForeignDirectives (below) unwraps it to its children exactly
// as it unwraps any foreign container — the reader keeps every image and
// every sentence of a block with the wrong shape.
//
// A staged block inside a CLAIMED staged block is not claimed: nesting is
// refused by the door and cannot be made in the editor, and when stored
// markdown has it anyway, the inner one unwraps. Unclaimed ancestors do not
// count — a broken figure that unwraps must not take a valid callout inside it
// down with it.
//
// Media blocks are restructured, not just renamed: their images become
// `staged-image` leaves and their caption a `staged-caption`, because a
// figure's component needs the image's data and the caption's RENDERED
// children separately, and server components have no context to pass one
// to the other.
function remarkStaging() {
  return (tree: unknown, file: { value?: unknown }) => {
    const source = sourceOf(file);
    const claimed = new WeakSet<object>();
    visitParents(tree as never, (node: MdNode, ancestors: MdNode[]) => {
      if (node.type !== "containerDirective" || !isStagedBlock(node.name)) return;
      if (ancestors.some((a) => claimed.has(a))) return;
      const result = parseStagedBlock(node, source, { strict: false });
      if (!result.ok) return;
      claimed.add(node);
      mint(node, result.value);
    });
  };
}

const stagedImage = (i: StagedImage, dark = false): MdNode => ({
  type: "stagedImage",
  data: {
    hName: "staged-image",
    hProperties: { src: i.src, alt: i.alt, ...(i.title ? { title: i.title } : {}), ...(dark ? { "data-dark": "true" } : {}) },
  },
});
const phrase = (hName: string, p: Phrase): MdNode => ({ type: "paragraph", data: { hName }, children: p.nodes });

function mint(node: MdNode, v: ParsedBlock): void {
  switch (v.block) {
    case "figure":
      node.data = { hName: "staged-figure", hProperties: { "data-frame": v.frame, "data-size": v.size } };
      node.children = [stagedImage(v.image), ...(v.dark ? [stagedImage(v.dark, true)] : []), ...(v.caption ? [phrase("staged-caption", v.caption)] : [])];
      return;
    case "gallery":
      node.data = { hName: "staged-gallery", hProperties: { "data-frame": v.frame } };
      node.children = [...v.images.map((i) => stagedImage(i)), ...(v.caption ? [phrase("staged-caption", v.caption)] : [])];
      return;
    case "compare": {
      const side = (s: typeof v.do, hName: string): MdNode => {
        s.node.data = { hName };
        s.node.children = [...(s.image ? [stagedImage(s.image)] : []), phrase("staged-text", s.text)];
        return s.node;
      };
      node.data = { hName: "staged-compare" };
      node.children = [side(v.do, "staged-do"), side(v.dont, "staged-dont")];
      return;
    }
    case "callout":
      node.data = { hName: "staged-callout", hProperties: v.labelText ? { "data-label": v.labelText } : {} };
      node.children = [...(v.label ? [phrase("staged-label", v.label)] : []), ...v.body];
      return;
    case "quote":
      node.data = { hName: "staged-quote", hProperties: { "data-by": v.by, ...(v.role ? { "data-role": v.role } : {}) } };
      node.children = v.body;
      return;
  }
}
```

Important: `remarkRestoreForeignDirectives` skips nodes with `data.hName`, so claimed blocks and their `do`/`dont` sides survive it; it still visits their children, which is how a foreign directive inside a callout is restored.

4. Widen `sanitizeSchema` (keep the comment style — this is "the single most confusing failure"):

```ts
const STAGED_TAGS = [
  "staged-figure", "staged-gallery", "staged-compare", "staged-do", "staged-dont",
  "staged-callout", "staged-quote", "staged-image", "staged-caption", "staged-text", "staged-label",
];
// tagNames: [...existing, "entity-card", "entity-link", ...STAGED_TAGS]
// attributes, added:
"staged-figure": [["data-frame", ...FRAMES], ["data-size", ...SIZES]],
"staged-gallery": [["data-frame", ...FRAMES]],
"staged-image": ["src", "alt", "title", ["data-dark", "true"]],
"staged-callout": ["data-label"],
"staged-quote": ["data-by", "data-role"],
```

`defaultSchema.protocols.src` (`http`, `https`) applies to `staged-image`'s `src` by attribute name, which is what strips `javascript:`. If the test shows it does not, add `protocols: { ...defaultSchema.protocols, src: ["http", "https"] }` explicitly.

- [ ] **Step 4: Run** `lib/staging-render.test.ts`, `lib/markdown.test.ts`, `lib/markdown-conformance.test.ts` and `lib/entity-refs.test.ts`. Expect PASS. `markdown-conformance.test.ts`'s "no rendered output ever contains a div" must still pass.

- [ ] **Step 5: Commit** — `Staging: the remark pass mints the five blocks`

---

### Task 6: Frames, icons and the SVG transform guard

**Files:**
- Modify: `components/phone-frame.tsx`, `components/phone-frame.test.tsx`
- Create: `components/desktop-frame.tsx`, `components/desktop-frame.test.tsx`
- Modify: `components/public-icons.tsx` (+ its drift test), `lib/image-url.ts` (+ its test)
- Modify: `lib/server-safe-source.test.ts`

- [ ] **Step 1: Failing tests**

Append to `components/phone-frame.test.tsx`:

```tsx
const wrapper = (markup: string) => markup.match(/^<span[^>]*>/)?.[0] ?? "";

test("the phone is a quiet outline in both themes, never a dark bezel", () => {
  const tag = wrapper(renderToStaticMarkup(<PhoneFrame image={image(true)} alt="" width={400} />));
  assert.doesNotMatch(tag, /bg-neutral-900/);
  assert.match(tag, /border-border/);
});

test("bottomless, the outline is open at the bottom", () => {
  const tag = wrapper(renderToStaticMarkup(<PhoneFrame image={image(true)} alt="" width={400} height={300} />));
  assert.match(tag, /border-b-0/);
  assert.match(tag, /rounded-b-none/);
});
```

Create `components/desktop-frame.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopFrame } from "./desktop-frame";

test("a desktop frame: hairline, a three-dot strip, the image with its alt", () => {
  const html = renderToStaticMarkup(<DesktopFrame src="https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.png" alt="The cromlech" width={1536} />);
  assert.match(html, /border-border/);
  assert.equal((html.match(/rounded-full/g) ?? []).length, 3);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /alt="The cromlech"/);
  assert.match(html, /w_1536/);
});
```

Append to `lib/image-url.test.ts` (find the file; if absent, create it with the usual imports):

```ts
test("an SVG is never transformed — a transform would rasterize it", () => {
  const svg = "https://res.cloudinary.com/c/image/upload/v1/beanstalk/clock.svg";
  assert.equal(cloudinaryFit(svg, { width: 800 }), svg);
  assert.equal(cloudinaryThumb(svg, { width: 80, height: 80 }), svg);
});
```

Extend `components/public-icons.test.tsx` the way it already compares each glyph to lucide's, adding `CheckIcon` ↔ lucide `Check` and `XIcon` ↔ lucide `X`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`lib/image-url.ts` — at the top of `withTransform`, after parsing:

```ts
  // An SVG is a vector: Cloudinary "resizes" one by rasterizing it, which turns
  // a crisp figure into a blurry PNG at whatever width was asked for (spec
  // 2026-11-15 §3.4). Delivered as stored, always.
  if (parsed.pathname.toLowerCase().endsWith(".svg")) return url;
```

`components/phone-frame.tsx` — replace the wrapper `<span>`'s classes and the `<img>`'s classes, and rewrite the docblock's `bg-neutral-900` paragraph (the decision is now spec 2026-11-15 decision 5: a quiet outline everywhere, on theme tokens because an outline must show in both themes, which a dark body never had to):

```tsx
    <span
      className={`block overflow-hidden border border-border ${
        bottomless ? "rounded-t-[1.75rem] rounded-b-none border-b-0" : "rounded-[1.75rem]"
      } ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ... className="block w-full" />
    </span>
```

Keep the `block` rationale paragraph (it is still load-bearing) but reword "the bezel collapses to a dark tick" to "the outline collapses to a hairline beside the screen". Keep `alt` required and the intrinsic-size logic untouched.

`components/desktop-frame.tsx`:

```tsx
import { cloudinaryFit } from "@/lib/image-url";

/**
 * A desktop screenshot, framed (spec 2026-11-15 §3.3): a hairline, the
 * theme's radius, and an 18px strip with three dots. It identifies a screen
 * without drawing a browser — traffic lights date, and a window chrome
 * competes with what is inside it. The phone's sibling: same outline, same
 * tokens, so the two read as one family.
 *
 * SERVER-SAFE, on lib/server-safe-source.test.ts's list. `width` is the
 * DERIVATIVE's (twice the painted width), as in PhoneFrame.
 */
export function DesktopFrame({ src, alt, width, imgClassName }: { src: string; alt: string; width: number; imgClassName?: string }) {
  return (
    <span className="block overflow-hidden rounded-xl border border-border bg-card">
      <span aria-hidden="true" className="flex h-[18px] items-center gap-[5px] border-b border-border bg-muted px-2.5">
        <span className="size-[7px] rounded-full bg-muted-foreground/40" />
        <span className="size-[7px] rounded-full bg-muted-foreground/40" />
        <span className="size-[7px] rounded-full bg-muted-foreground/40" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cloudinaryFit(src, { width })} alt={alt} loading="lazy" decoding="async" className={`block ${imgClassName ?? "w-full"}`} />
    </span>
  );
}
```

`components/public-icons.tsx` — add `CheckIcon` and `XIcon`, copying `__iconNode` from `node_modules/lucide-react/dist/esm/icons/check.mjs` and `x.mjs` exactly as the file's header instructs, and update the header's count ("ten glyphs" → "twelve").

Add `"components/desktop-frame.tsx"` to `SERVER_SAFE`.

- [ ] **Step 4: Run** the four test files plus `lib/server-safe-source.test.ts`; expect PASS. Run `npm test` in full — the bean cover and screen strip tests must still pass.

- [ ] **Step 5: Commit** — `Frames: the phone goes quiet everywhere, a desktop frame joins it`

---

### Task 7: The staging components and the markdown map

**Files:**
- Create: `components/staging/staged-image.tsx`, `figure.tsx`, `gallery.tsx`, `compare.tsx`, `callout.tsx`, `quote.tsx`, `markdown-components.tsx`
- Modify: `components/markdown.tsx`, `lib/server-safe-source.test.ts`
- Test: `components/staging/staging.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// components/staging/staging.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "@/lib/markdown";
import { stagingComponents } from "./markdown-components";
import { STAGING_FIXTURES } from "@/lib/staging-fixtures";

const render = (md: string, lang: "en" | "fr" = "en") =>
  renderToStaticMarkup(<Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={stagingComponents(lang)}>{md}</Markdown>);

test("a figure is a <figure> with a linked image and a figcaption", () => {
  const html = render(STAGING_FIXTURES.phoneFigure);
  assert.match(html, /^<figure class="[^"]*not-prose/);
  assert.match(html, /<a href="https:\/\/res\.cloudinary\.com\/[^"]+cactnyq3vvr5c3qiygp9\.png"/);
  assert.match(html, /<figcaption[^>]*>Scenes zoom in/);
  assert.doesNotMatch(html, /staged-/);
});

test("every staged image links to its original, so it is reachable script-off", () => {
  for (const [name, md] of Object.entries(STAGING_FIXTURES)) {
    const html = render(md);
    const imgs = (html.match(/<img /g) ?? []).length;
    const links = (html.match(/<a href="https:\/\/res\.cloudinary\.com/g) ?? []).length;
    assert.equal(links, imgs, name);
  }
});

test("an SVG is drawn as <img>, untransformed; its dark twin is hidden by class", () => {
  const html = render(STAGING_FIXTURES.darkSvgFigure);
  assert.match(html, /<img src="https:\/\/res\.cloudinary\.com\/t5gexxs5\/image\/upload\/v1794700000\/beanstalk\/clock\.svg"/);
  assert.match(html, /class="dark:hidden"/);
  assert.match(html, /class="hidden dark:block"/);
  assert.doesNotMatch(html, /<svg/);
});

test("raster derivatives are sized from the size class", () => {
  assert.match(render(STAGING_FIXTURES.desktopFigureSmall), /w_480/); // s = 240 × 2
});

test("compare says its verdict in words, in the page's language", () => {
  assert.match(render(STAGING_FIXTURES.compare), />Do<\/p>[\s\S]*>Don&#x27;t<\/p>/);
  assert.match(render(STAGING_FIXTURES.compare, "fr"), />À faire<\/p>[\s\S]*>À éviter<\/p>/);
});

test("a callout is an aside named by its label", () => {
  const html = render(STAGING_FIXTURES.callout);
  assert.match(html, /^<aside aria-label="In two words: dithering"/);
  assert.match(render(STAGING_FIXTURES.unlabeledCallout), /^<aside class=/);
});

test("a quote is a figure: blockquote, then — by, role", () => {
  const html = render(STAGING_FIXTURES.quote);
  assert.match(html, /<figure[^>]*><span aria-hidden="true"[^>]*>“<\/span><blockquote[^>]*><p>The Spine/);
  assert.match(html, /<figcaption[^>]*>— Alexis, reviewing the feed explorations<\/figcaption>/);
});

test("a phone gallery uses PhoneFrame; a plain one shares a row height", () => {
  assert.match(render(STAGING_FIXTURES.phoneGallery), /rounded-\[1\.75rem\]/);
  assert.match(render(STAGING_FIXTURES.gallery), /max-h-56/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** All files: no `"use client"`, no `lucide-react`, no `next/link`, no `node:`. Each gets a short docblock naming spec 2026-11-15 and why it is server-safe.

```tsx
// components/staging/staged-image.tsx
import type { ReactNode } from "react";
import { cloudinaryFit } from "@/lib/image-url";
import { PhoneFrame } from "@/components/phone-frame";
import { DesktopFrame } from "@/components/desktop-frame";
import type { Frame } from "@/lib/staging";

export interface ImageData { src: string; alt: string; title?: string | null }

/**
 * One staged image: always a real link to the original (spec §3.4 — script
 * off, every media item is reachable full size), drawn through the frame its
 * block asked for. `width` is the PAINTED width; derivatives ask for twice it.
 */
export function FramedImage({ image, frame, width, imgClassName }: { image: ImageData; frame: Frame; width: number; imgClassName?: string }): ReactNode {
  const inner =
    frame === "phone" ? (
      <PhoneFrame image={{ kind: "image", storageKey: "", url: image.src }} alt={image.alt} width={width * 2} />
    ) : frame === "desktop" ? (
      <DesktopFrame src={image.src} alt={image.alt} width={width * 2} imgClassName={imgClassName} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cloudinaryFit(image.src, { width: width * 2 })} alt={image.alt} loading="lazy" decoding="async"
        className={`block rounded-xl border border-border ${imgClassName ?? "w-full"}`} />
    );
  return <a href={image.src} className="block">{inner}</a>;
}
```

If `MediaImage` requires more fields than `kind`/`storageKey`/`url`, build the smallest valid one and leave a comment that PhoneFrame reads only `url`, `width`, `height`.

```tsx
// components/staging/figure.tsx
import type { ReactNode } from "react";
import { SIZE_WIDTH, type Frame, type Size } from "@/lib/staging";
import { FramedImage, type ImageData } from "./staged-image";

/** Breakout for `wide` is margins, never a transform (CLAUDE.md, entity-rail
 *  rule: a transform makes a containing block). Below `sm` every size but `s`
 *  is the column. */
export const SIZE_CLASS: Record<Size, string> = {
  s: "mx-auto w-full max-w-60",
  m: "mx-auto w-full sm:max-w-96",
  l: "w-full",
  wide: "w-full lg:mx-[calc((100%_-_min(60rem,calc(100vw_-_4rem)))/2)] lg:w-[min(60rem,calc(100vw_-_4rem))] lg:max-w-none",
};

export function StagedFigure({ frame, size, image, dark, caption }: {
  frame: Frame; size: Size; image: ImageData; dark: ImageData | null; caption?: ReactNode;
}) {
  const width = SIZE_WIDTH[size];
  return (
    <figure className={`not-prose my-8 ${SIZE_CLASS[size]}`}>
      {dark ? (
        <>
          <div className="dark:hidden"><FramedImage image={image} frame={frame} width={width} /></div>
          <div className="hidden dark:block"><FramedImage image={dark} frame={frame} width={width} /></div>
        </>
      ) : (
        <FramedImage image={image} frame={frame} width={width} />
      )}
      {caption ? <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
```

Wait — the hidden dark `<img>` must not be fetched: `loading="lazy"` on a `display:none` image defers it in Chromium and Firefox, which is why every staged `<img>` is lazy. Leave that sentence as a comment above the two `<div>`s.

```tsx
// components/staging/gallery.tsx
import type { ReactNode } from "react";
import type { Frame } from "@/lib/staging";
import { FramedImage, type ImageData } from "./staged-image";

/** Spec decision 7: natural ratios at a shared row height, rows centred — pure
 *  CSS, no stored dimensions. Phone screens are equal-ratio by nature, so a
 *  phone gallery is even columns instead. */
export function StagedGallery({ frame, images, caption }: { frame: Frame; images: ImageData[]; caption?: ReactNode }) {
  const cell = (img: ImageData, i: number, width: number, imgClassName?: string) => (
    <figure key={i} className="m-0 min-w-0">
      <FramedImage image={img} frame={frame} width={width} imgClassName={imgClassName} />
      {img.title ? <figcaption className="mt-1.5 text-xs leading-snug text-muted-foreground">{img.title}</figcaption> : null}
    </figure>
  );
  return (
    <figure className="not-prose my-8">
      {frame === "phone" ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(0, 1fr))` }}>
          {images.map((img, i) => cell(img, i, 256))}
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-center gap-3.5">
          {images.map((img, i) => cell(img, i, 480, "h-auto max-h-56 w-auto max-w-full"))}
        </div>
      )}
      {caption ? <figcaption className="mt-3 text-center text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
```

```tsx
// components/staging/compare.tsx
import type { ReactNode } from "react";
import { CheckIcon, XIcon } from "@/components/public-icons";
import type { CompareSide as Verdict } from "@/lib/staging";
import { FramedImage, type ImageData } from "./staged-image";

export function StagedCompare({ children }: { children?: ReactNode }) {
  return <div className="not-prose my-8 grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** The verdict is a WORD beside the mark — never colour alone (spec §3.2). */
export function CompareSide({ verdict, label, image, text }: { verdict: Verdict; label: string; image: ImageData | null; text?: ReactNode }) {
  const ok = verdict === "do";
  return (
    <figure className="m-0">
      <p className={`mb-2 flex items-center gap-1.5 font-heading text-xs font-medium ${ok ? "text-primary" : "text-destructive"}`}>
        <span className={`inline-flex size-[18px] items-center justify-center rounded-full text-white ${ok ? "bg-primary" : "bg-destructive"}`}>
          {ok ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
        </span>
        {label}
      </p>
      {image ? <FramedImage image={image} frame="none" width={384} /> : null}
      <figcaption className="mt-2 text-sm leading-snug text-foreground/80">{text}</figcaption>
    </figure>
  );
}
```

```tsx
// components/staging/callout.tsx
import type { ReactNode } from "react";

/** An aside on the muted plate (spec decision 9). Body stays prose-styled —
 *  it is real markdown — so this is NOT `not-prose`. The accessible name is
 *  the label's plain text: server components have no useId to point
 *  aria-labelledby at. */
export function StagedCallout({ labelText, children }: { labelText?: string | null; children?: ReactNode }) {
  return (
    <aside aria-label={labelText ?? undefined} className="my-6 rounded-2xl bg-muted px-5 py-1 text-[0.95rem] [&>p:first-child]:mt-4 [&>p:last-child]:mb-4">
      {children}
    </aside>
  );
}

export function CalloutLabel({ children }: { children?: ReactNode }) {
  return <p className="mb-1 font-heading text-sm font-medium tracking-tight text-foreground">{children}</p>;
}
```

```tsx
// components/staging/quote.tsx
import type { ReactNode } from "react";

/** Someone's own words, attributed (spec decision 9). Set a step larger with a
 *  hanging mark; typography's automatic quote marks are turned off so the
 *  author's text is not wrapped in a second pair. */
export function StagedQuote({ by, role, children }: { by: string; role?: string | null; children?: ReactNode }) {
  return (
    <figure className="relative my-8 pl-7">
      <span aria-hidden="true" className="absolute -top-2 left-0 font-heading text-5xl leading-none text-muted-foreground/40">“</span>
      <blockquote className="m-0 border-0 p-0 text-lg font-normal not-italic text-foreground [&_p]:before:content-none [&_p]:after:content-none">
        {children}
      </blockquote>
      <figcaption className="mt-2 text-sm text-muted-foreground">— {by}{role ? `, ${role}` : ""}</figcaption>
    </figure>
  );
}
```

```tsx
// components/staging/markdown-components.tsx
import type { ReactNode } from "react";
import type { Element, ElementContent } from "hast";
import { COMPARE_LABELS, resolveFrame, resolveSize } from "@/lib/staging";
import type { Lang } from "@/lib/locale";
import type { ImageData } from "./staged-image";
import { StagedFigure } from "./figure";
import { StagedGallery } from "./gallery";
import { StagedCompare, CompareSide } from "./compare";
import { StagedCallout, CalloutLabel } from "./callout";
import { StagedQuote } from "./quote";

/**
 * The staged tags → components, for react-markdown (spec §3.2). ONE map,
 * used by components/markdown.tsx's <Prose> on the public site AND by the
 * editor's node views (components/editor/staging-views.tsx), so the author
 * sees what the visitor sees — the shared-surfaces rule.
 *
 * A media block's images arrive as `staged-image` leaves, already sanitized;
 * their data is read from the hast `node` and the leaf itself renders
 * nothing, while the caption arrives as rendered `children`. That split is
 * forced: a server component cannot hand data to its child through context.
 */
type Props = { node?: Element; children?: ReactNode } & Record<string, unknown>;

const isEl = (c: ElementContent, tag: string): c is Element => c.type === "element" && c.tagName === tag;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
function imagesOf(node?: Element): Array<ImageData & { dark: boolean }> {
  return (node?.children ?? []).flatMap((c) =>
    isEl(c, "staged-image")
      ? [{ src: str(c.properties.src), alt: str(c.properties.alt), title: c.properties.title ? str(c.properties.title) : null,
           dark: str(c.properties["data-dark"] ?? c.properties.dataDark) === "true" }]
      : [],
  );
}
const hasChild = (node: Element | undefined, tag: string) => (node?.children ?? []).some((c) => isEl(c, tag));

export function stagingComponents(lang: Lang) {
  const labels = COMPARE_LABELS[lang];
  return {
    "staged-image": () => null,
    "staged-caption": ({ children }: Props) => <>{children}</>,
    "staged-text": ({ children }: Props) => <>{children}</>,
    "staged-label": ({ children }: Props) => <CalloutLabel>{children}</CalloutLabel>,
    "staged-figure": ({ node, children, ...p }: Props) => {
      const imgs = imagesOf(node);
      const light = imgs.find((i) => !i.dark);
      if (!light) return <>{children}</>; // the sanitizer took the src: show what is left
      const frame = resolveFrame(p["data-frame"]);
      return <StagedFigure frame={frame} size={resolveSize(p["data-size"], frame)} image={light}
        dark={imgs.find((i) => i.dark) ?? null} caption={hasChild(node, "staged-caption") ? children : null} />;
    },
    "staged-gallery": ({ node, children, ...p }: Props) => (
      <StagedGallery frame={resolveFrame(p["data-frame"])} images={imagesOf(node)} caption={hasChild(node, "staged-caption") ? children : null} />
    ),
    "staged-compare": ({ children }: Props) => <StagedCompare>{children}</StagedCompare>,
    "staged-do": ({ node, children }: Props) => <CompareSide verdict="do" label={labels.do} image={imagesOf(node)[0] ?? null} text={children} />,
    "staged-dont": ({ node, children }: Props) => <CompareSide verdict="dont" label={labels.dont} image={imagesOf(node)[0] ?? null} text={children} />,
    "staged-callout": ({ children, ...p }: Props) => <StagedCallout labelText={p["data-label"] ? str(p["data-label"]) : null}>{children}</StagedCallout>,
    "staged-quote": ({ children, ...p }: Props) => <StagedQuote by={str(p["data-by"])} role={p["data-role"] ? str(p["data-role"]) : null}>{children}</StagedQuote>,
  };
}
```

Check how react-markdown names `data-*` props for custom elements: the entity map reads `props["data-ref"]`, so `p["data-frame"]` is right. For hast `properties`, sanitized literal keys may be `data-dark` or camel-cased `dataDark` — `imagesOf` reads both; once the test shows which, delete the other read and say which in a comment.

`components/markdown.tsx`: import `stagingComponents` and spread `...stagingComponents(lang)` into the per-render `components` object (before the entity entries). Update the `as Components` cast comment: "The staged and entity tag names are not in react-markdown's element map".

Add every new file under `components/staging/` to `SERVER_SAFE` with one comment line above the group: `// The staging blocks (spec 2026-11-15 §3.2) — rendered on every public prose page, and drawn by the editor's node views from the same files.`

- [ ] **Step 4: Run** the new test, `lib/server-safe-source.test.ts`, and `npm test`. Expect PASS.

- [ ] **Step 5: Commit** — `Staging: the public components, one map for site and editor`

---

### Task 8: Excerpts skip the fences

**Files:**
- Modify: `lib/narrative-excerpt.ts`, `lib/narrative-excerpt.test.ts`

- [ ] **Step 1: Failing test** (append)

```ts
import { STAGING_FIXTURES } from "./staging-fixtures";

test("a document opening with a figure previews its first sentence of prose", () => {
  const md = `${STAGING_FIXTURES.phoneFigure}\n\nThe lake opens the evening.`;
  assert.equal(narrativeExcerpt(md), "Scenes zoom in on the subject when the phone is upright. The lake opens the evening.");
});

test("fence lines and a callout's label never reach a preview", () => {
  const out = narrativeExcerpt(`${STAGING_FIXTURES.callout}\n\n${STAGING_FIXTURES.compare}`);
  assert.doesNotMatch(out, /:::|callout|In two words|\{|compare/);
  assert.match(out, /^When you only have a few shades/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** — in `flatten`, right after the two fence rules and before the entity rule:

```ts
      // Staging fences (spec 2026-11-15 §3.5): `:::figure{…}`, `::::compare`,
      // a callout's `:::callout[label]`, and the bare closers — structure,
      // not prose. The label goes with its line: it names the aside, and a
      // preview that opens on "In two words: dithering" reads as a heading.
      .replace(/^ {0,3}:{3,}[A-Za-z]*(?:\[[^\]\n]*\])?(?:\{[^}\n]*\})?[ \t]*$/gm, " ")
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `Excerpts: staging fences are structure, not prose`

---

### Task 9: The fence finder for marked

**Files:**
- Create: `lib/staging-fence.ts`
- Test: `lib/staging-fence.test.ts`

Remark's rules (spec §2.3, verified): a closing fence of length L closes every open container whose opener is ≤ L, innermost first; an unclosed container runs to the end; fenced code is opaque.

- [ ] **Step 1: Failing test**

```ts
// lib/staging-fence.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { findContainerEnd } from "./staging-fence";
import { STAGING_FIXTURES } from "./staging-fixtures";

test("a block ends after its closing fence and that line's newline", () => {
  const src = `${STAGING_FIXTURES.callout}\n\nafter`;
  assert.equal(src.slice(0, findContainerEnd(src)!), `${STAGING_FIXTURES.callout}\n`);
});

test("compare survives the inner closers", () => {
  const src = `${STAGING_FIXTURES.compare}\nafter`;
  assert.equal(findContainerEnd(src), STAGING_FIXTURES.compare.length + 1);
});

test("a longer closer closes every shorter-or-equal open container", () => {
  const src = "::::compare\n:::do\nyes\n::::\nafter";
  assert.equal(src.slice(0, findContainerEnd(src)!), "::::compare\n:::do\nyes\n::::\n");
});

test("same-length nesting closes both at the first closer", () => {
  const src = ":::callout\n:::gallery\nx\n:::\nmore\n:::";
  assert.equal(src.slice(0, findContainerEnd(src)!), ":::callout\n:::gallery\nx\n:::\n");
});

test("an unclosed container runs to the end", () => {
  const src = ":::callout\nnever closed\n\nstill inside";
  assert.equal(findContainerEnd(src), src.length);
});

test("a fence inside fenced code is opaque", () => {
  const src = ":::callout\n```\n:::\n```\nreal\n:::\nafter";
  assert.equal(src.slice(0, findContainerEnd(src)!), ":::callout\n```\n:::\n```\nreal\n:::\n");
});

test("an indented closer (up to 3 spaces) counts; 4 does not", () => {
  assert.equal(findContainerEnd(":::callout\nx\n   :::\ny"), ":::callout\nx\n   :::\n".length);
  assert.equal(findContainerEnd(":::callout\nx\n    :::\ny"), ":::callout\nx\n    :::\ny".length);
});

test("not an opener → null", () => {
  assert.equal(findContainerEnd("text\n:::"), null);
  assert.equal(findContainerEnd("::entity{ref=bean:x}"), null);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/staging-fence.ts
/**
 * Where a container directive ends, by remark-directive's rules (spec
 * 2026-11-15 §2.3), for marked — which has no idea containers exist and must
 * be told how far to advance. Over-reading here swallows the rest of the
 * document into one block; under-reading leaves a stray `:::` paragraph. Both
 * were checked against remark before this was written, and
 * lib/markdown-conformance.test.ts holds the two to agreement.
 *
 * Returns an offset into `src` just past the closing line's newline, or
 * `src.length` for a container that never closes (remark runs it to the end
 * of the document too), or null when `src` does not open with a container.
 */
const OPEN = /^ {0,3}(:{3,})[A-Za-z]/;
const CLOSE = /^ {0,3}(:{3,})[ \t]*$/;
const CODE = /^ {0,3}(`{3,}|~{3,})/;

export function findContainerEnd(src: string): number | null {
  const first = OPEN.exec(src);
  if (!first) return null;
  const stack: number[] = [first[1].length];
  let offset = src.indexOf("\n");
  if (offset === -1) return src.length;
  offset += 1;
  let code: string | null = null;

  while (offset < src.length) {
    const nl = src.indexOf("\n", offset);
    const lineEnd = nl === -1 ? src.length : nl;
    const line = src.slice(offset, lineEnd);
    const next = nl === -1 ? src.length : nl + 1;

    const fence = CODE.exec(line);
    if (code) {
      if (fence && fence[1][0] === code[0] && fence[1].length >= code.length && !line.slice(fence[0].length).trim()) code = null;
    } else if (fence) {
      code = fence[1];
    } else {
      const close = CLOSE.exec(line);
      const open = OPEN.exec(line);
      if (close) {
        const len = close[1].length;
        while (stack.length > 0 && stack[stack.length - 1] <= len) stack.pop();
        if (stack.length === 0) return next;
      } else if (open) {
        stack.push(open[1].length);
      }
    }
    offset = next;
  }
  return src.length;
}
```

Edge: a closer longer than nothing open but not ≥ the outermost (e.g. `:::` while only `::::` is open) pops nothing — correct per remark.

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `Staging: where a container ends, by remark's rules, for marked`

---

### Task 10: The editor nodes and the conformance suite

**Files:**
- Create: `lib/staging-editor.ts`
- Modify: `lib/entity-markdown.ts` (`headlessExtensions`), `lib/markdown-conformance.test.ts`
- Test: `lib/staging-editor.test.ts`

Read first: `lib/entity-markdown.ts` (how `EntityCard` declares `markdownTokenizer`, `parseMarkdown`, `renderMarkdown`, and why `start` must not use `^`), and the blockquote extension's markdown handlers in `node_modules/@tiptap/extension-blockquote/dist/index.js` (search `renderMarkdown`) for how a node with block children uses `helpers.renderChildren` and how its tokenizer uses `lexer.blockTokens`.

- [ ] **Step 1: Failing tests**

```ts
// lib/staging-editor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { headlessExtensions } from "./entity-markdown";
import { STAGING_FIXTURES, NONCANONICAL_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES } from "./staging-fixtures";

const manager = new MarkdownManager({ extensions: headlessExtensions, indentation: { style: "space", size: 3 } });
const schema = getSchema(headlessExtensions as never);
const doc = (md: string) => manager.parse(md);
const roundTrip = (md: string) => manager.serialize(manager.parse(md)).trim();

test("each block parses to its node", () => {
  const types = (md: string) => (doc(md).content ?? []).map((n) => n.type);
  assert.deepEqual(types(STAGING_FIXTURES.phoneFigure), ["stagedFigure"]);
  assert.deepEqual(types(STAGING_FIXTURES.gallery), ["stagedGallery"]);
  assert.deepEqual(types(STAGING_FIXTURES.compare), ["stagedCompare"]);
  assert.deepEqual(types(STAGING_FIXTURES.callout), ["stagedCallout"]);
  assert.deepEqual(types(STAGING_FIXTURES.quote), ["stagedQuote"]);
});

test("canonical fixtures round-trip byte for byte", () => {
  for (const [name, md] of Object.entries(STAGING_FIXTURES)) assert.equal(roundTrip(md), md, name);
});

test("every parsed document is schema-valid (the freeze-on-next-keystroke class)", () => {
  for (const [name, md] of Object.entries({ ...STAGING_FIXTURES, ...NONCANONICAL_FIXTURES })) {
    assert.doesNotThrow(() => PMNode.fromJSON(schema, doc(md)).check(), name);
  }
});

test("the figure atom stores its fields; the caption is source", () => {
  const node = doc(STAGING_FIXTURES.darkSvgFigure).content![0];
  assert.equal(node.attrs!.size, "wide");
  assert.match(node.attrs!.darkSrc, /clock-dark\.svg$/);
  assert.equal(node.attrs!.caption, "The audio clock is the reference; *everything else* locks onto it.");
});

test("text blocks keep editable children, entity nodes included", () => {
  const node = doc(STAGING_FIXTURES.calloutWithEntity).content![0];
  assert.equal(node.type, "stagedCallout");
  assert.equal(node.attrs!.label, "In two words: haptics");
  const kinds = JSON.stringify(node.content);
  assert.match(kinds, /entityMention/);
  assert.match(kinds, /entityCard/);
});

test("a block interrupting a paragraph is still claimed", () => {
  const types = (doc(NONCANONICAL_FIXTURES.interruptsParagraph).content ?? []).map((n) => n.type);
  assert.deepEqual(types, ["paragraph", "stagedCallout"]);
});

test("malformed blocks are not claimed", () => {
  for (const [name, { md }] of Object.entries(MALFORMED_FIXTURES)) {
    assert.doesNotMatch(JSON.stringify(doc(md)), /"staged/, name);
  }
});

test("a staged block inside a text block is not claimed (nesting)", () => {
  const callout = doc(DOOR_ONLY_FIXTURES.nested.md).content![0];
  assert.equal(callout.type, "stagedCallout");
  assert.doesNotMatch(JSON.stringify(callout.content), /stagedGallery/);
});
```

Add to `lib/markdown-conformance.test.ts`, next to the existing fixture loop (reuse its `render` and `roundTrip` helpers):

```ts
import { STAGING_FIXTURES, NONCANONICAL_FIXTURES, MALFORMED_FIXTURES, INERT_FIXTURES } from "./staging-fixtures";

test("staging: the editor and the site mean the same thing", () => {
  for (const [name, md] of Object.entries({ ...STAGING_FIXTURES, ...NONCANONICAL_FIXTURES, ...INERT_FIXTURES })) {
    const once = roundTrip(md);
    assert.equal(render(once), render(md), `${name}: render changed`);
    assert.equal(roundTrip(once), once, `${name}: not stable after one pass`);
  }
});

test("staging: a malformed block survives the editor as the same text", () => {
  for (const [name, { md }] of Object.entries(MALFORMED_FIXTURES)) {
    assert.equal(render(roundTrip(md)), render(md), name);
  }
});

test("KNOWN DIVERGENCE: a staged block nested in a text block renders unwrapped, and the editor keeps its fences as text", () => {
  // The door refuses nesting and the editor cannot make it (the `/` menu is
  // off inside a text block), so only hand-written stored markdown has it.
  // Pinned so a change in either parser shows up here first.
  const md = DOOR_ONLY_FIXTURES.nested.md;
  assert.match(render(md), /<staged-callout>/);
  assert.doesNotMatch(render(md), /<staged-gallery/);
});
```

(Import `DOOR_ONLY_FIXTURES` too.) If a malformed fixture's text does not survive the round trip identically (the editor may escape a literal `:::` line), record it as a `KNOWN DIVERGENCE` test in the file's existing style — name what differs and why it is acceptable — rather than loosening the loop. Stop and report to the controller if it loses words or images.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/staging-editor.ts
import { Node, type JSONContent, type MarkdownToken } from "@tiptap/core";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { DEFAULT_FRAME, DEFAULT_SIZE } from "./staging";
import { findContainerEnd } from "./staging-fence";
import { parseStagedBlock, type MdNode, type ParsedBlock } from "./staging-parse";
import {
  serializeFigure, serializeGallery, serializeCompare, calloutOpener, quoteOpener,
  figureFields, galleryFields, compareFields,
} from "./staging-markdown";

/**
 * The EDITOR's half of the staging grammar (spec 2026-11-15 §4).
 *
 * marked finds a block's EXTENT (lib/staging-fence.ts, remark's closing
 * rules); remark-parse + directive then parses exactly that text and
 * lib/staging-parse.ts decides whether it is a block — the same function the
 * renderer uses. So the editor never claims a block the site would unwrap,
 * or leaves as text one the site would draw. lib/markdown-conformance.test.ts
 * keeps the extents honest.
 *
 * Media blocks are ATOMS: their fields are attributes and their markdown is
 * rebuilt from them (lib/staging-markdown.ts). Text blocks keep editable
 * block children, lexed by marked like any other content.
 */

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

// >0 while a text block lexes its own body. A staged block in there is not
// claimed — remark unwraps it (the inner one), the door refuses it, and the
// `/` menu does not offer it, so the editor leaves its fences as text rather
// than building a node the site would not draw. Module state is safe:
// marked's lexing is synchronous, and every increment is paired in `finally`.
let nesting = 0;

interface Claimed { raw: string; value: ParsedBlock }

function claim(src: string, name: string): Claimed | undefined {
  if (nesting > 0) return;
  const open = /^ {0,3}:{3,}([A-Za-z]+)/.exec(src);
  if (!open || open[1] !== name) return;
  const end = findContainerEnd(src);
  if (end === null) return;
  const raw = src.slice(0, end);
  const root = parser.parse(raw) as unknown as MdNode;
  const kids = root.children ?? [];
  if (kids.length !== 1 || kids[0].type !== "containerDirective" || kids[0].name !== name) return;
  const r = parseStagedBlock(kids[0], raw, { strict: false });
  return r.ok ? { raw, value: r.value } : undefined;
}

// marked calls `start` with the source AFTER the current position's first
// character; landing on the preceding newline only ever cuts a paragraph
// earlier, never later (lib/entity-markdown.ts's EntityCard explains).
// Containers interrupt paragraphs in remark (spec §2.3), so they must here.
const startOf = (name: string) => (src: string) => src.search(new RegExp(`\\n {0,3}:{3,}${name}(?=[\\[{\\s]|$)`));

type Token<T> = MarkdownToken & { value: T };

function atom<T extends ParsedBlock["block"]>(
  nodeName: string,
  block: T,
  attributes: Record<string, { default: unknown }>,
  toAttrs: (v: Extract<ParsedBlock, { block: T }>) => Record<string, unknown>,
  render: (attrs: Record<string, unknown>) => string,
) {
  return Node.create({
    name: nodeName,
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes: () => attributes,
    parseHTML: () => [{ tag: `staged-${block}-node` }],
    renderHTML: ({ HTMLAttributes }) => [`staged-${block}-node`, HTMLAttributes],
    markdownTokenizer: {
      name: nodeName,
      level: "block",
      start: startOf(block),
      tokenize: (src: string) => {
        const c = claim(src, block);
        if (!c || c.value.block !== block) return;
        return { type: nodeName, raw: c.raw, value: c.value } as Token<ParsedBlock>;
      },
    },
    parseMarkdown: (token: MarkdownToken) => ({
      type: nodeName,
      attrs: toAttrs((token as Token<Extract<ParsedBlock, { block: T }>>).value),
    }),
    renderMarkdown: (node: JSONContent) => render(node.attrs ?? {}),
  });
}

export const StagedFigure = atom(
  "stagedFigure", "figure",
  { frame: { default: DEFAULT_FRAME }, size: { default: DEFAULT_SIZE[DEFAULT_FRAME] }, src: { default: "" }, alt: { default: "" },
    darkSrc: { default: "" }, darkAlt: { default: "" }, caption: { default: "" } },
  (v) => ({ ...figureFields(v) }),
  (a) => serializeFigure(a as never),
);

export const StagedGallery = atom(
  "stagedGallery", "gallery",
  { frame: { default: DEFAULT_FRAME }, images: { default: [] }, caption: { default: "" } },
  (v) => ({ ...galleryFields(v) }),
  (a) => serializeGallery(a as never),
);

export const StagedCompare = atom(
  "stagedCompare", "compare",
  { do: { default: { src: "", alt: "", text: "" } }, dont: { default: { src: "", alt: "", text: "" } } },
  (v) => ({ ...compareFields(v) }),
  (a) => serializeCompare(a as never),
);

/** The body between the opener line and the closing fence, for marked. */
function bodyOf(raw: string): string {
  const lines = raw.replace(/\n$/, "").split("\n");
  const closed = /^ {0,3}:{3,}[ \t]*$/.test(lines[lines.length - 1] ?? "") && lines.length > 1;
  return lines.slice(1, closed ? -1 : undefined).join("\n");
}

function textBlock(nodeName: string, block: "callout" | "quote", attributes: Record<string, { default: unknown }>,
  toAttrs: (v: ParsedBlock) => Record<string, unknown>, opener: (a: Record<string, unknown>) => string) {
  return Node.create({
    name: nodeName,
    group: "block",
    // Not "block+": a staged node inside a text block is what the renderer
    // refuses to draw, so the schema refuses to hold it.
    content: "(paragraph | heading | bulletList | orderedList | taskList | blockquote | codeBlock | horizontalRule | table | image | entityCard)+",
    defining: true,
    addAttributes: () => attributes,
    parseHTML: () => [{ tag: `staged-${block}-node` }],
    renderHTML: ({ HTMLAttributes }) => [`staged-${block}-node`, HTMLAttributes, 0],
    markdownTokenizer: {
      name: nodeName,
      level: "block",
      start: startOf(block),
      tokenize: (src, _tokens, lexer) => {
        const c = claim(src, block);
        if (!c || c.value.block !== block) return;
        nesting += 1;
        try {
          return { type: nodeName, raw: c.raw, value: c.value, tokens: lexer.blockTokens(bodyOf(c.raw)) } as MarkdownToken;
        } finally {
          nesting -= 1;
        }
      },
    },
    parseMarkdown: (token, helpers) =>
      helpers.createNode(nodeName, toAttrs((token as Token<ParsedBlock>).value), helpers.parseChildren(token.tokens ?? [])),
    renderMarkdown: (node, helpers) => `${opener(node.attrs ?? {})}\n${helpers.renderChildren(node.content ?? [], "\n\n")}\n:::`,
  });
}

export const StagedCallout = textBlock(
  "stagedCallout", "callout", { label: { default: null } },
  (v) => (v.block === "callout" ? { label: v.label?.source ?? null } : {}),
  (a) => calloutOpener((a.label as string | null) ?? null),
);

export const StagedQuote = textBlock(
  "stagedQuote", "quote", { by: { default: "" }, role: { default: null } },
  (v) => (v.block === "quote" ? { by: v.by, role: v.role } : {}),
  (a) => quoteOpener(String(a.by ?? ""), (a.role as string | null) ?? null),
);

export const stagingNodes = [StagedFigure, StagedGallery, StagedCompare, StagedCallout, StagedQuote];
```

Check the node names in that `content` expression against the schema (`getSchema(headlessExtensions).nodes` — `taskList`, `table`, `image`, `horizontalRule` must exist under those names; drop any that do not and say so). If `helpers.createNode` / `parseChildren` / `renderChildren` have different signatures in this Tiptap version (see `node_modules/@tiptap/core/dist/index.d.ts` around `MarkdownParseHelpers` / `MarkdownRendererHelpers`), follow the types and the blockquote extension, not this sketch.

Then in `lib/entity-markdown.ts`:

```ts
import { stagingNodes } from "./staging-editor";
// …
export const headlessExtensions = [...baseExtensions, EntityCard, EntityMention, ...stagingNodes];
```

and extend the `baseExtensions` docblock: the staging nodes, like the entity nodes, are NOT in `baseExtensions`, because the editor layers React node views on them (Task 11).

- [ ] **Step 4: Run** `lib/staging-editor.test.ts`, `lib/markdown-conformance.test.ts`, `lib/entity-markdown.test.ts`, `lib/editor.test.ts`. Expect PASS. If a canonical fixture does not round-trip byte for byte because of how `renderChildren` separates a text block's children, make the renderer produce the fixture — the fixtures are what the door teaches agents to write. If the difference comes from a STOCK node's own serialization (a hard break written as `  \n` rather than `\\\n`), the editor's output is what it is: move that one fixture into a `textBlockByteExceptions` set skipped by the byte-equality test and covered by the render-equality loop, with a comment naming the stock node.

- [ ] **Step 5: Commit** — `Editor: the five staging nodes, held to remark by the conformance suite`

---

### Task 11: Node views, popovers and the `/` menu

**Files:**
- Create: `components/editor/staging-views.tsx`
- Modify: `components/editor/editor-extensions.ts`, `components/editor/prose-editor.tsx`, `lib/editor.test.ts`

Read first: `components/editor/entity-views.tsx` (the `.extend({ addNodeView })` pattern and options), `components/editor/prose-editor.tsx` lines ~130–200 (the `/image` upload flow, `imageBusy`/`imageBusyRef`, and where `imageBusy` disables the commit and the EN/FR switch), `components/ui/popover.tsx` (the Base UI popover's exports).

Behaviour (spec §4.2):
- Each node view renders its preview as `<Markdown remarkPlugins rehypePlugins components={stagingComponents(lang)}>{serialized}</Markdown>` — for a media atom `serialized` is its own `renderMarkdown` output; for a text block it is only the label/attribution line plus an editable `NodeViewContent`.
- A media atom's preview is a button (`aria-label="Edit figure"` etc.) that opens a Popover with: frame and size as native radios (members from `lib/staging.ts`, labels "Phone", "Desktop", "None" / "Small", "Medium", "Large", "Wide"); one image slot per image (an `<input type="file">` that uploads through the host's `upload` function, or a pasted URL field); alt and caption inputs; for a gallery, add / remove / move-up / move-down per image; for compare, two sides each with an optional image and a required text. **Save** calls `props.updateAttributes(draft)` and closes; Escape or outside click discards the draft. Save is disabled until the draft differs from the stored attrs AND is valid (figure: an image; gallery: ≥2 images; compare: both texts; quote: `by`).
- Text blocks: the callout's label line and the quote's attribution line are buttons opening the same kind of popover for `label` / `by` + `role`; the body is `NodeViewContent`.
- A media block inserted from `/` opens its popover immediately (pass `open` initial state through a transient attr is NOT allowed — use the node view's own `useState(initiallyOpen)` where `initiallyOpen = !attrs.src && !attrs.images?.length && !attrs.do?.text`). Cancelled empty, it serializes to `""` and disappears on save (Task 4's rule); also delete the node on cancel when it is empty, so the author does not see an empty box.
- The figure's image slots accept `image/svg+xml` (input `accept` = `ALLOWED_TYPES` + svg) and upload with `purpose: "figure-svg"`; gallery and compare slots accept `ALLOWED_TYPES` only.
- Uploads report busy/idle to the host so the EN/FR switch and the commit stay dead while one is in flight.

- [ ] **Step 1: Failing test** (append to `lib/editor.test.ts`, which already builds a real headless `Editor` from `buildEditorExtensions`)

```ts
test("the / menu offers the five staging blocks", () => {
  const ids = buildBlocks(() => {}).map((b) => b.id);
  for (const id of ["figure", "gallery", "compare", "callout", "quote"]) assert.ok(ids.includes(id), id);
});

test("/callout inserts an empty callout with a paragraph inside; /figure inserts an empty figure that saves to nothing", () => {
  const editor = makeEditor(""); // use the file's existing helper for a headless editor
  const run = (id: string) => buildBlocks(() => {}).find((b) => b.id === id)!.run(editor, { from: 1, to: 1 });
  run("callout");
  assert.equal(editor.getJSON().content?.[0]?.type, "stagedCallout");
  run("figure");
  assert.doesNotMatch(editor.getMarkdown(), /:::figure/);
});
```

Adapt names to the file's real helpers (`makeEditor`, `getMarkdown`) — read it first.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`components/editor/editor-extensions.ts`:
- Add five `STATIC_BLOCKS`-style rows to `buildBlocks` (ids `figure`, `gallery`, `compare`, `callout`, `quote`; labels "Figure", "Gallery", "Do / Don't", "Callout", "Attributed quote"). Media rows: `e.chain().focus().deleteRange(r).insertContent({ type: "stagedFigure" }).run()`. Text rows: `insertContent({ type: "stagedCallout", content: [{ type: "paragraph" }] })` and for quote `{ type: "stagedQuote", attrs: { by: "" }, content: [{ type: "paragraph" }] }`.
- In the `/` suggestion's `allow`, also return false when any ancestor of `$pos` is `stagedCallout` or `stagedQuote` (walk `$pos.depth` down to 0 checking `$pos.node(d).type.name`) — the editor cannot make nesting (spec §2.2).
- `BuildEditorExtensionsOptions` gains `upload: (file: File, purpose?: "figure-svg") => Promise<{ ok: true; url: string } | { ok: false; error: string }>`, `onUploadBusy: (busy: boolean) => void`, `lang: Lang`. Headless callers pass a stub, `() => {}`, `"en"`.
- Replace `...entityExtensions(entities)` with `...entityExtensions(entities), ...stagingExtensions({ upload, onUploadBusy, lang })`.

`components/editor/staging-views.tsx` (`"use client"` — admin zone):
- Export `stagingExtensions(opts)` returning `stagingNodes.map(...)` with `.extend({ addOptions: () => opts, addNodeView: () => ReactNodeViewRenderer(View) })` per node, as `entityExtensions` does.
- Shared pieces in the file: `ImageSlot` (file input + URL input + alt; calls `opts.upload`, wraps it with `onUploadBusy(true/false)` in `try/finally`, shows the error text in `text-destructive`), `RadioRow` (native radios over a readonly list), `PopoverForm` (Base UI `Popover` from `components/ui/popover.tsx`, a `<form onSubmit>` whose Save is a `Button` from `components/ui/button.tsx`).
- `FigureView`, `GalleryView`, `CompareView`: `NodeViewWrapper className="not-prose my-4" data-drag-handle` → a `<button type="button">` wrapping the `<Markdown>` preview → the popover.
- `CalloutView`, `QuoteView`: `NodeViewWrapper` → the label / attribution button + `<NodeViewContent className="…" />`, styled like `StagedCallout` / `StagedQuote` (import `CalloutLabel`'s classes rather than retyping them — export the class strings from the components if needed).
- `upload` is implemented in `prose-editor.tsx` (below), never here: node views must not import server actions directly, so `lib/editor.test.ts` can build the extensions without a server.

`components/editor/prose-editor.tsx`:
- Implement `upload` with the existing `uploadImageAction` (append `purpose` to the `FormData` when given) returning `{ ok: true, url: media.url }`.
- `onUploadBusy`: a counter ref; `busy = imageBusy || stagingUploads > 0` replaces `imageBusy` everywhere it gates the commit button and the EN/FR switch (lines ~481–571).
- Pass `lang` from the same source `langSwitch` uses.

- [ ] **Step 4: Run** `lib/editor.test.ts` and `npm test`. Then `npx tsc --noEmit` and `npm run lint`. Expect clean.

- [ ] **Step 5: Commit** — `Editor: staging previews with popover forms, and five / rows`

---

### Task 12: The SVG check

**Files:**
- Create: `lib/svg-check.ts`, `lib/svg-check.test.ts`
- Modify: `package.json` (move `svgo` to `dependencies`, same version)

- [ ] **Step 1: Failing test**

```ts
// lib/svg-check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSvg, MAX_SVG_BYTES } from "./svg-check";

const svg = (body: string, attrs = 'viewBox="0 0 10 10"') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`);

test("a clean drawing passes and comes back minified, viewBox kept", () => {
  const r = checkSvg(svg('<g fill="none" stroke="#111"><path d="M0 0 L10 10"/><circle cx="5" cy="5" r="2"/></g><text x="1" y="9">Hi</text>'));
  assert.ok(r.ok);
  assert.match(r.svg, /viewBox="0 0 10 10"/);
  assert.doesNotMatch(r.svg, /\n {2}/);
});

test("internal references, gradients and a style block without url() pass", () => {
  const r = checkSvg(svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><use href="#g"/><style>.a{fill:#000}</style>'));
  assert.ok(r.ok, r.ok ? "" : r.error);
});

const refused: Array<[string, Buffer, RegExp]> = [
  ["script", svg("<script>alert(1)</script>"), /<script> is not allowed/],
  ["handler", svg('<rect onload="alert(1)" width="1" height="1"/>'), /onload is not allowed/],
  ["foreignObject", svg("<foreignObject><div>x</div></foreignObject>"), /<foreignObject> is not allowed/],
  ["image", svg('<image href="data:image/png;base64,AAAA"/>'), /<image> is not allowed/],
  ["animate", svg('<set attributeName="href" to="javascript:alert(1)"/>'), /<set> is not allowed/],
  ["external href", svg('<use href="https://evil.example/x.svg#a"/>'), /href must point inside the file/],
  ["external xlink", svg('<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="https://evil.example/a"/>'), /href must point inside the file/],
  ["external url attr", svg('<rect fill="url(https://evil.example/a)" width="1" height="1"/>'), /url\(\) must point inside the file/],
  ["external url style", svg("<style>@font-face{src:url(https://evil.example/f.woff2)}</style>"), /url\(\) must point inside the file/],
  ["import", svg("<style>@import 'https://evil.example/a.css';</style>"), /@import is not allowed/],
  ["doctype", Buffer.from('<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'), /DOCTYPE is not allowed/],
  ["no viewBox", svg('<rect width="1" height="1"/>', 'width="10" height="10"'), /needs a viewBox/],
  ["not svg", Buffer.from("<html><body/></html>"), /not an SVG/],
  ["broken xml", Buffer.from("<svg"), /not an SVG/],
];

for (const [name, bytes, message] of refused) {
  test(`refused, by name: ${name}`, () => {
    const r = checkSvg(bytes);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, message);
  });
}

test("too large is refused before parsing", () => {
  const r = checkSvg(Buffer.alloc(MAX_SVG_BYTES + 1, 32));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /too large/);
});
```

Also add two real exports as fixtures under `lib/__fixtures__/svg/` — one from Figma (outlined text), one from Excalidraw with "embed fonts" off — and a test that both pass. Produce them by exporting any small diagram; if no export tool is available, ask the controller for the two files rather than inventing their markup.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/svg-check.ts
import { optimize, type CustomPlugin } from "svgo";

/**
 * The SVG door's check (spec 2026-11-15 §5.1). An SVG is a document that can
 * carry script, handlers, embedded HTML and fetches. Ariko only ever draws one
 * through <img>, where none of that runs — but a stored file can be opened
 * directly, and a figure's whole promise is that the drawing approved is the
 * drawing stored. So this REFUSES, by name, anything outside a small
 * allowlist, and never strips: a stripped drawing is a different drawing.
 *
 * svgo parses (it is already a dependency, for brand:build) and its visitor
 * walks the tree; the same library then minifies what passed, keeping the
 * viewBox, which preset-default would otherwise delete.
 */
export const MAX_SVG_BYTES = 1024 * 1024;

const ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "defs", "symbol", "use", "marker", "clipPath", "mask", "linearGradient", "radialGradient", "stop",
  "pattern", "title", "desc", "style",
]);
const HREF = new Set(["href", "xlink:href"]);
const EXTERNAL_URL = /url\(\s*(?!['"]?#)/i;

export type SvgCheck = { ok: true; svg: string } | { ok: false; error: string };

export function checkSvg(bytes: Buffer): SvgCheck {
  if (bytes.length > MAX_SVG_BYTES) return { ok: false, error: `svg refused: too large (max ${MAX_SVG_BYTES / 1024 / 1024}MB)` };
  const text = bytes.toString("utf8");
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) return { ok: false, error: "svg refused: a DOCTYPE is not allowed" };

  let problem: string | null = null;
  let root: string | null = null;
  let viewBox = false;
  const refuse = (p: string) => { problem ??= `svg refused: ${p}`; };

  const inspect: CustomPlugin = {
    name: "ariko-svg-check",
    fn: () => ({
      element: {
        enter(node, parent) {
          if (parent.type === "root") {
            root = node.name;
            viewBox = typeof node.attributes.viewBox === "string" && node.attributes.viewBox.trim() !== "";
          }
          if (!ELEMENTS.has(node.name)) return refuse(`<${node.name}> is not allowed`);
          for (const [name, value] of Object.entries(node.attributes)) {
            if (/^on/i.test(name)) return refuse(`${name} is not allowed`);
            if (HREF.has(name) && !value.trim().startsWith("#")) return refuse(`${name} must point inside the file (#id)`);
            if (EXTERNAL_URL.test(value)) return refuse(`url() must point inside the file (url(#id))`);
          }
        },
      },
      text: {
        enter(node, parent) {
          if (parent.type === "element" && parent.name === "style") {
            if (/@import/i.test(node.value)) refuse("@import is not allowed");
            if (EXTERNAL_URL.test(node.value)) refuse("url() must point inside the file (url(#id))");
          }
        },
      },
    }),
  };

  try {
    optimize(text, { plugins: [inspect] });
  } catch {
    return { ok: false, error: "svg refused: not an SVG (the file does not parse as XML)" };
  }
  if (root !== "svg") return { ok: false, error: "svg refused: not an SVG (the root element is not <svg>)" };
  if (problem) return { ok: false, error: problem };
  if (!viewBox) return { ok: false, error: "svg refused: it needs a viewBox, so it can scale" };

  const { data } = optimize(text, {
    multipass: true,
    plugins: [{ name: "preset-default", params: { overrides: { removeViewBox: false } } }],
  });
  return { ok: true, svg: data };
}
```

svgo's text nodes inside `<style>` may be `cdata` rather than `text` — handle both visitor keys. If svgo's `CustomPlugin` type name differs in 3.3.x, use the type it exports (`import type { Plugin } from "svgo"`). `problem ??=` inside a visitor: the error string is fixed at the first refusal, so the message names the first thing found.

`package.json`: move `"svgo"` from `devDependencies` to `dependencies` (same version), then `npm install` to refresh the lockfile.

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `SVG: an allowlist that refuses, never strips`

---

### Task 13: The SVG upload doors

**Files:**
- Modify: `lib/storage.ts` (+ `lib/storage.test.ts` if it exists; else create a small one), `lib/articles-assets.ts`, `app/api/articles/assets/route.ts`, `app/admin/actions.ts`
- Test: the existing asset-door test (find it: `grep -rl handleAssetUpload lib/*.test.ts`)

- [ ] **Step 1: Failing tests**

Storage:

```ts
import { svgUploadOptions, uploadOptions } from "./storage";

test("SVG uploads have their own allowed_formats; the raster door is unchanged", () => {
  assert.deepEqual(svgUploadOptions("beanstalk").allowed_formats, ["svg"]);
  assert.equal((uploadOptions("beanstalk").allowed_formats as string[]).includes("svg"), false);
});
```

Asset door (with the file's existing fake `authorize` / `upload`; add a fake `uploadSvg` that records its bytes):

```ts
test("an SVG goes through the check and the SVG uploader", async () => {
  const calls: string[] = [];
  const deps = { ...okDeps, uploadSvg: async (b: Buffer) => { calls.push(b.toString()); return { kind: "image", storageKey: "k", url: "https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.svg" } } };
  const res = await handleAssetUpload(svgRequest('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'), deps);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.match((await res.json()).url, /\.svg$/);
});

test("a refused SVG is a 400 naming what was found, and nothing is uploaded", async () => {
  const deps = { ...okDeps, uploadSvg: async () => { throw new Error("must not upload"); } };
  const res = await handleAssetUpload(svgRequest('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>'), deps);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /<script> is not allowed/);
});
```

(`svgRequest` builds a `Request` with multipart `FormData` holding a `File([text], "a.svg", { type: "image/svg+xml" })` and the bearer header the existing tests use.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`lib/storage.ts`:

```ts
/**
 * The SVG door's options (spec 2026-11-15 §5.2): its OWN allowed_formats, so
 * Cloudinary judges these bytes as SVG and the raster door above keeps
 * refusing SVG for every cover, screen and media item. Only a figure's image
 * comes through here, and only after lib/svg-check.ts passed it.
 */
export function svgUploadOptions(folder: string, filename?: string): Record<string, unknown> {
  return { folder, resource_type: "image", allowed_formats: ["svg"], ...(filename ? { context: { original_filename: filename } } : {}) };
}

export async function uploadSvg(svg: Buffer, filename?: string): Promise<MediaImage> {
  const dataUri = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, svgUploadOptions(UPLOAD_FOLDER, filename));
  return toMediaImage(result as CloudinaryResult);
}
```

`lib/articles-assets.ts`: `AssetDeps` gains `uploadSvg`. Before `checkUploadFile`:

```ts
  if (file.type === "image/svg+xml") {
    const svg = checkSvg(Buffer.from(await file.arrayBuffer()));
    if (!svg.ok) return Response.json({ error: svg.error }, { status: 400 });
    try {
      const media = await deps.uploadSvg(Buffer.from(svg.svg), uploadedFilename(file));
      return Response.json({ url: media.url, width: media.width, height: media.height });
    } catch (err) {
      console.error(`[articles/assets] svg upload failed for plant ${repo.plant}`, err);
      return Response.json({ error: "upload failed" }, { status: 502 });
    }
  }
```

Update the file's header comment: raster through `checkUploadFile`, SVG through `checkSvg` — and only a figure may use the URL (`lib/article-images.ts`).

`app/api/articles/assets/route.ts`: pass `uploadSvg`.

`app/admin/actions.ts` `uploadImageAction`: when `formData.get("purpose") === "figure-svg"` and `file.type === "image/svg+xml"`, run `checkSvg` and `uploadSvg` and return `{ ok: true, media }`; otherwise the existing path, unchanged. Add one docblock line: the purpose is posted only by the figure popover's image slot; any other caller still gets the raster rule.

- [ ] **Step 4: Run** the storage and asset tests, `lib/upload-input.test.ts` (unchanged "rejects svg specifically" must still pass) and `npm test`.

- [ ] **Step 5: Commit** — `SVG: its own upload door, for figures only`

**Manual check for the controller (not a subagent):** before Task 16's acceptance, confirm the Cloudinary account allows SVG uploads (Settings → Security → "Restricted media types" must not list SVG). If it does, the maintainer flips it.

---

### Task 14: The door validates staging and SVG placement

**Files:**
- Create: `lib/staging-check.ts`, `lib/staging-check.test.ts`
- Modify: `lib/article-images.ts` (+ its test), `lib/articles-v2.ts` (+ its test)

- [ ] **Step 1: Failing tests**

```ts
// lib/staging-check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { stagingProblems } from "./staging-check";
import { STAGING_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES, INERT_FIXTURES } from "./staging-fixtures";

test("valid and inert documents have no problems", () => {
  for (const [name, md] of Object.entries({ ...STAGING_FIXTURES, ...INERT_FIXTURES })) assert.deepEqual(stagingProblems(md), [], name);
  assert.deepEqual(stagingProblems(Object.values(STAGING_FIXTURES).join("\n\n")), []);
});

test("every malformed and door-only fixture is refused with its message", () => {
  for (const [name, { md, problem }] of Object.entries({ ...MALFORMED_FIXTURES, ...DOOR_ONLY_FIXTURES })) {
    const problems = stagingProblems(md);
    assert.ok(problems.some((p) => problem.test(p)), `${name}: ${JSON.stringify(problems)}`);
  }
});

test("foreign leaf and text directives are not this check's business", () => {
  assert.deepEqual(stagingProblems("::entity{ref=bean:x} and :entity[x]{ref=bean:y} at 10:30"), []);
});
```

Append to `lib/article-images.test.ts`:

```ts
const host = { cloud: "t5gexxs5", folder: "beanstalk" };
const svgUrl = "https://res.cloudinary.com/t5gexxs5/image/upload/v1/beanstalk/clock.svg";

test("an SVG is accepted inside a figure", () => {
  assert.deepEqual(imageProblems(`:::figure\n![clock](${svgUrl})\n:::`, host), []);
});

test("an SVG anywhere else is refused by name", () => {
  for (const md of [`![clock](${svgUrl})`, `:::gallery\n![a](${svgUrl})\n![b](${svgUrl})\n:::`]) {
    assert.ok(imageProblems(md, host).some((p) => /clock\.svg: SVG is accepted only inside :::figure/.test(p)), md);
  }
});
```

And in `lib/articles-v2.test.ts`, one test that a payload whose essay content has `:::figure{size=xl}` is refused with a message containing `figure: size=xl is not one of s, m, l, wide` and naming the essay and half (match the file's existing refusal-message format).

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/staging-check.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visitParents } from "unist-util-visit-parents";
import { COMPARE_SIDES, STAGED_BLOCKS, isStagedBlock } from "./staging";
import { parseStagedBlock, type MdNode } from "./staging-parse";
import { findContainerEnd } from "./staging-fence";

/**
 * The door's staging check (spec 2026-11-15 §6.1): STRICT where the renderer
 * is lenient. Stored content falls back gracefully so a typo never breaks a
 * page; posted content is refused by name so the agent that wrote the typo
 * learns of it while it can still fix it — the door's "a typo is an error"
 * rule, applied to the grammar.
 */
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const COMPARE_PARTS: readonly string[] = COMPARE_SIDES;

export function stagingProblems(markdown: string): string[] {
  const tree = parser.parse(markdown) as unknown as MdNode;
  const problems: string[] = [];
  visitParents(tree as never, (node: MdNode, ancestors: MdNode[]) => {
    const name = node.name ?? "";
    if (node.type === "leafDirective" || node.type === "textDirective") {
      if (isStagedBlock(name)) problems.push(`::${name} must be a container — write :::${name} … :::`);
      return;
    }
    if (node.type !== "containerDirective") return;
    const parent = ancestors[ancestors.length - 1];
    if (COMPARE_PARTS.includes(name)) {
      if (!(parent?.type === "containerDirective" && parent.name === "compare")) problems.push(`${name}: only inside ::::compare`);
      return;
    }
    if (!isStagedBlock(name)) {
      problems.push(`:::${name} is not a staging block (${STAGED_BLOCKS.join(", ")})`);
      return;
    }
    const host = ancestors.find((a) => a.type === "containerDirective" && isStagedBlock(a.name));
    if (host) {
      problems.push(`${name}: a staged block cannot sit inside ${host.name}`);
      return;
    }
    const from = node.position?.start.offset ?? 0;
    if (findContainerEnd(markdown.slice(from)) === markdown.length - from && !/\n {0,3}:{3,}[ \t]*$/.test(markdown.trimEnd())) {
      problems.push(`${name}: unclosed — no matching :::`);
      return;
    }
    const r = parseStagedBlock(node, markdown, { strict: true });
    if (!r.ok) problems.push(r.problem);
  });
  return problems;
}
```

The unclosed test above is a heuristic; simplify it if a cleaner signal exists (e.g. compare `node.position.end.offset === markdown.length` with whether the last line is a closing fence). The fixture `DOOR_ONLY_FIXTURES.unclosed` and every valid fixture are the arbiters.

`lib/article-images.ts`:
- Parse with `remarkDirective` too (update the header comment: it now shares the renderer's directive parse, so it knows each image's block).
- `markdownImages` returns `{ urls, references, svgOutsideFigure: string[] }`, using `visitParents` and `isSvgUrl` / `SVG_BLOCK` from `lib/staging.ts`: an SVG image whose nearest `containerDirective` ancestor is not named `figure` goes into `svgOutsideFigure`.
- `imageProblems` adds `${url}: SVG is accepted only inside :::figure` for each.
- Update every caller of `markdownImages` (grep) for the new field.

`lib/articles-v2.ts`: in `checkImages` (or a sibling `checkStaging` called beside it, same message prefix `${who}: content.${lang}: `), run `stagingProblems(md)` and refuse with the problems joined by `; `.

- [ ] **Step 4: Run** the three test files, `lib/articles-route-v2.test.ts` if it runs without a DB, and `npm test`.
- [ ] **Step 5: Commit** — `Article door: refuse staging typos and misplaced SVGs by name`

---

### Task 15: Teach the grammar

**Files:**
- Modify: `plugins/ariko-article/skills/ariko-article/SKILL.md`, `CLAUDE.md`

- [ ] **Step 1: SKILL.md** — insert a section `## 1b. Staging` after "## 1. Draft", and update "Images:" under Draft and step 3.

````md
## 1b. Staging

Five blocks stage what plain markdown cannot. Reach for one only when the
writing needs it; a plain `![alt](url)` and a plain `>` stay right for most
images and quotes.

| You have | Use |
|---|---|
| one screen or one drawing that deserves a frame or a size | `figure` |
| screens meant to be looked at together | `gallery` |
| a rule shown by its opposite | `compare` |
| a definition or an aside the reader may skip | `callout` |
| someone's own words, attributed | `quote` |

```md
:::figure{frame=phone}
![Two scenes framed for a phone: the lake and the abbey](https://res.cloudinary.com/…)
Scenes zoom in on the subject when the phone is upright.
:::

:::figure{size=wide dark}
![The conductor's clock driving picture, sound and haptics](https://…/clock.svg)
![The same clock, drawn for a dark page](https://…/clock-dark.svg)
The audio clock is the reference.
:::

:::gallery{frame=phone}
![The lake scene](https://… "Lake")
![The abbey scene](https://… "Abbey")
Three scenes on a phone held upright.
:::

::::compare
:::do
![An almost still scene](https://…)
Show an almost still picture and drop the events.
:::
:::dont
![The same scene with shooting stars](https://…)
Keep every event running and ignore the system setting.
:::
::::

:::callout[In two words: dithering]
When you only have a few shades of grey, you mix them in a fine pattern so
the eye rebuilds the in-between tones.
:::

:::quote{by=Alexis role="reviewing the feed explorations"}
The Spine is truly a masterclass.
:::
```

Rules — the door refuses each by name (`400`), so fix what it says:

- `frame` is `phone`, `desktop` or `none` (default). `size` is `s`, `m`, `l`
  or `wide`; a phone defaults to `m`, everything else to `l`. Nothing else
  goes in the braces.
- A figure holds **one** image (two with `dark`: light, then dark), then an
  optional one-line caption. A gallery holds two or more; each image's
  `"title"` is its caption. Each compare side holds at most one image and
  **must** have a line of text.
- `compare` takes **four** colons around `:::do` and `:::dont`. Every other
  block takes three. Close every block.
- Blocks do not nest. `::figure` (two colons) is not a block.
- A quote needs `by`. Quote values with spaces: `role="lead designer"`.
- Captions, labels and roles are translated by writing them in the French
  half — each half is its own markdown.
````

Update Draft's "Images:" paragraph: replace "**No SVG** — export diagrams to PNG at 2×…" with:

```md
SVG is accepted **only as a figure's image** — a diagram or an illustration,
crisp at any size. The upload checks it and refuses, by name, anything that
could run or fetch: no scripts, no `on…` handlers, no `<foreignObject>` or
`<image>`, no links or `url()` outside the file, no `@import`. It needs a
`viewBox` and weighs 1 MB at most. Excalidraw: export with "Embed fonts"
off. Figma: outline the text. An SVG anywhere else is refused
(`SVG is accepted only inside :::figure`). A dark-mode twin is a second SVG
in the same figure, with `dark`.
```

In step 3, add `image/svg+xml` to the list of `type=` values, and under its error list: `400 svg refused: <what>` → fix the drawing, re-export, do not retry unchanged.

- [ ] **Step 2: CLAUDE.md** — under "Rules the tests pin, and why", add one bullet, in the file's voice, covering: the grammar is container directives decided by ONE function (`lib/staging-parse.ts`) for three consumers; lenient on render / strict at the door; the editor finds extents by remark's closing rules (`lib/staging-fence.ts`) and the conformance suite pins it; staged images are always `<a href>` to the original; SVG only as `<img>`, only in a figure, refused-not-stripped by `lib/svg-check.ts` through its own `allowed_formats`; `PhoneFrame` is the quiet outline everywhere. Name the test files that pin each. In "Writing for Ariko from another repo", add the staging check and SVG placement to the door's rule list. In "Script, by zone", note `components/staging/*` joined the server-safe list and the editor draws its previews from them.

- [ ] **Step 3: Build the skill zip to check it packages** — `npm run skill:zip` (writes outside the repo or to a gitignored path; check the script) — and do not commit the zip.

- [ ] **Step 4: Commit** — `Skill and rulebook: teach the staging grammar`

---

### Task 16: Verify in a browser, then open the PR

Controller-run, not a subagent.

- [ ] **Step 1: Full gates** in the worktree: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run test:db` (scratch DB), `npm run build`.

- [ ] **Step 2: Visual check** — run `npm run dev` from the worktree on another port with `MONGODB_DB=beanstalk_scratch` (never the production DB), seed one private sprout in the scratch DB whose content is every `STAGING_FIXTURES` entry joined by blank lines, and look at, in light AND dark, at 375px and 1280px:
  - the sprout's public page (log in, or preview in the admin): all five blocks; `wide` breaking out; the dark SVG twin swapping with the theme;
  - script disabled: every image still a link to its original;
  - the admin editor: each preview, each popover, Save / Escape, `/` rows, a cancelled empty figure vanishing;
  - the bean cover and the plant page's screen strip and lightbox (decision 5 changed them).
  Fix what looks wrong; screenshot the result for the PR.

- [ ] **Step 3: PR** — push the branch and open the PR. Body: what ships, the decisions table summary, the manual steps for the maintainer (re-upload the skill zip; Cloudinary SVG setting if it was off; re-stage the kosymoz essay from `../sparkaik` after deploy), the acceptance check (edit one caption and one quote role in the admin, diff the stored markdown — only those lines change), and a Lab Note:

```yaml
en:
  title: Articles can stage their pictures now
  summary: Screens sit in a phone or desktop frame, galleries line up side by side, do-and-don't pairs make a rule obvious, and asides and quotes get their own quiet look — diagrams too, crisp at any size.
fr:
  title: Les articles mettent enfin leurs images en scène
  summary: Tes écrans s'affichent dans un cadre de téléphone ou d'ordinateur, les galeries s'alignent côte à côte, les « à faire / à éviter » rendent une règle évidente, et apartés comme citations ont leur propre allure — schémas compris, nets à toutes les tailles.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
