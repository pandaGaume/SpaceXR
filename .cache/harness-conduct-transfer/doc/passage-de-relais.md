# Passage de relais entre sessions

Date : 11 octobre 2026.

Statut : architecture retenue et relais local avec retour implémenté dans le test [harness et ONNX](../LLMLingua2/harness-flow/README.md). La variante initiale conserve une session ; la variante de relais vérifie deux parcours qui se chevauchent avec quatre sessions natives. Les paramètres généraux de sélection, placement et budgets ci-dessous restent proposés.

Décision retenue : commencer par le relais avec retour (`await-result`). La continuation source attend le résultat, la cible effectue le parcours confié, puis le retour corrélé rend la continuation source prête à progresser. Cette attente n'empêche pas d'autres sessions de parcourir la même topologie. Le test vérifie maintenant cette propriété avec deux relais en cours.

## Principe

Un passage de relais transmet la responsabilité d'une continuation du graphe à une autre session autonome. Le lien déclare cette possibilité ; le runtime source réalise le passage et le runtime destinataire accepte la continuation. La topologie reste celle du même graphe logique, sans imposer un sous-graphe.

Un changement de domaine ou de backend ne déclenche pas à lui seul un passage de relais. Une session peut rattacher des capacités compatibles et poursuivre le parcours. Les contextes, buffers, attentes et ressources vivantes restent portés par les sessions natives de Core.

Chaque session possède son contexte propre. Les nœuds et liens ne portent pas d'état d'exécution mutable propre à une inférence ; ils accèdent à cet état dans la session reçue. Plusieurs sessions peuvent donc parcourir la même topologie sans que l'une doive attendre la fin de l'autre. La configuration de la topologie reste distincte des buffers, états et attachements de chaque exécution.

Un relais met en attente la continuation source concernée, puis la cible poursuit le parcours confié après acceptation. Autonomie signifie contexte et cycle de vie propres. Une bifurcation au sein d'un parcours et plusieurs inférences indépendantes sur le même graphe sont deux usages distincts. La validation actuelle couvre le second usage avec un relais par parcours.

## Paramètres de décision proposés

Ces noms sont des champs de conception, pas des exports existants.

| Paramètre | Rôle |
| --- | --- |
| `execution.policy` : `continue`, `handoff`, `auto` | Impose la continuation dans la session courante, impose le passage de relais ou autorise le runtime à choisir selon les contraintes déclarées. Valeur initiale recommandée : `continue`. |
| `target.runtime` | Désigne le profil d'exécution requis, par exemple calcul tensoriel ou simulation avec solveur. Un domaine différent reste compatible avec la même session si elle peut fournir ce profil. |
| `target.capabilities` | Références aux besoins et contrats des capacités nécessaires. Les capacités MCP sont résolues par la discovery, le routage et les autorisations publics du broker. Les attachements de calcul locaux utilisent les mécanismes natifs concernés. |
| `target.placement` | Contraint le lieu d'exécution : local, cible désignée ou sélection autorisée. Une cible distante peut employer une session distante existante ; le placement ne prescrit pas une session enfant. |
| `session.isolation` : `shared`, `separate` | Autorise l'utilisation du contexte courant ou exige une session distincte avec son propre état et cycle de vie. |
| `target.session` : `new`, `existing` | Lors d'un relais, ouvre une session ou adresse une session existante compatible. Une identité explicite est nécessaire dans le second cas. |
| `source.afterHandoff` : `release`, `await-result` | La source cède la continuation ou conserve une attente de retour pour celle-ci. Les autres sessions restent indépendantes. |
| `context.projection` | Décrit les données et références transmises, leur version et leur propriété. Peut rendre le relais impossible si un état indispensable ne peut pas être transféré ou reconstitué. |
| `limits` | Budgets et contraintes déclarés : mémoire, échéance, concurrence, horizon ou horloge de simulation. Seules des exigences vérifiables doivent décider de l'admission. Une estimation de latence n'est pas une garantie. |
| `failure.policy` : `fail`, `wait`, `fallback-continue` | Comportement si la cible n'est pas admissible ou n'accepte pas le relais. Le repli local exige une compatibilité vérifiée et une permission explicite ; aucune dégradation silencieuse. |

Le runtime combine ces déclarations avec les faits de la session : attachements actuels ou attachables, ressources disponibles, droits, charge, état d'annulation et disponibilité de la cible. Ces faits restent dans les sessions ou les services natifs concernés, jamais dans une copie de catalogue portée par le lien.

## Règle de décision

