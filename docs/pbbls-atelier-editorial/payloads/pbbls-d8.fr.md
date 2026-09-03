---
name: Le dessin que tu ne peux plus corriger
description: Dans le marché de Pebbles, un glyphe passe en lecture seule pour celui qui l'a dessiné — voici le raisonnement derrière, et ce que ça coûte.
date: 2026-09-02
bean: pbbls-d8
---

# Le dessin que tu ne peux plus corriger

Un glyphe passe en lecture seule dès que tu le proposes à la boutique. Pas « à peu
près » en lecture seule. Tu dessines un chat, tu l'envoies en validation, tu
remarques que l'oreille gauche est trop haute — et la base te dit non.

S'il est refusé, tu le récupères. S'il est accepté et que quelqu'un en achète un
exemplaire, il t'échappe pour de bon.

Deux choses ont motivé ce verrou en lecture seule. La première, c'est la
suppression : si un créateur pouvait effacer son glyphe, tous ceux qui l'avaient
payé le verraient disparaître de leurs galets. La seconde, c'est ce que l'acheteur
paie vraiment — pas un chat, mais ces traits-là, dans cet ordre-là, tremblements
compris.<!-- src: docs/decisions/log.md 2026-06-30 D8 #496 -->

Derrière les deux, il y a ce à quoi sert le marché. Le karma, les badges et la
boutique existent pour récompenser l'habitude et la faire tenir, pas pour
enfermer qui que ce soit. Le karma se gagne en enregistrant, donc en ayant vécu
quelque chose d'abord, et il se dépense en glyphes qui décorent des souvenirs
faits ailleurs que dans l'app. Le temps passé dans l'app n'est pas la mesure.<!-- src: case-study spec §4, auteur 2026-09-02 -->

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi ici. Proposition :
les glyphes viennent de la communauté plutôt que d'un jeu maison, pour que les
symboles posés sur les galets de quelqu'un viennent d'autres pebblers et pas
d'une équipe de design. À accepter, réécrire ou couper à la relecture.]

## Où se trouve le refus

Sur le web, la page du glyphe cache ses boutons « modifier » et « supprimer » dès
que le glyphe part au marché. À la place, un badge : « Publié — verrouillé ». Ça,
c'est la version polie. La vraie tient en deux règles posées sur la table des
glyphes : la clause qui laisse le créateur écrire échoue dès qu'une soumission est
active, ou dès qu'un seul droit d'usage existe.<!-- src: migrations/20260630003348_glyph_marketplace.sql -->
Pourquoi là et pas dans l'interface ? C'est écrit noir sur blanc : un garde-fou
côté front se contourne par la voie d'écriture brute.<!-- src: docs/decisions/log.md 2026-06-30 D8 -->

Le verrou se ferme avant la vente. Il se ferme à la soumission. Dès que le glyphe
entre dans la file de relecture, les traits sont figés. Un refus le relâche :
l'index ne bloque qu'une soumission en attente ou approuvée, donc un glyphe refusé
se redessine et se renvoie. Une approbation suivie d'un achat, elle, ne le relâche
plus.

Il y a une exemption dans la règle. C'est un rôle, pas une personne : un admin
peut écrire sur un glyphe verrouillé, parce que gérer les listings, c'est le
boulot du back-office. Ce que le back-office fait de ce droit, en vrai : fixer un
prix, retirer de la vente, réattribuer, supprimer. Rien là-dedans ne déplace un
trait. Il n'existe aucun écran, nulle part, qui relève cette oreille. Le mien
compris.<!-- src: apps/admin/app/(authed)/pebblestore/glyphs/actions.ts -->

[TO VERIFY: la phrase approuvée « À moi aussi » se lit comme un refus au niveau de
la base. En vrai, les règles exemptent `is_admin` en écriture et en suppression ;
l'affirmation tient un cran au-dessus, parce qu'aucune surface admin ne modifie la
géométrie, et c'est comme ça qu'elle est écrite ici.]

## Ce que l'acheteur tient

Acheter un glyphe, ça ne le copie pas. L'achat écrit un droit d'usage : une ligne
qui dit que cette personne-là peut se servir de ce glyphe-là. Les traits, eux,
restent où ils sont. Un seul jeu de traits, toujours signé par celui qui l'a
dessiné.<!-- src: docs/decisions/log.md 2026-06-30 #496 D1 -->

C'est cette source unique qui fait de la suppression la première raison, et pas la
seconde. Les droits d'usage tombent avec le glyphe. Un créateur qui a un bouton
supprimer a un bouton qui annule tous les achats d'un coup, et les acheteurs
l'apprennent en ouvrant leurs galets. La modification, c'est le même événement au
ralenti : le chat que tu as payé devient un autre chat, et on ne t'a rien demandé.

Comment l'achat tient en une seule transaction, ce que coûte un listing, ce que
devient un glyphe vendu quand son créateur supprime son compte : tout ça, c'est
:entity[Rien ne change de mains]{ref=bean:pbbls-market} et la suppression de compte.

## L'admin qui ne voit pas la file qu'il relit

L'autre moitié de la règle, la lecture, a une conséquence un cran plus loin.

