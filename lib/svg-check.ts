import { optimize, type Config } from "svgo";
import type { XastElement } from "svgo/lib/types";

/**
 * The SVG door's check (spec 2026-11-15 §5.1). An SVG is a document that can
 * carry script, handlers, embedded HTML and fetches. Ariko only ever draws one
 * through <img>, where none of that runs — but a stored file can be opened
 * directly, and a figure's whole promise is that the drawing approved is the
 * drawing stored. So this REFUSES, by name, anything outside a small
 * allowlist, and never strips: a stripped drawing is a different drawing.
 *
 * Both lists are ALLOWlists, elements and attributes alike. A denylist is the
 * shape that loses: the plan's first sketch checked `href` and `xlink:href` by
 * name, and `xmlns:x="…/xlink" x:href="https://…"` is the same link under a
 * prefix nobody listed. Here a prefixed attribute is refused unless it is one
 * of four spelled ones, so a rebound prefix is refused by name.
 *
 * svgo parses (sax, strict) and its visitor walks the tree; the same library
 * then minifies what passed, keeping the viewBox, which preset-default would
 * otherwise delete. **The caller stores `svg`, never the uploaded bytes**: the
 * output is svgo's own serialization, re-checked before it is returned, so a
 * quirk where sax and a browser read the same input differently (a duplicated
 * attribute, which sax resolves last-wins and a browser refuses to render)
 * cannot reach storage.
 */
export const MAX_SVG_BYTES = 1024 * 1024;

export type SvgCheck = { ok: true; svg: string } | { ok: false; error: string };

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * `metadata` is on the list although the spec's list omits it: every
 * Excalidraw export carries one (empty, or holding the scene as comments when
 * "embed scene" is on), it never renders and never fetches, and its children
 * are walked against this same list — so Inkscape's `<rdf:RDF>` inside one is
 * still refused by name. preset-default removes it on the way out.
 *
 * Absent on purpose: `a` (navigates, `javascript:` included), `image` and
 * `feImage` (fetch), `filter` (its only reason to exist here would be
 * `feImage`), `foreignObject` (HTML), `script`, and every animation element
 * (`set` / `animate` can write `href` after the check has read it).
 */
const ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "defs", "symbol", "use", "marker", "clipPath", "mask", "linearGradient", "radialGradient", "stop",
  "pattern", "title", "desc", "style", "metadata",
]);

/**
 * Geometry, presentation, `transform`, `viewBox`, `id`, `class`, `style` and
 * the namespace declarations (spec §5.1). Not here: `cursor` and `filter`,
 * which take a `url()` and do nothing a drawing needs; `on*`; and anything
 * prefixed but the four below — `xml:base` above all, which turns every
 * `href="#a"` beneath it into a fetch of another document.
 */
const ATTRIBUTES = new Set([
  // geometry
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr", "width", "height",
  "d", "points", "pathLength", "dx", "dy", "rotate", "textLength", "lengthAdjust", "offset",
  "viewBox", "preserveAspectRatio", "transform", "transform-origin",
  // gradients, patterns, markers, clips and masks
  "gradientUnits", "gradientTransform", "spreadMethod", "patternUnits", "patternContentUnits",
  "patternTransform", "clipPathUnits", "maskUnits", "maskContentUnits", "markerWidth", "markerHeight",
  "markerUnits", "refX", "refY", "orient",
  // presentation
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity",
  "stop-color", "stop-opacity", "clip-path", "clip-rule", "mask", "marker-start", "marker-mid",
  "marker-end", "color", "display", "visibility", "overflow", "paint-order", "vector-effect",
  "shape-rendering", "text-rendering", "color-interpolation", "color-rendering", "mix-blend-mode",
  "isolation", "enable-background",
  // text
  "font-family", "font-size", "font-weight", "font-style", "font-variant", "font-stretch",
  "text-anchor", "dominant-baseline", "alignment-baseline", "baseline-shift", "letter-spacing",
  "word-spacing", "text-decoration", "writing-mode", "direction", "unicode-bidi",
  // identity, document, accessibility
  "id", "class", "style", "lang", "version", "baseProfile", "type", "media", "role", "focusable",
  "href", "xmlns",
  // the four prefixed ones
  "xlink:href", "xml:space", "xml:lang",
]);
const HREF = new Set(["href", "xlink:href"]);

/**
 * CSS is checked in three places — `<style>`, a `style` attribute, and every
 * other attribute value, since presentation attributes are parsed as CSS
 * values too (`fill="url(…)"`). A backslash is refused outright: a CSS escape
 * spells `url(` as `u\rl(` and `@import` as `@\69mport`, and no export needs
 * one. The patterns run on the text both as written and with CSS comments
 * removed: a CSS parser does not actually join `@im/**\/port` into `@import`,
 * so the second pass can only over-refuse — which is the side to err on when
 * the alternative is reasoning about every engine's tokenizer.
 *
 * `image-set()`, `image()`, `cross-fade()` and `element()` take a bare string
 * as an image and fetch it with no `url(` in sight.
 */
