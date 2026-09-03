---
name: L'app web
description: La surface où une fonctionnalité se dessine en premier, et celle dont tout le reste a été porté.
pod: pbbls-web
---

Une fonctionnalité devient réelle sur le web avant de devenir réelle ailleurs. La
cadence maison est écrite noir sur blanc, et elle est tenue : la migration et les
types régénérés, puis l'implémentation de référence sur le web, puis iOS, puis
Android.<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md §3 -->
C'est à ça que sert cette surface. C'est là qu'on discute une forme tant qu'il
reste bon marché de se tromper, et là que les deux clients natifs reçoivent
quelque chose qui a déjà servi avant d'y passer une semaine.

C'est aussi le Pebbles qu'on atteint en tapant une adresse, sans être ajouté à une
piste de test.
[TO VERIFY: est-ce que www.pbbls.app est ouvert à tout le monde aujourd'hui, ou
derrière une inscription ? Le dépôt nomme le domaine, jamais son accès.]

Le navigateur, c'est aussi là que Pebbles a commencé. Un prototype local-first a
tourné jusqu'au 9 avril 2026, date où le chapitre a été refermé ; le monorepo et
la base sont arrivés deux jours plus tard. L'essentiel de ce qu'est l'app web
aujourd'hui vient de cet héritage-là. Y compris une promesse qu'elle a fini par
arrêter de faire.

La promesse, c'était l'offline. L'app web est une PWA : installable, pensée mobile
d'abord, avec un service worker. Le 29 juillet 2026, l'offline est devenu un
non-objectif explicite sur le web, sur iOS et sur Android, écrit dans le journal
des décisions parce que la question revenait sans arrêt. Le service worker laisse
toutes les requêtes Supabase passer par le réseau, et ça ne bougera pas : un bug
de 401 mis en cache après connexion avait déjà montré ce que ça donne, de mettre
en cache des réponses authentifiées. L'autosave du composeur, c'est une assurance
en cas de crash, sur un seul formulaire ouvert et une seule machine. Pas un moteur
de synchronisation.<!-- src: docs/decisions/log.md 2026-07-29 #620 -->

L'autre chose que cette surface fait et qu'aucune autre ne fait, c'est le Path.
Depuis le 23 août 2026, le Path web est un mur de polaroïds et non plus une pile
de lignes. Et la maçonnerie est distribuée en tourniquet — première carte à
gauche, deuxième à droite, troisième à gauche — plutôt qu'équilibrée en hauteur.
L'équilibrage laisserait une carte courte doubler la file pour boucher un trou, ce
qui veut dire que deux cartes côte à côte cessent d'être voisines dans le temps.
Sur un Path, dont toute la prémisse est la chronologie, c'est un bug de
correction déguisé en bord inférieur plus propre. Le code nomme le prix qu'il
accepte : un bord du bas en dents de scie, ça se lit comme un mur ; une frise
chronologique dans le désordre, ça se lit comme un
bug.<!-- src: docs/decisions/log.md 2026-08-23 #720 ; apps/web/lib/utils/path-layout.ts -->

Le mur a été dessiné sur une page de fixtures non authentifiée plutôt que sur le
vrai Path, pour que la décision se prenne en regardant plutôt qu'en argumentant.

Conséquence : les trois clients ne se ressemblent plus, et c'est un choix, pas une
régression. Rien n'a bougé dans le schéma ni dans les procédures ; iOS et Android
affichent toujours des lignes, et refléter le mur chez eux est un chantier de
suite, pas une réparation.

Dans ce pod : la coquille — la PWA, son service worker, et l'offline posé comme
non-objectif avec le bug de 401 qui a tranché. Le mur de polaroïds, et pourquoi la
maçonnerie se distribue au lieu de s'équilibrer. Et le vieux moteur de rendu côté
client qu'une spec d'avril annonçait supprimé et qui ne l'a jamais été : il sert
de repli pour les galets dessinés avant l'existence du moteur serveur, et pour les
galets d'exemple de la page d'accueil, où personne n'est connecté et où rien n'a
encore été composé.

Une dernière chose vraie sur cette surface : c'est la silencieuse. iOS et Android
vibrent à chaque tap du flow d'enregistrement ; le navigateur n'a pas de vibration
sur laquelle compter, alors le web déroule les mêmes onze étapes sans rien dans la
main.

Le journal du produit compte 65 pull requests livrées marquées web, entre le
11 avril et le 30 juillet 2026. L'app se déploie sur Vercel à chaque push, et n'a
aucun workflow d'intégration continue à elle.
