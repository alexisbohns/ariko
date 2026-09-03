---
Title: Chronologie maîtresse — la généalogie de Pebbles
Statut: socle de travail (v1, 29 mai 2026)
---

# Chronologie maîtresse

La timeline complète de Pebbles, de la dépression de 2022 à aujourd'hui (mai 2026),
fusionnée à partir de **toutes** les sources retrouvées. Chaque entrée porte sa source
entre crochets pour qu'on puisse remonter au matériau brut au moment d'écrire.

C'est le **squelette daté** des articles : on y pioche les faits, les dates et les citations.
Ce n'est pas un texte à publier, c'est la carte des os.

## Légende des sources

- `[DRAFT]` — `docs/journal/draft.md` (ton récit en cours)
- `[LOG +date]` — un des 37 dev-logs Apple Journal (`AppleJournalEntries/Entries/`)
- `[CHANGELOG]` — `changelog.csv` (47 features datées, bilingues)
- `[GEMINI]` — `docs/journal/Gemini/conversations_gemini.md`
- `[NOTION: titre]` — page du teamspace Pebbles
- `[PROTO]` — fichier prototype à la racine (date = mtime)
- `[ENGINE] / [SUPABASE] / [ROADMAP]` — code & specs
- `[GITHUB]` — repo `alexisbohns/pbbls` (lecture seule)
- `[ANALYTICS]` — `analytics-reports/2026-W18-analytics.md`

> ⚠️ Quelques dates se contredisent légèrement selon la source (nom de fichier vs corps de texte,
> "live since Tuesday", croissance "mi-février"). Elles sont listées en fin de doc, section
> **« À vérifier »**. À trancher par toi avant publication.

---

## Phase 0 — Les racines (2022 → 2024)

- **2022** — La plus grosse dépression. Le psychiatre oriente vers une psychologue spécialisée en TCC. Découverte des **colonnes de Beck**, "game changer". `[DRAFT]`
- **2022–2023** — Apprentissage progressif de l'exercice : d'abord lamentable (15 plombes par situation, tout mélangé), puis montée en finesse émotionnelle ; le levier de l'expression écrite et compartimentée. `[DRAFT]`
- **2023** — Sortie de dépression + **diagnostic TDAH** (établi par 4 spécialistes). `[DRAFT]`
- **2023** — Premier **template Notion** des colonnes de Beck (base de données), "plus pour le kiff" + pratique pour que la psy le parcoure avant séance. Partagé à plusieurs personnes → **échec d'adoption** (le pitch hype, mais personne ne s'en sert). `[DRAFT]`
- **2023** — Rejoint **teale** (santé mentale en entreprise) comme "product". Le job à temps plein dans la santé mentale écarte l'idée d'en faire une app. `[DRAFT]`
- **2024** — Notion sort les **formulaires** → intégration immédiate d'un formulaire guidé, saisie mobile depuis n'importe où. `[DRAFT]`

---

## Phase 1 — Premières tentatives digitales (automne 2025)

- **Automne 2025 (oct.)** — Les agents IA font des progrès "vertigineux". Alexis s'essaie au **code agentique** sur plusieurs projets perso, "non sans succès". L'idée de Pebbles re-germe. `[DRAFT]`
- **Automne 2025** — Première vraie tentative d'app : **vibe-coding avec Codex (OpenAI) sur SvelteKit + Supabase**. `[LOG 25 mars · First Version]`
- **Novembre 2025** — Aboutit plus loin que jamais : webapp où l'on crée un compte et tient un journal d'analyse de situations à la Beck, registre d'émotions/domaines calqué sur Apple Health. **Mais constat d'échec UX** : interactivité noyée par la complexité (un tableau de 6 colonnes devenu un parcours de 15 étapes), "royalement chiant", médiocre sur mobile malgré le responsive. Abandon. `[DRAFT]`
- **Deux erreurs reconnues a posteriori** : (1) implémenter client + modèle en même temps alors que le modèle n'était pas figé ; (2) choisir une **techno de niche** (Svelte) alors que les modèles d'IA sont sur-entraînés sur React/Next. `[LOG 25 mars · First Version]`

---

## Phase 2 — Juste avant le concours (févr. → 23 mars 2026)

