from pathlib import Path
from copy import deepcopy
import json
import zipfile
from lxml import etree
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'C:\Users\GuillaumePelletier\Downloads\Brief_migration_architecture_multi_moteur.docx')
OUT = ROOT / 'docs' / 'Brief_migration_architecture_multi_moteur_MCP.docx'
d = Document(SOURCE)

def replace(p, text):
    first = deepcopy(p.runs[0]._r.rPr) if p.runs and p.runs[0]._r.rPr is not None else None
    p.text = text
    if first is not None:
        p.runs[0]._r.insert(0, first)

replacements = {
 1: 'Brief de cadrage | Dépôts Git, packages NPM, runtime unique et composants MCP | Révision du 10 novembre 2026',
 5: 'La migration rend les algorithmes de tuilage, de terrain et de rendu réutilisables dans plusieurs moteurs. Un seul runtime 3D Tiles assure la sélection, le raffinement, le streaming et le cycle de vie des contenus. Les pyramides DEM et imagerie Mercator ou cube sont exposées comme des Tilesets implicites. Les adaptateurs Babylon.js, Three.js ou autres traduisent les ports communs en objets et ressources propres au moteur.',
 6: 'Le brief couvre les frontières de dépôts, les packages, les dépendances, les composants MCP optionnels et l’ordre de migration. Il constitue une proposition à valider avant implémentation. Les corrections terrain et runtime reprennent les décisions de cadrage ; les noms et outils MCP ci-après sont des propositions de conception.',
 11: 'Conserver les identités NPM existantes, notamment @spacexr/geodesy, @spacexr/3d-tiles-core, @spacexr/3d-tiles-runtime, @spacexr/tiles, @spacexr/raster, @spacexr/dem, @spacexr/grid et @spacexr/3d-tiles-babylon. Les nouveaux noms restent des candidats jusqu’à la vérification des publications. Chaque composant peut être accompagné d’un package optionnel portant le suffixe -mcp.',
 16: '3d-tiles-core conserve le modèle, les codecs et le runtime unique, ainsi que @spacexr/tiles : adresses, pyramides génériques, voisinage et topologies Mercator/cube. terrain-core reçoit @spacexr/raster, @spacexr/dem et @spacexr/grid, les providers et les sources terrain compatibles avec les Tilesets implicites. ImplicitTilesetDecorator reste une passerelle du runtime commun. La représentation implicite peut être virtuelle, sans génération préalable de fichiers tileset et subtree. Les raccords entre faces du cube et les niveaux de détail utilisent la même traversée et les mêmes politiques de sélection. Aucun sélecteur terrain parallèle n’est créé.',
 26: 'Extraire terrain-core. Déplacer raster, DEM, grid, providers et métadonnées terrain, en conservant les identités NPM. Maintenir @spacexr/tiles et le runtime commun dans 3d-tiles-core ; préserver les passerelles existantes des pyramides vers les Tilesets implicites.',
 29: 'Migrer d’abord l’adaptateur Babylon.js existant et éprouver rapidement les mêmes contrats avec un chemin Three.js minimal. Terrain et contenus 3D passent par le même runtime. L’atmosphère suit les conventions spatiales communes et son propre cycle graphique.',
 34: 'Les pyramides DEM et imagerie Mercator et cube sont compatibles avec les Tilesets implicites et sélectionnées par le runtime 3D Tiles unique, sans obligation de générer préalablement leurs documents sur disque.',
 35: 'Terrain et contenus 3D coexistent dans une scène avec la même implémentation du runtime ; plusieurs instances peuvent gérer des couches ou des corps distincts. Aucun runtime ni sélecteur terrain concurrent n’est introduit.',
}
for i, text in replacements.items(): replace(d.paragraphs[i], text)

