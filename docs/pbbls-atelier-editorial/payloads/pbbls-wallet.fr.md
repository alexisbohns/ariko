---
name: Un porte-karma sans plancher
description: Dans Pebbles, le registre du karma accepte que ton solde passe sous zéro. C'est un refus, pas un oubli — voilà ce que ça protège, et ce qui t'empêche de trop dépenser.
date: 2026-09-02
bean: pbbls-wallet
---

# Un porte-karma sans plancher

Tu supprimes un galet. Mauvais jour, mauvaise date, ou tu l'avais déjà enregistré
une fois. L'enregistrer t'avait rapporté du karma, donc le supprimer te le
reprend — et si tu l'as déjà dépensé, ton solde passe sous zéro et y reste
jusqu'à ce que tu enregistres autre chose.

Ce n'est pas un état que tu as trouvé par accident. C'est la seule chose que le
registre a été construit pour permettre.

Le karma existe pour récompenser l'habitude et la faire tenir, pas pour retenir
qui que ce soit. Il se gagne en enregistrant — donc en ayant vécu quelque chose
d'abord — et il se dépense en glyphes qui décorent des souvenirs faits ailleurs
que dans l'app. Le temps passé dans l'app n'est pas la mesure.<!-- src: case-study spec §4, auteur 2026-09-02 -->
Il reste donc une chose que cette monnaie n'a pas le droit de faire : se mettre
entre quelqu'un et ses propres souvenirs.

## Un seul registre, et tout y est une ligne

`karma_events` ne fait que s'ajouter. Le solde, c'est la somme. Rien n'est jamais
réécrit : une correction est une ligne de plus, un achat est une ligne de plus,
la reprise d'une suppression est une ligne de plus. Une petite table à côté
garde le total courant, pour qu'on puisse lire et verrouiller le solde à un seul
endroit.<!-- src: docs/decisions/log.md 2026-06-29 #494 -->

Chaque ligne porte un sens en plus d'un signe, et les deux ne se confondent pas.
Le sens, c'est la catégorie du mouvement : côté gain ou côté dépense. La reprise
d'une suppression est un nombre négatif côté gain. Un remboursement est un nombre
positif côté dépense. C'est cette distinction qui permet à la page du porte-karma
d'afficher « total gagné » et « total dépensé » sans mentir ni sur l'un ni sur
l'autre.<!-- src: spec 2026-06-29-issue-494-karma-wallet-design.md §Core design decisions 2 -->

Le gain, lui, est une petite somme fixe, calculée une fois par galet : un point
pour l'avoir enregistré, et un point pour chaque chose que tu as mise dedans —
une description, une âme, un domaine, un glyphe, une photo, les cartes — le tout
plafonné à dix. Au 2 septembre 2026, un glyphe de la communauté est proposé à 25
karma par défaut. Le moins cher de la boutique coûte donc environ trois galets
bien remplis.<!-- src: migrations/20260411000003_rpc_functions.sql compute_karma_delta ; 20260630003348_glyph_marketplace.sql -->

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi du plafond à dix.
Proposition : un galet est plafonné pour que le remplir vaille quelque chose et
que l'acharnement ne vaille rien, parce que le karma suit un moment vécu et pas
l'effort de taper. À accepter, réécrire ou couper à la relecture.]

## Le plancher qu'on a refusé

Le garde-fou évident tient en une ligne. Tu mets `CHECK (balance >= 0)` sur la
colonne du solde et plus aucun compte ne passe en dessous. Il a été refusé, puis
écrit deux fois pour qu'il le reste.<!-- src: docs/decisions/log.md 2026-06-29 #494, conséquences ; migrations/20260629193636_wallet_balances.sql, en-tête -->

La suppression, voilà pourquoi. Supprimer un galet, ça additionne tout ce que ce
galet a rapporté et ça réécrit ce total en négatif dans le registre. Avec une
contrainte de non-négativité, cette écriture échoue dès que le karma a été
dépensé entre-temps — et l'écriture qui échoue emporte la suppression avec elle.
Résultat : quelqu'un qui ne peut plus supprimer un souvenir parce qu'il a déjà
dépensé ce que ce souvenir lui avait rapporté.

Le journal le dit en moins de mots : « Lier la suppression d'un galet à l'état du
porte-karma serait une mauvaise UX, donc les reprises doivent toujours
s'appliquer, même dans le négatif — un CHECK sur la colonne annulerait une
suppression légitime. »<!-- src: docs/decisions/log.md 2026-06-29 #494 ; VO : "Coupling pebble deletion to wallet state would be wrong UX, so clawbacks must always apply even into the negative — a column CHECK would roll back a legitimate delete." -->
La conséquence est notée comme une règle, pas comme une préférence — ne pas
ajouter cette contrainte, elle casserait la suppression de galet — et la
migration la répète en commentaire, exactement là où la prochaine personne aurait
envie de l'ajouter.

