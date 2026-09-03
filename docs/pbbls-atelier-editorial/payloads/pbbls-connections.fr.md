---
name: La connexion que tu ne peux pas chercher
description: En juillet 2026, Pebbles a appris à laisser deux personnes se voir — et presque chaque décision de cette fonctionnalité dit ce qu'elle refuse de devenir.
date: 2026-09-02
bean: pbbls-connections
---

# La connexion que tu ne peux pas chercher

Tu as un galet que tu veux montrer à une personne. Pas à tout le monde. Une
personne — l'amie qui était là, ce jour-là. Jusqu'à fin juillet 2026, Pebbles ne
savait pas faire ça du tout. Chaque table de la base était fermée sur un seul
compte, et un journal qui n'avait jamais laissé deux personnes se croiser ne
savait pas les présenter.

Le difficile, ce n'était pas le schéma. C'était de décider jusqu'où « laisser les
gens se voir » avait le droit d'aller.
L'onboarding est sorti en avril 2026 avec une promesse : « Aucune série à
entretenir, aucun fil à faire défiler. »<!-- src: apps/web/lib/i18n/messages/fr.json onboarding, depuis PR #100 2026-04-04 -->
La seconde moitié est tenue, absolument. Pas de fil, pas d'annuaire, pas de
recherche, pas de graphe d'abonnés. Les connexions existent pour tendre un
souvenir à quelqu'un, pas pour collectionner des gens.<!-- src: spec case-study §4, auteur 2026-09-02 -->

## La décision est arrivée avant le code

Le 28 juillet 2026, la feuille de route vers les stores liste quatre décisions
produit prises avant qu'aucun des chantiers en dessous n'ait de document de
conception. La quatrième : « Découverte des connexions — lien d'invitation ou QR
uniquement. Pas de recherche, pas d'annuaire, pas de graphes d'abonnés.
Connexions symétriques seulement : accepter une invitation, *c'est* le
consentement mutuel. »<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md:10 ; VO : "Connection discovery — invite link / QR only. No search, no directory, no follower graphs. Symmetric connections only: accepting an invite *is* the mutual consent." -->

C'est un produit qui écrit ce qu'il refuse de devenir, avant qu'il existe la
moindre ligne de code pour discuter. Tout ce qui suit n'est que de
l'application.

Il n'existe aucun écran où tu tapes un nom et où tu trouves quelqu'un. Aucune
liste des gens que quelqu'un d'autre connaît. La seule entrée, c'est un lien
qu'on t'a donné ou un code que tu as scanné sur le téléphone d'en face. Le
document de conception ne discute même pas d'élargir la table des profils — le
premier pas évident vers un annuaire : la règle « propriétaire seulement » est là
depuis le premier schéma, et lui ajouter une politique « colonnes d'affichage
uniquement » est « interdit, point ».<!-- src: 2026-07-29-mutual-connections-design.md D4 ; VO : "banned outright" -->

Du coup, tout ce qui traverse d'un utilisateur à l'autre passe par une fonction
qui construit sa propre liste explicite de ce qui a le droit de sortir : un nom
affiché, et les traits du glyphe qui sert de marque à quelqu'un. Jamais une ligne
de profil. L'écran d'acceptation le dit en une phrase avant que tu tapes :
« Les connexions voient leurs noms et leurs glyphes. Rien de plus. »<!-- src: apps/web/lib/i18n/messages/fr.json connections.acceptSubtitle -->
Les pseudos et les pages publiques, c'est une autre question, et elle vit dans
les pseudos et les profils publics.

Le jeton d'invitation, c'est 32 octets tirés au hasard. Rien n'est énumérable
là-dedans, et c'est ce qui fait du refus de la recherche une vraie frontière,
pas une fonctionnalité manquante qu'un script contournerait.<!-- src: mutual-connections-design.md D2, D4 -->

## Une seule ligne, pas deux moitiés qui peuvent se contredire

Une connexion, c'est une ligne unique qui porte les deux personnes, avec les deux
identifiants rangés dans un ordre fixe et une contrainte d'unicité sur la paire.
Pas de colonne d'état dessus. Accepter l'invitation, *c'est* le consentement
mutuel, et la table des invitations, c'est l'état en attente.<!-- src: docs/decisions/log.md 2026-07-30 #658 ; VO : "accepting the invite *is* the mutual consent, and the invite table is the pending state" -->

Deux lignes en miroir — une par direction — c'était l'alternative évidente, et
elle a été écartée parce que ça fait deux choses qui peuvent se contredire. Ça
transforme le nombre de lignes en invariant à surveiller, et la lecture, le
retrait et la purge en comptabilité en partie double. Une paire ordonnée avec une
insertion qui ignore les doublons donne l'idempotence structurellement, gratis.<!-- src: mutual-connections-design.md D1 -->

Ça compte, parce que ça correspond à l'usage réel. L'invitation est réutilisable
et vit sept jours, parce que l'image dans le document de conception, c'est un QR
code sur un téléphone à une table de dîner : les re-scans, les double-taps et les
réessais réseau sont le cas *normal*, pas le cas limite. Donc accepter une
invitation déjà acceptée réussit et répond que vous êtes déjà connectés, au lieu
de lever une erreur que trois clients devraient chacun traiter à part. Et rouvrir
ton écran d'invitation te rend celle que tu as déjà, au lieu d'en fabriquer une
neuve : le lien collé dans une conversation hier ne meurt pas parce que tu as
regardé l'écran aujourd'hui.<!-- src: mutual-connections-design.md D3, D5 -->

## Le blocage, dès le premier jour

