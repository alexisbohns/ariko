import { test } from "node:test";
import assert from "node:assert/strict";
import { screenNameFromStem } from "./screen-name";

// Table test: the derivation is what every future reader of the import sees
// first, and the cases below are the ones a capture run actually produces.
const CASES: [stem: string, name: string][] = [
  // The ordinary case — the shape the capture run emits by the hundred.
  ["home-upcoming-mock", "Home upcoming mock"],
  ["match-hero-m104-final-spain-argentina-aet", "Match hero m104 final spain argentina aet"],
  // Underscores count as separators too; some capture tools emit them.
  ["karma_top", "Karma top"],
  ["match_brief-sources", "Match brief sources"],
  // Runs of separators collapse, and stray leading/trailing ones vanish.
  ["home--teams", "Home teams"],
  ["-karma-experience-", "Karma experience"],
  // A stem that already has a space does not come back with two.
  ["home upcoming-mock", "Home upcoming mock"],
  // Only the first letter is touched: a deliberate capital survives untouched,
  // and nothing is title-cased on the way through.
  ["AET-final", "AET final"],
  ["match-Anatomy", "Match Anatomy"],
  // A leading digit has no upper case; capitalising is a no-op, not a crash.
  ["404-page", "404 page"],
  // One word is a whole name.
  ["karma", "Karma"],
  // Degenerate input returns "" rather than throwing on words[0].
  ["", ""],
  ["---", ""],
];

for (const [stem, name] of CASES) {
  test(`screenNameFromStem(${JSON.stringify(stem)}) → ${JSON.stringify(name)}`, () => {
    assert.equal(screenNameFromStem(stem), name);
  });
}
