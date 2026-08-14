// One-shot: data/seed.yml -> data/garden.yml with botanical keys and prefixes.
// Idempotent: running on an already-botanical file is a no-op rewrite; when
// both files exist, garden.yml wins as the source.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const src = ["garden.yml", "seed.yml"]
  .map((f) => join(process.cwd(), "data", f))
  .find(existsSync);
if (!src) throw new Error("no data/seed.yml or data/garden.yml found");

type Entry = Record<string, unknown> & { parents?: string[]; relations?: { kind: string; ref: string }[] };
const raw = yaml.load(readFileSync(src, "utf8"), { schema: yaml.CORE_SCHEMA }) as Record<string, Entry[]>;

const ref = (r: string) =>
  r.replace(/^molecule:/, "pod:").replace(/^atom:/, "bean:").replace(/^version:/, "sprout:");
const mapParents = (x: Entry): Entry => ({
  ...x,
  ...(x.parents ? { parents: x.parents.map(ref) } : {}),
});

const out = {
  pods: raw.pods ?? raw.molecules ?? [],
  beans: (raw.beans ?? raw.atoms ?? []).map(mapParents),
  sprouts: (raw.sprouts ?? raw.versions ?? []).map((v) => ({
    ...mapParents(v),
    ...(v.relations ? { relations: v.relations.map((rel) => ({ ...rel, ref: ref(rel.ref) })) } : {}),
  })),
};

writeFileSync(join(process.cwd(), "data", "garden.yml"), yaml.dump(out, { lineWidth: 100 }), "utf8");
console.log(
  `garden.yml written: ${out.pods.length} pods, ${out.beans.length} beans, ${out.sprouts.length} sprouts`,
);
