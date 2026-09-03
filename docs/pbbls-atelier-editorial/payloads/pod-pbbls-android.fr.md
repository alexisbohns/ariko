---
name: L'app Android
description: Kotlin et Jetpack Compose, en miroir de l'architecture iOS — et ce que six jours de portage achètent, ou pas.
pod: pbbls-android
---

Un utilisateur Android est censé avoir une app Android. C'est toute l'intention de
cette surface, et c'était posé comme contrainte avant la première ligne de code :
la vision à long terme, c'est deux apps natives parfaites sur leur plateforme,
sans convergence d'iOS et d'Android vers un seul dépôt de
code.<!-- src: docs/decisions/log.md 2026-07-10 -->

Trois candidats ont été pesés le 10 juillet 2026, deux écartés par écrit.
L'avantage de réutilisation de React Native a été jugé modeste : le travail cher —
rendu SVG sur mesure, canevas de glyphes, animation et sensation haptique — est du
par-plateforme quel que soit le framework. Flutter ajoute un troisième langage
sans rien réutiliser de nulle part. Compose était la seule option sans taxe
d'abstraction sur le travail natif profond, et SwiftUI et Compose sont si proches
que l'app iOS finie devient une référence directement portable pour les agents qui
portent. Les modèles et les requêtes sont réécrits à la main par surface, exprès ;
un pont de types générés est interdit sans nouvelle décision. Le contrat de base
de données est la seule chose que les quatre surfaces partagent.

Le portage est allé d'un module Gradle vide à la parité fonctionnelle en six
jours, du 11 au 17 juillet 2026, à peu près dans l'ordre où on rencontre une app :
l'entonnoir d'entrée, puis un Path qu'on peut seulement lire, puis de quoi y
écrire, puis le profil et les réglages, les âmes, les collections, les photos et
le studio de glyphes, et enfin le Lab.

À mi-parcours, le portage s'est arrêté pour s'auditer. Le 16 juillet, chaque
domaine a été relu fichier par fichier contre la source iOS, et chaque « ça manque
sur Android » a été attaqué par une recherche sur tout l'arbre avant d'entrer dans
le document : douze confirmés, zéro faux. Le verdict : 7 500 à 8 000 lignes de
comportement iOS encore à porter, en gros la moitié arrière de l'app — et une
ligne qui compte plus que le chiffre : rien de tout ça ne demande de travail en
base. Chaque vue, procédure, table, bucket et edge function dont dépendaient les
trous existait déjà, construite pour le web et pour iOS. L'audit a aussi trouvé trois défauts dans du code déjà livré, le plus vif
étant que quelqu'un ayant acheté des glyphes ailleurs ne pouvait pas les accrocher
sur Android. Les jalons qu'il a cadrés ont été exécutés dans les deux jours.<!-- src: docs/superpowers/specs/2026-07-16-android-parity-audit.md -->

Six jours n'achètent pas les finitions. Sur la piste de test interne,
Android se lance encore sous l'icône système par défaut, les illustrations
d'onboarding sont des placeholders, le cairn de la semaine est un dessin fixe là
où iOS l'anime, et il n'y a ni son céramique ni vibration sur le karma. Le point
substantiel, c'est Sign in with Apple : non-objectif annoncé du premier jalon,
jamais revisité depuis. Un compte créé avec Apple sur iPhone ne s'ouvre pas du
tout sur Android.

Là où Android diverge exprès, il le dit. Le dégradé de valence est un seul
artefact dessiné de trois façons — le mesh gradient de SwiftUI n'a aucun
équivalent en Compose, donc Android rééchantillonne les mêmes seize couleurs
prélevées dans un bitmap et l'étire. Ce sont les couleurs qui sont partagées, pas
le dessin, et une quatrième surface devra copier les échantillons plutôt que la
technique. Un morceau de gestion des brouillons, lui, reste volontairement
dupliqué entre deux composeurs Android, sous une règle permanente : on ne
refactorise pas du code existant sans autorisation. Introduire un bug dans un
composeur livré en portant le flow serait pire qu'une deuxième copie connue et
consignée. Alors la dette est écrite et rendue opposable : tant que l'ancien
composeur n'a pas migré, un correctif dans l'une des copies doit atterrir dans les
deux.<!-- src: docs/decisions/log.md 2026-08-24 #725, #729 -->

Dans ce pod : les six jours ; l'audit de parité, et ce que prouve un audit qui
confirme douze trous réels et aucun faux ; et les divergences qu'on garde au lieu
de les fermer.

Android est aussi la seule surface qui a sa chaîne de livraison dans le dépôt.
Chaque push sur la branche principale qui la touche fabrique un bundle signé et le
publie sur la piste de test interne de Google Play. Cette chaîne existe parce que
le mainteneur n'a ni Android Studio ni SDK local ; la même intégration continue
rend les écrans de l'app en images, pour qu'on puisse les regarder.
