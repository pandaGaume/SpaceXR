from pathlib import Path
base=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=base/'packages/babylon-earth/src/atmosphere/babylon-sky.ts';s=f.read_text(encoding='utf-8');s=s.replace('''            if (!samePosition(this.motionBuilding)) {
                this.motionSky.update(current);
                this.motionSky.encode(encoder, 4096);
                this.motionBuilding = current;
            }
''','');s=s.replace('let active = this.motionReady ? this.motionSky : undefined;','let active = this.motionReady && samePosition(this.motionBuilding) ? this.motionSky : undefined;');f.write_text(s,encoding='utf-8',newline='\n')
f=base/'examples/babylon-implicit-grid-mapzen/src/providers/mapzen.ts';s=f.read_text(encoding='utf-8');s=s.replace('import { SAMPLE_SYSTEM }','import type { GeodeticSystem } from "@spacexr/geodesy";\nimport { SAMPLE_SYSTEM }').replace('export interface IPresetOptions {','export interface IPresetOptions {\n    /** Explicit surface for body compositions; the standalone sample uses its demo fixture by default. */\n    geodeticSystem?: GeodeticSystem;').replace('                SAMPLE_SYSTEM,','                options.geodeticSystem ?? SAMPLE_SYSTEM,').replace('            SAMPLE_SYSTEM,','            options.geodeticSystem ?? SAMPLE_SYSTEM,');f.write_text(s,encoding='utf-8',newline='\n')
f=base/'packages/babylon-earth/src/earth-runtime.ts';s=f.read_text(encoding='utf-8').replace('    type IGridElevationOptions,','    type IGridElevationOptions,\n    type IPreparedHeights,').replace('        elevation?: IGridElevationOptions;','        elevation?: IGridElevationOptions;\n        /** Child DEM height ranges prepared by the existing terrain chain. */\n        preparedHeights?: IPreparedHeights;').replace('createGeodesicGridSource(undefined,','createGeodesicGridSource(config.preparedHeights,');f.write_text(s,encoding='utf-8',newline='\n')
f=base/'examples/babylon-earth/src/main.ts';s=f.read_text(encoding='utf-8')
s=s.replace('createGeospatialScene }','createGeospatialScene, TERRAIN_CONFIG }')
s=s.replace('DemPyramid, WorkerDemDecoder','DemPyramid, ChildHeightRanges, WorkerDemDecoder')
s=s.replace('import { WebTileSource, WebMercatorTileMetrics } from "@spacexr/tiles";','import { createMapzenTerrariumSource } from "../../babylon-implicit-grid-mapzen/src/providers/mapzen";')
s=s.replace('        const imagery = await demoImagery();\n','')
start=s.index('        const dem = demEnabled');end=s.index('        const terrainView',start)
s=s[:start]+'''        const mapzen=demEnabled ? createMapzenTerrariumSource({geodeticSystem:EARTH_SYSTEM}):undefined;
        const childHeightRanges=new ChildHeightRanges();
        const dem=mapzen ? new DemPyramid({
            load:webDemTileLoader(mapzen,decoder!),
            maxLOD:mapzen.source.metrics.maxLOD, registration:mapzen.source.registration,
            wrapX:true,cacheEntries:TERRAIN_CONFIG.dem.cacheEntries,
            abortDelayMilliseconds:TERRAIN_CONFIG.dem.abortDelayMilliseconds,
            generation:{maxLOD:mapzen.source.metrics.maxLOD+TERRAIN_CONFIG.dem.generatedLevels,interpolation:TERRAIN_CONFIG.dem.interpolation},
            childHeightRanges,
        }):undefined;
        const imagery=inside ? undefined : await demoImagery();
        const sse=Number(query.get("sse") ?? 20);
'''+s[end:]
s=s.replace('''            terrain: {
                imagery,
                ...(dem ? { elevation: { pyramid: dem } } : {}),
            },''','''            terrain: {
                cells:TERRAIN_CONFIG.grid.cells, minLOD:TERRAIN_CONFIG.mercator.minLOD,maxLOD:TERRAIN_CONFIG.mercator.maxLOD,
                screenSpaceError:sse,
                ...(imagery ? {imagery}:{}),
                ...(dem ? {elevation:{pyramid:dem},preparedHeights:{ranges:childHeightRanges,verticalScale:()=>1}}:{}),
            },''')
s=s.replace('`${renderer} | ${resources.presented} tuiles implicites | ${Math.round(engine.getFps())} FPS`','`${renderer} | SSE ${sse} px | ${resources.presented} tuiles implicites | ${Math.round(engine.getFps())} FPS`')
f.write_text(s,encoding='utf-8',newline='\n')
print('Reused the existing Mapzen source, pyramid settings, prepared ranges and grid engine. Sample SSE = 20px.')
