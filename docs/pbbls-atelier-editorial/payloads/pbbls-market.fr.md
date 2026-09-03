---
name: Rien ne change de mains
description: Une vente de glyphe dans Pebbles ne déplace pas d'argent, ne crée pas de karma et ne copie aucun dessin. Elle écrit une ligne — et cette ligne, c'est presque tout le design.
date: 2026-09-02
bean: pbbls-market
---

# Rien ne change de mains

Quelqu'un dessine un petit symbole — une vague, une clé, un chat avec une oreille
trop haute — et le propose à la boutique. Des semaines plus tard, quelqu'un d'autre
veut ce symbole sur un souvenir à lui. Il le paie en karma, gagné en enregistrant
des choses qu'il a réellement vécues. Aucun argent ne bouge. Aucun karma n'est
créé. Et le dessin ne part nulle part : un seul jeu de traits, toujours celui du
premier.

Le karma, les badges et la boutique existent pour récompenser l'habitude et la
faire tenir, pas pour enfermer qui que ce soit. Le karma se gagne en enregistrant —
donc en ayant vécu quelque chose d'abord — et se dépense en glyphes qui décorent
des souvenirs faits ailleurs que dans l'app. Le temps passé dans l'app n'est pas la
mesure.<!-- src: case-study spec §4, auteur 2026-09-02 -->

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi ici. Proposition : les
glyphes en vente viennent d'autres pebblers plutôt que d'un jeu maison, pour que
les symboles posés sur les souvenirs de quelqu'un soient dessinés par des gens qui
enregistrent aussi. À accepter, réécrire ou couper à la relecture.]

## Ce qu'écrit un achat

Un achat ne copie pas le glyphe. Il écrit un droit d'usage : une ligne qui nomme
l'acheteur, le glyphe, l'événement de karma qui l'a payé, et le prix à cet
instant-là. La décision tient en une phrase — acheter donne un droit d'usage, pas
une copie — et tout le reste en découle. Une seule source de vérité. Le créateur
garde sa signature. Aucun trait n'est dupliqué nulle part.<!-- src: docs/decisions/log.md 2026-06-30 #496 D1 -->

Cette ligne, aucun client ne peut l'écrire. La table des droits d'usage a une règle
pour lire les siens, et aucune règle d'insertion. La seule voie d'entrée, c'est la
fonction d'achat, qui tourne avec l'autorité de la base
elle-même.<!-- src: migrations/20260630003348_glyph_marketplace.sql -->

Le prix inscrit sur cette ligne est un instantané, pas un renvoi. Le back-office
peut changer le prix d'une annonce plus tard, et le jour où il le fait, chaque
droit d'usage déjà écrit garde le chiffre que son acheteur a vraiment
payé.<!-- src: docs/decisions/log.md 2026-06-30 #496 D4 -->
L'histoire d'un glyphe reste donc lisible après qu'il a augmenté.

Ce qu'un glyphe doit traverser avant d'être achetable — passer la relecture, être
approuvé, rester publié — c'est la modération des glyphes. Et pourquoi le
dessin passe en lecture seule dès qu'il est proposé, c'est
:entity[Le dessin que tu ne peux plus corriger]{ref=bean:pbbls-d8}.

## Le transfert qui ne crée rien

La fonction d'achat, c'est une seule transaction, et elle se déroule dans l'ordre.
Elle lit le prix côté serveur, sur l'annonce approuvée : le client ne le fournit
jamais. Elle refuse ton propre glyphe. Elle refuse un glyphe que tu possèdes déjà.
Elle dépense le karma de l'acheteur par le chemin du portefeuille, là où vit le
garde-fou du découvert (:entity[Un porte-karma sans plancher]{ref=bean:pbbls-wallet}). Puis elle crédite le
propriétaire du glyphe du prix entier, comme une vente, sur le même registre.

L'acheteur descend, le créateur monte, du même montant, dans la même transaction.
Le journal appelle ça un transfert à somme nulle, et la raison tient en une ligne :
la somme nulle garde l'économie fermée.<!-- src: docs/decisions/log.md 2026-07-01 #497 ; VO : "Net-zero keeps the economy closed." -->
Rien, dans le marché, ne fabrique du karma. Le karma se fabrique en enregistrant
quelque chose, et c'est le seul endroit.

L'ordre de ces étapes, c'est ce qui protège l'acheteur. Le karma part en premier ;
le droit d'usage s'écrit en second ; et la table porte une contrainte d'unicité sur
le couple acheteur–glyphe. Donc si deux achats du même glyphe par le même compte
arrivent au même instant, la seconde insertion échoue, et l'échec emporte sa propre
transaction avec lui — la dépense comprise. Textuellement : « un double achat
concurrent annule aussi la dépense du perdant, donc un acheteur est débité au plus
une fois ».<!-- src: migrations/20260630003348_glyph_marketplace.sql, buy_glyph ; VO : "a concurrent double-buy rolls back the loser's spend too, so a buyer is charged at most once" -->
La contrainte qui garde la ligne honnête est la même que celle qui garde le solde
honnête. Pas besoin d'un second mécanisme.

## Une seule colonne porte le créateur

Il n'y a pas de colonne « à créditer », pas de table de bénéficiaires, pas de
notion séparée de la personne qui touche l'argent. La colonne du propriétaire du
glyphe fait tout : dans quelle galerie le glyphe apparaît, à qui la fonction
d'achat te compare quand elle refuse que tu achètes ton propre travail, et où part
le crédit de la vente.<!-- src: docs/decisions/log.md 2026-07-01 #497 -->