Le blocage est sorti avec la fonctionnalité, pas après. La raison immédiate est
extérieure : les règles d'Apple l'exigent au lancement pour tout ce qui laisse
des gens produire du contenu les uns pour les autres. La forme qu'il a prise, en
revanche, ne vient pas de là.<!-- src: docs/decisions/log.md 2026-07-30 #658, contexte -->

Un blocage, c'est une ligne dirigée : celui qui retire bloque celui qui est
retiré. Les alternatives sont notées et refusées. Une double ligne symétrique ne
dit rien que la ligne unique ne dise déjà. Et révoquer automatiquement
l'invitation de celui qui bloque a été écarté d'une phrase qui vaut d'être
gardée : ça « punit les N autres convives pour un seul importun ».<!-- src: mutual-connections-design.md D6 ; VO : "punishes the other N dinner guests for one bad actor" -->

Puis la vérification de blocage elle-même. Quand quelqu'un accepte une
invitation, elle est faite dans les deux sens, et là où elle trouve un
blocage, elle lève `invite_expired` — exactement l'erreur que rend un lien
réellement mort. La ligne de blocage, elle, n'est lisible que par la personne
qui l'a créée : la session du compte bloqué ne peut pas voir qu'elle existe.<!-- src: migrations/20260730070347_mutual_connections.sql, politique connection_blocks_select et chemin d'acceptation -->
La note interne dit que c'est délibérément impossible à distinguer d'une vraie
expiration, pour qu'un blocage ne soit jamais révélé à aucune des deux
personnes.<!-- src: mutual-connections-design.md D5 ; VO : "deliberately indistinguishable from real expiry so a block is never revealed to either party" -->

Les deux sens, pour une raison simple : un blocage dit qu'une des deux personnes
ne veut plus de relation, et ne vérifier qu'un sens laisserait celui qui bloque
se reconnecter en scannant l'invitation de celui qu'il a bloqué. Et ça défend
rétroactivement l'invitation encore vivante de celui qui a bloqué, sans toucher à
l'invitation : la personne bloquée qui scanne ce même QR obtient un lien expiré,
pendant que tout le reste de la table continue de s'en servir.

La migration écrit sa propre limite juste à côté de la ligne qui masque : l'aperçu
de l'invitation ignore les blocages, par conception, et les tiers continuent de
réussir sur le même jeton — donc quelqu'un qui compare un aperçu valide à une
acceptation expirée peut le déduire. C'est noté comme accepté, dans le
commentaire au-dessus de la vérification.<!-- src: migrations/20260730070347_mutual_connections.sql, commentaire du chemin d'acceptation -->

## Ce que les refus coûtent

Chaque refus ici coûte quelque chose.

Pas de recherche, donc tu ne peux pas retrouver un ami qui est déjà sur Pebbles.
Il faut que quelqu'un te tende quelque chose.

Pas de notifications, donc rien ne te dit qu'une connexion a été acceptée : elle
est simplement là la prochaine fois que tu ouvres l'app. Il n'y a aucune
infrastructure de push dans le produit, et pas de temps réel non plus — c'est
donc autant une pratique de la maison qu'un choix fait ici.<!-- src: roadmap :28, :91 ; contraintes maison §2 -->

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi ici. Proposition :
une connexion acceptée qui apparaît tranquillement à la prochaine ouverture,
plutôt qu'en alerte, c'est le même refus que le fil absent, appliqué à une
surface plus petite. À accepter, réécrire ou couper à la relecture.]

Un blocage ne se défait pas depuis l'app. L'écran qui gère les blocages a été
repoussé à un chantier ultérieur, et tant qu'il n'existe pas, un blocage
accidentel ne se répare qu'en supprimant la ligne avec une clé d'opérateur.
L'entrée du journal des décisions le dit dans ses propres conséquences.<!-- src: docs/decisions/log.md 2026-07-30 #658, conséquences -->

Et se connecter ne rapporte rien. La liste des raisons autorisées dans le
registre de karma n'en a aucune pour ça : une insertion accidentelle échouerait
sur la contrainte au lieu de payer. Le raisonnement tient en une ligne — les
mécaniques de graphe social ne doivent pas être farmables en karma, parce qu'une
boucle connexion/déconnexion serait sinon une planche à billets.<!-- src: mutual-connections-design.md D9 ; VO : "Social-graph mechanics must not be karma-farmable (a connect/disconnect loop would otherwise be a mint)" -->

## Où ça en est

Les connexions ont été conçues le 29 juillet 2026 et livrées le 30 — les tables
et leurs fonctions, l'écran d'invitation avec son lien et son QR code, la page
d'acceptation, et la liste avec retrait et blocage — sur le web, sur iOS et sur
Android.<!-- src: journal PR #662, 2026-07-30 ; migrations/20260730070347_mutual_connections.sql -->
Ce que promet le texte affiché, c'est ce que la base fait respecter : deux
personnes voient leurs noms et leurs glyphes, et elles les voient uniquement
parce que toutes les deux ont tapé « accepter ».

Le 17 août, une connexion a cessé d'être seulement un nom dans une liste : un
galet gradé pour les connexions apparaît sur sa page. Ce grade, et l'affaire
distincte du lien qui s'ouvre pour n'importe qui, appartiennent à
les grades de confidentialité et les liens de partage.

La question ouverte, c'est le blocage que tu ne voulais pas faire. Tout le reste
ici a un chemin de retour : tu retires quelqu'un, une nouvelle invitation vous
reconnecte ; tu laisses un lien expirer, tu en fais un autre. Le blocage est la
seule porte qui se ferme de l'extérieur, et l'écran qui la rouvre n'est pas
encore construit.
