[[pagebreak]]
## Annexe A Importer les données LOLA pour la Lune et Shackleton

Le Babylon approche du pôle Sud. Avant de choisir le nombre de triangles à afficher, nous devons savoir de quelles observations provient le sol. Deux fichiers qui annoncent une grille de cinq mètres peuvent représenter des traitements différents, porter des incertitudes différentes et ne pas couvrir les mêmes endroits. L’import commence donc par un produit scientifique identifié, puis par un contrôle de ses coordonnées et de ses valeurs.

Cette annexe décrit une chaîne locale d’import et de génération cubique. Elle s’appuie sur un pilote exécuté avec des données NASA et distingue sa validation technique de la qualification scientifique d’un assemblage complet. Le pilote conserve les motifs de ses sources. Aucun filtre de suppression des traces ne modifie les hauteurs pour rendre l’image plus agréable.

### A1 Reconnaître la signature des observations

Les passages d’un altimètre laser échantillonnent la surface le long de trajectoires. Le modèle de terrain remplit les espaces entre les observations selon une méthode d’interpolation. La position estimée du satellite et les ajustements entre traces interviennent également dans le résultat. Des motifs alignés peuvent ainsi apparaître dans un DEM, même lorsque sa distribution et son encodage fonctionnent correctement.

Les travaux consacrés aux produits LOLA décrivent explicitement des artefacts de traces liés aux erreurs de reconstruction orbitale et proposent des ajustements pour les réduire. Ces motifs demandent une analyse des données et du traitement. Leur présence ne suffit pas à déclarer une source inutilisable, et leur disparition dans une image plus lisse ne mesure pas, à elle seule, un gain d’exactitude. [A1]

Pour localiser le phénomène, nous examinons successivement le TIFF numérique reçu, les valeurs après reprojection, le PNG Terrarium décodé et l’affichage final. Un motif déjà présent dans le TIFF exporté ne peut pas avoir été créé initialement par notre shader. Il reste toutefois à distinguer ce qui appartient au produit d’origine de ce qui pourrait provenir de l’export ou du rééchantillonnage du service.

![Deux produits NASA sur une même emprise cartographique nominale et avec une même échelle de gris](15-comparaison-lola.png)

Les deux panneaux sont calculés directement à partir des valeurs numériques. L’emprise nominale commune est comprise entre −1 280 et +1 280 m en X, et entre −1 280 et +1 000 m en Y, dans la projection polaire sud. L’échelle de gris est commune. Le panneau Trek provient des blocs TIFF exportés ; le panneau PGDA provient du produit régional Site04 ajusté. La figure permet d’observer les motifs, pas de déduire une précision absolue sans contrôle indépendant.

Le terme raw du service ne signifie pas que nous disposons des observations instrumentales brutes. Le TIFF contient déjà un raster griddé. Pour retrouver les mesures individuelles, il faut les produits d’impacts ou les nuages de points accompagnés de leur définition, de leurs unités et de leur provenance.

### A2 Choisir une source pour chaque région

Le choix d’un DEM dépend d’abord de sa couverture. SLDEM2015 associe les observations LOLA et les DEM stéréoscopiques de la Terrain Camera de Kaguya entre 60° S et 60° N. Sa grille à 512 pixels par degré convient à la couverture des basses et moyennes latitudes. Elle ne constitue pas une source pour Shackleton. [A2]

| Région et usage | Produit à examiner |
| Basses et moyennes latitudes | SLDEM2015 entre 60° S et 60° N, avec ses labels numériques et ses limites régionales |
| Continuité aux hautes latitudes | Produits LOLA dont l’emprise, le pas de grille et les références sont documentés |
| Approche du pôle Sud | Produits LOLA ajustés de 2023, avec un niveau adapté à la couverture et aux cartes de qualité disponibles |
| Secteur de Shackleton | Mosaïque LOLA ajustée entre 87° S et le pôle, grille à 5 m |
| Détails locaux supplémentaires | Produits Shape-from-Shading dans leurs seules emprises valides, en conservant leurs masques et leur provenance |