# Reconcile the original matrices with the agreed runtime architecture.
for t in d.tables:
    for row in t.rows:
        if row.cells[0].text.strip() == 'tiles3d-core':
            row.cells[0].text = '3d-tiles-core'
            if len(row.cells) == 3 and 'Peut dépendre' not in t.rows[0].cells[1].text:
                row.cells[1].text = 'Modèle 3D Tiles, runtime unique, disponibilités et streaming ; primitives de tuilage génériques dans @spacexr/tiles.'
            elif len(row.cells) == 3:
                row.cells[1].text = 'geodesy-ts et primitives @spacexr/tiles hébergées dans ce dépôt'
                row.cells[2].text = 'Babylon.js, Three.js, packages DEM/raster/grid de terrain-core'
            else:
                row.cells[1].text = '@spacexr/3d-tiles-core ; @spacexr/3d-tiles-runtime ; @spacexr/tiles'
        elif row.cells[0].text.strip() == 'terrain-core':
            if len(row.cells) == 3 and 'Peut dépendre' not in t.rows[0].cells[1].text:
                row.cells[1].text = 'Rasters, DEM, grilles CPU et sources terrain compatibles avec les Tilesets implicites du runtime commun.'
                row.cells[2].text = 'Dépôt local initialisé, sans implémentation. Pas de ressources ni objets moteur.'
            elif len(row.cells) == 3:
                row.cells[1].text = 'geodesy-ts, celestial-core selon besoin, @spacexr/tiles et contrats 3D Tiles/runtime'
                row.cells[2].text = 'Moteurs graphiques, shaders et sélection concurrente du runtime'
            else:
                row.cells[1].text = '@spacexr/raster ; @spacexr/dem ; @spacexr/grid ; autres surfaces seulement si nécessaires'
        elif row.cells[0].text.strip() == 'Confusion entre terrain et 3D Tiles':
            row.cells[1].text = 'Conserver les données spécialisées du terrain et les exposer au runtime unique par une représentation en Tileset implicite.'

def h(text, level=2):
    p=d.add_heading(text, level=level)
    for r in p.runs: r.font.color.rgb=RGBColor(0,0,0)
    return p

def p(text, bullet=False):
    x=d.add_paragraph(text, style='List Bullet' if bullet else 'Normal')
    x.paragraph_format.space_after=Pt(6)
    return x

def page(title):
    x=h(title,1)
    x.paragraph_format.page_break_before=True

def table(headers, rows, widths):
    t=d.add_table(rows=1, cols=len(headers))
    t.autofit=False
    for c,txt,w in zip(t.rows[0].cells,headers,widths):c.text=txt;c.width=Inches(w)
    for values in rows:
        for c,txt,w in zip(t.add_row().cells,values,widths):c.text=txt;c.width=Inches(w)
    for i,row in enumerate(t.rows):
        pr=row._tr.get_or_add_trPr()
        if i==0: pr.append(OxmlElement('w:tblHeader'))
        pr.append(OxmlElement('w:cantSplit'))
        for c in row.cells:
            cp=c._tc.get_or_add_tcPr()
            sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E8EDF2' if i==0 else ('F7F8FA' if i%2==0 else 'FFFFFF'));cp.append(sh)
            borders=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
            cp.append(borders)
            margins=OxmlElement('w:tcMar')
            for side in ['top','left','bottom','right']:
                e=OxmlElement('w:'+side);e.set(qn('w:w'),'90');e.set(qn('w:type'),'dxa');margins.append(e)
            cp.append(margins)
            for para in c.paragraphs:
                para.paragraph_format.space_after=Pt(3)
                para.paragraph_format.space_before=Pt(0)
                for r in para.runs:r.font.size=Pt(10);r.bold=(i==0)
    return t