1. Vérifier les contraintes, droits, contexte requis et budget avant activation de la destination.
2. Pour `continue`, poursuivre seulement si la session courante satisfait toutes les contraintes, éventuellement après un attachement natif compatible. Sinon appliquer la politique d'échec.
3. Pour `handoff`, résoudre une session cible admissible et préparer le relais. Le runtime ne continue pas localement sauf repli explicitement autorisé.
4. Pour `auto`, continuer si toutes les contraintes sont satisfaites localement. Sinon passer le relais si une cible admissible existe et si le contexte est transférable. Sinon appliquer la politique d'échec.

L'isolation séparée, un placement inaccessible au runtime courant ou un profil d'exécution incompatible peuvent imposer le relais en mode `auto`. Le seul coût estimé d'un calcul ou le passage CPU vers GPU ne l'imposent pas. Une politique d'optimisation des coûts pourra être ajoutée ultérieurement avec ses mesures et règles explicites.

## Sort de la session source

- `release` : la source cède la continuation après acceptation. Elle peut fermer lorsque ses ressources ont été libérées et qu'elle n'a plus d'attente.
- `await-result` : la source garde une attente corrélée et reste suspendue. Un lien de retour lui rend la responsabilité de poursuivre le parcours.

Une future option `continue-independent` pourrait autoriser une bifurcation concurrente explicitement déclarée par le graphe. Elle ne fait pas partie de l'implémentation de base et le runtime ne doit pas la déduire du passage de relais.

## Respecter l'indépendance native des sessions

Chaque relais possède sa propre identité, ses sessions source et cible, sa corrélation, sa tentative et son attente de retour. Ne pas introduire de variable globale de type session courante, contexte courant ou résultat attendu. L'indépendance des contextes est un principe de base des sessions, pas une capacité à ajouter ultérieurement.

L'état de suspension appartient à la session source et à sa continuation, pas au runtime entier. Les ressources et buffers appartiennent à la session qui les utilise. La source conserve son contexte pendant l'attente ; la cible reçoit une projection explicite, sans référence mutable partagée implicitement. Une annulation ou un échec doit cibler une activité identifiée.

Le relais doit préserver la progression indépendante de plusieurs sessions natives sur la même topologie. Une attente de relais ne suspend que la continuation concernée. L'admission et la reprise doivent s'intégrer aux mécanismes de Core, sans créer un second ordonnanceur dans le harness. Les propriétés réelles de concurrence des chemins d'exécution et des adaptateurs devront être testées, sans attribuer par défaut une limitation au modèle de session.

Le test actuel partage un objet `run.activeDomain` entre les états des nœuds d'une même session. Ce mécanisme expérimental ne suffit pas à plusieurs branches simultanées dans cette session. Pour des sessions parallèles, chaque session doit avoir son propre contexte ; pour plusieurs continuations dans une session, la portée du domaine devra être celle de l'activation concernée.

Le runner ONNX initial prépare une seule session et un seul objet de suivi `memory`, rattaché à ses états de nœuds. Dans la variante de relais, chaque session ONNX possède son suivi d'allocations et chaque session harness son worker texte. Les poids immuables restent partagés et les tenseurs intermédiaires sont isolés. Le backend GPU met les appels concurrents en file par opération, sans imposer qu'une inférence entière termine avant la suivante.

Les tests CPU vérifient deux sessions sur le même graphe, des retours dans l'ordre inverse des départs et une annulation qui n'affecte pas l'autre session. Le test LLMLingua vérifie deux parcours ONNX entrelacés, leurs retours corrélés et la libération des ressources intermédiaires. Le parallélisme de calcul sur plusieurs threads ou dispositifs est une propriété supplémentaire à mesurer, distincte de la progression concurrente des sessions.

La cible n'est donc pas systématiquement une session enfant. La filiation est une information de cycle de vie et de corrélation, indépendante de l'imbrication du graphe et du placement.

## Destination du retour

Le retour est une livraison par un lien déclaré dans le graphe vers une entrée précise de la session source. Il ne signifie pas rejouer le nœud qui a émis le relais. Il ne dépile pas implicitement une pile de sessions.

Lors du départ, l'attente de la source enregistre : identifiant du relais, session source, branche ou continuation, corrélation, tentative, lien de retour autorisé, nœud destination et port destination. La destination peut être différente du nœud de départ. Elle doit être raccordée par la topologie, et compatible avec la valeur de retour ; la cible ne choisit pas librement un nœud quelconque.

La cible émet son résultat par le lien de retour avec l'identifiant du relais et de la tentative. Le runtime retrouve l'attente source, vérifie la destination et livre la valeur dans les buffers natifs de cette session. Il satisfait ensuite l'attente concernée et permet au scheduler natif de poursuivre les activations prêtes. Une livraison ne force pas un nœud à s'exécuter si ses autres entrées requises manquent.

