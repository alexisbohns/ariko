# PWA and Brand Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ariko installable as a standalone desktop PWA, and replace both brand marks with the new artwork at 22% of their current byte cost.

**Architecture:** One committed generator (`scripts/build-brand.ts`) turns two source SVGs into seven derived artifacts — two React components painted from CSS tokens, a two-tone SVG favicon, an Apple touch icon and three manifest PNGs. A `MetadataRoute.Manifest` plus Next's `app/icon.*` file conventions replace the hand-written `<head>` block. A service worker that writes to no cache at runtime adds an offline page and nothing else.

**Tech Stack:** Next 15 App Router (`app/manifest.ts`, `app/icon.svg`, `app/apple-icon.png` conventions), svgo 3 (JS API), sharp 0.34, `node:test` source-text assertions.

**Spec:** [`docs/superpowers/specs/2026-09-12-pwa-and-brand-design.md`](../specs/2026-09-12-pwa-and-brand-design.md)

**Branch:** `pwa-and-brand` (already created; the spec is committed at `39ba7eb`)

---

## File Structure

| file | action | responsibility |
|---|---|---|
| `assets/brand/ariko-icon.svg` | create | source export, 320×320 |
| `assets/brand/ariko-logo.svg` | create | source export, 910×313 |
| `scripts/build-brand.ts` | create | the **only** writer of derived brand artifacts |
| `package.json` | modify | `brand:build` script, `svgo` + `sharp` devDependencies |
| `components/brand/ariko-icon.tsx` | replace | generated; painted from tokens |
| `components/brand/ariko-logo.tsx` | replace | generated; painted from tokens |
| `app/icon.svg` | create | generated; two-tone favicon |
| `app/apple-icon.png` | create | generated; 180×180 on white |
| `public/icons/icon-192.png` | create | generated; `purpose: any` |
| `public/icons/icon-512.png` | create | generated; `purpose: any` |
| `public/icons/icon-maskable-512.png` | create | generated; `purpose: maskable` |
| `lib/site.ts` | create | `SITE_NAME`, `SITE_DESCRIPTION`, `THEME_COLOR` — one file, three consumers |
| `app/manifest.ts` | create | `/manifest.webmanifest` |
| `public/sw.js` | create | navigation-only fetch handler, no runtime cache |
| `public/offline.html` | create | self-contained fallback document |
| `app/layout.tsx` | modify | drop `<head>` block, add SW registration, import `lib/site.ts` |
| `lib/brand-source.test.ts` | create | the marks stay token-painted and keep their viewBox |
| `lib/pwa-source.test.ts` | create | the four service-worker/manifest invariants |
| `lib/server-safe-source.test.ts` | modify | the two marks join `SERVER_SAFE` |
| `CLAUDE.md` | modify | the no-runtime-cache invariant joins the rulebook |
| `public/icon-light.png` | delete | 195,043 B |
| `public/icon-dark.png` | delete | 191,419 B |

---

## Task 1: The generator and the regenerated marks

**Files:**
- Create: `lib/brand-source.test.ts`
- Create: `assets/brand/ariko-icon.svg`, `assets/brand/ariko-logo.svg`
- Create: `scripts/build-brand.ts`
- Modify: `package.json`
- Replace (by generation): `components/brand/ariko-icon.tsx`, `components/brand/ariko-logo.tsx`
- Create (by generation): `app/icon.svg`, `app/apple-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`

- [ ] **Step 1: Write the failing test**

