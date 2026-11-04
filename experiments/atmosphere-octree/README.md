# Prototype d'atmosphere ellipsoidale avec octree

Travail isole sur `codex/ellipsoidal-atmosphere-octree`, dans le worktree `SpaceXR-atmosphere-octree`. Aucun changement au rendu Babylon existant. JavaScript ESM sans dependance externe, Node 22 et navigateur WebGPU pour le chemin GPU.

## Lancer

Depuis ce repertoire :

```powershell
npm test
npm run benchmark
node continuity.js
npm start
```

Ouvrir http://127.0.0.1:8096. Le serveur ecoute seulement sur l'interface locale. Choisir la vue, le soleil et le mode de raccord. `Comparer CPU` mesure reference, remplissage et reutilisation. `Comparer WebGPU` prepare le cache sur CPU et compare les deux integrations GPU. `Comparer les formats GPU` construit une grille solaire commune et mesure trois representations apres chauffe. Les boutons ne lancent pas un rendu temps reel.

## Geometrie et physique

Toutes les positions CPU sont ECEF en metres, axe polaire Z. `Atmosphere` accepte structurellement un objet `Ellipsoid` de SpaceXR, via `semiMajorAxis` et `semiMinorAxis`; ses valeurs sont copiees. Le modele est immutable pour eviter la reutilisation d'un eclairage obsolete. Pour changer le soleil ou les proprietes physiques, construire un nouveau modele et un nouvel arbre.

La densite depend de l'altitude geodesique exterieure, calculee par projection iterative sur un ellipsoide de revolution oblat. Le volume n'est pas converti en atmosphere spherique. L'intersection rayon/ellipsoide conserve les longueurs physiques. La borne superieure est une enveloppe homothetique conservative, de facteur `1 + top / semiMinorAxis`. Elle contient la surface d'altitude constante mais ne definit pas la densite. Les echantillons hors atmosphere sont nuls; les rayons s'arretent au sol ou a `maxDistance` pour un terrain opaque.

Integration de diffusion simple Rayleigh et Mie, phase Cornette-Shanks, extinction RGB, occultation solaire par l'ellipsoide. La profondeur optique camera est accumulee progressivement; la source est integree analytiquement dans chaque pas suppose constant. Le resultat est une radiance pour un eclairage solaire RGB unitaire, et une transmittance RGB. Composition HDR : `terrain * transmittance + radiance`.

## Octree

L'arbre persistant raffine uniquement les chemins consultes par les rayons observes. Le critere combine dimensions projetees, variation optique estimee, taille de cellule et profondeur maximale. Le choix du niveau utilise la cellule et les yeux, pas la position variable de l'echantillon dans cette cellule. On peut fournir plusieurs yeux pour preparer un cache commun stereo.

Chaque cellule cache la transmittance solaire a ses huit sommets. Les sommets communs sont reutilises via une table de positions. L'interpolation est trilineaire. La radiance dependante du point de vue reste integree le long du rayon. Les cellules coupees par le sol ou le sommet atmospherique, les transitions d'ombre et les branches qui depassent le budget de noeuds retombent sur l'integration solaire directe. Celle-ci considere toujours le milieu global, meme hors du champ de la camera.

Le critere optique est une heuristique de raffinement et ne constitue pas une borne certifiee de l'erreur finale. Le budget est de 30000 noeuds par defaut. Il n'y a pas d'eviction, de reconstruction GPU ni de planification asynchrone des mises a jour. Quand le budget est atteint, l'exactitude du modele est preservee par le repli direct, au prix du temps de calcul.

## Mosaiques et raccords

L'interpolation trilineaire seule est continue entre cellules identiques partageant les memes sommets, mais ne garantit pas la continuite entre deux niveaux. `continuity.js` traverse des interfaces avec deux points distants de 2 mm au total. Dans le cas teste, 74 interfaces dont 2 interfaces de niveaux differents : saut maximal brut de transmittance de 0.001275; avec raccord, environ 2.6e-10 aux interfaces de niveaux differents.

Le mode `seamBlendFraction = 0.08` melange progressivement le cache et l'integrale solaire directe dans une bande proche des faces. Les deux cotes convergent ainsi vers le meme calcul sur la face. Ce traitement coute des integrations supplementaires. Le selecteur de la demo permet de comparer l'interpolation brute et le raccord. La carte d'erreur affiche l'ecart de radiance maximale RGB multiplie par 10000 avant exposition.

Cela ne prouve pas l'absence de tout artefact : les erreurs lisses a l'interieur des cellules, le changement temporel de LOD, la quadrature des rayons et la precision flottante doivent etre evalues separement. Le test mesure une discontinuite spatiale du cache solaire, pas un seuil de perception de l'image finale. La demo utilise volontairement une tres faible resolution et `image-rendering: pixelated`; les pixels visibles de l'affichage ne sont pas des cellules d'octree.

## Donnees et shaders GPU

