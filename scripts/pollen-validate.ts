// Producer-side dry-run for pollen (slice-2 spec §1; umbrella §11 —
// "ingest doors have --validate-only dry-runs", this is the feed twin).
//
// Usage:
//   npm run pollen:validate -- path/to/feed.ndjson
//   npm run pollen:validate -- path/to/envelope.json
//   npm run pollen:validate -- path/to/intent.json --intent
//
// Exit codes: 0 valid (warnings allowed), 1 invalid, 2 usage/read error.

import { readFileSync } from "node:fs";
import { validateFeed, validateIntent, validatePollen } from "../lib/pollen";

const intentMode = process.argv.includes("--intent");
const path = process.argv.slice(2).find((a) => a !== "--intent");
if (!path) {
  console.error("usage: pollen-validate <feed.ndjson | envelope.json> [--intent]");
  process.exit(2);
}

let text: string;
try {
  text = readFileSync(path, "utf8");
} catch {
  console.error(`cannot read ${path}`);
  process.exit(2);
}

let failed = false;

if (path.endsWith(".ndjson")) {
  for (const { line, result } of validateFeed(text)) {
    if (!result.ok) {
      failed = true;
      console.error(`line ${line}: ${result.error}`);
    } else {
      for (const w of result.warnings) console.warn(`line ${line}: warning: ${w}`);
    }
  }
} else {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("invalid JSON");
    process.exit(1);
  }
  const result = (intentMode ? validateIntent : validatePollen)(parsed);
  if (!result.ok) {
    failed = true;
    console.error(result.error);
  } else {
    for (const w of result.warnings) console.warn(`warning: ${w}`);
  }
}

console.log(failed ? "invalid" : "valid");
process.exit(failed ? 1 : 0);