- **~12 février 2026** — Début de croissance d'une **closed beta** (la webapp ?) : ~21 utilisateurs depuis la mi-février, croissance datée ~2026-02-12. `[ANALYTICS]` ⚠️ *(à recouper avec le démarrage du concours)*
- **Février 2026** — Valentin (ingénieur dev iOS chez teale, ami) parle du **concours d'apps mobiles de Luni**. Le format "1 mois intensif, juste ce qu'il faut de cadre, beaucoup d'autonomie" = idéal pour un "zèbre". Motivation, candidature. `[DRAFT]`
- **21–26 février 2026** — Série de **conversations avec Gemini** : structuration projet, options de bootstrap mobile (FlutterFlow/Expo/Bubble/Replit/Emergent), génération d'images façon Duolingo (→ futur pebble engine), et **recherche naming** très étendue (pebble, cairn, dolmen, menhir, monolith, nugget ; saga "ricochet → skip → bounce"). `[GEMINI]`
- **7 mars 2026** — Notion **"Pebbles V2 · Product Doc"** : le modèle de données **atomique** d'avant-pivot (Questions/Réponses, Events comme conteneurs semi-agnostiques, Moods alignés Apple HealthKit avec valence −3→+3 / 38 émotions / 18 associations, Templates & Modes simple/intermédiaire/avancé, Auteurs dont le thérapeute, feature Décisions + swipe-system, analyse verticale/horizontale). Manifeste "OpenSource, inspiré TCC + Kahneman + James Clear", Supabase Paris, LLM Gemma anonymisé. `[NOTION: Pebbles V2 · Product Doc]`

---

## Phase 3 — Le concours Luni : la webapp (24 mars → 11 avril 2026)

> Période couverte jour par jour par les **37 dev-logs** + le `changelog`. C'est le cœur narratif.

### Semaine 1 — cadrage & pivot (24–30 mars)

- **24 mars · Prologue** — Acte de naissance : les colonnes de Beck portées sur Notion (table = lecture, formulaire = écriture) ; **le manque fondateur** : "nudges, rewards, progression maybe?". `[LOG 24 mars]`
- **25 mars** — Journée(s) dense(s), 4 logs :
  - *Days 1+2+3* : mise en place d'**agents Notion** (product intelligence researcher, data architect, product engineer) ; cadence "fail fast, learn fast". `[LOG]`
  - *First Version* : rétro de l'échec SvelteKit/Codex (automne 2025) ; méthode **"First simple, then powerful"** (Linear) en 3 paliers : "ShameVP" (fonctionnel, no CSS) → POC UX → UI V1. `[LOG]`
  - *Duolingo vs Babel* : **LE pivot** — abandon de l'approche clinique, "**never talk about therapy**" (plus simple légalement) ; les gens veulent le résultat (parler), pas le processus pénible (apprendre). `[LOG]`
  - *Flush Start* : 3 piliers de positionnement — récompenses rapides ET durables (**Duolingo**), partage de meilleure qualité (**Polarsteps**), plaisir de collectionner (**Pokémon TCG**). `[LOG]`
  - *End of the week* : 4 chantiers sur une app **Next.js** locale ; la **navigation dans l'historique** désignée comme le plus gros défi ("ni liste, ni thread, ni stories"). `[LOG]`
- **26 mars** — Bootstrap du core flow : nouveau repo **Next + Turbopack** (boilerplate Vercel) ; milestone de **13 issues** spécifiées. `[LOG]`
- **27 mars** — Grosse journée (6 logs) :
  - Reste 6/13 issues ; setup **Claude Max styleguide + skills**, sandbox shell. `[LOG]`
  - *Anything experimentation* : test des "go-tos" par défaut d'une IA sans contrainte UI (calendrier horizontal, FAB redondant, serif). `[LOG]`
  - *Design themes with Claude* : naissance du langage **"neo-primitive"** (plat + animation-ready mais jamais géométriquement parfait, pétroglyphes) ; réfs **Nuoro (Samu Gambin)** et identité Claude ; installe le **plug-in Design d'Anthropic** branché Notion/Figma/GitHub. `[LOG]`
  - *Souls and domains* : pickers **souls (personnes)** et **domains (Maslow revisité)**. `[LOG]`
  - *Record flow shell* : squelette du record flow + 1res versions des pickers valence/size/émotion. `[LOG]`
  - *Record cards* : cartes typées (feeling, thought…), chacune = une **question héritée de Beck**. `[LOG]`
  - *Update* : vue détail d'un pebble (light + dark). `[LOG]`
  - **22:00** — `[CHANGELOG]` *Path, Collections & Pebble Detail* : "the core app is alive".
