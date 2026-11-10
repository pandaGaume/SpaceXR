# Analyse du brief : boucles cognitives et manques du harness CO2

Date : 10 octobre 2026.

Cette note complète les [fondements du harness industriel](fondements-harness-industriel.md). Elle analyse le second texte transmis et confronte ses propositions au code local de `co2-scrubber-governed-agent`.

**Conclusion : le harness CO2 fournit déjà un socle d'exécution gouvernée, de contexte structuré et de correction d'appels. L'écart principal est la généralisation de ces mécanismes en une boucle cognitive explicite P1/A0/R1/P2, dont les décisions reposent sur des affirmations traçables et des preuves.**

## 1. Périmètre et statut des constats

Le brief est une conversation de conception, pas une spécification homogène validée dans son intégralité. Les corrections ultérieures de l'utilisateur priment sur le schéma initial de l'assistant.

La comparaison repose sur la lecture des fichiers locaux du dépôt CO2, notamment `harness/`, `lib/`, le slot `reasoner`, le slot `library`, leurs spécifications et certains tests. Plusieurs fichiers comportent des modifications non commitées, dont l'intégration récente de l'Observer au harness commun. Ces changements font partie de l'état examiné.

Aucune exécution industrielle, aucun appel de modèle et aucune mesure de performance n'ont été réalisés pour cette analyse. Le code présent dans le checkout ne permet pas d'affirmer que le processus actuellement démarré utilise exactement ces versions. Les absences mentionnées concernent le chemin examiné ; elles ne prouvent pas l'absence d'une fonction dans tous les composants externes.

## 2. Ce que le brief établit réellement

### La correction de topologie est fondatrice

L'utilisateur corrige explicitement le schéma des deux boucles : une première boucle complète P1 prépare le prompt ; A0 traite la tâche ; R1 analyse la réponse ; si elle ne convient pas, une deuxième boucle P2 reconstruit la sollicitation à partir des manques, puis renvoie vers A0.

```text
Objectif et contraintes
        |
        v
P1* : préparer le contexte et le premier prompt
        |
        v
A0 : traiter la tâche
        |
        v
R1 : analyser la réponse et ses preuves
        |
        +--> ACCEPT : résultat accepté dans un périmètre explicite
        |
        +--> ABORT : arrêt explicite avec les éléments non résolus
        |
        +--> REFINE --> P2* --> A0 --> R1 --> ...
```

L'astérisque indique une boucle interne autonome. P1 et P2 peuvent découvrir, lire, vérifier et enrichir avant de remettre un prompt à A0. Les issues ACCEPT/REFINE/ABORT sont une proposition de l'assistant qui rend la boucle bornable ; leurs noms restent à spécifier.

R1 ne se réduit donc pas à un réparateur de JSON. P2 ne se réduit pas à une reformulation : il peut rechercher une preuve, changer l'outil proposé ou réviser une hypothèse. A0 peut utiliser un modèle différent de ceux mobilisés par les autres rôles.

### Le substrat est le graphe

« GARF » est une erreur corrigée explicitement par l'utilisateur en « GRAPHE ». Il ne désigne aucune technologie distincte à créer. L'incident illustre le risque de transformer une interprétation non étayée en concept supposé acquis.

Ces quatre rôles doivent s'inscrire dans le graphe/runtime/session déjà décrit. Ils ne justifient pas quatre moteurs de workflow indépendants. La session porte leurs contextes, budgets et capacités ; le graphe relie objectifs, hypothèses, preuves, réponses, diagnostics, corrections et exécutions.

### Le contrôle doit porter sur trois niveaux différents

| Niveau | Question | Réponse attendue |
| --- | --- | --- |
| Syntaxe | La production est-elle lisible et conforme au contrat ? | Parsing, types, schéma, champs requis |
| Sémantique | Exprime-t-elle bien la demande et préserve-t-elle le sens ? | Références, unités, ambiguïtés, hypothèses introduites |
| Preuves | Ses affirmations sont-elles soutenues par des sources applicables ? | Observations, provenance, validité et contradictions |

Une réparation de forme ne remplace pas une recherche d'information. Une approbation par un deuxième LLM ne constitue pas une preuve. Une réponse inconnue ou non démontrée doit pouvoir rester explicitement non résolue.

## 3. Socle déjà présent dans CO2

