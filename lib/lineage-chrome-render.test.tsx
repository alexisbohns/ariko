import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { LineageChrome } from "@/components/lineage-chrome";
import type { Lineage } from "@/lib/lineage";

const ONE_EACH: Lineage = [
  { kind: "plant", entries: [{ slug: "pbbls", name: "pbbls", href: "/admin/plant/pbbls", logoUrl: "https://res.cloudinary.com/demo/image/upload/v1/p.png" }] },
  { kind: "pod", entries: [{ slug: "pbbls-karma", name: "Karma", href: "/admin/pod/pbbls-karma" }] },
  { kind: "bean", entries: [{ slug: "pbbls-d8", name: "D8", href: "/admin/bean/pbbls-d8" }] },
];

const TWO_BEANS: Lineage = [
  { kind: "bean", entries: [
    { slug: "a", name: "Alpha", href: "/bean/a" },
    { slug: "b", name: "Beta", href: "/bean/b" },
  ] },
];

test("a tier with one parent is a link named for that parent", () => {
  const html = renderToStaticMarkup(<LineageChrome lineage={ONE_EACH} />);
  assert.ok(
    /<a[^>]+href="\/admin\/pod\/pbbls-karma"[^>]+aria-label="Karma"/.test(html) ||
      /<a[^>]+aria-label="Karma"[^>]+href="\/admin\/pod\/pbbls-karma"/.test(html),
    `a single parent must be a plain link whose accessible name is the PARENT'S name, not the tier's word. Got: ${html}`,
  );
  assert.ok(!/<details/.test(html), "a tier of one must not be a disclosure");
});

test("a tier with two parents is a disclosure holding both as real hrefs", () => {
  const html = renderToStaticMarkup(<LineageChrome lineage={TWO_BEANS} />);
  assert.ok(/<details/.test(html), `two parents must open a disclosure. Got: ${html}`);
  assert.ok(/<summary[^>]+aria-label="Beans: Alpha, Beta"/.test(html), `Got: ${html}`);
  assert.ok(/href="\/bean\/a"/.test(html) && /href="\/bean\/b"/.test(html),
    `every parent must be reachable as a real href with script off. Got: ${html}`);
});

test("the plant item's logo is in the server HTML", () => {
  const html = renderToStaticMarkup(<LineageChrome lineage={ONE_EACH} />);
  assert.ok(/<img\b/.test(html) && /res\.cloudinary\.com/.test(html),
    `the plant mark must server-render its <img> — a client avatar flashes its monogram on every first paint. Got: ${html}`);
});

test("an empty lineage renders nothing at all", () => {
  assert.equal(renderToStaticMarkup(<LineageChrome lineage={[]} />), "");
});

/**
 * The zone's anchor must reach the disclosure ROWS, not only the single link.
 *
 * A row that silently stayed a plain `<a>` is a HARD navigation in the admin —
 * the chrome torn down and rebuilt, the 284-358 ms flash PR #96 removed — and
 * it passes `tsc`, `npm test` AND `npm run build`, because a plain `<a>` is a
 * perfectly valid anchor everywhere else. Counting the probe's marker is the
 * only thing that reports it.
 */
function Probe({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} data-soft="1">{children}</a>;
}

test("the zone's anchor is used for the single link AND for every disclosure row", () => {
  const single = renderToStaticMarkup(<LineageChrome lineage={ONE_EACH} as={Probe} />);
  assert.equal((single.match(/data-soft="1"/g) ?? []).length, 3);

  const menu = renderToStaticMarkup(<LineageChrome lineage={TWO_BEANS} as={Probe} />);
  assert.equal(
    (menu.match(/data-soft="1"/g) ?? []).length,
    2,
    "a disclosure ROW that stayed a plain <a> is a hard navigation in the admin",
  );
});