Create `lib/brand-source.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The two brand marks are GENERATED (`npm run brand:build`), and the thing
 * generation buys is the colour mapping: the artwork ships three literal
 * colours and the components must ship none of them.
 *
 * Both failures this catches are silent. Paste a fresh export's paths in by
 * hand and the mark renders perfectly — in one theme, painted black on a
 * ground that `.dark` will one day make black too. And svgo's `preset-default`
 * REMOVES `viewBox` whenever width/height are present, which is not a
 * degradation but a deletion: the components size themselves from `className`
 * alone, so a viewBox-less mark renders at its intrinsic size or not at all.
 * That one bit someone during the build of this very slice.
 */
const MARKS = ["components/brand/ariko-icon.tsx", "components/brand/ariko-logo.tsx"];

for (const path of MARKS) {
  test(`${path} paints from tokens, not literals`, () => {
    const source = readFileSync(join(process.cwd(), path), "utf8");

    assert.ok(
      !/fill="#[0-9a-fA-F]{3,8}"/.test(source),
      `${path} must carry no literal hex fill — run \`npm run brand:build\``,
    );
    assert.ok(
      source.includes('fill="currentColor"'),
      `${path} must paint its letterforms with currentColor`,
    );
    assert.ok(
      source.includes("var(--ariko-leaf-dark)") && source.includes("var(--ariko-leaf-light)"),
      `${path} must paint its leaves from --ariko-leaf-* (app/globals.css)`,
    );
  });

  test(`${path} keeps its viewBox`, () => {
    const source = readFileSync(join(process.cwd(), path), "utf8");

    assert.match(
      source,
      /viewBox="0 0 \d+ \d+"/,
      `${path} lost its viewBox — svgo's preset-default removes it unless overridden`,
    );
  });

  test(`${path} says it is generated`, () => {
    const source = readFileSync(join(process.cwd(), path), "utf8");

    assert.ok(
      source.includes("GENERATED by `npm run brand:build`"),
      `${path} must carry the generated banner, so nobody edits it by hand`,
    );
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A3 "brand-source"`

Expected: FAIL — the current hand-written components carry no banner. (They *do* already use `currentColor` and the leaf vars, so the first assertion passes today; the banner and the regeneration are what this task adds.)

- [ ] **Step 3: Install the two build dependencies**

Run:

```bash
npm install --save-dev svgo@^3.3.5 sharp@^0.34.5
```

`sharp` already resolves in `node_modules` as a transitive dependency of Next, but a script importing a package nothing declares breaks on the next `npm ci` in a different dependency tree.

- [ ] **Step 4: Copy the source exports into the repo**

Run:

```bash
mkdir -p assets/brand
cp ~/Documents/Project/ariko/ariko-icon-2.svg assets/brand/ariko-icon.svg
cp ~/Documents/Project/ariko/ariko-logo-2.svg assets/brand/ariko-logo.svg
```

Verify they are the expected files:

```bash
wc -c assets/brand/*.svg
```

Expected: `71412` for `ariko-icon.svg`, `78003` for `ariko-logo.svg`.

- [ ] **Step 5: Write the generator**

Create `scripts/build-brand.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { optimize } from "svgo";
import sharp from "sharp";

/**
 * The only writer of derived brand artifacts. Two sources in
 * (`assets/brand/*.svg`), seven files out.
 *
 * It exists because the alternative is that the next person to change the logo
 * re-derives the colour mapping, the precision setting, the maskable safe zone
 * and the Apple background from scratch — or, far likelier, does not, and ships
 * a manifest icon that disagrees with the favicon.
 *
 * Run it by hand (`npm run brand:build`), not at build time: the brand changes
 * at the pace of a rebrand, not a deploy, and every output is committed.
 */

const ROOT = process.cwd();

/** The three literal colours the artwork ships, and the tokens they become. */
const INK = "#000";
const LEAF_DARK = "#006400";
const LEAF_LIGHT = "#90ee90";

/**
 * `removeViewBox: false` is not a preference. svgo's preset-default DELETES
 * viewBox when width/height are present, and `removeDimensions` then deletes
 * width/height — leaving a mark with no coordinate system at all. The two
 * plugins are only safe together in this order.
 */
function tidy(source: string): string {
  const { data } = optimize(source, {
    floatPrecision: 1,
    plugins: [
      { name: "preset-default", params: { overrides: { removeViewBox: false } } },
      "removeDimensions",
    ],
  });
  return data;
}

function viewBoxOf(svg: string): string {
  const found = svg.match(/viewBox="([^"]+)"/);
  if (!found) throw new Error("svgo stripped the viewBox — check the plugin overrides");
  return found[1];
}

/** svgo emits only these four on this artwork; anything else is a surprise worth failing on. */
const JSX_ATTR: Record<string, string> = {
  d: "d",
  fill: "fill",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
};

function toToken(value: string): string {
  const v = value.toLowerCase();
  if (v === INK) return "currentColor";
  if (v === LEAF_DARK) return "var(--ariko-leaf-dark)";
  if (v === LEAF_LIGHT) return "var(--ariko-leaf-light)";
  throw new Error(`unexpected colour ${value} — the artwork's palette changed`);
}

function pathsToJsx(svg: string): string {
  const tags = svg.match(/<path\b[^>]*\/?>/g) ?? [];
  if (tags.length === 0) throw new Error("no <path> elements — did the export change shape?");

  return tags
    .map((tag) => {
      const attrs = [...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map(([, name, value]) => {
        const jsxName = JSX_ATTR[name];
        if (!jsxName) throw new Error(`unmapped SVG attribute \`${name}\``);
        return [jsxName, name === "fill" ? toToken(value) : value] as const;
      });
      const rendered = attrs.map(([n, v]) => `\n        ${n}="${v}"`).join("");
      return `      <path${rendered}\n      />`;
    })
    .join("\n");
}

function component(name: string, svg: string): string {
  return `import type { SVGProps } from "react";

// GENERATED by \`npm run brand:build\` from assets/brand/*.svg. Do not edit.

/**
 * The letterforms are painted with \`currentColor\`, so they follow the text
 * colour of whatever they sit in (\`text-foreground\`, \`text-primary\`, …). The
 * two leaf greens come from \`--ariko-leaf-dark\` / \`--ariko-leaf-light\`, which
 * \`app/globals.css\` re-declares under \`.dark\`.
 */
export function ${name}({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="${viewBoxOf(svg)}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
${pathsToJsx(svg)}
    </svg>
  );
}
`;
}

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/**
 * `inset` is the fraction of the canvas the artwork occupies.
 *
 * 1 for the `any` icons — the launcher draws them as-is. 0.6 for the maskable
 * one, because the spec's safe zone is a circle of 80% diameter and 0.6 clears
 * it with margin under both Android's circle and ChromeOS's squircle. 0.8 for
 * Apple, whose ~22% corner radius would otherwise clip the vine tips.
 *
 * White rather than transparent wherever a mask or an OS composites: iOS puts
 * transparency on BLACK, and the letterforms are black.
 */
async function raster(
  svg: Buffer,
  size: number,
  inset: number,
  background: typeof CLEAR,
  out: string,
) {
  const inner = Math.round(size * inset);
  const art = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(join(ROOT, out));
}

const icon = tidy(readFileSync(join(ROOT, "assets/brand/ariko-icon.svg"), "utf8"));
const logo = tidy(readFileSync(join(ROOT, "assets/brand/ariko-logo.svg"), "utf8"));

writeFileSync(join(ROOT, "components/brand/ariko-icon.tsx"), component("ArikoIcon", icon));
writeFileSync(join(ROOT, "components/brand/ariko-logo.tsx"), component("ArikoLogo", logo));

/**
 * The favicon is the one derivative that CANNOT use currentColor — it renders
 * outside the document. An embedded <style> gives it the same two-tone
 * behaviour the two `media`-switched PNGs had, in one file instead of 386 kB.
 */
const favicon = icon
  .replace(new RegExp(`fill="${INK}"`, "g"), 'class="ink"')
  .replace(
    /(<svg[^>]*>)/,
    "$1<style>.ink{fill:#111}@media(prefers-color-scheme:dark){.ink{fill:#fafafa}}</style>",
  );
writeFileSync(join(ROOT, "app/icon.svg"), favicon);

mkdirSync(join(ROOT, "public/icons"), { recursive: true });

const flat = Buffer.from(icon);
await raster(flat, 192, 1, CLEAR, "public/icons/icon-192.png");
await raster(flat, 512, 1, CLEAR, "public/icons/icon-512.png");
await raster(flat, 512, 0.6, WHITE, "public/icons/icon-maskable-512.png");
await raster(flat, 180, 0.8, WHITE, "app/apple-icon.png");

console.log("brand: 7 files written");
```

- [ ] **Step 6: Add the npm script**

In `package.json`, add to `"scripts"`, immediately after `"lint"`:

```json
    "brand:build": "node --import tsx scripts/build-brand.ts",
```

Note there is no `--env-file=.env.local`: unlike every `migrate:*` script, this one touches no database.

- [ ] **Step 7: Run the generator**

Run: `npm run brand:build`

Expected output: `brand: 7 files written`

Then confirm all seven exist:

```bash
ls -la components/brand/ariko-*.tsx app/icon.svg app/apple-icon.png public/icons/
```

Expected: `ariko-icon.tsx` ≈ 21 kB (was 92,611 B), `ariko-logo.tsx` ≈ 23 kB (was 104,840 B), `icon.svg` ≈ 20 kB, and three PNGs in `public/icons/`.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test 2>&1 | tail -20`

Expected: PASS, all six `brand-source` tests (three per mark), and no regression elsewhere.

- [ ] **Step 9: Verify the marks still render at both call sites**

Run:

```bash
npx tsc --noEmit
```

Expected: clean. Then check the rendered size against the audit's numbers:

```bash
cat > /tmp/render-marks.tsx <<'EOF'
import { renderToStaticMarkup } from "react-dom/server";
import { ArikoIcon } from "./components/brand/ariko-icon";
import { ArikoLogo } from "./components/brand/ariko-logo";
const a = renderToStaticMarkup(<ArikoIcon className="size-5 text-foreground" />);
const b = renderToStaticMarkup(<ArikoLogo title="Ariko" className="h-20 w-auto text-foreground" />);
console.log("icon", a.length, a.includes('aria-hidden="true"'), a.includes("currentColor"));
console.log("logo", b.length, b.includes("<title>Ariko</title>"), b.includes('role="img"'));
EOF
cp /tmp/render-marks.tsx ./render-marks.tsx
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx ./render-marks.tsx
rm ./render-marks.tsx
```

Expected, within a few bytes:

```
icon 20347 true true
logo 22642 true true
```

If either number is near 90,000 the generator did not run. If either `true` is `false`, the component signature drifted and both call sites are affected.

- [ ] **Step 10: Commit**

```bash
git add assets/brand scripts/build-brand.ts package.json package-lock.json \
        components/brand/ariko-icon.tsx components/brand/ariko-logo.tsx \
        app/icon.svg app/apple-icon.png public/icons lib/brand-source.test.ts
git commit -m "$(cat <<'EOF'
The new mark, generated: one command, seven files, 78% less HTML a page

Audit §4.2 measured the old marks at 90,787 bytes of inline HTML on every
chrome page and 102,774 on `/` — for a 20 px glyph and a wordmark. The new
artwork arrives with no ids and flat paths, so svgo at precision 1 takes the
rendered components to 20,347 and 22,642: −78%, with currentColor and the two
leaf tokens intact, which is the whole reason they stay inline rather than
becoming cacheable <img>s.

scripts/build-brand.ts is the only writer of derived brand artifacts, because
the alternative is that the next rebrand re-derives the colour mapping, the
precision, the maskable safe zone and the Apple background — or doesn't, and
ships a manifest icon that disagrees with the favicon.

lib/brand-source.test.ts pins the two silent failures: a hand-pasted export
loses the tokens and renders black on a ground `.dark` will make black too,
and svgo's preset-default DELETES viewBox unless overridden, which leaves a
mark that sizes itself from a className it no longer has.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pin the marks as server-safe

**Files:**
- Modify: `lib/server-safe-source.test.ts:39-65`

Both marks are rendered by `app/(public)/page.tsx:178` and
`app/(public)/_components/public-chrome.tsx:38`. They have always qualified for
`SERVER_SAFE` and were never listed — the list's own docblock says *"ADDING A
FILE HERE IS THE CHEAP HALF."*

- [ ] **Step 1: Add both files to the list**

In `lib/server-safe-source.test.ts`, inside the `SERVER_SAFE` array, add after
the `"components/screen-strip.tsx",` line:

```ts
  // The two brand marks. Generated (scripts/build-brand.ts), rendered by
  // app/(public)/page.tsx and _components/public-chrome.tsx, and never listed
  // here until the PWA slice — which is exactly the omission this list's
  // docblock warns about. A generated file is not exempt: the generator's
  // template is as editable as any other source.
  "components/brand/ariko-icon.tsx",
  "components/brand/ariko-logo.tsx",
```

- [ ] **Step 2: Run the tests**

Run: `npm test 2>&1 | grep -c "^ok"`

Expected: the count rises by 6 (three assertions × two files), all passing. Confirm none fail:

```bash
npm test 2>&1 | grep "^not ok" || echo "all green"
```

Expected: `all green`

- [ ] **Step 3: Commit**

```bash
git add lib/server-safe-source.test.ts
git commit -m "$(cat <<'EOF'
The brand marks join SERVER_SAFE, six slices late

Both are rendered by the public zone — page.tsx for the wordmark, the chrome
for the icon — and neither was ever in the list whose docblock says to add a
file the day you write it. Nothing is wrong with them today; that is the point.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: The manifest, the icon conventions, and the old PNGs

**Files:**
- Create: `lib/site.ts`
- Create: `app/manifest.ts`
- Create: `lib/pwa-source.test.ts`
- Modify: `app/layout.tsx:14-46`
- Delete: `public/icon-light.png`, `public/icon-dark.png`

- [ ] **Step 1: Write the failing test**

Create `lib/pwa-source.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The install surface, pinned by source text. Every failure below passes `tsc`,
 * `npm test` and `npm run build` while being false, and three of the four are
 * invisible to anyone who is not offline or not reading DevTools.
 */

test("every manifest icon exists in public/", () => {
  // A manifest naming a missing icon is not an error anywhere. Chrome simply
  // declines to offer the install, and says why only in the Application panel.
  const source = readFileSync(join(process.cwd(), "app/manifest.ts"), "utf8");
  const srcs = [...source.matchAll(/src:\s*"([^"]+)"/g)].map(([, s]) => s);

  assert.ok(srcs.length >= 3, "expected at least the 192, 512 and maskable icons");

  for (const src of srcs) {
    assert.ok(
      existsSync(join(process.cwd(), "public", src)),
      `app/manifest.ts names ${src}, which does not exist under public/`,
    );
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A5 "manifest icon"`

Expected: FAIL — `ENOENT` on `app/manifest.ts`, which does not exist yet.

- [ ] **Step 3: Write `lib/site.ts`**

Create `lib/site.ts`:

```ts
/**
 * What the app calls itself, in one place.
 *
 * Three consumers: `app/layout.tsx`'s `metadata` and `viewport` exports, and
 * `app/manifest.ts`. This is `READING_COLUMN`'s rule applied to a string — an
 * installed app whose window title disagrees with its page title is the version
 * of that drift nobody notices for a year, because only the author ever sees
 * both at once.
 */
export const SITE_NAME = "Ariko";

export const SITE_DESCRIPTION = "An atomic portfolio of creative and professional work.";

/**
 * `--background` written in the syntax the manifest format takes. The token is
 * `oklch(1 0 0)`; no manifest parser accepts oklch, so this is that colour, not
 * a second opinion about it. Light-only is honest: `.dark` is declared in
 * globals.css and nothing adds it.
 */
export const THEME_COLOR = "#ffffff";
```

- [ ] **Step 4: Write `app/manifest.ts`**

Create `app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";

/**
 * `/manifest.webmanifest`, and the whole installability bar: Chrome and Edge
 * dropped the service-worker requirement, so an HTTPS origin with this file is
 * installable. `public/sw.js` buys the offline page, not the install.
 *
 * ONE app, scope "/", rather than one manifest per zone. Two manifests would
 * give the author a real studio window — and put a browser boundary across the
 * path from writing a sprout to reading it, which is the commonest path there
 * is through this app.
 *
 * The icons live in `public/icons/`, not under `app/`: Next's `app/icon.*`
 * convention emits a hashed URL, which is right for a <link> Next writes itself
 * and wrong for a JSON file naming a path.
 *
 * `maskable` is a SEPARATE entry, not a purpose added to the 512. A maskable
 * icon is padded artwork; the same file used as `any` renders as a small mark
 * adrift in whitespace.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test 2>&1 | grep -A2 "manifest icon"`

Expected: `ok ... every manifest icon exists in public/`

- [ ] **Step 6: Rewrite the root layout's head**

Replace `app/layout.tsx` in full:

```tsx
import type { ReactNode } from "react";
import { Geist_Mono } from "next/font/google";
import { inclusiveSans } from "./fonts";
import { cn } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";
import "./globals.css";

/**
 * The design system's display face (shadcn preset `b3vqDobYF1`, `fontHeading:
 * geist-mono`). The body face stays Inclusive Sans — see `app/fonts.ts`.
 */
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export const viewport = {
  themeColor: THEME_COLOR,
};

/**
 * Registers `public/sw.js`, which exists to give an offline visitor Ariko's
 * page instead of the browser's dino — nothing else. It is deliberately a
 * SCRIPT TAG and not a component: no `"use client"`, no boundary, no
 * hydration, no chunk, so the public zone still has exactly one island
 * (`components/toc-rail.tsx`) and `lib/toc-mount.test.ts`'s claim is untouched.
 *
 * No nonce: the CSP in `next.config.ts` is one directive plus `object-src` and
 * carries no `script-src`.
 *
 * Script off, no worker, and nothing else lost — which is the whole
 * progressive-enhancement contract in one line.
 */
const REGISTER_SW =
  "if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))";

/**
 * The root layout owns only the document shell and the type/theme foundation.
 * Chrome belongs to the zones: `app/(public)/layout.tsx` for the exhibition,
 * `app/admin/layout.tsx` for the tooling.
 *
 * The favicon, the Apple touch icon and the manifest link are NOT written here
 * any more. `app/icon.svg`, `app/apple-icon.png` and `app/manifest.ts` are Next
 * file conventions and Next emits the three <link>s itself — which is how the
 * two 190 kB PNGs this used to point at became one 20 kB SVG that does its own
 * `prefers-color-scheme` switch.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("font-sans antialiased", inclusiveSans.variable, geistMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
      </head>
      <body className="min-h-svh bg-background text-foreground">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Delete the old favicons**

Run:

```bash
git rm public/icon-light.png public/icon-dark.png
```

Then confirm nothing still references them:

```bash
grep -rn "icon-light\|icon-dark" app components lib public --include="*.tsx" --include="*.ts" --include="*.html" --include="*.js" || echo "no references"
```

Expected: `no references`

- [ ] **Step 8: Verify the build emits the three links**

Run: `npm run build`

Expected: a clean build. Then check the emitted head:

```bash
npm start &
sleep 6
curl -s localhost:3333/ | grep -o '<link rel="[^"]*"[^>]*>' | head
curl -s localhost:3333/manifest.webmanifest
kill %1
```

Expected: a `rel="icon"` pointing at `/icon.svg`, a `rel="apple-touch-icon"`, a `rel="manifest"` pointing at `/manifest.webmanifest`, and the manifest JSON with all three icons and `"display":"standalone"`.

- [ ] **Step 9: Commit**

```bash
git add lib/site.ts app/manifest.ts app/layout.tsx lib/pwa-source.test.ts
git commit -m "$(cat <<'EOF'
Ariko is installable: a manifest, and one favicon instead of 386 kB of PNG

app/manifest.ts is the whole installability bar now that Chrome and Edge have
dropped the service-worker requirement. One app, scope "/", rather than one
manifest per zone: two scopes would put a browser boundary across the path
from writing a sprout to reading it.

The three hand-written <link>s are gone. app/icon.svg, app/apple-icon.png and
app/manifest.ts are Next file conventions, so Next emits them — and the
two-tone favicon that cost 386 kB as a pair of `media`-switched PNGs is now
one ~20 kB SVG doing its own prefers-color-scheme switch.

lib/site.ts holds the name and description both the metadata export and the
manifest need, because an installed app whose window title disagrees with its
page title is drift only the author ever sees.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: The offline page and the service worker

**Files:**
- Create: `public/offline.html`
- Create: `public/sw.js`
- Modify: `lib/pwa-source.test.ts`

- [ ] **Step 1: Write the offline page**

Create `public/offline.html`. It is deliberately self-contained — no Next
route, no design-system chunk, no webfont — because an offline fallback that
depends on a hashed CSS chunk works until the next deploy and then renders
unstyled, for an audience that by definition cannot report it:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline — Ariko</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #fff;
        --fg: #252525;
        --muted: #8e8e8e;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #252525;
          --fg: #fafafa;
          --muted: #8e8e8e;
        }
      }
      body {
        margin: 0;
        min-height: 100svh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        color: var(--fg);
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.6;
      }
      main {
        max-width: 28rem;
        padding: 2rem 1.5rem;
        text-align: center;
      }
      img {
        width: 72px;
        height: 72px;
      }
      h1 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 1.5rem 0 0.5rem;
      }
      p {
        margin: 0.25rem 0;
        color: var(--muted);
      }
      p + p {
        margin-top: 0.75rem;
      }
    </style>
  </head>
  <body>
    <main>
      <img src="/icons/icon-192.png" alt="Ariko" />
      <h1>No connection</h1>
      <p>Ariko is out of reach. This page will come back on its own.</p>
      <p lang="fr">Ariko est hors de portée. Cette page reviendra d’elle-même.</p>
    </main>
  </body>