La mosaïque polaire PGDA est composée de champs ajustés, alignés et raccordés dans leurs recouvrements. Elle fournit une couverture plus large que le seul produit régional Site04. Le fichier de hauteur est annoncé à environ 3,3 Go ; les cartes de pente et de comptage constituent des produits distincts. Cette taille concerne les sources distribuées, pas les tuiles finales. [A3]

Les produits ajustés de 2023 proposent plusieurs emprises et pas de grille. Le nom du fichier encode notamment la latitude limite et le nombre de mètres par pixel. Nous choisissons un produit concret et ses cartes associées plutôt qu’une résolution générique attribuée à toute la collection. [A4]

Les modèles Shape-from-Shading utilisent les images NAC pour reconstruire des détails supplémentaires dans des régions sélectionnées. Leur emploi reste conditionné par l’éclairage, la couverture et les contrôles du produit. Une zone où aucune reconstruction valide n’existe conserve son autre source de terrain et son statut de qualité. [A5]

### A3 Conserver une provenance exploitable

L’inventaire associe chaque fichier à son URL d’origine, au nom du produit, à son attribution, à son empreinte SHA-256 et aux documents qui expliquent ses valeurs. Les métadonnées géométriques portent la projection, le repère et sa réalisation, les axes de longitude et latitude, l’unité horizontale, la registration des pixels et l’emprise réelle.

Les métadonnées des hauteurs constituent une seconde partie de cet inventaire. Elles indiquent le type numérique, l’unité verticale, le facteur d’échelle, la valeur absente, la direction de mesure et le zéro de référence. Un fichier Float32 n’établit aucune de ces propriétés à lui seul. Un nom contenant DEM ne prouve pas davantage qu’un PNG de présentation contient des altitudes.

Dans le pilote, les sources globales du CGI Moon Kit servent à une visualisation légère. Le relief HD est disponible dans deux variantes explicites : un export numérique du produit polaire Trek et le GeoTIFF régional PGDA Site04 ajusté. Le README de ce dernier identifie MOON_ME et l’éphéméride DE421. Le modèle global et la source régionale ne sont pas pour autant déclarés compatibles pour une fusion scientifique tant que leurs références complètes n’ont pas été confrontées. [A6]

Une révision du lot dépend des sources effectivement lues, de leurs empreintes, de la surface cible et de la sélection des tuiles. Une nouvelle source ou un autre traitement doit produire une nouvelle révision. Le lecteur peut ainsi retrouver l’origine d’un relief même après une mise à jour du service.

### A4 Organiser le stockage et reprendre un import

Le disque F accueille la préparation. La racine est configurable ; le pilote utilise F:\LunarData. Les originaux restent séparés des fichiers de travail, des blocs réutilisables, des résultats et des rapports. Le code et les configurations du service appartiennent au dépôt, tandis que les données volumineuses restent sur le disque de travail.

```text
F:\LunarData\
  sources\moon\       Originaux NASA et reçus de téléchargement
  catalog\            Configuration et inventaires
  cache\              Blocs sources réutilisables
  work\               Fichiers temporaires et verrou d’import
  datasets\moon\      Résultats regroupés par révision
  reports\            Contrôles et diagnostics
```

Un téléchargement terminé est réutilisé seulement après vérification de sa taille et de son empreinte. Les octets incomplets restent dans un fichier temporaire. Ils ne deviennent une source utilisable qu’après contrôle et renommage. Si le serveur fournit un ETag fort, une reprise peut demander les octets manquants ; le Content-Range doit correspondre exactement. Sinon, le fichier concerné recommence depuis son début.

Le traitement impose une limite par fichier et vérifie l’espace libre avant l’import. Le pilote limite un bloc Trek ou une source globale à 8 Mio, et le produit régional Site04 à 64 Mio. Les produits polaires plus vastes exigent une politique de lecture par fenêtres et un budget explicitement dimensionné. Leur taille ne doit pas être simplement transférée à une allocation équivalente en mémoire.

Un verrou exclusif empêche deux imports d’écrire dans les mêmes fichiers partiels. En cas d’arrêt brutal, son retrait exige de vérifier que le processus propriétaire n’est plus actif. Cette règle protège la reprise sans transformer automatiquement un traitement lent en traitement abandonné.

### A5 Traverser la chaîne numérique

