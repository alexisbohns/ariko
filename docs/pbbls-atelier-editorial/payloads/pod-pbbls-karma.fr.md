---
name: Le karma et le marché des glyphes
description: L'économie posée dans un journal intime — à quoi sert la monnaie, pourquoi rien ici ne peut en fabriquer, et pourquoi les symboles en vente ont été dessinés par d'autres.
pod: pbbls-karma
---

Une économie dans un journal intime, ça ne tient que si tu peux dire à quoi elle
sert. Le karma, les badges et la boutique existent pour récompenser l'habitude et
la faire tenir. Pas pour enfermer qui que ce soit. Le karma se gagne en
enregistrant — donc en ayant vécu quelque chose d'abord — et il se dépense en
glyphes, de petits symboles dessinés à la main, qui décorent des souvenirs faits
ailleurs que dans l'app. Le but, c'est de t'envoyer dehors ramasser quelque chose
qui vaut la peine d'être gardé. Le temps passé dans l'app n'est pas la
mesure.<!-- src: spec case-study §4, auteur 2026-09-02 -->

Cette dernière phrase, c'est celle que le design doit tenir. Il la tient en
arithmétique plus qu'en discours.

Rien ici ne fabrique du karma. Une vente déplace le prix de l'acheteur vers celui
qui a dessiné le glyphe — même somme, même transaction. Le marché ne peut pas
battre monnaie.<!-- src: docs/decisions/log.md 2026-07-01 #497 -->
Le karma naît d'un seul endroit : enregistrer. Un galet paie une petite somme
fixe : un point parce que tu l'as posé, un point par chose que tu mets dedans, le
tout plafonné à dix. Au 2 septembre 2026, un glyphe de la communauté est listé à
25 karma par défaut. Soit à peu près trois galets bien remplis pour un
symbole.<!-- src: migrations/20260411000003_rpc_functions.sql ; 20260630003348_glyph_marketplace.sql -->

Le registre refuse aussi de se protéger lui-même. Il n'y a pas de plancher à
zéro. Tu supprimes un galet, le karma qu'il t'avait payé ressort, même si tu l'as
déjà dépensé, et ton solde reste en dessous de zéro jusqu'à ce que tu enregistres
autre chose. Le garde-fou évident — une contrainte qui interdirait le solde
négatif — tient en une ligne. Elle a été refusée, puis écrite deux fois pour
qu'elle le reste : cette ligne-là ferait échouer la suppression d'un souvenir
chez quelqu'un qui a déjà dépensé ce que l'enregistrer lui avait
rapporté.<!-- src: docs/decisions/log.md 2026-06-29 #494 -->
La monnaie n'a pas le droit de se mettre entre une personne et son propre récit.

Et le stock n'est pas maison. Les glyphes en vente sont dessinés par des
pebblers, relus, tarifés, publiés. En acheter un donne le droit de s'en servir,
jamais une copie, et les traits restent à celui qui les a tracés.

[INTENTION? — cette question est maintenant marquée dans trois textes et pourrait
être tranchée une seule fois pour les trois. Proposition : le marché est
approvisionné par les pebblers plutôt que par un jeu maison, pour qu'un symbole
posé sur le souvenir de quelqu'un ait été dessiné par quelqu'un qui enregistre
aussi. À accepter, réécrire ou couper à la relecture.]

L'onboarding d'avril portait une promesse en deux moitiés : « Aucune série à
entretenir, aucun fil à faire défiler. » La seconde est tenue, absolument, et le
décret qui la tient a été écrit avant le code qu'il engage. La première est plus
compliquée. Le bounce, le rang de régularité, existe depuis avril 2026 ; ce qui a
changé en juillet, c'est qu'il est devenu visible sur un profil public. Aucune
entrée de décision, nulle part, ne relève ce changement. Autant le dire ici
plutôt que de le ranger.<!-- src: apps/web/lib/i18n/messages/fr.json onboarding depuis PR #100 ; journal PR #675/#677 ; digest act3-community-trust R2 NOT FOUND -->

[INTENTION? — je n'ai pas trouvé de position sur la moitié « série ».
Proposition : le bounce a toujours été un rang sur une fenêtre glissante plutôt
qu'une chaîne qui casse, donc juillet l'a rendu social, pas punitif. À accepter,
réécrire ou couper à la relecture.]

Les textes écrits, les voilà. :entity[Un porte-karma sans plancher]{ref=bean:pbbls-wallet}, c'est le registre
et son plancher manquant. :entity[Rien ne change de mains]{ref=bean:pbbls-market}, c'est ce qu'un achat
écrit vraiment : une ligne, aucune copie, aucune création de monnaie.
:entity[Le dessin que tu ne peux plus corriger]{ref=bean:pbbls-d8}, c'est le dessin que son auteur ne peut plus toucher
dès que quelqu'un l'a payé. Les badges sont la pièce pas encore écrite :
permanents par construction, sans chemin de révocation à oublier, et ils paient
du karma au déblocage dans le même portefeuille.

Où ça en est. L'économie s'est construite d'un seul élan. Le portefeuille est
sorti le 29 juin 2026, puis le marché, puis la modération et la curation — le web
d'abord, puis iOS, puis Android — et rien n'est sorti dans ce coin depuis le
31 juillet. Ça tourne, et ça se tient. La deuxième marchandise pour laquelle la
boutique a été taillée, les thèmes et les habillages de galets, est annoncée dans
les specs et n'existe pas. Le travail n'est pas fini et n'a pas été retiré :
l'été est parti ailleurs dans le produit.
