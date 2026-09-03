---
name: L'atelier
description: Comment Pebbles a été fabriqué — les mots choisis et les mots refusés, le jour où ce n'était plus une app de santé, et une carte du produit qui se tient à jour toute seule.
pod: pbbls-atelier
---

Tout le reste de cette étude de cas, c'est le produit. Ce territoire-ci, c'est sa
fabrication : les mots choisis et les mots refusés, le jour où ça a cessé d'être
une app de santé, et la mécanique qui permet à une seule personne de faire
avancer quatre surfaces. Presque rien de tout ça ne se voit depuis l'app, et
presque tout ça a décidé ce que l'app avait le droit d'être.

Commence par les mots : le nommage est arrivé en premier, et c'est lui qui a fait
le plus de travail. Un galet, c'est une petite pierre arrondie par l'eau — ce que
le temps fait à un souvenir : coupant le jour même, assez lisse ensuite pour
tenir dans la main. Empile-les et tu as un cairn, retenu contre *pile* et *heap*
parce que personne ne fait un cairn par accident. Dolmen et menhir sont tombés
pour une raison plus terre-à-terre : pour un anglophone, ça dit
Astérix.<!-- src: _digests/gemini.md §A–E ; brouillons/B3-naming-cairn.md -->

Puis la vraie bagarre. Une app d'habitude a presque toujours un *streak*, et un
streak c'est une chaîne, et une chaîne, ça casse. On voulait le mécanisme. Pas le
mot. Une semaine de recherche de nom, en février 2026, a abouti à *Skimmer* — le
galet qui rase l'eau sans couler — avec une objection nette à l'autre candidat :
tout le reste du vocabulaire nomme des objets, et *bounce* nomme une action.
C'est bounce qui a été pris.

[INTENTION? — la raison n'est pas sourcée à Alexis. Un brouillon de mai 2026
dans ce corpus avance qu'une chose qui rebondit remonte après être tombée, et
que pour un produit né d'une sortie de dépression ça dit quelque chose que le
galet qui effleure la surface ne dit pas — mais ce brouillon a été écrit par un
agent, pas par lui. À garder comme raison, à remplacer, ou à couper.]<!-- src: _digests/gemini.md §G ; brouillons/B3-naming-cairn.md -->

Nommer sert aussi de barrière. Dans Pebbles, les gens qui peuplent tes souvenirs
sont des âmes, jamais des utilisateurs. Et le produit ne dit pas *thérapie*.
Jamais.

Celui-là, c'est le pivot, et il a une date. Le 25 mars 2026, au début du mois de
concours, le cadrage clinique est abandonné : never talk about therapy. Les
raisons au dossier n'ont rien de pudique. C'est plus simple légalement. Et les
gens veulent le résultat, pas le processus — tu veux parler la langue, pas faire
les exercices. Le même jour pose les repères qui remplacent : Duolingo pour des
récompenses rapides et durables, Polarsteps pour un partage qui vaut le coup
d'œil, les cartes Pokémon pour le plaisir tout bête de
collectionner.<!-- src: dev-log 2026-03-25 « Duolingo vs Babel » et « Flush Start » -->

La version clinique avait été construite et abandonnée deux fois : un template
Notion que tout le monde trouvait chouette et que personne n'utilisait, puis une
webapp où les colonnes de Beck étaient devenues un parcours en quinze étapes —
techniquement correct, humainement pénible.

La psychologie, elle, est restée. Elle a juste arrêté de se présenter. Les cartes
du flux d'enregistrement sont les colonnes de Beck, une question chacune. La
forme que prend un souvenir vient du circumplex de Barrett, une intensité croisée
avec une polarité. Les domaines, c'est Maslow relu en grec. Rien de ce vocabulaire
n'arrive à l'écran.

Reste la fabrication elle-même. Chaque commit du dépôt est signé par un humain,
et quatre sur cinq portent un agent en co-auteur. Ce qui fait tenir ça, ce n'est
pas le modèle, c'est la paperasse : une spec avant le code, un plan avant le
clavier ; un journal de décisions en ajout seul, ouvert en mai 2026 parce que les
questions tranchées se re-tranchaient sans arrêt, faute d'endroit durable où les
poser ; et une règle de tri — la cérémonie suit le rayon de l'explosion — écrite
avec sa raison : c'est le processus lourd sur les petites tâches qui rend le
travail agentique lent. Les interdits pèsent autant que les rites. Ne jamais
refactorer du code existant sans accord : cette règle a coûté au produit un
fichier dupliqué en connaissance de cause, plutôt qu'une régression discrète dans
quelque chose qui marchait déjà, et la duplication est consignée au lieu d'être
cachée.<!-- src: _digests/method-current.md §1, §5, §8 -->

La carte, c'est l'autre moitié. Le 1er avril 2026, le graphe du produit tenait en
67 nœuds, et tous étaient des idées. Au 2 septembre 2026 il en compte 460, dont à
peu près trois sur quatre en production. Il a aussi cessé d'être un fichier qu'on
rafistole à la main : il est servi, et le statut d'un nœud bouge avec la pull
request qui le touche. Une liste de souhaits est devenue le relevé de ce qui est
vraiment sorti.<!-- src: _digests/method-current.md §3 -->

Où ça en est : rien n'est encore écrit dans ce territoire. Le nommage et le
vocabulaire minéral, le pivot, la psychologie en dessous, le partage du travail
entre une personne et des agents, la carte, et les harnais de contrat qui ont
transformé une vérification qu'il fallait penser à lancer en une vérification
qu'on ne peut plus contourner — tout ça reste à raconter.
