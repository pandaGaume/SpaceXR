# La projection cubique des terrains planétaires

## Des régions polaires aux données NASA Trek

Le Babylon s’approche du pôle sud de la Lune. Sur l’écran de navigation, les méridiens se resserrent autour de Shackleton. La caméra continue pourtant de se déplacer sans rencontrer de singularité physique. Le problème apparaît seulement dans notre manière de ranger les données. Nous demandons à une carte rectangulaire de représenter un endroit où toutes les longitudes se rejoignent.

Pour poursuivre la descente, nous allons changer de découpage. Le relief restera celui de la Lune, les hauteurs garderont leur référence scientifique et les images conserveront leur provenance. Seule l’organisation des directions d’observation sera remplacée par six faces, chacune subdivisée en tuiles. Cette distinction guidera tout le chapitre : choisir une adresse, définir une surface et mesurer une hauteur sont trois opérations différentes.

Nous partirons de figures simples, puis nous établirons les formules nécessaires à l’implémentation. Nous suivrons ensuite une donnée depuis les services NASA Trek jusqu’au terrain affiché. Le lecteur pourra ainsi relier les coordonnées, les échantillons, les fichiers et les requêtes réseau à un même point de la surface.

L’objectif est de construire une représentation continue, utilisable de l’orbite jusqu’aux régions polaires détaillées. La précision des observations, les choix d’interpolation et les coûts de distribution resteront explicites. Une tuile plus petite ne rend pas, à elle seule, une mesure plus précise.

[[sommaire]]

## 1 Comprendre le problème des pôles

### 1.1 Le terrain ne possède pas la singularité de la carte

Sur un globe, un petit déplacement autour du pôle est un déplacement ordinaire. Dans un repère latitude–longitude, il peut en revanche produire une grande variation de longitude. À la limite, au pôle exact, cette longitude n’identifie plus une direction distincte. Les valeurs 0°, 90° et 180° conduisent au même point.

Une carte équirectangulaire répartit néanmoins ces valeurs sur toute sa largeur. L’une de ses lignes représente donc un seul point physique. Ce rangement demeure utile pour diffuser une carte globale, mais il complique la génération des maillages, l’interpolation et le choix d’un voisin lorsque l’on approche du pôle.

Pour une sphère de rayon R, deux méridiens séparés par le même angle sont de plus en plus proches lorsque la latitude augmente. La longueur est–ouest d’un petit intervalle de longitude est proportionnelle au cosinus de la latitude. Une grille régulière dans l’image ne possède donc pas une résolution régulière au sol.

[[eq:longitude]]

Dans cette expression, l’écart de longitude Δλ est exprimé en radians. La formule décrit un petit intervalle sur un parallèle, pas une distance géodésique générale entre deux positions quelconques.

![Une singularité de coordonnées et trois façons de représenter la région polaire](01-poles.png)

La première représentation étale le pôle sur une ligne. La vue polaire montre que les méridiens aboutissent tous au centre. La face cubique réserve, elle aussi, une position intérieure au pôle, tout en conservant une grille carrée pour les données.

### 1.2 La limite de Web Mercator

Dans sa forme sphérique usuelle, Mercator fait intervenir le logarithme d’une tangente. La coordonnée verticale tend vers l’infini lorsque la latitude approche 90°. Les pyramides Web Mercator carrées s’arrêtent donc vers 85,0511°. Les derniers degrés n’y sont pas disponibles, même si l’on augmente le niveau de détail.

[[eq:mercator]]

Mercator préserve localement les angles dans son modèle sphérique, mais son facteur d’échelle augmente vers les pôles. Il ne faut pas confondre cette propriété avec une conservation des distances ou des surfaces. L’équirectangulaire atteint les pôles, au prix d’une autre distorsion ; une projection polaire traite efficacement une calotte, mais ne constitue pas à elle seule une carte globale unique.

Notre besoin est différent : parcourir tout un corps avec une même logique d’adressage et de subdivision. Le cube répond à ce besoin en répartissant les directions sur plusieurs cartes locales. Il remplace une singularité polaire par des raccords dont nous connaîtrons exactement les règles.

### 1.3 Ce que nous attendons du nouveau découpage

Nous voulons atteindre les pôles, raffiner localement une région et retrouver les mêmes positions sur les bords de deux tuiles. Nous souhaitons également utiliser la même topologie pour la Terre, Mars et la Lune, sans imposer à ces corps une même forme ou un même rayon.

Le cube ne supprime pas toute déformation. Il permet surtout de la borner et de la répartir. Ses six faces demandent une gestion des rotations et des coins ; cette complexité est explicite et testable. Elle remplace les cas particuliers dispersés que provoque une grille rectangulaire au voisinage des pôles.

## 2 Séparer les directions de la forme et du relief

### 2.1 Les trois géométries

La première géométrie est la sphère des directions. Un vecteur unitaire indique où regarder depuis le centre du corps. Sa longueur est toujours égale à un ; il ne porte aucune distance en mètres. C’est sur cet ensemble de directions que le cube attribue une face et une tuile.

La deuxième géométrie est la surface de référence. Nous la décrivons par trois rayons a, b et c, alignés sur les axes du corps. Lorsque les trois sont égaux, nous obtenons une sphère. Lorsque a et b sont égaux, nous obtenons un ellipsoïde de révolution. Lorsque les trois diffèrent, la surface est triaxiale.

La troisième géométrie est la surface physique. Elle ajoute aux points de référence les hauteurs du modèle de terrain. Le volume visible, les collisions et les intersections avec la caméra doivent être calculés à partir de cette surface, et non à partir de la seule tuile d’indexation. [R1]

![La direction de la tuile ne dépend pas de la surface de référence ni de sa hauteur](02-geometries.png)

### 2.2 Construire une position sur un ellipsoïde

Soit d une direction unitaire, de composantes dx, dy et dz. Le rayon qui part du centre dans cette direction rencontre l’ellipsoïde à une distance rref. En remplaçant les coordonnées de la droite dans l’équation de l’ellipsoïde, nous obtenons directement cette distance.

[[eq:radius]]

Une hauteur radiale h déplace ensuite le point le long du même rayon. L’adresse de la tuile reste inchangée, puisque sa direction ne change pas.

[[eq:position]]

La normale géométrique à l’ellipsoïde dépend, elle, du gradient de son équation. Sur une surface non sphérique, elle n’est généralement pas parallèle au rayon. Cette différence explique pourquoi une hauteur géodésique ne peut pas être réutilisée sans conversion comme une hauteur radiale.

[[eq:normal]]

### 2.3 Choisir le bon repère

