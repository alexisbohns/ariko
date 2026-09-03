---
Title: Backlog éditorial — les articles, leurs angles, leurs sources, et les briefs subagents
Statut: socle de travail (v1, 29 mai 2026)
---

# Backlog éditorial

Tout ce qu'on peut tirer du corpus, classé et prêt à écrire. Trois familles :
**(A)** les deux récits complets, **(B)** les articles thématiques, **(C)** les briefs
prêts-à-lancer pour l'armée de subagents (3 thèmes prioritaires).

Statuts : `📝 amorcé` · `🔜 prêt à lancer` · `🧊 backlog` · `💡 idée`

---

## A. Les deux récits complets

### A1 · Le récit accessible — "La généalogie de Pebbles" `📝 amorcé`
**Pour qui** : tout le monde, y compris "Maman et Tata". Captivant, vulgarisé.
**Promesse** : montrer qu'un produit est un truc **itératif** — comment Pebbles n'est pas *née* app de souvenirs, elle l'est *devenue*.
**Base** : c'est l'extension directe de `draft.md` (déjà ~24 Ko écrits, structure "Bande annonce" + version longue).
**Beats restants à écrire** (le draft s'arrête à l'arrivée du concours) :
- La semaine du pivot (25 mars) : Duolingo vs Babel, "never talk about therapy", les 3 piliers.
- La naissance du visuel minéral (fin mars).
- La gamification éthique (Bounce, pas de streak).
- "Wasted Sunday" et la simplification ("an app, not a SaaS").
- Le grand saut natif SwiftUI (12 avril).
- TestFlight, la closed-beta, où on en est aujourd'hui.
**Longueur** : 4 000–6 000 mots (ou feuilleton en 2–3 parties).
**Sources** : `draft.md` (voix) + digest Apple Journal + changelog (charnières) + analytics (traction).

### A2 · Le récit exhaustif — "Pebbles, version archéologue-au-pinceau" `🧊 backlog`
**Pour qui** : pairs (product/design/tech), recruteurs exigeants, toi dans 10 ans.
**Promesse** : **tout** — réflexions, introspections, décisions, itérations, échecs — sans gêne technique (psycho, design, outils, tech). Le document qui prouve la polyvalence.
**Forme** : probablement un **hub** qui agrège/relie tous les articles thématiques (B) + des chapitres introspectifs inédits (la dépression et le rapport à l'outil, le TDAH comme moteur/frein, le rapport à l'IA agentique, le rapport à la légitimité).
**Longueur** : massive → à éclater en chapitres (= les articles thématiques) + un fil conducteur.
**Sources** : **toutes**. C'est la somme.

---

## B. Articles thématiques

### ⭐ B1 · Le visuel du pebble : de la perle d'émotion à la valence `🔜 prêt à lancer`
**Angle** : comment un souvenir est devenu une **forme**. L'odyssée du shaper : emotion picker → "emotion pearl" → système intensité × valence (Barrett) → 9 formes dessinées à la main → abandon des pearls → couleur dans le fill → moteur de rendu partagé.
**Beats** :
1. Le problème : pondérer une émotion, c'est chiant et abstrait. Le "game aspect" comme réponse.
2. Les 6 concepts ratés-mais-féconds (Breathing Pearl, Erosion Shaper, Sediment Press, Ripple Pool…).
3. Barrett & le circumplex : intensité (taille/angles) × valence (couleur/texture), "s'approprier le schéma sans le comprendre intellectuellement".
4. Nano Banana Pro + Claude + l'amie ex-brand manager ; les "cookies festonnés".
5. La bascule : "I've still not found the nugget" → les 9 canvas faits **à la main**, adieu Emotion Pearls, la couleur passe dans le SVG.
6. L'industrialisation : `engine/` (SVG paramétrique, monochrome `currentColor`, manifeste d'animation).
**Sources** : logs (28–30 mars, 8–9 avr.) ; protos `emotion-pearl-*.jsx`, `pebble-shaper-explorations.jsx`, `pebbles-concept-sheet.html`, `pebble-renderer.jsx`, `pebble-engine-workbench.jsx` ; `engine/` ; `pebbles-design_direction.md` ; Gemini (rendu Duolingo, matter/material) ; changelog (Emotion Pearl Visualizer, Pebble Visual Engine, Emotion-Colored Artwork, Valence Picker) ; Notion (`DSG · Pebble Engine V3`, `Pbbls · Pebbles on Nano Banana`, `Pbbls · Pebble's engine`).
**Longueur** : 2 500–3 500 mots. **Tag** : Visuel&Valence.

