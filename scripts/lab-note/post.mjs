#!/usr/bin/env node
// Thin I/O shell (spec §5.1) — all decisions live in lib.mjs. Reads env:
//   LAB_NOTE_REPO  owner/name of the repo whose PR fired (required)
//   LAB_NOTE_PR    PR number (required)
//   GITHUB_TOKEN   token able to read that PR (required)
//   ARIKO_URL      inbox origin (default https://www.ariko.app)
//   DRY_RUN        "true" prints the payload instead of posting
//   INBOX_TOKEN    bearer token for /api/inbox (required unless DRY_RUN)
// Exit codes: 0 posted/updated/skipped · 2 invalid note · 3 unreachable · 4 auth · 5 usage.
import { extractLabNoteYaml, parseLabNote, buildInboxPayload, classifyResponse } from "./lib.mjs";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`lab-note: missing required env ${name}`);
    process.exit(5);
  }
  return v;
}

const repo = need("LAB_NOTE_REPO");
const prNumber = need("LAB_NOTE_PR");
const githubToken = need("GITHUB_TOKEN");
const arikoUrl = (process.env.ARIKO_URL || "https://www.ariko.app").replace(/\/+$/, "");
const dryRun = process.env.DRY_RUN === "true";

// Live body, not the event snapshot: editing a merged PR and re-running picks up the fix.
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const prRes = await fetch(`${apiBase}/repos/${repo}/pulls/${prNumber}`, {
  headers: { authorization: `Bearer ${githubToken}`, accept: "application/vnd.github+json" },
});
if (!prRes.ok) {
  console.error(`lab-note: could not fetch PR ${repo}#${prNumber}: HTTP ${prRes.status}`);
  process.exit(3);
}
const pr = await prRes.json();

const yamlText = extractLabNoteYaml(pr.body ?? "");
if (yamlText === null) {
  console.log(`lab-note: skipped — no "## Lab Note" section in ${repo}#${prNumber}`);
  process.exit(0);
}

const parsed = parseLabNote(yamlText);
if (!parsed.ok) {
  console.error(`lab-note: invalid note in ${repo}#${prNumber}: ${parsed.error}`);
  console.error("lab-note: edit the merged PR's body and re-run this job (posting is idempotent).");
  process.exit(2);
}

const payload = buildInboxPayload(parsed.note, { repo, number: Number(prNumber), url: pr.html_url });

if (dryRun) {
  console.log(`lab-note: dry run — would POST to ${arikoUrl}/api/inbox:`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const inboxToken = need("INBOX_TOKEN");
let res;
try {
  res = await fetch(`${arikoUrl}/api/inbox`, {
    method: "POST",
    headers: { authorization: `Bearer ${inboxToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
} catch (err) {
  console.error(`lab-note: ${arikoUrl} unreachable: ${err.cause?.message ?? err.message} — re-run when it is back.`);
  process.exit(3);
}

const { outcome, exitCode } = classifyResponse(res.status);
const detail = (await res.text()).slice(0, 1000);
if (exitCode === 0) {
  console.log(`lab-note: ${outcome} (HTTP ${res.status}) ${detail}`);
} else if (outcome === "unauthorized") {
  console.error(
    `lab-note: unauthorized (HTTP ${res.status}) — check this repo's ARIKO_INBOX_TOKEN secret and its github: scoping in Ariko's INBOX_TOKENS.`,
  );
} else {
  console.error(`lab-note: ${outcome} (HTTP ${res.status}) ${detail}`);
}
process.exit(exitCode);