const EXTERNAL_URL = /url\s*\(\s*(?!['"]?#)/i;
const STRING_IMAGE = /(-?[a-z-]*(?:image-set|image|cross-fade|element))\s*\(/i;

function cssProblem(css: string): string | null {
  if (css.includes("\\")) return "a CSS escape (\\) is not allowed";
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const text of [css, bare]) {
    if (/@import/i.test(text)) return "@import is not allowed";
    if (EXTERNAL_URL.test(text)) return "url() must point inside the file (url(#id))";
    const fn = STRING_IMAGE.exec(text);
    if (fn) return `${fn[1]}() is not allowed`;
  }
  return null;
}

function attributeProblem(name: string, value: string): string | null {
  if (/^on/i.test(name) || !(ATTRIBUTES.has(name) || name.startsWith("xmlns:") || /^aria-[a-z]+$/.test(name))) {
    return `${name} is not allowed`;
  }
  // Rebinding the default namespace turns the elements beneath into another
  // vocabulary's, under names this list judged as SVG; and a root with no SVG
  // namespace does not render through <img> at all.
  if (name === "xmlns" && value !== SVG_NS) return `xmlns must be the SVG namespace (${SVG_NS})`;
  if (name === "xmlns:xlink" && value !== XLINK_NS) return `xmlns:xlink must be the XLink namespace (${XLINK_NS})`;
  if (name.startsWith("xmlns")) return null;
  // Not trimmed: sax has already decoded `&#106;`, and a URL parser drops
  // leading whitespace, so " javascript:" is javascript: — it starts with a
  // space, not "#", and is refused.
  if (HREF.has(name)) return /^#\S+$/.test(value) ? null : `${name} must point inside the file (#id)`;
  return cssProblem(value);
}

/** Walks the document and returns the first refusal, or null when it passes. */
function inspect(text: string): string | null {
  const found: { problem: string | null; roots: XastElement[] } = { problem: null, roots: [] };
  const refuse = (p: string) => {
    found.problem ??= p;
  };

  const config: Config = {
    plugins: [
      {
        name: "ariko-svg-check",
        fn: () => ({
          // svgo's parser hands these four over as nodes of their own, and each
          // is decided here rather than left to the minifier's mercy.
          doctype: { enter: () => refuse("a DOCTYPE is not allowed") },
          // `<?xml version …?>` is the declaration and inert; anything else —
          // `<?xml-stylesheet?>` fetches CSS or XSLT when the file is opened.
          instruction: {
            enter(node) {
              if (node.name !== "xml") refuse(`<?${node.name}?> is not allowed`);
            },
          },
          // Comments are never processed, and are NOT part of a <style>'s CSS
          // (see the element exit below). CDATA outside <style> is character
          // data in a <text>, a <title> — text, which renders as text.
          element: {
            enter(node, parent) {
              if (parent.type === "root") found.roots.push(node);
              if (!ELEMENTS.has(node.name)) return refuse(`<${node.name}> is not allowed`);
              for (const [name, value] of Object.entries(node.attributes)) {
                const p = attributeProblem(name, value);
                if (p) return refuse(p);
              }
            },
            // A <style>'s CSS is the JOIN of its text and CDATA children, with
            // XML comments dropped — so `@im<!-- -->port` is `@import` to the
            // browser, and checking each child alone would miss it.
            exit(node) {
              if (node.name !== "style") return;
              if (node.children.some((c) => c.type === "element")) return refuse("<style> may hold only CSS");
              const css = node.children.map((c) => (c.type === "text" || c.type === "cdata" ? c.value : "")).join("");
              const p = cssProblem(css);
              if (p) refuse(p);
            },
          },
        }),
      },
    ],
  };

  try {
    optimize(text, config);
  } catch {
    return "not an SVG (the file does not parse as XML)";
  }
  // sax accepts two root elements and an empty input without complaint.
  if (found.roots.length !== 1 || found.roots[0].name !== "svg") return "not an SVG (the root element is not one <svg>)";
  if (found.problem) return found.problem;
  if (found.roots[0].attributes.xmlns !== SVG_NS) return `xmlns must be the SVG namespace (${SVG_NS})`;
  if (!found.roots[0].attributes.viewBox?.trim()) return "it needs a viewBox, so it can scale";
  return null;
}

export function checkSvg(bytes: Buffer): SvgCheck {
  if (bytes.length > MAX_SVG_BYTES) return { ok: false, error: `svg refused: too large (max ${MAX_SVG_BYTES / 1024 / 1024}MB)` };
  const text = bytes.toString("utf8");
  // Before parsing, not only during: svgo's parser reads an internal subset's
  // <!ENTITY> declarations into sax's entity table as it goes, so a refusal
  // in the walk would come after the expansion it exists to prevent.
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) return { ok: false, error: "svg refused: a DOCTYPE is not allowed" };

  const problem = inspect(text);
  if (problem) return { ok: false, error: `svg refused: ${problem}` };

  const { data } = optimize(text, {
    multipass: true,
    plugins: [{ name: "preset-default", params: { overrides: { removeViewBox: false } } }],
  });
  // The minifier rewrites CSS and attributes; what it hands back is what is
  // stored, so it is held to the same check rather than trusted.
  const after = inspect(data);
  if (after) return { ok: false, error: `svg refused: the minified file did not pass the check (${after})` };
  return { ok: true, svg: data };
}
