# Reprise : shader atmosphérique et FPS

L'utilisateur demande de poursuivre dans une sous-session la correction du shader et la chute des FPS en mouvement. Ne pas ajouter de passe, effet, dépendance ou comportement non demandé sans son accord explicite. Pas de HDR ni de FXAA. Pas de commit, push ou publication. Ne jamais employer le caractère U+2014. Les règles globales sont dans C:/Users/GuillaumePelletier/.codex/AGENTS.md. Lire aussi les AGENTS des deux repos ci-dessous.

## Sources et périmètre

- Workspace principal : C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR.
- Rendu actif : C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering.
- Transport atmosphérique : C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere.
- Les modifications existantes ne sont pas commitées. Les conserver. Les écritures dans les repos voisins peuvent demander une escalade sandbox.
- Un seul TileRuntime pour terrain et imagerie. Réutiliser Mapzen, DemPyramid et le fournisseur raster existant, Celestial pour les caractéristiques physiques. SSE 20. Aucun cube ou outil lunaire.
- Le sample Babylon Earth est servi par Vite port 5189 depuis spacexr-rendering/examples/babylon-earth. Vérifier que le serveur tourne, le conserver en fin de travail. Les alias Vite pointent directement vers les sources atmosphère voisines pour éviter des shaders périmés.

## État réalisé, à préserver

L'ancien compositeur HDR et FXAA a été supprimé. L'atmosphère de surface est injectée dans le ShaderMaterial déjà utilisé par GpuTerrainEngine. Le ciel utilise son chemin Layer et cache existant. Aucun post-process caméra. La case Atmosphere et le FPS sont visibles en haut à droite des trois pages du sample. OFF restaure exactement le shader terrain initial, ses options et ses textures. Test image OFF comparé au baseline : différence RGB nulle dans la zone terrain. Test réel OFF : 120 FPS à 2560x1440 sur la machine.

Fichiers rendu principaux :
- packages/babylon-earth/src/atmosphere/babylon-sky.ts : gestion des caches motion et settled, synchronisation GPU.
- native-surface.ts : pont textures WebGPU 3D empruntées, injection shader, restauration OFF.
- surface.wgsl : perspective aérienne sur la distance réelle au relief visible. Utilise vAtmosphereClip interpolé depuis le vertex shader et clip.w, pas une nappe horizontale ni un endpoint au ciel.
- display.wgsl : ciel existant et disque solaire rond.
- packages/core/src/terrain/gpu/shaders/wgsl/instancedGrid.vertex.wgsl : CUSTOM_VERTEX_MAIN_END.
- instancedGrid.fragment.wgsl : CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR dans la branche SCENE_LINEAR_COLOR.
- earth-runtime.ts : attache au matériau GpuTerrainEngine, un seul runtime conservé.
- examples/babylon-earth/src/main.ts et 3 HTML : HUD FPS, checkbox, sources existantes.

Attention WGSL Babylon : les fonctions auxiliaires doivent être placées AVANT le main source original. Les ajouter après produisait une image noire sans erreur car Babylon ajoute le return à la dernière fonction. native-surface.test.ts vérifie cet ordre et la restauration OFF. Les fichiers generated se régénèrent via npm run shaders, ne pas les modifier à la main.

Backend : AtmosphereSky et AtmosphereAerialVolume, calcul spectral, ozone de référence terrestre dans babylon-earth. Ne pas régler les coefficients optiques pour imposer une couleur. Le volume aérien utilise un Z quadratique sur l'intervalle extérieur atmosphérique NON tronqué par le sol ; le transport est bien tronqué au sol. Cela évite une discontinuité sur l'horizon. webgpu/shaders/aerial-read.wgsl expose le calcul canonique de coordonnée Z utilisé par le shader natif.

## Problème actuel confirmé, non résolu

Une mesure manuelle précédente suggérait 105 FPS ON. Elle était insuffisante et a été corrigée dans le compte rendu utilisateur. La vraie rotation continue RAF donne OFF 120 FPS, ON environ 6 à 7 FPS, puis 120 FPS à l'arrêt. Ne pas annoncer que la fluidité est corrigée avant de refaire cette vraie mesure.

Profil GPU avec timestamp-query à 2560x1440, Mapzen + Google, sunset, SSE20 :
- Atmosphere spectral Sky-View tile : 122 à 130 ms par mouvement.
- Atmosphere aerial volume : 20 à 21 ms.
- Affichage du ciel : environ 1.2 à 1.5 ms.
- MainRenderPass terrain : 2.4 à 3 ms.
- update CPU sans attente antérieure : 3 à 13 ms, mais en boucle réelle await pending attend environ 149 ms.