Nous utilisons un repère cartésien lié au corps : l’origine au centre déclaré par le référentiel, Z vers le nord, X vers le méridien d’origine à l’équateur et Y vers 90° est. Les positions sont exprimées en mètres. La transformation vers le repère de la scène intervient ensuite.

Le nom du corps ne suffit pas à identifier ce repère. Sur la Lune, les réalisations Mean Earth et Principal Axis sont distinctes. Leurs versions et les transformations associées comptent dès que nous assemblons des sources détaillées. Un libellé tel que MOON_ME doit donc être complété par la réalisation effectivement utilisée lorsque le produit la précise. [R4]

La latitude d’une direction est planétocentrique. La latitude géodésique se rapporte à la normale de la surface de référence. Elles coïncident sur une sphère ; elles diffèrent sur un ellipsoïde aplati. Cette distinction doit être portée par chaque adaptateur de source, pas devinée dans un shader.

## 3 Déplier le cube autour de la planète

### 3.1 Six faces et six arbres

Nous plaçons un cube autour de la sphère des directions. Chaque face reçoit les directions dont la composante correspondante est dominante en valeur absolue. Les directions proches de +Z appartiennent à la face nord ; celles proches de −Z, à la face sud. Les quatre autres faces entourent l’équateur.

Chaque face possède son propre quadtree. Une tuile se divise en quatre enfants, comme une tuile cartographique classique. Il faut seulement ajouter le numéro de face à son adresse. Le cube possède six racines, et non un octree volumique : nous subdivisons une surface à deux dimensions. [R1]

![Un dépliage des six faces et leur orientation dans les images](03-faces.png)

Le dépliage ne représente pas six nouvelles surfaces physiques. Les carrés sont des domaines de coordonnées. Chaque position de l’un de ces carrés correspond à une direction qui sera projetée sur l’ellipsoïde de référence, puis déplacée par le relief.

### 3.2 Des conventions à écrire avant de coder

Pour chaque face, nous fixons un centre C, un axe U et un axe V. Dans les fichiers, u augmente vers la droite et v vers le bas. Les axes ci-dessous définissent entièrement cette convention. Une autre bibliothèque peut utiliser une convention différente ; les deux ne doivent pas être mélangées.

| Face | Centre C | Axe U | Axe V |
| 0 | (1, 0, 0) | (0, 1, 0) | (0, 0, −1) |
| 1 | (0, 1, 0) | (−1, 0, 0) | (0, 0, −1) |
| 2 | (−1, 0, 0) | (0, −1, 0) | (0, 0, −1) |
| 3 | (0, −1, 0) | (1, 0, 0) | (0, 0, −1) |
| 4 | (0, 0, 1) | (0, 1, 0) | (1, 0, 0) |
| 5 | (0, 0, −1) | (0, 1, 0) | (−1, 0, 0) |

Ces bases satisfont U × V = −C : vues depuis l’extérieur, les images ont leurs colonnes vers la droite et leurs lignes vers le bas. Cette relation est un contrôle simple contre une face retournée. Elle ne remplace pas les tests d’un repère connu au nord et au sud.

### 3.3 Identifier la face d’une direction

Nous comparons les valeurs absolues de dx, dy et dz. La plus grande détermine l’axe dominant ; son signe détermine la face. Pour une direction située exactement sur une arête, deux valeurs peuvent être égales. Nous donnons alors la priorité aux axes dans l’ordre X, Y puis Z.

Cette règle choisit un propriétaire pour l’adresse d’un point de bord. Elle n’interdit pas aux deux tuiles voisines de stocker le même sommet. Aux sommets du cube, trois faces se rejoignent : la topologie doit conserver ce cas de trois voisins au lieu d’inventer un quatrième carré.

## 4 Répartir les échantillons par angles

### 4.1 Du cube gnomonique au cube équiangulaire

Une première méthode répartirait régulièrement les coordonnées sur la face plane avant de normaliser le vecteur. Elle est simple, mais les cellules projetées n’ont pas la même aire près du centre et près des coins. Le cube équiangulaire répartit les paramètres par angles avant de revenir aux coordonnées de la face.

![Une même subdivision avec des coordonnées planes ou avec des angles réguliers](04-equiangulaire.png)

La figure montre les lignes sur le cube avant normalisation. Leur espacement devient non uniforme sur le plan équiangulaire, parce que nous cherchons une distribution angulaire plus régulière une fois les points reportés sur les directions du globe.

### 4.2 La formule directe

Pour u et v compris entre zéro et un, nous construisons deux angles compris entre −π/4 et +π/4. Nous appliquons la tangente puis nous normalisons le vecteur obtenu dans la base de la face.

[[eq:mapping]]

Au centre de la face, u = v = 0,5 ; les deux tangentes sont nulles et la direction est exactement C. Sur un bord, une tangente vaut +1 ou −1. À un coin, les deux valent ±1. Ces trois situations fournissent des tests élémentaires très utiles avant de charger la moindre donnée NASA.

### 4.3 La formule inverse

Une fois la face choisie, le produit scalaire d·C est positif. Les rapports d·U sur d·C et d·V sur d·C redonnent les coordonnées planes. L’arctangente permet de retrouver u et v.

[[eq:inverse]]

La normalisation initiale de d n’est pas nécessaire pour ces rapports, mais une direction nulle ou non finie doit être rejetée. Les valeurs sur les limites sont ramenées à l’intervalle valide pour éviter qu’un arrondi produise une colonne juste après la dernière tuile.

### 4.4 Une projection régulière sans promesse excessive

Sur une sphère, la densité d’aire du cube gnomonique est proportionnelle à (1 + q² + s²) puissance −3/2. Le changement équiangulaire ajoute les facteurs (1 + q²) et (1 + s²). Le rapport maximal entre les densités locales descend ainsi d’environ 5,20 à environ 1,41. Il s’agit d’une propriété différentielle de la projection, pas d’une garantie de précision pour un raster donné.

Le cube équiangulaire n’est ni une projection conforme générale ni une projection à aires égales. Sur un ellipsoïde, la forme du corps ajoute encore sa propre variation métrique. Nous avons surtout obtenu une grille mondiale dont les déformations restent modérées et dont les pôles n’occupent plus une ligne entière.

## 5 Adresser les tuiles et franchir leurs raccords

### 5.1 Une adresse à quatre composantes

L’adresse est constituée de face, lod, x et y. Au niveau lod, chaque face contient 2 puissance lod tuiles par axe. Une face comprend donc 4 puissance lod tuiles et le corps entier en comprend six fois plus. À l’intérieur d’une face, x croît vers la droite et y vers le bas.

[[eq:address]]

Le numéro de niveau décrit le découpage ; il ne constitue pas une résolution universelle en mètres. Une même tuile couvre les mêmes directions sur la Terre et sur la Lune, mais pas les mêmes distances. Elle peut également contenir un maillage moins dense que le raster d’altitude qui l’accompagne.

