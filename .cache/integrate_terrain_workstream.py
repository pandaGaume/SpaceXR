from pathlib import Path
from zipfile import ZipFile
from copy import deepcopy
from lxml import etree
from docx import Document
from docx.shared import Pt, Twips, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/Brief_migration_architecture_multi_moteur_MCP.docx'
OUT = ROOT / 'docs/Brief_migration_architecture_multi_moteur_MCP_terrain.docx'
d = Document(SOURCE)

def replace(p, text):
    fmt = deepcopy(p.runs[0]._r.rPr) if p.runs and p.runs[0]._r.rPr is not None else None
    p.text = text
    if fmt is not None: p.runs[0]._r.insert(0, fmt)

for para in d.paragraphs:
    if para.text.startswith('Brief de cadrage |'):
        replace(para, 'Brief de cadrage | Architecture multi-moteur, composants MCP et chantier terrain | Révision du 10 novembre 2026')
    elif para.text.startswith('Le brief couvre les frontières'):
        replace(para, 'Le brief couvre les dépôts, packages, dépendances, composants MCP et l’ordre de migration. Le chantier de raffinement morphologique et de surfaces paramétriques est détaillé en fin de document, avec socle nécessaire, extensions optionnelles et estimations conditionnelles. Le cadrage précède toute implémentation ; les noms et outils nouveaux restent des propositions.')
    elif para.text.startswith('Chaque composant fonctionnel possède un behavior et une grammaire documentés'):
        replace(para, 'Chaque composant fonctionnel livré avec une surface MCP possède un behavior et une grammaire documentés ; seuls les outils implémentés sont annoncés. Les companions et outils des extensions optionnelles suivent leur propre lot et ne bloquent pas le socle. Les packages internes sans surface autonome restent regroupés.')
    elif para.text.startswith('Même sélection du runtime et mêmes résultats DEM avec Babylon et Three'):
        replace(para, 'Même sélection du runtime et mêmes résultats métier pour des entrées équivalentes, avec des tolérances définies. La comparaison Babylon/Three entre dans le lot multi-moteur dès que le second adaptateur est disponible ; sa réalisation complète ne bloque pas le socle de raffinement DEM sur Babylon existant.')

def h(text, level=2):
    p=d.add_heading(text,level)
    for r in p.runs: r.font.color.rgb=RGBColor(0,0,0)
    return p

def p(text, bullet=False):
    x=d.add_paragraph(text,style='List Bullet' if bullet else 'Normal')
    x.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
    x.paragraph_format.space_after=Pt(6)
    return x

def page(title):
    x=h(title,1);x.paragraph_format.page_break_before=True

def table(headers,rows,ratios):
    avail=d.sections[0].page_width.twips-d.sections[0].left_margin.twips-d.sections[0].right_margin.twips
    widths=[round(x/sum(ratios)*avail) for x in ratios];widths[-1]+=avail-sum(widths)
    t=d.add_table(rows=1,cols=len(headers));t.autofit=False
    for col,w in zip(t._tbl.tblGrid.gridCol_lst,widths):col.w=Twips(w)
    for c,txt in zip(t.rows[0].cells,headers):c.text=txt
    for values in rows:
        for c,txt in zip(t.add_row().cells,values):c.text=txt
    for i,row in enumerate(t.rows):
        rp=row._tr.get_or_add_trPr();rp.append(OxmlElement('w:cantSplit'))
        if i==0:rp.append(OxmlElement('w:tblHeader'))
        for c,w in zip(row.cells,widths):
            c.width=Twips(w);cp=c._tc.get_or_add_tcPr()
            sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E8EDF2' if i==0 else ('F7F8FA' if i%2==0 else 'FFFFFF'));cp.append(sh)
            borders=OxmlElement('w:tcBorders')
            for side in ['top','left','bottom','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
            cp.append(borders)
            margins=OxmlElement('w:tcMar')
            for side in ['top','left','bottom','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:w'),'90');e.set(qn('w:type'),'dxa');margins.append(e)
            cp.append(margins)
            for para in c.paragraphs:
                para.alignment=WD_ALIGN_PARAGRAPH.LEFT
                para.paragraph_format.space_before=Pt(0);para.paragraph_format.space_after=Pt(3)
                for r in para.runs:r.font.size=Pt(10);r.bold=i==0
    tw=t._tbl.tblPr.find(qn('w:tblW'));tw.set(qn('w:type'),'dxa');tw.set(qn('w:w'),str(avail))
    return t