Les mécanismes suivants ont des points d'implémentation identifiables. Leur présence ne démontre pas leur fiabilité pour toutes les tâches envisagées par le brief.

| Mécanisme | Preuve locale | Portée constatée |
| --- | --- | --- |
| Exécution par graphe | [flow.ts](../../co2-scrubber-governed-agent/harness/lib/flow.ts), `buildHarnessGraph` ; [agent.ts](../../co2-scrubber-governed-agent/harness/core/agent.ts), `createAgent` | Graphe V1 typé, construit avec Core et exécuté par le runtime ; services de raisonnement, observation, garde, évaluation et mémoire |
| Contexte reconstruit | [reasoning-state.ts](../../co2-scrubber-governed-agent/harness/core/reasoning-state.ts), `reasoningStateOf` ; [workspace-observer.ts](../../co2-scrubber-governed-agent/harness/core/workspace-observer.ts) | Objectif, invariants, preuves compactées, hypothèse, refus, exigences, questions ouvertes et mémoire ; mode `state` disponible |
| Préparation spécialisée | [observer.ts](../../co2-scrubber-governed-agent/harness/observer/observer.ts), `observe` ; [topic Observer](../../co2-scrubber-governed-agent/harness/topics/observer/index.ts) | Prépare une demande de jumeau à partir de description, télémétrie et lectures ; utilise maintenant `runTask` |
| Interprétation d'arguments | [interpreter.ts](../../co2-scrubber-governed-agent/harness/core/interpreter.ts), `interpret`, `coerce`, `readMeaning` | Lecture déterministe, extraction par modèle, puis passage au schéma et à la garde ; seconde lecture du sens sur refus répétés ciblés |
| Revue sémantique de contrats | [supervisor.ts](../../co2-scrubber-governed-agent/harness/supervisor/supervisor.ts), `supervise`, `checkVerdict`, `scopeOf` | Faits, hypothèses et symboles ; verdicts typés ; conflits déterministes conservés ; périmètre du verdict explicité |
| Provenance physique et justification | [contracts.ts](../../co2-scrubber-governed-agent/harness/core/contracts.ts), `Fact`, `reviewContracts` ; [justify.ts](../../co2-scrubber-governed-agent/harness/core/justify.ts) | Faits numériques typés, unités, producteurs, hiérarchie de sources, justifications et limites issues de documents signés |
| Référentiel documentaire | [library/provider.ts](../../co2-scrubber-governed-agent/slots/tools/library/provider.ts) | Documents locaux, recherche textuelle, lectures avec empreinte, faits, règles et signatures ; cartes de méthodes et graphes de référence |
| Traces et corrections | [manifest.ts](../../co2-scrubber-governed-agent/harness/core/manifest.ts), [runner.ts](../../co2-scrubber-governed-agent/harness/core/runner.ts), [harness-graph.ts](../../co2-scrubber-governed-agent/lib/harness-graph.ts) | Étapes, échanges, versions, épisodes, formes de refus et corrections ; graphe d'analyse reconstruit depuis les sources |
| Modèles par rôle | [routing.json](../../co2-scrubber-governed-agent/specs/reasoner/routing.json), [reasoner/provider.ts](../../co2-scrubber-governed-agent/slots/reasoner/provider.ts) | Routage par usage, notamment `interpret` et `meaning` ; modèle d'une conversation conservé à son ouverture |
| Arrêts bornés | [runner.ts](../../co2-scrubber-governed-agent/harness/core/runner.ts) | Budgets de décisions, appels et temps ; arrêt sur répétitions, conflits de sources, capacité manquante ou panne du raisonneur |

Il serait donc incorrect de conclure que CO2 ne possède ni graphe, ni validation sémantique, ni contexte dynamique, ni provenance, ni mémoire de correction.

## 4. Manques structurels par rapport à la cible

### M1. Une boucle P1/A0/R1/P2 générale n'est pas matérialisée dans le chemin examiné

Le graphe V1 décrit un pas de décision gouverné : observer, contextualiser, consulter la mémoire, raisonner si nécessaire, garder, exécuter, évaluer et enregistrer. Le runner répète ces pas et réintroduit les refus dans l'état.