### 5.2 La face polaire devient une région ordinaire

Sur la face sud, le pôle se situe au centre du carré. Nous pouvons subdiviser les quatre tuiles qui l’entourent, puis poursuivre le raffinement seulement là où les sources le permettent. Le passage à une face équatoriale est traité par la même table de voisinage que partout ailleurs.

![Deux échelles de raffinement autour du centre de la face sud](05-polaire-lod.png)

Dans cette figure, les grilles représentent des niveaux de sélection et non les 256 cellules internes de chaque fichier. La distinction est importante : le quadtree décide quels fichiers demander ; la grille interne décide quels échantillons et quels triangles chaque fichier permet de construire.

### 5.3 Tourner et inverser au changement de face

Le bord nord d’une face peut rencontrer le bord est d’une autre. Une lecture naïve de gauche à droite sur les deux images ne retrouve alors pas les mêmes points. Le voisinage doit indiquer le bord rencontré, la rotation du domaine et une éventuelle inversion de l’ordre des échantillons.

Un exemple de notre convention relie le nord de la face 1 à l’est de la face 4, avec inversion. Pour des sommets d’indice i compris entre 0 et N, le correspondant est N − i. Pour des positions de tuiles, l’indice va de 0 à 2 puissance lod − 1 : la formule d’inversion comporte donc un « moins un » supplémentaire.

![Une même suite de sommets vue sur deux bords orientés différemment](07-raccord.png)

Les couleurs identifient les mêmes positions physiques. Ce ne sont pas cinq altitudes différentes choisies pour remplir un trou. La même direction doit retrouver la même valeur de terrain, même si elle se trouve dans deux fichiers orientés différemment.

## 6 Construire une grille commune aux deux côtés du bord

### 6.1 Des cellules et des points

Une image en registration area contient un échantillon au centre de chaque pixel. Une grille en registration point contient des échantillons sur les sommets de ses cellules. Pour couvrir N cellules par axe avec les deux extrémités incluses, il faut N + 1 points par axe.

![Les centres d’un raster et les sommets d’une grille n’occupent pas les mêmes positions](06-registration.png)

Une tuile cubique de 256 cellules possède donc 257 × 257 échantillons. Cette règle s’applique au DEM et, dans notre contrat cubique, à l’imagerie. Elle permet de partager les bords même lorsqu’un bord sud rencontre un bord est sur une autre face. Les sources WMTS, elles, restent généralement en registration area : l’adaptateur effectue le rééchantillonnage. [R1, R2]

### 6.2 La formule des positions

Pour le sommet i, j d’une tuile x, y au niveau lod, nous calculons les coordonnées de face à partir de l’adresse entière et de l’indice du sommet. Aucun voisin n’est nécessaire pour déterminer cette position.

[[eq:lattice]]

À droite d’une tuile, i = N. À gauche de sa voisine, i = 0 et x augmente d’une unité. Les deux calculs décrivent la même position dans la grille de face. Sur une jonction de faces, les règles de rotation et d’inversion conduisent à la même direction.

Le calcul en double précision et la convention de normalisation doivent être communs au producteur et aux tests. Si l’on vise une égalité exacte des valeurs encodées, on vérifie les octets ou les hauteurs décodées, pas seulement une capture d’écran sur laquelle une petite fissure pourrait passer inaperçue.

### 6.3 Pourquoi le voisin ne doit pas décider de la mesure

Une tuile ne doit pas fabriquer sa dernière colonne en recopiant arbitrairement une valeur intérieure. Elle doit demander au même modèle de source la valeur du bord. Si une voisine utilise une autre origine de raster, un autre niveau source ou un autre mélange, les deux résultats peuvent différer malgré des directions identiques.

Nous imposons donc une règle plus forte que la simple égalité des coordonnées : à niveau donné, la valeur d’un échantillon dépend de sa direction et de la recette de données, pas du fichier qui la demande. Les trous réels de couverture sont des NoData ; un téléchargement interrompu demeure une erreur à reprendre.

## 7 Lire un raster depuis une direction du cube

### 7.1 Traverser les espaces de coordonnées

Nous disposons maintenant d’une direction, mais la mesure reste rangée dans une carte source. Nous allons successivement traverser trois espaces : la direction liée au corps, la position dans la projection de la source et l’indice dans son raster. Chacun utilise ses unités et ses conventions.

Une projection géographique sphérique fournit une longitude et une latitude en degrés. Une projection stéréographique polaire fournit des coordonnées planes en mètres. Une matrice de tuiles transforme ensuite ces coordonnées en pixels, puis en numéro de fichier et en position à l’intérieur du fichier.

La conversion doit être définie pour la projection du produit, pas seulement pour le corps. Deux couches d’un même astre peuvent utiliser des rayons de référence différents. Une source géographique terrestre peut attendre une latitude géodésique, alors qu’une couche lunaire sphérique utilise la latitude de la direction.

### 7.2 Revenir aux cartes géographiques

Pour une source sur une sphère, nous lisons les angles directement dans les composantes de d. L’usage de atan2 conserve le bon quadrant et évite de diviser par une composante qui pourrait s’annuler. Le résultat en radians est converti en degrés lorsque la matrice de la carte les utilise.

[[eq:geographic]]

Sur un ellipsoïde de révolution de rayon équatorial a et de rayon polaire c, la latitude géodésique du point de référence traversé par le rayon est obtenue en pondérant la composante verticale par a²/c². Cette relation décrit la surface de référence. Pour convertir un relief dont les hauteurs suivent la normale, une recherche sur le rayon est nécessaire ; nous y reviendrons dans la section sur les hauteurs.

### 7.3 Lire les sources polaires sans passer par une longitude singulière

Dans la projection stéréographique sphérique sud de notre convention, le pôle a directement les coordonnées (0, 0). Nous pouvons écrire la projection à partir des composantes de d, sans calculer sa longitude au pôle.

[[eq:polar]]

Pour une projection nord, les signes et le dénominateur changent. Ces conventions doivent être confrontées à un repère réel ; une inversion d’axe peut produire une image plausible mais en miroir. Un méridien central différent de zéro impose également une rotation préalable autour de Z. Les projections polaires terrestres ellipsoïdales demandent d’autres formules : notre adaptateur sphérique ne les couvre pas automatiquement.

### 7.4 Retrouver le centre d’un pixel

En registration area, l’origine de la matrice est le coin supérieur gauche du premier pixel. Son centre est situé un demi-pixel plus loin. Le retrait de 0,5 dans la formule est donc une conversion géométrique, et non un correctif visuel ajouté au hasard.

[[eq:pixel]]