</html>
```

The icon is `/icons/icon-192.png` — precached beside this file, not a second copy of the artwork. Both languages appear because a service worker has no good way to read the site's language cookie.

- [ ] **Step 2: Write the service worker**

Create `public/sw.js`. Leave `VERSION` as the literal string below; Step 4's test computes the real digest and tells you what to paste:

```js
/**
 * Ariko's service worker. It buys ONE thing — an offline page that is Ariko's
 * rather than the browser's — and is shaped so it cannot buy anything else.
 *
 * THE INVARIANT: nothing is written to the cache at runtime.
 *
 * The fetch handler returns without calling `respondWith` for anything that is
 * not a top-level navigation, so the browser proceeds exactly as if no worker
 * were installed. Navigations go to the network every time; the cache is
 * consulted only when that fetch REJECTS. The cache therefore holds exactly
 * the two entries below, fixed at install, forever.
 *
 * That matters because this worker's scope is "/", which includes /admin. A
 * runtime cache under this scope could store an authenticated admin response
 * and serve it to the next request, or serve a page composed against a
 * pre-write garden after a publish. Neither is reachable if nothing is ever
 * written — which is a property `lib/pwa-source.test.ts` can check, where "be
 * careful what you cache" would not be.
 *
 * An offline navigation to /admin therefore renders the offline page. That is
 * correct: the alternative is a cached login form that posts into nothing.
 *
 * `skipWaiting` + `clients.claim` are safe here for the same reason they are
 * usually dangerous. The hazard is a new worker taking over clients holding
 * assets from the old build; this worker serves no assets.
 *
 * VERSION carries a digest of the precached bytes, and pwa-source.test.ts
 * recomputes it. Editing offline.html without bumping it would deploy a change
 * no already-installed browser ever sees.
 */