- **28 mars** — 3 logs + 2 features :
  - *Emotion picker* : **Projet Claude (Cowork)** avec Design Manifest ; 6 concepts d'artifacts buggés mais stimulants (**Breathing Pearl, Erosion Shaper, Stacking Rings, Gravity Pearl, Sediment Press, Ripple Pool**). `[LOG]`
  - *Dark mode themes with Claude* : verdicts par thème — Cave pigment, **Blush Quartz** (adoré), Dusk Stone, Moss Pool ("trop médical", abandonné). `[LOG]`
  - *Quality Review of Shadcn* : hygiène technique — dédup de composants, import **shadcn** (badge, alertdialog), décompo de soulpicker/recordstepper. `[LOG]`
  - **12:20** — `[CHANGELOG]` *Color World Themes* (5 thèmes, Blush Quartz par défaut). **17:38** — *Multi-Step Record Flow* (title/context/emotion/glyph).
  - **[PROTO 28 mars]** `pebbles-design_direction.md`, `emotion-pearl-shapers.jsx`, `emotion-pearl-selector-mvp.jsx`.
- **29 mars** — 4 logs + 1 feature :
  - *Single purpose record flow* : flow éclaté en étapes mono-objectif (time, name, description, intensity, emotion, souls, domains, cards). "No longer a form but a real flow". `[LOG]`
  - *Simpler emotion picker* : essai Claude pas convaincant → refait **seul sur Figma**. `[LOG]`
  - *Valence explorations* : module de shaping **intensité [1:3] × valence [−2:+2]** sur le **modèle circumplex de Barrett** ; revue Stone Drop / Sculpt / Topographic / Breath / Constellation ; "I've still not found the nugget for this shaper". `[LOG]`
  - *emotion pearl* : 1re version du shaper (visuel), piste **Rive** pour animer. `[LOG]`
  - **09:30** — `[CHANGELOG]` *Emotion Pearl Visualizer*.
  - **[PROTO 29 mars]** `pebble-shaper-explorations.jsx`, `pebbles-concept-sheet.html` (grille 9 variations valence × intensité).
- **30 mars** — *Pebble design explorations with AI* : journée pierre-angulaire. **Système de transposition arrêté** — Intensité : low=petit/oblong (2 angles), medium=triangulaire (3), high=losange (4) ; Valence : négatif=sombre/aigu/mat, neutre=ardoise/lisse, positif=multicolore/lumineux. Outils : **Nano Banana Pro** + challenge Claude ; un après-midi avec une amie ex-brand manager. "an instinctive and metaphorical way to appropriate Barrett's scheme without having to understand it intellectually". `[LOG]`
  - **21:30** — `[CHANGELOG]` *Progressive Web App* (install, offline, native scroll). **[PROTO 30 mars]** `pebble-shaping-prototype.html` (touchpad 2D intensity × valence).

### Semaine 2 — gamification, comptes, simplification (31 mars – 11 avril)

