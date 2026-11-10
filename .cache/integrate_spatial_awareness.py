from pathlib import Path
from zipfile import ZipFile
from copy import deepcopy
import ast
import hashlib
from lxml import etree
from docx import Document
from docx.shared import Pt, Twips, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/Brief_migration_architecture_multi_moteur_MCP_terrain.docx'
OUT=ROOT/'docs/Brief_migration_architecture_multi_moteur_MCP_terrain_spatial.docx'
REFERENCE=Path(r'C:\Users\GuillaumePelletier\Downloads\SpaceXR_Spatial_Awareness_Brief_v3_Terrain_Awareness.docx')
d=Document(SOURCE)
# Reuse only the document helper definitions, without executing the earlier builder.
tree=ast.parse((ROOT/'.cache/integrate_terrain_workstream.py').read_text(encoding='utf-8'))
helpers=ast.Module(body=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in {'replace','h','p','page','table'}],type_ignores=[])
exec(compile(helpers,'document_helpers','exec'))

for para in d.paragraphs:
    if para.text.startswith('Brief de cadrage |'):
        replace(para,'Brief de cadrage | Architecture, MCP, terrain et orientation spatiale | Révision du 10 novembre 2026')
    elif para.text.startswith('Le brief couvre les dépôts, packages'):
        replace(para,'Le brief couvre l’architecture multi-moteur, les composants MCP et deux chantiers transverses : raffinement du terrain et orientation spatiale. Chaque chantier distingue socle nécessaire, livraisons différées et extensions de recherche. Les estimations sont conditionnelles et séparent les incréments fonctionnels de la migration des dépôts. Le présent cadrage précède toute implémentation.')

page('Orientation spatiale et localisation visuelle')
p('Spatial Awareness aide l’utilisateur à identifier le corps, sa position, la direction du regard et les repères proches. Terrain Awareness, dans l’annexe du nouveau brief, désigne une hypothèse de localisation par signatures visuelles. Cette recherche est distincte du raffinement morphologique du terrain déjà décrit. Elle ne remplace ni le DEM, ni la géodésie, ni la sélection 3D Tiles.')
h('État existant et intégration')
p('Les dépôts contiennent déjà un cadrage Spatial Awareness dans celestial-core/docs/spatial-awareness, spacexr-explorer/docs/spatial-awareness.md et spacexr-mission-control/docs/capabilities/spatial-awareness.md. Ces documents annoncent des capacités à développer. L’intégration présente conserve leurs propriétaires et enrichit le brief commun ; elle ne déclare pas disponibles de nouvelles API et ne modifie pas ces dépôts.')
h('Première livraison nécessaire')
for text in [
 'Produire un contexte réel : corps, position de référence, époque, repère, unités, source et qualité. Distinguer caméra, point sous la caméra et point visé ; séparer altitude sur ellipsoïde et hauteur au-dessus du terrain. Une région sans catalogue reste non identifiée.',
 'Calculer le cap de visée tangent et les directions vers pôles, équateur et lieux disponibles. Signaler les directions indéfinies ou conventionnelles, notamment au pôle exact et pour une visée quasi verticale. Les directions célestes restent distinctes des ancrages au sol.',
 'Livrer Explore par défaut et un premier mode Orient : contexte lisible, directions stables et au plus cinq balises sans collision. Distinguer état dans/hors champ, masqué et occlusion inconnue. Une absence de données reste visible comme telle.',
 'Ouvrir une vue régionale et restaurer un bookmark de caméra avec tolérances et politique temporelle explicites. Les actions manuelles et MCP passent par les mêmes opérations, avec annulation et reprise du contrôle.',
]:p(text,True)
h('Cible UX complète et options')
p('Le mini-globe stable, sa calotte polaire et le mode Survey avec graticule géographique font partie de la cible UX complète. Ils sont différés de la première livraison, pas abandonnés ni remplacés par une promesse de conformité complète. Le graticule drapé dépend de ports terrain et de visibilité qualifiés. La grille métrique locale est une option explicite, avec origine et unités ; sa superposition au graticule exige une demande.')
p('La reconnaissance visuelle sans GPS, la fusion avec odométrie/IMU, le déploiement réel et un environnement Unreal sont hors du socle et de la cible UX initiale. Le protocole Unreal cité dans l’annexe est une piste historique, pas une dépendance de SpaceXR. L’objectif de compréhension en trois secondes sera vérifié avec des utilisateurs ; les tests numériques ne le prouvent pas.')
p('Source : SpaceXR_Spatial_Awareness_Brief_v3_Terrain_Awareness.docx. Le fichier conserve un en-tête interne Version 2.0 du 6 novembre 2026 et une annexe citant le 1er mai 2026. Ces mentions identifient la source ; elles ne prouvent pas une disponibilité logicielle. SHA-256 : '+hashlib.sha256(REFERENCE.read_bytes()).hexdigest()+'.')

