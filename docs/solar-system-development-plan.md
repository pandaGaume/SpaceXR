# Plan de développement du runtime solaire SpaceXR

État local examiné le 6 novembre 2026. Cible : un dépôt `spacexr-explorer`, permettant de partir du terrain terrestre en 3D Tiles, traverser l'atmosphère, rejoindre la Lune et y naviguer sans recréer le moteur ni la scène. Un dépôt `spacexr-mission-control` porte les missions et l'orchestration IA. Ce document prépare leur réalisation, il ne constitue pas encore une application exécutable.

Le [découpage Explorer et Mission Control](explorer-mission-control-architecture.md) définit les responsabilités et le workspace commun. La [mission Shackleton](lunar-site-explorer-mission.md) constitue le premier parcours agentique proposé, avec ses propres prérequis et livraisons.

Mission Control reprend la [base gouvernée de co2-scrubber-governed-agent](mission-control-governed-agent-audit.md). Le viewer Explorer est un slot supplémentaire de ce système ; le portage ne recrée pas une boucle d'agent ni un orchestrateur de mission parallèle. L'orchestrateur de monde décrit ci-dessous reste strictement le runtime de rendu, des corps et du streaming dans Explorer.

La direction produit est décrite dans [SpaceXR et le voyage du Babylon](babylon-exploration-experience.md). Le Babylon est le vaisseau explorateur du livre de l'auteur. L'application permet de suivre son voyage, de s'en écarter pour explorer et de le retrouver. Les livraisons doivent donc apporter des lieux retrouvables et partageables, un parcours continu, puis des découvertes et des étapes narratives.

## 1. Conclusion de l'audit

Les briques astronomiques, le streaming et le terrain existent séparément. La Lune dispose déjà d'un chemin de rendu global sur cube, avec DEM et imagerie. Le travail principal est leur composition dans un monde à plusieurs corps mobiles : repères, caméra, précision, éclairage et allocation des ressources.

Le premier socle doit permettre de garder et rouvrir une vue datée. La première expérience complète doit ensuite prouver le trajet Terre vers Lune à une date fixée, une exploration au sol et le retour au Babylon, puis le même parcours avec le temps animé. L'atmosphère physique détaillée vient ensuite, mais son contrat d'intégration doit être prévu dès le départ.

« Un seul runtime » signifie ici un moteur Babylon, une scène, une horloge et un orchestrateur de monde, avec des budgets globaux. Le code existant peut employer plusieurs instances de `TileRuntime` pour les corps et les couches. Une unique instance de `TileRuntime` contenant tous les corps serait une exigence supplémentaire et nécessiterait une adaptation plus profonde.

## 2. Ce qui existe aujourd'hui

Les chemins ci-dessous sont relatifs au répertoire local `C:/Users/GuillaumePelletier/Documents/GitHub/Gaume`, sauf indication contraire. « Disponible » indique du code et des exemples présents, pas une validation graphique complète de cette nouvelle intégration.

| Brique | Disponible | Travail restant pour cette application |
| --- | --- | --- |
| `celestial-core`, `@spacexr/celestial-core` | Catalogue, positions héliocentriques en mètres dans l'écliptique J2000, modèles de rotation, Soleil, Terre et Lune, géométrie du disque apparent et irradiance relative | Horloge applicative, transformation complète des repères fixes des corps, raccordement aux objets Babylon et aux tuiles |
| `3d-tiles-core/node/packages/core` | Contrats, codecs et validation 3D Tiles | Déclarations des couches de l'application et fixtures d'intégration |
| `3d-tiles-core/node/packages/runtime` | Traversée, SSE, streaming, annulation, caches, tuilage implicite, ports de métrique spatiale et de présentation | Coordination de plusieurs corps, invalidation lorsque le temps change, budgets globaux |
| `tiles`, `raster`, `dem`, `grid` | Adressage et voisinage cubiques, surfaces de référence, sources célestes, rasters, DEM et grilles | Jeux de données choisis, cohérence des références et couverture terrestre globale |
| `3d-tiles-babylon` | Babylon 9, scène directe, rendu des grands mondes, glTF, drapage, terrain CPU et GPU, statistiques, création de moteurs WebGL et WebGPU | Placement de corps mobiles et adaptation caméra/présentation hors d'un ECEF unique |
| Exemple `babylon-implicit-grid-mapzen` | Terre avec Mapzen ; Lune synthétique globale ; Lune depuis un tile service ; caméra orbitale ; terrain GPU cubique ; continuité des bords et couverture grossière | Terre et Lune simultanées, Soleil astronomique, navigation intercorps et interface de date |
| Exemple `babylon-google-3d-tiles` | Assemblage de tuiles photoréalistes Google | Connexion dans le monde commun, clé API, comportement en orbite et complément de couverture |
| `spacexr-atmosphere` | Modèles numériques indépendants du moteur, couches et diffusion spectrale ; laboratoire WebGPU et shaders | Adaptateur Babylon, profondeur du terrain, composition atmosphère/surface/Soleil, mise à jour interactive |
| SpaceGX sur `F:/surface/source/repos/SpaceGX` | Shaders étoile, planète et atmosphère ; textures solaires et lunaires | Portage Babylon 9, précision, HDR, LOD solaire, couronne et occultation |