- **31 mars · Feeling native on mobile** — 3e milestone : rendre Pebbles natif (PWA, service worker, durcissement scroll/safe-areas, haptique "only on Android", splash). `[LOG]`
- **1 avril — 08:40** — `[CHANGELOG]` *Karma & Bounce System* (record → karma, revenir régulièrement → bounce, écran de célébration). **[PROTO 1 avr.]** `pebbles-arkaik.json` (copie racine).
- **2 avril** — Journée gamification + customisation (5 logs, plusieurs features) :
  - *Arkaik* : **Skill** maison qui maintient automatiquement un bundle cartographiant tout le produit (vues, flows, conditions, endpoints, statut plateforme). `[LOG]`
  - *Gamification erzatz* : **Counter** (records bruts), **Bounce** (rang 0–7 sur fenêtre glissante **28 jours**), **Karma** (enrichi selon la richesse du pebble), Success screen. `[LOG]`
  - *Explained gamification* : Counter/Bounce/Karma ont une icône + **modale explicative** ; Karma réagit aux éditions. `[LOG]`
  - *Carving* : module **Carve** — dessiner son **Glyph** à main levée (gérables comme des stickers ; vision long terme = composer une fresque via les Cairns). `[LOG]`
  - *Glyphs, souls and collections* : Glyphs (intégré au flow + /glyphs), Souls (CRUD + records liés, /souls), Collections (CRUD, /collections). `[LOG]`
  - *PWA* : "live since Tuesday" (= 31 mars), OK iOS (Safari) + Android (Chrome). `[LOG]`
  - `[CHANGELOG]` **10:14** Collections · **10:16** Glyph Drawing · **11:03** Souls Directory · **16:11** Pebble Relationships Editor.
  - **[PROTO 2 avr.]** `pebbles-stack-success.svg` (3 galets qui tombent et s'empilent = cairn complété).
- **3–4 avril · Accounts** — Comptes (username/password) + profils en **localStorage**, base de la **migration Supabase** à venir ; parcours public → login → onboarding → profil. `[LOG]` · **22:41 (3 avr.)** `[CHANGELOG]` *User Onboarding*.
- **4 avril · Tapbar** — Items de la tapbar rendus égaux (on cesse de vedettiser "Record") ; 3 écrans d'onboarding. `[LOG]` · `[CHANGELOG]` **07:07** Sign Up/Log In/Profile · **20:58** Inline Calendar · **21:01** Instant Photo Capture.
- **4–5 avril · Instants** — Jusqu'à **3 photos** ("instants") par pebble, dans le record flow. `[LOG]`
- **5 avril** — `[CHANGELOG]` **13:22** Pebble Revelation Screen · **19:41** *Pebble Visual Engine* ("œuvre générative unique selon intensité, couleur d'émotion, glyphe") · **22:47** Intensity-Scaled Pebble Cards. **[PROTO 5 avr.]** `pebble-renderer.jsx` (8 émotions, 12 glyphes, `getPebblePath`).
- **5–6 avril · Wasted Sunday** — Échec assumé : un dimanche gâché sur un **pebble engine trop complexe** ; mauvaise découpe (linéaire back→front au lieu d'itératif full-stack simple→complexe). **"flushed everything."** `[LOG]`
- **8–9 avril · Pebble engine** — 4 gros changements : **Pebble engine V2** (plus simple) ; **suppression de la sidebar dashboard** ("**Pebbles is an app, not a SaaS**") → carte flottante le long du **Path** ; **Quick Pebble editor** (saisie en secondes vs flow 10 étapes) ; navigation en sheet view. `[LOG]`
- **8–9 avril · Shapes** — Les **9 canvas** (Intensité × Valence) **dessinés à la main, sans IA** ; style très plat pour cohérence avec les Glyphs ; **abandon des Emotion Pearls**, la couleur d'émotion passe dans le **fill SVG**. `[LOG]`
  - `[CHANGELOG]` (8 avr.) **19:13** Improved Dark Mode · **21:29** New App Icons · **21:45** Quick Pebble Editor.
  - `[CHANGELOG]` (9 avr.) **05:22** Dark Mode & Theme Switcher · **05:51** Landing Page · **22:00** Legal Consent & Documentation · **23:22** Pebble Detail Redesign.
- **9–10 avril · (Quick Pebble editor V2)** — L'éditeur compact devient l'**unique** moyen d'enregistrer (cards temporairement abandonnées) ; auto-focus si < 5 pebbles. `[LOG]`
- **10–11 avril · Legal foundations** — Landing améliorée ; sheet → **centred peek** ; refacto de doublons ; **fondations légales** centralisées ; **"Ciao Google"** : suppression des Google Fonts distantes → **Ysabeau via npm**, Geist → system-font. `[LOG]`
  - **10 avril 23:26** — `[CHANGELOG]` *Core Database Schema* (modèle de données en prod : pebbles, profiles, emotions, domains, souls, collections). **[ROADMAP]** `docs/roadmap-ios-native.md` (daté 10 avr.) + scripts `gh-*` (M14→M23, 33 issues).
  - **11 avril** — `[CHANGELOG]` **09:37** Sign in with Google · **10:54** Local-First Data Layer (cache instantané + sync arrière-plan).

---

## Phase 4 — Le pivot natif iOS (12 → 27 avril 2026)

> Bascule de la webapp vers une **vraie app SwiftUI**. Suivie par les jalons M14→M23 `[ROADMAP]` et le `changelog`.

- **12 avril** — `[CHANGELOG]` **09:17** Richer Emotions & Domains (dernière grosse feature *webapp*) · **13:14** ⭐ **Native iOS App (SwiftUI)** — "a proper app, not just a web wrapper" · **15:28** Sign Up & Log In on iOS. **[PROTO 12 avr.]** `pebble-engine-workbench.jsx` (banc d'essai du moteur, `DEFAULT_LAYOUT` 3×3) — **même jour que l'extraction de `engine/`** (`types/glyph/layout/compose.ts`). `[ENGINE]`
- **Jalons** `[ROADMAP]` : M14 Monorepo (Turborepo) ~11 avr · M15 Supabase infra (11 data models, RLS) ~13 avr · M16 Web SupabaseProvider ~14 avr · M17 iOS bootstrap (Xcode + Supabase Swift SDK) ~15 avr · M18 Record flow ~17 avr · M19 Timeline & browse ~18 avr · **M20 TestFlight V0 ~19 avr** · M21 Souls & collections ~23 avr · M22 Bounce karma & gamification ~26 avr · **M23 TestFlight V1 ~27 avr**.
- **13 avril** — `[CHANGELOG]` **06:50** Record & Browse Pebbles (boucle principale iOS vivante) · **15:49** Profile Page (compteur, bounce, karma, collections, souls, glyphs).
- **14 avril 22:29** — `[CHANGELOG]` Pebble Detail Sheet.
- **15 avril 06:50** — `[CHANGELOG]` Edit a Pebble.
- **16 avril** — `[CHANGELOG]` **15:20** ⭐ **Remote Pebble Render Engine** ("moteur partagé, même ADN visuel iOS + web") · **16:42** Emotion-Colored Pebble Artwork · **18:38** Souls. `[NOTION: M15 Supabase infrastructure]` pointe `docs/arkaik/pebbles-arkaik.json`.
- **17 avril** — `[CHANGELOG]` **05:42** Collections · **15:38** Pebbles Color System.
- **18 avril** — `[CHANGELOG]` **06:48** Pebble Artwork in Path · **10:09** ⭐ Glyph Carving (canevas plein écran) · **14:55** Onboarding Screens (4 étapes) · **16:58** Welcome Screen. `[NOTION]` rafale de specs DLV (New Pebbles Editor, Remote Pebble Engine Slice 1, M17 iOS bootstrap, M21 Souls & collections).
- **19 avril** — `[CHANGELOG]` **06:06** ⭐ Valence Picker Sheet ("nine shapes, two polarities — one gesture") · **10:27** Visual Polish (logo, fonds, accents).
- **20 avril** — `[CHANGELOG]` **23:14** French Language (app entièrement FR). `[NOTION]` *DBT · Luni Submission*, *DSG · Pebble Engine V3* ("pebble shape + glyph + toggle fossil"), *DLV · Valence Picker*.
- **21 avril 23:32** — `[CHANGELOG]` Lab Tab (changelogs in-app + réactions aux features à venir).

---

## Phase 5 — Consolidation, data & itérations (fin avril → mai 2026)

- **30 avril** — **[SUPABASE]** migration `20260430_analytics_mvs.sql` : **12 vues matérialisées** (KPI, rétention, volume, enrichissement, bounce, émotions, domaines, participation cairn, visibilité, qualité) + `refresh_analytics_mvs()` via **pg_cron 03:00 UTC** + RLS admin-only. **[PROTO 30 avr.]** `analytics-mockup.html` (dashboard admin) + création de `apps/admin/`. `[NOTION: Documentation · Entities & Relations]` (modèle de données complet).
- **1 mai (W18)** — **[ANALYTICS]** rapport closed-beta : ~21 users depuis mi-février, ~15–16 MAU, stickiness DAU/MAU 6,67 %. Reco : shipper les **Cairns** (wraps hebdo/mensuels), piliers de positionnement.
- **3 mai** — `[ROADMAP]` TestFlight V2 prévu (bounce / karma / gamification).
- **15 mai** — **[PROTO 15 mai]** `bounce-explorations.html` : **Path A** (faire évoluer la fondation des **28 slots**) vs **Path B** (remettre en cause les niveaux discrets) ; visualisations karma + cairn. Le prototype le plus récent.
- **19 mai** — `[NOTION: Pebbles Home]` mise à jour (page d'accueil du teamspace).
- **27 mai** — `[DRAFT]` captures d'écran "au 27 mai 2026" (vue semaine, détail souvenir, profil) ; "à ce jour de mai 2026".
- **État repo au présent** — `[GITHUB]` **227 commits** sur `main`, 36 issues, public, `pbbls.vercel.app`, App ID Apple présent ; langages TS 57,6 % / **Swift 33,6 %** / PLpgSQL 7 %. Monorepo Turborepo (`apps/web` + `apps/ios`, `packages/shared` + `packages/supabase`). Paradigme "spec-driven agentique", Arkaik comme source de vérité.
- **29 mai 2026** — Aujourd'hui. Rédaction de l'article en cours (`draft.md`) + ce socle. `[CLAUDE.md]`

---

## Les charnières en une ligne (pour les accroches)

1. **2022** — Les colonnes de Beck me sauvent. Je veux les partager.
2. **2023–24** — Template Notion → échec d'adoption. Le support change, pas le problème.
3. **Automne–nov. 2025** — Webapp Beck à 15 étapes. Techniquement OK, humainement chiant. Abandon.
4. **25 mars 2026** — **Le pivot** : "never talk about therapy". Duolingo + Polarsteps + Pokémon.
5. **27–30 mars** — Le langage visuel minéral naît (neo-primitive, Barrett, 9 formes).
6. **2 avril** — Gamification éthique : Counter, Bounce (28 j), Karma. Et Arkaik.
7. **5–9 avril** — "**Wasted Sunday**" → simplification radicale : "Pebbles is an app, not a SaaS", Quick editor, adieu Emotion Pearls.
8. **12 avril** — **Le grand saut** : de la webapp PWA au natif **SwiftUI**.
9. **19–27 avril** — TestFlight V0 → V1 ; Valence Picker, Glyph Carving, FR.
10. **mai** — Data (12 vues), closed-beta ~21 users, on ré-interroge le Bounce.

---

## À vérifier (incohérences de dates repérées)

- **Décalage nom de fichier vs corps** sur plusieurs logs d'avril : `2026-04-03_Accounts` → corps "Saturday 4 April" ; `2026-04-04_Instants` → "Sunday 5 April" ; `2026-04-08_Pebble_engine` & `Shapes` → "Thursday 9 April" (avec "On Monday") ; `2026-04-09` → "10 April" ; `2026-04-10_Legal_foundations` → "11 April". → La clé de tri retenue est la **date du nom de fichier** ; le corps est parfois J+1.
- **PWA** : le log *PWA* dit "live since Tuesday" (= 31 mars) mais le `changelog` date *Progressive Web App* du **30 mars 21:30**. À harmoniser.
- **Closed-beta "mi-février"** : l'`[ANALYTICS]` parle d'une croissance depuis ~12 fév. avec ~21 users, alors que le build du concours démarre le 24 mars. S'agit-il des utilisateurs de la **webapp antérieure** (migrés) ? À clarifier dans le récit.
- **Dates Notion** = dates de *dernière modif* des pages (ex. Product Doc V2 "créé" 7 mars), pas forcément la date de la pensée d'origine.
- Les `due_on` des jalons M14→M23 sont des **dates cibles** de la roadmap (10 avr.), à confirmer contre les dates réelles de ship du `changelog` (qui, elles, collent bien : Native iOS 12 avr., Render Engine 16 avr., Valence Picker 19 avr.).