const VERSION = "ariko-000000000000";
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // `cache: "reload"` so a stale HTTP cache entry cannot become a
      // permanently stale precache entry.
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Everything that is not a top-level navigation is never seen by
  // respondWith at all — not intercepted and passed through, but untouched.
  if (event.request.mode !== "navigate") return;

  // `caches.match` and not `caches.open(...).then(c => c.match(...))`: the
  // second form would put a `caches.open` outside the install handler, which
  // is the exact shape this worker's invariant forbids and its test rejects.
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});
```

- [ ] **Step 3: Write the three failing service-worker tests**

Append to `lib/pwa-source.test.ts`:

```ts
const sw = () => readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

/** The worker's own PRECACHE list, so no test keeps a second copy of it. */
function precache(source: string): string[] {
  const found = source.match(/const PRECACHE = (\[[^\]]*\]);/);
  assert.ok(found, "public/sw.js must declare `const PRECACHE = [...]` on one line");
  return JSON.parse(found[1]) as string[];
}

test("every precached path exists in public/", () => {
  // A typo makes addAll reject, which makes install reject, which means the
  // worker never activates — and NOTHING visibly breaks. The site simply has
  // no offline page, forever, and the only symptom is visible to someone with
  // no network.
  for (const path of precache(sw())) {
    assert.ok(
      existsSync(join(process.cwd(), "public", path)),
      `public/sw.js precaches ${path}, which does not exist under public/`,
    );
  }
});