Révisions locales observées : `celestial-core` : `86673b1` ; `3d-tiles-core` : `72f0890` ; `3d-tiles-babylon` : `a080a35` ; `spacexr-atmosphere` : `292ea06`. Certaines copies ont des modifications locales : les dépendances devront être figées sur un état identifié, pas seulement sur un nom de branche.

### Limites astronomiques

`celestial-core` est un modèle géométrique approché, avec intervalle annoncé 1800 à 2050. Les entrées `Date` utilisent UTC comme approximation du temps dynamique. Le modèle lunaire est court, les rotations sont linéaires, les librations détaillées ne sont pas intégrées. Cela convient au premier démonstrateur ; une précision de navigation scientifique ou d'éclipses devra être définie et validée séparément.

Le centre terrestre est corrigé par rapport au barycentre Terre-Lune. Il faut préserver ce comportement et éviter de réintroduire les anciennes éphémérides du monorepo SpaceXR, qui utilisent notamment des kilomètres.

L'audit complémentaire de rotation a identifié un prérequis : fournir une transformation complète du repère fixe du corps vers J2000 et valider les méridiens. Le getter `obliquity` mesure l'angle du pôle initial avec le nord de l'écliptique J2000, pas une obliquité orbitale générale à la date. Le modèle lunaire constant omet les termes périodiques d'orientation. Ces limites doivent être traitées avant de promettre des observations fines d'illumination au sol.

Vérification ponctuelle exécutée sur le `dist` local : 29 états résolus à trois dates, Soleil/Terre/Lune présents, positions en mètres ; distances Terre-Lune de 399 774 km au 1er janvier 2000 à 12 h UTC, 385 105 km au 6 novembre 2026 à 12 h UTC et 405 730 km au 1er juin 2030 à 0 h UTC. Ce contrôle de cohérence ne mesure pas l'erreur face à une éphéméride de référence. Les suites complètes des dépendances et les exemples graphiques n'ont pas été relancés lors de cet audit.

### SpaceGX retrouvé sur F

La copie pertinente est `F:/surface/source/repos/SpaceGX`, différente de celles de `F:/sources/SpaceGX` et de `Gaume/SpaceGX`.

- `src/Babylon/Space/Shaders/star.vertex.fx` et `star.fragment.fx` : surface stellaire texturée, modulée par `starColor`.
- `planet.vertex.fx` et `planet.fragment.fx` : piste de portage du matériau planétaire.
- `atmosphereFromSpace.vertex.fx`, `atmosphereFromSpace.fragment.fx` et les includes : référence historique d'atmosphère vue de l'espace.
- `Images/Space/Stars/sun/2k/sun_map.jpg` et `Images/Space/Stars/Flare.png` : assets à inventorier et attribuer avant réutilisation.

Le fragment d'étoile borne actuellement sa couleur entre 0 et 1. Il faudra l'adapter au pipeline HDR. Le montage complet de la couronne et des lens flares de `moon.jpg` n'a pas été identifié dans les sources examinées. La présence du shader ne prouve pas que cet effet complet soit déjà réutilisable.

## 3. Architecture cible