Les fonctions communes de la bibliothèque déterminent la direction de chaque échantillon cubique, la projection source et les pixels voisins. L’adaptateur de données fournit les valeurs numériques. L’importateur convertit ensuite ces valeurs en hauteurs radiales sur la surface cible et les transmet à l’encodeur.

![La chaîne locale conserve un contrôle à chaque changement de représentation](16-import-lola.png)

Les exports Trek du pilote sont découpés en blocs fixes de 512 pixels, alignés sur la grille native. Deux tuiles cubiques voisines lisent ainsi les mêmes pixels sources. La requête demande un TIFF Float32, une bande, sans fonction de rendu colorisé. La réponse doit conserver les dimensions, l’emprise et la registration attendues. Une erreur réseau reste une erreur de traitement ; elle ne devient pas une absence de terrain.

Le GeoTIFF Site04 est lu directement. Son emprise est de −9 000 à +7 000 m en X et de −15 000 à +1 000 m en Y, avec 3 200 pixels par côté. La fenêtre cubique de comparaison est sélectionnée pour que toute empreinte d’interpolation reste à l’intérieur du produit. Le pilote rejette un débordement plutôt que d’extrapoler ou de mélanger silencieusement une seconde source.

La surface de référence de sortie est indépendante de la sphère employée par la carte NASA. Pour une source exprimée en hauteur radiale au-dessus d’une sphère de rayon connu, nous conservons le rayon physique en changeant seulement le zéro de référence :

[[eq:rebase]]

Le pilote accepte une surface cible biaxiale ou triaxiale. Les rayons utilisés sont consignés dans sa configuration. Cette opération ne corrige pas une différence d’orientation entre repères ; cette transformation doit être établie séparément quand elle existe.

Le PNG Terrarium est un conteneur de nombres. Son encodage sans perte conserve les canaux et l’alpha. Le WebP de l’imagerie suit une autre chaîne, destinée à l’apparence. Les réglages de couleur, de contraste ou de compression de cette chaîne ne s’appliquent jamais aux hauteurs.

### A6 Transporter les informations de qualité

Une hauteur seule décrit une surface, mais pas la qualité des observations qui ont permis de la construire. Nous prévoyons donc des rasters de qualité associés au DEM, avec une disponibilité explicite. Ils restent distincts des canaux Terrarium et ne sont pas déduits de l’aspect de l’image.

| Information | Interprétation à conserver |
| LDEC | Nombre de retours ou information de densité selon la définition du produit, en conservant les éventuels mélanges |
| EFFRES | Résolution effective exprimée dans l’unité documentée, distincte du pas de grille |
| ERR | Incertitude de hauteur selon la méthode et la définition du produit ; pas une garantie absolue |
| Masques et provenance | Couverture valide, absence de données, produit d’origine et reconstruction éventuelle à partir d’images |

La mosaïque PGDA signale que le mélange des champs peut produire des valeurs LDEC non entières. Nous ne devons donc pas convertir systématiquement ce canal en un comptage brut d’impacts dans le pixel final. Une carte absente reste inconnue ; elle ne devient ni zéro erreur ni absence certaine de mesures. [A3]

![Les cartes de qualité restent des informations distinctes du nombre d’échantillons du DEM](17-qualite-lola.png)

Le rééchantillonnage de chaque carte dépend de sa signification. Une moyenne bilinéaire d’identifiants de source n’a pas de sens. Une moyenne d’erreurs ne constitue pas automatiquement l’incertitude du relief interpolé. Un nombre de retours ne s’additionne entre cellules qu’après définition de l’emprise et de la règle de comptage. Ces choix doivent être documentés et testés avant de produire les pyramides de qualité.

Pour le moteur, la qualité peut aider à limiter un raffinement qui ne révélerait plus d’information observée, à afficher une incertitude ou à sélectionner une source mieux adaptée. Elle ne remplace pas le critère géométrique de raffinement : erreur d’écran et qualité de la mesure répondent à deux questions différentes.

### A7 Exécuter et vérifier le pilote

Les commandes suivantes s’exécutent depuis le dépôt du service. Le serveur reste limité à la machine locale. La génération n’effectue aucune publication Cloudflare.

