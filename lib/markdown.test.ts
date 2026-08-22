import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";

// Drives the EXACT chain the app renders (spec §7). No JSX: tsconfig sets
// jsx:"preserve", so a .tsx test would not run under tsx.
function render(source: string): string {
  return renderToStaticMarkup(
    createElement(Markdown, { remarkPlugins, rehypePlugins }, source),
  );
}

test("renders a GFM table", () => {
  const html = render("| verdict | points |\n| --- | --- |\n| Perfect | 1.5 |");
  assert.match(html, /<table>/);
  assert.match(html, /<th>verdict<\/th>/);
  assert.match(html, /<td>1\.5<\/td>/);
});

test("keeps the language class on a fenced code block", () => {
  const html = render('```json\n{ "matchId": "M099" }\n```');
  assert.match(html, /class="language-json"/);
});

// The three security cases below are the point of this file. Two of them pass
// trivially today because remark-rehype DROPS raw HTML when rehype-raw is
// absent — that is deliberate: they are regression guards for the day someone
// reaches for rehype-raw. The javascript: case exercises the sanitizer itself.
test("drops a script tag", () => {
  const html = render("<script>alert(1)</script>\n\nplain text");
  assert.doesNotMatch(html, /<script/);
});

test("drops an onclick attribute", () => {
  const html = render('<p onclick="alert(1)">hi</p>');
  assert.doesNotMatch(html, /onclick/);
});

test("drops a javascript: href", () => {
  const html = render("[click](javascript:alert(1))");
  assert.doesNotMatch(html, /javascript:/);
});

test("renders nothing for blank content", () => {
  assert.equal(render(""), "");
});
