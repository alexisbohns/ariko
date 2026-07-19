// Pure logic for the Lab Note pipeline (spec: docs/superpowers/specs/2026-07-18-lab-note-pipeline-design.md).
// No I/O here — post.mjs is the only file that touches the network.
import yaml from "js-yaml";

// The gate (spec §3): a level-2 heading starting with "## Lab Note" opens the
// section; the next level-2 heading (or EOF) closes it. First ```yaml fence
// inside wins; extra fences are ignored. Returns the fence body or null.
// Line-based, not fence-aware: a "## " line inside the fence would close the section early.
export function extractLabNoteYaml(prBody) {
  if (typeof prBody !== "string" || prBody === "") return null;
  const lines = prBody.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Lab Note/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(start + 1, end);
  const fenceStart = section.findIndex((l) => /^\s*```ya?ml\s*$/.test(l));
  if (fenceStart === -1) return null;
  const rest = section.slice(fenceStart + 1);
  const fenceLen = rest.findIndex((l) => /^\s*```\s*$/.test(l));
  if (fenceLen === -1) return null;
  return rest.slice(0, fenceLen).join("\n");
}

function nonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isMapping(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Validates the harmonized contract (spec §3): en.title + en.summary required,
// fr recommended, suggested optional, unknown keys ignored (pbbls superset).
// CORE_SCHEMA for the same reason as lib/data.ts: unquoted dates stay strings.
export function parseLabNote(yamlText) {
  let doc;
  try {
    doc = yaml.load(yamlText, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    return { ok: false, error: `invalid YAML: ${err.message}` };
  }
  if (!isMapping(doc)) return { ok: false, error: "lab note must be a YAML mapping" };
  const en = isMapping(doc.en) ? doc.en : {};
  if (!nonEmptyString(en.title)) return { ok: false, error: "en.title is required" };
  if (!nonEmptyString(en.summary)) return { ok: false, error: "en.summary is required" };
  const fr = isMapping(doc.fr) ? doc.fr : {};
  const note = {
    en: { title: en.title.trim(), summary: en.summary.trim() },
    fr: {
      ...(nonEmptyString(fr.title) ? { title: fr.title.trim() } : {}),
      ...(nonEmptyString(fr.summary) ? { summary: fr.summary.trim() } : {}),
    },
  };
  if (isMapping(doc.suggested)) {
    const s = doc.suggested;
    const suggested = {
      ...(nonEmptyString(s.molecule) ? { molecule: s.molecule.trim() } : {}),
      ...(nonEmptyString(s.atom) ? { atom: s.atom.trim() } : {}),
      ...(nonEmptyString(s.type) ? { type: s.type.trim() } : {}),
      ...(Array.isArray(s.tags) && s.tags.length > 0 && s.tags.every((t) => nonEmptyString(t))
        ? { tags: s.tags.map((t) => t.trim()) }
        : {}),
    };
    if (Object.keys(suggested).length > 0) note.suggested = suggested;
  }
  return { ok: true, note };
}

// Maps a parsed note onto the POST /api/inbox payload (spec §4).
// pr: { repo: "owner/name", number, url }.
export function buildInboxPayload(note, pr) {
  const payload = {
    title: note.fr.title ? { en: note.en.title, fr: note.fr.title } : note.en.title,
    body: { en: note.en.summary, ...(note.fr.summary ? { fr: note.fr.summary } : {}) },
    source: { kind: "github", url: pr.url, externalId: `${pr.repo}#${pr.number}` },
  };
  if (note.suggested) {
    const { molecule, atom, type, tags } = note.suggested;
    payload.suggested = {
      ...(molecule ? { moleculeSlug: molecule } : {}),
      ...(atom ? { atomSlug: atom } : {}),
      ...(type ? { type } : {}),
      ...(tags ? { tags } : {}),
    };
  }
  return payload;
}

// Outcome/exit-code table (spec §7). 200 and 201 are both success; 400 means the
// payload was rejected by the inbox validator (should not happen after parseLabNote,
// so it fails loudly); anything else is a delivery problem worth a re-run.
export function classifyResponse(status) {
  if (status === 201) return { outcome: "posted", exitCode: 0 };
  if (status === 200) return { outcome: "updated", exitCode: 0 };
  if (status === 401 || status === 403) return { outcome: "unauthorized", exitCode: 4 };
  if (status === 400) return { outcome: "rejected", exitCode: 2 };
  return { outcome: "unreachable", exitCode: 3 };
}

// --- Advisory reminder (C1d) ---------------------------------------------------
// The reminder is a non-blocking PR-open counterpart to the merge-time post: it
// nudges when a PR has no valid Lab Note, and shifts note validation left. It
// never classifies "user-facing" from the diff — instead it nags on any PR that
// has neither a valid note nor the opt-out label, which is cheap because it only
// comments. Same gate/parse as the post path (extractLabNoteYaml + parseLabNote).

// Opt-out label that silences the reminder (chore/refactor/infra/docs PRs).
export const OPT_OUT_LABEL = "no-lab-note";

// Hidden marker that identifies our comment so the shell can upsert exactly one.
export const REMINDER_MARKER = "<!-- lab-note-reminder -->";

// Pure verdict for a PR body + context. States:
//   ok       valid note present            → no reminder (remove any stale one)
//   missing  no "## Lab Note" section       → reminder
//   invalid  section present but malformed   → reminder naming the exact problem
//   skipped  draft, or opt-out label present → no reminder
export function reminderVerdict(prBody, { hasOptOutLabel = false, isDraft = false } = {}) {
  if (isDraft) return { state: "skipped", reason: "draft" };
  if (hasOptOutLabel) return { state: "skipped", reason: `${OPT_OUT_LABEL} label` };
  const yamlText = extractLabNoteYaml(prBody ?? "");
  if (yamlText === null) return { state: "missing" };
  const parsed = parseLabNote(yamlText);
  if (!parsed.ok) return { state: "invalid", error: parsed.error };
  return { state: "ok" };
}

// Markdown comment body for a verdict, or null when no comment should exist.
// molecule is this repo's suggested slug, shown in the skeleton. Built without
// template literals so the embedded ```yaml fence stays literal.
export function reminderComment(verdict, { molecule = "ariko" } = {}) {
  if (verdict.state !== "missing" && verdict.state !== "invalid") return null;
  const lines = [REMINDER_MARKER];
  if (verdict.state === "invalid") {
    lines.push(
      "⚠️ **Lab Note check** — the `## Lab Note` section is present but invalid: **" +
        verdict.error +
        "**.",
      "",
      "Fix the YAML in the PR body (see the `lab-note` skill or `CLAUDE.md`). Catching it now avoids a loud failure when the post-on-merge job runs.",
    );
  } else {
    lines.push(
      "📋 **Lab Note check** — this PR has no `## Lab Note` section.",
      "",
      "If it changes something a user, visitor, or listener would notice, add one so the change files itself into the Ariko inbox on merge (see the `lab-note` skill or `CLAUDE.md`):",
      "",
      "```yaml",
      "en:",
      "  title: Short, benefit-first title             # required",
      "  summary: One or two sentences, user-facing.   # required",
      "fr:                                             # recommended — adaptation, informal \"Tu\"",
      "  title: Titre court, orienté bénéfice",
      "  summary: Une ou deux phrases, adaptées, pas traduites littéralement.",
      "suggested:                                      # optional",
      "  molecule: " + molecule,
      "  type: feature",
      "  tags: [changelog]",
      "```",
      "",
      "Just a chore / refactor / infra / docs change? Add the **`" +
        OPT_OUT_LABEL +
        "`** label and this check goes quiet.",
    );
  }
  lines.push("", "_Non-blocking reminder from the Lab Note pipeline._");
  return lines.join("\n");
}