page('Raffinement morphologique et surfaces paramétriques')
p('Ce chantier applique l’architecture commune à deux besoins : conserver une restitution stable du DEM lorsque la subdivision dépasse sa résolution native, puis représenter des falaises par des grilles orientées. Le socle DEM est nécessaire au terrain cible. Les cartes de crêtes, grilles de falaises et reconstructions avancées constituent des extensions à décider séparément. Aucun nouveau dépôt ni second moteur de sélection n’est créé.')
h('Socle nécessaire à la livraison terrain')
for text in [
 'Séparer spatialLOD, elevationLOD et densité de grille. Le runtime 3D Tiles décide de la subdivision spatiale ; la pyramide indique le niveau et la zone de données réellement disponibles. La fin de la source DEM ne doit pas être confondue avec la fin de la hiérarchie spatiale autorisée.',
 'Échantillonner directement le DEM natif ou son ancêtre de référence, avec transformation UV explicite. Les descendants n’interpolent pas des rasters déjà interpolés. Documenter l’orientation des faces, les unités, le datum, les zones absentes et les conventions de déplacement.',
 'Conserver une altitude stable aux mêmes coordonnées, dans une tolérance fixée avant les tests. Rendre cohérents le déplacement, les normales et les requêtes CPU de mesure ou de picking ; mesurer et documenter les approximations de la géométrie de picking.',
 'Vérifier les frontières de tuiles et de faces cube, les coins et les transitions LOD. Conserver des volumes et erreurs géométriques prudents, y compris lors du raffinement et du changement de source. Utiliser les ports, caches et politiques d’activation existants.',
 'Établir une référence bilinéaire, instrumenter le chemin réellement exécuté et comparer à un éventuel chemin bicubique à filtrage et densité contrôlés. Le document source évoque du cubique ; le code examiné comporte aussi du bilinéaire. Aucun correctif d’interpolateur n’est présumé avant diagnostic.',
]:p(text,True)
h('Extensions optionnelles après validation du socle')
p('Un bicubique contraint ou un mode edge-aware n’entre dans le lot que si la comparaison révèle un gain mesurable. Les cartes de crêtes multiscales et l’interpolation ridge-aware relèvent d’un lot morphologie distinct. Les falaises orientées suivent un prototype synthétique dédié, puis une qualification sur données mesurées. La découpe exacte, les supports courbes et la topologie adaptative sont des extensions ultérieures. L’annexe IA reste une hypothèse de recherche, hors engagement de livraison.')
h('Limites de la garantie')
p('Un LOD spatial plus fin ne crée aucune précision altimétrique nouvelle. L’invariance porte sur le champ de hauteur évalué aux mêmes coordonnées ; la silhouette d’un maillage fini peut évoluer avec ses sommets. Un DEM ne définit pas à lui seul une paroi masquée ou un surplomb. Un mode d’accentuation visuelle éventuel est explicite et séparé du mode fidèle aux données.')