L'Observer fournit une préparation spécialisée ; le Contract Supervisor fournit une revue spécialisée. Ils constituent des points de départ crédibles pour P1 et R1, mais leurs contrats ne sont pas ceux d'une préparation et d'une analyse universelles. La présence de ces agents ne suffit pas à établir la boucle corrigée du brief.

**À construire :** des transitions explicites entre contexte suffisant, tentative A0, diagnostic R1 et remédiation P2. La complétude d'un prompt, la conformité d'une réponse et l'autorisation d'une action doivent avoir des critères distincts.

### M2. La découverte du catalogue MCP reste essentiellement anticipée et filtrée

`buildCapabilities` parcourt les slots et leurs outils, récupère leurs descriptions et schémas, puis applique les profils. L'adaptateur OpenAI-compatible transmet les schémas de toutes les capacités autorisées au pas courant. Le filtrage par sujet et disponibilité limite déjà l'exposition.

La recherche des types de nœuds du studio est un autre mécanisme, existant, à distinguer de la découverte d'un grand catalogue d'outils MCP. Elle ne démontre pas que ce dernier est découvert progressivement par besoin fonctionnel.

**À construire :** une découverte capacité → candidats → description → schéma à la demande, avec index et filtres d'autorisation. Les 12 000 outils sont une cible illustrative du brief, pas la taille mesurée du catalogue CO2. L'exposition complète du catalogue autorisé peut devenir un obstacle à cette échelle.

### M3. Le contexte actif et le graphe d'analyse ne forment pas encore le registre général demandé

Le contexte de raisonnement est déjà structuré et reconstruit. Le graphe `HarnessGraph` relie tâches, épisodes, sources et corrections, mais se décrit comme une vue dérivée des traces et manifestes. Dans le runner examiné, le contexte est assemblé à partir de `Progress`, de la tâche, du sujet et de la mémoire ; il n'est pas directement une projection de ce graphe d'analyse.

**À construire :** un contrat commun d'identité et de provenance pour l'état actif et son historique. Un stockage en fichiers et un graphe dérivé peuvent rester valables : le manque porte sur la sémantique partagée et son utilisation pendant la décision, pas sur l'obligation de changer de base de données.

### M4. Les statuts épistémiques ne couvrent pas toutes les affirmations

Les faits physiques et constantes possèdent déjà des statuts et sources. Le brief demande aussi de suivre des assertions libres : identité d'un concept, explication d'une anomalie, interprétation d'une demande ou proposition d'un mode dégradé.

**À construire :** un registre d'affirmations référencées, avec support, contradiction, résolution et portée d'utilisation. Une inférence répétée ne doit pas être promue en fait établi.

Les statuts proposés dans le brief mélangent plusieurs axes. `OBSERVED` décrit une origine, `INFERRED` un mode de production, `VERIFIED` un résultat de contrôle, `AMBIGUOUS` un état de résolution. Mieux vaut conserver ces dimensions séparément et historiser les changements. Observer qu'un utilisateur a écrit « GARF » ne vérifie pas que GARF désigne une technologie.

### M5. La réparation n'établit pas à elle seule la conservation du sens

L'interprète demande au modèle de ne rien inventer, puis contrôle que l'extraction satisfait le schéma. La garde vérifie ensuite ses contraintes. Ces contrôles ne démontrent pas, pour tout champ possible, que la production normalisée conserve exactement le sens de l'original.

Deux limites sont visibles dans `coerce` :

- La lecture d'un nombre textuel accepte un suffixe d'unité puis ne conserve que le nombre. Une chaîne `"1.5 m3/min"` peut devenir `1.5` pour un champ numérique, sans contrôle de l'unité attendue dans cette fonction. Un contrôle ultérieur peut refuser certains cas, mais la normalisation seule ne garantit ni compatibilité ni conversion.
- Un objet portant un identifiant peut être réduit à cet identifiant, même s'il porte d'autres champs. Il faut distinguer des métadonnées superflues de contraintes significatives qui seraient perdues.

Ces constats proviennent de la lecture du code ; ils ne prouvent pas qu'une commande dangereuse a été exécutée.

**À construire :** une transformation traçable par champ avec support dans l'original, contrôle des unités, déclaration des champs perdus ou ambigus et rejet des compléments non soutenus. La conformité du schéma et la sûreté d'une action restent deux validations supplémentaires.