Une source point utilise la position de son premier échantillon comme origine ; le terme 0,5 disparaît. Cette information doit être lue dans les métadonnées ou établie explicitement. L’origine et la taille des pixels ne suffisent pas si leur registration demeure inconnue.

À partir des coordonnées continues px et py, nous cherchons les quatre pixels voisins. Ils peuvent se trouver dans plusieurs tuiles sources. Le passage d’une colonne à la suivante doit traverser le bord du fichier ; il ne doit pas répéter sa dernière colonne comme si le monde s’arrêtait là.

![Les poids d’une interpolation bilinéaire sur quatre pixels](08-bilineaire.png)

Dans cet exemple, les poids totalisent un. Si une valeur est réellement absente, son poids est retiré et les autres sont renormalisés. Si toutes les valeurs manquent, le résultat est NaN. Pour l’imagerie, la gestion de l’alpha et l’espace de couleur font partie de la recette ; on ne doit pas traiter un pixel transparent comme une mesure noire du terrain.

### 7.5 Choisir le niveau source de manière reproductible

Le pas central d’une tuile cubique sur une sphère vaut approximativement πR divisé par 2N fois 2 puissance lod. Le producteur choisit le niveau source le plus grossier dont le pas est au moins aussi fin, ou le dernier niveau disponible lorsqu’aucun ne convient.

[[eq:spacing]]

Sur une pyramide géographique globale 2 × 1 de même taille de cellule, cette règle conduit typiquement au niveau source lod + 1. Le choix est fixé par le niveau cubique et les métadonnées de la source. Il ne dépend pas d’une estimation particulière à chaque tuile, qui risquerait de choisir deux niveaux sources différents de part et d’autre d’un bord.

On produit donc un niveau grossier à partir d’un niveau grossier de la source. Moyenner des tuiles fines déjà découpées introduirait une autre méthode de filtrage et une dépendance à la façon dont les fichiers ont été assemblés. Une pyramide peut employer une autre politique de filtrage, mais elle doit alors la déclarer et en démontrer les raccords.

## 8 Reconnaître les données que NASA Trek nous fournit

### 8.1 Une image du relief ne contient pas nécessairement ses hauteurs

Le Babylon affiche une carte où les fonds de cratères sont bleus et les sommets rouges. Cette image est utile pour comprendre le paysage. Elle n’indique pas, par sa seule présence, comment retrouver une hauteur en mètres. La palette, le contraste ou l’éclairage peuvent avoir transformé les valeurs d’origine.

Le nom DEM dans un catalogue ne décrit pas à lui seul les octets du service associé. Une même couche scientifique peut proposer une image de présentation par WMTS et des valeurs numériques par un autre service. Nous devons examiner le format, le nombre de bandes, la profondeur des pixels et les règles de rendu avant de choisir le décodeur.

![L’apparence de la Lune et une visualisation de ses hauteurs sont deux produits distincts](09-produits.png)

L’image LROC illustrée ici provient du CGI Moon Kit de NASA SVS. Elle est préparée pour le rendu, avec des traitements de couleur et un complément aux pôles. Le panneau LOLA représente des valeurs numériques en kilomètres du TIFF basse résolution du même kit, converties en mètres puis affichées en gris. Ces exemples servent à distinguer les produits ; ils ne montrent pas le niveau de détail de Shackleton. [R8]

### 8.2 Découvrir les couches et leurs services

Le point d’entrée de Trek fournit une configuration des corps, des projections et des URL de catalogue. Une recherche retourne des couches ; leur identifiant UUID permet ensuite d’obtenir les services effectivement proposés. La réponse peut contenir un endpoint Mosaic de type WMTS, un endpoint raster de type ImageServer, ou seulement le premier.

Nous conservons ces métadonnées avec une date de consultation. Le WKT du catalogue nous renseigne sur la projection et la surface utilisée. Les capacités WMTS décrivent le style, le modèle d’URL et les matrices. Les métadonnées ImageServer décrivent les pixels numériques et les limites d’export. Ces trois documents sont complémentaires.

![Un service d’images pour l’apparence et une source numérique pour les hauteurs](10-trek.png)

Un WMTS utilise des URL où le niveau est suivi de la ligne puis de la colonne. Il faut donc traduire notre x/y en TileCol/TileRow au bon endroit, plutôt que recopier aveuglément l’ordre du chemin cubique. L’extension du fichier et les matrices sont lues dans les capacités. [R3]

### 8.3 Les particularités à absorber dans l’adaptateur

Le brief d’intégration relève plusieurs particularités concrètes de Trek : des CRS polaires écrits EPSG::0, d’anciennes matrices conservées dans des commentaires XML et des modèles d’URL contenant un double séparateur. Il relève aussi des dénominateurs d’échelle insuffisants pour retrouver correctement le pas de certaines matrices planétaires. [R1]

L’adaptateur s’appuie donc sur le WKT et sur la géométrie de la matrice. Il ignore les commentaires XML et normalise les URL avec les fonctions existantes. Une matrice polaire de deux colonnes ne signifie pas que la donnée occupe effectivement les deux colonnes : l’emprise et les positions doivent déterminer la couverture.

Ces règles sont spécifiques aux structures observées et prises en charge. Elles ne constituent pas un lecteur universel de tous les WMTS possibles. Une structure non reconnue doit produire un diagnostic clair, avec les métadonnées nécessaires pour ajouter un adaptateur ou étendre les tests.

### 8.4 Obtenir une véritable altitude

Pour le DEM global lunaire LRO_LOLA_DEM_Global_128ppd_v04, le catalogue Trek annonce Float32 et raw. La consultation du 5 novembre 2026 confirme un service raster F32 à une bande, couvrant le globe, avec un pas de 1/128 degré. Les limites déclarées d’export sont de 15 000 pixels en largeur et 4 100 en hauteur. Ce sont des propriétés de ce service, à relire pour les autres couches. [R10]

L’opération exportImage permet de demander un TIFF en précisant l’emprise, la taille et le type numérique. Nous devons contrôler la réponse, son emprise réelle, ses dimensions, ses valeurs absentes et ses unités. Le paramètre F32 ne suffit pas à prouver qu’une fonction de rendu ou qu’un facteur d’échelle n’a pas modifié les valeurs. [R5]

Pour une petite sélection, l’ImageServer évite de télécharger un produit global. Pour une production étendue, les rasters originaux peuvent être plus adaptés. Dans les deux cas, les droits de redistribution et de transformation sont examinés pour le produit choisi, et son attribution est conservée.

## 9 Convertir les hauteurs sans déplacer le relief

### 9.1 Identifier le zéro et la direction de mesure

