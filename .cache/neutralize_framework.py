from pathlib import Path
import json
import shutil
from recompose_framework import BASE, CORE, TERRAIN, RENDER

ARCHIVE=Path(__file__).resolve().parent/'body-neutralization'
def save(path):
    path=Path(path)
    if path.is_file():
        dst=ARCHIVE/'before'/path.relative_to(BASE)
        if not dst.exists():dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,dst)
def put(path,text):
    save(path);path.parent.mkdir(parents=True,exist_ok=True)
    assert '\u2014' not in text,path
    path.write_text(text,encoding='utf-8',newline='\n')
def edit(path,old,new):
    text=path.read_text(encoding='utf-8');assert old in text,(path,old[:70]);put(path,text.replace(old,new))
def retire(path):
    path=Path(path)
    if not path.exists():return
    assert path.resolve().is_relative_to(BASE) and path.resolve()!=BASE
    dst=ARCHIVE/'retired'/path.relative_to(BASE)
    assert dst.absolute().is_relative_to(ARCHIVE.absolute()) and not dst.exists()
    dst.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(path),str(dst))
def package(path,fn):
    data=json.loads(path.read_text());fn(data);put(path,json.dumps(data,indent=4)+'\n')

tiles=CORE/'node/packages/tiles'
# Keep the generic surface math, separating it from the removed cube projection.
reference=(tiles/'src/cube/reference-surface.ts').read_text()
reference=reference[:reference.index('\nconst CORNERS:')]
reference=reference.replace('import type { ITileAddress } from "../addressing/tile-address";\n','').replace('import { cubeTileDirection } from "./cube-mapping";\n','')
put(tiles/'src/surface/reference-surface.ts',reference)
put(tiles/'src/surface/index.ts','export * from "./reference-surface";\n')
retire(tiles/'src/cube')
retire(tiles/'src/reprojection/cube-resampling.ts')
edit(tiles/'src/index.ts','export * from "./cube";','export * from "./surface";')
edit(tiles/'src/reprojection/index.ts','export * from "./cube-resampling";\n','')
edit(tiles/'tsup.config.ts','"cube/index": "src/cube/index.ts",','"surface/index": "src/surface/index.ts",')
def exports(data):
    data['exports'].pop('./cube',None)
    data['exports']['./surface']={k:v.replace('/cube/','/surface/') for k,v in {'types':'./dist/cube/index.d.ts','import':'./dist/cube/index.js','default':'./dist/cube/index.js'}.items()}
    data['keywords']=[x for x in data['keywords'] if x not in ['cube-sphere','planetary']]
package(tiles/'package.json',exports)
for f in [*CORE.glob('node/packages/*/src/**/*.ts'),*TERRAIN.glob('packages/*/src/**/*.ts')]:
    text=f.read_text(encoding='utf-8')
    if '/cube/reference-surface' in text:put(f,text.replace('/cube/reference-surface','/surface/reference-surface'))

for path in [tiles/'tests/cube.test.ts',tiles/'tests/celestial-dataset.test.ts',tiles/'tests/reprojection.test.ts',TERRAIN/'packages/dem/tests/cube-dem.test.ts',TERRAIN/'packages/raster/tests/drape-instances-cube.test.ts']:
    retire(path)
for path in [tiles/'tests/fixtures',RENDER/'examples/babylon-implicit-grid-mapzen/scripts']:
    # The removed fixture directory holds the old source-specific WMTS captures.
    retire(path)
for f in (RENDER/'examples/babylon-implicit-grid-mapzen/public').glob('*'):
    if any(x in f.name.lower() for x in ['moon','shackleton','lunar']):retire(f)

dem=TERRAIN/'packages/dem'
f=dem/'src/pyramid/dem-pyramid.ts';text=f.read_text()
start=text.index('/**\n * Loader fetching and decoding the tiles of an elevation dataset')
end=text.index('export interface IDemPyramidOptions',start)
text=text[:start]+text[end:]
text=text.replace('CelestialTileSource, ','').replace('type DemEncoding, ','')
put(f,text)

