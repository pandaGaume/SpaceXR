# Étude des backends CPU natif et WebGPU

Date : 11 octobre 2026. Étude de conception, sans ajout de backend natif ou WebGPU. Sources ONNX Runtime examinées à la version 1.24.4, utilisée dans le banc. Les contrôles reproductibles et leurs empreintes sont dans `LLMLingua2/results/backend-study.json`.

## Décision proposée

Conserver le graphe natif SpikyPanda, ses liens et son runtime. Ajouter des backends de kernels indépendants : CPU natif sur Node, WebGPU dans le navigateur, JavaScript générique comme référence et solution de repli explicite. Le backend CUDA expérimental reste un point de comparaison fonctionnel.

MLAS est une piste sérieuse pour le premier kernel CPU `MatMul`, sous réserve de traiter son threading et sa compilation. WebGPU reste la cible d'accélération prioritaire du navigateur. Les deux pistes doivent partager les règles de tensors, de résidence mémoire et de validation, sans partager leur implémentation matérielle.

La découverte d'une capacité d'exécution publiée au harness doit utiliser le broker existant. Le registre de kernels est un mécanisme local de sélection, pas un second catalogue de discovery.

## Mesure complète terminée

Le banc CUDA mesure de l'entrée texte au résultat de `compress_prompt_llmlingua2`, avec calcul réel des logits. Les 40 mesures passent sous une seconde, avec huit sorties complètes identiques à la référence. Médianes : 268 à 321 ms sur les scénarios à un petit batch, 612 ms avec sélection des contextes et deux inférences, 350 ms sur le texte long découpé. Le maximum observé est 632 ms.

La session et les poids sont déjà chargés. Le démarrage du banc prend 2,934 s pour la pipeline officielle puis 24,081 s pour le service et le graphe. Ces mesures ne constituent pas une garantie pour tous les textes ou pour la concurrence. Détails : [résultats de la chaîne complète](../LLMLingua2/gpu/PIPELINE-RESULTATS.md).

ONNX Runtime CPU reste un autre banc : provider CPU imposé, huit threads intra-op, 33 à 68 ms sur les petites inférences et 1,169 s sur le batch long. Sa chaîne de compression complète n'a pas été mesurée ici. Les anciens chronomètres incluent de petits contrôles ou conversions autour de l'inférence ; la comparaison future devra harmoniser chauffe, répétitions et frontières de mesure.

## Ce que SpikyPanda fournit déjà

`OnnxOpRegistry.register` reçoit une factory, une priorité et un nom de backend. `OnnxOpNode` hérite de `Kernel`. Le contrat `executeAsync` est déjà exploitable par `ComputeGraph.inferAsync` et le scheduler natif. Ces points suffisent à enregistrer une implémentation de calcul différente sans changer les relations du graphe.

Dans les sources `packages/dev` examinées, la recherche ciblée n'a trouvé aucun backend WebGPU ou module Node-API existant. Il ne s'agit pas d'un audit exhaustif du dépôt.

Trois écarts empêchent encore une intégration résidente propre :

1. `ITensor.data` impose un `Float32Array`, sans stockage GPU, strides ou dtype explicites. Le prototype CUDA refuse les lectures CPU implicites, mais cela reste une adaptation expérimentale.
2. `OnnxGraphBuilder` résout tous les poids externes en données CPU et construit ses `InitializerNode` directement. Il faut ajouter un point de factory ou de chargement des initializers, en préservant le comportement CPU par défaut. Reproduire le builder serait contraire à l'architecture.
3. Le registre choisit une factory par opérateur et priorité. Il ne vérifie pas actuellement la compatibilité dtype, formes, résidence ou mémoire disponible. L'hôte doit effectuer cette admission avant construction ; toute évolution doit compléter ce registre, sans créer une sélection parallèle.

## MLAS : extraction possible, intégration à faire