Donc la dette est réelle, et elle s'affiche. Le porte-karma ne ramène pas le
nombre à zéro et ne cache pas l'historique qui l'a produit : un solde négatif
s'affiche comme un solde négatif, avec une phrase en dessous — gagne du karma
pour remettre ton solde à zéro avant de pouvoir acheter à nouveau. La spec
demandait ça, dans ces termes : honnêtement, jamais caché, jamais alarmant.<!-- src: spec §Wallet page 2 ; apps/web/lib/i18n/messages/fr.json wallet.debtHint -->

## Ce qui t'empêche de trop dépenser

Le garde-fou n'a pas disparu. Il est monté d'un cran : de la colonne vers la
fonction qui dépense.

Tout achat dans le produit passe par `spend_karma`. Elle pose un verrou sur la
ligne de ton solde, le compare au prix, et refuse avec `insufficient_karma` s'il
manque quelque chose. Le verrou, c'est ce qui fait tenir deux appareils qui
achètent au même moment : le second lit le solde que le premier a laissé, pas
celui qu'il avait au départ.<!-- src: migrations/20260629193838_wallet_rpcs.sql -->

Tu peux finir en négatif. Tu ne peux pas y aller en dépensant. Et la dette ne
demande aucun traitement particulier à la caisse, puisqu'un solde sous zéro est
déjà sous tous les prix.

Cette même fonction n'accepte qu'une seule raison de dépenser, `purchase` [une
porte étroite pour une boutique pensée dès le départ pour vendre autre chose que
des glyphes]. Comment un achat reste atomique avec ce qu'il accorde, c'est
:entity[Rien ne change de mains]{ref=bean:pbbls-market}. Pourquoi un glyphe publié cesse d'être
modifiable, c'est :entity[Le dessin que tu ne peux plus corriger]{ref=bean:pbbls-d8}.

## Le remboursement, et qui a le droit de l'appeler

`refund_karma` remet une dépense en place. Elle prend un montant et une
référence, et écrit une ligne positive côté dépense. Ce qu'elle ne fait pas,
c'est chercher l'achat qu'elle annule — elle ne vérifie rien contre un achat
d'origine, hier comme aujourd'hui.

La spec avait déjà écrit qui devait pouvoir l'appeler : une logique serveur ou
admin de confiance, et personne d'autre. La migration qui a livré la fonction l'a
accordée à `authenticated`, c'est-à-dire à tout compte connecté. La migration
suivante, horodatée moins de six minutes plus tard et intitulée « Security fix »,
a retiré ce droit et l'a donné à `service_role`.<!-- src: migrations/20260629193838_wallet_rpcs.sql vs 20260629194418_restrict_refund_karma_to_service_role.sql -->

Son en-tête dit ce qui change et pourquoi : « En l'état, elle ne vérifie rien
contre un achat d'origine : l'accorder à `authenticated` laisse n'importe quel
utilisateur fabriquer du karma via refund_karma(1_000_000, …). Les
remboursements sont émis uniquement par une logique serveur/admin de
confiance. »<!-- src: migrations/20260629194418_restrict_refund_karma_to_service_role.sql, en-tête ; VO : "As written it has no validation against an original purchase, so granting it to `authenticated` lets any user mint karma via refund_karma(1_000_000, …). Refunds are issued by trusted server/admin logic only." -->
Il dit aussi pourquoi le client n'en a jamais eu besoin : un octroi qui échoue
annule la dépense dans la même transaction, donc un achat qui tourne mal n'a plus
rien à défaire depuis l'extérieur.

Le droit d'exécution est toute la sécurité de cette fonction. Et c'est écrit
comme tel, plutôt que supposé.

## Où ça en est

L'économie tourne, et elle se tient. Le karma a cessé d'être un score pour
devenir une monnaie le 29 juin 2026 ; le porte-karma, le marché, la modération et
la curation ont suivi sur le mois, le web d'abord, puis iOS et Android. La
dernière décision notée dans ce coin-là date du 30 juillet 2026 : ce jour-là, les
succès se sont mis à payer du karma par une raison de crédit que le registre
gardait ouverte pour eux — c'est les badges.<!-- src: docs/decisions/log.md 2026-07-30 #664 -->

[TO VERIFY: le slug du bean sur les succès/badges — j'ai mis `pbbls-badges`.]

Depuis fin juillet, rien n'est sorti ici. L'été est parti ailleurs dans le
produit, et l'intention de continuer n'a pas été retirée : la boutique a été
taillée pour un deuxième bien, et la rémunération des créateurs est toujours le
transfert à somme nulle, que le journal décrit comme un point de départ et pas
comme un modèle. Ce que deviennent un glyphe vendu et ses lignes de registre
quand quelqu'un supprime son compte, c'est
la suppression de compte.

Deux choses restent ouvertes, et elles sont nommées comme telles. `spend_karma`
n'accepte qu'une raison : un deuxième type d'achat demandera de modifier ce
garde-fou, pas d'ajouter une ligne. `refund_karma` ne vérifie toujours rien
contre un achat d'origine : le droit `service_role` est la seule chose entre
elle et une planche à karma.
