---
Title: Digest — Architecture technique (code local + prototypes + GitHub)
Source: dossier Pebbles (lecture) + page publique GitHub alexisbohns/pbbls (lecture seule)
Note: aucune écriture/commit/clone. Le dossier local n'est PAS un repo git.
---

# Pebbles — Digest d'architecture technique

## 1. Vue d'ensemble de la stack
App « journal atomique » : on enregistre des moments sous forme de *pebbles* enrichis d'émotions, de personnes (*souls*), de domaines de vie et de cartes réflexives. Deux réalités dans le dossier :
- **Repo de production** (miroir de `alexisbohns/pbbls`) : `apps/`, `engine/`, `supabase/`, `scripts/`, `docs/`. TypeScript strict, spec-driven.
- **Atelier de prototypes** à la racine : ~12 `.jsx`/`.html`/`.svg` autonomes documentant la genèse.

| Couche | Choix |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| Web | Next.js (App Router), React, Tailwind, **shadcn/ui**, next-themes — **PWA local-first** |
| Stockage | localStorage (`LocalProvider`) + sync arrière-plan Supabase (`SupabaseProvider`) derrière `DataProvider` |
| Backend | **Supabase** (Postgres, RLS, Edge Functions Deno, pg_cron) |
| iOS | **App native SwiftUI** + Supabase Swift SDK |
| Moteur de rendu | **TypeScript pur partagé client + serveur** (`engine/`) |
| Déploiement web | Vercel (Root = `apps/web`) |

Langages du repo public : **TS 57,6 % · Swift 33,6 % · PLpgSQL 7,0 % · CSS 1,1 %**. La part de Swift confirme un chantier iOS natif réel et avancé.

## 2. Architecture : apps vs engine vs supabase
### `apps/`
Local : `apps/admin/src/lib/analytics/` (`fetchers.ts` + `types.ts`) = couche data d'un back-office analytics (une fonction async par graphique, server-side, lit les vues matérialisées via `@supabase/supabase-js`). Le README révèle `apps/web/` (PWA Next.js : routes `path/`=timeline, `record/`=création multi-étapes, `pebble/[id]/`, `collections/` au-dessus de `lib/data/`) et `apps/ios/` (SwiftUI).