Une valeur d’altitude peut représenter une distance radiale, une hauteur suivant la normale d’un ellipsoïde, ou une hauteur au-dessus d’un géoïde ou d’un aréoïde. Ces quantités ont toutes des unités de longueur, mais elles ne construisent pas le même point physique. Le mot mètre ne suffit donc pas à rendre deux sources compatibles.

Pour LOLA, les produits griddés et leurs labels documentent notamment un rayon de référence lunaire de 1 737 400 m et des facteurs d’échelle selon le produit. Un entier stocké peut demander une multiplication avant de devenir une hauteur ; un rayon doit être distingué d’une différence de rayon. Nous lisons ces règles dans le produit précis, sans les déduire de son nom de fichier. [R6]

### 9.2 Changer de surface de référence

Si une source fournit une hauteur radiale hs au-dessus d’une sphère de rayon Rs et que les repères sont compatibles, le rayon physique vaut Rs + hs. La nouvelle hauteur est obtenue en retirant le rayon de la surface cible dans la même direction.

[[eq:rebase]]

À l’équateur, prenons un relief de 3 000 m au-dessus d’une sphère de 1 737 400 m. Si la surface cible atteint 1 738 100 m dans cette direction, la nouvelle hauteur est 2 300 m. Le point physique conserve son rayon de 1 740 400 m. Garder arbitrairement 3 000 m aurait déplacé ce point de 700 m.

Cet exemple ne définit pas un décalage constant applicable à toute la Lune. Sur une surface cible non sphérique, le rayon de référence dépend de la direction. Un changement de repère spatial demande en outre une transformation des coordonnées ; il ne se réduit pas à cette soustraction.

### 9.3 Traiter les hauteurs géodésiques

Une source terrestre exprime souvent une hauteur au-dessus d’un géoïde. Nous ajoutons d’abord son ondulation pour obtenir une hauteur ellipsoïdale selon la convention documentée. Nous cherchons ensuite le point du relief situé sur le rayon cible, en interrogeant la source à la latitude et à la longitude géodésiques correspondantes.

Dans l’implémentation, radialHeightOnRay effectue une recherche itérative. La convergence doit être contrôlée pour les sources et les reliefs que l’on accepte. Appliquer directement la hauteur normale comme hauteur radiale peut déplacer horizontalement le relief, particulièrement lorsque l’aplatissement ou l’altitude augmente. [R1]

### 9.4 Encoder le résultat numérique

Terrarium représente la hauteur par trois canaux de couleur, avec un pas de 1/256 m. Nous arrondissons d’abord l’entier global, puis nous séparons les canaux afin de gérer correctement les retenues. Une valeur absente est encodée par un pixel transparent ; elle doit rester distincte de la hauteur minimale valide.

[[eq:terrarium]]

La plage représentable va de −32 768 m à 32 768 m moins 1/256 m. Une valeur hors plage est une erreur explicite ; elle n’est pas rabattue sur la borne. Un encodage Float32 peut être choisi pour un dataset qui demande une autre plage. Un TIFF Float32 n’est pas, pour autant, automatiquement sans facteur d’échelle.

Le PNG de Terrarium doit conserver les valeurs des canaux : pas de compression avec perte, de correction gamma appliquée aux nombres ni de prémultiplication de l’alpha avant décodage. Le pas millimétrique d’encodage ne transforme pas un DEM de plusieurs mètres de précision en mesure millimétrique.

## 10 Traverser plusieurs sources autour de Shackleton

### 10.1 Descendre sans charger la Lune entière en haute résolution

Depuis l’orbite, une couverture globale suffit à donner la forme générale du relief. En approchant du pôle sud, une source polaire plus fine devient utile. Près de Shackleton, une autre source peut préciser les pentes et le rebord. Nous conservons un seul dataset cubique en sortie tout en changeant progressivement les données qui l’alimentent.

Le brief propose trois paliers : une source globale d’environ 237 m par pixel, une source polaire à 30 m et une source polaire à 5 m. Les niveaux cubiques retenus sont respectivement 6, 9 et 11, avec des sous-arbres centraux pour les deux derniers. Le pas central cubique et le pas source ne sont pas toujours identiques ; le niveau 6 n’ajoute pas des détails absents de la source globale. [R1]

### 10.2 Fondre des hauteurs déjà compatibles

Un changement brutal de source peut révéler un désaccord de résolution, de datum ou de traitement. Nous harmonisons d’abord les hauteurs et leurs repères. Nous définissons ensuite une pondération qui dépend de la direction, par exemple de la latitude planétocentrique absolue.

[[eq:blend]]

![Des bandes de transition définies par la latitude et communes aux tuiles](12-fusion.png)

Dans cet exemple, la transition vers la source à 30 m se déroule entre 76° et 78°, puis celle vers la source à 5 m entre 87,6° et 88,6°. Les bandes sont choisies à l’intérieur des emprises valides. Les poids global, régional et fin sont construits pour totaliser un. Une valeur sans donnée appelle un repli documenté, pas une moyenne avec zéro.

Cette transition résout une couture de données ; elle ne corrige pas une mauvaise calibration ni un repère erroné. Une carte des écarts entre sources, accompagnée de points de contrôle, reste nécessaire pour comprendre ce que le mélange masque ou conserve.

### 10.3 La finesse de la grille et la qualité de la mesure

Les produits LOLA régionaux à 5 m sont particulièrement utiles au pôle, où les observations laser ne dépendent pas de l’éclairage comme une image visible. Les produits PGDA consacrés aux sites 1, 4, 7 et 11 signalent toutefois une forte part d’interpolation, proche de 90 % des pixels de 5 m. Ils fournissent aussi des informations d’incertitude. Il ne faut pas convertir leur pas de grille en une précision uniforme de cinq mètres ou en une observation indépendante à chaque pixel. [R7]

L’imagerie du rebord éclairé et celle d’un fond constamment obscur posent également des problèmes distincts. On documente la caméra, les conditions d’éclairage, les lacunes et les assemblages de mosaïque. Une zone noire dans une photographie n’est pas une hauteur inconnue dans un DEM laser, et une zone éclaircie par traitement n’est pas une nouvelle mesure topographique.

### 10.4 Appliquer la même méthode à Mars

Les adresses cubiques ne changent pas lorsque le Babylon se tourne vers Mars. La face 5 reste la face sud, mais le rayon et les données changent. Avec les sphères de référence des exemples Trek, un niveau 8 de 256 cellules donne un pas central d’environ 41,6 m sur la Lune et 81,4 m sur Mars. Le niveau seul ne peut donc pas exprimer une résolution commune aux deux mondes.

