from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
source=Path(__file__).with_name('neutralize_framework.py').read_text()
exec(source[:source.index('tiles=CORE')],globals())
tiles=CORE/'node/packages/tiles'
old=ARCHIVE/'retired/3d-tiles-core/node/packages/tiles/src/cube'
t=(old/'cube-neighbors.ts').read_text()
start=t.index('export function turnTileEdge');end=t.index('\nconst { N, E, S, W }',start)
put(tiles/'src/addressing/tile-edge-rotation.ts','''import { TileNeighbor, type TileEdgeNeighbor } from "./tile-neighbors";
const EDGE_ORDER: readonly TileEdgeNeighbor[] = [TileNeighbor.N, TileNeighbor.E, TileNeighbor.S, TileNeighbor.W];
/** Rotate a tile edge in quarter turns within its local frame. */
'''+t[start:end])
edit(tiles/'src/addressing/index.ts','export * from "./tile-topology";','export * from "./tile-topology";\nexport * from "./tile-edge-rotation";')
t=(old/'cube-mapping.ts').read_text();t=t[t.index('export function planetocentricDirection'):]
put(tiles/'src/surface/directions.ts','''import type { ICartesian3 } from "@spacexr/geodesy";
import type { IGeographic2 } from "../addressing/metrics";
const DEGREES = 180 / Math.PI;
/** Unit Cartesian direction from planetocentric angles in degrees. */
'''+t)
edit(tiles/'src/surface/index.ts','export * from "./reference-surface";','export * from "./reference-surface";\nexport * from "./directions";')
retire(TERRAIN/'packages/grid/tests/grid-tile-geometry.test.ts')
put(TERRAIN/'packages/grid/tests/grid-surface.test.ts','''import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { WebMercatorTileSurface } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";
import { buildGridTileGeometry, buildGridTileShape, createGridTopology } from "../src";

describe("grids on an application-supplied surface", () => {
    const surface = new WebMercatorTileSurface(new GeodeticSystem(Ellipsoid.sphere("fixture", 1000)));
    const address = { lod: 3, x: 4, y: 3 };
    it("keeps local geometry and its frame consistent", () => {
        const geometry = buildGridTileGeometry(createGridTopology(4), address, surface);
        const expected = surface.point(address, 0, 0);
        expect(geometry.center.x + geometry.positions[0]!).toBeCloseTo(expected.x, 3);
        expect(geometry.center.y + geometry.positions[1]!).toBeCloseTo(expected.y, 3);
        expect(geometry.center.z + geometry.positions[2]!).toBeCloseTo(expected.z, 3);
        expect(Math.hypot(...geometry.ups.slice(0, 3))).toBeCloseTo(1);
    });
    it("derives reusable shapes from the same supplied surface", () => {
        const shape = buildGridTileShape(address, surface, 4);
        expect(shape.positions.length).toBe(25 * 3);
        expect(shape.center).toEqual(surface.point(address, 0.5, 0.5));
    });
});
''')
f=RENDER/'packages/core/tests/geodesic-grid-pipeline.test.ts';t=f.read_text();marker='// The same address on another face'
if marker in t:t=t[:t.index(marker)]
put(f,t)
# The provider's original tests travel with its sample implementation.
t=(ARCHIVE/'retired/terrain-core/packages/dem/tests/presets.test.ts').read_text()
t=t.replace('from "../src"','from "../src/providers/mapzen"')
put(RENDER/'examples/babylon-implicit-grid-mapzen/tests/providers.test.ts',t)
f=RENDER/'examples/babylon-implicit-grid-mapzen/package.json'
def cfg(data):
    data['scripts']['test']='vitest run --coverage.enabled=false'
    data['devDependencies']['vitest']='4.1.12'
package(f,cfg)
put(RENDER/'examples/babylon-implicit-grid-mapzen/vitest.config.ts','''import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
''')
for root in [CORE/'node/packages/runtime/tests',RENDER/'packages/core/tests']:
    for f in root.glob('*.ts'):
        t=f.read_text();before=t
        for a,b in [('MOON','FIXTURE_SPHERE'),('MARS','FIXTURE_ELLIPSOID'),('moon','fixtureSystem'),('"Moon"','"fixture sphere"'),('Moon','synthetic sphere'),('Mars','synthetic ellipsoid'),('cube shapes','precomputed shapes')]:t=t.replace(a,b)
        if t!=before:put(f,t)
print('Retained generic frame and edge mathematics outside cube modules.')
