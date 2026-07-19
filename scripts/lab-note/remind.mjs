#!/usr/bin/env node
// Thin I/O shell for the advisory Lab Note reminder (C1d) — all decisions live in
// lib.mjs. Runs on PR open/edit and upserts exactly ONE marker comment when the PR
// lacks a valid Lab Note; removes it once the PR is satisfied or opted out. Never
// blocks. Reads env:
//   LAB_NOTE_REPO  owner/name of the repo whose PR fired (required)
//   LAB_NOTE_PR    PR number (required)
//   GITHUB_TOKEN   token able to read the PR and write comments (required)
//   LAB_NOTE_MOLECULE  this repo's suggested molecule slug (default "ariko")
//   DRY_RUN        "true" prints the verdict + intended comment, posts nothing.
//                  With LAB_NOTE_BODY set it runs fully offline (no GitHub calls),
//                  reading labels from LAB_NOTE_LABELS (comma-sep) and draft from
//                  LAB_NOTE_DRAFT — handy for verifying the four verdicts locally.
// Exit codes: 0 done (advisory) · 3 GitHub unreachable · 5 usage.
import { reminderVerdict, reminderComment, REMINDER_MARKER, OPT_OUT_LABEL } from "./lib.mjs";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`lab-note-reminder: missing required env ${name}`);
    process.exit(5);
  }
  return v;
}

const molecule = process.env.LAB_NOTE_MOLECULE || "ariko";
const dryRun = process.env.DRY_RUN === "true";

// Fully-offline dry run: compute the verdict from env, print it, touch no network.
if (dryRun && process.env.LAB_NOTE_BODY !== undefined) {
  const hasOptOutLabel = (process.env.LAB_NOTE_LABELS || "")
    .split(",")
    .map((s) => s.trim())
    .includes(OPT_OUT_LABEL);
  const verdict = reminderVerdict(process.env.LAB_NOTE_BODY, {
    hasOptOutLabel,
    isDraft: process.env.LAB_NOTE_DRAFT === "true",
  });
  const wanted = reminderComment(verdict, { molecule });
  console.log(`lab-note-reminder: verdict ${verdict.state}${verdict.error ? ` (${verdict.error})` : ""}`);
  console.log(wanted ? `--- would upsert comment ---\n${wanted}` : "--- no comment (satisfied) ---");
  process.exit(0);
}

const repo = need("LAB_NOTE_REPO");
const prNumber = need("LAB_NOTE_PR");
const githubToken = need("GITHUB_TOKEN");
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";

const gh = (path, init = {}) =>
  fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${githubToken}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

// Live body/labels/draft — the reminder re-evaluates the current PR state on each event.
const prRes = await gh(`/repos/${repo}/pulls/${prNumber}`);
if (!prRes.ok) {
  console.error(`lab-note-reminder: could not fetch PR ${repo}#${prNumber}: HTTP ${prRes.status}`);
  process.exit(3);
}
const pr = await prRes.json();
const hasOptOutLabel = (pr.labels ?? []).some((l) => (l.name ?? l) === OPT_OUT_LABEL);

const verdict = reminderVerdict(pr.body ?? "", { hasOptOutLabel, isDraft: pr.draft === true });
const wanted = reminderComment(verdict, { molecule });

if (dryRun) {
  console.log(`lab-note-reminder: verdict ${verdict.state}${verdict.error ? ` (${verdict.error})` : ""}`);
  console.log(wanted ? `--- would upsert comment ---\n${wanted}` : "--- no comment (satisfied) ---");
  process.exit(0);
}

// Find our existing marker comment (one page is plenty at personal-portfolio scale).
const listRes = await gh(`/repos/${repo}/issues/${prNumber}/comments?per_page=100`);
if (!listRes.ok) {
  console.error(`lab-note-reminder: could not list comments on ${repo}#${prNumber}: HTTP ${listRes.status}`);
  process.exit(3);
}
const existing = (await listRes.json()).find((c) => (c.body ?? "").includes(REMINDER_MARKER));

if (!wanted) {
  if (existing) {
    const del = await gh(`/repos/${repo}/issues/comments/${existing.id}`, { method: "DELETE" });
    if (!del.ok) {
      console.error(`lab-note-reminder: could not remove stale reminder: HTTP ${del.status}`);
      process.exit(3);
    }
    console.log(`lab-note-reminder: ${verdict.state} — removed the reminder on ${repo}#${prNumber}.`);
  } else {
    console.log(`lab-note-reminder: ${verdict.state} — nothing to do on ${repo}#${prNumber}.`);
  }
  process.exit(0);
}

const write = existing
  ? await gh(`/repos/${repo}/issues/comments/${existing.id}`, { method: "PATCH", body: JSON.stringify({ body: wanted }) })
  : await gh(`/repos/${repo}/issues/${prNumber}/comments`, { method: "POST", body: JSON.stringify({ body: wanted }) });
if (!write.ok) {
  console.error(`lab-note-reminder: could not ${existing ? "update" : "post"} reminder: HTTP ${write.status}`);
  process.exit(3);
}
console.log(`lab-note-reminder: ${verdict.state} — ${existing ? "updated" : "posted"} the reminder on ${repo}#${prNumber}.`);
process.exit(0);