### ⭐ B2 · Le Path : l'évolution du flux de capture `🔜 prêt à lancer`
**Angle** : comment enregistrer un souvenir est passé d'un **formulaire de 15 étapes** à un geste de quelques secondes. La quête du "single responsibility" sans tuer la fluidité.
**Beats** :
1. L'héritage : la webapp de Beck à 15 étapes, "royalement chiant".
2. Le record flow shell → étapes mono-objectif (29 mars) : "no longer a form but a real flow".
3. Le piège de la complexité : guidance riche mais lourdeur ; "less affordable".
4. "Wasted Sunday" et la leçon de découpe (itératif full-stack, pas linéaire).
5. La bascule : "Pebbles is an app, not a SaaS" → suppression de la sidebar, **Quick Pebble editor** compact, auto-focus intelligent (< 5 pebbles).
6. Le Path comme objet : timeline, carte flottante, sheet → centred peek, artwork dans le chemin.
**Sources** : logs (Record flow shell, Record cards, Single purpose record flow, Pebble engine, Editor V2) ; proto `pebble-shaping-prototype.html` ; changelog (Multi-Step Record Flow, Quick Pebble Editor, Pebble Revelation, Intensity-Scaled Cards, Pebble Artwork in Path) ; Notion (`DLV · Create a Pebble`, `DLV · New Pebbles Editor`, `DLV · iOS path view`).
**Longueur** : 2 000–3 000 mots. **Tag** : Path/RecordFlow.

### ⭐ B3 · Le nom : pebbles, cairns, et la saga du "bounce" `🔜 prêt à lancer`
**Angle** : nommer, c'est concevoir. L'exploration de tout un **univers minéral** comme architecture mentale du produit — et le moment où tu as **outrepassé la reco de l'IA**.
**Beats** :
1. Pourquoi le minéral ? "Pebbles = galets, en gaulois" ; le galet usé par l'eau = le souvenir adouci par le temps.
2. La gradation sémantique (speck → nugget → … → monolith) comme échelle de prestige/grades.
3. Les arbitrages de rejet : **cairn** (intentionnel, repère, mémoriel) vs *pile* (utilitaire) vs *heap* (décombres) ; *dolmen* (funéraire + Astérix), *menhir* (trop breton/savant).
4. La saga du streak → "ricochet" : le faux-ami (skip/skim/ricochet), les candidats (Run, Chain, Roll, Skipper, Skimmer), la reco de Gemini (**Skimmer/Skip**)…
5. …et ton choix final : **Bounce** (que Gemini déconseillait : "action, pas objet"). Pourquoi tu as tranché autrement. Le "bounce karma" comme anti-streak.
6. Le naming comme garde-fou produit (ne jamais dire "thérapie", "souls" plutôt qu'"users", "âmes qui comptent").
**Sources** : Gemini (section naming, exhaustive) ; `draft.md` ; project description (Cairn marathon, bounce karma) ; changelog (Karma & Bounce System) ; GitHub README (Collection modes Stack/Pack/Track, domaines grecs).
**Longueur** : 2 000–2 800 mots. **Tag** : Naming/Minéral.

### B4 · Des colonnes de Beck au galet : l'anatomie d'un pivot `🧊 backlog`
**Angle** : le déplacement fondateur — d'un **outil cognitif/TCC** vers une **app de souvenirs**. Comment on garde l'âme d'un outil en changeant tout le reste.
**Beats** : Beck en thérapie → template Notion → webapp à 15 étapes → "Duolingo vs Babel" → "never talk about therapy" (et la raison **légale**) → ce qui reste des colonnes aujourd'hui (les "cards", invisibles mais présentes). Le modèle atomique Questions/Réponses du Product Doc V2 comme trace de l'ADN TCC.
**Sources** : `draft.md`, Notion `Pebbles V2 · Product Doc`, logs (Prologue, Duolingo vs Babel, Flush Start, Record cards).
**Longueur** : 2 000–3 000 mots. **Tag** : Backstory/Pivot.

### B5 · Gamifier sans asservir : Counter, Bounce, Karma `🧊 backlog`
**Angle** : utiliser les leviers du jeu **contre** les dark patterns. Pourquoi pas de streak, et ce que "bounce" répare.
**Beats** : la critique des streaks punitifs (paradoxe Headspace) → Counter/Bounce (28 j glissants)/Karma → Self-Determination Theory → les Cairns (wraps) comme récompense qui a du **sens** → les explorations en cours (Path A vs B du `bounce-explorations.html`).
**Sources** : logs (Gamification erzatz/explained, Duolingo vs Babel) ; `bounce-explorations.html` ; Gemini (streak/ricochet) ; Notion (`Meaningful & rewarding levelling systems`, `Badges & achievements`, `Monthly & yearly wraps`, `Self-Determination Theory`, `Bain Elements of Value`) ; changelog (Karma & Bounce).
**Longueur** : 2 000–3 000 mots. **Tag** : Gamification/Bounce.

### B6 · SwiftUI-first : du natif "fonctionnel" aux composants maison brandés `🧊 backlog`
**Angle** : l'implémentation progressive — d'abord des composants natifs/shadcn pour faire marcher le truc, puis la refonte avec des composants maison brandés. Ce que tu as appris en passant du web au natif.
**Beats** : webapp Next + shadcn (hygiène, dédup, "Quality Review of Shadcn") → le fossé web/natif ("Feeling native") → **le pivot SwiftUI (12 avr.)** → reconstruction des composants (Color System, Valence Picker Sheet, Glyph Carving plein écran, Visual Polish) → le moteur de rendu partagé comme pont iOS/web.
**Sources** : logs (Quality Review of Shadcn, Design themes, Feeling native, Pebble engine) ; changelog (Native iOS App, Color System, Valence Picker, Visual Polish, Glyph Carving) ; tech digest (Swift 33 %, `engine/` fallback render) ; Notion (`M17 · iOS project bootstrap`, `DLV · iOS path view`, `DLV · Edit a Pebble on iOS`).
**Longueur** : 2 500–3 500 mots. **Tag** : SwiftUI/Composants.

### B7 · Web vs natif : la PWA, puis le grand saut `🧊 backlog`
**Angle** : pourquoi "responsive" ne suffit jamais, et ce que coûte/rapporte de tout réécrire en natif.
**Beats** : les limites du web mobile (nov. 2025) → la PWA (service worker, offline, safe-areas, haptique "only on Android") → le constat → la décision de basculer SwiftUI → local-first + Supabase sync.
**Sources** : logs (First Version, Feeling native, PWA, Pebble engine) ; changelog (PWA, Native iOS App, Local-First) ; `draft.md` (limites webapp).
**Longueur** : 1 800–2 500 mots. **Tag** : Native-vs-Web.

### B8 · Arkaik : cartographier le produit comme un graphe `🧊 backlog`
**Angle** : l'outil maison qui tient la carte du produit à jour automatiquement. "Architecture is a graph, not a vibe."
**Beats** : le besoin (naviguer produit/feature/opérationnel sans maintenance manuelle) → la skill Arkaik → le ProjectBundle (67 nodes / 108 edges, statut `idea` = vision) → l'intégration au workflow agentique (mise à jour à chaque changement d'archi).
**Sources** : log (Arkaik) ; `pebbles-arkaik.json` ; `CLAUDE.md` ; `.claude/skills/arkaik/` ; tech digest.
**Longueur** : 1 500–2 200 mots. **Tag** : Arkaik/Architecture.