page('Composants MCP et behaviors')
p('Chaque composant fonctionnel fournit une surface MCP optionnelle, distribuable sous la forme @spacexr/<package>-mcp. Cette surface s’appuie sur @cyanmycelium/mcp-core et expose les capacités réelles du composant à un agent. Le suffixe -mcp désigne un package compagnon ; le caractère @ reste réservé au scope NPM ou au séparateur de version dans une commande d’installation.')
h('Séparation des responsabilités')
p('Le package métier conserve ses API TypeScript et ses ports, sans dépendance MCP. Son package compagnon déclare les behaviors, schémas JSON, ressources, templates et grammaires. Un adaptateur MCP relie ces contrats à une instance existante du composant. Il appelle les mêmes API que l’application et ne réimplémente aucun calcul, chargement ou moteur de sélection.')
p('Un behavior décrit les capacités d’une catégorie de composant. Les instances sont identifiées par des URI et des identifiants explicites. Introduire un behavior par composant fonctionnel pertinent, pas par classe, fichier ou objet de scène. Plusieurs behaviors peuvent être livrés dans un même package compagnon.')
p('Le terme adaptateur MCP désigne le binding entre outils et API métier. Il est distinct de l’adaptateur de rendu Babylon ou Three. Les behaviors génériques ne manipulent aucun Scene, Mesh, Object3D, GPUDevice ou handle graphique sérialisé.')
h('Dépendances et composition')
p('Dépendances autorisées : package compagnon MCP vers package métier, ports publics et mcp-core. Le package métier n’importe jamais son compagnon. Les intégrations MCP Babylon et Three peuvent importer leur moteur ; les behaviors communs dépendent uniquement des ports de rendu indépendants du moteur.')
p('Explorer ou une application hôte enregistre les behaviors autour de ses instances vivantes. Les packages compagnons ne démarrent ni serveur, ni transport, ni connexion par effet de bord. Le transport et la composition du serveur restent au niveau de l’hôte ; un serveur MCP est créé par session selon le modèle de mcp-core.')
p('Le runtime 3D Tiles reste unique. Un RuntimeBehavior inspecte ou configure ce runtime ; TerrainBehavior et les behaviors de pyramide exposent leurs données et paramètres en utilisant ses ports. Aucune commande MCP ne crée un sélecteur terrain concurrent.')

page('Packages MCP par composant')
p('Noms candidats conservant le nom du package métier et ajoutant -mcp. Une ligne définit une responsabilité cible ; la publication intervient lorsque son API est utile et réellement implémentée. Les behaviors de composants internes peuvent d’abord rester regroupés.')
table(['Dépôt cible','Package compagnon candidat','Behavior et surface indicative'],[
('celestial-core','@spacexr/celestial-core-mcp','CelestialBehavior : catalogue, corps, repères, rotations et éphémérides. AtmosphereModelBehavior selon l’arbitrage du modèle physique.'),
('geodesy_ts','@spacexr/geodesy-mcp','GeodesyBehavior : conversions, projections, ellipsoïdes et repères avec unités explicites.'),
('3d-tiles-core','@spacexr/3d-tiles-core-mcp','TilesetBehavior : inspection et validation des documents et structures implicites.'),
('3d-tiles-core','@spacexr/tiles-mcp','TilePyramidBehavior : adressage, faces, voisins, niveaux et disponibilité des sources.'),
('3d-tiles-core','@spacexr/3d-tiles-runtime-mcp','RuntimeBehavior : état, sélection, budgets, chargements et diagnostics du runtime vivant.'),
('terrain-core','@spacexr/raster-mcp','RasterBehavior : métadonnées, échantillonnage, résolution et références de données.'),
('terrain-core','@spacexr/dem-mcp','DemBehavior : altitude, profil, pente et provenance, selon les fonctions disponibles.'),
('terrain-core','@spacexr/grid-mcp','GridBehavior : topologie, jonctions, niveaux et diagnostics géométriques.'),
('spacexr-rendering','@spacexr/3d-tiles-babylon-mcp','Binding Babylon des behaviors de rendu communs, diagnostics et capacités effectives.'),
('spacexr-rendering','@spacexr/three-tiles3d-mcp','Binding Three des mêmes contrats de rendu ; nom aligné sur le package métier final.'),
], [1.13,2.32,2.85])
p('Les autres composants de rendu suivent la même convention, par exemple @spacexr/babylon-terrain-mcp ou @spacexr/babylon-atmosphere-mcp si les packages métier correspondants sont effectivement créés. Les contrats, algorithmes et kernels internes sont décrits par les ressources de capacité et diagnostic ; un compagnon autonome n’est publié que s’il apporte un usage propre.')
p('Les compagnons restent dans le dépôt du composant concerné, en workspace. Aucun dépôt MCP par package n’est nécessaire. Quantia reste hors des cinq dépôts structurants ; un éventuel quantia-mcp demeure optionnel et hors du premier lot.')

