"""Finish the qualified repository move with verified, reversible directory moves."""
from pathlib import Path
import hashlib
import json
import shutil
from recompose_framework import BASE, AUDIT, CORE, OLD, TERRAIN, RENDER, preserve, write, js, load, safe

records=json.loads((AUDIT/'transfers.json').read_text())
checked=0
for row in records:
    source=BASE/row['source'];target=BASE/row['target']
    if ('/src/' in row['source'] or '/tests/' in row['source']) and source.suffix in {'.ts','.js','.glsl','.wgsl','.json','.png'}:
        assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256'],f'Source changed since inventory: {source}'
        assert hashlib.sha256(target.read_bytes()).hexdigest()==row['sha256'],f'Moved implementation changed: {target}'
        checked+=1
print('Unchanged implementation and test files:',checked)

for root in [CORE,OLD]:
    f=root/'.gitignore';text=f.read_text(encoding='utf-8')
    if '.framework-recomposition-backup/' not in text:write(f,text+'\n# Reversible local repository-move backup\n.framework-recomposition-backup/\n')

for name in ['raster','dem','grid','draping']:
    write(CORE/'docs'/f'{name}.md',f'# {name.title()}\n\nThis documentation is maintained in [terrain-core](../../terrain-core/docs/{name}.md). The package name and public API are unchanged. The runtime remains in this repository.\n')
for name in ['terrain-pipeline','terrain-review','terrain-test-log','renderer-evaluation']:
    write(CORE/'docs'/f'{name}.md',f'# {name.replace("-"," ").title()}\n\nThe current document and its existing history live in [spacexr-rendering](../../spacexr-rendering/docs/{name}.md). The shared 3D Tiles runtime remains here.\n')
for name in ['tiles','celestial-tiling']:
    write(TERRAIN/'docs'/f'{name}.md',f'# {name.replace("-"," ").title()}\n\nTile addressing, generic pyramids and implicit 3D Tiles remain in [3d-tiles-core](../../3d-tiles-core/docs/{name}.md).\n')
write(RENDER/'docs/grid.md','# Terrain grids\n\nThe renderer-neutral topology and geometry contracts live in [terrain-core](../../terrain-core/docs/grid.md).\n')
for name in ['grid-junction-variants.svg','grid-lod-connections.png']:
    src=CORE/'docs/images'/name;dst=TERRAIN/'docs/images'/name
    dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)

f=CORE/'AGENTS.md';text=f.read_text(encoding='utf-8')
start=text.index('The core package contains');end=text.index('\n\nKeep these layers separate:',start)
text=text[:start]+'''The core package contains serializable 3D Tiles interfaces, JSON codecs and structural validation. The runtime package contains renderer-neutral traversal and mutable streaming state behind explicit ports. The tiles package contains content-neutral tile addressing, neighbours, pyramids and HTTP sources.

Raster, DEM and grid packages now live in the sibling `terrain-core/packages/` workspace. Babylon integration, shader tools and examples live in `spacexr-rendering`. Preserve one shared runtime; do not copy the moved implementations back here. Package names and imports remain unchanged. Use the multi-repository framework workspace for integration work.'''+text[end:]
write(f,text)
write(CORE/'README.md','''# 3D Tiles Core

Renderer-neutral contracts and the single SpaceXR 3D Tiles runtime, shared by terrain and 3D content.

| Package | Responsibility |
| --- | --- |
| `@spacexr/3d-tiles-core` | Immutable wire model, JSON codecs, validation and extensions |
| `@spacexr/tiles` | Addresses, cube/Mercator topology, generic pyramids, HTTP sources and reprojection |
| `@spacexr/3d-tiles-runtime` | Traversal, selection, availability, streaming, caches and presentation lifecycle |

The repository keeps `node/`, `conformance/`, cross-language `docs/`, and the reserved `dotnet/` and `cpp/` directories. The runtime never adds mutable state or scene objects to serialized documents. Ellipsoids and coordinate transforms remain in `@spacexr/geodesy`.

## Framework repositories

Raster, DEM and grid packages have moved to [terrain-core](../terrain-core/README.md). The existing Babylon adapter, shader tools, terrain benchmark and both reference examples have moved to [spacexr-rendering](../spacexr-rendering/README.md). Package identities, versions, APIs, tests and algorithms are preserved. All terrain remains compatible with implicit tilesets and uses this runtime.

## Development

```sh
cd node
npm ci
npm run check
```

For integration, open [3d-tiles-core.code-workspace](3d-tiles-core.code-workspace), or [SpaceXR-Framework](../spacexr-rendering/SpaceXR-Framework.code-workspace). The default build task builds core, terrain and rendering in dependency order. From `../spacexr-rendering`, `npm run framework:install`, `npm run framework:build`, `npm run framework:check` and `npm run framework:verify` provide the shared workflow.

## Documentation

- [Runtime architecture](docs/runtime-architecture.md)
- [Generic tiles](docs/tiles.md)
- [Celestial tiling](docs/celestial-tiling.md)
- [Cube sources](docs/cube-sources.md)
- [Terrain package documentation](../terrain-core/README.md)
- [Rendering pipeline and historical measurements](../spacexr-rendering/docs/terrain-pipeline.md)
- [Repository migration and consumers](../spacexr-rendering/docs/framework-migration.md)

The Node release retains its `node-v*` tag series and publishes only the three packages owned here. Moved packages require their new npm publisher configuration before any future release. License: Apache-2.0.
''')
release=CORE/'.github/workflows/release-node.yml'
text=release.read_text(encoding='utf-8')
text='\n'.join(line for line in text.splitlines() if not any('npm publish --workspace @spacexr/'+name+' ' in line for name in ['raster','dem','grid']))+'\n'
write(release,text)