`src/atmosphere.wgsl` integre le meme modele ellipsoidal en kilometres et float32. L'arbre est linearise dans un storage buffer avec 192 octets par noeud : centre/demi-taille, 8 indices enfants, indicateurs, 8 transmittances vec4. Le shader parcourt au plus 25 niveaux, interpole le cache et utilise le calcul direct pour les branches absentes. Le CPU garde son saut de cellules vides; le shader GPU conserve un pas de vue regulier pour isoler le benefice du cache. Ces deux chemins n'ont donc pas exactement les memes points de quadrature.

Le comparatif de formats utilise une grille locale identique de 32 cubique et des indicateurs conservateurs de validite par cellule :

| Format | Valeurs | Lecture | Memoire grille et indicateurs |
| --- | --- | --- | --- |
| Storage buffer | RGBA32F | 8 lectures, interpolation manuelle | 655360 octets |
| Texture 3D | RGBA16F | interpolation trilineaire materielle | 393216 octets |
| Atlas 2D | RGBA16F | 2 lectures bilineaires de tranches puis interpolation Z | 393216 octets |

L'atlas place les tranches cote a cote. Les coordonnees utilisent les centres des texels et restent dans chaque tranche, sans mipmaps. Les cellules invalides ont le meme repli direct dans les trois variantes. Le changement de precision 32/16 bits fait partie du compromis teste; ce n'est pas une comparaison de disposition memoire a precision egale. La memoire indiquee exclut arbre, buffers de rayons, sortie, lecture retour et allocations du pilote.

Les compteurs GPU `cacheHits` et `directCalls` permettent de verifier que le shader utilise effectivement le cache. Les timestamps WebGPU, lorsqu'ils sont disponibles, mesurent la passe compute seule; le temps mural comprend uploads et lecture retour. Chaque variante est chauffee puis mesuree trois fois. Ces petits essais ne permettent pas de choisir un format pour une cible XR. Il faut ensuite mesurer des resolutions representatives, sur le materiel cible, avec ressources persistantes et sans lecture retour par image.

## Verification et limites

35 tests Node couvrent altitude geodesique, axes distincts, vues orbitales, clipping terrain, occultation, vide, budget, cache, ABI GPU, deplacement/stereo, convergence numerique, grille, float16 et raccords de niveaux. Les resultats CPU reproductibles sont dans `benchmark-results.json`; les mesures de continuite sont dans `continuity-results.json`.

La demo WebGPU a compile et execute les variantes octree, buffer, texture 3D et atlas 2D dans le navigateur integre. Une premiere verification au bord planetaire montre un ecart float32/double pouvant atteindre environ 0.014 en transmittance sur les rayons les plus sensibles. Le shader n'est donc pas valide pour les exigences de precision d'un rendu planetaire de production. Une representation relative camera avec geometrie compensee est a etudier avant integration.

Ne sont pas implementes : diffusion multiple, ozone, nuages, ombres du terrain, compositing des transparences, raccord Babylon, rendu XR complet, transition temporelle des niveaux, eviction et streaming GPU. Les objets sous l'ellipsoide ne sont pas couverts. Les performances CPU ne predisent pas les performances GPU. Les tests actuels ne montrent pas de gain significatif par saut de volume vide dans une atmosphere claire.

## Integration envisagee

Conserver le modele ellipsoidal et sa reference numerique. Evaluer ensuite un arbre de briques plutot qu'un cache de huit valeurs par noeud : metadonnees compactes en storage buffer, eclairage en atlas de briques filtrables, voxels de bord partages et raccords de niveaux explicites. Cette proposition reste a mesurer, elle n'est pas presentee comme un gain acquis. Le choix final du format et de la politique de LOD depend de mesures GPU et de la stabilite visuelle en mouvement.

## Extension hybride

Le mode octree solaire + volume camera cumulatif est implemente en CPU et WebGPU. Voir [HYBRID.md](HYBRID.md) pour les passes, la profondeur de scene, les mesures et les limites. La demonstration propose les boutons `Hybride CPU` et `Hybride WebGPU`. Le gain GPU global reste a etablir.

## LUT solaire ellipsoidale

Le cache optique 3D global est disponible en CPU et WebGPU, avec deux variantes internes et spatiales. Voir [SOLAR-LUT.md](SOLAR-LUT.md) pour les coordonnees, mesures et limites, et [VISUAL-TARGET.md](VISUAL-TARGET.md) pour la reference utilisateur. Les nouveaux boutons sont `LUT 3D WebGPU` et `Volume + LUT 3D`.

## Rendu natif Full HD et seuil camera

Le chemin `Rendu HD` affiche maintenant 1920 x 1080 sur WebGPU, depuis une Sky-View directionnelle et une LUT solaire 3D. `Animer le regard` reutilise ces textures. `Mesurer le seuil camera` calibre deux criteres, deplacement de l'horizon et variation de couleur, puis les verifie sur des mouvements mixtes. Voir [SKY-VIEW.md](SKY-VIEW.md), le [rapport GPU](outputs/sky-view-full-hd-report.json) et le [PNG natif](outputs/sky-view-full-hd.png). Les comparatifs historiques a basse definition restent disponibles separement. 48 tests Node passent.
