# CLAUDE.md — working in the Ariko repo

Ariko is a personal "central node": a portfolio on a botanical content model
(`Pod → Bean → Sprout`, with inbox `Seed`s), Next.js 15 / React 19 / TypeScript / MongoDB.

Both zones run on the design system: Tailwind v4 + shadcn on **Base UI**
(`components.json`, preset `b3vqDobYF1` — style `base-nova`, neutral base /
green theme, large radius, lucide). Body face is Inclusive Sans, display face
Geist Mono, wired through `--font-inclusive-sans` / `--font-geist-mono` in
`app/globals.css`.

- Primitives live in `components/ui/`. Add more with
  `npx shadcn@latest add <name>` — never hand-roll one the registry already has.
- Chrome belongs to the zones, not the root layout: `app/(public)/layout.tsx`
  (site header) and `app/admin/layout.tsx` + `app/admin/_components/admin-bar.tsx`
  (tooling bar). The root layout owns only the document shell and the fonts.
- **The admin's *metadata* forms stay zero-client-JS**: they post to server
  actions and must work without script. Use the styled *native* controls in
  `components/ui/native-controls.tsx` (`NativeSelect`, `NativeRadio`,
  `NativeCheckbox`) rather than the Base UI Select/RadioGroup/Checkbox
  composites, which submit through a script-populated hidden input.
- **The prose editor is the first deliberate exception** (`components/editor/`,
  slice 5). The content forms on `/admin/sprout/[slug]`, `/admin/plant/[slug]`
  and `/admin/pod/[slug]` are client components and do not work without script.
  They still invoke the same server actions, and they are *separate forms* from
  the metadata ones on the same page — which is what keeps the exception
  contained.
- **The media picker is the second** (`components/admin/media-picker.tsx`, the
  media slice). It carries its own rule, which is what makes it an island
  rather than a slope:

  > The picker renders **nothing until it mounts**. Without script, the form
  > around it is byte-for-byte what it was, and **no capture or edit ever
  > depends on it**.

  So the capture bar still submits without script, and a submit is never
  blocked by an upload: an in-flight or failed image simply is not in the
  payload. Images upload through `uploadImageAction`, never from the browser to
  a third party, and a pasted link's `provider` is always derived server-side.

  Widening this to any *further* form is a decision, not a convenience.

Orientation lives in
[`README.md`](README.md); the sequenced plan lives in
[`docs/superpowers/ROADMAP.md`](docs/superpowers/ROADMAP.md).

## Lab Note requirement — read before opening a PR

Ariko is wired to several repos' CIs (`ariko`, `pbbls`, `femfolk`, `arkaik`,
`melogram`). **When you open a PR that ships something a user, visitor, or
listener would notice, you MUST include a Lab Note in the PR body.** Merging the
PR posts it to the Ariko inbox automatically — no copy-paste.

This section is the always-loaded summary and is **self-sufficient**: you can
author a valid note from it alone, with no plugin installed. The `lab-note`
skill (installable via `/plugin install lab-note@ariko`) is the source of truth
for full tone guidance and the per-repo pod table.

**The gate.** User/visitor/listener-facing change → write a note. Chore,
refactor, infra, or docs-only change → **no note** (leave the section out; if the
advisory reminder comments on your PR, add the **`no-lab-note`** label to silence
it).

**The contract.** One section whose heading **starts with** `## Lab Note`,
containing exactly one ` ```yaml ` fence. `en.title` and `en.summary` are
**required**; `fr.*` is recommended (a real adaptation, not a literal
translation, using the informal "Tu"); `suggested` is optional. Unknown
top-level keys are ignored. Skeleton:

```yaml
en:
  title: Short, benefit-first title             # required
  summary: One or two sentences, user-facing.   # required
fr:                                             # recommended — adaptation, informal "Tu"
  title: Titre court, orienté bénéfice
  summary: Une ou deux phrases, adaptées, pas traduites littéralement.
suggested:                                      # optional — prefills triage in the Ariko admin
  molecule: ariko        # THIS repo's pod slug (YAML key stays `molecule`)
  type: feature          # feature | improvement | fix | announcement
  tags: [changelog]
  # atom: <slug>         # ONLY when you know the slug exists — never guess
```

**Tone.** Lead with the benefit, not the mechanism; keep it short; warm and a
little playful, never corporate; no engineering jargon, ticket numbers, or
internal names.

**This repo's pod slug is `ariko`** (sent as `molecule:` in the YAML — the wire contract is unchanged). A malformed note fails the post-on-merge
job loudly (e.g. `en.title is required`); the advisory reminder surfaces the same
problems at PR-open time. Fix by editing the PR body — posting is idempotent.

Full pipeline docs: [`README.md` §Lab Note pipeline](README.md).