La référence verticale demande une attention particulière. Les produits MOLA MEGDR distinguent notamment le rayon planétaire, l’aréoïde, la topographie et les nombres d’observations. La topographie est la différence entre le rayon planétaire et celui de l’aréoïde. Pour construire une hauteur radiale sur notre ellipsoïde, nous devons retrouver le rayon physique, à partir de la carte de rayons ou d’une topographie accompagnée de sa référence d’aréoïde. [R11]

Soustraire directement le rayon moyen de Mars à une topographie déjà relative à l’aréoïde serait donc incorrect. Il faut identifier le produit exact, ses échelles et ses conventions. De même, une carte colorée MOLA ne fournit pas les hauteurs numériques simplement parce que ses couleurs suivent l’altitude.

Les couches régionales CTX ou HiRISE peuvent compléter l’apparence lorsqu’elles existent sur la zone étudiée. Elles ne créent pas automatiquement un DEM de même finesse. Le service publie donc des disponibilités distinctes pour l’imagerie et l’élévation, avec des repères vérifiés et des niveaux maximaux propres à chaque source.

## 11 Mettre les étapes en œuvre

### 11.1 Réutiliser les primitives communes

L’adressage, les projections et le rééchantillonnage sont fournis par les bibliothèques du moteur. Le service doit réutiliser ces primitives : une seconde implémentation de la face sud risquerait d’évoluer différemment de celle du client. Les rôles restent séparés entre géométrie des tuiles, décodage des rasters, conversion des hauteurs et transport réseau.

![La chaîne de traitement garde un contrôle explicite à chaque changement d’espace](11-chaine.png)

Dans le code du projet, les fonctions de reprojection sont exportées par @spacexr/tiles/reprojection. Les surfaces et les descripteurs cubiques sont exposés par @spacexr/tiles/cube. L’encodage Terrarium et la recherche des hauteurs radiales à partir d’un relief géodésique appartiennent aux outils de DEM. Le code de conversion radiale entre surfaces sphériques et cibles se trouve également dans le module de reprojection de la version examinée. [R1]

### 11.2 Charger les blocs nécessaires

L’extrait suivant illustre l’assemblage. Les objets source et load sont des adaptateurs préparés : ils connaissent déjà la projection, la matrice, l’encodage et les règles d’absence de leur produit. load doit lever une erreur en cas de panne temporaire. Il ne retourne undefined que pour une absence de données reconnue.

```ts
import {
  cubeTileSourceTiles, resampleCubeTile
} from "@spacexr/tiles/reprojection";

// La matrice source a été choisie pour ce niveau cube.
const blocks = new Map();
for (const tile of cubeTileSourceTiles(address, source)) {
  const block = await load(tile.column, tile.row);
  blocks.set(`${tile.column}/${tile.row}`, block);
}

const samples = resampleCubeTile(
  address, source,
  (col, row, x, y, channel) =>
    blocks.get(`${col}/${row}`)?.pixel(x, y, channel)
      ?? Number.NaN,
  { tileSize: 256, channels: 1 }
);
```

Cet extrait est volontairement indépendant du fournisseur. Il ne constitue pas, seul, un client Trek complet : la découverte, la validation des métadonnées et le décodeur numérique doivent être fournis. Sa boucle de chargement est séquentielle pour la lecture ; une production utilisera une concurrence bornée et un cache de blocs partagé entre demandes.

### 11.3 Encoder après la conversion physique

Lorsque samples contient des hauteurs radiales en mètres sur la surface déclarée, le producteur peut construire la grille et l’encoder. Cette condition est essentielle : le codec ne devine pas les unités, le datum ni le sens des axes.

```ts
import {
  createHeightGrid, encodeTerrariumGrid
} from "@spacexr/dem";

const grid = createHeightGrid(257, 257, samples);
const rgba = encodeTerrariumGrid(grid);
// Encoder ensuite rgba en PNG sans modifier les canaux.
// L’adaptateur PNG dépend de l’environnement d’exécution.
```

Le producteur vérifie le nombre d’échantillons, la plage des hauteurs et la conservation de l’alpha. Les tests comparent ensuite le PNG décodé à la grille numérique. Un fichier qui s’ouvre dans un navigateur n’est pas une preuve suffisante que les hauteurs ont été préservées.

### 11.4 Valider les sorties avant de les distribuer

Nous commençons par les six centres de face, les douze jonctions et les huit sommets du cube. Nous comparons ensuite des bords complets, y compris ceux qui changent d’orientation. Nous testons le méridien de coupure, les deux pôles et des points proches d’une limite de couverture.

Une comparaison source géographique–source polaire constitue un contrôle utile lorsqu’elles décrivent le même produit. Elle ne remplace pas la vérification de leur date, de leur référence et de leur traitement. Enfin, les mêmes demandes sont exécutées dans des ordres différents : le résultat d’une tuile ne doit pas dépendre de celle qui a été chargée avant elle.

## 12 Afficher le terrain sans confondre ses résolutions

### 12.1 Le maillage et le DEM n’ont pas la même fonction

Une texture de 257 × 257 hauteurs peut accompagner un maillage de seulement 16 cellules par côté. Le shader peut lire des hauteurs détaillées, mais les triangles restent ceux du maillage. La silhouette d’un petit cratère ne devient pas détaillée simplement parce que sa valeur existe dans la texture.

![La résolution des triangles, des hauteurs et de l’apparence peut évoluer séparément](13-precision.png)

Les grilles dessinées sont simplifiées pour que leurs cellules restent lisibles. Elles illustrent trois densités indépendantes ; les dimensions numériques utilisées dans un moteur sont choisies séparément pour chaque ressource.

Le choix du niveau de terrain dépend de l’erreur géométrique projetée à l’écran. Celui de l’imagerie dépend du pas des texels. Les deux demandes peuvent évoluer séparément pour une même caméra. Sur une région plate, nous pouvons conserver peu de triangles et demander une image fine ; sur un rebord escarpé, le maillage doit se raffiner.

### 12.2 Passer d’une erreur en mètres à une erreur en pixels

Dans une approximation perspective simple, une erreur géométrique e à la distance D se projette avec une taille proportionnelle à la focale en pixels. Celle-ci dépend de la hauteur de l’écran et du champ de vision vertical. Un doublement de la distance divise approximativement par deux l’erreur visible.

[[eq:sse]]

La grandeur e doit représenter l’erreur ou le pas pertinent du maillage, selon la politique retenue. Une heuristique basée sur la longueur d’un bord divisée par le nombre de cellules est utile, mais n’est pas une borne démontrée de l’erreur d’un relief arbitraire. La rugosité et l’écart par rapport à l’approximation parente demandent leur propre mesure si l’on veut une borne plus forte.

Les volumes de culling doivent contenir le terrain physique sur l’ellipsoïde et toute la plage de hauteurs retenue. Échantillonner quelques directions est un point de départ, pas une preuve générale d’enveloppe conservative. La marge géométrique et ses hypothèses doivent être testées sur les rayons, les aplatissements et les reliefs pris en charge.

