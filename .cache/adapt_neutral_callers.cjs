const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/3d-tiles-core/node/node_modules/typescript');
const base = 'C:/Users/GuillaumePelletier/Documents/GitHub/Gaume';
const render = `${base}/spacexr-rendering`;
const backup = path.join(__dirname, 'body-neutralization/before');
function files(root) {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, {withFileTypes:true}).flatMap(e => e.isDirectory() ? (['node_modules','dist'].includes(e.name) ? [] : files(path.join(root,e.name))) : e.name.endsWith('.ts') ? [path.join(root,e.name)] : []);
}
function write(file, text) {
    const saved = path.join(backup,path.relative(base,file));
    if (!fs.existsSync(saved)) { fs.mkdirSync(path.dirname(saved),{recursive:true}); fs.copyFileSync(file,saved); }
    fs.writeFileSync(file,text);
}
function editText(text, edits) {
    for (const e of edits.sort((a,b)=>b.start-a.start || b.end-a.end)) text=text.slice(0,e.start)+e.text+text.slice(e.end);
    return text;
}
let count=0;
const roots=[`${base}/3d-tiles-core/node/packages`,`${base}/terrain-core/packages`,`${render}/packages/core/tests`,`${render}/examples`];
for (const file of (process.argv.includes('--organize-only') ? [] : roots.flatMap(files))) {
    const isTest=file.replaceAll('\\','/').includes('/tests/');
    const isDemo=file.replaceAll('\\','/').includes('/examples/');
    if (!isTest && !isDemo) continue;
    let text=fs.readFileSync(file,'utf8');
    let sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    const deletions=[];
    function removeCube(n) {
        if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
            const c=n.expression, label=c.arguments[0];
            if (label && ts.isStringLiteral(label) && /DisplayedTiles on the cube|generate the same edge across faces/i.test(label.text)) deletions.push({start:n.getFullStart(),end:n.end,text:''});
        }
        ts.forEachChild(n,removeCube);
    }
    removeCube(sf);
    // The shared-edge assertion uses cube topology; retain the surrounding generic tests.
    if (file.endsWith('prestitched-rasters.test.ts')) {
        function find(n) {
            if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
                const c=n.expression,label=c.arguments[0];
                if (label && ts.isStringLiteral(label) && /across faces|turned|quarter turn/i.test(label.text)) deletions.push({start:n.getFullStart(),end:n.end,text:''});
            }
            ts.forEachChild(n,find);
        }
        find(sf);
        text=text.replaceAll('CubeFace.South','5').replaceAll('CubeFace.North','4').replaceAll('CubeFace.PositiveY','2');
        // Recompute removal positions after identifier replacements.
        sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);deletions.length=0;find(sf);
    }
    text=editText(text,deletions);
    sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    const imports=[];
    for (const n of sf.statements) {
        if (!ts.isImportDeclaration(n) || !n.importClause?.namedBindings || !ts.isNamedImports(n.importClause.namedBindings)) continue;
        const elements=n.importClause.namedBindings.elements;
        const kept=elements.filter(e=>!['TILE_METRICS','CUBE_TILE_TOPOLOGY','CUBE_FACE_EDGES','CubeFace','cubeTileNeighbor'].includes(e.name.text));
        if (kept.length!==elements.length) imports.push({start:n.getStart(sf),end:n.end,text:kept.length ? `import ${n.importClause.isTypeOnly?'type ':''}{ ${kept.map(e=>e.getText(sf)).join(', ')} } from ${n.moduleSpecifier.getText(sf)};`:''});
    }
    text=editText(text,imports);
    sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    const changes=[];let physical=false,tiling=false,metrics=false;
    const system=isDemo?'SAMPLE_SYSTEM':'FIXTURE_SYSTEM';
    function add(pos,s){changes.push({start:pos,end:pos,text:s});}
    function replace(n,s){changes.push({start:n.getStart(sf),end:n.end,text:s});}
    function args(n,values) {
        const content=text.slice(n.arguments.pos,n.end-1).trimEnd();
        add(n.end-1,(n.arguments.length && !content.endsWith(',')?', ':'')+values.join(', '));
    }
    function property(obj,name,value) {
        if (ts.isObjectLiteralExpression(obj)) {
            if (obj.properties.some(p=>p.name?.getText(sf)===name))return false;
            add(obj.getStart(sf)+1,`${name}: ${value}, `);return true;
        }
        return false;
    }
    function visit(n) {
        if (ts.isNewExpression(n) && n.arguments) {
            const name=n.expression.getText(sf),a=n.arguments;
            if (name==='WebMercatorTileMetrics' && a.length===1) {args(n,[system]);physical=true;}
            if (name==='WebMercatorTileSurface' && a.length===0) {args(n,[system]);physical=true;}
            if (name==='EcefSpatialMetric') {
                if (!a.length) {args(n,[`{ geodeticSystem: ${system} }`]);physical=true;}
                else if (property(a[0],'geodeticSystem',system)) physical=true;
            }
            if (name==='BabylonGeodesicGridPipeline') {
                if (a.length===2) {args(n,[`{ tiling: FixtureTiling(${system}) }`]);physical=tiling=true;}
                else if (a[2] && property(a[2],'tiling',`FixtureTiling(${system})`))physical=tiling=true;
            }
            if (name==='ElevationPages' && a.length<4) {args(n,[...(a.length===2?['undefined']:[]),`FixtureTiling(${system})`]);physical=tiling=true;}
        }
        if (ts.isObjectLiteralExpression(n)) {
            const names=new Set(n.properties.map(p=>p.name?.getText(sf)));
            if (names.has('scene') && names.has('labelLayer') && names.has('junctions') && !names.has('tiling')) {property(n,'tiling',`FixtureTiling(${system})`);physical=tiling=true;}
        }
        if (ts.isCallExpression(n)) {
            const name=n.expression.getText(sf),a=n.arguments;
            const expected={webMercatorTiling:0,useEllipsoidUpVector:1,tileCenterEcef:1,gridShape:3,projectGridTopologyToEllipsoid:2,regionCenter:1};
            if (Object.hasOwn(expected,name) && a.length===expected[name]) {args(n,[system]);physical=true;}
            if (name==='projectGridTopologyToEllipsoid' && a[2]?.getText(sf)==='undefined') {replace(a[2],system);physical=true;}
            if (name==='createGeospatialCamera' && a[1] && property(a[1],'geodeticSystem',system))physical=true;
            if (name==='createWebMapImplicitSource' && a[0] && property(a[0],'geodeticSystem',system))physical=true;
            if (name==='webMercatorSurfaceNormal' && a.length<4) {args(n,[...(a.length===2?['1']:[]),`${system}.ellipsoid.semiMajorAxis`]);physical=true;}
            if (name==='webMercatorTileMatrix' && a.length<3) {args(n,[...(a.length===1?['256']:[]),`${system}.ellipsoid.semiMajorAxis`]);physical=true;}
            if (name==='createGeodesicGridSource') {
                if (a.length<2) args(n,[...(a.length===0?['undefined']:[]),'{ metrics: TILE_METRICS }']);
                else property(a[1],'metrics','TILE_METRICS');
                metrics=true;physical=true;
            }
        }
        ts.forEachChild(n,visit);
    }
    visit(sf);text=editText(text,changes);
    let prefix='';
    if (isTest && (physical || text.includes('TILE_METRICS'))) {
        prefix+='import { GeodeticSystem as FixtureGeodeticSystem } from "@spacexr/geodesy";\nconst FIXTURE_SYSTEM = FixtureGeodeticSystem.WGS84;\n';
    }
    if (isDemo && physical && !/import\s*\{[^}]*SAMPLE_SYSTEM/.test(text)) {
        let relative=path.relative(path.dirname(file),`${render}/examples/shared/earth`).replaceAll('\\','/');
        if (!relative.startsWith('.'))relative='./'+relative;
        prefix+=`import { SAMPLE_SYSTEM } from "${relative}";\n`;
    }
    if (isTest && (metrics || text.includes('TILE_METRICS'))) {
        prefix+='import { WebMercatorTileMetrics as FixtureTileMetrics } from "@spacexr/tiles";\nconst TILE_METRICS = new FixtureTileMetrics({ minLOD: 3, maxLOD: 18, tileSize: 64 }, FIXTURE_SYSTEM);\n';
    }
    if (tiling) {
        const target=isTest?path.relative(path.dirname(file),`${render}/packages/core/src/terrain/terrain-tiling`).replaceAll('\\','/'):'@spacexr/3d-tiles-babylon';
        prefix+=`import { webMercatorTiling as FixtureTiling } from "${target.startsWith('.')||target.startsWith('@')?target:'./'+target}";\n`;
    }
    text=prefix+text;
    if (text!==fs.readFileSync(file,'utf8')) {write(file,text);count++;}
}
console.log(`Adapted ${count} sample and test files to explicit physical configuration.`);

// Remove imports that belonged only to the retired code paths.
const sources=[`${base}/3d-tiles-core/node/packages`,`${base}/terrain-core/packages`,`${render}/packages/core`,`${render}/examples`].flatMap(files);
for (const file of sources) {
    let text=fs.readFileSync(file,'utf8');
    const host={getScriptFileNames:()=>[file],getScriptVersion:()=> '1',getScriptSnapshot:f=>fs.existsSync(f)?ts.ScriptSnapshot.fromString(fs.readFileSync(f,'utf8')):undefined,getCurrentDirectory:()=>path.dirname(file),getCompilationSettings:()=>({noResolve:true,noLib:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}),getDefaultLibFileName:o=>ts.getDefaultLibFilePath(o),fileExists:ts.sys.fileExists,readFile:ts.sys.readFile,readDirectory:ts.sys.readDirectory};
    const service=ts.createLanguageService(host);
    const all=service.organizeImports({type:'file',fileName:file},{},{}).flatMap(x=>x.textChanges.map(c=>({start:c.span.start,end:c.span.start+c.span.length,text:c.newText})));
    const next=editText(text,all);if(next!==text)write(file,next);service.dispose();
}
console.log('Organized imports after extraction.');
