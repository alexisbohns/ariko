import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MapNodeCard } from "@/app/admin/_components/garden-map-node";
import type { MapNode } from "@/lib/garden-map";

const base: Pick<MapNode, "kind" | "label" | "href" | "waiting" | "gaps" | "dim"> = {
  kind: "bean",
  label: "Editor",
  href: "/admin/bean/editor",
  waiting: false,
  gaps: [],
  dim: false,
};

test("the name is a real link to the node's admin page", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={base} />);
  assert.match(html, /<a [^>]*href="\/admin\/bean\/editor"[^>]*>Editor<\/a>/);
});

test("a bucket has no link", () => {
  const html = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, kind: "bucket", label: "Unrooted", href: undefined }} />,
  );
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /Unrooted/);
});

test("waiting is said in words, not only in colour", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={{ ...base, waiting: true }} />);
  assert.match(html, />Waiting</);
  assert.match(html, /data-waiting/);
});

test("a calm node draws no chips", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={base} />);
  assert.doesNotMatch(html, /Waiting|narrative|French|Empty|journal/i);
});

test("each gap has its word, and no-children says what is empty", () => {
  const bean = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, gaps: ["no-narrative", "no-fr", "no-children"] }} />,
  );
  assert.match(bean, /No narrative/);
  assert.match(bean, /No French/);
  assert.match(bean, /No journal/);
  const pod = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, kind: "pod", gaps: ["no-children"] }} />,
  );
  assert.match(pod, /No beans/);
  const plant = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, kind: "plant", gaps: ["no-children"] }} />,
  );
  assert.match(plant, /Empty/);
});

test("a dimmed node says so for CSS and keeps its link", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={{ ...base, dim: true }} />);
  assert.match(html, /data-dim/);
  assert.match(html, /href="\/admin\/bean\/editor"/);
});
