---
Title: Carte des sources — où est quoi, et pour quel article le miner
Statut: socle de travail (v1, 29 mai 2026)
---

# Carte des sources

Tout le matériau brut de Pebbles est éparpillé sur 4 plateformes. Cette carte dit
**ce que contient chaque source**, **où elle est**, et **quel(s) article(s) elle nourrit**.
À garder ouverte pendant l'écriture : c'est l'annuaire du grenier.

## Vue d'ensemble

| Source | Emplacement | Volume | Couvre surtout | Pour les articles |
|---|---|---|---|---|
| **Brouillon** | `docs/journal/draft.md` | ~24 Ko, lu | Récit + **voix de référence** | Récit accessible (base), Beck→galet, naming |
| **Dev-logs Apple Journal** | `docs/journal/AppleJournalEntries/Entries/` | **37 HTML**, ~28 000 mots, 24 mars→10 avr. | Journal de bord quotidien du concours | **Tous** (cœur narratif) |
| **Médias Apple Journal** | `…/AppleJournalEntries/Resources/` | 1490 fichiers (734 json, ~440 HEIC, vidéos, audio) | Photos/vidéos/audio liés aux entrées | Illustrations, captures d'époque |
| **Changelog** | `changelog.csv` | 47 features datées, **bilingue** | Ce qui a été livré, avec horodatage précis | Tous (timeline fine, citations FR/EN prêtes) |
| **Gemini** | `docs/journal/Gemini/conversations_gemini.md` | ~97 Ko, 1302 l. | **Naming/minéral** + décisions tech bootstrap + rendu d'images | Naming ⭐, Moteur de rendu, Web vs natif |
| **Notion (teamspace Pebbles)** | Notion (lecture via connecteur) | ~25+ pages indexées | Product docs, specs DLV, design DSG, recherche psy DSC, milestones | Récit exhaustif, data model, psycho, render, valence |
| **Prototypes** | racine du repo (`*.jsx`, `*.html`, `*.svg`) | 11 fichiers, 28 mars→15 mai | Genèse visuelle/interaction (datés par mtime) | Visuel&Valence ⭐, Path ⭐, Bounce, Analytics |
| **Code engine** | `engine/` (`types/glyph/layout/compose.ts`) | TS pur, 12 avr. | Moteur de rendu SVG paramétrique partagé | Moteur de rendu, SwiftUI/composants |
| **Supabase** | `supabase/` + Notion | 1 migration analytics locale + RPC (repo) | Schéma, RLS, RPC upsert, 12 vues analytics | Data model, tech/infra, analytics |
| **Roadmap & scripts** | `docs/roadmap-ios-native.md`, `scripts/gh-*.sh` | M14→M23, 33 issues | Stratégie de migration + jalons datés | Web vs natif, SwiftUI, méta-process |
| **Arkaik** | `docs/arkaik/pebbles-arkaik.json` (+ racine) | graphe 67 nodes / 108 edges | Carte d'architecture produit (vision) | Arkaik ⭐, data model, méthode agentique |
| **Analytics** | `analytics-reports/2026-W18-analytics.md` | 1 rapport (W18) | Closed-beta, MAU, rétention, stickiness | Data, récit (preuve de traction) |
| **GitHub** | `alexisbohns/pbbls` (lecture seule) | 227 commits, public | Réalité d'implémentation, README, paradigme | Tech, méthode agentique (⚠️ jamais modifier) |

---

## Détail par source

### `draft.md` — le brouillon (et la VOIX)
La référence n°1 pour **le style**. Couvre déjà : origines 2022 (dépression, TCC, colonnes de Beck), template Notion 2023, échec d'adoption, webapp nov. 2025, arrivée du concours Luni (Valentin), "mauvais réflexes" (anti-app, anti-portage, Descartes/Pascal, Design Attitude), bio ("Deux trois trucs à propos de moi"), TDAH.
→ **Base directe** du *récit accessible*. Le *guide de style* (`03-`) en est extrait.

