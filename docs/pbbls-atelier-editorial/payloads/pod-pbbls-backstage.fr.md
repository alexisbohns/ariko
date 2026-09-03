---
name: Les coulisses
description: La surface privée où vivent la direction artistique du produit, sa file de modération, et tout ce qu'il sait de lui-même.
pod: pbbls-backstage
---

Une partie de ce dont Pebbles est fait ne peut pas se décider en code, parce que
c'est du goût et du jugement. Dans quelles cinq nuances se dessine une famille de
sentiments. Quel emoji tient pour une émotion. Si le dessin qu'un inconnu a
proposé a le droit d'entrer en boutique, et à quel prix. Ce que vaut un badge.
Les coulisses, c'est la pièce où une personne tranche tout ça. Et le seul endroit
d'où le produit parle aux gens qui l'utilisent.

C'est une deuxième app web, pas une section de la première, et la raison tient à
la plateforme, pas au rangement. L'app grand public est une PWA : service worker,
manifeste, invitation à installer. Le travail d'admin est le contraire de chacune
de ces hypothèses — toujours en ligne, jamais installé, un seul compte de
confiance. Les mélanger, c'est se battre contre la plateforme. Un sous-domaine
séparé donne en plus une frontière propre côté cookies : une session grand public
ne peut pas ouvrir l'admin. La séparation date d'avril 2026, au moment désigné
comme le moins cher qu'elle serait
jamais.<!-- src: docs/superpowers/specs/2026-04-26-back-office-app-design.md -->

La page d'analytics répond à ce que le produit fait vraiment : combien de gens se
sont inscrits, combien sont là aujourd'hui, cette semaine, ce mois-ci, combien de
galets par jour, une courbe d'utilisateurs actifs, et une carte de chaleur de
rétention par cohorte hebdomadaire. Chaque chiffre passe par des fonctions
réservées aux admins, et les vues qui les alimentent sont révoquées aux rôles
anonyme et connecté. Cette page est la seule porte.

La proposition d'origine voulait douze surfaces sur douze vues matérialisées
rafraîchies chaque nuit. Ce qui est sorti, c'est une bande de six cartes et un
graphique, sur des requêtes ordinaires, avec des signatures de fonctions taillées
pour que basculer plus tard sur une vue matérialisée tienne en une ligne. Au
2 septembre 2026, il n'y a toujours aucune vue matérialisée ni aucun
rafraîchissement planifié dans la base. Le volume ne les a pas réclamées.

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi le produit se mesure,
et ça mérite d'être juste, vu la position affichée : le temps passé dans l'app
n'est pas la mesure. Proposition : les chiffres existent pour dire si les gens
reviennent, pas pour être maximisés. À accepter, réécrire ou couper à la
relecture.]

La modération des glyphes, c'est une file. Des soumissions filtrées par état, une
prévisualisation, une approbation vers le marché avec un prix qu'on peut forcer,
ou un refus avec une raison écrite, stockée et montrée à celui qui a dessiné. Cette
raison est le seul canal de retour que le marché ait vers un créateur, et il ne
s'ouvre que sur un refus.

La file a aussi produit la plus nette petite illustration de la façon dont ce code
traite ses propres règles. Un admin ne pouvait pas lire les traits d'une
soumission en attente, parce que la règle de lecture du marché ne le permet pas —
et personne n'a voulu élargir une règle dont tous les clients dépendent pour
arranger un écran. Ce qui est sorti à la place, c'est une seule fonction de
lecture, avec son propre contrôle admin. Le verrou qui rend cette règle si étroite,
c'est :entity[Le dessin que tu ne peux plus corriger]{ref=bean:pbbls-d8}.

À côté de la file, il y a les éditeurs de ce qui relève de la direction artistique
plutôt que de la donnée. Chaque catégorie d'émotion porte cinq couleurs réglées à
la main ; la teinte de fond n'en fait pas partie, parce qu'elle est re-dérivée de
la couleur primaire à chaque sauvegarde, au lieu d'être une chose qu'on peut rater
de peu. Les émotions ont leur emoji, les domaines de vie leur nom et leur glyphe,
les achievements leur récompense en karma. Avant ces éditeurs, ces lignes se
tapaient à la main dans une console de base de
données.<!-- src: docs/superpowers/specs/2026-05-06-emotion-categories-palettes-design.md -->

Le Lab est la partie des coulisses dont les gens voient la sortie : le changelog
et les annonces dans l'app, rangés sous « actus et communauté ». Écrire une entrée
commence par un copier-coller. Cliquer sur « New log » lit le presse-papier
pendant le clic lui-même, et si ce qu'il y a dessus est le petit bloc qu'un agent
a écrit dans une pull request, le formulaire s'ouvre déjà rempli. Rien ne se
publie tout seul : le bloc est une proposition, et écrire dans cette table depuis
la boucle de dev est formellement interdit.

Dans ce pod : les analytics, la file de modération, et le Lab.

Les coulisses sont absentes de
la carte du produit, exprès. La carte modélise web, iOS et Android ; l'admin ne
pourrait être rangé que sous « web » — et une pull request purement admin
marquerait alors l'app web grand public comme livrée. Ne pas la relier garde ce
signal honnête. Ajouter le lien plus tard tient en une requête, et la décision
interdit explicitement de le faire par
confort.<!-- src: docs/decisions/log.md 2026-07-28 #622 -->