# Providers are application/sample configuration, not elevation algorithms.
preset=(dem/'src/sources/presets.ts').read_text()
start=preset.index('/** Web tile source of elevation tiles')
end=preset.index('/** Options shared by the presets')
generic=preset[start:end]
put(dem/'src/sources/dem-tile-source.ts','import type { WebTileSource } from "@spacexr/tiles";\nimport type { DemEncoding } from "../codecs";\n\n'+generic)
preset=preset[:start]+preset[end:]
preset=preset.replace('import type { DemEncoding } from "../codecs";','import type { IDemTileSource } from "@spacexr/dem";\nimport { SAMPLE_SYSTEM } from "../../../shared/earth";')
preset=preset.replace('maxLOD: 15, tileSize: 256 })','maxLOD: 15, tileSize: 256 }, SAMPLE_SYSTEM)')
put(RENDER/'examples/babylon-implicit-grid-mapzen/src/providers/mapzen.ts',preset)
retire(dem/'src/sources/presets.ts')
edit(dem/'src/sources/index.ts','export * from "./presets";','export * from "./dem-tile-source";')
edit(dem/'src/sources/dem-tile-loader.ts','from "./presets"','from "./dem-tile-source"')
# Preserve provider checks with their demo, independently of the neutral DEM tests.
retire(dem/'tests/presets.test.ts')
put(dem/'tests/provider-fixture.ts','''import { GeodeticSystem } from "@spacexr/geodesy";
import { WebMercatorTileMetrics, WebTileSource, type ITileHttpClientOptions, type TileHttpClient } from "@spacexr/tiles";
import type { IDemTileSource } from "../src";

/** Explicit test-only provider, with no network access unless supplied by a test. */
export function createMapzenTerrariumSource(options: { client?: TileHttpClient | ITileHttpClientOptions } = {}): IDemTileSource {
    return { source: createMapzenNormalsSource(options), encoding: "terrarium" };
}
export function createMapzenNormalsSource(options: { client?: TileHttpClient | ITileHttpClientOptions } = {}): WebTileSource {
    return new WebTileSource({ id: "test-provider", urlTemplate: "https://fixture.invalid/{z}/{x}/{y}.png", metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 15, tileSize: 256 }, GeodeticSystem.WGS84), registration: "area", ...(options.client ? { client: options.client } : {}) });
}
''')
for f in (dem/'tests').glob('*.ts'):
    if f.name=='provider-fixture.ts':continue
    text=f.read_text()
    names=[name for name in ['createMapzenTerrariumSource','createMapzenNormalsSource'] if name in text]
    if names:
        for name in names:text=text.replace(name+', ','').replace(', '+name+' }',' }')
        # Restore references in function calls; only import specifiers were replaced above.
        text='import { '+', '.join(names)+' } from "./provider-fixture";\n'+text
        put(f,text)

# Body parameters must be supplied by the caller, normally composed from celestial-core.
edit(tiles/'src/addressing/metrics.ts','private readonly geodeticSystem = GeodeticSystem.WGS84','public readonly geodeticSystem: GeodeticSystem')
edit(tiles/'src/addressing/tile-surface.ts','private readonly system: GeodeticSystem = GeodeticSystem.WGS84','private readonly system: GeodeticSystem')
edit(tiles/'src/reprojection/source-tile-matrix.ts','semiMajorAxis = 6378137','semiMajorAxis: number')
edit(CORE/'node/packages/runtime/src/spatial/ecef-types.ts','geodeticSystem?: GeodeticSystem;','geodeticSystem: GeodeticSystem;')
edit(CORE/'node/packages/runtime/src/spatial/ecef.ts','options: IEcefSpatialMetricOptions = {}','options: IEcefSpatialMetricOptions')
edit(CORE/'node/packages/runtime/src/spatial/ecef.ts','options.geodeticSystem ?? GeodeticSystem.WGS84','options.geodeticSystem')
f=CORE/'node/packages/runtime/src/implicit/web-map.ts'
text=f.read_text();text='import type { GeodeticSystem } from "@spacexr/geodesy";\n'+text
text=text.replace('export interface IWebMapImplicitSourceOptions extends IImplicitTilesetDecoratorOptions, ITileUrlTemplateOptions {','export interface IWebMapImplicitSourceOptions extends IImplicitTilesetDecoratorOptions, ITileUrlTemplateOptions {\n    /** Required when legacy zoom options are used instead of explicit metrics. */\n    geodeticSystem?: GeodeticSystem;')
text=text.replace('...(options.tileSize !== undefined ? { tileSize: options.tileSize } : {}),\n        });','...(options.tileSize !== undefined ? { tileSize: options.tileSize } : {}),\n        }, options.geodeticSystem ?? (() => { throw new RangeError("A source requires an explicit geodetic system or metrics."); })());')
put(f,text)
for rel in ['terrain/terrain-tiling.ts','terrain/gpu/grid-shapes.ts','terrain/mesh/geodesic-grid-geometry.ts','camera/geospatial-camera.ts']:
    f=RENDER/'packages/core/src'/rel;text=f.read_text()
    text=text.replace('GeodeticSystem = GeodeticSystem.WGS84','GeodeticSystem')
    text=text.replace('geodeticSystem?: GeodeticSystem;','geodeticSystem: GeodeticSystem;').replace('options.geodeticSystem ?? GeodeticSystem.WGS84','options.geodeticSystem')
    if rel.endswith('terrain-tiling.ts'):text=text.replace('webMercatorSurfaceNormal(gradient, up, verticalScale)','webMercatorSurfaceNormal(gradient, up, verticalScale, system.ellipsoid.semiMajorAxis)')
    put(f,text)
