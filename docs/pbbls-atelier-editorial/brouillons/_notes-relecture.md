---
Title: Notes de relecture — vague 1 (B1, B2, B3)
Statut: 29 mai 2026
---

# Notes de relecture — les 3 premiers brouillons

Trois brouillons produits par subagents, chacun calé sur `03-guide-de-style.md` + `draft.md`.
**Ce sont des échafaudages** : faits exacts, structure, transitions, ton approchant. À toi la plume finale.

## État des lieux

| Brouillon | Titre proposé | Mots | Voix (marqueurs) | Faits |
|---|---|---|---|---|
| **B1** · Visuel & valence | « Forme et fond · comment un souvenir est devenu un caillou » | ~3 900 | 29 apartés, 6 pull-quotes | sourcés, 0 inventé |
| **B2** · Le Path | « Le Path · de la corvée en 15 étapes au galet en trois secondes » | ~2 700 | 40 apartés, 12 pull-quotes | sourcés, 0 inventé |
| **B3** · Naming | « Nomen omen · pebbles, cairns, et la saga du "bounce" » | ~3 500 | 23 apartés, 5 pull-quotes | sourcés, 0 inventé |

Tous un peu au-dessus de la cible de longueur : c'est **voulu** (matière à tailler, pas à rallonger).
Vérifié : phrases porteuses des digests confirmées dans les logs bruts ; aucune affirmation "shippé"
hors d'un `[À COMPLÉTER]`. Reste **ton jugement final sur la voix** (les marqueurs sont là, mais
le grain, c'est toi).

## Ce que TOI seul peux trancher (punch-list)

### 1. Chiffres & cohérence
- **15 vs 10 étapes** (B2) : le `draft.md` dit "15 étapes" (webapp Beck, nov. 2025), les logs du concours disent "10 étapes" (29 mars, *Pebble engine*). Même flow dégraissé, ou deux flows distincts ? → à clarifier (B2 les présente comme deux moments).

### 2. "Vraiment livré" vs "exploré" (anti-surcl­aim)
- **Bounce** : shippé le 1ᵉʳ avril (changelog « Karma & Bounce System »), rang 0–7 sur fenêtre glissante 28 j (log 2 avr.) — MAIS en **refonte mi-mai** (`bounce-explorations.html`, Path A/B). → dire "shippé puis ré-interrogé", pas "stabilisé". (B3)
- **Grades speck→nugget→monolith** : aucune trace de ship → probablement **resté exploration lexicale**. Ne pas vendre comme système de grades livré. (B3)
- **Retro / fossile d'ammonite** : présent dans `pebble-renderer.jsx` + `compose.ts` (couche "fossil"), mais **pas confirmé shippé**. → niveau moteur, pas feature annoncée. (B1)

### 3. Le "pourquoi" légal
- **"Never talk about therapy"** (B3, B2) : préciser la vraie raison (responsabilité / statut de dispositif médical ?) depuis ton souvenir du 25 mars. Placeholder prudent posé.

### 4. Les anecdotes vécues à incarner (la voix attend du concret)
- **L'après-midi avec l'amie ex-brand manager** (B1, 30 mars) : nom, échange, ce qu'elle a dit.
- **Le ressenti d'abandon des Emotion Pearls** (B1) : soulagement ou deuil ? (métaphore Jenga par défaut, à remplacer).
- **Le vécu du "Wasted Sunday"** (B2) : l'heure, le moment de bascule, le café froid — ce qui fait le gag.

### 5. Légendes d'images
- Les apartés `[...]` de captures (vues d'app d'époque) sont à fournir depuis tes `Resources/` Apple Journal (HEIC/PNG) — je peux t'aider à les retrouver/dater.

## Reco de prochaine étape
Lis les 3, annote (surtout la punch-list ci-dessus). Pendant ce temps, je peux lancer la **vague 2**
(B4 pivot Beck→galet, B5 gamification éthique, B6 SwiftIU→composants maison) ou étoffer le **récit
accessible (A1)** en réutilisant ces brouillons comme chapitres.
