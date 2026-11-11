import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Ellipsoid, GeodeticSystem, type ICartesian3 } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import {
    CUBE_FACE_EDGES,
    CUBE_TILE_TOPOLOGY,
    CubeFace,
    GeographicProjection,
    PolarStereographicProjection,
    ReferenceSurface,
    TILE_EDGE_NEIGHBORS,
    TileNeighbor,
    WebMercatorProjection,
    capBlendWeight,
    cubeSourceMatrix,
    cubeTileDirection,
    cubeTileSourceTiles,
    geodeticOfDirection,
    geographicTileMatrix,
    parseWmtsCapabilities,
    planetocentricDirection,
    rebaseRadialHeight,
    resampleCubeTile,
    sourcePixelAt,
    sourcePixelCoordinates,
    webMercatorTileMatrix,
    wmtsTileUrl,
    type ISourceProjection,
} from "../src";

const MOON_RADIUS = 1737400;
const fixture = (name: string): string => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
const distance = (a: ICartesian3, b: ICartesian3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const MOON_GEOGRAPHIC = new GeographicProjection({ semiMajorAxis: MOON_RADIUS });
const MOON_SOUTH = new PolarStereographicProjection({ pole: "south", radius: MOON_RADIUS });

describe("source projections", () => {
    it.each<[string, ISourceProjection]>([
        ["Moon geographic", MOON_GEOGRAPHIC],
        ["Moon south polar", MOON_SOUTH],
        ["Moon north polar", new PolarStereographicProjection({ pole: "north", radius: MOON_RADIUS })],
        [
            "polar with a meridian and false origin",
            new PolarStereographicProjection({ pole: "south", radius: MOON_RADIUS, centralMeridianDegrees: 40, falseEasting: 1000, falseNorthing: -500 }),
        ],
        ["WGS84 geographic", new GeographicProjection({ semiMajorAxis: 6378137, semiMinorAxis: 6356752.314245179 })],
        ["Web Mercator", new WebMercatorProjection()],
    ])("round-trips directions in %s", (_name, projection) => {
        for (const [latitude, longitude] of [
            [0, 0],
            [30, 40],
            [-45, -120],
            [60, 170],
            [-5, 179],
        ] as const) {
            const direction = planetocentricDirection(latitude, longitude);
            const { x, y } = projection.forward(direction);
            expect(distance(projection.inverse(x, y), direction)).toBeLessThan(1e-9);
        }
    });

    it("matches the polar stereographic formulas of Snyder, to the pole", () => {
        for (const [latitude, longitude] of [
            [-60, 90],
            [-87.5, 30],
            [-89.9, -120],
            [-75, 180],
        ] as const) {
            const lat = (latitude * Math.PI) / 180;
            const lon = (longitude * Math.PI) / 180;
            const rho = 2 * MOON_RADIUS * Math.tan(Math.PI / 4 + lat / 2);
            const map = MOON_SOUTH.forward(planetocentricDirection(latitude, longitude));
            expect(map.x).toBeCloseTo(rho * Math.sin(lon), 5);
            expect(map.y).toBeCloseTo(rho * Math.cos(lon), 5);
        }
        expect(MOON_SOUTH.forward({ x: 0, y: 0, z: -1 })).toEqual({ x: 0, y: 0 });
        const north = new PolarStereographicProjection({ pole: "north", radius: MOON_RADIUS }).forward(planetocentricDirection(60, 0));
        expect(north.x).toBeCloseTo(0, 6);
        expect(north.y).toBeCloseTo(-2 * MOON_RADIUS * Math.tan(Math.PI / 12), 5);
    });

    it("turns a polar map by its central meridian", () => {
        const turned = new PolarStereographicProjection({ pole: "south", radius: MOON_RADIUS, centralMeridianDegrees: 90 });
        const map = turned.forward(planetocentricDirection(-60, 90));
        expect(map.x).toBeCloseTo(0, 6);
        expect(map.y).toBeGreaterThan(0);
    });

    it("gives planetocentric latitudes on a sphere and geodetic ones on WGS84", () => {
        const direction = planetocentricDirection(45, 10);
        expect(MOON_GEOGRAPHIC.forward(direction).y).toBeCloseTo(45, 10);
        expect(MOON_GEOGRAPHIC.forward(direction).x).toBeCloseTo(10, 10);

        const system = GeodeticSystem.WGS84;
        const { semiMajorAxis: a, semiMinorAxis: b } = Ellipsoid.WGS84;
        const point = ReferenceSurface.fromEllipsoid(Ellipsoid.WGS84).point(direction);
        const expected = (system.ecefToGeodeticRadians(point).latitude * 180) / Math.PI;
        expect(new GeographicProjection({ semiMajorAxis: a, semiMinorAxis: b }).forward(direction).y).toBeCloseTo(expected, 9);
        expect(geodeticOfDirection(direction, a, b).latitude).toBeCloseTo(expected, 9);
        // About 0.19 degrees at 45 degrees on WGS84.
        expect(expected - 45).toBeGreaterThan(0.19);
    });

    it("places EPSG:3857 tiles as the XYZ scheme does, geodetic latitudes included", () => {
        const { semiMajorAxis: a, semiMinorAxis: b } = Ellipsoid.WGS84;
        const mercator = new WebMercatorProjection();
        const direction = planetocentricDirection(45, 6.5);
        const { latitude, longitude } = geodeticOfDirection(direction, a, b);
        const map = mercator.forward(direction);
        // The XYZ column and row of a geodetic position, from the Web Mercator metrics formula.
        const u = (longitude + 180) / 360;
        const v = 0.5 - Math.log((1 + Math.sin((latitude * Math.PI) / 180)) / (1 - Math.sin((latitude * Math.PI) / 180))) / (4 * Math.PI);
        const pixel = sourcePixelCoordinates(webMercatorTileMatrix(3), map);
        expect((pixel.x + 0.5) / (8 * 256)).toBeCloseTo(u, 10);
        expect((pixel.y + 0.5) / (8 * 256)).toBeCloseTo(v, 10);
    });

    it("refuses a matrix that does not declare its registration", () => {
        const undeclared = { ...webMercatorTileMatrix(3), registration: undefined };
        expect(() => sourcePixelCoordinates(undeclared as never, { x: 0, y: 0 })).toThrow(TypeError);
    });

    it("leaves the caps out of Web Mercator matrices", () => {
        const mercator = new WebMercatorProjection();
        const matrix = webMercatorTileMatrix(2);
        const pixel = sourcePixelCoordinates(matrix, mercator.forward(planetocentricDirection(89, 0)));
        expect(sourcePixelAt(matrix, pixel.x, pixel.y)).toBeUndefined();
        const pole = sourcePixelCoordinates(matrix, mercator.forward({ x: 0, y: 0, z: 1 }));
        expect(sourcePixelAt(matrix, pole.x, pole.y)).toBeUndefined();
    });

    it("rejects invalid radii", () => {
        expect(() => new GeographicProjection({ semiMajorAxis: 0 })).toThrow(RangeError);
        expect(() => new PolarStereographicProjection({ pole: "south", radius: -1 })).toThrow(RangeError);
    });
});

describe("WMTS capabilities", () => {
    it("reads a real Moon Trek geographic layer, ignoring its commented matrices", () => {
        const layer = parseWmtsCapabilities(fixture("trek-eq-wac.xml"));
        expect(layer.identifier).toBe("LRO_WAC_Mosaic_Global_303ppd_v02");
        expect(layer.crs).toBe("urn:ogc:def:crs:EPSG::104903");
        expect(layer.format).toBe("image/jpeg");
        expect(layer.boundingBox).toEqual([-180, -90, 180, 90]);
        expect(layer.matrices).toHaveLength(9);
        expect(layer.matrices[0]).toEqual({
            identifier: "0",
            registration: "area",
            originX: -180,
            originY: 90,
            pixelSize: 180 / 256,
            tileWidth: 256,
            tileHeight: 256,
            matrixWidth: 2,
            matrixHeight: 1,
        });
        expect(layer.matrices[0]).toEqual(geographicTileMatrix(0));
        expect(layer.matrices[8]).toEqual(geographicTileMatrix(8));
        expect(wmtsTileUrl(layer, layer.matrices[2]!, 1, 3)).toBe("https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/2/1/3.jpg");
    });

    it("reads a real Moon Trek polar layer, whose map fits in the first tile of its 2 x 1 level", () => {
        const layer = parseWmtsCapabilities(fixture("trek-sp-lola-dem-5m.xml"));
        expect(layer.identifier).toBe("LRO_LOLA_DEM_SPole875_5mp_v04");
        // The document does not state the projection of the layer.
        expect(layer.crs).toBe("urn:ogc:def:crs:EPSG::0");
        expect(layer.format).toBe("image/png");
        expect(layer.boundingBox).toEqual([-75840, -75840, 75840, 75840]);
        expect(layer.matrices).toHaveLength(11);
        const first = layer.matrices[0]!;
        expect(first.originX).toBe(-1095930);
        expect(first.matrixWidth).toBe(2);
        expect(first.pixelSize).toBeCloseTo((2 * 1095930) / 256, 3);
        expect(layer.matrices[10]!.pixelSize).toBeCloseTo(8.3613, 3);
        // The pole is at the centre of the first tile, so the second one is outside the map.
        const pole = sourcePixelCoordinates(first, MOON_SOUTH.forward({ x: 0, y: 0, z: -1 }));
        expect(pole.x).toBeCloseTo(127.5, 6);
        expect(pole.y).toBeCloseTo(127.5, 6);
    });

    it("takes pixel sizes from the matrix, not from the scale denominator 0.64 % off on Mars", () => {
        const layer = parseWmtsCapabilities(fixture("trek-np-mars-themis.xml"));
        const first = layer.matrices[0]!;
        expect(first.originY).toBe(1821000);
        expect(first.pixelSize).toBeCloseTo((2 * 1821000) / 256, 6);
        expect(layer.matrices[3]!.pixelSize).toBeCloseTo(first.pixelSize / 8, 6);
    });

    it("reads latitude-first corners, and picks a layer by name", () => {
        const xml = `<Capabilities><Contents>
            <Layer><ows:Identifier>a</ows:Identifier><TileMatrixSetLink><TileMatrixSet>s</TileMatrixSet></TileMatrixSetLink></Layer>
            <Layer><ows:Identifier>b</ows:Identifier><Format>image/png</Format><TileMatrixSetLink><TileMatrixSet>s</TileMatrixSet></TileMatrixSetLink>
                <ResourceURL format="image/png" resourceType="tile" template="https://x.test/{TileMatrix}/{TileRow}/{TileCol}.png"/></Layer>
            <TileMatrixSet><ows:Identifier>s</ows:Identifier><!-- <TileMatrix></TileMatrix> -->
                <TileMatrix><ows:Identifier>0</ows:Identifier><ScaleDenominator>1</ScaleDenominator><TopLeftCorner>90 -180</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>2</MatrixWidth><MatrixHeight>1</MatrixHeight></TileMatrix>
            </TileMatrixSet></Contents></Capabilities>`;
        const layer = parseWmtsCapabilities(xml, "b");
        expect(layer.identifier).toBe("b");
        expect(layer.matrices[0]).toMatchObject({ originX: -180, originY: 90, pixelSize: 180 / 256 });
        expect(wmtsTileUrl(layer, layer.matrices[0]!, 0, 1)).toBe("https://x.test/0/0/1.png");
    });

    it("rejects documents it cannot use", () => {
        expect(() => parseWmtsCapabilities("<html></html>")).toThrow(RangeError);
        expect(() => parseWmtsCapabilities(fixture("trek-eq-wac.xml"), "nope")).toThrow(RangeError);
        expect(() => parseWmtsCapabilities("<Layer><ows:Identifier>a</ows:Identifier></Layer>")).toThrow("TileMatrixSetLink");
        expect(() => parseWmtsCapabilities("<Layer><ows:Identifier>a</ows:Identifier><TileMatrixSetLink><TileMatrixSet>s</TileMatrixSet></TileMatrixSetLink></Layer>")).toThrow(
            "do not define"
        );
        const layer = { ...parseWmtsCapabilities(fixture("trek-eq-wac.xml")), resourceUrl: undefined };
        expect(() => wmtsTileUrl(layer, layer.matrices[0]!, 0, 0)).toThrow(RangeError);
    });
});

describe("tile matrices", () => {
    it("addresses the pixels of a global geographic map, wrapping its columns", () => {
        const matrix = geographicTileMatrix(1);
        // Level 1: 4 x 2 tiles of 256 pixels, 1024 pixels around the body.
        const west = sourcePixelCoordinates(matrix, { x: -180, y: 90 });
        expect(west).toEqual({ x: -0.5, y: -0.5 });
        expect(sourcePixelAt(matrix, 0, 0)).toEqual({ column: 0, row: 0, x: 0, y: 0 });
        expect(sourcePixelAt(matrix, 300, 257)).toEqual({ column: 1, row: 1, x: 44, y: 1 });
        expect(sourcePixelAt(matrix, -1, 0)).toBeUndefined();
        expect(sourcePixelAt(matrix, -1, 0, 1024)).toEqual({ column: 3, row: 0, x: 255, y: 0 });
        expect(sourcePixelAt(matrix, 1024, 0, 1024)).toEqual({ column: 0, row: 0, x: 0, y: 0 });
        expect(sourcePixelAt(matrix, 10, 512)).toBeUndefined();
        expect(sourcePixelAt(matrix, 1024, 0)).toBeUndefined();
    });

    it("chooses a source level from the level of the cube", () => {
        const matrices = Array.from({ length: 9 }, (_, level) => geographicTileMatrix(level));
        // On a global geographic source, as fine as the cube is one level further.
        for (const lod of [0, 3, 7]) expect(cubeSourceMatrix(MOON_GEOGRAPHIC, matrices, MOON_RADIUS, lod).identifier).toBe(String(lod + 1));
        expect(cubeSourceMatrix(MOON_GEOGRAPHIC, matrices, MOON_RADIUS, 11).identifier).toBe("8");
        expect(() => cubeSourceMatrix(MOON_GEOGRAPHIC, [], MOON_RADIUS, 0)).toThrow(RangeError);
    });
});

describe("resampling a tile of the cube", () => {
    /** A source that holds a function of its map position, as a real source holds the relief. */
    function reader(source: { projection: ISourceProjection; matrix: ReturnType<typeof geographicTileMatrix> }, value: (direction: ICartesian3) => number) {
        return (column: number, row: number, x: number, y: number): number => {
            const { matrix, projection } = source;
            const mapX = matrix.originX + (column * matrix.tileWidth + x + 0.5) * matrix.pixelSize;
            const mapY = matrix.originY - (row * matrix.tileHeight + y + 0.5) * matrix.pixelSize;
            return value(projection.inverse(mapX, mapY));
        };
    }
    const relief = ({ x, y, z }: ICartesian3): number => 1000 * x + 2000 * y * y + 3000 * z * x;

    it.each<[string, { projection: ISourceProjection; matrix: ReturnType<typeof geographicTileMatrix> }, Parameters<typeof resampleCubeTile>[0]]>([
        ["a global geographic source", { projection: MOON_GEOGRAPHIC, matrix: geographicTileMatrix(6) }, { face: CubeFace.PositiveY, lod: 4, x: 5, y: 9 }],
        [
            "a south polar source",
            {
                projection: MOON_SOUTH,
                matrix: {
                    identifier: "p",
                    registration: "area",
                    originX: -500000,
                    originY: 500000,
                    pixelSize: 500,
                    tileWidth: 256,
                    tileHeight: 256,
                    matrixWidth: 8,
                    matrixHeight: 8,
                },
            },
            { face: CubeFace.South, lod: 4, x: 8, y: 7 },
        ],
    ])("recovers the relief from %s", (_name, source, address) => {
        const data = resampleCubeTile(address, source, reader(source, relief), { tileSize: 16 });
        let worst = 0;
        for (let row = 0; row <= 16; row++) {
            for (let column = 0; column <= 16; column++) {
                worst = Math.max(worst, Math.abs(data[row * 17 + column]! - relief(cubeTileDirection(address, column / 16, row / 16))));
            }
        }
        expect(worst).toBeLessThan(0.1);
    });

    it("lists the source tiles a tile of the cube reads", () => {
        const source = { projection: MOON_GEOGRAPHIC, matrix: geographicTileMatrix(4) };
        const address = { face: CubeFace.PositiveX, lod: 3, x: 3, y: 3 };
        const tiles = cubeTileSourceTiles(address, source, 16);
        const read = new Set<string>();
        resampleCubeTile(
            address,
            source,
            (column, row) => {
                read.add(`${column}/${row}`);
                return 1;
            },
            { tileSize: 16 }
        );
        expect(new Set(tiles.map(({ column, row }) => `${column}/${row}`))).toEqual(read);
        expect(tiles.length).toBeGreaterThan(0);
    });

    it("reads a tile across the antimeridian", () => {
        const source = { projection: MOON_GEOGRAPHIC, matrix: geographicTileMatrix(3) };
        const columns = new Set(cubeTileSourceTiles({ face: CubeFace.NegativeX, lod: 2, x: 2, y: 2 }, source, 16).map(({ column }) => column));
        expect(columns.has(0)).toBe(true);
        expect(columns.has(15)).toBe(true);
    });

    it("holds the same samples on both sides of every face edge", () => {
        const source = { projection: MOON_GEOGRAPHIC, matrix: geographicTileMatrix(6) };
        const read = reader(source, relief);
        const last = 7;
        const lod = 3;
        for (let face = 0; face < 6; face++) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const address = {
                    face,
                    lod,
                    x: edge === TileNeighbor.W ? 0 : edge === TileNeighbor.E ? last : 3,
                    y: edge === TileNeighbor.N ? 0 : edge === TileNeighbor.S ? last : 3,
                };
                const neighbor = CUBE_TILE_TOPOLOGY.neighbor(address, edge)!.address;
                const junction = CUBE_FACE_EDGES[face]![edge];
                const own = resampleCubeTile(address, source, read, { tileSize: 8 });
                const theirs = resampleCubeTile(neighbor, source, read, { tileSize: 8 });
                const at = (data: Float32Array, side: number, i: number): number => {
                    if (side === TileNeighbor.N) return data[i]!;
                    if (side === TileNeighbor.S) return data[8 * 9 + i]!;
                    if (side === TileNeighbor.W) return data[i * 9]!;
                    return data[i * 9 + 8]!;
                };
                for (let i = 0; i <= 8; i++) expect(at(own, edge, i)).toBe(at(theirs, junction.edge, junction.reversed ? 8 - i : i));
            }
        }
    });

    it("leaves missing pixels out, and marks samples without data", () => {
        const source = { projection: MOON_GEOGRAPHIC, matrix: geographicTileMatrix(3) };
        const address = { face: CubeFace.PositiveX, lod: 1, x: 0, y: 0 };
        expect(resampleCubeTile(address, source, () => Number.NaN, { tileSize: 2 }).every(Number.isNaN)).toBe(true);
        const partly = resampleCubeTile(address, source, (_c, _r, x) => (x % 2 === 0 ? 5 : Number.NaN), { tileSize: 2 });
        expect([...partly].filter((value) => !Number.isNaN(value)).every((value) => Math.abs(value - 5) < 1e-6)).toBe(true);
    });

    it("interleaves channels and checks its target", () => {
        const source = { projection: MOON_GEOGRAPHIC, matrix: geographicTileMatrix(3) };
        const address = { face: CubeFace.PositiveX, lod: 1, x: 0, y: 0 };
        const colour = resampleCubeTile(address, source, (_c, _r, _x, _y, channel) => channel * 10, { tileSize: 2, channels: 3 });
        expect(colour).toHaveLength(27);
        expect([...colour.slice(0, 3)]).toEqual([0, 10, 20]);
        expect(() => resampleCubeTile(address, source, () => 0, { tileSize: 2, target: new Float32Array(3) })).toThrow(RangeError);
    });
});

