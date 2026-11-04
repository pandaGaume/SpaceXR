# LUT solaire 3D pour atmosphere ellipsoidale

## Mode implemente

La texture remplace les integrations repetees vers le Soleil. Elle ne remplace pas encore la marche du rayon de vue. Le meme cache alimente soit le rendu atmospherique direct, soit la construction du volume camera et ses rayons de repli.

Le calcul des densites, les intersections et l'altitude geodesique restent ellipsoidaux. Aucun rayon planetaire moyen ni sphere tangente n'est utilise pour reconstruire le milieu.

## Coordonnees et donnees

Les trois coordonnees physiques sont la latitude geodesique, la longitude relative au Soleil et l'altitude geodesique. Les axes de texture sont longitude x latitude x altitude.

Pour un ellipsoide de revolution et des profils uniformes en longitude, la reflexion dans le plan contenant le Soleil et l'axe polaire donne exactement les memes integrales pour les longitudes solaires opposees. La table utilise donc la longitude relative repliee dans [0, pi]. Une transformation quadratique concentre ensuite les texels autour de la direction solaire rasante, selon la latitude et la declinaison solaire. Les hauteurs suivent aussi une loi quadratique pour densifier les faibles altitudes. Ces transformations changent l'echantillonnage, pas la geometrie du milieu.

La texture RGBA16F contient :

- R : integrale de densite Rayleigh sur le trajet solaire, en kilometres.
- G : integrale de densite Mie sur ce trajet, en kilometres.
- B : reserve.
- A : validite du trajet, sans occultation par la planete.

Ces integrales deviennent une profondeur optique apres multiplication par les coefficients d'extinction. Le shader reconstruit `T_RGB = exp(-(betaRayleigh_RGB * colonneRayleigh + betaMieExtinction * colonneMie))`, avec des unites coherentes. Modifier ces coefficients ne necessite pas de recalculer les colonnes de densite. Modifier les profils d'altitude ou les axes de l'ellipsoide invalide la table.

La declinaison solaire est fixee lors de la construction. Une rotation du Soleil autour de l'axe polaire ne demande pas une nouvelle table, car la longitude solaire est soustraite au moment de la lecture. Une variation de declinaison invalide le cache. Aucun regroupement temporel approximatif de declinaison n'est implemente.

## Ombres et precision

L'occultation par l'ellipsoide est testee analytiquement au point courant. Un echantillon filtre contenant des texels d'ombre retombe sur l'integration directe au lieu de melanger des colonnes inexistantes.

La validation a aussi montre que des cellules entierement eclairees peuvent rester imprecises lorsque le rayon solaire rase les couches denses. Une protection supplementaire examine l'approche minimale du rayon dans l'espace de l'ellipsoide normalise. Pour un rayon initialement descendant, une borne conservative de proximite inferieure a 20 km declenche le calcul direct. Le seuil `guardHeight` est configurable, y compris zero pour mesurer le cache brut.

Cette protection est une heuristique de qualite, pas une borne certifiee de l'erreur d'interpolation. Elle augmente le cout des cas rasants. Le test numerique utilise la reference directe et mesure les erreurs au terminateur au lieu de supposer qu'une plus grosse texture les supprime.

## Construction et reutilisation GPU

La texture est construite par une passe compute, par groupes de couches. Les coordonnees geodesiques de chaque texel sont converties en ECEF, puis le shader integre les profils jusqu'a la sortie de l'enveloppe atmospherique. Les cellules au sol emploient la normale geodesique pour resoudre la visibilite du Soleil sans ambiguite sur la racine d'intersection de distance zero.

Deux qualites sont exposees : 128 x 32 x 32 (1 Mio) et 256 x 64 x 48 (6 Mio). La demo conserve au plus deux LUT GPU entre les essais. Le changement de camera ne reconstruit pas la LUT solaire. La compilation et la construction sont distinguees des mesures de rendu a chaud.

La preparation du volume camera peut maintenant se limiter aux rayons, profondeurs et metadonnees de silhouette CPU. Aucun volume lumineux CPU ni integration atmospherique CPU n'est necessaire dans le mode `Volume + LUT 3D`. Construction du volume, lecture filtree et replis sont effectues sur GPU. Le comparatif de points effectue toutefois des calculs CPU pour verifier les erreurs, hors des temps de passe GPU.