test("the service worker writes to no cache at runtime", () => {
  // The invariant from sw.js's docblock, as a test rather than a comment.
  // Adding runtime caching is a three-line change that looks like an
  // improvement and is the only way this design can serve a stale — or
  // authenticated — response, because the worker's scope includes /admin.
  const source = sw();

  assert.equal(
    source.match(/caches\.open\(/g)?.length ?? 0,
    1,
    "public/sw.js must call caches.open exactly once, in install — use caches.match to read",
  );
  assert.equal(
    source.match(/\.put\(/g)?.length ?? 0,
    0,
    "public/sw.js must never put a response into a cache",
  );
  assert.match(
    source,
    /if \(event\.request\.mode !== "navigate"\) return;/,
    "public/sw.js must leave everything but top-level navigations untouched",
  );
  assert.equal(
    source.match(/respondWith\(/g)?.length ?? 0,
    1,
    "public/sw.js must respond to navigations and nothing else",
  );
});

test("VERSION carries a digest of the precached bytes", () => {
  // Turns "remember to bump the cache version when you edit the offline page"
  // from discipline into a failing test that prints the string to paste.
  const source = sw();
  const bytes = Buffer.concat(
    precache(source).map((p) => readFileSync(join(process.cwd(), "public", p))),
  );
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);

  assert.ok(
    source.includes(digest),
    `public/sw.js precache changed — set VERSION to "ariko-${digest}"`,
  );
});
```

And extend its imports at the top of the file:

```ts
import { createHash } from "node:crypto";
```

- [ ] **Step 4: Run the tests to verify the digest one fails**

Run: `npm test 2>&1 | grep -B2 -A8 "precache changed"`

Expected: the first two service-worker tests PASS; `VERSION carries a digest`
FAILS with a message naming the digest to paste, e.g.
`public/sw.js precache changed — set VERSION to "ariko-a1b2c3d4e5f6"`.

- [ ] **Step 5: Paste the digest**

In `public/sw.js`, replace the placeholder with the value the test printed:

```js
const VERSION = "ariko-a1b2c3d4e5f6";
```

(Use the digest from *your* test output, not this example.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep "^not ok" || echo "all green"`

Expected: `all green`

- [ ] **Step 7: Commit**

```bash
git add public/sw.js public/offline.html lib/pwa-source.test.ts
git commit -m "$(cat <<'EOF'
A service worker that writes to no cache, and an offline page that is ours

The worker buys one thing — Ariko's offline page instead of the browser's
dino — and is shaped so it cannot buy anything else. The fetch handler returns
without calling respondWith for anything but a top-level navigation, and the
cache holds exactly two entries fixed at install.

That shape is the point rather than an economy. The scope is "/", which
includes /admin: a runtime cache here could store an authenticated response,
or serve a page composed against a pre-write garden. Nothing written means
nothing to leak, and "the runtime writes to no cache" is a property a test can
check where "be careful what you cache" is not.

offline.html is static, not a Next route. An offline fallback that depends on
a hashed CSS chunk works until the next deploy and then renders unstyled — for
an audience that by definition cannot report it.

The VERSION digest test turns "remember to bump the cache version" into a
failing test that prints the string to paste.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: End-to-end verification in Chrome

**Files:** none — this task verifies Tasks 1–4 together.

The three preceding tasks each pass their own tests while the install can still
be broken by something none of them sees: the worker registering at the wrong
scope, the manifest failing Chrome's own validation, or the marks rendering
wrong in a real page.

- [ ] **Step 1: Build and serve**

Run:

```bash
npm run build && npm start
```

Expected: clean build, server on `http://localhost:3333`.

- [ ] **Step 2: Confirm the worker and manifest are served correctly**

In a second terminal:

```bash
curl -sI localhost:3333/sw.js | grep -i "content-type"
curl -s localhost:3333/manifest.webmanifest | head -20
curl -sI localhost:3333/offline.html | head -1
curl -s localhost:3333/ | grep -c "currentColor"
```

Expected: `content-type: text/javascript` (or `application/javascript`) for the
worker; the manifest JSON; `HTTP/1.1 200 OK` for the offline page; a non-zero
count for `currentColor`, proving the new mark is in the chrome.

- [ ] **Step 3: Check the install surface in Chrome**

Open `http://localhost:3333` in Chrome and open DevTools → **Application**.

Verify, and note that **`localhost` counts as a secure origin**, so the install
affordance appears without HTTPS:

- **Manifest** panel: name `Ariko`, `start_url` `/`, `display` `standalone`, and all three icons loading with no "cannot be loaded" error.
- **Service workers** panel: `sw.js` is **activated and running**, scope `http://localhost:3333/`.
- The install icon appears in the omnibox.

- [ ] **Step 4: Verify the offline page**

In DevTools → **Network**, set throttling to **Offline**, then reload.

Expected: Ariko's offline page — the mark, "No connection", and both language
lines. **Not** the browser's dino page.

Then set throttling back to **No throttling** and reload. Expected: the normal
site.

- [ ] **Step 5: Verify the mark at both sizes**

With the network restored, check:

- `/` renders the new wordmark at the top of the page.
- Any plant page renders the new icon in the top-left chrome cluster.
- The browser tab shows the new favicon.

**Expected, and recorded in the spec §9 as accepted:** the 20 px chrome mark and
the 16 px favicon read as a green smudge. This is the known cost of the detailed
artwork at small sizes and is out of scope. Note it; do not "fix" it here.

- [ ] **Step 6: Install and confirm the standalone window**

Click the install icon in the omnibox and install. Expected: a standalone window
with no browser chrome, the new icon in the dock/taskbar, and `Ariko` as the
window title.

Uninstall afterwards if you like — the point is that it works.

- [ ] **Step 7: Stop the server**

Run: `Ctrl-C` in the terminal running `npm start`.

No commit — this task changes no files. If anything failed, fix it in the task
that owns the file and re-run this one.

---

## Task 6: The rulebook

**Files:**
- Modify: `CLAUDE.md`

Only the service worker's invariant reaches the rulebook. The marks, the
manifest and the icons are ordinary code that breaks loudly; CLAUDE.md §"Rules
the tests pin, and why" is for rules whose violation passes every check.

- [ ] **Step 1: Add the invariant**

In `CLAUDE.md`, in the section **"Rules the tests pin, and why"**, add a bullet
after the `lib/palette.ts` one:

```markdown
- **The service worker writes to no cache at runtime.** `public/sw.js` returns
  from its fetch handler for anything that is not a top-level navigation, and
  the only cache entries are the two precached at install. Its scope is `/`,
  which includes `/admin`: a runtime cache here could store an authenticated
  response, or serve a page composed against a pre-write garden — the same
  staleness `loadCachedGarden` is careful about, arriving by a second door.
  `lib/pwa-source.test.ts` counts `caches.open` (exactly one, in install) and
  `.put(` (none), because "be careful what you cache" is not a property a test
  can check. It also pins a digest of the precached bytes into `VERSION`, so
  editing `public/offline.html` without bumping the cache name fails rather
  than deploying a change no installed browser ever sees.
```

- [ ] **Step 2: Note the generated marks**

In `CLAUDE.md`, in the bullet list under the shared-surfaces section — after the
`components/plant-header.tsx` bullet — add:

```markdown
  - `components/brand/ariko-icon.tsx` and `ariko-logo.tsx` are **generated**
    (`npm run brand:build`, from `assets/brand/*.svg`). Edit the source and
    re-run; do not hand-patch the components. `lib/brand-source.test.ts` pins
    that they paint from `currentColor` and the two `--ariko-leaf-*` tokens
    rather than the artwork's literal hex, and that they keep the `viewBox`
    svgo's default preset would otherwise delete.
```

- [ ] **Step 3: Verify the docs are consistent**

Run:

```bash
grep -n "icon-light\|icon-dark" CLAUDE.md README.md docs/superpowers/ROADMAP.md || echo "no stale references"
```

Expected: `no stale references`. If any turn up, update them — the two PNGs no
longer exist.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
The rulebook gains one invariant and one generated-file warning

The service worker's scope includes /admin, so "writes to no cache at runtime"
is the kind of rule this section exists for: its violation is a three-line
change that passes tsc, npm test and npm run build while serving an
authenticated response.

And the brand marks are generated now, which is worth one sentence so the next
person edits the source rather than the 20 kB of paths.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full verification and the PR

**Files:** none until Step 5.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`

Expected: all tests pass. Confirm explicitly:

```bash
npm test 2>&1 | grep "^not ok" || echo "all green"
```

Expected: `all green`

- [ ] **Step 2: Typecheck, lint, build**

Run:

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three clean. Record the route table from the build output — no
public route's First Load JS should have grown, since the registration is inline
text rather than a chunk.

- [ ] **Step 3: Confirm the byte win**

Run:

```bash
git show --stat HEAD~5 -- components/brand/ | tail -5
ls -la components/brand/
```

Expected: `ariko-icon.tsx` ≈ 21 kB and `ariko-logo.tsx` ≈ 23 kB, down from
92,611 and 104,840.

- [ ] **Step 4: Confirm the deletions landed**

Run:

```bash
test ! -e public/icon-light.png && test ! -e public/icon-dark.png && echo "old favicons gone"
git status --short
```

Expected: `old favicons gone`, and a clean working tree.

- [ ] **Step 5: Open the PR with its Lab Note**

This ships a new mark and an installable app — visitor-facing on both counts —
so the PR body MUST carry a Lab Note (CLAUDE.md §Lab Note requirement).

```bash
git push -u origin pwa-and-brand
gh pr create --title "Ariko installs: a PWA, and the new mark at 22% of the bytes" --body "$(cat <<'EOF'
Two requests that turned out to be one slice — an installable standalone app,
and a brand replacement. A manifest is mostly a list of icons, so doing either
alone would have meant rasterizing the new artwork twice or shipping an install
wearing the old logo.

Design: `docs/superpowers/specs/2026-09-12-pwa-and-brand-design.md`
Plan: `docs/superpowers/plans/2026-09-12-pwa-and-brand.md`

## The mark

`scripts/build-brand.ts` is the only writer of derived brand artifacts: two
sources in, seven files out. svgo at precision 1 plus the token mapping takes
the rendered components from **90,787 → 20,347 bytes** (the icon, on every
chrome page) and **102,774 → 22,642** (the wordmark, on `/`) — −78% each, with
`currentColor` and the two `--ariko-leaf-*` tokens intact, which is why they
stay inline rather than becoming cacheable `<img>`s. Closes the brand-mark half
of audit §4.2; the fonts and image transforms stay in their own slice.

The two 190 kB favicon PNGs are gone, replaced by one ~20 kB `app/icon.svg`
that does its own `prefers-color-scheme` switch.

## The install

`app/manifest.ts` is the whole installability bar now that Chrome and Edge have
dropped the service-worker requirement. One app, `scope: "/"`, rather than one
manifest per zone: two scopes would put a browser boundary across the path from
writing a sprout to reading it.

`public/sw.js` buys exactly one thing, an offline page that is Ariko's. It
returns from its fetch handler for anything that is not a top-level navigation,
and its cache holds the two entries precached at install and nothing else —
because its scope includes `/admin`, and a runtime cache there could store an
authenticated response or serve a page composed against a pre-write garden.
Registration is a ~110-byte inline script tag, not an island, so the public zone
still has exactly one.

## What the tests pin

- `lib/brand-source.test.ts` — the marks paint from tokens, not hex, and keep
  the `viewBox` svgo's default preset deletes.
- `lib/pwa-source.test.ts` — precached paths exist; `caches.open` appears once
  and `.put(` never; `VERSION` carries a digest of the precached bytes.
- `lib/server-safe-source.test.ts` — the two marks finally join `SERVER_SAFE`.

## Known and accepted

The new artwork is a detailed pea pod over a serif *A*, and at the 20 px chrome
size and 16 px favicon it reads as a green smudge. Audit §4.2 anticipated this
("a simplified silhouette for the icon size is the other half"); that half is a
drawing decision and is deliberately out of scope, recorded in spec §9.

## Lab Note

```yaml
en:
  title: Ariko now installs like an app
  summary: Ariko has a new mark, and you can install it as a real desktop app — its own window, its own icon, no browser chrome. Lose your connection and you get a proper Ariko page instead of the browser's error.
fr:
  title: Ariko s'installe comme une app
  summary: Ariko change de blason, et tu peux désormais l'installer comme une vraie app de bureau — sa fenêtre, son icône, sans navigateur autour. Plus de connexion ? Tu tombes sur une page Ariko, pas sur l'erreur du navigateur.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Confirm the Lab Note parses**

Check the PR for the advisory reminder comment. Expected: no complaint about
`en.title is required` or a malformed fence. If it complains, fix the PR body —
posting is idempotent.

---

## Self-Review

**Spec coverage:**

| spec § | task |
|---|---|
| §3.1 generator, sources, deps | Task 1 Steps 3–7 |
| §3.2 colour mapping | Task 1 Step 5 (`toToken`), pinned Task 1 Step 1 |
| §3.3 precision 1, measured | Task 1 Steps 5, 9 |
| §3.4 `SERVER_SAFE` | Task 2 |
| §4.1 no runtime cache | Task 4 Steps 2, 3 |
| §4.2 static offline page | Task 4 Step 1 |
| §4.3 script-tag registration | Task 3 Step 6 |
| §5.1 file conventions, white Apple ground | Task 1 Step 5 (`raster`), Task 3 Steps 6, 8 |
| §5.2 manifest | Task 3 Step 4 |
| §5.3 `lib/site.ts` | Task 3 Step 3 |
| §6.1–6.4 the four tests | Task 3 Step 1, Task 4 Step 3 |
| §6 CLAUDE.md | Task 6 |
| §7 deletions | Task 3 Step 7 |
| §9 the 20 px cost | Task 5 Step 5 (observe, do not fix) |
| §10 Lab Note | Task 7 Step 5 |

No gaps.

**Type consistency:** `SITE_NAME` / `SITE_DESCRIPTION` / `THEME_COLOR` are
defined in Task 3 Step 3 and consumed in Steps 4 and 6 under those exact names.
`PRECACHE` and `VERSION` are declared in Task 4 Step 2 and parsed by the tests in
Step 3 under those names, with `PRECACHE` on one line because the test's regex
requires it. `tidy` / `viewBoxOf` / `toToken` / `pathsToJsx` / `component` /
`raster` are each defined once in Task 1 Step 5 and called only there.

**One deliberate ordering constraint:** Task 4's digest test cannot pass before
`public/offline.html` exists, which is why Step 1 writes the page, Step 2 the
worker with a placeholder `VERSION`, and Step 5 pastes the digest the test
prints. Running Step 4 before Step 1 gives an `ENOENT`, not the useful failure.