describe("heights and blends", () => {
    it("keeps heights over the same sphere, and moves them to another surface", () => {
        const direction = planetocentricDirection(-89.6, 130);
        expect(rebaseRadialHeight(1289, MOON_RADIUS, ReferenceSurface.sphere(MOON_RADIUS), direction)).toBeCloseTo(1289, 6);
        expect(rebaseRadialHeight(1289, MOON_RADIUS, ReferenceSurface.sphere(1738100), direction)).toBeCloseTo(589, 6);
    });

    it("blends a cap smoothly, on both hemispheres", () => {
        expect(capBlendWeight(planetocentricDirection(-70, 10), 75, 80)).toBe(0);
        expect(capBlendWeight(planetocentricDirection(-85, 10), 75, 80)).toBe(1);
        expect(capBlendWeight(planetocentricDirection(-77.5, 200), 75, 80)).toBeCloseTo(0.5, 9);
        expect(capBlendWeight(planetocentricDirection(77.5, 10), 75, 80)).toBeCloseTo(0.5, 9);
        expect(() => capBlendWeight({ x: 1, y: 0, z: 0 }, 80, 75)).toThrow(RangeError);
    });
});

describe("registration of a tile matrix", () => {
    const matrix = { identifier: "0", originX: 0, originY: 100, pixelSize: 10, tileWidth: 10, tileHeight: 10, matrixWidth: 1, matrixHeight: 1 };

    it("centres the pixels of an area matrix half a pixel from its origin", () => {
        expect(sourcePixelCoordinates({ ...matrix, registration: "area" }, { x: 5, y: 95 })).toEqual({ x: 0, y: 0 });
    });

    it("places the first sample of a point matrix on its origin", () => {
        expect(sourcePixelCoordinates({ ...matrix, registration: "point" }, { x: 0, y: 100 })).toEqual({ x: 0, y: 0 });
        expect(sourcePixelCoordinates({ ...matrix, registration: "point" }, { x: 5, y: 95 })).toEqual({ x: 0.5, y: 0.5 });
    });

    it("reads WMTS layers in area registration", () => {
        expect(webMercatorTileMatrix(0).registration).toBe("area");
        expect(geographicTileMatrix(0).registration).toBe("area");
    });
});