page('Répartition de Spatial Awareness par dépôt')
table(['Dépôt','Responsabilité retenue','Frontière et dépendances'],[
('celestial-core','Contexte, directions, lieux, distances et qualité ; contrats d’observation sans moteur.','Réutilise catalogue, rotations, éphémérides, geodesy et Quantia. Sans caméra globale, DOM ni mission.'),
('geodesy_ts','Conversions, repères tangents, projections et primitives géodésiques.','Identifier et chiffrer les méthodes manquantes ; ne pas présumer une inverse géodésique globale disponible.'),
('terrain-core','Hauteur, résolution, datum, qualité et disponibilité des sources.','Fournit la donnée terrain. Sans mode UX, visibilité écran ni encodeur visuel.'),
('3d-tiles-core','Sélection, disponibilité des contenus et ports spatiaux du runtime unique.','Le culling ne prouve pas à lui seul l’absence d’occlusion d’un repère par le terrain.'),
('spacexr-rendering','Projection écran, visibilité et primitives de drapage ou d’ancrage.','Caméra, profondeur et ressources dans les bindings moteurs. Contrats et calculs partagés sans import moteur.'),
('spacexr-explorer','Observations vivantes, HUD, balises, boussole, mini-globe, modes, bookmarks et MCP.','Possède session et révisions ; conserve les API publiques. Perception expérimentale isolée.'),
('spacexr-mission-control','Objectifs, propositions, évaluation et preuves.','Application séparée des cinq dépôts structurants ; runtime à développer, hors première livraison Explorer.'),
('spacexr-tile-service','DEM et provenance ; ultérieurement références et index perceptuels.','Sans carte latente obligatoire. Les index de recherche sont des artefacts versionnés, sans nouveau streaming spatial.'),
],[1.25,2.7,2.25])
h('Contrat commun d’observation')
p('Chaque observation indique session, corps, révision de pose, instant de mesure, époque simulée, repère, position de référence, provenance et qualité. Explorer résout l’origine flottante avant le calcul Celestial. Les valeurs d’une même réponse sont cohérentes ; les données anciennes ou inconnues sont signalées. Une pose connue et une estimation perceptuelle sont distinguées ; la similarité visuelle ne prouve aucune précision métrique.')

page('Behaviors MCP pour le contexte spatial')
p('Les intentions du nouveau brief sont réconciliées avec les catalogues versionnés d’Explorer. Les noms pointés du document sont des titres lisibles ; les identifiants techniques conservent les conventions observer_, scene_ et navigation_. Les nouveaux noms ci-dessous sont des candidats, pas des exécutants disponibles.')
table(['Propriétaire et behavior','Première livraison','Cible différée ou recherche'],[
('@spacexr/celestial-core-mcp / SpatialContextBehavior','Calculer contexte, directions et lieux à partir d’un état explicite fourni par l’hôte.','Directions et catalogues étendus selon les données disponibles ; aucun accès direct à une caméra moteur.'),
('@spacexr/dem-mcp / DemBehavior','Réutiliser l’échantillonnage et sa provenance prévus au lot terrain N3.','Profiler des zones ou enrichir la visibilité avec des données qualifiées.'),
('Explorer / ObserverBehavior','Enrichir observer_getContext ; raccorder directions et lieux proches par outils ou ressources dédiés si utiles.','Pose estimée, hypothèses et incertitude uniquement avec le lot de recherche.'),
('Explorer / SceneBehavior','Mode Explore/Orient et balises via scene_setOrientationMode et scene_showDirectionalGuides candidats.','Survey et scene_setGraticule : off, geographic, localMetric. Capacités annoncées au moment de leur livraison.'),
('Explorer / NavigationBehavior','Réconcilier vue régionale et retour avec scene_saveView et navigation_returnToPrevious.','Modes régionaux avancés. Une nouvelle commande restoreView n’est créée que si les contrats existants ne suffisent pas.'),
('Mission Control / behavior de mission','Consommer les observations et opérations disponibles. Aucun nouvel exécuteur mission imposé à Explorer.','Évaluer les objectifs et conserver les preuves après réalisation du runtime de mission.'),
],[1.8,2.3,2.1])
h('Composition et fidélité des résultats')
p('Les behaviors de bibliothèque restent dans leurs packages compagnons. Les behaviors de session restent composés dans Explorer ; un éventuel @spacexr/explorer-mcp peut être extrait lorsque la frontière est stable. Les ports publics autorisent plusieurs moteurs sans multiplier le runtime 3D Tiles. Chaque outil est enregistré une seule fois, avec un propriétaire et des noms sans collision.')
p('Les schémas d’entrée/sortie sont versionnés. Les grammaires default:fr et default:en décrivent les mêmes capacités ; la priorité behavior, adaptateur, statique puis store demeure celle de mcp-core. Les outils Planned/None sont masqués. Une commande acceptée attend sa fin d’opération et une nouvelle observation avant d’être déclarée réussie.')
p('Le bookmark conserve pose, cible, champ de vision, projection et navigation. L’hôte choisit entre restaurer l’époque et conserver l’époque courante avec pose attachée au corps. Une reprise manuelle invalide les propositions anciennes ; les tests vérifient la parité manuel/MCP.')