Le prototype conserve des allocations de buffers, des lectures retour et un affichage Canvas 2D pour comparer les images. La passe solaire GPU est reutilisable, mais cette page n'est pas encore une boucle de rendu Babylon/XR en ressources entierement persistantes.

## Deux variantes de vue

`atmosphere-inside.wgsl` et `atmosphere-space.wgsl` sont deux points d'entree compiles avec les fonctions communes et les memes LUT :

- Interne : le trajet commence a la camera.
- Externe : il commence a la premiere intersection positive avec l'enveloppe atmospherique.

Le sol opaque et la profondeur de scene bornent le trajet dans les deux cas. La densite reelle annule les portions de l'enveloppe situees au-dessus de la hauteur atmospherique. Le volume camera possede egalement les deux variantes de construction.

Le choix est fait selon l'altitude geodesique par rapport a la hauteur configuree, ici 100 km. Le preset d'aube a 60 km reste donc interne, meme si la vue ressemble a une vue spatiale; l'orbite a 400 km utilise la variante externe. La demo controle aussi le changement d'image entre 99999 m et 100001 m. Ce petit test de transition ne valide pas toutes les trajectoires de camera.

## Resultats

Les mesures CPU sont dans `solar-lut-benchmark-results.json`. Les mesures GPU resumees sont dans `solar-lut-webgpu-validation.json`. Elles portent sur des sorties volontairement petites et ne doivent pas etre extrapolees directement a un casque XR.

Dans le dernier essai externe, sortie 32 x 18, LUT 1 Mio, le rendu direct GPU prend 17.83 ms et le rendu avec LUT 1.31 ms, soit environ 13.6 fois plus rapide. La construction de la LUT prend 4.33 ms de passe GPU, 24 ms de temps mural. Aucun calcul solaire direct n'etait necessaire pour les echantillons de cette vue avant les tests de validation globale.

L'ecart de radiance maximal de cette image est environ 1.97e-5; les transmittances de vue sont identiques car seule l'integration solaire est remplacee. Sur 84 points repartis en latitude, altitude et longitude solaire, l'ecart maximal de transmittance est 0.00371 par rapport au calcul GPU direct, et 0.00479 par rapport au calcul CPU double precision. Ces chiffres caracterisent cet ensemble de points, pas une borne globale.

Le volume camera de l'essai externe retombe sur le calcul direct pour tous les pixels a cause de la protection du sol. Il ajoute donc un cout sans benefice dans ce cas. Cela soutient la separation entre une voie spatiale et une voie interne de perspective atmospherique, plutot qu'un volume camera universel.

## Commandes

```powershell
npm test
npm run benchmark:solar-lut
npm start
```

Utiliser les boutons `LUT 3D WebGPU` et `Volume + LUT 3D`. Le rapport affiche la construction froide, la reutilisation, trois mesures apres chauffe, les compteurs de lectures et replis, la validation solaire et la transition des variantes. Les zeros de timestamp indiquent parfois une passe sous la granularite du compteur.

## Validation et suites

35 tests Node couvrent la reference numerique et les extensions, dont periodicite, symetrie solaire, inversion du changement de coordonnees, coefficients independants, occultation, protection rasante, metadonnees sans integration CPU et selection interne/externe. Les pipelines de vue et de volume ont aussi ete compiles et executes dans la demo WebGPU.

Les prochaines etapes vers le papier sont la Sky-View LUT du ciel lointain, une perspective atmospherique de portee adaptee, la diffusion multiple et l'elimination des lectures retour en boucle de rendu. Les nuages et effets optiques de l'image cible constituent des couches supplementaires; cette LUT solaire n'en produit pas encore.

### Cas d'aube dans les couches hautes

Avec le preset a 60 km, sortie 96 x 54 et LUT de 6 Mio, une mesure de la variante interne donne 179.90 ms en direct contre 28.51 ms avec LUT, soit environ 6.31 fois plus rapide. La construction de la table prend 11.47 ms GPU et est reutilisee entre les essais. L'ecart maximal de radiance dans cette image est 0.00459. Le controle de points solaires montre encore un ecart maximal de transmittance d'environ 0.0234. La protection rasante ne garantit donc pas a elle seule la precision de tous les cas.

Le gain est net, mais ce temps de rendu a faible resolution ne constitue pas encore une implementation temps reel a la definition de l'image cible. La prochaine optimisation devra porter sur le ciel lointain et la marche de vue, tout en travaillant la precision de la table et les couts des replis.