Logs et scripts reproductibles dans SpaceXR/.cache :
- native-gpu-stages.cjs et .log : intercepte les compute/render passes pour timestamps, aucun changement produit.
- native-live-fps.cjs, .json, .log et .png : vraie boucle RAF, yaw += .0008 toutes les 8 ms, warmup puis mesure réelle des frames. Chrome headless WebGPU D3D11.
- native-live-profile.cjs et .log : confirme update median149ms ON,1.1ms OFF.
- earth-motion-perf.cjs : benchmark manuel, ne suffit PAS pour valider les mouvements réels.
- native-ui-validation.cjs : OFF baseline, ON/OFF, date, zéro camera postprocess et imageprocessing.applyByPostProcess=false.
- existing-tiles-smoke.cjs : Mapzen et Google, 2 workers, aucune ancienne earth_map. Vérifier aussi visuellement les images, un succès technique seul avait laissé passer une image noire.
- aerial-horizon-gpu.cjs : test indépendant limite horizon.

## Pistes à examiner avant de modifier

1. Vérifier pourquoi yaw invalide le sky cache : la caméra orbital-camera tourne autour d'une cible, peut modifier sa position ECEF. Dans babylon-sky.ts même position tolérance1mm, AtmosphereSky.update compare exactement les composantes. Les tests simulés de rotation à position fixe n'exposent pas le vrai coût.
2. Le transport solaire LUT peut provoquer un fallback très coûteux : webgpu/shaders/transport.wgsl, atmosphere_solar(). Si un des 8 coins est marqué ombré (value.x<0), il appelle atmosphere_solarDirect qui intègre solarSteps48 par échantillon de vue et groupe spectral. Le ciel mobile utilise pourtant16x16 pixels,16steps,8groupes, mais prend130ms.
3. Paramétrage solaire actuel dans webgpu/index.ts vers lignes203 à240 et transport.wgsl atmosphere_terminator(latitude) : centre au terminateur de niveau mer, indépendant de la hauteur. Cela peut étendre la zone de fallback près du terminateur aux hautes couches.

Piste numérique NON IMPLÉMENTÉE : centrer la LUT sur la tangente exacte de l'ellipsoïde à chaque hauteur et latitude. Pour p ECEF divisé par axes q, v=Sun/axes, la limite d'ombre vérifie q.v = -sqrt(dot(v,v)*(dot(q,q)-1)). À latitude et hauteur fixées, centre longitude relative Soleil = acos(clamp((-sqrt(v²*max(q²-1,0))-qz*vz)/(length(q.xy)*length(v.xy)), -cos(.1), cos(.1))). Côté CPU utiliser geodeticPosition du package existant à longitude0, latitude et hauteur de la cellule. Côté GPU utiliser p réel et pointDot en double-float pour q²-1. Garder le fallback direct et les occultations correctes. Cette optimisation corrige le paramétrage existant, ne crée aucune passe ou effet. La profiler pour vérifier son utilité, et requalifier numériquement si retenue.

## Vérifications requises

- Backend npm run check obligatoire selon AGENTS, dernier passage OK :27 tests package +61 labo, logs native-final-backend-check.log. npm pack --dry-run, pas publication.
- Dernier npm run test:webgpu complet passé avant les ultimes changements natifs :28 cas + multiple scattering + aerial. Environ8min. À refaire si transport solaire changé, sans benchmark FPS en parallèle pour ne pas fausser les mesures. Le backend scientifique utilise parfois192solarSteps, éviter les énormes lots GPU qui provoquent un watchdog. MultipleScattering encode est limité à un groupe par soumission.
- Rendu npm run check passé précédemment, Earth14 tests dont native-surface. Derniers logs native-final-rendering-check.log et native-last-check.log. Relancer ce qui est pertinent après modifications.
- Mesurer la vraie RAF rotation OFF/ON avec la même caméra et résolution2560x1440. Aucun postprocess caméra. Test translation et orbital aussi, pas seulement caméra fixe.
- Capturer puis regarder le rendu journée10h, coucher de soleil avec relief, orbital. Vérifier brume bleue de distance en journée, pas de bande orange collée devant les sommets, halo orbital diffus et stable. Ne pas confondre une perspective aérienne physiquement chaude au coucher et le précédent défaut de profondeur.
- Conserver le sample Mapzen existant, ne pas fabriquer un autre terrain pour contourner le défaut.
- Mettre à jour les docs de validation si elles décrivent encore l'ancien compositeur supprimé. Pas de nouvelle fonctionnalité.

Le travail est transféré sur demande explicite de l'utilisateur. Le chat parent ne poursuit plus les modifications après ce transfert.