### M6. R1 reste spécialisé et P2 reste surtout implicite

Le Contract Supervisor juge des faits et demandes dans un périmètre déclaré. La relecture `meaning` s'active sur des points refusés qui ne changent pas ; elle prépare un appel corrigé pour le pas suivant. Les refus ordinaires sont réintroduits dans l'état pour que le modèle redécide.

Ces mécanismes n'établissent pas un R1 général qui compare toutes les affirmations d'une réponse A0 aux preuves, ni un P2 qui choisit explicitement entre réparation, clarification au modèle, nouvelle observation, autre outil ou nouvelle stratégie.

**À construire :** un diagnostic typé avec nature du défaut, éléments concernés, preuves attendues, gravité et opération corrective. P2 doit recevoir ce diagnostic et un contexte sélectionné. Il peut modifier la stratégie et la question, mais ne doit pas affaiblir silencieusement l'objectif, les exigences ou les autorisations pour obtenir un ACCEPT.

### M7. La preuve documentaire est qualifiée en partie, pas par tous les critères du brief

CO2 possède des sources choisies, empreintes, signatures, faits et règles. La recherche textuelle examinée ne démontre pas une sélection générale selon date de validité, installation, domaine d'application et niveau d'autorité documentaire.

**À construire :** les métadonnées et filtres d'applicabilité nécessaires, ainsi que des relations explicites de retrait et remplacement. Une signature intacte ne prouve pas, seule, qu'un document reste applicable aujourd'hui à l'équipement concerné. Une ancienne réponse corrigée ne doit pas revenir comme preuve lors de la récupération du contexte.

### M8. Le routage n'est pas encore une politique adaptative de convergence

Le routage par rôle et les usages d'interprétation existent. Le slot conserve le modèle à l'ouverture d'une conversation. Cela diffère d'une politique qui escalade ou redescend selon ambiguïté, difficulté, refus successifs et budget restant.

**À construire :** des règles explicites de changement de modèle et leur mesure, sans accorder plus d'autorité au modèle plus puissant. Le brief ne démontre pas qu'un petit modèle local réussira une tâche donnée ; cela reste une hypothèse à tester.

### M9. La mémoire des transitions existe, mais ne mesure pas encore toute la remédiation cognitive

Les épisodes, contrastes refusé/accepté et liens de correction sont présents. Ils constituent une base pour mémoriser « défaut → correction → effet ».

L'évaluateur générique récompense aussi une opération réussie ou un changement de fichiers. Cette réussite locale n'est pas équivalente à la justesse factuelle de la tâche finale. L'acceptation d'une correction après un refus ne démontre pas non plus, seule, qu'elle est la cause d'une amélioration généralisable.

**À construire :** des résultats de remédiation distinguant conformité locale, conservation du sens, niveau de preuve et succès métier. La réutilisation doit dépendre du contexte, du modèle, du contrat et de sources toujours applicables.

## 5. Ajustements nécessaires dans le brief lui-même

Le plan d'implémentation initial doit être réécrit autour de la correction P1/A0/R1/P2. Construire seulement un Prompt Builder et un Response Interpreter reliés par des retries laisserait le besoin principal incomplet.

Les cinq intentions DISCOVER, INSPECT, EXECUTE, ANSWER et BLOCKED sont un protocole proposé. Elles ne remplacent ni la topologie des rôles ni leurs contrats. Leur adoption doit s'intégrer aux capacités existantes ; elle ne doit pas dupliquer arbitrairement le protocole d'appel d'outils.

« Sans intervention humaine entre les appels » signifie que la recherche et la correction peuvent boucler automatiquement dans les droits déjà accordés. Une ambiguïté insoluble doit produire un état non résolu. Une opération protégée doit rester en attente d'autorisation ou être rejetée conformément à la politique existante. P2 ne peut pas fabriquer cette autorisation.

Enfin, une trace rejouable permet de reproduire les entrées, les transformations et les verdicts enregistrés. Elle ne garantit pas qu'un nouvel appel LLM produira exactement le même raisonnement ou la même réponse.

## 6. Ordre de construction recommandé

### Étape 1 : définir les contrats et protéger la provenance

Définir les objets de tentative, affirmation, preuve, diagnostic et correction, en les reliant aux identités déjà présentes. Fixer les critères de suffisance de P1, de verdict de R1 et d'arrêt de P2. Corriger en priorité les ambiguïtés de normalisation des unités et les pertes de champs significatifs.