C'est pour ça que réattribuer, c'est une seule écriture. Les glyphes maison sont
déposés par le compte admin, donc lui appartiennent, donc le paient. Quand l'un
d'eux est en réalité de quelqu'un, un admin le retrouve par son e-mail, et la
fonction d'attribution fait littéralement une chose : poser cette personne dans la
colonne propriétaire. À partir de là, le glyphe est dans sa galerie, elle ne peut
plus l'acheter, et les ventes la
paient.<!-- src: migrations/20260701102810_glyph_marketplace_curation.sql, admin_attribute_glyph -->
À partir de là, et pas avant : le registre s'écrit en ajout seul, donc une
réattribution change qui la prochaine vente paie, jamais qui la dernière a payé.

C'est aussi de cette colonne qu'un modèle de royalties devrait partir, et le
journal le dit en toutes lettres. Ce travail n'a pas commencé.

## Le chiffre qu'on ne stocke jamais

Un glyphe n'a pas de « valeur ». Pas de colonne, pas de compteur, pas de total mis
en cache. Combien de gens le possèdent, et ce qu'il a rapporté, se calculent à
n'importe quel moment en additionnant les droits d'usage, parce que chaque achat a
gardé son propre prix. La règle est écrite comme telle : la valeur d'un glyphe
reste un agrégat calculé, jamais une colonne
stockée.<!-- src: docs/superpowers/specs/2026-06-30-issue-496-glyph-marketplace-design.md D4 -->

La raison notée au journal n'a rien de glorieux : on capte la donnée, on remet
l'analyse à plus tard. Un compteur
stocké, c'est un chiffre que quelqu'un doit maintenir vrai, à travers chaque
changement de prix, chaque remboursement, chaque suppression, pour toujours. Un
chiffre calculé n'est jamais plus faux que les lignes en dessous, et ces lignes,
ce sont les reçus.

Le coût est réel, et il se voit dans le produit. Le nombre de propriétaires et le
nombre d'usages sont des agrégats qui traversent les comptes, derrière les règles
de sécurité au niveau des lignes : pas donnés à lire depuis un client. Le tiroir du
téléphone qui devrait les afficher est donc sorti avec l'emplacement dessiné et la
valeur remplacée par le mot « Bientôt ». La suite était décrite dans la spec comme
une petite fonction de lecture. Elle n'est jamais
arrivée.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Placeholders -->
L'histoire est tenue fidèlement, et personne ne la lit encore.

[TO VERIFY: la spec prévoit un texte grisé « Soon » et note que le libellé exact
reste un détail visuel à caler pendant l'implémentation. Je n'ai pas vérifié
laquelle des deux chaînes est vraiment sortie.]

## Glisser au lieu de cliquer

Le marché a ouvert sur le web le 30 juin 2026, avec une boîte de confirmation et,
après coup, une pastille « Glyphe débloqué ».<!-- src: apps/web/lib/i18n/messages/fr.json activity.glyphUnlocked -->
C'est aussi sur le web que vit
l'autre moitié du marché : proposer son propre glyphe, et mettre celui d'un autre
en favori. Ni l'un ni l'autre n'est parti sur les téléphones — noté comme reporté
sur iOS, et comme « pas des manques » sur
Android.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Non-goals ; VO : "not gaps" -->

iOS l'a eu le 2 juillet 2026, et sans boîte de dialogue. Toucher un glyphe de la
communauté ouvre un tiroir avec un curseur à faire glisser, dont le retour
haptique monte à mesure qu'il avance ; quand il arrive au bout, le tiroir se
métamorphose sur place, SWAP devient
OWNED.<!-- src: apps/ios/Pebbles/Features/Glyph/Views/GlyphDetailDrawer.swift -->
Android a sorti le même tiroir le 17 juillet, en haptique seul : la moitié sonore
est reportée, son service audio laissé en échafaudage.

Les téléphones disent aussi quelque chose du droit d'usage
lui-même. iOS n'a eu besoin d'aucune migration et d'aucune
nouvelle fonction pour livrer la totalité. Android a repris les requêtes d'iOS
telles quelles. Un achat qui écrit une ligne, avec le prix sur la ligne, c'est un
achat que chaque surface peut faire avec les lectures qu'elle avait
déjà.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Backend -->

## Où ça en est

Le marché tourne, et il se tient. Ça a été construit vite : le portefeuille, le
marché, la modération et la curation sont tous sortis entre le 29 juin et le
31 juillet 2026 — le web d'abord, puis iOS, puis Android. Depuis, rien n'est sorti
dans ce coin-là. L'été est parti ailleurs.

Deux choses annoncées comme les suivantes sont toujours annoncées comme les
suivantes. La boutique a été pensée pour vendre autre chose que des glyphes : les
thèmes et les habillages de galets sont écrits comme des marchandises futures dans
trois specs différentes, et le chemin d'achat a été taillé pour qu'un deuxième bien
le réutilise.<!-- src: #494/#496/#497 non-goals -->
Aucun des deux n'existe. La fonction de dépense n'accepte toujours qu'une seule
raison, `purchase`, donc le deuxième bien commence par modifier ce garde-fou. La
modification est petite, et le garde-fou est là où on irait le chercher.

La rémunération des créateurs, c'est toujours le transfert à plat : une vente, un
paiement, le prix entier, une fois. La question ouverte, c'est de savoir si c'est
la bonne paie pour une chose qui continue de servir après avoir été achetée. Un
glyphe qui finit sur mille galets paie son auteur de la même façon qu'un glyphe qui
finit sur deux. Le journal note les royalties comme un modèle futur, bâti sur la
colonne du propriétaire. C'est la bonne colonne pour partir. Il n'y a pas de date
dessus.
