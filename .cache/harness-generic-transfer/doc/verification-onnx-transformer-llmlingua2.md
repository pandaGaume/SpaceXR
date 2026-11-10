# Vérification ONNX Transformer pour LLMLingua-2

Date : 10 octobre 2026. Statut : audit de sources, corrections réalisées dans SpikyPanda et conformité numérique ciblée vérifiée.

## 1. Résultat et périmètre

Les opérateurs cités étaient enregistrés dans SpikyPanda, mais certaines implémentations ne couvraient pas les formes utilisées par un Transformer. Ces écarts ont été corrigés dans `packages/dev/onnx`, avec un ajustement du routage tensoriel dans Core. Le moteur reste celui de SpikyPanda ; ONNX Runtime sert uniquement de référence pour générer les résultats de test.

Les tests vérifient désormais des embeddings multidimensionnels, une attention multi-têtes, des normalisations, un feed-forward avec GELU décomposé et une classification en deux classes. Ils vérifient aussi les positions, masques et changements de forme entre deux inférences du même graphe.

Ces premiers tests valident les primitives et de petits graphes d'encodeur. La validation ultérieure du modèle LLMLingua-2 complet est désormais réalisée dans [LLMLingua2](../LLMLingua2/README.md) : checkpoint Microsoft XLM-RoBERTa large fixé par révision, poids entraînés, export FP32 opset 17, tokenizer sauvegardé et reconstruction officielle. Les huit scénarios passent sur ONNX Runtime et le graphe natif SpikyPanda, avec des sorties textuelles et étiquettes identiques à PyTorch. Le [rapport de résultats](../LLMLingua2/RESULTATS.md) conserve les mesures, les anomalies amont et les limites de performance.

Microsoft décrit LLMLingua-2 comme une classification de tokens avec un encodeur. Le modèle public XLM-RoBERTa utilise notamment GELU, 24 couches et 16 têtes d'attention ; c'est une cible différente d'un simple classifieur dense. Sources : [dépôt Microsoft LLMLingua](https://github.com/microsoft/LLMLingua), [configuration du modèle Microsoft](https://huggingface.co/microsoft/llmlingua-2-xlm-roberta-large-meetingbank/blob/main/config.json).

## 2. Écarts corrigés

| Élément | État initial constaté | Correction et vérification |
| --- | --- | --- |
| `MatMul` | Traitement principalement 2D ; interprétation incorrecte des dimensions supérieures | Produits par lots avec broadcasting des dimensions de batch, promotion des vecteurs et résultat scalaire ; attention 4D et projections 3D testées |
| `Gather` | Spécialisation surtout axe 0 ; indices aplatis et forme perdue | Axes positifs ou négatifs, indices de rang quelconque ou scalaires, indices négatifs et rejet hors limites ; embeddings `[batch, séquence, hidden]` testés |
| `Transpose` | Permutation déclarée ignorée ; chemins limités au 2D/3D | Permutation explicite et rang arbitraire, contrôle de validité ; permutation des têtes 4D testée |
| `Softmax` | Calcul sur le dernier axe ; retour inchangé sur les autres axes | Calcul stable sur l'axe demandé, y compris non terminal ; tests d'axe et de grandes valeurs |
| `LayerNormalization` | Calcul principal présent ; sorties auxiliaires absentes | Broadcasting des paramètres, validation de l'axe et du stash FP32, moyenne et inverse d'écart-type ; résultats auxiliaires testés |
| Réductions | Couverture limitée de `ReduceMean` / `ReduceSum` | Réductions multidimensionnelles, axes en attributs ou entrée tensorielle, `keepdims` et gestion des axes vides |
| Broadcast | `Div` et `Pow` utilisaient une répétition plate | Helpers partagés avec `Add`, `Sub`, `Mul` et `Expand` ; alignement des dimensions et contrôle de compatibilité |
| Formes | Limites de `Concat`, `Slice`, `Squeeze`, `Unsqueeze`, `Reshape` | Concaténation de rang arbitraire, slicing avec axes et steps, axes négatifs, formes scalaires et contrôle du nombre d'éléments |
| GELU décomposé | `Erf` absent | Kernel `Erf` ajouté, comparé à ONNX Runtime et utilisé dans le feed-forward de test |
| Positions et masques | Opérateurs de sélection manquants | `Equal`, `Not`, `Where`, `Range`, `CumSum` ajoutés ; chaîne de positions avec padding vérifiée |
| `Cast` | Conversion ignorée | Conversions numériques ciblées vers FLOAT, BOOL, INT32 et INT64, avec limite explicite de représentation FP32 |
| Parsing | Attributs répétés packed et constantes entières insuffisamment lus | Lecture des listes packed, constantes entières, scalaires et données float sans dépendance à l'alignement mémoire |
| Chargement | Opérateur inconnu ou producteur absent ignoré | Refus explicite d'un graphe incomplet ; résolution des opérateurs par domaine qualifié |
| Poids externes | Références externes non résolues | Métadonnées conservées et `IOnnxBuildOptions.resolveExternalData` fourni par l'hôte ; absence de resolver ou taille incohérente refusée |
| Routage Core | Sorties multiples sélectionnées par ordre des liens ; noms de sorties insuffisants | Index de sortie explicite sur `IDataLink`, noms des sorties ONNX et conservation des positions d'entrées optionnelles ; fan-out de sortie auxiliaire vérifié |