page('Grammaires et contrats MCP')
p('Référence technique locale : @cyanmycelium/mcp-core 1.4.1. La grammaire est une couche de descriptions et de formulations ; les schémas JSON définissent les arguments et résultats. Elle ne constitue ni un parseur de langage naturel, ni un moteur d’exécution, ni une politique d’autorisation.')
h('Structure des behaviors')
p('Les behaviors étendent McpBehavior et définissent _buildTools(), _buildResources(), _buildTemplate() et _buildGrammars() selon leur surface. Les bindings étendent McpAdapterBase ou implémentent IMcpBehaviorAdapter. L’exécution passe par executeToolAsync et la lecture par readResourceAsync. Les entrées Node restent dans l’hôte ou un point d’entrée /node ; aucun import /node dans les bundles navigateur.')
p('Chaque behavior embarque les profils default:en et default:fr. Les variantes par client restent facultatives. Les fichiers utilisent la forme structurée McpGrammarData : server, tools, resources, templates et phrases. Les noms d’outils et les identifiants restent stables ; title, description et descriptions de propriétés sont localisables.')
h('Résolution et validation')
p('Ordre de priorité croissante : behavior, adaptateur, configuration statique de l’hôte, store de grammaires. La résolution de locale et de client utilise la politique de mcp-core ; les règles de repli sont testées. Une modification de grammaire ne change ni les types, ni les unités, ni le sens d’un outil.')
p('Les grammaires sont validées avec McpGrammar.check. La règle withWordingRule("default:en") impose un seul emplacement pour chaque description : schéma inline ou grammaire. Le choix retenu ici est la grammaire pour les descriptions. Les phrases traduites conservent leurs clés et paramètres de substitution. Le chargement depuis le disque via loadGrammarDirectory est réservé au point d’entrée Node ; les behaviors navigateur embarquent leurs données.')
h('Identités et résultats')
p('Préfixer les noms pour éviter les collisions : tileset_validate, tiles_address, runtime_getState, dem_sampleElevation et render_getCapabilities sont des exemples de conventions, non un catalogue déjà implémenté. Les URI de composants peuvent suivre spacexr://components/{componentId}/instances/{instanceId}. Les objets d’une scène sont résolus dans la session cible, avec sessionId et instanceId explicites si nécessaire.')
p('Les résultats déclarent un outputSchema lorsque pertinent et renvoient structuredContent avec une représentation textuelle compatible. Les erreurs opérationnelles sont explicites. Un échantillon terrain indique corps, repère, unités, datum vertical, résolution, source et absence éventuelle de données. Les identifiants de tuiles du runtime restent éphémères ; ils ne servent pas d’identité métier durable.')
p('Les ressources exposent configuration, capacités, états et diagnostics bornés. Les rasters, géométries et captures volumineux sont référencés par URI ou artefact. Les handles moteur et GPU restent privés à leurs adaptateurs.')