page('Répartition du chantier terrain par dépôt')
table(['Dépôt et composant','Nécessaire au socle','Optionnel et différé'],[
('3d-tiles-core / tiles','Ancêtre source, sous-zone UV, voisinage et topologie Mercator/cube. Réutiliser les primitives existantes.','Primitives communes supplémentaires seulement si un prototype de patches en démontre le besoin.'),
('3d-tiles-core / runtime','Runtime unique : sélection, raffinement, disponibilité, cache, annulation et cycle de vie. Découpler disponibilité spatiale et disponibilité DEM.','Chargement et activation coordonnée des contenus de patch via les mêmes ports. Pas de gestionnaire LOD parallèle.'),
('terrain-core / raster','Échantillons natifs, bilinéaire de référence, halos, enregistrement point/aire et données absentes.','Interpolateurs contraints ou anisotropes et rasters auxiliaires si leur gain est mesuré.'),
('terrain-core / dem','Niveau source effectif, hauteur et dérivées cohérentes, provenance et résolution.','Description et calcul des caractéristiques de crête ; politique ridge-aware bornée.'),
('terrain-core / grid','Grille réutilisable existante ; diagnostic de densité et raccords entre niveaux.','Contrats de surfaces orientées, supports, frontières, masques et coutures ; topologie adaptative plus tard.'),
('spacexr-rendering','Référence CPU et kernels cohérents, déplacement et normales ; diagnostics dans Babylon WebGL/WebGPU existants.','Kernels de crêtes et patches, ressources auxiliaires ; portage Three qualifié dans le lot multi-moteur.'),
('spacexr-tile-service','Réutiliser les données et métadonnées actuelles. Aucun nouveau traitement serveur obligatoire pour le socle.','Production, versionnement et distribution des cartes de crêtes, patches, validité et qualité.'),
('geodesy_ts et celestial-core','Réutiliser ellipsoïdes, repères et conventions de hauteur existants.','Ajouter uniquement les transformations manquantes démontrées ; aucune logique de sélection ni shader.'),
('spacexr-explorer','Scène de référence et observation des instances réelles du runtime et du terrain.','Scènes de falaises, comparaisons morphologiques et intégration des nouveaux contenus.'),
],[1.45,2.35,2.4])
h('Contrats publics minimaux')
p('Formaliser la référence source d’altitude : adresse stable de la donnée, niveau effectif, sous-zone et orientation, enregistrement raster, résolution, unités et données absentes. Garder les identifiants éphémères du runtime distincts des identifiants persistants des données. N’ajouter les références de crêtes ou de patch qu’avec leur lot ; le contrat SurfacePatch du document source reste non normatif.')
p('Les behaviors et leurs bindings appartiennent aux packages compagnons du dépôt propriétaire. Le domaine conserve ses API sans dépendance MCP. La production de données et leur représentation GPU restent séparées.')

page('Phasage et estimation du socle terrain')
p('Estimation de cadrage, à confirmer après N0 : un développeur expérimenté à temps plein, dépôts et dépendances accessibles, runtime et scène Babylon de référence fonctionnels, jeux synthétiques disponibles. Les charges ci-dessous couvrent ce chantier terrain incrémental ; elles excluent la migration complète des dépôts, un adaptateur Three complet, les publications et les extensions optionnelles. Les accès aux données et délais de validation s’ajoutent au calendrier.')
table(['Lot','Résultat et condition de sortie','Charge indicative'],[
('N0 / Nécessaire','Figer source, caméra et géométrie ; relever interpolation, filtrage, UV et coûts. Définir les tolérances et reproduire les écarts éventuels.','2 à 3 j'),
('N1 / Nécessaire','Consolider les contrats spatialLOD/elevationLOD, l’accès direct à l’ancêtre et la cohérence CPU/GPU. Tests unitaires synthétiques et cas d’overzoom.','4 à 7 j'),
('N2 / Nécessaire','Intégrer et contrôler les transitions, normales, faces/coins cube, Mercator et bornes spatiales sur le runtime existant.','3 à 5 j'),
('N3 / Nécessaire','Exposer un diagnostic MCP minimal de source, sélection et capacités en lecture, avec grammaires FR/EN et API existantes.','2 à 3 j'),
('N4 / Nécessaire','Régressions WebGL/WebGPU sur Babylon, picking, budgets, documentation et validation des consommateurs touchés.','2 à 4 j'),
('C1 / Conditionnel','Corriger une cause supplémentaire révélée par N0/N2 : précision UV, filtrage, couture ou chemin de rééchantillonnage. Rechiffrer si le runtime est structurellement affecté.','3 à 7 j supplémentaires'),
],[1.05,4.05,1.1])
h('Lecture du calendrier')
p('Le socle représente 13 à 22 jours de réalisation. Avec une réserve de 25 %, prévoir 17 à 28 jours ouvrés, soit environ 4 à 6 semaines à disponibilité complète. Si C1 est nécessaire, l’enveloppe devient 20 à 37 jours avec la même réserve, soit environ 4 à 8 semaines. Ce sont des fourchettes de planification, pas des dates promises. N0 confirme les hypothèses ; N2 déclenche un nouvel arbitrage si les mesures sortent de l’enveloppe.')
p('Ordre recommandé : référence N0 avant déplacement des modules concernés ; extraction architecturale de ces modules ; N1 et N2 ; N3 et N4. Les travaux de migration sont chiffrés séparément et intercalés explicitement. Ne pas additionner implicitement ce calendrier au temps de migration ni supposer des semaines parallèles avec une seule personne.')
h('Jalon de livraison')
p('Le socle est livrable sans cartes de crêtes ni falaises : stabilité mesurée à source constante, absence de coutures au-delà des tolérances, bornes conservatrices, résultats CPU/GPU cohérents et coût compatible avec le budget relevé en N0. Les seuils de précision, mémoire et temps GPU sont fixés sur le matériel de référence avant qualification. Une régression bloque la livraison ; une amélioration esthétique optionnelle ne la bloque pas.')

