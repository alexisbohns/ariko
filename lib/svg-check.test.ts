import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSvg, MAX_SVG_BYTES } from "./svg-check";

const svg = (body: string, attrs = 'viewBox="0 0 10 10"') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`);

test("a clean drawing passes and comes back minified, viewBox kept", () => {
  const r = checkSvg(svg('<g fill="none" stroke="#111"><path d="M0 0 L10 10"/><circle cx="5" cy="5" r="2"/></g><text x="1" y="9">Hi</text>'));
  assert.ok(r.ok, r.ok ? "" : r.error);
  assert.match(r.svg, /viewBox="0 0 10 10"/);
  assert.doesNotMatch(r.svg, /\n {2}/);
});

test("internal references, gradients and a style block without url() pass", () => {
  const r = checkSvg(svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><use href="#g"/><style>.a{fill:#000}</style>'));
  assert.ok(r.ok, r.ok ? "" : r.error);
});

test("harmless document furniture passes: an XML declaration, comments, CDATA in <style>, xlink:href to a fragment", () => {
  const r = checkSvg(Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?><!-- drawn by hand -->' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">' +
      '<style><![CDATA[.a{fill:url("#g")}]]></style><symbol id="s"><rect width="1" height="1" class="a"/></symbol>' +
      '<use xlink:href="#s"/><title>A square</title></svg>',
  ));
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

  // Beyond the plan: each of these executes or fetches when the stored file is
  // opened directly in a browser, or would on some engine still in use.
  ["a link", svg('<a href="javascript:alert(1)"><rect width="1" height="1"/></a>'), /<a> is not allowed/],
  ["javascript: href on use", svg('<use href="javascript:alert(1)"/>'), /href must point inside the file/],
  ["entity-encoded javascript:", svg('<use href="&#106;avascript:alert(1)"/>'), /href must point inside the file/],
  ["leading whitespace before javascript:", svg('<use href=" javascript:alert(1)"/>'), /href must point inside the file/],
  ["data: href on use", svg('<use href="data:image/svg+xml;base64,PHN2Zy8+#a"/>'), /href must point inside the file/],
  ["href under a rebound xlink prefix", svg('<use xmlns:x="http://www.w3.org/1999/xlink" x:href="https://evil.example/a"/>'), /x:href is not allowed/],
  ["xml:base", svg('<use xml:base="https://evil.example/x.svg" href="#a"/>'), /xml:base is not allowed/],
  ["url() in a style attribute", svg('<rect style="fill:url(https://evil.example/a)" width="1" height="1"/>'), /url\(\) must point inside the file/],
  ["background url() in a style attribute", svg('<g style="background:url(https://evil.example/a.png)"/>'), /url\(\) must point inside the file/],
  ["uppercase URL( in a style attribute", svg('<g style="fill:URL( \'https://evil.example/a\')"/>'), /url\(\) must point inside the file/],
  ["escaped url() in <style>", svg("<style>.a{fill:u\\rl(https://evil.example/a)}</style>"), /CSS escape/],
  ["escaped @import in <style>", svg("<style>@\\69mport 'https://evil.example/a.css';</style>"), /CSS escape/],
  ["escaped url() in an attribute", svg('<rect fill="u\\rl(https://evil.example/a)" width="1" height="1"/>'), /CSS escape/],
  ["image-set() fetches without url()", svg('<style>.a{fill:image-set("https://evil.example/a.png" 1x)}</style>'), /image-set\(\) is not allowed/],
  ["@import split by an XML comment", svg("<style>@im<!-- x -->port 'https://evil.example/a.css';</style>"), /@import is not allowed/],
  ["url() split by CDATA", svg("<style>.a{fill:ur<![CDATA[l(https://evil.example/a)]]>}</style>"), /url\(\) must point inside the file/],
  ["url() inside CDATA", svg("<style><![CDATA[@font-face{src:url(https://evil.example/f.woff2)}]]></style>"), /url\(\) must point inside the file/],
  ["@import hidden by a CSS comment", svg("<style>@im/**/port 'https://evil.example/a.css';</style>"), /@import is not allowed/],
  ["@font-face with a data: url", svg("<style>@font-face{font-family:X;src:url(data:font/woff2;base64,AAAA)}</style>"), /url\(\) must point inside the file/],
  ["an element inside <style>", svg("<style><g/>.a{}</style>"), /<style> may hold only CSS/],
  ["xml-stylesheet instruction", Buffer.from('<?xml-stylesheet href="https://evil.example/a.css"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'), /<\?xml-stylesheet\?> is not allowed/],
  ["an instruction inside the drawing", svg("<?php echo 1 ?>"), /<\?php\?> is not allowed/],
  ["uppercase SCRIPT", svg("<SCRIPT>alert(1)</SCRIPT>"), /<SCRIPT> is not allowed/],
  ["html:script", svg('<html:script xmlns:html="http://www.w3.org/1999/xhtml">alert(1)</html:script>'), /<html:script> is not allowed/],
  ["svg:script", svg('<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>'), /<svg:script> is not allowed/],
  ["a default namespace rebound to XHTML", svg('<g xmlns="http://www.w3.org/1999/xhtml"><style>.a{}</style></g>'), /xmlns must be the SVG namespace/],
  ["a root outside the SVG namespace", Buffer.from('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'), /xmlns must be the SVG namespace/],
  ["uppercase ONCLICK", svg('<rect ONCLICK="alert(1)" width="1" height="1"/>'), /ONCLICK is not allowed/],
  ["an attribute off the allowlist", svg('<rect width="1" height="1" cursor="url(https://evil.example/c.cur)"/>'), /cursor is not allowed/],
  ["iframe", svg('<iframe src="https://evil.example"/>'), /<iframe> is not allowed/],
  ["filter (fetches via feImage)", svg('<filter id="f"><feImage href="https://evil.example/a.png"/></filter>'), /<filter> is not allowed/],
  ["two root elements", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'), /not an SVG/],
  ["unclosed root", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/>'), /not an SVG/],
  ["an undeclared entity", svg("<text>&x;</text>"), /not an SVG/],
];

for (const [name, bytes, message] of refused) {
  test(`refused, by name: ${name}`, () => {
    const r = checkSvg(bytes);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, message);
  });
}

test("the message names the FIRST thing found, so fixing it is a clear next step", () => {
  const r = checkSvg(svg('<script>1</script><rect onload="2" width="1" height="1"/>'));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "svg refused: <script> is not allowed");
});

test("too large is refused before parsing", () => {
  const r = checkSvg(Buffer.alloc(MAX_SVG_BYTES + 1, 32));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /too large/);
});

test("what comes back passes the check itself, unchanged — the stored bytes are the checked bytes", () => {
  const r = checkSvg(svg('<style>.a{fill:#000}</style><g class="a"><path d="M0 0 L10 10"/></g>'));
  assert.ok(r.ok, r.ok ? "" : r.error);
  const again = checkSvg(Buffer.from(r.svg));
  assert.ok(again.ok, again.ok ? "" : again.error);
  assert.equal(again.svg, r.svg);
});

// Hand-written stand-ins for a Figma and an Excalidraw export (see the comment
// at the top of each file); replace them with real exports when one is made.
for (const file of ["figma-like.svg", "excalidraw-like.svg"]) {
  test(`an export shaped like ${file} passes with its viewBox`, () => {
    const r = checkSvg(readFileSync(new URL(`./__fixtures__/svg/${file}`, import.meta.url)));
    assert.ok(r.ok, r.ok ? "" : r.error);
    assert.match(r.svg, /viewBox="0 0 \d+ \d+"/);
  });
}
