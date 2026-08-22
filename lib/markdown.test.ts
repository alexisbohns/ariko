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

test("a block entity directive mints an entity-card carrying its ref", () => {
  const html = render("::entity{ref=bean:karma-accountability}");
  assert.match(html, /<entity-card/);
  assert.match(html, /bean:karma-accountability/);
});

test("an inline entity directive mints an entity-link", () => {
  const html = render("see :entity[the karma page]{ref=bean:karma} for detail");
  assert.match(html, /<entity-link/);
  assert.match(html, /the karma page/);
});

test("a directive with no ref mints no card", () => {
  const html = render("::entity{}");
  assert.doesNotMatch(html, /entity-card/);
});

test("a directive cannot smuggle an event handler past the widened schema", () => {
  const html = render('::entity{ref=bean:x onclick="alert(1)"}');
  assert.doesNotMatch(html, /onclick/);
});

test("a non-entity directive is left alone", () => {
  const html = render("::note{ref=bean:x}");
  assert.doesNotMatch(html, /entity-card/);
});

test("headings get an id so deep links can land on them", () => {
  const html = render("## Execution\n\ntext");
  assert.match(html, /<h2 id="execution">/);
});

test("an author-supplied id on other elements is still stripped", () => {
  const html = render('<p id="sneaky">hi</p>');
  assert.doesNotMatch(html, /sneaky/);
});