```powershell
npm run lunar -- init
npm run lunar -- pilot --dem trek
npm run lunar -- verify
npm run lunar -- serve
```

La variante régionale est sélectionnée explicitement avec la commande suivante. Le serveur doit être redémarré après génération pour charger le nouveau lot terminé.

```powershell
npm run lunar -- pilot --dem pgda-site04
npm run lunar -- verify
npm run lunar -- serve
```

Les deux variantes produisent chacune seize tuiles : six faces racines d’imagerie, six faces racines de relief global et quatre tuiles de relief HD. Les fenêtres HD diffèrent d’une ligne de tuiles pour tenir compte de l’emprise Site04. Elles ne doivent pas être présentées comme deux captures exactement superposables. La figure 15 utilise, elle, leur emprise cartographique nominale commune.

Le lot Trek utilise les colonnes et lignes 1023 et 1024, face 5, niveau 11. La variante Site04 conserve les colonnes 1023 et 1024 et utilise les lignes 1024 et 1025. Chaque grille contient 257 × 257 hauteurs pour 256 cellules. Les quatre raccords internes de chaque lot sont vérifiés sur les valeurs Float32 avant encodage.

| Contrôle | Résultat établi sur le pilote |
| Fichiers générés | Seize fichiers par variante, inventoriés avec taille et SHA-256 |
| Raccords HD | Quatre bords partagés identiques dans chaque variante |
| Encodage numérique | Tests de conservation des canaux, valeurs négatives, retenues et NoData |
| Géométrie cible | Test de conservation du rayon physique sur une surface aplatie |
| Couverture régionale | Fenêtre Site04 acceptée ; ancienne fenêtre qui dépasse l’emprise rejetée |
| Distribution locale | Formats MIME, URL de révision, ETag et réponse 304 contrôlés |
| Reprise et concurrence | Réutilisation des fichiers vérifiés, reprise conditionnelle et verrou exclusif testés |

Ces contrôles valident le fonctionnement technique du pilote. Ils ne certifient pas la précision absolue des produits, l’ensemble des transformations de référence ou une fusion scientifique entre modèles. Le statut du manifeste reste preview tant que cette qualification n’est pas achevée.

### A8 Étendre la couverture avant publication

La production complète commence par l’inventaire de la mosaïque polaire et des cartes de qualité associées. Une estimation compte l’union des adresses cubiques, les sources originales, le cache, les résultats, les rapports et la marge de travail. La préparation des niveaux parents est nécessaire pour assurer une descente continue depuis l’orbite ; quatre tuiles HD isolées ne suffisent pas.

La fusion entre sources repose sur des hauteurs déjà compatibles et sur une règle qui dépend de la direction et du niveau, jamais du fichier qui demande le bord. Les raccords sont vérifiés entre tuiles, entre faces et entre niveaux. Des points de contrôle et des cartes d’écart servent ensuite à évaluer l’assemblage, y compris dans les bandes de transition.

Une publication décrit seulement les tuiles réellement disponibles. Elle transporte leur surface cible, le repère qualifié, l’encodage, les sous-arbres raffinés et les informations de qualité effectivement produites. Les originaux et les lots complets peuvent rester sur le disque local ; R2 reçoit les révisions validées destinées aux clients.

### Références de l’annexe

[A1] Barker et al. Improved LOLA elevation maps for south pole landing sites. Étude des erreurs, des artefacts de traces et des ajustements. https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf

[A2] NASA PGDA. High resolution lunar topography SLDEM2015. https://pgda.gsfc.nasa.gov/products/54

[A3] NASA PGDA. South Pole LOLA DEM Mosaic. https://pgda.gsfc.nasa.gov/products/81

[A4] NASA PGDA. A New View of the Lunar South Pole from LOLA. Produits ajustés et cartes associées. https://pgda.gsfc.nasa.gov/products/90

[A5] NASA PGDA. Enhanced Topography Models for Selected Lunar South Pole Regions with Shape from Shading. https://pgda.gsfc.nasa.gov/products/104

[A6] NASA PGDA. Produits régionaux LOLA et README. https://pgda.gsfc.nasa.gov/products/78 https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README
