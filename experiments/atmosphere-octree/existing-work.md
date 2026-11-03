# Recherche d'implementations existantes

Verification du 3 novembre 2026, dans les sources et documentations publiques. Aucune de ces observations ne constitue une preuve qu'il n'existe pas d'autre solution ellipsoidale.

## Unreal et Cesium for Unreal

Le composant SkyAtmosphere d'Unreal est une implementation aboutie pour le ciel, la perspective atmospherique et la transition sol/espace. Le papier de Hillaire et son exemple autonome sont les references algorithmiques pertinentes :

- https://dev.epicgames.com/documentation/en-us/unreal-engine/sky-atmosphere-component-in-unreal-engine
- https://github.com/sebh/UnrealEngineSkyAtmosphere

CesiumSunSky documente explicitement que le SkyAtmosphere d'Unreal suppose une sphere. Il adapte le rayon selon la position du point de vue : approximation pres du sol, rayon englobant depuis l'espace et transition entre les deux. Les commentaires au debut du fichier et `UpdateAtmosphereRadius` expliquent ce compromis :

https://github.com/CesiumGS/cesium-unreal/blob/main/Source/CesiumRuntime/Private/CesiumSunSky.cpp

La reutilisation du composant Unreal est constatee dans le code. L'avantage de performance des LUT a symetrie spherique est une motivation algorithmique plausible, mais aucune comparaison mesuree sphere/ellipsoide n'a ete trouvee dans ces sources pour attribuer la decision de Cesium principalement aux performances.

## Takram / three-geospatial

Projet MIT, implementation atmospherique et nuages, avec chemin WebGPU en cours de developpement :

- https://github.com/takram-design-engineering/three-geospatial
- https://github.com/takram-design-engineering/three-geospatial/blob/main/packages/atmosphere/WEBGPU.md
- https://github.com/takram-design-engineering/three-geospatial/blob/main/LICENSE

Candidat utile pour etudier le portage WebGPU, les LUT et les contraintes geospatiales. Attention : la presence d'un parametre `ellipsoid` ne signifie pas que le milieu atmospherique est ellipsoidal. La documentation de `correctAltitude` indique une atmosphere spherique et une correction pour rendre sa sphere interieure tangente a l'ellipsoide a la position de la camera. La raison historique precise de ce choix n'est pas etablie dans cette documentation.

## CesiumJS

L'API SkyAtmosphere accepte un ellipsoide, mais le shader examine utilise `czm_raySphereIntersectionInterval` et calcule l'altitude comme `length(samplePosition) - atmosphereInnerRadius` :

https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Shaders/AtmosphereCommon.glsl

Il faut donc inspecter les equations du milieu, et pas seulement le type du globe ou la signature de l'API, avant de retenir cette implementation pour notre contrainte.

## Assets Unreal

Ultra Dynamic Sky est interessant pour la direction artistique et la meteo, mais son mode Sky Atmosphere reutilise celui d'Unreal :

https://www.ultradynamicsky.com/Documentation/V7/7-2

Post Process Planetary Atmosphere annonce un rendu sol/espace et des simplifications Rayleigh/Mie sans precalcul. Sa fiche publique ne permet pas de confirmer une atmosphere geodesique ellipsoidale, ni un portage direct vers WebGPU :

https://www.fab.com/listings/d884b3c1-17ee-4129-b193-87fb08668836

Aucun asset commercial n'a ete achete, telecharge ou incorpore. Les licences d'assets doivent etre examinees individuellement avant reutilisation hors Unreal. Le code du moteur Unreal et l'exemple autonome MIT de Hillaire ne doivent pas etre assimiles sur le plan des droits de reutilisation.

## Decision proposee

Reutiliser les equations, strategies de precalcul et techniques de precision lorsque leur licence le permet. Garder une reference ellipsoidale pour verifier toute approximation. Les projets examines ne fournissent pas directement l'ensemble requis : milieu selon altitude geodesique, WebGPU/Babylon, raffinement volumetrique et raccords visuels de niveaux. Le prototype sert a mesurer ces points, pas a remplacer par principe les travaux existants.