```text
Application et interface de date
               |
        SolarSystemRuntime
        /       |        \
 Horloge    Corps/repères   Budget global
     |          |               |
 celestial-core |       Couches de chaque corps
                |       terrain / imagerie / glTF
                |               |
                |        3d-tiles-runtime
                |               |
                +----- Adaptation Babylon
                               |
                    Une scène, une caméra active
                    Soleil et atmosphère composés
```

### Repères et précision

Conserver les états astronomiques en double précision CPU, en mètres, dans le repère héliocentrique J2000. Chaque corps possède un repère fixe : ECEF pour la Terre et un repère lunaire explicitement déclaré pour la Lune. Son orientation doit inclure la convention du méridien origine, pas seulement aligner un axe nord puis ajouter un angle arbitraire.

Pour un point local `p`, la position commune est `P_corps(t) + R_corps(t) * p`. La caméra est transformée par l'inverse de cette pose pour calculer le LOD, l'horizon et le picking dans le repère de chaque corps. Les plans du frustum doivent subir la transformation correspondante.

Le GPU reçoit des positions relatives à la caméra, calculées après soustraction en double précision. Le moteur GPU actuel place déjà ses tuiles relativement à la caméra ; le portage doit préserver cette précision lors de la rotation et de la translation intercorps. Ajouter simplement un parent Babylon à une grille dont le shader reconstruit des positions ECEF ne suffit pas.

Babylon fournit déjà le rendu relatif à la caméra, mais cela ne résout pas à lui seul la précision de profondeur entre un terrain proche et le Soleil. Définir une politique near/far par situation et tester le tampon de profondeur. Si plusieurs passes de profondeur sont nécessaires, elles restent dans le même moteur et le même orchestrateur. Voir la [documentation Babylon sur les grands mondes](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/scene/large_world.md).

### Respect des contrats 3D Tiles

Conserver les tilesets dans leur repère source. Le placement dynamique d'un corps appartient à une couche d'exécution, sans modifier les documents sérialisés à chaque frame.

Une `boundingVolume.region` ne suit pas `tile.transform`. Il faut donc appliquer le placement du corps après l'interprétation locale de la région, ou transformer la caméra dans le repère du corps. Un simple déplacement du mesh ferait diverger rendu, culling et SSE. Cette règle figure dans la [spécification OGC 3D Tiles](https://portal.ogc.org/files/18-053r2) et dans `runtime/src/spatial/ecef.ts`.

L'horizon doit être évalué par corps. L'occlusion éventuelle d'un corps par un autre est un test distinct. Les caches utilisent des identifiants comprenant le corps, la couche et la révision du dataset.

### Streaming commun

Réutiliser les instances de `TileRuntime` et leurs ports. Ajouter un orchestrateur pour les priorités de corps, les quotas de requêtes, la mémoire CPU/GPU et le préchargement d'approche. Un budget donné séparément à chaque runtime ne forme pas un budget global.

Le changement de date doit réévaluer les poses, les directions solaires, les caméras locales et les sélections, même si la caméra Babylon ne bouge pas. Le driver actuel, piloté principalement par les changements de caméra et les chargements, doit recevoir cette invalidation.

### Données terrestres et lunaires

Reprendre le terrain lunaire cubique existant, pas une nouvelle implémentation de voisinage ou de jonctions. Valider le descripteur du dataset, son rayon de référence, son repère, les unités des hauteurs et son niveau réellement disponible. Ne pas confondre raffinement de grille et ajout de détail mesuré.

La Terre Web Mercator actuelle s'arrête vers 85 degrés de latitude. Pour une Terre vue depuis l'espace, ajouter une couverture globale, puis intégrer les couches détaillées avec leur projection et leur domaine. Les données photoréalistes peuvent compléter ce fond ; leur disponibilité et leur aspect sous un éclairage animé doivent être évalués, car une texture peut déjà contenir des ombres.

Le dépôt `spacexr-tile-service` existe et le client lunaire sait consommer ses descripteurs. La disponibilité du service, des datasets et de leurs niveaux n'a pas été vérifiée en réseau pendant cet audit.

## 4. Soleil et éclairage

Un `SolarSource` commun fournit la position, la direction vers le Soleil depuis chaque corps, la distance, le rayon angulaire et l'irradiance relative. Le disque rendu, l'éclairage des surfaces et l'atmosphère consomment cet état. Le LOD du rendu solaire ne doit pas modifier l'éclairage.