Critère d'acceptation : une normalisation ne peut ni ajouter une valeur absente, ni modifier son unité ou sa portée sans une transformation explicite contrôlée.

### Étape 2 : réaliser une tranche P1/A0/R1/P2 dans le graphe existant

Choisir une tâche représentative, raccorder les rôles au runtime commun et conserver leur contexte dans la session. Réutiliser l'Observer, le superviseur et les mécanismes de refus là où leurs contrats conviennent. La boucle V1 reste un socle possible d'exécution des pas ; la boucle cognitive introduit des responsabilités et transitions supplémentaires.

Critère d'acceptation : R1 détecte un manque précis, P2 cherche l'information ou reconstruit la sollicitation, A0 est rappelé et R1 réévalue. La trace relie la réponse initiale, le diagnostic, le changement et le résultat final.

### Étape 3 : généraliser la découverte et le contexte par preuves

Ajouter la découverte MCP progressive, le registre d'affirmations et la projection du contexte selon pertinence, autorité et budget. Conserver la source complète accessible, même si son contenu est compacté dans le prompt.

Critère d'acceptation : un outil absent du contexte initial peut être découvert et inspecté dans les droits de la session ; une interprétation invalidée n'est plus utilisée comme fait dans les prompts suivants.

### Étape 4 : adapter les modèles et démontrer le gain

Ajouter les règles d'escalade et de retour aux modèles simples après avoir rendu les défauts observables. Comparer au harness existant sur les mêmes tâches et modèles.

Critère d'acceptation : réduire les fausses validations et les boucles inutiles avec coût, latence et arrêts explicites mesurés, sans assouplissement des contrats ni des autorisations.

## 7. Banc de validation à ajouter

Des tests existent déjà pour l'interprète, le superviseur, les contrats, le routage et le graphe d'analyse. Ils ont été consultés, pas exécutés dans cette revue. Ils ne remplacent pas un banc complet de la boucle corrigée.

| Cas | Comportement attendu |
| --- | --- |
| Terme « GARF » non défini | Conserver le terme observé, signaler l'interprétation non étayée, rechercher une résolution ; ne pas inventer son expansion |
| Correction « je voulais dire graphe » | Historiser la correction et retirer l'interprétation invalidée du contexte actif |
| Valeur présente, format erroné | Réparer la forme sans relancer inutilement toute la tâche |
| Champ obligatoire absent | Déclarer le manque ; P2 recherche ou sollicite l'information ; aucune valeur plausible inventée |
| JSON valide contenant une conclusion non soutenue | R1 demande une preuve ou retourne non résolu |
| Valeur textuelle avec unité incompatible | Refus ou conversion justifiée par le service d'unités ; aucune suppression silencieuse |
| Identifiant accompagné d'une contrainte | Préserver la contrainte ou déclarer explicitement ce qui ne peut être représenté |
| Document signé mais hors périmètre ou retiré | Ne pas le promouvoir en preuve applicable |
| Outil non connu au premier prompt | Découverte, inspection et contrôle des droits avant utilisation |
| Plusieurs retries sans nouvelle preuve ni amélioration | Changement de stratégie borné ou arrêt documenté |
| Proposition industrielle non autorisée | Refus indépendant du raisonnement et de la validation sémantique |

Mesurer séparément réussite métier, conformité de forme, conservation du sens, fausses validations, qualité de découverte, nombre d'itérations, coût total des rôles, latence, escalades et arrêts corrects. Des tâches réservées à l'évaluation et des jugements indépendants sont nécessaires pour tester la généralisation. L'accord de R1 avec A0 ne peut pas servir de vérité de référence.

## 8. Décision de conception à retenir

L'évolution vise à rendre explicite une fonction aujourd'hui répartie entre préparation spécialisée, état du runner, gardes, relectures et validation finale : **diagnostiquer ce qui manque, choisir la remédiation, reconstruire le contexte et vérifier le résultat sur preuves**.

La construction doit préserver le graphe comme fondement, la continuité de session et la gouvernance indépendante du modèle. Les composants existants doivent être raccordés et généralisés selon leurs contrats, plutôt que déclarés absents ou reconstruits sans examen.
