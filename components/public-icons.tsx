import type { SVGProps } from "react";

/**
 * The public zone's icon set — five glyphs, as SERVER components.
 *
 * `components/media.tsx` states the rule these exist to obey: lucide-react@1.33
 * routes every icon through an Icon.mjs carrying "use client", so a single
 * <Crown /> imported from it would push a client boundary into a zone whose
 * whole rule is that it has none. Five glyphs would be five boundaries, to draw
 * five static shapes.
 *
 * So the path data is inlined instead. It IS lucide's — copied verbatim from
 * lucide-react@1.33 (ISC licence: "Permission to use, copy, modify, and/or
 * distribute this software for any purpose with or without fee is hereby
 * granted"), which is what keeps the two zones drawing the same vocabulary: the
 * crown on a public plant page is the same crown as on /admin/plant/[slug],
 * because it is the same twelve numbers.
 *
 * Every one is aria-hidden. These glyphs never carry meaning alone — the public
 * chrome puts the word in the anchor's aria-label, and the plant head renders
 * the word beside the icon. Nothing here is the accessible name for anything.
 *
 * Adding a sixth: copy `__iconNode` out of
 * node_modules/lucide-react/dist/esm/icons/<name>.mjs. Do not eyeball it.
 *
 * Bumping lucide: RE-COPY ALL FIVE. package.json carries a caret on
 * lucide-react, and lucide redraws icons in minor releases — so an ordinary
 * install can move the admin's glyph and leave this copy behind, which no
 * compiler can see because the copy is a string.
 * `components/public-icons.test.tsx` is the thing that tells you: it renders
 * lucide's component beside ours and compares the geometry, so the drift fails
 * a test rather than reaching a visitor.
 */

/**
 * lucide's own defaults — 24-unit box, 2-unit round stroke, no fill.
 *
 * `{...props}` is spread BEFORE the two accessibility attributes, not after, so
 * a caller can restyle or size a glyph but cannot un-hide one. The header above
 * states flatly that every glyph is aria-hidden and is never the accessible name
 * for anything; putting the spread first makes that structural rather than a
 * convention nobody happens to have broken yet (`components/brand/ariko-icon.tsx`
 * orders its own aria handling the same way).
 */
function SvgFrame({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** lucide `sprout` — the directory of plants. The admin rail's Garden icon. */
export function SproutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
      <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
      <path d="M5 21h14" />
    </SvgFrame>
  );
}

/** lucide `waypoints` — the beanstalk. The admin rail's Beanstalk icon. */
export function WaypointsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="m10.586 5.414-5.172 5.172" />
      <path d="m18.586 13.414-5.172 5.172" />
      <path d="M6 12h12" />
      <circle cx="12" cy="20" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="20" cy="12" r="2" />
      <circle cx="4" cy="12" r="2" />
    </SvgFrame>
  );
}

/** lucide `crown` — a plant's role. The admin hero's role trigger. */
export function CrownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </SvgFrame>
  );
}

/** lucide `zap` — status: active. */
export function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
    </SvgFrame>
  );
}

/** lucide `zap-off` — status: inactive. */
export function ZapOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="M10.768 5.111 13.44 2.44a1.5 1.5 0 012.474 1.561l-1.633 4.625" />
      <path d="m18.889 13.232.672-.672A1.5 1.5 0 0018.5 10h-2.844" />
      <path d="m2 2 20 20" />
      <path d="m7.94 7.94-3.5 3.499A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l5.5-5.5" />
    </SvgFrame>
  );
}