Trois représentations, sélectionnées d'après la taille projetée et avec hystérésis :

1. À grande distance : disque analytique dans un quad, au rayon angulaire réel, avec anticrénelage. Le rayon provient de `apparentAngularRadius`.
2. À taille intermédiaire : disque enrichi par texture ou bruit filtré, plus une couronne indépendante.
3. À proximité : sphère avec shader de photosphère, animation et détail accru. Les déplacements jusqu'à cette zone sont une extension après le trajet Terre-Lune.

Le premier portage de SpaceGX peut fournir l'aspect texturé. Le rendu doit rester HDR jusqu'à l'exposition et au tone mapping. Le shader terrain GPU actuel termine par un `clamp(albedo * light, 0, 1)` : prévoir son évolution pour que l'exposition des surfaces et celle du Soleil restent cohérentes.

Le moteur terrain récupère actuellement la première lumière directionnelle et la première lumière hémisphérique de la scène. Le monde à plusieurs corps exige une direction par corps, exprimée dans le repère des normales, ou un contrat commun de normales et de lumière en repère monde. La lumière hémisphérique doit être configurable par corps, particulièrement sur la Lune.

Séparer la couronne centrée sur le disque des lens flares optiques alignés dans l'image. L'image fournie sert de référence visuelle pour ces derniers. Prévoir leur occultation par la Terre, la Lune et le relief ; aucune couronne ni flare ne doit traverser un corps opaque. Une éclipse partielle et une éclipse totale seront des cas de recette, sans revendiquer une précision astronomique supérieure au modèle.

## 5. Structure proposée du nouveau dépôt

```text
spacexr-explorer/
  apps/explorer/                 Application Vite et interface
    src/journey/                Babylon, étapes, interruption et reprise
    src/discoveries/            Lieux préparés, comparaisons et carnet
    src/views/                  État de vue versionné et URL partageable
  packages/world/               Horloge, états des corps, repères, budgets
  packages/babylon/             Caméra, placement des couches, Soleil
    src/shaders/                Sources GLSL et génération
  packages/atmosphere-babylon/  Adaptation ultérieure de l'atmosphère
  fixtures/                     Petits jeux de données déterministes
  tests/integration/            Temps, poses, streaming et trajectoires
  tests/visual/                 Scénarios et captures de référence
  docs/                         Architecture, données et décisions
```

Le dépôt consomme les bibliothèques existantes sans copier leur code. Les adaptations réutilisables de la caméra et des terrains doivent remonter dans `3d-tiles-babylon` ; les contrats génériques de streaming dans `3d-tiles-core`. La composition du système solaire reste dans ce nouveau dépôt.

Dépendances locales à préparer : `quantia`, `celestial-core`, les packages de `3d-tiles-core`, `3d-tiles-babylon`, puis `spacexr-atmosphere`. Utiliser la même version de geodesy, actuellement `0.4.0`, et une seule version de Babylon conforme aux peer dependencies de l'adaptateur. Certaines bibliothèques sont encore privées ou liées par `file:` : l'installation reproductible est un livrable à part entière.

## 6. Lots de développement et critères de sortie

