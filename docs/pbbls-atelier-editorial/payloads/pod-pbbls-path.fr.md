---
name: Le Path
description: L'endroit où tu reviens lire — une vie posée comme un chemin qu'on remonte plutôt qu'un fil qu'on fait défiler, et le problème le plus dur du produit.
pod: pbbls-path
---

Enregistrer un moment prend quelques secondes. Y revenir, c'est l'autre moitié —
et celle pour laquelle tout le reste existe. Ce territoire, c'est le côté
lecture de Pebbles : l'endroit où ce que tu as gardé s'étale, et où tu pars
chercher un mardi de mars sans savoir que c'est ça que tu cherches.

L'introduction de l'app pose la prémisse d'entrée : ta vie est un chemin, et la
plus grande partie s'échappe avant même que tu la
remarques.<!-- src: apps/web/lib/i18n/messages/fr.json onboarding.steps.path -->
Elle pose le refus dans la même phrase : aucune série à entretenir, aucun fil à
faire défiler. Ça coûte, parce que le fil est le problème résolu et que tout le
reste ne l'est pas.

Ce coût a été nommé dès le premier week-end de travail. Le 25 mars 2026, quatre
chantiers sont écrits — enregistrer un moment, enregistrer une émotion,
récompenser la régularité sans dark patterns, et naviguer dans l'historique — et
le quatrième est marqué le plus dur, avec une contrainte accrochée dessous : ni
liste, ni fil, ni
stories.<!-- src: _digests/apple-journal.md, 25 mars 2026 — End of the week -->
Les trois sont consignés comme des refus. Le raisonnement derrière, non.

[INTENTION? — je n'ai pas trouvé de source pour le rejet de chacun des trois.
Proposition : une liste met la naissance d'une nièce et la queue à la Poste à la
même hauteur, un fil suppose que chaque moment réponde au précédent, et les
stories sont faites pour s'effacer — l'inverse d'une chose gardée exprès. À
accepter, réécrire ou couper à la relecture.]

Ce qui a été construit traite le temps par blocs, pas en ruban. Les galets sont
groupés par semaine ISO, chaque semaine a sa page, et on passe de l'une à
l'autre latéralement plutôt que vers le bas. Le bandeau de semaines au-dessus ne
contient que les semaines qui portent quelque chose, plus la semaine en cours :
voisin dans le bandeau ne veut donc pas dire voisin dans le calendrier, et une
année sans rien enregistrer se replie en un seul
pas.<!-- src: apps/ios/.../Services/WeekRollBuilder.swift ; apps/web/lib/utils/week-roll-entries.ts -->
À l'intérieur d'une semaine, le tri s'inverse selon l'endroit où tu es : les
semaines passées se lisent de la plus ancienne à la plus récente, donc tu les
remontes dans le sens de la marche, et la semaine que tu vis se lit à l'envers.

Depuis le 23 août 2026, le web va plus loin. Le Path y est un mur de polaroïds,
chaque galet posé à cheval sur le bord haut de son tirage. C'est là que la seule
règle non négociable de ce territoire est devenue visible. Les cartes sont
distribuées aux colonnes en rotation stricte, jamais équilibrées par la hauteur —
ce que ferait pourtant n'importe quelle mosaïque. La décision comme le code
disent pourquoi : équilibrer les hauteurs laisse une carte courte doubler la
file pour combler un trou, donc deux cartes côte à côte cessent d'être voisines
dans le temps, et sur un Path « dont toute la prémisse est la chronologie, c'est
un bug de correction déguisé en bord inférieur plus
propre ».<!-- src: docs/decisions/log.md 2026-08-23 #720 ; apps/web/lib/utils/path-layout.ts ; VO : "a correctness bug wearing a tidier bottom edge" -->
Le mur paie ça en colonnes qui ne finissent pas à la même hauteur, et le code dit
dans quel sens va l'échange : un bord du bas irrégulier se lit comme un mur, une
chronologie dans le désordre se lit comme un bug.

Les gros galets cassent le mur et prennent toute la largeur. C'est toute la
hiérarchie dont dispose le Path. Il n'y a pas de recherche dessus, pas de
filtre, et aucun moyen de sauter à une date.

Dans ce territoire : la navigation elle-même — les refus, la semaine comme unité
de mémoire, le mur — et les collections, l'autre façon de grouper : celle que tu
choisis, quand la première est choisie par le calendrier. Une collection peut
être une Stack, un Pack ou un Track : un objectif, quelque chose de borné dans
le temps, quelque chose qui revient. Le mode est un badge et rien d'autre. Il ne
change aucun ordre, aucune limite, aucun comportement nulle part.

Où ça en est, au 2 septembre 2026 : le mur n'existe que sur le web. iOS et
Android dessinent encore des lignes, et la décision le dit franchement — rien
n'est cassé, aucun schéma ni contrat n'a bougé, et aligner les deux autres est un
chantier de suite, pas une régression à corriger en aveugle. Une promesse reste
en l'air. Quand tu choisis l'ampleur qu'a eue un moment, le sélecteur t'annonce
qu'il sera réuni dans ton Cairn hebdomadaire, mensuel ou annuel. Il n'existe ni
table, ni point d'entrée, ni écran de
Cairn.<!-- src: apps/ios/.../Models/Valence.swift ; arkaik API-get-weekly-cairn retired_reason ; issue #220 ouverte -->
