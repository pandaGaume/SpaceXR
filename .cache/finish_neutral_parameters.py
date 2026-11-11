from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
source=Path(__file__).with_name('neutralize_framework.py').read_text()
exec(source[:source.index('tiles=CORE')],globals())
tiles=CORE/'node/packages/tiles'
f=tiles/'src/reprojection/source-projection.ts';t=f.read_text()
t=t.replace('semiMajorAxis?: number;','semiMajorAxis: number;').replace('constructor(options: IWebMercatorProjectionOptions = {})','constructor(options: IWebMercatorProjectionOptions)')
t=t.replace('options.semiMajorAxis ?? 6378137','options.semiMajorAxis').replace('options.semiMinorAxis ?? 6356752.314245179','options.semiMinorAxis ?? options.semiMajorAxis')
t=t.replace('this.radius = options.semiMajorAxis;','this.radius = options.semiMajorAxis;\n        if (!(this.radius > 0) || !Number.isFinite(this.radius)) throw new RangeError("A projection requires a positive finite radius.");')
put(f,t)

# Datum, geoid and terrain envelopes are supplied by a composition, not guessed from Earth.
f=CORE/'node/packages/runtime/src/spatial/utm-types.ts';t=f.read_text()
t=t.replace('IGeodeticCoordinates }','IGeodeticCoordinates, Ellipsoid }')
t=t.replace('readonly accuracy: number;','readonly accuracy: number;\n    /** Source CRS ellipsoid; defaults to the supplied target system ellipsoid. */\n    readonly sourceEllipsoid?: Ellipsoid;')
t=t.replace('datumResolver?: HorizontalDatumResolver;','datumResolver?: HorizontalDatumResolver;\n    /** Explicit vertical uncertainty in metres when no geoid model is supplied. */\n    geoidUndulationMargin?: number;\n    /** Explicit height envelope when the vertical origin is unknown. */\n    unknownGroundHeightRange?: readonly [number, number];')
t=t.replace('Defaults to {@link defaultHorizontalDatumResolver}, which targets WGS 84.','Without a resolver, the datum remains unresolved.')
t=t.replace('Without it, {@link GEOID_UNDULATION_MARGIN} is applied.','Without it, an explicit geoidUndulationMargin is required.')
t=t.replace('{@link UNKNOWN_GROUND_HEIGHT_RANGE} was assumed.','the caller supplied a height envelope.')
put(f,t)
f=CORE/'node/packages/runtime/src/spatial/utm-bounds.ts';t=f.read_text()
start=t.index('/**\n * Margin in metres');end=t.index('interface IVerticalModel',start)
t=t[:start]+'''/** Horizontal sample count per axis. */
const SAMPLES_PER_AXIS = 3;

/** No datum transformation is assumed without an application policy. */
export function defaultHorizontalDatumResolver(_projection: IUtmProjection): IHorizontalDatumTransformation | undefined {
    return undefined;
}

function explicitGeoidMargin(options: IUtmPlacementOptions): number {
    const margin = options.geoidUndulationMargin;
    if (margin === undefined || !Number.isFinite(margin) || margin < 0) throw new RangeError("An explicit nonnegative geoid margin or geoid model is required.");
    return margin;
}

'''+t[end:]
t=t.replace('function verticalModel(vertical: IVerticalExtent)','function verticalModel(vertical: IVerticalExtent, options: IUtmPlacementOptions)')
t=t.replace('range: [UNKNOWN_GROUND_HEIGHT_RANGE[0] + lower, UNKNOWN_GROUND_HEIGHT_RANGE[1] + upper],','range: (() => {\n            const range = options.unknownGroundHeightRange;\n            if (!range || !range.every(Number.isFinite) || range[0] > range[1]) throw new RangeError("An explicit valid terrain height envelope is required.");\n            return [range[0] + lower, range[1] + upper];\n        })(),')
t=t.replace('ellipsoidalHeightRange(vertical: IVerticalExtent)','ellipsoidalHeightRange(vertical: IVerticalExtent, options: IUtmPlacementOptions)')
t=t.replace('verticalModel(vertical);','verticalModel(vertical, options);').replace('verticalModel(extent.vertical);','verticalModel(extent.vertical, options);')
t=t.replace('model.range[0] - GEOID_UNDULATION_MARGIN, model.range[1] + GEOID_UNDULATION_MARGIN','model.range[0] - explicitGeoidMargin(options), model.range[1] + explicitGeoidMargin(options)')
t=t.replace('geoid === "margin" ? GEOID_UNDULATION_MARGIN : 0','geoid === "margin" ? explicitGeoidMargin(options) : 0')
t=t.replace('(projection.datum === undefined ? undefined : DATUM_ELLIPSOIDS.get(projection.datum)) ?? system.ellipsoid','datumTransformation.sourceEllipsoid ?? system.ellipsoid')
t=t.replace('Orthometric and ground-anchored values are widened by {@link GEOID_UNDULATION_MARGIN}. Ground values','Orthometric and ground-anchored values use the caller-supplied margin. Ground values').replace('without `groundElevation` and `LOCAL` values use {@link UNKNOWN_GROUND_HEIGHT_RANGE}.','without `groundElevation` and `LOCAL` values require an explicit height envelope.')
put(f,t)
retire(CORE/'node/packages/runtime/tests/utm-spatial.test.ts')
put(CORE/'node/packages/runtime/tests/explicit-surface.test.ts','''import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";
import { EcefSpatialMetric, ellipsoidalHeightRange, defaultHorizontalDatumResolver } from "../src";

describe("application-owned physical parameters", () => {
    it("places the same angular region on the supplied surface", () => {
        const make = (radius: number) => new EcefSpatialMetric({ geodeticSystem: new GeodeticSystem(Ellipsoid.sphere("fixture", radius)), horizonCulling: false }).derive({ tile: { boundingVolume: { region: [-0.01, -0.01, 0.01, 0.01, 0, 0] }, geometricError: 1 } });
        const small = make(1000).boundingSphere!;
        const large = make(2000).boundingSphere!;
        expect(large.center.x).toBeCloseTo(2 * small.center.x);
        expect(large.radius).toBeCloseTo(2 * small.radius);
    });
    it("does not select a datum or a geoid envelope", () => {
        expect(defaultHorizontalDatumResolver({ zone: 1, hemisphere: "north" } as never)).toBeUndefined();
        const vertical = { reference: "GEOID", direction: "UP", minimum: 10, maximum: 20 } as const;
        expect(() => ellipsoidalHeightRange(vertical, {})).toThrow(/explicit/);
        expect(ellipsoidalHeightRange(vertical, { geoidUndulationMargin: 3 })).toEqual([7, 23]);
    });
});
''')
put(tiles/'tests/explicit-surface.test.ts','''import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";
import { WebMercatorTileMetrics, WebMercatorTileSurface, WebMercatorProjection, ReferenceSurface } from "../src";

describe("parameterized reference surfaces", () => {
    it("uses the caller radii for projection, metrics and geometry", () => {
        const system = new GeodeticSystem(Ellipsoid.sphere("fixture", 1000));
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 4, tileSize: 1 }, system);
        expect(metrics.groundResolution(0, 0)).toBeCloseTo(2 * Math.PI * 1000);
        expect(new WebMercatorTileSurface(system).point({ lod: 0, x: 0, y: 0 }, 0.5, 0.5).x).toBeCloseTo(1000);
        const projection = new WebMercatorProjection({ semiMajorAxis: 1000 });
        expect(projection.forward({ x: 0, y: 1, z: 0 }).x).toBeCloseTo(Math.PI * 500);
        expect(ReferenceSurface.sphere(1000).radius({ x: 1, y: 0, z: 0 })).toBe(1000);
    });
});
''')