| Lot | Travaux | Critère de sortie | Charge indicative |
| --- | --- | --- | --- |
| 0. Dépôt reproductible | Créer le dépôt, liens locaux ou archives figées, lockfile, scripts, scène et données synthétiques | Un démarrage documenté affiche une scène sans clé externe ; versions et modifications locales identifiées | 1 à 2 jours |
| 0b. Vue retrouvable | Format versionné de position, orientation, corps, date et champ de vision ; URL et carnet local | Une vue se rouvre dans le même repère ; le format peut accueillir une étape du voyage | À chiffrer avec l'interface |
| 1. Temps et repères | Horloge UTC, pause et vitesse signée, fournisseur d'éphémérides, poses complètes, Soleil/Terre/Lune simples | Changer la date déplace les corps ; aller-retour entre repères vérifié ; orientations contrôlées sur plusieurs dates | 2 à 4 jours |
| 2. Terrain mobile | Adapter métrique, frustum, présentation GPU, picking et éclairage à chaque corps | Terre et Lune tuilées visibles simultanément ; rotation du corps sans dérive du relief ou du picking | 4 à 7 jours |
| 3. Navigation continue | Modes sol, orbite et vol libre, vitesse selon distance au relief, préchargement, budgets partagés, profondeur | Trajet scripté Terre vers Lune puis retour sans recréer la scène, sans trous persistants ni croissance mémoire continue | 3 à 5 jours |
| 4. Soleil | Portage du shader, disque analytique, LOD, HDR, couronne et flares optionnels, occultation | Soleil visible et éclairage alignés ; LOD sans saut ; corps opaques occultants ; rendu stable pendant l'approche lunaire | 2 à 4 jours |
| 5. Atmosphère | Adaptateur Babylon de `@spacexr/atmosphere`, composition avec profondeur et transmittance, cache et profils qualité | Continuité visuelle du sol à l'espace, horizon et coucher, occultation du disque et du terrain, budget mesuré | 5 à 10 jours |
| 6. Extension et stabilisation | Autres planètes, catalogue de couches, récupération réseau et recettes complètes | Ajouter un corps par description ; limites de précision et de données documentées | 2 à 4 jours |
| Produit. Voyage du Babylon | Destinations préparées, atterrissage, retour au vaisseau, reprise d'étape, comparaisons et partage | Un utilisateur accomplit le premier parcours sans connaître les commandes techniques | À chiffrer selon contenu et assets |

Les estimations sont des jours de développement concentré, sous réserve des interfaces et données. Elles n'incluent pas la génération de grands datasets. Un premier trajet avec Soleil simple et sans atmosphère physique détaillée représente environ 2 à 4 semaines. L'intégration complète décrite représente environ 4 à 7 semaines, à réestimer après le lot 2.

Ces fourchettes portent sur le socle technique initial. Elles ne comprennent pas encore les nouveaux travaux de carnet, de partage, de narration, les contenus du livre ni un modèle 3D du Babylon. Les livraisons A à E du document produit assemblent les lots techniques en expériences utilisables ; leurs charges seront évaluées séparément.

Le lot 4 peut commencer après les repères du lot 1. Le lot 5 peut préparer ses contrats dès le départ, mais sa recette finale dépend de la profondeur et de l'éclairage stabilisés.

## 7. Recette commune

- Contrôler positions et rotations à plusieurs dates, dont la date initiale ; comparer les éphémérides à des références externes avec des tolérances annoncées.
- Vérifier les axes, le méridien origine et les signes de longitude avec des lieux connus sur Terre et sur la Lune.
- Rejouer la même trajectoire à date figée et à temps accéléré, y compris un changement de date avec caméra immobile.
- Tester sol, horizon rasant, orbite terrestre, milieu du trajet, orbite lunaire et proximité du relief ; mesurer les erreurs de picking et le tremblement visible.
- Simuler réseau lent, tuiles absentes et annulations ; conserver une couverture grossière pendant les mouvements rapides.
- Mesurer temps CPU/GPU, latence de frame, mémoire et requêtes sur une machine et une résolution documentées. Fixer ensuite les seuils de performance ; les benchmarks d'une scène isolée ne certifient pas la scène composite.
- Tester les pôles, bords de cube, changements de LOD, occultations solaires et absence de lumière ambiante artificielle sur la face nocturne lunaire.
- Commencer la validation sur le chemin GPU cubique existant. WebGL et WebGPU nécessitent chacun leur recette, particulièrement pour l'atmosphère issue du laboratoire WGSL.

## 8. Premier objectif concret

Livrer d'abord une application avec date réglable, Soleil analytique, Terre et Lune aux dimensions réelles, terrain lunaire cubique existant et couverture terrestre. Une trajectoire préparée permet de quitter la Terre avec le Babylon, de rejoindre un site lunaire, de s'y poser, de regarder le ciel, de garder une vue et de retrouver le vaisseau. Ce parcours de démonstration ne préjuge pas de l'itinéraire du livre.

Les statistiques de l'ensemble du monde restent accessibles dans un panneau de diagnostic. L'interface principale montre les destinations, le voyage, la date et les découvertes. Le changement de date propose d'abord une évolution de l'éclairage ; les ombres portées du relief demandent une implémentation et une recette supplémentaires.

Ce jalon tranche les risques de repères, précision et streaming avant le travail d'atmosphère avancée et de finition solaire.