page('Extensions terrain et décisions de poursuite')
p('Les lots suivants nécessitent une décision explicite de priorité et de budget après le socle. Chaque fourchette correspond à une expérimentation ou à un périmètre limité ; elle ne constitue pas un devis de généralisation. Ils ne sont pas cumulés dans les 4 à 8 semaines du socle.')
table(['Lot optionnel','Périmètre et décision de sortie','Charge indicative'],[
('O1 / Interpolation','Comparer bicubique contraint et/ou edge-aware à la référence. Conserver seulement si le gain dépasse le bruit de mesure et respecte les bornes.','4 à 8 j'),
('O2 / Morphologie','Cartes de crêtes, halos et confiance ; premier kernel ridge-aware, mesures de déplacement et coût. Poursuivre si le gain est objectivé face à une référence indépendante.','10 à 20 j de prototype'),
('O3 / Falaise synthétique','Paroi plane de 100 m, grille orientée, déplacement natif, masque simple et raccords haut/bas pendant les transitions. Décision après démonstration sans trous ni doublons.','10 à 20 j de prototype'),
('O4 / Paroi mesurée','Petit jeu LiDAR couvrant réellement la paroi, conversion et validation sur points indépendants. Dépend de O3 et de la disponibilité de données adaptées.','10 à 20 j, hors acquisition'),
('O5 / Raccords avancés','Découpe exacte, supports courbes et cas entre plusieurs patches. Étude séparée après O3/O4 ; complexité géométrique encore incertaine.','10 à 25 j pour un cas limité'),
('O6 / Recherche','Topologie adaptative, généralisation multi-planétaire des patches et génération IA. Études conditionnées aux résultats précédents.','Non engagé ; à chiffrer après preuve'),
],[1.15,3.95,1.1])
h('Contraintes des surfaces orientées')
p('Les patches sont des contenus supplémentaires sélectionnés par le runtime unique. Le contrat terrain porte repère, surface support, déplacement, frontières, emprise, validité et provenance. Son encodage et son raccordement aux contenus 3D Tiles doivent être spécifiés ; ils ne sont pas déclarés standards par ce brief. Le chargement ne dépend pas du rechargement du DEM de chaque descendant.')
p('L’adaptateur prépare le patch et son masque avant d’ouvrir le terrain ; leur activation est coordonnée via les ports du runtime. En cas de données manquantes ou d’échec, une surface de remplacement reste affichable. Les frontières imposent la continuité de position C0 ; une rupture de normales est conservée aux arêtes vives. Les raccords robustes entre LOD et contenus sont qualifiés avant toute généralisation.')
h('Données et incertitude')
p('La chaîne serveur des crêtes ou des patches n’est ajoutée qu’avec O2 ou O4. Les essais utilisent d’abord des données synthétiques reproductibles. Les surfaces mesurées, reconstruites et synthétiques sont distinguées. L’imagerie monoculaire ou un DEM seul ne prouvent pas la géométrie d’un surplomb ; l’annexe IA reste exploratoire et ne conditionne aucun jalon nécessaire.')