page('Intégration MCP et critères de sortie')
h('Capacités et cycle de vie')
p('getToolSupport annonce Full ou Partial lorsque l’exécution existe, avec les limites documentées. Planned et None restent masqués. Un profil de grammaire ne peut rendre une opération disponible. Le contrôle d’accès de la session reste distinct de ce mécanisme de capacité.')
p('Les changements passent par _forwardResourceContentChanged(uri) et _forwardResourceChanged() ; mcp-core gère les notifications et abonnements de session. Les états modifiés sont invalidés avant relecture. La télémétrie de rendu est regroupée ou limitée en fréquence, sans notification à chaque frame. Les adaptateurs libèrent leurs abonnements en fin de vie.')
p('Les ressources dépendant du demandeur ne sont pas placées dans le cache partagé de la ressource racine du behavior. Les métadonnées de IMcpRequestContext restent des entrées non fiables ; l’hôte les valide et applique ses autorisations avant toute mutation. Les accès directs et MCP partagent le même mécanisme de modification et de révision de l’état.')
p('Les actions longues utilisent les opérations applicatives existantes : identifiant, progression, état terminal et annulation propagée aux API qui la supportent. accepted ne signifie pas completed. Le mcp-core local déclare tasks/* non pris en charge ; ne pas présenter ces opérations comme des tâches protocolaires MCP ni supposer une propagation AbortSignal fournie par executeToolAsync.')
h('Composition avec Explorer')
p('Explorer possède déjà ExplorerBehavior, ExplorerAdapter, des grammaires FR/EN et des outils par domaine. Conserver ses noms et URI publics ; déléguer progressivement les opérations aux companions. Chaque opération a un propriétaire unique. Le même outil n’est pas enregistré deux fois par Explorer et un composant. Le broker reste une dépendance de l’hôte, via mcp-broker-provider lorsque nécessaire.')
p('Le premier chemin comprend inspection et validation du Tileset, lecture de la pyramide, observation de la sélection réelle du runtime, échantillonnage DEM et capacités de rendu. Il s’exécute sur les mêmes instances que l’application et doit produire les mêmes résultats métier par API directe et par MCP.')
h('Validation avant publication')
for text in [
 'Aucun import MCP dans les packages métier ; aucun import Babylon ou Three dans les behaviors génériques. Un utilisateur du package métier n’installe pas MCP par dépendance inverse.',
 'Chaque composant fonctionnel possède un behavior et une grammaire documentés ; seuls les outils implémentés sont annoncés. Les packages internes sans surface autonome restent regroupés.',
 'Tests des schémas, descriptions, repli FR/EN, collisions de noms, routage des URI et gestion des instances ; tests serveur-client avec LoopbackTransport.',
 'Tests de notifications, isolation de session, erreurs et libération des abonnements. Tests de progression et annulation pour les opérations effectivement prises en charge.',
 'Même sélection du runtime et mêmes résultats DEM avec Babylon et Three à données et caméra normalisée identiques, sans duplication du runtime.',
 'Vérification des bundles navigateur, des peerDependencies MCP/moteur et du contenu des archives NPM ; publication seulement après validation des versions compatibles.',
]: p(text,True)
p('Sources locales examinées : mcp-core/AGENTS.md et README.md (Grammar layer) ; src/mcp.behavior.ts ; src/mcp.grammar.ts ; src/interfaces/mcp.behavior.interfaces.ts ; spacexr-explorer/src/mcp.ts. Les noms de packages, behaviors et outils de cette extension sont des cibles de migration, sans implémentation ni publication effectuée.')

# Keep cell widths and table grids consistent within the text area.
available = d.sections[0].page_width.twips - d.sections[0].left_margin.twips - d.sections[0].right_margin.twips
from docx.shared import Twips
for i,t in enumerate(d.tables):
    raw = [x.w.twips for x in t._tbl.tblGrid.gridCol_lst] if i < 4 else [1.13, 2.32, 2.85]
    widths = [round(x / sum(raw) * available) for x in raw]
    widths[-1] += available - sum(widths)
    t.autofit=False
    for col,w in zip(t._tbl.tblGrid.gridCol_lst,widths): col.w=Twips(w)
    for row in t.rows:
        for cell,w in zip(row.cells,widths): cell.width=Twips(w)
    tw=t._tbl.tblPr.find(qn('w:tblW'))
    tw.set(qn('w:type'),'dxa');tw.set(qn('w:w'),str(available))

# Write only document.xml back into the original archive, preserving all other parts.
OUT.parent.mkdir(parents=True, exist_ok=True)
xml = etree.tostring(d._element, xml_declaration=True, encoding='UTF-8', standalone=True)
assert '\u2014' not in xml.decode('utf-8'), 'Forbidden punctuation in document'
with zipfile.ZipFile(SOURCE) as src, zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED) as dst:
    for info in src.infolist():
        dst.writestr(info, xml if info.filename=='word/document.xml' else src.read(info.filename))
check=Document(OUT)
assert len(check.tables)==len(Document(SOURCE).tables)+1
assert any('Composants MCP et behaviors'==x.text for x in check.paragraphs)
print(json.dumps({'output':str(OUT),'paragraphs':len(check.paragraphs),'tables':len(check.tables)},ensure_ascii=False))
