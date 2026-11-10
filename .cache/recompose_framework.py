"""Prepare the repository recomposition, preserving algorithms and source backups."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

BASE=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume').resolve()
AUDIT=Path(__file__).resolve().parent/'framework-recomposition'
BACKUP=AUDIT/'before'
CORE=BASE/'3d-tiles-core'
OLD=BASE/'3d-tiles-babylon'
TERRAIN=BASE/'terrain-core'
RENDER=BASE/'spacexr-rendering'
SKIP={'node_modules','dist','coverage','.git','.vite','web-dist'}
manifest=[]

def safe(path):
    path=Path(path).absolute()
    assert path.is_relative_to(BASE) and path!=BASE,path
    return path

def preserve(path):
    path=safe(path)
    if path.is_file():
        saved=BACKUP/path.relative_to(BASE)
        if not saved.exists():saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,saved)

def write(path,text):
    path=safe(path);preserve(path);path.parent.mkdir(parents=True,exist_ok=True)
    assert '\u2014' not in text,path
    path.write_text(text,encoding='utf-8',newline='\n')

def js(path,obj):write(path,json.dumps(obj,indent=4,ensure_ascii=False)+'\n')
def load(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def copy_tree(src,dst):
    src=safe(src);dst=safe(dst)
    for f in src.rglob('*'):
        if not f.is_file() or any(x in SKIP for x in f.relative_to(src).parts):continue
        if f.name.startswith('.env'):continue
        target=dst/f.relative_to(src)
        assert not target.exists(),target
        preserve(f);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,target)
        manifest.append({'source':str(f.relative_to(BASE)).replace('\\','/'),'target':str(target.relative_to(BASE)).replace('\\','/'),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})

def workspace(path,apps=False):
    roots=[('3D Tiles','../3d-tiles-core'),('Terrain','../terrain-core'),('Rendering','.'),('Geodesy','../geodesy_ts')]
    if apps:roots += [('Celestial','../celestial-core'),('Quantia','../quantia'),('Explorer','../spacexr-explorer'),('Tile Service','../spacexr-tile-service')]
    tasks=[]
    def task(label,args,cwd='${workspaceFolder:Rendering}',**other):
        tasks.append({'label':label,'type':'shell','command':'npm','args':args,'options':{'cwd':cwd},'problemMatcher':[],**other})
    task('Framework: install',['run','framework:install'])
    task('Framework: build',['run','framework:build'],group={'kind':'build','isDefault':True})
    task('Framework: check',['run','framework:check'],group='test')
    task('Framework: verify links',['run','framework:verify'])
    task('Terrain example: dev',['run','example:implicit-grid'],isBackground=True)
    task('3D Tiles example: dev',['run','example:google-3d-tiles'],isBackground=True)
    for folder,cwd in [('3D Tiles','${workspaceFolder:3D Tiles}/node'),('Terrain','${workspaceFolder:Terrain}'),('Rendering','${workspaceFolder:Rendering}')]:
        task(folder+': check',['run','check'],cwd)
    for folder,cwd,names in [('3D Tiles','${workspaceFolder:3D Tiles}/node',['3d-tiles-core','tiles','3d-tiles-runtime']),('Terrain','${workspaceFolder:Terrain}',['raster','dem','grid']),('Rendering','${workspaceFolder:Rendering}',['3d-tiles-babylon'])]:
        for name in names:task('Watch: '+name,['run','watch','--workspace','@spacexr/'+name],cwd,isBackground=True)
    if apps:
        task('Explorer: dev',['run','dev'],'${workspaceFolder:Explorer}',isBackground=True)
        task('Explorer: build',['run','build'],'${workspaceFolder:Explorer}')
        task('Tile Service: check',['run','check'],'${workspaceFolder:Tile Service}')
    js(path,{'folders':[{'name':n,'path':p} for n,p in roots],'settings':{'files.exclude':{'**/node_modules':True,'**/dist':True,'**/coverage':True},'search.exclude':{'**/node_modules':True,'**/dist':True,'**/coverage':True},'typescript.tsdk':'node_modules/typescript/lib','eslint.workingDirectories':[{'mode':'auto'}],'files.eol':'\n'},'extensions':{'recommendations':['dbaeumer.vscode-eslint','esbenp.prettier-vscode','editorconfig.editorconfig']},'tasks':{'version':'2.0.0','tasks':tasks}})

def prepare():
    AUDIT.mkdir(parents=True,exist_ok=True)
    for root in [TERRAIN,RENDER]:assert list(root.iterdir())==[root/'.git'],f'Target must be empty: {root}'
    states={}
    for root in [CORE,OLD,TERRAIN,RENDER,BASE/'spacexr-explorer',BASE/'spacexr-tile-service',BASE/'geomodels-babylon']:
        states[root.name]={}
        for label,args in [('head',['rev-parse','HEAD']),('status',['status','--short'])]:
            r=subprocess.run(['git','-c','safe.directory='+root.as_posix(),'-C',str(root),*args],capture_output=True,text=True)
            states[root.name][label]=r.stdout.strip()
        for f in ['package.json','package-lock.json','.npmrc','README.md','AGENTS.md','.github/workflows/release-node.yml']:
            preserve(root/f)
    (AUDIT/'initial-state.json').write_text(json.dumps(states,indent=2),encoding='utf-8')
    for name in ['raster','dem','grid']:copy_tree(CORE/'node/packages'/name,TERRAIN/'packages'/name)
    for name in ['packages','examples','docs','.vscode']:copy_tree(OLD/name,RENDER/name)
    for name in ['.editorconfig','.gitattributes','.gitignore','LICENSE','CHANGELOG.md','README.md','package.json','package-lock.json']:
        copy_tree_file=OLD/name
        preserve(copy_tree_file);shutil.copy2(copy_tree_file,RENDER/name)
    for doc in ['raster.md','dem.md','grid.md','draping.md']:
        preserve(CORE/'docs'/doc);(TERRAIN/'docs').mkdir(exist_ok=True);shutil.copy2(CORE/'docs'/doc,TERRAIN/'docs'/doc)
    for doc in ['terrain-pipeline.md','terrain-review.md','terrain-test-log.md','renderer-evaluation.md']:
        preserve(CORE/'docs'/doc);shutil.copy2(CORE/'docs'/doc,RENDER/'docs'/doc)
    for sub in ['terrain-tests','images']:
        if (CORE/'docs'/sub).exists():copy_tree(CORE/'docs'/sub,RENDER/'docs'/sub)
    if (CORE/'assets').exists():copy_tree(CORE/'assets',TERRAIN/'assets')
    for name in ['.editorconfig','.gitattributes','.gitignore','LICENSE']:
        shutil.copy2(CORE/name,TERRAIN/name)
    write(TERRAIN/'.npmrc','install-links=false\n')
    write(RENDER/'.npmrc','install-links=false\n')
    corepkg=load(CORE/'node/package.json')
    terrainpkg={**corepkg,'name':'@spacexr/terrain-workspace','description':'Renderer-neutral raster, DEM and grid packages for the shared 3D Tiles runtime.','workspaces':['packages/raster','packages/dem','packages/grid'],'dependencies':{'@spacexr/tiles':'file:../3d-tiles-core/node/packages/tiles'}}
    terrainpkg['scripts']={**corepkg['scripts'],'build':'npm run build --workspace @spacexr/raster --workspace @spacexr/dem --workspace @spacexr/grid'}
    js(TERRAIN/'package.json',terrainpkg)
    # Seed the lock from the baseline to retain the existing toolchain versions.
    terrainlock=load(CORE/'node/package-lock.json');terrainlock['name']=terrainpkg['name']
    terrainlock['packages']['']={k:v for k,v in terrainpkg.items() if k in ['name','version','workspaces','dependencies','engines','license']}
    for name in ['core','runtime','tiles']:
        terrainlock['packages'].pop('packages/'+name,None)
    for name in ['3d-tiles-core','3d-tiles-runtime','tiles']:
        terrainlock['packages'].pop('node_modules/@spacexr/'+name,None)
    js(TERRAIN/'package-lock.json',terrainlock)
    for name in ['raster','dem','grid']:
        root=TERRAIN/'packages'/name;pkg=load(root/'package.json')
        pkg['repository']={'type':'git','url':'git+https://github.com/pandaGaume/terrain-core.git','directory':'packages/'+name}
        pkg['homepage']='https://github.com/pandaGaume/terrain-core#readme';pkg['bugs']={'url':'https://github.com/pandaGaume/terrain-core/issues'}
        js(root/'package.json',pkg)
        cfg=load(root/'tsconfig.json')
        for key,value in cfg['compilerOptions'].get('paths',{}).items():
            cfg['compilerOptions']['paths'][key]=[s.replace('../tiles/','../../../3d-tiles-core/node/packages/tiles/') for s in value]
        js(root/'tsconfig.json',cfg)
        f=root/'vitest.config.ts';write(f,f.read_text().replace('../tiles/src/','../../../3d-tiles-core/node/packages/tiles/src/'))
        f=root/'README.md';text=f.read_text(encoding='utf-8')
        text=text.replace('3d-tiles-core/blob/main/docs/','terrain-core/blob/main/docs/')
        write(f,text)
    corepkg['workspaces']=['packages/core','packages/tiles','packages/runtime'];js(CORE/'node/package.json',corepkg)
    renderpkg=load(RENDER/'package.json');renderpkg['name']='@spacexr/rendering-workspace'
    renderpkg['description']='SpaceXR rendering integrations, shader tools and working 3D Tiles and terrain examples.'
    for name in ['raster','dem','grid']:renderpkg['dependencies']['@spacexr/'+name]='file:../terrain-core/packages/'+name
    renderpkg['scripts'].update({'framework:install':'node scripts/framework.mjs install','framework:build':'node scripts/framework.mjs build','framework:check':'node scripts/framework.mjs check','framework:verify':'node scripts/verify-framework.mjs'})
    js(RENDER/'package.json',renderpkg)
    pkg=load(RENDER/'packages/core/package.json')
    pkg['repository']={'type':'git','url':'git+https://github.com/pandaGaume/spacexr-rendering.git','directory':'packages/core'}
    pkg['homepage']='https://github.com/pandaGaume/spacexr-rendering#readme';pkg['bugs']={'url':'https://github.com/pandaGaume/spacexr-rendering/issues'}
    js(RENDER/'packages/core/package.json',pkg)
    locktext=(RENDER/'package-lock.json').read_text()
    for name in ['raster','dem','grid']:locktext=locktext.replace('../3d-tiles-core/node/packages/'+name,'../terrain-core/packages/'+name)
    locktext=locktext.replace('@spacexr/3d-tiles-babylon-workspace','@spacexr/rendering-workspace');write(RENDER/'package-lock.json',locktext)
    for root in [BASE/'spacexr-explorer',BASE/'spacexr-tile-service']:
        for filename in ['package.json','package-lock.json']:
            f=root/filename;text=f.read_text(encoding='utf-8')
            for name in ['raster','dem','grid']:text=text.replace('../3d-tiles-core/node/packages/'+name,'../terrain-core/packages/'+name)
            text=text.replace('../3d-tiles-babylon/packages/core','../spacexr-rendering/packages/core');write(f,text)
    f=BASE/'spacexr-explorer/vite.config.mjs';write(f,f.read_text().replace('../3d-tiles-babylon/packages/core/','../spacexr-rendering/packages/core/'))
    # The studio is an additional direct DEM/raster consumer discovered during inventory.
    for rel in ['packages/dev/studio/package.json','package-lock.json']:
        f=BASE/'geomodels-babylon'/rel
        if f.exists():
            text=f.read_text(encoding='utf-8')
            for name in ['raster','dem','grid']:text=text.replace('3d-tiles-core/node/packages/'+name,'terrain-core/packages/'+name)
            write(f,text)
    for name in ['spacexr-explorer','spacexr-tile-service']:
        f=BASE/name/'README.md';text=f.read_text(encoding='utf-8')
        text=text.replace('../3d-tiles-babylon/packages/core','../spacexr-rendering/packages/core')
        write(f,text+'\n## Framework repositories\n\nThe renderer-neutral raster, DEM and grid packages live in `../terrain-core`; the Babylon package and reference examples live in `../spacexr-rendering`. Package names and imports are unchanged. Build the framework with `npm run framework:build` from `../spacexr-rendering` before starting this consumer. See the framework migration guide there.\n')
    workspace(RENDER/'SpaceXR-Framework.code-workspace')
    workspace(RENDER/'SpaceXR-Applications.code-workspace',apps=True)
    # The old entry point remains useful and uses exactly the same stable folder names.
    oldws=load(RENDER/'SpaceXR-Framework.code-workspace')
    for folder in oldws['folders']:
        if folder['name']=='3D Tiles':folder['path']='.'
        if folder['name']=='Rendering':folder['path']='../spacexr-rendering'
    oldws['settings']['typescript.tsdk']='node/node_modules/typescript/lib';js(CORE/'3d-tiles-core.code-workspace',oldws)
    for root,name in [(TERRAIN,'Terrain'),(RENDER,'Rendering')]:
        data=load(RENDER/'SpaceXR-Framework.code-workspace')
        if root==TERRAIN:
            for folder in data['folders']:
                if folder['name']=='Terrain':folder['path']='.'
                if folder['name']=='Rendering':folder['path']='../spacexr-rendering'
        js(root/(root.name+'.code-workspace'),data)
    write(RENDER/'scripts/framework.mjs',FRAMEWORK)
    write(RENDER/'scripts/verify-framework.mjs',VERIFY)
    write(TERRAIN/'AGENTS.md',TERRAIN_AGENTS)
    write(RENDER/'AGENTS.md',RENDER_AGENTS)
    write(TERRAIN/'README.md',TERRAIN_README)
    oldreadme=(RENDER/'README.md').read_text(encoding='utf-8')
    write(RENDER/'README.md',RENDER_README+'\n## Existing integration guide\n\n'+oldreadme.replace('https://github.com/pandaGaume/3d-tiles-babylon','https://github.com/pandaGaume/spacexr-rendering'))
    write(RENDER/'docs/framework-migration.md',MIGRATION)
    write(TERRAIN/'docs/migration.md',MIGRATION)
    for root,kind in [(TERRAIN,'terrain'),(RENDER,'rendering')]:write(root/'.github/workflows/ci.yml',ci(kind))
    (AUDIT/'transfers.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    js(RENDER/'docs/migration-origin.json',{'date':'2026-11-10','sources':{r:states[r]['head'] for r in ['3d-tiles-core','3d-tiles-babylon']},'packages':{'@spacexr/raster':'terrain-core/packages/raster','@spacexr/dem':'terrain-core/packages/dem','@spacexr/grid':'terrain-core/packages/grid','@spacexr/3d-tiles-babylon':'spacexr-rendering/packages/core'},'compatibility':'Package names, versions and algorithms preserved; no publication performed.'})
    print('Prepared',len(manifest),'source transfers. Originals retained until qualification.')

FRAMEWORK='''import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const action = process.argv[2];
if (!["install", "build", "check"].includes(action)) throw new Error("Use install, build or check.");
const repositories = ["../../3d-tiles-core/node/", "../../terrain-core/", "../"];
for (const relative of repositories) {
    const cwd = fileURLToPath(new URL(relative, import.meta.url));
    if (!existsSync(new URL(relative + "package.json", import.meta.url))) throw new Error(`Missing sibling repository: ${cwd}`);
    const args = action === "install" ? ["ci", "--install-links=false", "--no-audit", "--no-fund"] : ["run", action];
    console.log(`\\n${action}: ${cwd}`);
    const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
'''

VERIFY='''import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const owners = {
    "@spacexr/3d-tiles-core": "../3d-tiles-core/node/packages/core",
    "@spacexr/tiles": "../3d-tiles-core/node/packages/tiles",
    "@spacexr/3d-tiles-runtime": "../3d-tiles-core/node/packages/runtime",
    "@spacexr/raster": "../terrain-core/packages/raster",
    "@spacexr/dem": "../terrain-core/packages/dem",
    "@spacexr/grid": "../terrain-core/packages/grid",
    "@spacexr/3d-tiles-babylon": "packages/core",
};
const scopes = [root, resolve(root, "packages/core"), resolve(root, "examples/babylon-implicit-grid-mapzen"), resolve(root, "examples/babylon-google-3d-tiles")];
for (const scope of scopes) {
    const require = createRequire(resolve(scope, "package.json"));
    for (const [name, relative] of Object.entries(owners)) {
        const actual = realpathSync(dirname(require.resolve(name)));
        const expected = realpathSync(resolve(root, relative, "dist"));
        if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${scope}: ${name} resolves to ${actual}, expected ${expected}`);
    }
    console.log(`Canonical package links: ${scope}`);
}
for (const [name, relative] of Object.entries(owners)) {
    const path = resolve(root, relative);
    const pkg = JSON.parse(readFileSync(resolve(path, "package.json"), "utf8"));
    if (pkg.name !== name) throw new Error(`Package identity changed: ${name}`);
}
console.log("All seven package identities and canonical links verified.");
'''

TERRAIN_AGENTS='''# Terrain Core

Owns `@spacexr/raster`, `@spacexr/dem` and `@spacexr/grid` in `packages/`.
`@spacexr/tiles`, 3D Tiles contracts and the single runtime remain in the sibling `3d-tiles-core` repository.
Keep terrain algorithms renderer-neutral. Do not introduce another selector or runtime.
Prefix TypeScript interfaces with `I`. Document units, reference frames and raster registration.
Run `npm run check` from this root. Build `../3d-tiles-core/node` first.
Keep existing package names, public exports and numerical behavior during this migration.
The current phase changes packaging, documentation and tooling only.
No npm publication without an explicit request. Trusted publishing must be configured for the new repository first.
Never use the em dash character.
'''

RENDER_AGENTS='''# SpaceXR Rendering

`packages/core` owns the existing `@spacexr/3d-tiles-babylon` adapter. Its package identity is unchanged.
`packages/tools` owns the shader compiler and existing terrain and renderer comparisons.
`examples` contains the Google 3D Tiles and implicit terrain applications.
The single runtime and tile addressing live in `../3d-tiles-core`; raster, DEM and grid live in `../terrain-core`.
Do not copy those implementations here. Do not add empty future packages or change algorithms during recomposition.
Keep Babylon types in the adapter. Future shared contracts and other adapters must remain independent of Babylon.
Prefix interfaces with `I`. Scenes use ECEF metres, right-handed coordinates and large-world rendering.
Write shaders in their own files. Never edit generated shader TypeScript; run `npm run shaders`.
Applications explicitly register loaders. Do not infer content format from a URI extension.
Run `npm run framework:check` to check sibling core, terrain, adapter, tools and examples in order.
Never measure against an existing development server without stating which sources it serves.
No publication or repository push without explicit authorization. Never use the em dash character.
'''

TERRAIN_README='''# Terrain Core

Renderer-neutral rasters, elevation and grids for the existing SpaceXR framework. The terrain is exposed through implicit 3D Tiles and uses the single runtime in `3d-tiles-core`.

| Package | Responsibility |
| --- | --- |
| `@spacexr/raster` | Raster grids, sampling, image decoding, stitching and draping calculations |
| `@spacexr/dem` | Elevation codecs, providers, pyramids, gradients and surfaces |
| `@spacexr/grid` | Reusable grid topology, junctions and CPU geometry |

Package names, version 0.1.0 and public imports are preserved. The packages were extracted from `3d-tiles-core/node/packages` without changing algorithms. Tile addressing, generic pyramids and the single selector remain in `@spacexr/tiles` and `@spacexr/3d-tiles-runtime`.

## Development

Check out `3d-tiles-core`, `terrain-core` and `spacexr-rendering` as siblings. From `spacexr-rendering`, run `npm run framework:install`, then `npm run framework:build` or `npm run framework:check`.

For this repository alone, build `../3d-tiles-core/node`, then run `npm ci` and `npm run check` here. Local links are declared at the root; published package manifests keep their versioned dependencies.

Open `terrain-core.code-workspace` or `../spacexr-rendering/SpaceXR-Framework.code-workspace`. The default build task builds core, terrain and rendering in dependency order.

## Documentation

- [Rasters](docs/raster.md)
- [Elevation](docs/dem.md)
- [Grid topology](docs/grid.md)
- [Draping](docs/draping.md)
- [Migration and consumers](docs/migration.md)
- [Rendering and reference examples](../spacexr-rendering/README.md)

Morphology improvements, oriented cliffs, new MCP behaviors and visual localization are later functional work. This phase preserves the current working framework.
'''

RENDER_README='''# SpaceXR Rendering

The working Babylon 3D Tiles and terrain framework, recomposed into its new repository while preserving package names and algorithms.

| Repository | Packages |
| --- | --- |
| `3d-tiles-core` | `@spacexr/3d-tiles-core`, `@spacexr/tiles`, `@spacexr/3d-tiles-runtime` |
| `terrain-core` | `@spacexr/raster`, `@spacexr/dem`, `@spacexr/grid` |
| `spacexr-rendering` | `@spacexr/3d-tiles-babylon`, private shader/benchmark tools and both examples |

## Start developing

All three repositories must be siblings. Node.js 22 is recommended for the existing browser benchmark tools; packages retain their current minimum engines.

```sh
npm run framework:install
npm run framework:build
npm run framework:verify
npm run example:implicit-grid
```

`npm run framework:check` runs the existing formatting, lint, type checks, tests and builds in dependency order, including both reference examples. Google content still requires its existing provider credentials; lunar and Martian datasets require the existing tile service.

Open [SpaceXR-Framework.code-workspace](SpaceXR-Framework.code-workspace) for library work, or [SpaceXR-Applications.code-workspace](SpaceXR-Applications.code-workspace) to include Explorer, Celestial, Quantia and the tile service. Task folder names are stable and paths are relative.

The Babylon adapter remains together in `packages/core` for this first phase. Splitting terrain, atmosphere, generic kernels, Three integration or MCP packages is deferred until the working framework has been qualified. See [migration](docs/framework-migration.md), [terrain pipeline](docs/terrain-pipeline.md), [terrain settings](docs/terrain-settings.md) and [renderer evaluation](docs/renderer-evaluation.md).
'''

MIGRATION='''# Framework recomposition

## First delivery

Reorganize the repositories, packages, documentation and VS Code workspaces while preserving the currently working 3D Tiles and terrain framework. Package identities, versions, exports, algorithms and shaders are unchanged.

`3d-tiles-core/node/packages/{core,tiles,runtime}` remains the shared foundation. `terrain-core/packages/{raster,dem,grid}` owns the terrain data and grid packages. `spacexr-rendering/packages/core` owns the existing Babylon adapter; `packages/tools` and both examples move with it.

## Build and integration

From `spacexr-rendering`, run `npm run framework:install`, `npm run framework:build`, then `npm run framework:verify`. The install uses the committed lockfiles and local links. Checks run in core, terrain, rendering order. Use `npm run example:implicit-grid` or `npm run example:google-3d-tiles` here.

Explorer and the tile service update their local file dependencies, lockfiles and source aliases. Their public imports remain unchanged. The additional direct DEM/raster consumer in `geomodels-babylon/packages/dev/studio` follows the same new terrain paths. Reinstall those consumer workspaces after migration; restart existing Vite processes so they serve the new source tree.

No global `npm link` is required. The workspace roots declare sibling `file:` dependencies while publishable packages retain versioned dependencies. The root `.npmrc` keeps `install-links=false`. `framework:verify` rejects stale links or copied packages at old locations.

## Documentation ownership

Terrain owns rasters, DEM, grid and draping contracts. Core owns the standard model, implicit tiling, addressing and runtime. Rendering owns the terrain pipeline, terrain settings, renderer evaluation and benchmark history. Historical logs retain their original measurements and revisions. Old documentation paths point to the new owner.

`celestial-core`, `geodesy_ts`, Quantia and `spacexr-atmosphere` keep their current implementations. Atmosphere consolidation and all new functional work are later phases. Existing Spatial Awareness documents remain with their owners.

## Source provenance and rollout

The local migration audit records source revisions, hashes, existing user changes and backups before edits. Existing staged tests and untracked work are preserved or transferred byte for byte. No commits, pushes, tags or publications are performed by this migration.

New repositories must be committed and pushed in a coordinated sequence before their remote CI can check out each other. Configure npm trusted publishers for any moved package before a future publication; old release workflows must no longer publish extracted packages. CI only checks and builds. The old Babylon repository becomes a compatibility launcher pointing at the new rendering workspace.

## Qualification

The baseline checks pass before extraction. Qualification requires the existing tests and builds in all three canonical repositories, canonical package-link checks, example builds, consumer checks and a separate browser smoke test where local data are available. Network-backed Google, Mapzen and planetary data retain their existing availability and credential requirements; a package build is not a visual regression test.
'''

def ci(kind):
    main='terrain-core' if kind=='terrain' else 'spacexr-rendering'
    text='''name: ci
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          path: MAIN
      - uses: actions/checkout@v7
        with:
          repository: pandaGaume/3d-tiles-core
          path: 3d-tiles-core
      - uses: actions/setup-node@v5
        with:
          node-version: 22.x
      - name: Build core
        working-directory: 3d-tiles-core/node
        run: |
          npm ci
          npm run build --workspace @spacexr/3d-tiles-core --workspace @spacexr/tiles --workspace @spacexr/3d-tiles-runtime
'''.replace('MAIN',main)
    if kind=='rendering':text+='''      - uses: actions/checkout@v7
        with:
          repository: pandaGaume/terrain-core
          path: terrain-core
      - name: Build terrain
        working-directory: terrain-core
        run: |
          npm ci
          npm run build
'''
    return text+f'''      - name: Check {kind}
        working-directory: {main}
        run: |
          npm ci
          npm run check
'''

if __name__=='__main__':prepare()
