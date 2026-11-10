import type { ITileAddress } from "@spacexr/3d-tiles-runtime";
import { GeodeticSystem, type ICartesian3 } from "@spacexr/geodesy";
import { webMercatorSurfaceNormal } from "@spacexr/dem";
import type { IGridTopology } from "@spacexr/grid";
import { WebMercatorTileSurface, flatTileTopology, type ITileSurface, type ITileTopology } from "@spacexr/tiles";

import { gridShape, tileCenterEcef, tileCenterLongitude, webMercatorLatitude } from "./gpu/grid-shapes";

/** Area of a tile in a DEM tile. `turns` stays 0 on a flat topology. */
export interface ITerrainDemArea {
    west: number;
    north: number;
    size: number;
    turns: number;
}

/** Height of the terrain at a position of a pyramid, and on a root of the pyramid. */
export type TerrainPickHeight = (x: number, y: number, face: number) => number;

/**
 * How terrain tiles lie on a body. The engines stay the same whatever the tiling: they ask it where a tile is and how
 * tiles connect.
 *
 * Only what really differs between projections belongs here: addressing, positions and the direction of heights.
 */
export interface ITerrainTiling {
    /** Places the tiles on the body. */
    surface: ITileSurface;
    /** Connects the tiles. */
    topology: ITileTopology;
    /** Radii `a`, `b`, `c` of the reference ellipsoid. */
    referenceRadii?: readonly [number, number, number];
    /** Centre of a tile on the body. */
    center(address: ITileAddress): ICartesian3;
    /** Longitude by which the shape of a tile turns about the polar axis. */
    rotation(address: ITileAddress): number;
    /** Tiles with the same key share a shape. */
    shapeKey(address: ITileAddress): string;
    /** Texels of the shape of a tile, `(cells + 1)^2` of four floats: position from the tile centre, then latitude. */
    shapeTexels(address: ITileAddress, cells: number): Float32Array;
    /** Centre and positions, relative to it, of the coarse grid the camera picks. */
    pickGeometry(
        topology: IGridTopology,
        address: ITileAddress,
        height: TerrainPickHeight,
    ): { center: ICartesian3; positions: Float32Array };
    /**
     * Normal of the displaced surface at a point of a tile, from the gradient of the heights over the pyramid, in metres
     * per normalized unit.
     */
    surfaceNormal(
        address: ITileAddress,
        u: number,
        v: number,
        up: ICartesian3,
        gradient: readonly [number, number],
        verticalScale: number,
    ): ICartesian3;
    /** Area of a tile in a DEM tile, the DEM of a neighbour included. */
    demArea(address: ITileAddress, demTile: ITileAddress): ITerrainDemArea;
}

/** Web Mercator tiling on an ellipsoid, without the poles. */
export function webMercatorTiling(system: GeodeticSystem = GeodeticSystem.WGS84): ITerrainTiling {
    return {
        surface: new WebMercatorTileSurface(system),
        topology: flatTileTopology({ wrapX: true }),
        referenceRadii: [system.ellipsoid.semiMajorAxis, system.ellipsoid.semiMajorAxis, system.ellipsoid.semiMinorAxis],
        center: (address) => tileCenterEcef(address, system),
        rotation: (address) => tileCenterLongitude(address),
        shapeKey: (address) => `${address.lod}/${address.y}`,
        shapeTexels: (address, cells) => gridShape(address.lod, address.y, cells, system),
        pickGeometry: (topology, address, height) => {
            const center = tileCenterEcef(address, system);
            const count = 2 ** address.lod;
            const positions = new Float32Array((topology.coordinates.length / 2) * 3);
            const point = { x: 0, y: 0, z: 0 };
            for (let vertex = 0; vertex < topology.coordinates.length / 2; vertex++) {
                const x = (address.x + topology.coordinates[vertex * 2]!) / count;
                const y = (address.y + topology.coordinates[vertex * 2 + 1]!) / count;
                system.geodeticRadiansToEcef(webMercatorLatitude(y), x * 2 * Math.PI - Math.PI, height(x, y, 0), point);
                positions[vertex * 3] = point.x - center.x;
                positions[vertex * 3 + 1] = point.y - center.y;
                positions[vertex * 3 + 2] = point.z - center.z;
            }
            return { center, positions };
        },
        surfaceNormal: (_address, _u, _v, up, gradient, verticalScale) => webMercatorSurfaceNormal(gradient, up, verticalScale),
        // The tile is never coarser than the DEM tile; it may lie outside it, on its edge, for a neighbour's DEM.
        demArea: (address, demTile) => {
            const scale = 2 ** (address.lod - demTile.lod);
            return { west: address.x / scale - demTile.x, north: address.y / scale - demTile.y, size: 1 / scale, turns: 0 };
        },
    };
}