### `engine/` — le moteur de rendu partagé (pièce maîtresse)
**TS pur, sans DOM, sans effets de bord**, tourne identiquement client (preview/carve) et serveur (Edge Function Deno). Génère du **SVG paramétrique monochrome** (pas de canvas). 4 fichiers (datés 2026-04-12) :
- **`types.ts`** — `PebbleSize` (small/medium/large), `PebbleValence` (**highlight/neutral/lowlight**), `Stroke` (path `d`), `GlyphArtwork`, contrats `PebbleEngineInput`/`Output` (SVG composé + `AnimationManifest`).
- **`glyph.ts`** — normalisation client : strokes bruts → bounding box → centrage/échelle (~80 % d'un canvas carré).
- **`layout.ts`** — config-driven : position du glyphe selon `(size, valence)`. 3 tailles de canvas (250×200 → 260×310), **matrice 3×3** de positions pré-calculées (spec Notion).
- **`compose.ts`** — compositor server-side appelé par les **RPC `create_pebble`/`update_pebble`**. Empile shape → fossil (opt., opacité 0.3) → glyph en un SVG ; force `currentColor` (monochrome) ; **manifeste d'animation** (reveal chronométré : glyph 0 ms, shape 600, fossil 1000, fill 1200, settle 1600).
→ rendu **paramétrique size × valence × glyphe**, monochrome, animé.

### `supabase/`
Local : migration **`20260430_analytics_mvs.sql`** (567 l.) = **12 vues matérialisées** (`mv_kpi_daily`, `mv_active_users_daily`, `mv_retention_cohorts_weekly`, `mv_pebble_volume_daily`, `mv_pebble_enrichment_daily`, `mv_user_averages_weekly`, `mv_bounce_distribution_daily`, `mv_emotion_share_weekly`, `mv_domain_share_weekly`, `mv_cairn_participation_weekly`, `mv_visibility_mix_daily`, `mv_quality_signals_daily`) + `refresh_analytics_mvs()` (security definer) via **pg_cron 03:00 UTC** + RLS admin-only. En-tête documente ~11 data models (`users`, `pebbles` avec `intensity`/`visibility`/`glyph_id`, `glyphs`, `souls`, `collections`, `emotions`, `domains`, `pebble_emotions`, `bounces`, `cairns`, `sessions`).
**Upsert via RPC** confirmé : `compose.ts` appelé par `create_pebble`/`update_pebble` ; règle d'or repo *« multi-table writes → RPC in migration (atomicité) ; single-row → client direct »*. Les RPC d'écriture vivent dans `packages/supabase` (non monté localement).

### `scripts/`
2 scripts `gh` CLI (2026-04-10) : `gh-create-roadmap.sh` (jalons **M14→M23**) + `gh-create-issues.sh` (**33 issues**). Tracent la migration : repo Next.js plat → Turborepo → Supabase → iOS SwiftUI → TestFlight V0/V1.

## 3. Inventaire des prototypes (racine)
| Fichier | mtime | But (lu) | Thème |
|---|---|---|---|
| `pebbles-design_direction.md` | 28 mars | Manifeste « Eroded Flat / Neo-primitive » (contours usés SVG, pastels géologiques, icônes pétroglyphes, motion gravitationnelle ; réfs Nuoro/Onmi) | Naming/Minéral |
| `emotion-pearl-shapers.jsx` (1141 l.) | 28 mars | Sélecteur « pearl » React : 10 émotions, axe positiveness −2…+2, blobs SVG organiques seedés | Visuel&Valence |
| `emotion-pearl-selector-mvp.jsx` (580 l.) | 28 mars | Version MVP du sélecteur (lerpHex) | Visuel&Valence |
| `pebble-shaper-explorations.jsx` (724 l.) | 29 mars | Forme du galet selon valence × intensité (Gentle/Moderate/Intense), ex. Stone Drop | Visuel&Valence |
| `pebbles-concept-sheet.html` | 29 mars | Planche-concept grille **9 variations** (Valence × Intensity) | Visuel&Valence |
| `pebble-shaping-prototype.html` (861 l.) | 30 mars | Proto interactif « Shape Your Pebble » : **touchpad 2D** intensity × valence temps réel | Path/RecordFlow |
| `pebbles-arkaik.json` | 1 avr. | Copie racine du bundle Arkaik | (transverse) |
| `pebbles-stack-success.svg` | 2 avr. | Animation 3 galets qui tombent/s'empilent (cairn complété/succès) | Gamification/Bounce |
| `pebble-renderer.jsx` (607 l.) | 5 avr. | Renderer React : 8 émotions, 12 glyphes, `getPebblePath(intensity, valence)` (facteur « sharp » pour négatif) | Composants · Visuel&Valence |
| `pebble-engine-workbench.jsx` (643 l.) | 12 avr. | **Banc d'essai du moteur** : `DEFAULT_LAYOUT` 3×3 extrait tel quel dans `engine/layout.ts` le même jour | Composants |
| `analytics-mockup.html` (884 l.) | 30 avr. | Maquette dashboard admin (POC avant migration `mv_*`) | Analytics |
| `bounce-explorations.html` (1343 l.) | 15 mai | Explorations « Bounce/Ripples » : **Path A** (faire évoluer les **28 slots**) vs **Path B** (remettre en cause les niveaux discrets) ; karma + cairn. Le plus récent | Gamification/Bounce |

## 4. Éléments datés pour la chronologie
- **Genèse visuelle (mtimes)** : rafale fin mars (design direction + sélecteurs 28 mars → formes + concept sheet 29 → touchpad 30 → Arkaik 1er avr. → renderer 5 → workbench 12) ; puis analytics (30 avr.) et bounce (15 mai).
- **Roadmap iOS** (`docs/roadmap-ios-native.md`, 10 avr.) — jalons `due_on` : M14 Monorepo 11 avr · M15 Supabase infra 13 · M16 Web SupabaseProvider 14 · M17 iOS bootstrap 15 · M18 Record flow 17 · M19 Timeline 18 · **M20 TestFlight V0 19** · M21 Souls & collections 23 · M22 Bounce/karma 26 · **M23 TestFlight V1 27**. (V2 bounce/karma = 3 mai.)
- **Audit de départ (10 avr.)** : repo « flat Next.js » (TS 94,7 %), **98 commits**, data 100 % localStorage, `DataProvider` déjà abstrait, seed (10 pebbles / 5 souls / 3 collections).
- **Changelog** (maj 22 avr.) : features iOS *shipped* jusqu'au 21 avr.
- **Analytics W18** (1 mai) : closed-beta, ~21 users depuis mi-fév., ~15–16 MAU, DAU/MAU 6,67 %, croissance ~2026-02-12.
- **Migration analytics** : `20260430_analytics_mvs.sql` (30 avr.), même jour que `analytics-mockup.html` + création `apps/admin/`.

## 5. GitHub `alexisbohns/pbbls` (page publique, lecture seule)
Le dossier local **n'est pas un repo git** (pas d'historique exploitable localement). `web_fetch` sur la page publique réussi :
- **227 commits** sur `main` (vs 98 le 10 avr. → ~129 ajoutés en ~7 semaines), **36 issues**, 2 PR ouvertes, public, `pbbls.vercel.app`, App ID Apple présent. Licence : *Private — not open source yet*.
- **Structure confirmée** : `apps/web` + `apps/ios`, `packages/shared` + `packages/supabase`, `turbo.json`, `.agents/skills`, `.claude`, `AGENTS.md`, `skills-lock.json`. Migration Turborepo (M14) faite.
- **Concepts produit (README)** : Pebble (intensity 1–3, positiveness −2…+2), Emotion (1/pebble en V1), Soul, **Domain Maslow rebaptisé grec** (Zoe/santé, Asphaleia/sécurité, Philia/relations, Time/reconnaissance, Eudaimonia/accomplissement), Card (free/feelings/thoughts/behaviour), **Collection** modes **Stack/Pack/Track**.
- **Engineering Paradigm** : spec-driven agentique, « ceremony scales with blast radius », Arkaik = source de vérité (« architecture is a graph, not a vibe »), atomicité via RPC, TS strict (no `any`), specs sous `docs/superpowers/`. Garde-fous : *« Never await Supabase inside onAuthStateChange (deadlock) »*, *« Migration → regen types → commit database.ts »*.

## 6. Arkaik
`docs/arkaik/pebbles-arkaik.json` = **ProjectBundle** : graphe **67 nodes / 108 edges** (29 views, 7 flows, 11 data-models, 20 api-endpoints), tout au statut **`idea`** (vision complète, pas l'état livré). Edges : composes (36), displays (26), queries (24), calls (22). Chaque node `web` + `ios` + `android`. Maintenu par la skill `.claude/skills/arkaik/` ; à mettre à jour à chaque changement d'archi.