page('Behaviors MCP du chantier terrain')
p('Le socle ajoute une surface de diagnostic limitée et en lecture. Les commandes de modification et les outils propres aux extensions arrivent avec leurs capacités réelles. Les noms ci-dessous sont des candidats à aligner sur les noms publics d’Explorer, sans doublons. Aucun serveur ni runtime supplémentaire n’est créé.')
table(['Compagnon et behavior','Socle nécessaire','Extension optionnelle'],[
('@spacexr/tiles-mcp / TilePyramidBehavior','tiles_getSourceRegion : adresse demandée, ancêtre effectif, UV et orientation.','Diagnostics détaillés de voisinage et de données morphologiques.'),
('@spacexr/dem-mcp / DemBehavior','dem_getSamplingState et dem_sampleElevation : mode effectif, hauteur, source, résolution et validité. Réutiliser un outil équivalent existant.','Comparaison d’interpolateurs, inspection des crêtes et choix du mode si la session autorise cette mutation.'),
('@spacexr/3d-tiles-runtime-mcp / RuntimeBehavior','runtime_getState : sélection réelle et références des contenus. La disponibilité spatiale est distincte du niveau DEM servi.','États de préparation et activation coordonnée des patches.'),
('@spacexr/grid-mcp / GridBehavior','Ressource décrivant la densité et la topologie existantes ; ne pas créer un outil uniquement pour compléter le catalogue.','grid_inspectPatch et grid_validateBoundaries après O3 ; paramètres de découpe après qualification.'),
('Compagnon de rendu / RenderingBehavior','render_getCapabilities et ressource de diagnostics bornée : backend, interpolateur et métriques disponibles.','Affichages UV/normales et modes A/B ; diagnostic des kernels et textures de crêtes ou de patches.'),
('Service de tuiles / behavior de production','Aucune nouvelle API de production requise pour N0 à N4.','Construction et suivi des artefacts en O2/O4, via un compagnon dédié si une API métier existe.'),
],[1.8,2.3,2.1])
h('Contrats et contrôles')
p('Les schémas fixent unités, corps, repère, source et niveau effectif ; les réponses indiquent les données absentes et les tolérances applicables. Les grammaires default:fr et default:en décrivent les mêmes capacités sans en modifier le sens. Full ou Partial reflètent le support réel ; Planned et None restent masqués. Les diagnostics ne transportent ni handles GPU ni rasters complets.')
p('Les bindings utilisent les instances existantes et les mêmes API que l’application. Les tests Loopback vérifient routage, résultats, grammaires, erreurs et abonnements. Les notifications sont bornées en fréquence. Les mutations optionnelles passent par les droits et révisions de session ; les traitements longs utilisent les opérations applicatives existantes et leur annulation effective.')
p('Référence documentaire : Ridge_Preserving_Terrain_Refinement_Foundation_v4.docx, sections 1 à 11 et annexe A. Ce brief reprend les besoins et les répartit par lot ; les décisions et priorités décrites dans la pièce source ne déclenchent aucune implémentation automatique. Le socle décrit ici est la cible nécessaire ; les extensions restent soumises aux jalons de poursuite.')

xml=etree.tostring(d._element,xml_declaration=True,encoding='UTF-8',standalone=True)
assert '\u2014' not in xml.decode('utf-8')
with ZipFile(SOURCE) as src, ZipFile(OUT,'w') as dst:
    for item in src.infolist():dst.writestr(item,xml if item.filename=='word/document.xml' else src.read(item.filename))
check=Document(OUT)
for para in check.paragraphs:
    if para.text and para.style.name in ('Normal','List Bullet','List Number') and not para.text.startswith('Brief de cadrage |'):
        assert para.alignment==WD_ALIGN_PARAGRAPH.JUSTIFY, para.text[:80]
print(str(OUT))
print('Paragraphs:',len(check.paragraphs),'Tables:',len(check.tables))