edit(RENDER/'packages/core/src/terrain/terrain-tile.ts','regionCenter(region: readonly number[])','regionCenter(region: readonly number[], system: GeodeticSystem)')
edit(RENDER/'packages/core/src/terrain/terrain-tile.ts','GeodeticSystem.WGS84.geodeticRadiansToEcef','system.geodeticRadiansToEcef')
edit(dem/'src/pyramid/surface-normal.ts','semiMajorAxis = GeodeticSystem.WGS84.ellipsoid.semiMajorAxis','semiMajorAxis: number')

f=RENDER/'packages/core/src/terrain/grid-source.ts';text=f.read_text()
start=text.index('export const TILE_METRICS =');end=text.index('\nconst schema:',start)
text=text[:start]+text[end:]
text=text.replace('metrics?: WebMercatorTileMetrics;','metrics: WebMercatorTileMetrics;')
text=text.replace('prepared?: IPreparedHeights, options: IGridSourceOptions = {}','prepared: IPreparedHeights | undefined, options: IGridSourceOptions')
text=text.replace('options.metrics ?? TILE_METRICS','options.metrics')
text=text.replace('maxLOD, tileSize: metrics.tileSize });','maxLOD, tileSize: metrics.tileSize }, metrics.geodeticSystem);')
put(f,text)
edit(RENDER/'packages/core/src/terrain/terrain-engine.ts','tiling?: ITerrainTiling;','tiling: ITerrainTiling;')
edit(RENDER/'packages/core/src/terrain/mesh/geodesic-grid-pipeline.ts','tiling?: ITerrainTiling;','tiling: ITerrainTiling;')
edit(RENDER/'packages/core/src/terrain/mesh/geodesic-grid-pipeline.ts','options: IBabylonGeodesicGridPipelineOptions = {}','options: IBabylonGeodesicGridPipelineOptions')
edit(RENDER/'packages/core/src/terrain/mesh/geodesic-grid-pipeline.ts','options.tiling ?? webMercatorTiling()','options.tiling')
edit(RENDER/'packages/core/src/terrain/gpu/gpu-terrain-engine.ts','inputs.tiling ?? webMercatorTiling()','inputs.tiling')
edit(RENDER/'packages/core/src/terrain/gpu/elevation-pages.ts','private readonly tiling: ITerrainTiling = webMercatorTiling()','private readonly tiling: ITerrainTiling')
edit(RENDER/'packages/core/src/terrain/mesh/mesh-terrain-engine.ts','...(inputs.tiling ? { tiling: inputs.tiling } : {}),','tiling: inputs.tiling,')

# Earth is explicit demonstration data, not a fallback embedded in any public package.
put(RENDER/'examples/shared/earth.ts','''import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";

/** Offline Earth demonstration fixture, matching the celestial-core Earth ellipsoid. */
export const SAMPLE_SYSTEM = new GeodeticSystem(Ellipsoid.fromAxes("Earth demo fixture", 6378137, 6356752.314245179));
''')
# The helper is source shared by demos only, with no public runtime package.
for example in ['babylon-implicit-grid-mapzen','babylon-google-3d-tiles']:
    f=RENDER/'examples'/example/'src/main.ts';text=f.read_text()
    text='import { SAMPLE_SYSTEM } from "../../shared/earth";\n'+text
    if example=='babylon-implicit-grid-mapzen':
        text=text.replace('    TILE_METRICS,\n','')
        text=text.replace('    createMapzenTerrariumSource,\n','').replace('    createMapzenNormalsSource,\n','')
        text='import { createMapzenTerrariumSource, createMapzenNormalsSource } from "./providers/mapzen";\n'+text
        text='import { webMercatorTiling } from "@spacexr/3d-tiles-babylon";\n'+text
        # Existing demo-specific terrain configuration stays in the demo.
        text='const TILE_METRICS = new WebMercatorTileMetrics({ minLOD: TERRAIN_CONFIG.mercator.minLOD, maxLOD: TERRAIN_CONFIG.mercator.maxLOD, tileSize: TERRAIN_CONFIG.grid.cells }, SAMPLE_SYSTEM);\n\n'+text
        text=text.replace('const terrainInputs: ITerrainEngineInputs = {','const terrainInputs: ITerrainEngineInputs = {\n        tiling: webMercatorTiling(SAMPLE_SYSTEM),')
    put(f,text)

# Remove body applications from framework workspaces; retain the standalone demo roots.
for f in RENDER.glob('*.code-workspace'):
    data=json.loads(f.read_text());allowed={'3D Tiles','Terrain','Rendering','Geodesy'}
    data['folders']=[x for x in data['folders'] if x['name'] in allowed]
    data['tasks']['tasks']=[x for x in data['tasks']['tasks'] if not x['label'].startswith(('Explorer:','Tile Service:'))]
    put(f,json.dumps(data,indent=4)+'\n')
print('Removed active cube modules and lunar sample tools; physical configuration is now explicit.')
