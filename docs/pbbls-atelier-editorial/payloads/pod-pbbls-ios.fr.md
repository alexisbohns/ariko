---
name: L'app iOS
description: SwiftUI natif, iPhone seulement — la surface qui fixe le niveau d'exigence auquel les deux autres se mesurent.
pod: pbbls-ios
---

Un galet, c'est censé être un objet que tu tiens. L'app iOS, c'est là que ça se
décide : comment une pierre se dessine, comment elle se pose, ce que ta main sent
quand tu viens d'enregistrer quelque chose. Trois mois après le démarrage, au
moment de choisir la pile Android, le raisonnement a nommé cette surface
directement — le travail cher, c'est le rendu SVG sur mesure, le canevas de
glyphes, l'animation et la sensation haptique ; c'est du par-plateforme quel que
soit le framework ; et l'app iOS finie devient une implémentation de référence
directement portable.<!-- src: docs/decisions/log.md 2026-07-10 -->

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi iOS avant tout le
reste, seulement le fait, à partir du 12 avril 2026. Proposition : une app qui
sert à enregistrer un moment pendant que tu y es encore a sa place dans le
téléphone de ta poche, et un onglet de navigateur, ce n'est pas ça. À accepter,
réécrire ou couper à la relecture.]

La forme est volontairement sobre. SwiftUI, iOS 17 et au-delà, iPhone uniquement,
comme l'app web mobile-first dont elle est portée. Le projet Xcode n'est pas
versionné : un générateur le fabrique à partir d'un seul manifeste, ce qui rend le
fichier de projet jetable et les conflits de fusion dedans impossibles. Les builds
tournent sur Xcode Cloud. Rien n'a été soumis à l'App Store.

Ce que cette surface a de plus intéressant en ce moment, c'est qu'elle a deux
façons d'enregistrer un galet et qu'elle garde les deux exprès. Un tap sur le plus
du Path ouvre un flow en onze étapes — photo, quand, nom, valence, émotion,
domaine, âmes, collection, glyphe, confidentialité, publication — avec une
vibration à chaque tap. Un appui long sur le même plus ouvre l'ancienne fiche
tout-en-un. C'est une expérience sur le modèle d'interaction, et la façon honnête
d'évaluer un modèle d'interaction, c'est de pouvoir revenir en arrière sur
l'appareil, sans recompiler. L'appui long a été préféré à un réglage parce qu'il
n'ajoute aucun chrome, aucun état persisté, aucune chaîne à traduire — et qu'il se
supprime en une ligne le jour où l'expérience se
tranche.<!-- src: docs/decisions/log.md 2026-08-23 #723 -->

La moitié porteuse est dessous. Toutes les branches du chemin de publication et
tout le cycle de vie des brouillons ont été extraits pour que les deux composeurs
pilotent une seule copie. Chacune de ces branches est un bug déjà trouvé et déjà
corrigé une fois, et une deuxième copie écrite à la main, c'est exactement comme
ils reviennent : en silence, pendant que le flow continue d'avoir l'air de
marcher. Le journal laisse un mot pour celui qui trouvera deux composeurs plus
tard et croira que l'un est du code mort. Il ne l'est pas. Trancher l'expérience,
c'est en supprimer un, pas les fusionner.

Ce que cette surface a appris de plus net, c'est une fonctionnalité qui n'est
jamais sortie. Le karma gagné pendant l'enregistrement devait s'afficher dans la
Dynamic Island, en Live Activity. Sur l'appareil, la demande réussissait et se
déclarait active. Rien ne s'affichait — ni dans l'encoche, ni sur l'écran
verrouillé, ni au retour d'arrière-plan. iOS n'affiche pas dans la Dynamic Island
la Live Activity d'une app au premier plan, et le karma ne se gagne que par une
action au premier plan : la Dynamic Island ne pouvait donc jamais montrer
celle-là. L'objection avait été soulevée en brainstorming, écartée, puis tranchée
par l'appareil.<!-- src: docs/decisions/log.md 2026-07-01 #505 -->

Ce qui l'a remplacée reste dans l'app : une petite pastille qui apparaît en bas au
centre, dans une fenêtre traversante qui flotte au-dessus de la fiche ouverte,
avec un anneau de décompte et une vibration dérivée de l'enveloppe d'amplitude du
son céramique qui l'accompagne. La cible widget est toujours dans le projet,
inutilisée, gardée comme référence pour une future notification qui se déclenchera
app fermée — là où la Dynamic Island, elle, fonctionne.

Dans ce pod : le saut d'une app de navigateur vers SwiftUI ; les deux composeurs
et la règle qui les empêche de dériver ; et la Live Activity tuée par la preuve
terrain. Et une chose qui appartient à l'histoire du rendu vaut le détour ici : la
fixture qui définit à quoi doit ressembler un trait tremblé est un fichier iOS. Le
test web va la lire dans le dossier de tests iOS, Android en garde une copie
octet pour octet, et cette surface possède la définition du trait.

Le journal du produit compte 68 pull requests livrées marquées iOS, et au
2 septembre 2026 l'app fait tout ce que fait le web — connexion, Path,
enregistrement, profil, gravure et achat de glyphes, karma, Lab — en anglais et en
français.