### Les 37 dev-logs — le cœur narratif
Un log ≈ 700–1000 mots, daté, titré. Couvre 24 mars→10 avril en quasi-quotidien. Voir le **digest complet** dans `_digests/apple-journal.md` (à régénérer si besoin). Titres-clés par thème :
- **Visuel&Valence** : Emotion picker, Dark mode themes, Simpler emotion picker, Valence explorations, emotion pearl, Pebble design explorations with AI, Shapes.
- **Path/RecordFlow** : Record flow shell, Record cards, Single purpose record flow, Pebble engine, (Editor V2).
- **Naming/Minéral** : Design themes with Claude, Carving, Shapes (transverse avec Gemini).
- **Gamification/Bounce** : Gamification erzatz, Explained gamification, Duolingo vs Babel.
- **Native-vs-Web** : First Version, Feeling native on mobile, PWA, Pebble engine.
- **DataModel/Souls** : Souls and domains, Glyphs souls and collections, Accounts.
- **Arkaik** : Arkaik.
- **Backstory/Pivot** : Prologue, Duolingo vs Babel, Flush Start.
- **Legal/Infra** : Accounts, Legal foundations, Feeling native.
- **Process/Meta** : Days 1+2+3, Wasted Sunday, Quality Review of Shadcn.

### Changelog (`changelog.csv`)
47 lignes `species, platform, status, title_en, title_fr, summary_en, summary_fr, published_at`. Plateformes : `webapp` (27 mars→12 avr.), `project`/`infra`, puis `ios` (12→21 avr.). **Atout** : résumés bilingues déjà rédigés (utilisables comme légendes/encadrés) + horodatage à la seconde pour la timeline.

