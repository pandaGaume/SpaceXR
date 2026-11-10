# Lune et Shackleton : import local et tuiles cubiques

Le pilote importe des produits NASA sur un disque local, génère des tuiles cubiques et les distribue en HTTP sur localhost. Le stockage par défaut est `F:\LunarData`. Les données ALOS et le serveur BlueMosaic sont indépendants.

## Exécuter le pilote

Depuis la racine de `spacexr-tile-service`, avec ses dépendances et les bibliothèques voisines construites :

```powershell
npm run lunar -- init
npm run lunar -- inspect
npm run lunar -- pilot
npm run lunar -- verify
npm run lunar -- serve
```

La prévisualisation est disponible sur <http://127.0.0.1:8791/>. `Ctrl+C` arrête le serveur. Une autre racine se configure avec `--root "F:/LunarData"` ou la variable `LUNAR_DATA_ROOT`. `serve` accepte `--port 8791`.

`pilot` effectue des téléchargements publics mais ne publie rien sur Cloudflare. L'administration sur le port 8790 conserve ses propres fonctionnalités et ne déclenche pas ce traitement.

## Contenu du premier lot

| Produit                               | Couverture                            | Format          | Nombre |
| ------------------------------------- | ------------------------------------- | --------------- | -----: |
| Imagerie globale LROC du CGI Moon Kit | Six faces racines, niveau 0           | WebP sans perte |      6 |
| Relief global du CGI Moon Kit         | Six faces racines, niveau 0           | Terrarium PNG   |      6 |
| Relief LOLA polaire à 5 m             | Quatre tuiles de la face 5, niveau 11 | Terrarium PNG   |      4 |

Chaque fichier contient 257 × 257 échantillons pour 256 cellules par côté. Les quatre tuiles HD couvrent environ 2,7 × 2,7 km près du pôle Sud, dans le secteur du rebord de Shackleton. Ce lot ne couvre pas tout le cratère et ne fournit pas encore les niveaux intermédiaires d'une descente continue.

Le produit HD par défaut est le DEM polaire Trek, utilisé comme référence de diagnostic. Les colonnes et lignes 1023 et 1024 de la face 5, au niveau 11, entourent le pôle. Les motifs visibles dans ses exports sont conservés ; aucun filtre correctif n'est appliqué.

`npm run lunar -- pilot --dem pgda-site04` sélectionne explicitement le DEM régional ajusté PGDA Site04. Sa grille de 3 200 × 3 200 pixels couvre `[-9000, -15000, 7000, 1000]` en mètres dans la projection polaire sud. Sa fenêtre cubique utilise les colonnes 1023 et 1024, lignes 1024 et 1025, au niveau 11 de la face 5. Toute empreinte d'interpolation dépassant cette couverture est rejetée : il n'y a ni extrapolation ni mélange implicite avec Trek. Les deux fenêtres ne sont pas identiques. Les lots ont des révisions distinctes et les lots antérieurs restent sur disque. `npm run lunar -- pilot --dem trek` sélectionne explicitement la référence Trek.

Le panneau HD montre les hauteurs en niveaux de gris. Il s'agit d'un diagnostic du DEM. L'imagerie globale est un produit de visualisation basse résolution et ne constitue pas une photographie HD de Shackleton.

## Organisation du disque

```text
F:\LunarData\
  catalog\lunar-pilot.json       Surface cible configurable
  catalog\lola-south-5m.json     Réponse NASA et date de consultation
  catalog\latest-pilot.json     Pointeur vers un lot terminé
  sources\moon\svs\             Sources globales et empreintes SHA-256
  cache\lola-south-5m\           Exports numériques, requêtes et reçus
  work\                         Verrou du traitement
  datasets\moon\pilot-<id>\     Résultats, descripteurs et inventaire
  reports\                      Vérification des fichiers
```

Les sources globales et le GeoTIFF régional PGDA sont vérifiés contre des empreintes SHA-256 épinglées dans le code. Le produit régional fait environ 41 Mo. Le mode Trek exporte des blocs fixes de 512 pixels, alignés sur la grille native. Les blocs de bordure sont tronqués à l'emprise réelle. Les quatre tuiles pilotes réutilisent les mêmes pixels sources.

Chaque fichier global ou bloc Trek transféré est limité à 8 Mio ; le GeoTIFF régional PGDA est limité à 64 Mio. L'import vérifie au moins 2 Gio d'espace disponible avant de commencer. Ce seuil concerne ce petit pilote ; il ne remplace pas l'estimation du volume d'une production complète.

Les téléchargements terminés sont réutilisés après vérification de leur empreinte. Une reprise HTTP partielle exige un ETag fort et un Content-Range compatible. Un serveur qui retourne un fichier entier provoque un redémarrage de ce fichier. Les fichiers incomplets restent sous un suffixe `.part` et ne deviennent pas des sources valides.

