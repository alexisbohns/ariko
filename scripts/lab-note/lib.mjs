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