for path in [CORE/'3d-tiles-core.code-workspace',TERRAIN/'terrain-core.code-workspace',RENDER/'spacexr-rendering.code-workspace',RENDER/'SpaceXR-Framework.code-workspace',RENDER/'SpaceXR-Applications.code-workspace']:
    data=load(path);data['settings']['typescript.tsdk']='node/node_modules/typescript/lib';data['settings']['typescript.enablePromptUseWorkspaceTsdk']=True;js(path,data)

oldpkg=load(OLD/'package.json')
scripts={name:f'npm --prefix ../spacexr-rendering run {name}' for name in oldpkg['scripts']}
scripts.update({name:f'npm --prefix ../spacexr-rendering run {name}' for name in ['framework:install','framework:build','framework:check','framework:verify']})
js(OLD/'package.json',{'name':'@spacexr/legacy-babylon-workspace','version':'0.0.0','private':True,'description':'Compatibility launcher for the relocated SpaceXR rendering workspace.','scripts':scripts})
write(OLD/'README.md','''# SpaceXR Babylon compatibility launcher

The implementation, shader tools, benchmark and both examples now live in [spacexr-rendering](../spacexr-rendering/README.md). The npm package remains `@spacexr/3d-tiles-babylon` with the same API.

Existing root commands such as `npm run build`, `npm run check`, `npm run example:implicit-grid` and `npm run example:google-3d-tiles` forward to the new workspace. Install dependencies in the new framework with `npm run framework:install`.

Open [SpaceXR-Framework.code-workspace](../spacexr-rendering/SpaceXR-Framework.code-workspace) for library development or [SpaceXR-Applications.code-workspace](../spacexr-rendering/SpaceXR-Applications.code-workspace) for Explorer and the tile service. Restart development servers that still serve the old paths.

This repository no longer owns publishable source packages. The local migration backup is ignored and exists only for rollback. Source revisions and preserved package identities are recorded in the new rendering repository. No push or publication has been performed.
''')
write(OLD/'AGENTS.md','''# Legacy Babylon workspace

The canonical implementation is now in `../spacexr-rendering`; read its AGENTS.md before changing rendering code. Terrain data packages are in `../terrain-core`, and the single runtime remains in `../3d-tiles-core`.
Do not recreate packages or examples in this repository. Root npm commands are compatibility launchers. Historical documentation paths redirect to their current owner.
Do not publish packages or push repositories without explicit authorization. Never use the em dash character.
''')
write(OLD/'.github/workflows/ci.yml','''name: relocated-workspace
on:
  workflow_dispatch:
jobs:
  location:
    runs-on: ubuntu-latest
    steps:
      - run: echo "The implementation and CI moved to pandaGaume/spacexr-rendering."
''')

# Verify the precise move destinations before moving any directory on Windows.
pairs=[(CORE/'node/packages'/name,CORE/'.framework-recomposition-backup/packages'/name) for name in ['raster','dem','grid']]
pairs += [(OLD/name,OLD/'.framework-recomposition-backup'/name) for name in ['packages','examples']]
for source,destination in pairs:
    owner=CORE if source.is_relative_to(CORE) else OLD
    assert source.resolve().is_relative_to(owner.resolve()) and source.resolve()!=owner.resolve()
    assert destination.absolute().is_relative_to(owner/'.framework-recomposition-backup')
    assert not destination.exists()
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.move(str(source),str(destination))
    print('Retired source directory with rollback copy:',source)

for f in (OLD/'docs').rglob('*.md'):
    relative=f.relative_to(OLD/'docs')
    target=RENDER/'docs'/relative
    if target.exists():
        depth=len(relative.parts)-1
        link='../'*(depth+2)+'spacexr-rendering/docs/'+relative.as_posix()
        write(f,f'# Documentation moved\n\nRead the current document in [spacexr-rendering]({link}). Historical content was transferred with the implementation.\n')

# Keep the launcher lockfile consistent without retaining old workspace packages.
js(OLD/'package-lock.json',{'name':'@spacexr/legacy-babylon-workspace','version':'0.0.0','lockfileVersion':3,'requires':True,'packages':{'':{'name':'@spacexr/legacy-babylon-workspace','version':'0.0.0'}}})
(AUDIT/'finalized.json').write_text(json.dumps({'unchanged_source_and_test_files':checked,'retired_paths':[str(s.relative_to(BASE)) for s,_ in pairs]},indent=2),encoding='utf-8')
print('Recomposition finalized; original directories retained in ignored local backups.')