Un verrou exclusif empêche deux imports simultanés dans la même racine. Après un arrêt brutal, `work/import.lock` peut subsister. Vérifier que le processus indiqué dans ce fichier n'existe plus avant de retirer ce verrou.

## Géométrie et valeurs numériques

Les primitives de `@spacexr/tiles/cube` et `@spacexr/tiles/reprojection` déterminent les directions et rééchantillonnent les blocs. Le service ne redéfinit pas une deuxième convention de cube.

La projection de la source LOLA utilise un rayon de 1 737 400 m. Ce rayon décrit la source. La surface cible vient initialement du catalogue lunaire et peut être remplacée par trois rayons positifs dans `catalog/lunar-pilot.json`. Le traitement supporte les surfaces biaxiales ou triaxiales.

Pour une direction `d`, la conversion radiale est :

```text
h_cible = h_LOLA + 1737400 - r_reference(d)
```

Cette conversion préserve la position physique lorsque les références spatiales des sources et de la cible sont compatibles. Une erreur de référentiel ne se corrige pas par cette soustraction.

Le TIFF exporté doit être Float32 à une bande et conserver l'emprise demandée. Les pixels sans valeur deviennent NaN. Une erreur réseau ou un export invalide arrête l'import au lieu de produire une tuile transparente. Le PNG Terrarium conserve exactement les canaux numériques et la transparence.

Les quatre raccords HD sont comparés échantillon par échantillon avant validation du lot. `verify` relit tous les fichiers produits et vérifie taille et SHA-256. Le serveur effectue aussi cette vérification au démarrage.

## Provenance et statut scientifique

Le lot est une prévisualisation technique. Le README PGDA identifie le produit régional en MOON_ME / DE421. Le WKT du service Trek décrit sa projection et sa sphère ; il ne suffit pas à établir la réalisation exacte de son repère lunaire. La convention verticale complète et la compatibilité avec le produit global restent à confronter aux labels avant une publication scientifique ou une fusion entre produits.

Les motifs de traces observés dans le produit polaire Trek sont présents dans ses TIFF Float32, avant reprojection cubique et encodage Terrarium. Le produit régional PGDA utilise un ajustement des traces LOLA. Le pilote applique uniquement le rééchantillonnage bilinéaire et la conversion de surface déclarés, sans filtre de suppression des traces. La finesse de sa grille ne garantit pas une mesure indépendante à chaque pixel ; les cartes d'incertitude et de densité de points du produit restent utiles.

`pilot.json` conserve les sources, les empreintes des blocs, la surface cible, les adresses exactes et les contrôles effectués. Son statut reste `preview`.

Les descripteurs `elevation.json` et `imagery.json` publient la pyramide globale aux niveaux 0 à 6. Le descripteur de relief inclut les sous-arbres LOLA détaillés du pôle Sud jusqu'au niveau 11. Les URL de tuiles incluent la révision ; le serveur ne distribue que les chemins enregistrés dans le manifeste validé.

