// Pure logic for the Lab Note pipeline (spec: docs/superpowers/specs/2026-07-18-lab-note-pipeline-design.md).
// No I/O here — post.mjs is the only file that touches the network.
import yaml from "js-yaml";

// The gate (spec §3): a level-2 heading starting with "## Lab Note" opens the
// section; the next level-2 heading (or EOF) closes it. First ```yaml fence
// inside wins; extra fences are ignored. Returns the fence body or null.
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