### Gemini (`conversations_gemini.md`)
Daté 21–26 fév. 2026. Deux gisements :
1. **Naming/minéral** (le plus riche du corpus pour cet article) : familles de termes (grain→monolithe), arbitrages (cairn vs pile/heap, dolmen funéraire+Astérix, menhir trop breton), et la **saga "ricochet → run/chain/roll → skipper/skimmer → bounce"**. Gemini recommandait *Skimmer*/*Skip* ; l'app a finalement tranché **Bounce** (cf. changelog) → bel angle "j'ai outrepassé l'IA".
2. **Tech** : comparatif bootstrap (FlutterFlow/Expo/Bubble/Replit/Emergent, lock-in Bubble) + **génération d'images façon Duolingo** (View-to-Bitmap, Canvas/Skia, SVG, "design system assemblé comme des LEGO") → matrice directe pour le moteur de rendu.

### Notion — teamspace Pebbles (lecture via connecteur)
Conventions de préfixes repérées :
- **Product** : `Pebbles Home`, `Pebbles V2 · Product Doc` (⭐ modèle atomique d'avant-pivot, 7 mars).
- **DLV ·** (delivery/specs) : New Pebbles Editor, Create a Pebble, Pebble details, Edit a Pebble on iOS, iOS path view, Valence Picker, Remote Pebble Engine — Slice 1.
- **DSG ·** (design) : Pebble Engine V3.
- **DBT ·** (decision/debate) : Luni Submission.
- **DSC ·** (discovery/recherche) : Self-Determination Theory, Apple Health emotions (HealthKit), Global Mind Health Report.
- **M15/M17/M21 ·** (milestones) : Supabase infrastructure, iOS bootstrap, Souls & collections.
- **Recherche/psycho** : Pyramid of Elements of Value (Bain), Meaningful & rewarding levelling systems (paradoxe du streak / Headspace), Monthly & yearly wraps, Social proof & sharing, Badges & achievements.
- **Doc** : Documentation · Entities & Relations (data model, ER mermaid).
- **Prompts/expé** : `Pbbls · Pebbles on Nano Banana`, `Pbbls · Pebble's engine`.

> 📌 Le connecteur Notion s'authentifie côté session principale. Pour briefer un subagent, **je récupère le contenu des pages utiles et je le colle dans le prompt** (les subagents n'ont pas l'auth Notion).

### Prototypes (racine) — la genèse visuelle/interaction
| Fichier | Date | Pour |
|---|---|---|
| `pebbles-design_direction.md` | 28 mars | Naming/visuel (manifeste neo-primitive) |
| `emotion-pearl-shapers.jsx` | 28 mars | Visuel&Valence |
| `emotion-pearl-selector-mvp.jsx` | 28 mars | Visuel&Valence |
| `pebble-shaper-explorations.jsx` | 29 mars | Visuel&Valence |
| `pebbles-concept-sheet.html` | 29 mars | Visuel&Valence (grille 9 variations) |
| `pebble-shaping-prototype.html` | 30 mars | Path/RecordFlow (touchpad intensité×valence) |
| `pebbles-stack-success.svg` | 2 avr. | Gamification/Bounce (cairn complété) |
| `pebble-renderer.jsx` | 5 avr. | Visuel&Valence / composants |
| `pebble-engine-workbench.jsx` | 12 avr. | Moteur de rendu (banc d'essai) |
| `analytics-mockup.html` | 30 avr. | Analytics |
| `bounce-explorations.html` | 15 mai | Gamification/Bounce (Path A vs B) |

### `engine/` — le moteur de rendu partagé
TS pur sans DOM, tourne **client + serveur (Edge Function Deno)**. `types.ts` (PebbleSize, PebbleValence highlight/neutral/lowlight, Stroke, contrats I/O) · `glyph.ts` (normalisation des strokes) · `layout.ts` (matrice 3×3 positions selon size×valence) · `compose.ts` (compositor appelé par RPC `create_pebble`/`update_pebble`, SVG monochrome `currentColor`, **manifeste d'animation** reveal chronométré). → article Moteur de rendu + SwiftUI/composants.

### Supabase / data model
Local : 1 migration `20260430_analytics_mvs.sql` (12 vues matérialisées + pg_cron + RLS admin). Le reste du schéma + RPC d'écriture vit dans le repo (`packages/supabase`) et dans Notion (`Pebbles V2 · Product Doc`, `Entities & Relations`). Règle d'or repo : *écritures multi-tables → RPC dans une migration (atomicité)* ; *une seule ligne → client direct*.

### Arkaik (`docs/arkaik/pebbles-arkaik.json`)
ProjectBundle = **67 nodes / 108 edges** (29 views, 7 flows, 11 data-models, 20 endpoints), tout au statut `idea` (= vision complète, pas l'état livré). Maintenu par la skill `.claude/skills/arkaik/`. À mettre à jour à chaque changement d'archi (cf. `CLAUDE.md`).

### Analytics (`analytics-reports/2026-W18-analytics.md`)
Closed-beta : ~21 users depuis mi-fév., ~15–16 MAU, DAU/MAU 6,67 %. Reco produit : shipper les Cairns. → preuve de traction pour le récit + matière pour un article "data".

### GitHub `alexisbohns/pbbls` (LECTURE SEULE — jamais modifier)
227 commits, public, `pbbls.vercel.app`, App ID Apple. README détaille concepts (Pebble intensity 1–3 / positiveness −2…+2, Domain Maslow rebaptisé grec : **Zoe** santé, **Asphaleia** sécurité, **Philia** relations, **Time** reconnaissance, **Eudaimonia** accomplissement ; Collection modes **Stack/Pack/Track**) + paradigme "spec-driven agentique, ceremony scales with blast radius, Arkaik = source de vérité".

---

## Trous & angles morts (à compléter par toi ou par fetch ciblé)

- **Audio/vidéo des Resources Apple Journal** : non transcrits (20 m4a, ~58 mov/mp4). Possible mine de citations parlées si tu veux que je les transcrive.
- **Historique git détaillé** : le dossier local n'est pas un repo git → pas de `git log` exploitable. Si tu m'autorises un accès lecture au repo (ou un export `git log`), on date chaque commit.
- **Pages Notion non encore lues en détail** : seules `Product Doc V2` et l'index ont été ouvertes ici. Les specs DLV/DSG et la recherche DSC seront fetchées au moment d'écrire l'article concerné.
- **Period mai** : peu de logs après le 10 avril (le journal de bord s'arrête) → la phase 5 s'appuie surtout sur prototypes + Notion + analytics. À étoffer si tu as d'autres notes.
