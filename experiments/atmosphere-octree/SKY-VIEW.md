# Rendu HD et seuil local de reutilisation

Le prototype affiche maintenant une image native 1920 x 1080. Il ne redimensionne pas une image 96 x 54. La Sky-View est un cache directionnel, reconstruit sur GPU depuis une LUT solaire ellipsoidale 3D. Le soleil, les phases Rayleigh/Mie et la silhouette du globe sont calcules a la definition de sortie.

Trois textures 2D RGBA16F 256 x 128 contiennent les contributions Rayleigh, Mie et la transmittance, soit 786432 octets. Les deux cotes de l'horizon ont des lignes separees. L'elevation est concentree non lineairement autour d'un horizon calcule sur l'ellipsoide, avec variation selon l'azimut. Le chemin normal ne telecharge pas les pixels. L'export PNG et les sondes de validation le font explicitement hors boucle.

## Deux formules de decision

Pour un deplacement local d = (est, nord, altitude), en metres, on definit :

```text
R(d) = max( max_k |J_k B d| / epsilon_pixel,
            (sE |dE| + sN |dN| + sH |dH|) / epsilon_couleur )

T_reutilisation = eta / R(v)
```

B transforme les axes locaux en ECEF. J_k est la derivee du deplacement normal de l'horizon au point ecran k, en pixels par metre ECEF. Les s sont des sensibilites photometriques en niveaux RGB sur 255 par metre. v est la vitesse locale en metres par seconde. T suppose une vitesse constante; si R(v)=0, il n'impose aucune echeance. La marge eta vaut ici 0.5 : reconstruire des que R(d) atteint 0.5. Le deplacement est toujours cumule depuis la construction du cache, pas depuis la derniere image.

Les tolerances 0.5 pixel et 2 niveaux RGB sont des choix d'ingenierie, pas des seuils perceptifs universels. Le facteur de securite ne transforme pas le modele local en borne mathematique certifiee. La duree doit aussi respecter le domaine local explore et les changements de modele.

## Derivee geometrique sans approximation spherique

Avec Q = diag(1/a^2, 1/a^2, 1/b^2), p la position ECEF et r(u,v) le rayon perspective non normalise, la silhouette est la conique :

```text
F = (p^T Q r)^2 - (p^T Q p - 1)(r^T Q r) = 0
J = -grad_p(F) / sqrt((F_u / largeur)^2 + (F_v / hauteur)^2)
grad_p(F) = 2(p^T Q r) Qr - 2(r^T Q r) Qp
```

Les racines sont cherchees sur des lignes et colonnes de l'ecran. La formule prend en compte les deux axes de l'ellipsoide, latitude, altitude, orientation, champ de vue et definition. Doubler la definition double la sensibilite en pixels. Si aucun horizon n'est visible, ce critere seul ne limite pas la reutilisation. Une rotation seule reutilise le cache couvrant tout le ciel, mais les points d'horizon du champ observe doivent etre recalcules pour une decision future.

## Calibration photometrique et resultat mesure

Le bouton `Mesurer le seuil camera` construit six caches de reference a des positions +/- est, nord et altitude, puis compare un ancien cache reprojecte dans la nouvelle geometrie au cache neuf. Les sensibilites retiennent le maximum des differences centrales et unilaterales. L'erreur inclut exposition, tone mapping, transmittance et globe uni. Elle ne mesure pas l'erreur physique totale du modele. Les erreurs de quadrature et de discretisation existantes restent presentes.

Cas mesure : WGS84, position equatoriale a 60 km, aube, exposition 12, 1920 x 1080, tangentes de demi-champ (0.8, 0.45), Sky-View 256 x 128, 64 echantillons, LUT solaire 128 x 32 x 32. Soleil fixe [-0.0499376, 0.9987523, 0]. 438 rayons dont des sondes a 1, 3 et 8 pixels de l'horizon; 35 points pour la conique.

| Axe | Geometrie, px/m | Couleur, niveaux/m | Limite du modele, un axe seul | Proposition avec eta=0.5 |
| --- | --- | --- | --- | --- |
| Est | 0.000186644 | 0.000482326 | 2679 m | 1339 m |
| Nord | 0.000151528 | 0.000137993 | 3300 m | 1650 m |
| Altitude | 0.001741436 | 0.002449608 | 287 m | 144 m |

Les seuils par axe ne peuvent pas etre cumules independamment. Utiliser R(d) pour un mouvement mixte. Les trois validations mixtes independantes atteignent respectivement 0.4984, 0.4996 et 0.4993 pixel, avec 0.661, 0.305 et 0.372 niveau maximal de couleur. Pour un ecart est de 64 mm : 0.00001195 pixel et 0.0166 niveau de couleur. La quantification RGBA16F et les calculs float32 introduisent un bruit, particulierement visible a cette tres petite distance.

L'horizon est compare a une nouvelle conique resolue numeriquement, independamment de la derivee. Les couleurs sont comparees a un nouveau cache GPU de meme qualite. Ces quelques positions et rayons valident localement une approximation, ils ne couvrent pas tous les pixels ni toutes les trajectoires. Les pas de calibration sont 600/600/60 metres. Le plafond de 32 fois ces pas est un garde-fou d'extrapolation, pas une plage entierement mesuree.

Un changement de soleil, profils, exposition, qualite de LUT, projection ou region demande une nouvelle evaluation. Le disque solaire direct et les effets de lentille ne font pas partie de la calibration. Nuages, relief, ombres de terrain et integration Babylon/XR restent a ajouter. Les vues internes et spatiales ont des entrees de calcul distinctes et la transition de regime doit reconstruire le cache.

## Performances et limites d'integration

Le rapport exporte `outputs/sky-view-full-hd-report.json` conserve tous les chiffres de cette execution. Mesures GPU : construction solaire 3.60 ms, construction Sky-View 5.96 ms, presentation HD mediane 0.459 ms, soit 6.42 ms pour construction Sky-View plus presentation. D'autres executions ont donne environ 15 a 16 ms pour la construction et 1 a 2 ms pour la presentation. Ce sont des passes GPU isolees, pas une garantie de cadence moteur ou XR. Compilation, validation et calibration sont hors boucle.

Les fonctions `reuseScore` et `reuseDuration` sont utilisables pour un futur ordonnanceur. Le chemin de presentation conserve volontairement sa reconstruction obligatoire apres translation. La reutilisation avec translation est testee sur des sondes; elle n'est pas encore activee pour toutes les images. Une politique finale devra mettre a jour les metadonnees geometriques et suivre le budget cumule, avec invalidation aux changements de regime et parametres.

Verification : 48 tests Node, dont conique deplacee, dependance a la definition, altitude constante, budget couleur mixte et duree de reutilisation. Validation GPU directe sur 336 rayons : RMSE radiance 0.0002945, erreur maximale 0.004547, erreur maximale de transmittance 0.01126. Cela ne constitue pas une implementation complete du papier de Hillaire : le modele reste en diffusion simple.

Pour essayer : `npm start`, choisir l'aube, cliquer `Rendu HD`, puis `Mesurer le seuil camera`. `Animer le regard` reutilise les textures sans translation. `PNG natif` exporte 1920 x 1080; `Rapport JSON` conserve les mesures.