page('Livraisons et calendrier du contexte spatial')
p('Estimation de cadrage pour un développeur expérimenté à temps plein, réutilisant la scène Babylon, les conversions et le provider MCP existants. La première livraison vise un écran desktop, un petit catalogue de lieux et des données terrain existantes ; elle peut déclarer une occlusion inconnue. Elle exclut mini-globe complet, Survey, nouveau runtime Mission Control, moteur Three complet et localisation visuelle. Les hypothèses sont confirmées en S0.')
table(['Lot','Résultat et condition de sortie','Charge indicative'],[
('S0 / Nécessaire','Consolider contrats, conventions, révisions et catalogue minimal. Relever les fonctions et ports manquants ; fixer les tolérances et cas polaires.','2 à 3 j'),
('S1 / Nécessaire','Contexte et directions dans Celestial ; raccordement de la pose Explorer ; tests numériques et états de qualité.','3 à 5 j'),
('S2 / Nécessaire','Explore/Orient minimal, cap et balises sans collision. Cas polaires, hors champ et données absentes.','3 à 5 j'),
('S3 / Nécessaire','Actions manuelles/MCP, vue régionale et bookmark restaurable ; grammaires et opérations annulables.','3 à 5 j'),
('S4 / Nécessaire','Régressions des repères, révisions et données absentes ; qualification d’intégration et premier essai UX documenté.','3 à 5 j'),
],[1.05,4.05,1.1])
h('Charges et dépendances')
p('S0 à S4 représentent 14 à 23 jours, ou 18 à 29 jours avec une réserve de 25 %, soit environ 4 à 6 semaines à disponibilité complète. Un manque de calcul géodésique, une restauration de caméra incompatible ou un port de visibilité insuffisant déclenche un chiffrage conditionnel après S0, sans garantir son absorption par la réserve.')
p('S0/S1 peuvent être préparés sans attendre les extensions morphologiques. Le raccord terrain réutilise le contrat de source et de qualité du socle DEM. Les diagnostics, grammaires, notifications et observations partagés entre N3 et S3 sont réalisés une fois ; le planning détaillé déduit leur mutualisation après inventaire. La cible complète de visibilité et de graticule dépend des ports terrain qualifiés.')
h('Cible UX différée')
p('Prévoir un lot U1 de mini-globe, calotte et vue carte polaire, estimé à 8 à 15 jours, puis un lot U2 de Survey, graticule géographique drapé et qualification de visibilité, estimé à 10 à 20 jours. Ces charges sont hors réserve et à revalider après S4. La grille métrique locale est optionnelle, estimée à 4 à 8 jours selon les primitives disponibles. Une qualification VR/TV fait l’objet d’un lot séparé. Les critères du brief complet ne sont revendiqués qu’après les lots correspondants.')
h('Enveloppe commune avec le chantier terrain')
p('Les seuls socles DEM N0 à N4 et orientation S0 à S4 totalisent, avant mutualisation, 27 à 45 jours de réalisation, soit 34 à 57 jours avec 25 % de réserve : environ 7 à 12 semaines séquentielles. Si C1 terrain est nécessaire, l’enveloppe brute passe à 38 à 65 jours avec réserve, soit environ 8 à 13 semaines. Ces chiffres remplacent l’addition de calendriers déjà margés. Ils excluent la migration globale, U1/U2, les falaises, le runtime de mission et la recherche ; un seul développeur n’exécute pas ces lots en parallèle.')