### B9 · Le moteur de rendu partagé : un SVG, deux plateformes `🧊 backlog`
**Angle** : un seul moteur TS qui génère le galet, identique côté client (preview) et serveur (Edge Function). Le "design system assemblé comme des LEGO" de Duolingo, appliqué à un souvenir.
**Beats** : le besoin (même ADN visuel iOS/web) → l'inspiration Duolingo (View-to-Bitmap, Canvas, SVG) → l'archi `engine/` (types, glyph normalization, layout 3×3, compose) → appel via RPC `create/update_pebble` → manifeste d'animation (reveal chronométré).
**Sources** : `engine/` (tech digest) ; Gemini (rendu Duolingo) ; Notion (`DLV · Remote Pebble Engine — Slice 1`, `DSG · Pebble Engine V3`) ; changelog (Remote Pebble Render Engine).
**Longueur** : 2 000–3 000 mots (public tech). **Tag** : Moteur/Composants.

### B10 · Le data model atomique : Questions, Events, Moods `🧊 backlog`
**Angle** : la modélisation comme acte de design. Pourquoi tout atomiser (anti page-blanche + analyses verticale/horizontale + futur LLM).
**Beats** : Questions/Réponses (la plus petite abstraction autonome) → Angles (expectations/observations) → Events (conteneur semi-agnostique) → Moods alignés HealthKit (valence −3→+3, 38 émotions, 18 associations) → Templates & Modes (simple/intermédiaire/avancé) → Auteurs (le thérapeute contribue) → RPC upsert + RLS.
**Sources** : Notion (`Pebbles V2 · Product Doc`, `Documentation · Entities & Relations`, `Apple Health emotions HealthKit`) ; `supabase/` ; logs (Souls and domains) ; GitHub README (domaines Maslow grecs).
**Longueur** : 2 500–3 500 mots (public tech). **Tag** : DataModel/Souls.