### 12.3 Préserver les détails près de la caméra

Les positions liées au corps peuvent valoir plusieurs millions de mètres. Les envoyer telles quelles en flottants simples au GPU peut faire perdre une précision utile près du sol. Le CPU calcule donc en double précision les positions de référence et les décalages locaux ; le GPU manipule des valeurs relatives à une origine proche.

Les normales de la surface et celles du relief doivent respecter le même modèle de hauteur radiale. Une lumière bien calculée ne corrigera pas une mauvaise direction de déplacement. De même, un raccord topologique entre deux niveaux de maillage reste nécessaire même lorsque les DEM des deux tuiles partagent exactement leur bord.

## 13 Concevoir un accès cubique aux données Trek

### 13.1 Publier un contrat compréhensible par le client

Le service à construire expose un descripteur de dataset et des URL de tuiles. Le descripteur indique le corps, le repère, les trois rayons de référence, le contenu, l’encodage, la taille en cellules et les niveaux disponibles. Les régions plus détaillées sont déclarées par des sous-arbres.

L’exemple ci-dessous décrit une configuration cible simplifiée. Son URL est illustrative. Il ne constitue pas une annonce de disponibilité d’un service réel, et le repère doit être relié à la réalisation exacte des produits sélectionnés avant publication.

```json
{
  "scheme": "spacexr-cube-equiangular/1",
  "body": "Moon",
  "frame": "MOON_ME",
  "referenceRadii": [1737400, 1737400, 1737400],
  "content": "elevation",
  "encoding": "terrarium",
  "tileSize": 256,
  "minLOD": 0,
  "maxLOD": 6,
  "subtrees": [],
  "tiles": "https://tiles.example.org/moon/v1/{face}/{z}/{x}/{y}.png"
}
```

Le client ne doit pas demander une tuile hors de la disponibilité déclarée. Le catalogue d’administration conserve séparément les recettes, les sources, les conditions de transformation, les vérifications de datum et les tâches de préparation. Un brouillon décrit une intention ; une révision publiée engage le service à fournir les données annoncées.

### 13.2 Générer une fois et servir plusieurs fois

Une première stratégie prépare toute la couverture choisie. Une seconde génère les détails à la demande. Une combinaison des deux permet de préparer la base et les régions de travail, puis d’étendre le stockage lorsque de nouveaux besoins apparaissent. Le calcul lourd peut être exécuté hors de la requête HTTP.

![Le stockage des résultats et le cache de distribution ont des rôles distincts](14-cache.png)

R2 conserve les fichiers produits. Le cache CDN évite de relire le stockage à chaque demande. L’expiration de ce cache ne signifie donc pas qu’il faut réinterpoler le DEM. Les tuiles validées sont placées dans des révisions immuables ; changer de source, de datum ou de méthode crée une nouvelle révision. [R9]

Le cache des blocs NASA constitue un troisième niveau, distinct du cache des résultats cubiques. Plusieurs tuiles de sortie peuvent lire les mêmes blocs sources. Une empreinte de recette doit identifier les versions, les conventions de registration, le mélange et l’encodage, afin qu’une ancienne valeur ne soit pas réutilisée après une modification du traitement.

### 13.3 Répondre correctement lorsqu’un calcul manque

Une URL de tuile attend des octets du format annoncé. Le client HTTP actuel accepte les réponses 2xx comme un contenu ; lui retourner un statut 202 accompagné de JSON de suivi conduirait à décoder ce JSON comme une image. Le suivi des tâches appartient donc à une route de préparation distincte.

La livraison retourne une tuile valide, une absence réelle de couverture, ou une erreur temporaire réessayable. Pour les traitements longs, l’administration prépare la zone et ne publie le raffinement qu’une fois sa disponibilité établie. Une évolution ultérieure du client pourra ajouter un protocole explicite d’attente ; elle ne doit pas être supposée déjà présente.

### 13.4 Mesurer avant de choisir le lieu du calcul

Les formules de reprojection sont exécutables dans un environnement JavaScript de Worker. Le coût total dépend néanmoins des décodeurs, de la mémoire de travail, du nombre de blocs demandés et de la latence du fournisseur. Nous mesurerons les cas chauds et froids, les bords de face et les régions polaires avant d’autoriser une génération synchrone.

Une production numérique doit également borner la concurrence, la taille des exports et les reprises. Une panne amont ne doit pas créer une image transparente mise en cache pendant un an. Le système distingue une zone réellement sans donnée, une tâche en attente et une requête ayant échoué.

## 14 Estimer le volume de données

### 14.1 Compter les tuiles sans confondre les niveaux

Au niveau L, le cube entier contient 6 × 4 puissance L tuiles. Une pyramide qui conserve tous les niveaux de zéro à L contient la somme géométrique suivante.

[[eq:count]]

Un niveau supplémentaire multiplie approximativement le stockage total par quatre. Le nombre de racines ne suffit cependant pas à comparer deux schémas : à niveau identique, notre cube a un pas central deux fois plus fin que la grille géographique 2 × 1 de même taille en cellules. Comparer seulement les numéros de niveau donnerait une conclusion trompeuse.

[[table:budget]]

Ces valeurs comptent une seule couche, une seule révision, toutes les faces et tous les niveaux. Le Float32 est calculé exactement à partir de 257 × 257 valeurs de quatre octets. L’imagerie est une estimation de 50 Ko par tuile ; son volume réel dépend du contenu et du codec. Les fichiers originaux, les blocs de travail et les anciennes révisions s’ajoutent à ces volumes.

### 14.2 Raffiner des sous-arbres et retirer les recouvrements

Pour les trois paliers lunaires du brief, la base globale jusqu’au niveau 6 comporte 32 766 tuiles. Les quatre sous-arbres polaires de niveau 2 à niveau 9 en contiennent 87 380, mais une partie appartient déjà à la base. Les quatre sous-arbres centraux de niveau 5 à niveau 11 en contiennent 21 844, avec un nouveau recouvrement.

En comptant l’union de ces adresses, nous obtenons 139 262 tuiles pour cette configuration imbriquée : 32 766 de base, 86 016 nouvelles au premier raffinement, puis 20 480 au second. Leur stockage Float32 représente environ 36,8 Go décimaux. Cette estimation ne prouve pas que chaque adresse possède une observation indépendante ; elle compte les fichiers de sortie prévus.

Cette méthode de comptage évite deux excès : raffiner une face entière pour couvrir une petite région et additionner plusieurs fois les niveaux communs. Elle permet aussi de présenter à l’utilisateur le coût d’une nouvelle sélection avant de lancer la préparation.