# Keep generic pixel decoding tests; provider-specific expectations belong to the sample.
f=TERRAIN/'packages/dem/tests/mapzen-normals.test.ts';t=f.read_text()
t=t.replace('expect(source.id).toBe("mapzen-normals")','expect(source.id).toBe("test-provider")').replace('https://s3.amazonaws.com/elevation-tiles-prod/normal/15/17008/11679.png','https://fixture.invalid/15/17008/11679.png')
put(f,t)

# Remove obsolete cube/body-specific wording from active contracts and shader sources.
replacements={
 'Defaults to Web Mercator on WGS84.':'Supplied explicitly by the caller.',
 'Defaults to WGS84.':'Supplied explicitly by the caller.',
 'Defaults to the WGS84 semi-major axis of EPSG:3857.':'Supplied explicitly in metres.',
 'on the cube index':'within the pyramid root',
 'the cube index':'a multi-root pyramid',
 'across cube faces included':'across the configured topology',
 'across the faces of a multi-root pyramid':'across configured roots',
 'cubeTileNeighbor':'the supplied topology',
 'Moon Trek':'A provider',
 '`GCS_Moon_2000`':'a spherical reference',
}
roots=[CORE/'node/packages/tiles/src',CORE/'node/packages/runtime/src',TERRAIN/'packages/raster/src',TERRAIN/'packages/dem/src',RENDER/'packages/core/src']
for root in roots:
    for f in root.rglob('*'):
        if f.suffix not in ['.ts','.glsl','.wgsl']:continue
        if f.suffix=='.ts' and f.name.endswith(('.vertex.ts','.fragment.ts')):continue
        t=f.read_text(encoding='utf-8');before=t
        for old,new in replacements.items():t=t.replace(old,new)
        t=t.replace('The legacy draped path, retained for the deferred cube adaptation,','The alternate draped path,')
        t=t.replace('across a cube face.','across a configured root boundary.')
        t=t.replace('Face of the point within the pyramid root','Root of the point in the pyramid')
        t=t.replace('On WGS84 the two differ by up to 0.19 degrees.','The difference depends on the supplied ellipsoid.')
        t=t.replace('on the edges of a cube face','at the edges of a root')
        if t!=before:put(f,t)
print('Physical defaults and datum assumptions removed; neutral-surface regressions added.')