page('Terrain Awareness en recherche optionnelle')
p('L’annexe propose de reconnaître une position sur un terrain connu à partir d’images, de signatures perceptuelles et du mouvement temporel. Sa faisabilité et sa robustesse restent à démontrer. Ce lot ne conditionne ni l’orientation géographique, ni le raffinement DEM, ni la migration multi-moteur. Aucun nouveau dépôt structurant n’est requis à ce stade.')
h('Répartition de l’expérimentation')
p('Conserver un laboratoire isolé dans Explorer pour rejouer des trajets et observations. Le rendu fournit les images et la vérité terrain par des ports de capture ; la partie perception utilise des contrats d’observation sans import Babylon ou Three. Le service de données peut produire et distribuer un index perceptuel versionné. Celestial et geodesy restent propriétaires des conversions et de la signification des poses, pas de l’encodeur appris.')
p('La carte de signatures est indexée par positions, orientations et conditions explicites. Elle conserve modèle d’encodeur, version, corps, repère, origine des images et données terrain. La densité spatiale, le nombre d’azimuts, les dimensions latentes et la stratégie d’accès sont mesurés avant de choisir un format. L’index ne remplace ni les disponibilités des tuiles ni la hiérarchie 3D Tiles.')
h('Expériences bornées et décision de poursuite')
table(['Expérience optionnelle','Résultat attendu et arrêt possible','Enveloppe initiale'],[
('R0 / Faisabilité','Petite zone connue, rendus reproductibles et poses de référence ; estimer stockage et coût des observations. Arrêt si données ou référentiels incohérents.','3 à 5 j'),
('R1 / Reconnaissance','Encodeur existant et recherche de candidats ; comparer à une référence simple. Séparer trajets et conditions de validation des références utilisées.','10 à 20 j de preuve'),
('R2 / Suivi temporel','Comparer reconnaissance seule et prédiction/correction ; ambiguïtés, perte de suivi et relocalisation. Dépend des résultats de R1.','10 à 25 j de preuve'),
('R3 / Généralisation','Loop closure robuste, fusion odométrie/IMU, changement de domaine et essais réels. Contrat et budget après preuve R2.','Non engagé ; à chiffrer'),
],[1.2,3.9,1.1])
h('Qualité et behaviors futurs')
p('Mesurer erreur de position/orientation, dérive, taux et délai de relocalisation, fausses reconnaissances, coût mémoire et inférence. Tester reliefs répétitifs, changements d’azimut, altitude et lumière. Conserver plusieurs hypothèses lorsque nécessaire ; un score d’embedding ne devient une incertitude métrique qu’après calibration et validation. Les essais synthétiques ne prouvent pas le transfert au réel.')
p('Un futur LocalizationBehavior, regroupé dans le compagnon d’Explorer au stade expérimental, peut exposer état de suivi, hypothèses et provenance. Ses commandes restent masquées avant exécution réelle. L’interface et observer_getContext indiquent clairement simulation connue, localisation estimée ou pose indisponible. La localisation ne déplace pas automatiquement la caméra de référence et ne remplace pas silencieusement une pose connue.')
p('Références : celestial-core/docs/spatial-awareness/architecture.md et acceptance.md ; spacexr-explorer/docs/spatial-awareness.md ; spacexr-mission-control/docs/capabilities/spatial-awareness.md. Ces documents et la pièce fournie cadrent des capacités à développer.')

xml=etree.tostring(d._element,xml_declaration=True,encoding='UTF-8',standalone=True)
assert '\u2014' not in xml.decode('utf-8')
with ZipFile(SOURCE) as src,ZipFile(OUT,'w') as dst:
    for item in src.infolist():dst.writestr(item,xml if item.filename=='word/document.xml' else src.read(item.filename))
check=Document(OUT)
for para in check.paragraphs:
    if para.text and para.style.name in ('Normal','List Bullet','List Number') and not para.text.startswith('Brief de cadrage |'):
        assert para.alignment==WD_ALIGN_PARAGRAPH.JUSTIFY,para.text[:80]
assert len(check.tables)==len(Document(SOURCE).tables)+4
print(str(OUT));print('paragraphs',len(check.paragraphs),'tables',len(check.tables))