Dans le test LLMLingua, le point de retour proposé est l'entrée `logits` du nœud `reconstruct` dans la session harness. Le contexte texte issu de `tokenize` reste dans cette session et rejoint les logits selon les liens existants. La session de calcul ne revient donc pas dans `tokenize` et ne reconstruit pas elle-même le texte.

Un retour d'erreur ou d'annulation doit suivre sa relation déclarée, ou terminer explicitement l'attente en échec si aucun parcours de traitement n'est prévu. Un doublon ou le résultat d'une ancienne tentative ne doit pas réactiver la continuation une seconde fois.

La source conserve ses propres buffers et états, pas une position implicite sur une pile d'appels. Des relais successifs peuvent former une chaîne de dépendances entre sessions, mais chaque retour reste adressé et corrélé. Cette représentation prépare les retours désordonnés de sessions parallèles, que ne peut pas exprimer une règle générale de dépilage LIFO.

## Contenu et acceptation du relais

L'enveloppe proposée comprend : identité/version du graphe, lien et destination/port, identités des sessions, branche, corrélation, tentative, identifiant de relais, valeur transmise, projection du contexte, échéance et règle de retour. La cible doit vérifier sa compatibilité avec cette version du graphe.

Le relais transporte une activation et le contexte requis pour sa continuation, pas un checkpoint implicite de toute la session source. Pour une destination à plusieurs entrées, les livraisons corrélées doivent rejoindre la même session et la même activation cible. Transférer chaque entrée vers une nouvelle session empêcherait la réunion native des entrées.

Les connexions MCP, solveurs, workers et handles GPU restent la propriété du runtime qui les a ouverts. La cible les rattache localement. Les tenseurs passent par une représentation compatible ou un mécanisme explicite de partage dont la durée de vie est garantie.

La source conserve la responsabilité du relais préparé jusqu'à son acceptation par la cible. L'acceptation doit identifier la session cible et la tentative. Elle précède la libération de la continuation source. Les états proposés sont : préparé, accepté, en cours, terminé, échoué, annulé. Les doublons et acquittements perdus doivent être traités explicitement ; une livraison exactement une fois n'est pas présumée.

Les résultats rejoignent les liens de retour du graphe avec leur corrélation. Un résultat ancien ne satisfait pas une tentative nouvelle. La propagation de l'annulation, les délais et la fermeture des ressources font partie du contrat de relais.

## Réutilisation et écarts constatés

Le [brief du graphe hétérogène](brief-graphe-heterogene-et-execution-distribuee.md) reste le cadre. La [relecture Core](relecture-spikypanda-et-reutilisation.md) identifie les mécanismes à réutiliser.

`IHarnessLink.mode` expose actuellement `continue`, `spawn`, `result`, tandis que `HarnessLink` restaure ces métadonnées via `cloneable`. Ce contrat proposé antérieurement ne réalise pas encore de relais autonome. `spawn` décrit une ouverture de session enfant et ne suffit pas à représenter tous les cas ci-dessus. Sa compatibilité devra être traitée avant toute modification du contrat et des JSON existants.

Dans Core, le scheduler livre les liens par `Session.deliverLinkRef`. Le parcours statique asynchrone dispose maintenant d'une frontière optionnelle `ISession.deliverLinkRefsAsync` et d'une portée native `IStaticRunOptions.nodes`. Le relais local utilise ces extensions pour attendre l'admission et faire parcourir à la cible uniquement ses nœuds, sur la même instance de graphe. Aucun second ordonnanceur n'est introduit. Ces extensions ne réalisent pas à elles seules un protocole distant ou une reprise durable.

## Validation réalisée et portée restante

La variante initiale reste la référence `continue`. La variante avec relais obligatoire à l'entrée ONNX utilise une session de calcul autonome et un retour vers la reconstruction par le lien déclaré. La source conserve son attente et ne progresse pas pendant le parcours de sa cible ; une autre paire de sessions peut toutefois avancer sur la même topologie.

Le [résultat vérifié](../LLMLingua2/harness-flow/relay-result.json) contient deux corrélations en cours, la réunion de `input_ids` et `attention_mask` dans chaque cible, les traces de suspension/reprise et les textes identiques à la référence officielle. Après les deux parcours, seules les 391 allocations de poids restent vivantes. Les tests ciblés couvrent refus d'admission, annulation, résultats périmés ou dupliqués, destination non déclarée et absence de résultat.

Cette validation locale ne démontre ni un relais distant, ni une reprise durable. Elle utilise le parcours statique acyclique, un seul relais par session source et un reasoner de test. Le relais général reste à raccorder aux résolveurs industriels ; la sélection automatique, les budgets et les chaînes de relais nécessitent leur implémentation et leurs propres tests.
