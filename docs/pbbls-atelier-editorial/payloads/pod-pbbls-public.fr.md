---
name: Se connecter et partager
description: Comment un journal intime s'est fait un visage public sans devenir un réseau social — lien ou QR, rien d'autre, et une architecture bâtie pour que ça reste vrai.
pod: pbbls-public
---

Tu as un souvenir que tu veux montrer à une personne. L'amie qui était là, ce
jour-là. Pas à tout le monde. C'est à ça que sert ce territoire : tendre une
seule chose à une seule personne, et — si tu le veux — une page qui montre ce que
tu gardes à qui tu as donné le lien. Ce qu'il est construit pour empêcher, c'est
tout le reste. Être trouvé. Être suivi. Être compté.

Le refus est arrivé avant, et il est remarquablement bien daté. Le 28 juillet
2026, avant qu'aucune de ces fonctionnalités n'ait de document de conception, la
feuille de route vers les stores listait quatre décisions produit. La quatrième :
« Découverte des connexions — lien d'invitation ou QR uniquement. Pas de
recherche, pas d'annuaire, pas de graphes d'abonnés. Connexions symétriques
seulement : accepter une invitation, *c'est* le consentement
mutuel. »<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md:10 -->
Tout ce qui a été construit ensuite ne fait qu'appliquer une phrase écrite avant
qu'il existe la moindre ligne de code pour la discuter.

C'est aussi ici que la promesse d'avril est tenue. « Aucun fil à faire défiler »,
c'est absolu : pas de fil, pas d'annuaire, pas de recherche, pas de graphe
d'abonnés. Il n'existe aucun écran où tu tapes un nom et où tu trouves quelqu'un.
Aucune liste des gens que quelqu'un d'autre connaît. La seule entrée, c'est un
lien qu'on t'a tendu ou un code que tu as scanné sur le téléphone d'en
face.<!-- src: spec case-study §4, auteur 2026-09-02 -->

L'architecture en dessous dit la même chose, en plus terne. Tout ce qui passe
d'une personne à une autre traverse une fonction qui construit la liste explicite
de ce qui a le droit de sortir — un nom affiché, les traits du glyphe qui te sert
de marque — plutôt qu'une table ouverte juste assez large pour être pratique. La
raison est écrite : une liste explicite se relit en un seul endroit, alors qu'une
table élargie enrôle en silence chaque colonne qu'on lui ajoutera
plus tard.<!-- src: docs/decisions/log.md 2026-07-30 #654 -->

Ce réflexe n'est pas venu tout seul. Cette moitié du produit s'est construite en
même temps qu'un audit de sécurité et de qualité délibéré, dessiné avec Arkaik et
cadré sur la couche de données et sur le contrat client. C'est de là que viennent
les grades de confidentialité, la règle de projection ci-dessus, les colonnes de
capacité épinglées par un déclencheur — posséder une ligne ne donne pas le droit
d'y augmenter ses pouvoirs — et une série de harnais de contrat qui créent de
vrais comptes sur le vrai projet, devenus depuis une condition de fusion. De la
preuve plutôt que de la simulation, et une structure plutôt qu'une bonne
mémoire — les vérifications survivent à celui qui aurait dû penser à les
lancer.<!-- src: spec case-study §8 ; docs/decisions/log.md 2026-09-02 #741 -->

Le texte écrit, c'est :entity[La connexion que tu ne peux pas chercher]{ref=bean:pbbls-connections} — une ligne pour deux
personnes, lien ou QR uniquement, et le blocage présent dès le premier jour,
silencieux par construction : un blocage qui s'annonce est un message.

Le reste est nommé, pas encore écrit. Les identifiants et les profils publics :
en minuscules, réclamables, et libérés dès qu'un compte disparaît, sans
historique ni redirection, parce qu'un identifiant est un pointeur et pas une
archive. Les liens de partage : ce qu'un galet public expose, c'est la ligne et
son dessin cuit, rien d'autre — ni cartes, ni âmes, ni photos. Les grades de
confidentialité : trois, secret, connexions, public, avec tous les galets
antérieurs réécrits en secret d'un seul balayage plutôt que laissés hériter d'un
sens que personne n'avait choisi pour eux. Et la suppression de compte et le
consentement : le consentement gardé comme preuve et pas comme une case cochée,
et une suppression qui laisse aux autres pebblers les glyphes qu'ils ont achetés,
sans ton nom dessus.

Où ça en est. Les connexions sont sorties le 30 juillet 2026 sur web, iOS et
Android ; les grades et la page de partage ont suivi le 17 août. Une chose reste
ouverte et mérite d'être dite ici plutôt que sous-entendue : un profil public
affiche tes anneaux et ton rang de régularité, et c'est la moitié compliquée de
la promesse d'avril. Le mécanisme existait en avril. Ce que juillet lui a donné,
c'est un public.

La question ouverte est plus petite et plus concrète. Un blocage ne se défait pas
depuis l'app : l'écran qui les gère est reporté, et tant qu'il n'existe pas, un
blocage accidentel est une porte qui se ferme de l'extérieur.