### B11 · Construire avec une armée d'agents (méta) `💡 idée`
**Angle** : comment un solo builder design+code un produit natif en un mois avec des agents IA — sans renoncer au goût ni au jugement. Le paradigme "spec-driven, ceremony scales with blast radius".
**Beats** : les agents Notion (researcher/architect/engineer) → Claude Cowork + plug-in Design (Notion/Figma/GitHub) → Cursor/Codex → Arkaik comme source de vérité → les garde-fous ("never await Supabase inside onAuthStateChange") → la limite ("0 % de cet article écrit par une IA", le plaisir gardé).
**Sources** : logs (Days 1+2+3, Design themes, Arkaik, Quality Review) ; tech digest (engineering paradigm) ; `draft.md` (note IA).
**Longueur** : 2 000–3 000 mots. **Tag** : Process/Meta.

### B12 · La psycho derrière Pebbles `💡 idée`
**Angle** : la couche savante, vulgarisée — qui sont Beck, Kahneman, Barrett, Maslow, Clear, Lembke, et ce que chacun a infusé dans le produit.
**Beats** : Beck (restructuration cognitive → cards) ; Barrett (circumplex → valence) ; Maslow revisité (domaines grecs) ; Kahneman (biais → design des choix) ; Clear (habitudes atomiques → atomisation) ; Lembke (dopamine → anti-dark-patterns) ; Self-Determination Theory (autonomie/compétence/lien).
**Sources** : Notion (toutes les `DSC ·`) ; `draft.md` ; `Product Doc V2`.
**Longueur** : 2 500–3 500 mots. **Tag** : Psycho.

---

## C. Briefs prêts-à-lancer (3 thèmes prioritaires)

> Mode d'emploi : à ton "go", je lance ces 3 subagents **en parallèle**. Chacun lit les sources +
> le guide de style + son digest, fetch les pages Notion utiles (que je colle au lancement, car
> les subagents n'ont pas l'auth Notion), et rend un **brouillon en français dans ta voix**, sauvegardé
> dans `docs/journal/atelier-editorial/brouillons/`. Les trous sont marqués `[À COMPLÉTER : …]`.
> Une étape de relecture-cohérence-de-voix suit (par moi ou un 4e subagent).

### Brief — B1 · Visuel & valence (subagent "Pearl")
- **Lire** : `_digests/apple-journal.md` (entrées 28–30 mars, 8–9 avr.), `_digests/gemini.md` (§ rendu Duolingo + matter/material), `_digests/tech-stack.md` (§ engine + protos Visuel&Valence), `pebbles-design_direction.md`, et survoler les protos `emotion-pearl-shapers.jsx` / `pebble-renderer.jsx` / `pebble-engine-workbench.jsx`. Notion (collé au lancement) : `DSG · Pebble Engine V3`, `Pbbls · Pebbles on Nano Banana`.
- **Écrire** : article B1, plan en 6 beats ci-dessus, 2 500–3 500 mots, voix `03-guide-de-style.md`.
- **Soigner** : la tension "lisible vs ludique" ("What's easy to understand is not playful…"), la citation "I've still not found the nugget", le mapping Barrett rendu sensible (pas intello).

### Brief — B2 · Le Path (subagent "Flow")
- **Lire** : `_digests/apple-journal.md` (Record flow shell/cards, Single purpose record flow, Pebble engine, Editor V2, Wasted Sunday), `pebble-shaping-prototype.html`. Notion (collé) : `DLV · Create a Pebble`, `DLV · New Pebbles Editor`, `DLV · iOS path view`. Changelog (lignes record flow).
- **Écrire** : article B2, 6 beats, 2 000–3 000 mots, voix.
- **Soigner** : la courbe 15 étapes → quelques secondes, "Pebbles is an app, not a SaaS", l'arbitrage pédagogie vs efficacité ("less affordable").

### Brief — B3 · Le naming (subagent "Cairn")
- **Lire** : `_digests/gemini.md` (TOUT le §1 naming), `draft.md` (intro + métaphores minérales), project description (Cairn marathon, bounce). Changelog (Karma & Bounce). GitHub README (domaines grecs, Collection modes).
- **Écrire** : article B3, 6 beats, 2 000–2 800 mots, voix.
- **Soigner** : le récit "j'ai outrepassé l'IA" (Gemini → Skimmer/Skip ; toi → Bounce), les arbitrages de rejet argumentés (pile/heap/dolmen/menhir), le naming comme garde-fou produit. Garder le ton joueur de la saga.

---

## Ordre de bataille proposé
1. **Lancer B1 + B2 + B3** en parallèle (3 subagents) → 3 brouillons.
2. **Relecture-voix** (cohérence avec `draft.md`) + vérif faits/dates.
3. Tu lis, tu annotes, on itère.
4. Vague 2 au choix : B4 (pivot), B5 (gamification), B6 (SwiftUI). Puis B9/B10 (tech deep) et B11/B12 (méta/psycho).
5. En parallèle, étoffer **A1** (récit accessible) en réutilisant les brouillons comme chapitres.
