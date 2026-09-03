---
Title: Digest — Journal de bord Apple Journal (37 entrées)
Source: docs/journal/AppleJournalEntries/Entries/*.html
Période: 24 mars → 10 avril 2026
Note: clé de tri = date du nom de fichier ; le corps est parfois J+1 (voir notes).
---

# Pebbles — Digest du journal de bord (Luni App Contest)

## Synthèse de l'arc global
Ces 37 entrées racontent la **gestation accélérée de Pebbles pendant le Luni App Contest**, depuis une intuition thérapeutique (les colonnes d'Aaron Beck en TCC) jusqu'à une app mobile « calme » de collecte de souvenirs. Le fil narratif est celui d'un **pivot fondateur** : abandonner l'approche clinique/journaling (jugée ennuyeuse et juridiquement risquée) pour un produit ludique inspiré de Duolingo (récompenses), Polarsteps (partage qualitatif) et Pokémon TCG (collection). Techniquement, Alexis raconte un **double abandon de stack** (Notion-as-prototype, puis SvelteKit/Codex) pour converger vers **Next.js + shadcn + Supabase**, avec Claude (Cowork/Design) et Figma comme partenaires de conception. Le cœur créatif est l'invention d'un **langage visuel minéral** (le « pebble » dont la forme encode intensité + valence selon le modèle circumplex de Barrett) et d'une **gamification éthique** (Counter, Bounce, Karma). La dernière phase voit une **simplification radicale** : le flow en 10 étapes devient un « Quick Pebble editor » compact, les Emotion Pearls sont abandonnées, et le projet s'industrialise (Arkaik, comptes/Supabase, PWA native, fondations légales).

---

## Entrées (ordre chronologique)

### 24 mars — Prologue
- Origine : exercice des **colonnes d'Aaron Beck** découvert en TCC. Première expé dans **Notion** (table = lecture, formulaire = écriture). Constat fondateur d'un manque : pas de nudges, récompenses, progression.
- *Verbatim* : « But something was missing: nudges, rewards, progression maybe? »
- **Tags** : Backstory/Pivot, Process/Meta

### 25 mars — Days 1 + 2 + 3
- **Agents Notion** : « product intelligence researcher » (littérature peer-reviewed, benchmark), « data architect », « product engineer ». Cadence haute vélocité.
- *Verbatim* : « fail fast, learn fast »
- **Tags** : Process/Meta, DataModel/Souls, Arkaik/Architecture · *réf.* « first week's sprint ».

### 25 mars — First Version
- Rétro : **automne 2025**, vibe-coding **Codex (OpenAI) sur SvelteKit + Supabase**. Deux erreurs : (1) client + modèle en même temps ; (2) techno de niche vs modèles sur-entraînés React/Next. Méthode « First simple, then powerful » (Linear) : ShameVP → POC UX → UI V1.
- *Verbatim* : « Choosing niche techno while models were (are) still over-trained on React and particularly Next… »
- **Tags** : Native-vs-Web, Process/Meta, Backstory/Pivot, Legal/Infra · *réf.* « Fall 2025 ».

### 25 mars — Duolingo vs Babel
- **Abandon de l'approche clinique** ; ne jamais parler de thérapie (légal + responsabilité). Les gens veulent le résultat (parler), pas le processus pénible (apprendre).
- *Verbatim* : « people want to *speak* another language (the result), they don't want to *learn* (the painful process). »
- **Tags** : Backstory/Pivot, Gamification/Bounce, Legal/Infra

### 25 mars — Flush Start
- Synthèse du **pivot** : 3 piliers — récompenses rapides ET durables (Duolingo), partage de meilleure qualité (Polarsteps), plaisir de collectionner (Pokémon TCG).
- *Verbatim* : « pick people with something they already value, and guide them to something more therapeutic but never talk about therapy. »
- **Tags** : Backstory/Pivot, Gamification/Bounce, Process/Meta

### 25 mars — End of the week
- App **Next.js** locale, 4 chantiers : enregistrer un souvenir, enregistrer une émotion, récompenser (sans dark patterns), naviguer l'historique (**le plus gros défi** : « ni liste, ni thread, ni stories »).
- *Verbatim* : « how to reward regularity ethically, how to reward quantity without dark patterns »
- **Tags** : Native-vs-Web, Gamification/Bounce, Path/RecordFlow

### 26 mars
- Bootstrap core flow : **Next + Turbopack** (boilerplate Vercel) ; « definition of ready » = milestone de **13 issues**.
- *Verbatim* : « I initiated a new repo with Next and Turbopack in seconds thanks to Vercel boilerplate. »
- **Tags** : Native-vs-Web, Process/Meta, Path/RecordFlow

### 27 mars (suivi)
- Reste **6/13 issues** ; setup **Claude Max styleguide + skills**, sandbox shell. Cadence quotidienne (Yesterday/Today/Outcome/Starting point).
- **Tags** : Process/Meta, Path/RecordFlow

### 27 mars — Anything experimentation
- Test de l'outil **« Anything »** : « go-tos » par défaut d'une IA sans contrainte UI (calendrier horizontal, FAB redondant, serif). Déception sur la créativité des modules émotion/intensité.
- *Verbatim* : « it might reveal that Anything is safeguarded enough to execute well specified prompts and prevent from whimsical hallucinations. »
- **Tags** : SwiftUI/Composants, Process/Meta, Visuel&Valence

### 27 mars — Design themes with Claude
- Identité **« neo-primitive »** : plat + animation-ready, jamais géométriquement parfait, irrégularité structurelle, pétroglyphes. Réfs **Nuoro (Samu Gambin)** + identité Claude. Installe le **plug-in Design d'Anthropic** (Notion/Figma/GitHub) ; « algorithmic shape randomness ».
- *Verbatim* : « everything is flat and animation-ready, but nothing is geometrically perfect. The irregularity is structural, not cosmetic. »
- **Tags** : Visuel&Valence, Naming/Minéral, Process/Meta

### 27 mars — Souls and domains
- Pickers **souls (personnes)** + **domains (Maslow revisité)**. Couche de données OK.
- *Verbatim* : « Now I have the second step of the flow with souls (people) and domains (Maslow's revisited) pickers. »
- **Tags** : DataModel/Souls, Path/RecordFlow, Naming/Minéral

### 27 mars — Record flow shell
- **Squelette du record flow** + 1res versions des pickers valence/size/émotion. Itération fonctionnelle avant le « delight ».
- *Verbatim* : « When the root flow is solid, I'll work on product delight and UI dingueries. »
- **Tags** : Path/RecordFlow, Visuel&Valence, SwiftUI/Composants

### 27 mars — Record cards
- 3e étape : **record cards** (feeling, thought…), chacune = une **question héritée de Beck**. Vision : analyse contextualisée + transversale via futures features IA « privacy-first ».
- *Verbatim* : « This will allow contextualized and transversal analysis the moment I'll be able to propose privacy-first AI features. »
- **Tags** : Path/RecordFlow, DataModel/Souls, Backstory/Pivot

### 27 mars — Update
- Vue détail d'un pebble (light + dark).
- **Tags** : SwiftUI/Composants, Visuel&Valence

### 28 mars — Emotion picker
- **Projet Claude (Cowork)** + Design Manifest (Notion = produit, GitHub = implémentation, Figma = explorations). 6 concepts d'artifacts buggés mais stimulants : **Breathing Pearl** (SVG pur), **Erosion Shaper** (« accélérateur de particules »), **Stacking Rings** (cairn), **Gravity Pearl** (cringe), **Sediment Press** (presser = donner du poids), **Ripple Pool** (bounce/ricochet).
- *Verbatim* : « it's hilarious… this gloomy rotating molecule is quite cringe » / « the game aspect make it fun. »
- **Tags** : Visuel&Valence, Gamification/Bounce, SwiftUI/Composants, Naming/Minéral

### 28 mars — Dark mode themes with Claude
- Dark mode par thème : **Cave pigment** (light aimé, dark « trop Claude »), **Blush Quartz** (les deux adorés), **Dusk Stone** (ok), **Moss Pool** (« trop médical », abandonné).
- *Verbatim* : « Cave pigment · love the light, but less the dark / however it's too Claude! »
- **Tags** : Visuel&Valence, Naming/Minéral

### 28 mars — Quality Review of Shadcn
- Hygiène code : dédup de 4 composants, import **shadcn** (badge, alertdialog), décompo de **soulpicker** et **recordstepper**, maj doc archi.
- **Tags** : SwiftUI/Composants, Process/Meta, Arkaik/Architecture

### 29 mars — Single purpose record flow
- Flow éclaté en **étapes mono-objectif** (time, name, description, intensity, emotion, souls, domains, cards picker, n(cards), summary). « No longer a form but a real flow ». Mobile OK mais « loin du natif ».
- *Verbatim* : « It's no longer a form but a real flow with action effects when moving backward. »
- **Tags** : Path/RecordFlow, Native-vs-Web, SwiftUI/Composants

### 29 mars — Simpler emotion picker
- Essai Claude pas convaincant → refait **seul sur Figma** (du vectoriel de la perle au prototypage). Limite : l'utilisateur devra swiper toutes les émotions sans vue d'ensemble.
- *Verbatim* : « I think it's far easier to implement, and I need that to test quickly the flow rather than overkill motion delight. »
- **Tags** : Visuel&Valence, Path/RecordFlow, Process/Meta

### 29 mars — Valence explorations
- Shaper combinant **intensité [1:3]** + **valence [-2:+2]** sur le **circumplex de Barrett**. Revue : Stone Drop (manque le neutre), Sculpt (sliders ennuyeux mais sémantique « sculpter » juste), Topographic (« run! »), Breath (press aimé mais frustrant), Constellation (« aweful »).
- *Verbatim* : « What's easy to understand is not playful. What's looking playful at first sight is unusable in the end. » / « I've still not found the nugget for this shaper. »
- **Tags** : Visuel&Valence, Path/RecordFlow, SwiftUI/Composants

### 29 mars — emotion pearl
- 1re version de l'**emotion pearl shaper** (visuel). Piste **Rive** pour animer le SVG (rotation, shimmer, couleur liée).
- *Verbatim* : « I may explore what I can do with Rive as this is the SVG I produced. »
- **Tags** : Visuel&Valence, SwiftUI/Composants, Naming/Minéral

### 30 mars — Pebble design explorations with AI
- Journée pierre-angulaire. **Système arrêté** — Intensité : low=petit/oblong (2 angles), medium=triangulaire (3), high=losange (4). Valence : négatif=sombre/aigu/mat, neutre=ardoise/lisse/poli, positif=multicolore/lumineux. Outils : **Nano Banana Pro** + challenge Claude ; un après-midi avec une amie ex-brand manager. Skeuomorphique trop 3D ; « river-stone striation » la plus proche ; certains stones « ressemblent à des cookies festonnés ».
- *Verbatim* : « the shaping module is an instinctive and metaphorical way to appropriate the Barrett's scheme without having to understand it intellectually. »
- **Tags** : Visuel&Valence, Naming/Minéral, SwiftUI/Composants · *réf.* « the entire afternoon ».

### 31 mars — Feeling native on mobile
- **3e milestone** : natif iOS/Android. PWA, service worker (offline), durcissement scroll/sélection, safe areas, touch polish, theming, **haptique** (« only on Android »), splash (Apple).
- *Verbatim* : « making pbbls feel native on iOS and Android… haptic (I know it will only work on Android). »
- **Tags** : Native-vs-Web, Legal/Infra, SwiftUI/Composants

### 2 avril — Arkaik
- **Skill** maintenant un **bundle Arkaik** (cartographie produit : flows, vues, conditions, endpoints, statut plateforme), sortie `.json` dans `/docs`, importable.
- *Verbatim* : « Arkaik is a home-made tool I've done in order to map comprehensively a product… without having to maintain this manually. »
- **Tags** : Arkaik/Architecture, Process/Meta, DataModel/Souls

### 2 avril — Gamification erzatz
- **Success screen** + **Counter** (records bruts) + **Bounce** (rang 0–7 sur **fenêtre glissante 28 jours**) + **Karma** (enrichi selon richesse du pebble). Incréments à l'affichage du success screen.
- *Verbatim* : « Bounce · rank the user in a 0-7 level based on regularity along a 28-day rolling window. »
- **Tags** : Gamification/Bounce, DataModel/Souls, Path/RecordFlow

### 2 avril — Explained gamification
- Counter/Bounce/Karma : icône + **modale explicative** au clic. Karma réactif aux éditions (« Pebble enrichment »).
- **Tags** : Gamification/Bounce, SwiftUI/Composants, DataModel/Souls

### 2 avril — Carving
- Module **Carve** : dessiner son **Glyph** à main levée (gérables comme stickers ; glyphs par défaut fournis). Vision : **Cairns** (wraps hebdo/mensuels) + glyphs = fresque/obélisque.
- *Verbatim* : « Yup, it might be more madness than vision, I agree »
- **Tags** : Visuel&Valence, Naming/Minéral, DataModel/Souls

### 2 avril — Glyphs, souls and collections
- **Glyphs** (carve intégré + /glyphs), **Souls** (CRUD + records liés, /souls), **Collections** (CRUD, /collections).
- *Verbatim* : « Now the user can carve a new glyph or attach an existing glyph to a pebble. »
- **Tags** : DataModel/Souls, Path/RecordFlow, Arkaik/Architecture

### 2 avril — PWA
- PWA **live since Tuesday** (= 31 mars), OK iOS (Safari) + Android (Chrome).
- **Tags** : Native-vs-Web, Legal/Infra · *réf.* « since Tuesday ».

### 3 avril (corps : 4 avr.) — Accounts
- **Comptes** (username/password) + profils en **localStorage**, base de la **migration Supabase**. Parcours public → login/register → onboarding → profil + logout.
- *Verbatim* : « profiles stored in localStorage, laying the groundwork for Supabase migration. »
- **Tags** : Legal/Infra, DataModel/Souls, Native-vs-Web · *décalage date fichier/corps.*

### 4 avril — Tapbar
- **Tapbar** : items égaux, couleur primaire sur l'onglet actif (on cesse de vedettiser « Record »). Onboarding 3 écrans.
- *Verbatim* : « items are equal and primary color is used for the active tab instead of featuring the "Record" button. »
- **Tags** : SwiftUI/Composants, Path/RecordFlow, Native-vs-Web

### 4 avril (corps : 5 avr.) — Instants
- **Instants** (photos) : jusqu'à **3** par pebble, dans le record flow.
- *Verbatim* : « Users can now upload up to 3 instants to a pebble, directly within the recording flow. »
- **Tags** : Path/RecordFlow, DataModel/Souls, Naming/Minéral · *décalage date.*

### 5 avril (corps : 6 avr.) — Wasted Sunday
- Dimanche gâché sur un **pebble engine trop complexe** ; mauvaise découpe (linéaire back→front au lieu d'itératif full-stack). **« flushed everything ».**
- *Verbatim* : « I literally wasted my sunday speccing and implemented a too complex pebble's engine… In the end, I flushed everything. »
- **Tags** : Process/Meta, Visuel&Valence, SwiftUI/Composants

### 8 avril (corps : 9 avr.) — Pebble engine
- 4 changements : **Pebble engine V2** (plus simple) ; **suppression sidebar dashboard** (« Pebbles is an app, not a SaaS ») → carte flottante le long du **Path** ; **Quick Pebble editor** (secondes vs 10 étapes) ; navigation en sheet view. Compromis : ancien flow plus pédagogique, nouveau « less affordable ».
- *Verbatim* : « No more dashboard sidebar · Pebbles is an app, not a SaaS. »
- **Tags** : Path/RecordFlow, SwiftUI/Composants, Native-vs-Web, Process/Meta

### 8 avril (corps : 9 avr.) — Shapes
- **9 canvas** (Intensité × Valence) **dessinés à la main, sans IA** ; style très plat (cohérence avec Glyphs). **Abandon des Emotion Pearls** ; couleur d'émotion dans le **fill SVG**.
- *Verbatim* : « I also decided to get rid of the Emotion Pearls, and to put the color of the emotion directly in the SVG fill. »
- **Tags** : Visuel&Valence, Naming/Minéral, SwiftUI/Composants

### 9 avril (corps : 10 avr.) — (Quick Pebble editor V2)
- L'éditeur compact devient l'**unique** moyen d'enregistrer (cards temporairement abandonnées). Structure : Header (time + intensity/valence), Title, Qualification (domain + emotion), Description, Customization (glyph, collection, souls, instants), Footer (privacy + save). Compact/étendu au focus ; **auto-focus** si < 5 pebbles.
- *Verbatim* : « It's now the unique way to record a pebble as all features are compacted in it (except for cards that are temporarily discontinued). »
- **Tags** : Path/RecordFlow, SwiftUI/Composants, DataModel/Souls

### 10 avril (corps : 11 avr.) — Legal foundations
- Landing « less ugle » ; **Sheet → centred Peek** ; refacto doublons + split de vues ; **Legal Foundation** (pages/contenus légaux centralisés) ; **« Ciao Google »** : suppression Google Fonts distantes → **Ysabeau via npm**, Geist → system-font.
- *Verbatim* : « I worked on legal pages and content foundations… to be centralized and continuously maintained by coding agents when needed. »
- **Tags** : Legal/Infra, SwiftUI/Composants, Arkaik/Architecture, Process/Meta

---

## Moments charnières / décisions clés
- **24 mars** — Le manque « nudges/rewards/progression » fonde le projet.
- **25 mars (Flush Start / Duolingo vs Babel)** — **Pivot** : Duolingo + Polarsteps + Pokémon ; « never talk about therapy » (raison aussi légale).
- **25 mars (First Version)** — Renoncement SvelteKit/Codex → cap Next.js.
- **27 mars (Design themes)** — Langage « neo-primitive » + plug-in Design d'Anthropic.
- **29–30 mars** — Verrouillage **Intensité×Valence** (Barrett) ; quête de « la pépite ».
- **2 avril (Arkaik)** — Cartographie produit auto-maintenue.
- **2 avril (Gamification erzatz)** — **Counter, Bounce (28 j), Karma**.
- **3–4 avril (Accounts)** — localStorage → rampe Supabase.
- **5–6 avril (Wasted Sunday)** — Échec + leçon de méthode (itératif full-stack).
- **8–9 avril (Pebble engine V2 / Shapes)** — Simplification radicale ; adieu Emotion Pearls ; 9 canvas à la main.
- **9–10 avril (Editor V2 / Legal)** — Un seul éditeur ; fondations légales ; nettoyage dépendances.
