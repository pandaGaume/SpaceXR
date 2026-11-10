from pathlib import Path
import sys,json,re
sys.path.insert(0,str(Path(__file__).parent))
s=Path(__file__).with_name('neutralize_framework.py').read_text()
exec(s[:s.index('tiles=CORE')],globals())

for root in [CORE/'node/packages/tiles/src',CORE/'node/packages/runtime/src',TERRAIN/'packages/raster/src',TERRAIN/'packages/dem/src',RENDER/'packages/core/src']:
    for f in root.rglob('*'):
        if f.suffix not in ['.ts','.glsl','.wgsl']:continue
        if f.suffix=='.ts' and f.name.endswith(('.vertex.ts','.fragment.ts')):continue
        t=f.read_text();before=t
        t=t.replace('the legacy cube path','the alternate instanced path').replace('across cube faces','across configured local frames').replace('of a cube face','of a root')
        t=t.replace('3 at the vertices of the cube','as provided by the topology')
        t=t.replace('the cube index and in stitched rasters','shared-edge sources and stitched rasters')
        t=t.replace('the directions of a multi-root pyramid go through it','unit directions go through it')
        t=t.replace('directions of a multi-root pyramid go through it','unit directions go through it')
        t=t.replace('on a sphere, as in a spherical reference, latitudes are planetocentric','on a sphere, latitudes are planetocentric')
        if 'wmts-capabilities.ts' in f.name:
            t=t.replace('degrees on the Earth (about 111 195 m) on geographic layers, whatever the body, and is 0.64 % off on the polar layers of\n * Mars, whose tiles only line up with the pixel size above. It is only used when the origin is 0.','source-specific unit assumptions on geographic layers. Geometry-derived pixel size is preferred; the scale is used only when the origin is 0.')
        if t!=before:put(f,t)
for path in [CORE/'docs/celestial-tiling.md',CORE/'docs/cube-sources.md',RENDER/'docs/terrain-tests',RENDER/'docs/terrain-test-log.md',RENDER/'docs/terrain-review.md']:
    retire(path)

put(RENDER/'docs/architecture.md','''# Framework layers and body compositions

## Generic foundation

`3d-tiles-core` owns wire contracts, tile addressing, generic surface mathematics and the single 3D Tiles runtime. `terrain-core` owns raster and DEM data, grid geometry and sampling. `spacexr-rendering/packages/core` owns the existing Babylon integration. The current generic framework has no cube projection, body catalogue, lunar production tools, provider URL presets or implicit Earth selection.

The application supplies a `GeodeticSystem`, surface/tiling and source metrics. Geometry uses these inputs without selecting a body. Datum transformations, geoid models or fallback height envelopes must also be explicit. Geodetic coordinate/CRS definitions remain mathematical and wire-format contracts, separate from a body's physical catalogue.

## Physical characteristics

`spacexr-celestial`, currently `@spacexr/celestial-core` in the local `celestial-core` repository, owns body characteristics. A composition obtains the body's ellipsoid and other physical parameters there and passes the required numerical objects to the framework. Generic packages do not import its catalogue. Demonstration fixtures can carry explicit body data; their values are examples, not library defaults.

## Babylon Earth library

The proposed Earth-specific library belongs in `spacexr-rendering/packages/babylon-earth`, published as `@spacexr/babylon-earth` once implemented and qualified. It is an optional composition above the generic Babylon terrain and atmosphere integrations. No empty package has been created in this cleanup.

Its responsibility is to assemble the Earth descriptor from Celestial, explicit terrain/imagery sources, the existing 3D Tiles runtime, camera setup and an atmospheric rendering integration. A proposed asynchronous `createEarthRuntime(scene, options)` returns an application facade with frame/update, configuration and disposal operations. It uses the supplied scene and engine, and owns only the resources and subscriptions it creates.

The facade orchestrates the existing tile runtime; it does not introduce another tile selector. The generic atmospheric integration should live in a future `@spacexr/babylon-atmosphere` package or an internal module until stable. Atmospheric physical parameters belong to the physical model; the Earth facade chooses and wires them without duplicating their definitions.

The current `@spacexr/atmosphere` numerical model and WebGPU backend are existing foundations to integrate. Their mapping to Celestial and Babylon's engine/device, depth, coordinate origins and frame scheduling still require implementation. WebGL support and fallback quality must be stated explicitly; this document does not announce that Earth/atmosphere API as available.

Other body-specific compositions can follow later with the same ports. Body-specific data preparation stays outside the generic framework. The immediate deliverable remains the working standalone 3D Tiles and terrain demonstrations.
''')
put(RENDER/'docs/terrain-pipeline.md','''# Generic terrain pipeline

The application supplies source metrics and a surface tiling. The shared 3D Tiles runtime selects and streams tiles; the raster and DEM pyramids provide data; the CPU or GPU Babylon terrain engine presents the selected contents. There is one runtime implementation.

The active projection is Web Mercator parameterized by the supplied geodetic system. Grid resolution, source resolution and selected tile LOD remain separate inputs. Cube implementations and body-specific producers have been removed from this delivery.

Provider URLs, source availability and demonstration locations live in samples. Physical body characteristics are provided by `spacexr-celestial` through a body composition, not inferred by the generic terrain engine. See [architecture](architecture.md), [terrain settings](terrain-settings.md) and the [consumer guide](consume-framework.md).
''')