ONNX Runtime et MLAS sont sous licence MIT. La réutilisation exige de conserver les mentions de licence ; les dépendances effectivement embarquées devront être inventoriées. [Licence de la version étudiée](https://github.com/microsoft/onnxruntime/blob/v1.24.4/LICENSE).

L'en-tête MLAS expose `MlasGemmBatch`, les paramètres FP32 et des fonctions de packing des matrices B. Cela permet d'adapter le `MatMul` natif, avec promotion des vecteurs et broadcast des batches pris en charge par l'adaptateur. Les poids constants peuvent être préconditionnés une fois, en fonction de leur disposition et de l'architecture CPU. Les activations variables ne doivent pas être mises dans ce cache. Softmax et Erf possèdent aussi des primitives ; cela ne fournit pas à lui seul les 23 opérateurs ONNX du modèle. [En-tête MLAS](https://github.com/microsoft/onnxruntime/blob/v1.24.4/onnxruntime/core/mlas/inc/mlas.h).

Le mode `BUILD_MLAS_NO_ONNXRUNTIME` retire des dépendances au thread pool et aux utilitaires du runtime. Dans `threading.cpp` 1.24.4, cette branche parcourt les tâches en série. Le commentaire mentionnant OpenMP ne constitue pas une implémentation parallèle dans ce fichier. Extraire MLAS en mode autonome ne reproduit donc pas automatiquement les huit threads du banc ORT. Il faut choisir et tester un pool explicite ou porter la couche de threading utile. [Threading étudié](https://github.com/microsoft/onnxruntime/blob/v1.24.4/onnxruntime/core/mlas/lib/threading.cpp), [dépendances internes](https://github.com/microsoft/onnxruntime/blob/v1.24.4/onnxruntime/core/mlas/lib/mlasi.h).

La compilation MLAS sélectionne des sources C++ et des kernels propres aux architectures, avec des chemins Windows, x86 et WASM SIMD. Son CMake dépend des helpers ONNX Runtime : copier uniquement `sgemm.cpp` ne suffit pas. Une extraction doit conserver les sources de dispatch, les kernels requis, les en-têtes et un build explicite, à une révision fixée. [Build MLAS](https://github.com/microsoft/onnxruntime/blob/v1.24.4/cmake/onnxruntime_mlas.cmake).

CMake et les outils Visual C++ de Visual Studio 2022 sont présents sur cette machine. `cl` n'est pas exposé dans le shell courant ; il faudra utiliser l'environnement de compilation approprié. Aucun build MLAS autonome n'a été exécuté dans cette étude.

## Couche native et alternative BLAS

Un module Node-API séparé peut recevoir les buffers des `Float32Array`, valider tailles et offsets, puis appeler le kernel sans sérialisation JSON. Si l'exécution est asynchrone, les buffers doivent rester vivants et ne pas être modifiés jusqu'à la fin. Les poids packés demandent un propriétaire, une destruction explicite et un budget de mémoire. Node-API stabilise la frontière avec Node ; cela ne stabilise pas les API internes MLAS. [Documentation Node-API](https://nodejs.org/api/n-api.html).

Le pool de travail de Node et celui du calcul numérique doivent avoir des budgets coordonnés. Ajouter huit threads à chaque branche parallèle pourrait surcharger le processeur. La concurrence des sessions et le partage des poids immuables devront être testés séparément.

| Option | Intérêt | Coût ou limite | Position proposée |
| --- | --- | --- | --- |
| MLAS extrait et adapté | Réutiliser les primitives du backend ORT de référence | Build et threading à maintenir, API interne | Premier candidat à prototyper |
| BLAS autonome, par exemple OpenBLAS | Interface matricielle C existante | Adaptateur batch, autres opérateurs à fournir, packaging | Alternative si l'extraction MLAS devient trop coûteuse |
| ONNX Runtime complet | Baseline optimisée déjà mesurée | Son runtime exécute le modèle | Référence de comparaison |
| JavaScript générique | Portable et déjà conforme | Calcul scalaire et copies coûteuses | Référence numérique et repli admis |

OpenBLAS est sous licence BSD à trois clauses et expose une interface CBLAS. Cette alternative n'a pas été compilée ni mesurée ici. [Projet](https://github.com/OpenMathLib/OpenBLAS), [licence](https://github.com/OpenMathLib/OpenBLAS/blob/develop/LICENSE).

## WebGPU : conserver le GPU comme cible Web

Le navigateur ne charge pas notre module CPU natif Node. Il peut néanmoins exécuter du CPU via WebAssembly SIMD ; cela constitue une possibilité de repli, distincte de la voie WebGPU. MLAS possède des sources WASM, mais leurs performances et leur extraction restent à vérifier. Les kernels CPU x86 ne se transposent pas directement en WGSL.

Le provider WebGPU d'ONNX Runtime est également une source de techniques réutilisables. Son `MatMul` 1.24.4 génère du WGSL depuis des classes C++ dépendantes de `ComputeContext` et des helpers du provider. Ce n'est pas une fonction autonome directement importable en TypeScript. Reprendre ses stratégies exige de porter le générateur et ses besoins, ou d'écrire un kernel WGSL compatible avec notre contrat, avec les notices de licence applicables. [Sources MatMul WebGPU](https://github.com/microsoft/onnxruntime/blob/v1.24.4/onnxruntime/core/providers/webgpu/math/matmul.cc).

Les activations doivent rester dans des `GPUBuffer`. Le runtime peut parcourir ses nœuds, qui enregistrent leurs commandes GPU et publient des références tensoriales. La fin du passage soumet les commandes et télécharge la sortie requise. Attendre une lecture CPU après chaque opérateur détruirait cet avantage. Cette stratégie de soumission est proposée, pas implémentée. La résidence des tensors est aussi un principe explicite du provider ORT WebGPU. [Documentation](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html).

### Contrainte constatée sur l'export exact

Les poids FP32 totalisent **2 235 781 128 octets**. La table d'embeddings contient **250 102 x 1024 floats**, soit **1 024 417 792 octets**. C'est le seul initializer dépassant 128 MiB.

Les limites WebGPU par défaut documentées sont 256 MiB par buffer et 128 MiB pour un binding de stockage. Les limites réellement accordées doivent être interrogées et, si nécessaire, demandées à la création du device. Un support WebGPU ne garantit donc pas le chargement monolithique de cette table. [Limites du CTS WebGPU](https://gpuweb.github.io/cts/docs/tsdoc/functions/webgpu_capability_info.getDefaultLimits.html).

Proposition : découper la table par plages de lignes, puis effectuer plusieurs dispatchs internes au kernel `Gather`. À 128 MiB, 32 768 lignes tiennent dans un morceau ; huit morceaux couvrent la table. Ne pas lier simultanément les huit morceaux plus tous les autres buffers : chaque dispatch peut traiter une plage avec quelques bindings. Le graphe conserve son opérateur Gather ; son implémentation réalise plusieurs commandes. Cette stratégie doit encore être validée sur un navigateur et son budget total de mémoire.

Le fichier externe de poids dépasse 2 Go : éviter de dépendre d'un unique `response.arrayBuffer()` et d'une copie intégrale en mémoire WASM. Charger par plages ou morceaux et contrôler les copies CPU/GPU. Le serveur doit exposer les ressources selon un format de chargement vérifié. [Contraintes des grands modèles Web](https://onnxruntime.ai/docs/tutorials/web/large-models.html).

La première validation WebGPU doit conserver FP32. FP16 et quantification demandent une autre référence. Les identifiants et contrôles INT64 de cet export peuvent être convertis vers des entiers 32 bits uniquement après contrôle de leurs plages ; ce n'est pas une prise en charge générale INT64.

## Organisation proposée et ordre de validation

Les modules natif CPU, WebGPU et CUDA doivent être séparés des opérateurs génériques. Leur session détient ressources, buffers, commandes et état d'exécution. Un partage de poids immuables entre sessions doit avoir un cycle de vie explicite. Toutes les nouvelles interfaces commenceront par `I`, par exemple `ICpuKernelSession`, `IWebGpuKernelSession` et `ITensorStorage` ; ces noms sont proposés, pas des contrats déjà présents.

Le premier jalon commun est un contrat de stockage tensoriel et un chargement des initializers extensible. Il doit conserver les tests CPU et interdire les rapatriements implicites. Les vues Reshape et Transpose doivent éviter les copies lorsqu'un backend peut utiliser des strides.

Ensuite, côté natif : valider un `MatMul` FP32 isolé, comparer un thread puis huit threads, tester packing et mémoire, puis intégrer le kernel par le registre. Compléter Softmax, normalisation et opérations élémentaires selon un profil CPU réel. Le temps pur des kernels doit être distingué du parcours et des transferts.

Côté Web : commencer par admission des limites, chargement découpé et Gather des embeddings ; poursuivre par MatMul avec batch et broadcast, Softmax, LayerNormalization, Erf et calculs élémentaires. Les petits contrôles de dimensions restent sur CPU quand ils n'exigent pas de lecture des activations GPU. Les caches de pipelines et de buffers appartiennent à la session du backend.

Chaque cible doit repasser les neuf batches et les huit reconstructions, sans substitution des logits. Mesurer la chaîne complète, le démarrage, la mémoire, les formes dynamiques et la concurrence. La tokenisation et la reconstruction Python actuelles doivent encore être portées au navigateur : un forward WebGPU seul ne validera pas la compression Web complète.

L'étude recommande donc **MLAS comme premier essai CPU natif, avec threading explicite**, et **WebGPU comme axe Web maintenu dès le contrat de résidence mémoire**. Elle ne prédit pas les performances d'un backend encore absent. Ni le module CPU natif ni les kernels WebGPU n'ont été implémentés ou benchmarkés dans cette intervention.