Les corrections suivent les formes attendues par les spécifications [MatMul](https://onnx.ai/onnx/operators/onnx__MatMul.html), [Gather](https://onnx.ai/onnx/operators/onnx__Gather.html), [Softmax](https://onnx.ai/onnx/operators/onnx__Softmax.html) et [LayerNormalization](https://onnx.ai/onnx/operators/onnx__LayerNormalization.html). La conformité testée ici cible l'opset 17, pas toutes les variantes historiques de ces opérateurs.

## 3. Validation reproductible

Les nouvelles fixtures sont dans `packages/tests/onnx-ops/` du dépôt SpikyPanda :

- `generate_transformer_vectors.py` crée les petits modèles et références avec ONNX Runtime CPU, avec une graine fixe et sans téléchargement de modèle.
- `transformer-vectors.json` contient 32 cas numériques. Les modèles associés sont dans `models/transformer-*.onnx`.
- `transformer-ops.test.ts` compare les formes et valeurs après parsing et exécution par le graphe natif. Il ajoute les contrôles de types inconnus, bornes, dimensions, fan-out, poids externes et formes dynamiques successives.

Deux cas d'encodeur utilisent un batch et une séquence de tailles différentes. Leurs logits doivent correspondre à la référence à une tolérance absolue et relative de `3e-5`. Ces modèles sont des fixtures réduites, pas les poids ni une reproduction exhaustive de LLMLingua-2.

La compilation des paquets Core et ONNX et les suites ciblées de conformité ONNX, Transformer, chargement validé et streaming du plugin passent : 223 tests. Quatre suites complémentaires couvrent la planification Core, le round-trip ONNX, le round-trip quantifié et les opérateurs de domaine CyanMycelium : 39 tests supplémentaires passent, soit 262 au total. La suite complète du dépôt n'a pas été exécutée.

Commandes depuis le dépôt SpikyPanda :

```text
python packages/tests/onnx-ops/generate_transformer_vectors.py
node node_modules/typescript/lib/tsc.js -b packages/dev/onnx/tsconfig.build.json --pretty false
node scripts/fix-esm-dist.mjs packages/dev/core packages/dev/onnx
node -e "require('jest-cli').run(['--runInBand','--silent','--runTestsByPath','packages/tests/onnx-ops/transformer-ops.test.ts','packages/tests/onnx-ops/onnx-ops.test.ts','packages/tests/onnx-plugin/model-streaming.test.ts','packages/tests/onnx-plugin/model-validated.test.ts'])"
```

L'installation locale possède les modules Jest et TypeScript, mais leurs fichiers exécutables `bin` sont absents. Les commandes ci-dessus utilisent leurs points d'entrée disponibles, sans modifier les dépendances.

## 4. Limites et validation du modèle complet

1. L'export exact validé est identifié dans `LLMLingua2/model.json` et `LLMLingua2/results/manifest.json`. Il contient 2 511 opérateurs de 23 types, dans le domaine ONNX standard, à l'opset 17. Une autre révision, un autre exporteur ou des opérateurs fusionnés nécessitent une nouvelle validation.
2. Les logits et décisions du modèle complet sont comparés sur neuf batches, dont un batch de deux segments à 511 positions provenant d'un texte de 560 sous-tokens. Les huit reconstructions sont identiques à la référence. La latence des kernels génériques JavaScript reste élevée : 18 à 35 secondes sur les batches courts et environ 662 secondes sur le batch long.
3. Le runtime tensoriel conserve des `Float32Array`. Les identifiants et petites dimensions entières sont représentables, mais cela ne constitue pas un backend général INT64, FP16 ou quantifié. Certaines conversions et certains dtypes sont maintenant refusés explicitement ; la couverture de tous les formats et valeurs reste à auditer sur l'export réel.
4. Les anciennes variantes d'opset et les opérateurs fusionnés ne sont pas couverts par la seule conformité opset 17. Le chargeur ne réalise pas encore une validation complète des versions d'opérateurs.
5. La résolution des poids externes appartient à l'hôte : il doit fournir le bon segment de données et sa politique de transport. Le callback ajouté n'implémente pas un téléchargement automatique.
6. Le tokenizer enrichi, le découpage, les budgets et la reconstruction officielle sont désormais vérifiés dans le banc complet. Deux anomalies de LLMLingua 0.2.2 sont conservées pour mesurer sa fidélité exacte : tokens spéciaux BERT utilisés par défaut dans le dataset XLM-RoBERTa et espace parfois perdu lors de la restauration d'un mot imposé. Les corriger modifiera la référence et demandera une validation séparée.
7. Les économies de tokens et la fidélité doivent être mesurées avec le tokenizer du LLM destinataire et sur les tâches du harness. Aucun gain chiffré n'est revendiqué par cette vérification de kernels.

## 5. Intégration dans le graphe hétérogène

Le parcours envisagé est : contexte à compresser, tokenisation et préparation des masques, kernels Transformer, scores de conservation, sélection selon le budget, reconstruction, puis construction du prompt du reasoner.

Les opérateurs ONNX sont des `IKernel`, donc des nœuds d'exécution natifs. Leur topologie peut être reliée au graphe étendu avec les transitions de contexte prévues dans le [brief d'architecture](brief-graphe-heterogene-et-execution-distribuee.md). L'imbrication reste une option de représentation ; elle ne doit pas imposer une boîte opaque ou une nouvelle session.

La définition du contexte source reste disponible dans sa session. Le texte compressé est un résultat dérivé, avec ses références de modèle, son budget et les correspondances nécessaires à son contrôle. Le placement du calcul peut être local ou distant selon les capacités disponibles.

Le socle tensoriel et le modèle entraîné sont exécutés et vérifiés dans SpikyPanda. La préparation des textes et leur reconstruction restent exercées par Python dans le banc `LLMLingua2`. Leur raccordement aux contextes et transitions du runtime du harness reste à implémenter.