for root in [CORE,TERRAIN,RENDER]:
    f=root/'AGENTS.md';t=f.read_text()
    t+='\n## Body-neutral framework\n\nCube implementations, body-specific production tools and provider presets do not belong to the active generic packages. Physical surface and geodetic parameters are explicit inputs, supplied by an application or a body composition using spacexr-celestial. Body-specific constants are permitted in demonstration fixtures. Earth/Babylon/atmosphere composition belongs in the optional future babylon-earth package; do not create empty future packages.\n'
    put(f,t)

for f in RENDER.glob('*.code-workspace'):
    data=json.loads(f.read_text())
    if f.name=='SpaceXR-Applications.code-workspace':
        data['folders'] += [{'name':'3D Tiles sample','path':'examples/babylon-google-3d-tiles'},{'name':'Terrain sample','path':'examples/babylon-implicit-grid-mapzen'}]
    put(f,json.dumps(data,indent=4)+'\n')
for f in [CORE/'README.md',TERRAIN/'README.md',RENDER/'README.md']:
    t=f.read_text()
    # Replace obsolete ownership links to documents removed with the cube scope.
    t='\n'.join(line for line in t.splitlines() if not any(x in line for x in ['docs/celestial-tiling.md','docs/cube-sources.md']))+'\n'
    t=t.replace('addresses, cube/Mercator topology','addresses, configurable topology').replace('Addresses, cube/Mercator topology','Addresses, configurable topology')
    t=t.replace('Generic tiles](docs/tiles.md)','Generic tiles](docs/tiles.md)')
    t=t.replace('to include Explorer, Celestial, Quantia and the tile service','to include the reference demonstrations')
    t+='\nThe generic libraries require explicit physical and geodetic inputs. Provider presets are confined to samples. The cube and lunar tools are outside this delivery. See the [layering and planned Earth integration](../spacexr-rendering/docs/architecture.md).\n'
    put(f,t)

# Remove the body-specific scope from package metadata and keep the supported data formats.
def desc(data):
    data['description']='Renderer-neutral digital elevation models: configurable sources, raster codecs, sampling, worker decoding, statistics, normals and continuous multi-level surfaces.'
    data['keywords']=[x for x in data.get('keywords',[]) if x not in ['mapzen','planetary']]
package(TERRAIN/'packages/dem/package.json',desc)

for repo in [CORE,TERRAIN,RENDER]:
    for f in (repo/'docs').glob('*.md'):
        t=f.read_text();before=t
        # Preserve links by directing retired cube documents to the active scope explanation.
        t=re.sub(r'\]\((?:\.\./)*?(?:celestial-tiling|cube-sources|terrain-test-log|terrain-review)\.md(?:#[^)]*)?\)','](../../spacexr-rendering/docs/architecture.md)',t)
        if t!=before:put(f,t)
print('Documented generic inputs, Celestial ownership and the optional Babylon Earth composition.')