Sources : [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), [LOLA polaire numérique à 5 m](https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole875_5mp_v04/ImageServer?f=pjson), [produits régionaux LOLA et incertitudes](https://pgda.gsfc.nasa.gov/products/78).

## Comparaison globale LOLA et SLDEM2015

SLDEM2015 fournit une grille numérique à 512 pixels par degré, soit environ 59 m par pixel à l'équateur, entre 60° sud et 60° nord. Ce modèle combine LOLA avec la caméra stéréoscopique Terrain Camera de Kaguya et est recalé sur le référentiel LOLA/GRAIL. Sa précision verticale typique publiée est de 3 à 4 m. La couverture est distribuée en 32 régions Float IMG de 45° par 30°. Une région contient 23 040 × 15 360 échantillons Float32, soit environ 1,42 Go. L'ensemble représente environ 45,3 Go si toutes les régions sont téléchargées.

Importer les sources et démarrer le visualiseur local :

```powershell
npm run lunar -- sldem-import
npm run lunar -- global-serve --port 8792
```

`sldem-import` importe les labels PDS des régions et valide leur grille, leur encodage Float32, leur projection, leur unité et leur repère. Les labels expriment les hauteurs en kilomètres au-dessus du rayon de référence de 1 737,4 km; le moteur les convertit en mètres sans ajouter ce rayon aux échantillons. Les Float IMG originaux sont téléchargés à la première requête qui en a besoin. Les transferts sont repris lorsque le serveur source fournit un ETag fort.

Le panneau « Comparer les modèles de terrain » affiche la même adresse cubique pour ces variantes :

| Variante | Définition |
| --- | --- |
| `lola` | LOLA global PDS, source présente à 128 pixels par degré |
| `sldem2015` | SLDEM2015 seul, limité à sa couverture ±60° |
| `delta` | hauteur SLDEM2015 moins hauteur LOLA, calculée aux mêmes sommets de tuile |
| `fused` | SLDEM2015 dans sa couverture, raccord progressif vers LOLA entre 59,5° et 60° de latitude |

Les deux modèles partagent le repère lunaire et la surface cible du service. Leur pas natif diffère : 128 pixels par degré pour LOLA dans cette comparaison, 512 pour SLDEM2015. La carte delta compare donc les deux jeux de données après échantillonnage sur la même grille cubique, mais elle ne sépare pas l'effet de résolution de l'écart entre les modèles.

Les routes de tuiles sont `GET /comparison/{variant}/{face}/{lod}/{x}/{y}.png` et `GET /comparison-info/{variant}/{face}/{lod}/{x}/{y}.json`. `GET /sldem2015.json` donne le manifeste des sources. Chaque PNG Terrarium porte ses métadonnées de source et de référence dans un chunk `iTXt`.

Les labels de carte, labels Float IMG et auxiliaires sont conservés sous `sources/moon/sldem2015/`, avec leurs empreintes. Les Float IMG originaux téléchargés restent dans ce même répertoire et sont validés par SHA-256. Le serveur lit les Float32 directement, sans conversion JPEG2000. Les tuiles dérivées sont mises en cache par version des sources, variante et adresse. Cette organisation évite de télécharger ou de générer d'avance toute la couverture.

Source : [NASA PGDA, SLDEM2015](https://pgda.gsfc.nasa.gov/products/54), [régions JPEG2000 512 ppd](https://imbrium.mit.edu/DATA/SLDEM2015/TILES/JP2/).

## Développement vers Shackleton complet

La sélection cible des produits est distincte du petit pilote actuellement disponible :

| Région                    | Produit cible                                | Rôle                                                          |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Entre 60° S et 60° N      | SLDEM2015, LOLA et Kaguya TC                 | Couverture stéréoscopique des espaces entre traces            |
| Hautes latitudes          | Produits LOLA numériques                     | Continuité de la couverture                                   |
| Approche du pôle Sud      | LOLA ajusté 2023, PGDA 90                    | Relief régional et informations de qualité                    |
| 87° S au pôle Sud         | Mosaïque LOLA ajustée, PGDA 81, grille à 5 m | Couverture de Shackleton et du voisinage                      |
| Régions locales couvertes | Shape-from-Shading, PGDA 104                 | Détails reconstruits à partir de NAC, avec masque de validité |

Sources : [SLDEM2015](https://pgda.gsfc.nasa.gov/products/54), [mosaïque polaire à 5 m](https://pgda.gsfc.nasa.gov/products/81), [LOLA ajusté 2023](https://pgda.gsfc.nasa.gov/products/90), [produits Shape-from-Shading](https://pgda.gsfc.nasa.gov/products/104).

La qualité ne se réduit pas à un drapeau mesuré/interpolé. Les cartes disponibles doivent conserver leur signification native : nombre de retours ou densité (LDEC), résolution effective (EFFRES), incertitude documentée (ERR), ainsi que les masques de reconstruction et de couverture. Le nom, l'unité, la définition et la disponibilité de chaque carte sont lus produit par produit. L'absence de carte reste inconnue.

Les valeurs LDEC peuvent être non entières dans les zones de mélange de la mosaïque PGDA 81. Elles ne constituent donc pas toujours un comptage brut d'impacts dans le pixel final. EFFRES est distinct du pas de grille ; une carte ERR ne devient pas une garantie absolue d'erreur. Le rééchantillonnage de ces cartes doit être défini séparément de l'interpolation des hauteurs.

1. Confirmer les labels, références verticales et réalisations des repères. Inventorier l'emprise du cratère et des produits régionaux.
2. Planifier une base globale et les sous-arbres polaires, en comptant l'union des adresses et leur volume avant génération.
3. Ajouter le relief régional à 30 m, les niveaux parents du secteur HD et une fusion déterministe selon la direction. Chaque niveau lit la résolution source appropriée.
4. Étendre les tuiles à 5 m sur l'ensemble du cratère et les zones de travail, avec cartes de couverture et de qualité.
5. Importer une imagerie LROC NAC contrôlée et les produits ShadowCam géoréférencés disponibles. Comparer WebP avec et sans perte sur les mêmes extraits.
6. Connecter ces pyramides au client : descente continue, raccords entre niveaux, picking, normals et volumes de visibilité sur la surface cible.
7. Exposer planification, progression, reprise, validation et publication dans l'administration. Distribuer sur R2 uniquement les révisions validées.

Les tâches de calcul sont exécutées localement. Le stockage local peut contenir les originaux et les résultats complets, tandis que R2 reçoit la sélection destinée à la distribution publique.
