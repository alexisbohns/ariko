import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MapNodeCard } from "@/app/admin/_components/garden-map-node";
import type { MapNode } from "@/lib/garden-map";

type Props = Pick<MapNode, "kind" | "label" | "href" | "waiting" | "gaps" | "dim" | "image">;

const base: Props = {
  kind: "bean",
  label: "Editor",
  href: "/admin/bean/editor",
  waiting: false,
  gaps: [],
  dim: false,
};
const THUMB = "https://res.cloudinary.com/demo/image/upload/c_fill,w_88,h_88/v1/editor.png";

const render = (node: Partial<Props>): string => renderToStaticMarkup(<MapNodeCard node={{ ...base, ...node }} />);
const imgs = (html: string): string[] => html.match(/<img\b[^>]*>/g) ?? [];
const link = (html: string): string => html.match(/<a\b[^>]*>/)?.[0] ?? "";

test("the name is a real link to the node's admin page", () => {
  const html = render({});
  assert.match(html, /<a [^>]*href="\/admin\/bean\/editor"[^>]*>Editor<\/a>/);
});

test("the link opts in to pointer events, does not prefetch or drag, and stretches over the whole card", () => {
  const anchor = link(render({}));
  assert.match(anchor, /class="[^"]*\bpointer-events-auto\b/);
  assert.match(anchor, /draggable="false"/);
  assert.match(anchor, /class="[^"]*\bafter:absolute\b/);
  assert.match(anchor, /class="[^"]*\bafter:inset-0\b/);
  // `prefetch={false}` leaves no attribute in static markup; the source test
  // pins it. What a render CAN see is that the card is the positioned ancestor.
  assert.match(render({}), /<div [^>]*data-kind="bean"[^>]*class="[^"]*\brelative\b/);
});

test("a bucket has no link, and a dashed border", () => {
  const html = render({ kind: "bucket", label: "Unrooted", href: undefined });
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /Unrooted/);
  assert.match(html, /\bborder-dashed\b/);
});

test("a plant draws a 72px medallion from its thumbnail and a large name", () => {
  const html = render({ kind: "plant", label: "Paulopus", href: "/admin/plant/paulopus", image: THUMB });
  const [img, ...more] = imgs(html);
  assert.equal(more.length, 0);
  assert.ok(img.includes(`src="${THUMB}"`));
  assert.match(img, /alt=""/);
  assert.match(img, /width="72"/);
  assert.match(img, /height="72"/);
  assert.match(img, /class="[^"]*\brounded-full\b/);
  assert.match(img, /class="[^"]*\bobject-cover\b/);
  const anchor = link(html);
  assert.match(anchor, /class="[^"]*\btext-2xl\b/);
  assert.match(anchor, /class="[^"]*\bfont-heading\b/);
  assert.match(anchor, /class="[^"]*\btruncate\b/);
});

test("a plant without a logo draws its initial in the medallion", () => {
  const html = render({ kind: "plant", label: "paulopus", href: "/admin/plant/paulopus" });
  assert.equal(imgs(html).length, 0);
  assert.match(html, /data-slot="map-initial"[^>]*>P</);
  assert.match(html, /\brounded-full\b/);
});

test("a pod and a bean draw the cover they were given", () => {
  const pod = render({ kind: "pod", label: "Editor", href: "/admin/pod/editor", image: THUMB });
  assert.equal(imgs(pod).length, 1);
  assert.ok(imgs(pod)[0].includes(`src="${THUMB}"`));
  assert.match(imgs(pod)[0], /class="[^"]*\bobject-cover\b/);
  const bean = render({ image: THUMB });
  assert.equal(imgs(bean).length, 1);
  assert.ok(imgs(bean)[0].includes(`src="${THUMB}"`));
  assert.match(imgs(bean)[0], /width="44"/);
  assert.match(imgs(bean)[0], /class="[^"]*\brounded-lg\b/);
});

test("no image draws an initial tile instead: the first non-space character, upper-cased", () => {
  const bean = render({ label: "  éditor" });
  assert.equal(imgs(bean).length, 0);
  assert.match(bean, /data-slot="map-initial"[^>]*>É</);
  assert.match(bean, /\bbg-muted\b/);
  assert.match(bean, /\btext-muted-foreground\b/);
  const pod = render({ kind: "pod", label: "garden", href: "/admin/pod/garden" });
  assert.match(pod, /data-slot="map-initial"[^>]*>G</);
  const emoji = render({ label: "🌱 Seedlings" });
  assert.match(emoji, /data-slot="map-initial"[^>]*>🌱</);
});

test("every image is decorative, lazy and not draggable", () => {
  for (const kind of ["plant", "pod", "bean"] as const) {
    const [img] = imgs(render({ kind, image: THUMB }));
    assert.ok(img, kind);
    assert.match(img, /alt=""/, kind);
    assert.match(img, /loading="lazy"/, kind);
    assert.match(img, /decoding="async"/, kind);
    assert.match(img, /draggable="false"/, kind);
  }
});

test("a sprout and a seed count draw no image, even if one were passed", () => {
  assert.equal(imgs(render({ kind: "sprout", label: "Draft", href: "/admin/sprout/draft", image: THUMB })).length, 0);
  assert.equal(imgs(render({ kind: "seed", label: "62 seeds", href: "/admin/inbox", image: THUMB })).length, 0);
});

test("waiting is said in words, not only in colour", () => {
  const html = render({ waiting: true });
  assert.match(html, />Waiting</);
  assert.match(html, /data-waiting/);
  assert.match(html, /\bring-amber-500\b/);
});

test("a calm node draws no chips", () => {
  assert.doesNotMatch(render({}), /Waiting|narrative|French|Empty|journal/i);
});

test("each gap has its word, and no-children says what is empty", () => {
  const bean = render({ gaps: ["no-narrative", "no-fr", "no-children"] });
  assert.match(bean, /No narrative/);
  assert.match(bean, /No French/);
  assert.match(bean, /No journal/);
  assert.match(render({ kind: "pod", gaps: ["no-children"] }), /No beans/);
  assert.match(render({ kind: "plant", gaps: ["no-children"] }), /Empty/);
});

test("chips draw on every kind that can carry them", () => {
  for (const kind of ["plant", "pod", "bean", "sprout", "seed"] as const) {
    assert.match(render({ kind, waiting: true }), />Waiting</, kind);
  }
});

test("a dimmed node says so for CSS and keeps its link", () => {
  const html = render({ dim: true });
  assert.match(html, /data-dim/);
  assert.match(html, /\bopacity-30\b/);
  assert.match(html, /href="\/admin\/bean\/editor"/);
});