## 15 Vérifier sa compréhension

### 15.1 Exercices

Exercice 1. Une direction vaut (0, 0, −1). Déterminer sa face et ses coordonnées u, v. Que devient sa longitude au pôle exact ?

Exercice 2. Une tuile contient 256 cellules par axe. Calculer son nombre d’échantillons, puis le nombre d’octets d’un DEM Float32 non compressé. Comparer avec une image ordinaire de 256 × 256 pixels.

Exercice 3. Une hauteur radiale de 3 000 m utilise une sphère de rayon 1 737 400 m. Dans la direction étudiée, la surface cible a un rayon de 1 738 100 m. Trouver la nouvelle hauteur et vérifier la conservation du rayon physique.

Exercice 4. Le nord de la face 1 rejoint l’est de la face 4 avec inversion. Quel indice de sommet correspond à i = 64 pour N = 256 ? Quel indice de tuile correspond à k = 2 lorsque lod = 3 ?

Exercice 5. Un service annonce un PNG de 256 × 256 pixels pour une couche appelée DEM. Quelles informations manquent pour décider si ce fichier peut être utilisé comme altitude ? Que faut-il vérifier si le catalogue fournit aussi un ImageServer ?

### 15.2 Corrigés

Pour l’exercice 1, la direction choisit la face 5. Elle arrive au centre u = v = 0,5. La longitude n’y identifie pas une position distincte ; les coordonnées de la face, elles, restent utilisables.

Pour l’exercice 2, nous obtenons 66 049 échantillons et 264 196 octets, soit environ 264,2 Ko décimaux. Une image de 256 × 256 contient 65 536 pixels et n’inclut pas, en registration area, les sommets de bord de la grille cubique.

Pour l’exercice 3, la nouvelle hauteur vaut 2 300 m. Les deux représentations donnent un rayon physique de 1 740 400 m. Seule la référence change ; le relief ne se déplace pas.

Pour l’exercice 4, le sommet correspondant vaut 256 − 64 = 192. L’indice de tuile vaut 8 − 1 − 2 = 5. Les deux formules diffèrent parce que les sommets incluent les deux extrémités.

Pour l’exercice 5, il manque au minimum le sens numérique des canaux, leur profondeur, les unités, l’échelle, le NoData, le datum et la registration. Une image de présentation n’est pas déduite comme hauteur à partir de son nom. Pour l’ImageServer, on vérifie notamment les valeurs brutes, le format d’export et les transformations appliquées, puis on les confronte aux métadonnées du produit.

### 15.3 Retour sur le pont du Babylon

La caméra peut désormais traverser le pôle sans que toutes les colonnes de la carte se disputent un même sommet. Le cube a organisé les directions ; l’ellipsoïde a fixé la surface de référence ; le DEM a donné sa hauteur au relief. Les trois décisions restent séparées et peuvent donc être contrôlées.

Lorsque nous poursuivrons notre descente vers Shackleton, la difficulté ne sera plus de savoir où ranger le pôle. Elle sera de choisir la donnée adaptée, de respecter sa signification et de ne charger que le détail que l’écran peut montrer. Les raccords, les référentiels et les métadonnées sont alors aussi importants que la vitesse du shader.

## Repères de vocabulaire

| Terme | Sens dans ce chapitre |
| Direction | Vecteur non nul qui définit un rayon depuis le centre du corps |
| Face | L’un des six domaines carrés d’adressage du cube |
| LOD | Niveau de subdivision du quadtree |
| Surface de référence | Ellipsoïde ou sphère sur lequel les hauteurs sont définies |
| Hauteur radiale | Distance le long du rayon, relative à cette surface |
| Registration | Position des échantillons dans les cellules du raster |
| NoData | Absence de mesure exploitable, distincte d’une hauteur nulle |
| Rééchantillonnage | Calcul d’une valeur sur une nouvelle grille |
| WMTS | Service de tuiles cartographiques destiné à distribuer des images |
| ImageServer | Service raster pouvant, selon le produit, exposer des valeurs numériques |
| Révision | Ensemble cohérent et identifié de résultats d’une même recette |
| Cache | Copie réutilisable dont la clé et les règles de validité sont explicites |

## Références et données

[R1] Projet 3d-tiles-core. Spécifications celestial-tiling.md, cube-sources.md, raster.md, dem.md et tiles.md ; implémentations des modules cube et reprojection et de radialHeightOnRay. État examiné le 5 novembre 2026. Les conventions du cube décrites ici sont celles du projet.

[R2] Open Geospatial Consortium. Two Dimensional Tile Matrix Set and Tile Set Metadata. Référence du modèle de cellules et des matrices. https://docs.ogc.org/is/17-083r4/17-083r4.html

[R3] NASA Solar System Treks. WMTS Layer Services pour la Lune. Description des capacités et des modèles d’URL. https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon

[R4] NASA PDS. Définition de reference_frame_id et exemple MOON_ME_DE421 ; NASA NAIF, Reference Frames. https://pds.nasa.gov/datastandards/documents/dd/current/PDS4_PDS_DD_1J00/webhelp/all/ch05s710.html et https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html

[R5] Esri. ArcGIS REST API, Export Image. Paramètres et propriétés du résultat d’un export raster. https://developers.arcgis.com/rest/services-reference/enterprise/export-image/

[R6] PDS Geosciences Node. Frequently Asked Questions About LOLA Data. Labels, facteurs d’échelle et références des produits LOLA. https://pds-geosciences.wustl.edu/missions/lro/lola_faq.htm

[R7] NASA Planetary Geodesy Data Archive. High Resolution LOLA Topography for Lunar South Pole Sites. Informations sur les sites et les incertitudes des modèles à 5 m. https://pgda.gsfc.nasa.gov/products/78

[R8] NASA Scientific Visualization Studio. CGI Moon Kit. Produits utilisés dans la figure de comparaison : lroc_color_2k.jpg et ldem_4.tif. Crédit NASA SVS et équipes LRO LROC et LOLA. https://svs.gsfc.nasa.gov/4720/

[R9] Cloudflare. Public Buckets et Workers Limits. La distribution et les budgets d’exécution se configurent selon l’environnement choisi. https://developers.cloudflare.com/r2/buckets/public-buckets/ et https://developers.cloudflare.com/workers/platform/limits/

[R10] NASA Trek. Métadonnées du service LRO_LOLA_DEM_Global_128ppd_v04 consultées le 5 novembre 2026. Les limites relevées ne sont pas extrapolées aux autres couches. https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_128ppd_v04/ImageServer?f=pjson

[R11] PDS Geosciences Node. MGS MOLA MEGDRs. Définition des cartes de rayon planétaire, d’aréoïde et de topographie. https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
