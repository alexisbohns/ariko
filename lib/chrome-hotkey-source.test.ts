import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The shortcut chips shipped wrong once, and every gate said they were fine.
 *
 * `hotkey="⌘K"` in JSX renders the six characters `⌘` followed by `K`,
 * because a JSX attribute's value is RAW TEXT — it is not a JavaScript string
 * literal, so it processes no backslash escapes. The chip read `⌘K` in the
 * chrome while `tsc`, `npm test`, `npm run lint` and `npm run build` all passed,
 * which is this repo's standing definition of something worth pinning.
 *
 * The rule is narrow on purpose: a modifier symbol belongs in a named constant
 * spelled as the character (`"⌥"`, `"⌘"`), never as an escape anywhere, and
 * never inline in an attribute. A constant is a real string literal, so an
 * escape there would work — but it would work only for the reader who knows the
 * codepoint, and the next person to copy it into an attribute reintroduces
 * exactly this bug.
 */

/**
 * Comments stripped before matching, which `lib/pwa-source.test.ts` learned the
 * hard way: the only `\uXXXX` in this repo is the sentence in
 * `command-palette.tsx` explaining why you must not write one, and a test that
 * failed on its own documentation would teach the next person to delete the
 * explanation rather than the mistake.
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const FILES = [
  "components/chrome.tsx",
  "app/admin/_components/admin-chrome.tsx",
  "app/admin/_components/command-palette.tsx",
  "app/admin/_components/plant-switcher.tsx",
];

for (const path of FILES) {
  test(`${path} spells modifier symbols as characters, not escapes`, () => {
    const source = code(path);
    assert.equal(
      /\\u[0-9a-fA-F]{4}/.test(source),
      false,
      `${path} contains a \\uXXXX escape. In a JSX attribute that renders verbatim; ` +
        `spell the symbol as the character instead.`,
    );
  });
}

test("a hotkey attribute is never a bare quoted string", () => {
  // `hotkey={CMD_K}` and `hotkey={`${ALT_SYMBOL}${item.hotkey}`}` are the two
  // shapes in use. A quoted form is not wrong in itself — but it is the shape
  // the broken one took, and there is no reason to reach for it when the symbol
  // already lives in a constant.
  for (const path of FILES) {
    const source = code(path);
    const quoted = source.match(/hotkey="[^"]*"/g) ?? [];
    assert.deepEqual(quoted, [], `${path}: ${quoted.join(", ")}`);
  }
});