Un glyphe est lisible si tu le possèdes, s'il n'a pas de propriétaire, s'il est
approuvé, ou si tu l'as acheté. Une soumission en attente n'est rien de tout ça.
Donc la personne qui relit la file ne pouvait pas lire les traits de ce qu'elle
est en train de relire. Ce n'est pas un trou dans l'outil de modération. L'outil
obéissait à la règle du marché, comme tout le monde.

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi ici. Proposition :
les soumissions passent devant quelqu'un avant d'entrer au marché parce qu'un
symbole que des gens vont porter sur leurs propres souvenirs ne se laisse pas
entrer tout seul. À accepter, réécrire ou couper à la relecture.]

Deux sorties possibles. Élargir la règle de lecture aux admins, ou l'élargir aux
soumissions en attente. Dans les deux cas, on rend la règle du marché moins exacte
pour arranger un écran. Ce qui a été livré, c'est une fonction de lecture en
`SECURITY DEFINER` : elle porte son propre contrôle `is_admin`, fait la jointure
côté serveur, et rend la file du plus ancien au plus récent. L'en-tête de la
migration le dit : « le chemin de lecture de la file existe parce que la règle
élargie glyphs_select (D8) ne laisse PAS un admin lire les traits d'une soumission
en attente via RLS. »<!-- src: migrations/20260630084718_admin_glyph_moderation.sql, en-tête ; VO : "the queue read path exists because the widened glyphs_select (D8) does NOT let an admin read a *pending* submission's strokes via RLS" -->

Le compromis est lisible. La règle reste étroite, et l'exception, c'est une
fonction, dans un fichier, avec son propre garde — plutôt qu'un droit ajouté
discrètement à une règle dont tout le produit dépend.

## La moitié que le verrou ne couvrait pas

Verrouiller les traits, ça règle qui a le droit de modifier un glyphe. Ça ne dit
rien de qui a le droit d'en accrocher un. Deux questions différentes, et une seule
avait sa réponse dans la base : les deux fonctions qui écrivent un galet
prenaient l'identifiant du glyphe tel quel dans la charge utile, sans vérifier à
qui il appartenait, et les âmes écrivaient le leur directement dans la table. Le
client était la seule barrière. Donc tous les clients — web, iOS, Android —
étaient la seule barrière.<!-- src: docs/superpowers/specs/2026-07-12-glyph-picker-store-harmonization-design.md -->

C'est remonté sous forme d'un retour d'utilisateur : je peux choisir des glyphes
que je n'ai ni dessinés ni achetés. La plus grande partie était autre chose, et
c'était vrai : les glyphes maison appartiennent au compte admin, donc pour ce
compte-là ce sont littéralement « les miens ». Mais le contrôle manquant, lui,
existait bel et bien. Le 12 juillet 2026, une fonction
`can_use_glyph` est arrivée, branchée sur les deux écritures de galet et sur un
déclencheur côté âmes. Le droit d'usage se vérifie maintenant là où le glyphe
sert, pas seulement là où il se modifie.<!-- src: migrations/20260712000000_glyph_usability_guard.sql -->

## Ce que le verrou coûte

Côté créateur, c'est petit et c'est réel. Tu ne peux pas corriger l'oreille. Tu ne
peux pas changer ton prix : c'est celui du relecteur. Tu ne peux pas retirer le
glyphe une fois qu'un exemplaire est sorti. Il te reste à ne pas le soumettre, ou
à demander.

Ce coût-là, une personne le paie pour en protéger une autre. Le karma que
l'acheteur a dépensé, il l'a gagné en enregistrant quelque chose qu'il a vraiment
vécu. Donc ce qu'il a acheté doit rester ce qu'il a acheté. Le mot du journal pour
l'inverse, c'est *bait-and-switch* : vendre une chose et en livrer une autre.<!-- src: docs/decisions/log.md 2026-06-30 D8, contexte ; VO : "would be bait-and-switch on what buyers paid for" -->
Et la boîte de dialogue le dit avant que tu valides : une fois proposé, tu ne peux
plus le modifier ni le supprimer.<!-- src: apps/web/lib/i18n/messages/fr.json glyphs.submit.confirmDescription -->

Côté relecteur, il y a un mot. Un refus exige une raison écrite, stockée sur la
soumission et affichée au créateur sur sa propre page.<!-- src: docs/decisions/log.md 2026-06-30 #497 -->
C'est le seul canal de retour que le marché ait prévu vers celui qui a dessiné, et
il ne s'ouvre que sur un refus.

## Où ça en est

L'économie tourne, et elle se tient. Le karma, le portefeuille, le marché, la
modération et la curation sont sortis entre le 29 juin et le 31 juillet 2026 — le
web d'abord, puis iOS, puis Android. Depuis, rien n'est sorti dans ce coin-là.
L'été est parti ailleurs.

La boutique a été pensée pour vendre autre chose que des glyphes. Les thèmes et
les habillages de galets sont écrits comme des marchandises futures, et le chemin
d'achat a été taillé pour qu'un deuxième bien le réutilise. Aucun des deux
n'existe encore. La rémunération des créateurs, c'est toujours le transfert à
somme nulle ; le journal note qu'un modèle de royalties partirait de la même
colonne de propriété, et ce travail n'a pas commencé.<!-- src: docs/decisions/log.md 2026-07-01 ; #494/#496/#497 non-goals -->

La question ouverte, ce n'est pas le verrou. Le verrou fait ce qu'il dit. C'est ce
qu'un créateur peut faire quand il veut une correction après la vente.
Aujourd'hui, rien.
