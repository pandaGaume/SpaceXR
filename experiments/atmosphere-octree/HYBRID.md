# Essai hybride : octree solaire et volume camera

## Architecture implementee

Le milieu reste defini par l'altitude geodesique au-dessus de l'ellipsoide. L'octree persistant cache uniquement la transmittance vers le Soleil. Chaque camera ou oeil possede ensuite son propre volume de radiance et de transmittance RGB cumulatives.

`integrateProfile` parcourt chaque rayon une seule fois et conserve le resultat aux profondeurs demandees. Les tranches sont distribuees selon une loi cubique pour concentrer la resolution pres de la camera. La profondeur est mesuree selon l'axe avant de la camera, pas comme la longueur du rayon. Chaque colonne convertit donc ses plans de profondeur en distances physiques.

`FrustumVolume` construit la reference CPU. `GpuFrustumVolume` realise deux passes WebGPU :

1. Un thread par colonne angulaire accumule les contributions et ecrit les tranches dans deux textures 3D RGBA16F. Les coefficients sont calcules dans le milieu ellipsoidal; le cache solaire vient du storage buffer de l'octree.
2. La reconstruction consulte ces deux textures avec un filtrage trilineaire. La profondeur de scene choisit la tranche, puis la composition applique `terrain * transmittance + radiance`.

Les profils sont cumulatifs, donc chaque tranche ne recommence pas l'integration depuis la camera. Le nombre de colonnes reste petit et le parcours de profondeur est sequentiel dans chaque thread; cette configuration peut limiter l'occupation du GPU. Elle est un point de comparaison, pas une organisation optimale demontree.

## Utilisation

```powershell
npm test
npm run benchmark:hybrid
npm start
```

Dans la demo, choisir `Hybride CPU` ou `Hybride WebGPU`. Deux resolutions sont disponibles : 12 x 8 x 48 et 24 x 16 x 64. Les scenes de test sont le ciel/globe, une surface a 10 km et une rupture de profondeur de 5 km a 20 km. Cette derniere scene est un tampon de profondeur synthetique et une couleur de terrain constante, pas un terrain Babylon.

Le champ camera a ete rendu orthogonal dans tous les modes de la demo pour que rayons directs et volume camera aient exactement la meme projection. La camera est immutable : apres un deplacement ou changement de projection, reconstruire son volume. Deux yeux partagent le meme octree, mais conservent deux volumes distincts. Aucun raccord XR de production n'a ete ajoute.

## Protection des artefacts

Le volume ne filtre pas entre colonnes sol/ciel lorsque la profondeur demandee atteint la silhouette. Une bande proche de l'ellipsoide, dimensionnee selon l'empreinte angulaire de la cellule, utilise aussi le ray marching direct. Les requetes depassant le plan lointain ont le meme repli. Les points avant la silhouette restent eligibles au cache, meme si des colonnes voisines finissent par toucher le globe.

Le repli CPU utilise l'octree. Le repli GPU execute le shader de ray marching sur les seuls rayons concernes, avec leur propre profondeur maximale; il n'effectue pas d'integration solaire sur CPU. La preparation des requetes et du masque de protection reste CPU dans ce prototype.

Les deux textures RGB sont interpolees dans le volume. Une texture par profondeur angulaire n'impose aucune atmosphere spherique. En revanche, cela ne garantit pas une erreur uniforme : l'horizon, les variations rapides de phase solaire, les limites des replis et le changement temporel de LOD doivent encore etre travailles. Il n'y a ni reprojection temporelle ni transitions temporelles des volumes.

## Resultats mesures

Les mesures CPU completes sont dans `hybrid-benchmark-results.json`. Elles incluent construction du volume et replis, et comparent deux qualites; l'octree reste chaud entre ces deux essais. Sur une sortie 48 x 27, les cas sol donnent environ 1.7 a 1.9 fois de gain total avec la grille 24 x 16 x 64. Cette observation CPU ne predit pas le gain GPU. Les surfaces vues depuis l'orbite sont toutes traitees par repli dans le cas teste, ce qui annule l'interet du volume pour cette vue.

Le test GPU navigateur avec rupture de profondeur, sortie 32 x 18 et volume 24 x 16 x 64 donne :

| Etape | Temps de passe GPU |
| --- | --- |
| Ray marching direct | 2.49 ms |
| Construction du volume | 13.17 ms |
| Reconstruction filtree | Sous la granularite du timestamp dans cet essai |
| Rayons de repli (76 sur 576) | 2.75 ms |

Les textures du volume occupent 393216 octets, hors octree et buffers de travail. L'erreur maximale de transmittance du rendu hybride GPU par rapport a la reference CPU est 0.00130 sur cet essai. La radiance RMSE est environ 1.92e-5. Les mesures GPU sont ponctuelles, a tres faible resolution, et ne constituent pas un benchmark XR.

La construction du cache solaire reste CPU et la demo construit aussi le volume CPU pour valider le volume GPU. Ces couts sont affiches separement et ne doivent pas etre oublies dans une future boucle de rendu. Les timestamps GPU excluent compilation, uploads, preparation des requetes et lectures retour; le champ `ms` mesure le temps mural de chaque appel.

Le resultat est donc un essai fonctionnel, pas un gain acquis : la lecture du volume est bon marche, mais sa construction et les replis dominent encore. Les vues de ciel a grande distance gardent des erreurs maximales de transmittance de quelques pour cent aux resolutions essayees. Une Sky-View LUT distincte pour le ciel lointain et une portee plus courte pour la perspective atmospherique sont des suites a comparer, comme dans l'organisation de Hillaire.

## Validation

La suite compte 22 tests, dont sept pour l'hybride : checkpoints cumulatifs, correspondance aux noeuds du volume, interpolation a profondeur finie, protection de silhouette, stereo, entrees invalides et empreinte au sol. Les deux passes WebGPU ont ete compilees et executees sur le navigateur de la demo, avec une comparaison a la reference CPU. L'absence de mosaique perceptible n'est pas certifiee par ces tests; la carte d'erreur amplifiee sert a examiner les cas restants.
