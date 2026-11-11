import { Scalar } from "../../../math/math";
import { ITileMetrics } from "../../tiles.interfaces";
import { RegionType } from "../interfaces/boundingVolume";

/**
 * Describes an implicitly-tiled 3D Tiles tileset (OGC 3D Tiles 1.1 implicit
 * tiling) as a set of pure functions of a node's quadtree coordinates
 * (level, x, y), rather than an explicit tree of tiles.
 *
 * `Tile3dStreamSource` consumes this to materialize children on demand while
 * it traverses, so a whole global tile server (a slippy-map z/x/y pyramid, for
 * instance) is navigated as a standard implicit 3D Tiles tileset without ever
 * downloading a tileset document or a binary subtree.
 *
 * Availability is assumed dense up to `availableLevels` (the common case for a
 * global raster/terrain pyramid). Sparse availability (real binary subtrees)
 * is a future extension.
 */
export interface IImplicitTilesetProvider {
    readonly subdivisionScheme: "QUADTREE";
    /** Number of levels that contain tiles: nodes exist at levels [0, availableLevels). */
    readonly availableLevels: number;
    readonly rootLevel: number;
    readonly rootX: number;
    readonly rootY: number;
    /** Region bounding volume of a node, in EPSG:4979 radians: [west, south, east, north, minH, maxH]. */
    regionOf(level: number, x: number, y: number): RegionType;
    /** Geometric error of a node, in meters. */
    geometricErrorOf(level: number, x: number, y: number): number;
    /** Absolute content uri of a node (template already expanded). Empty string for a structural node. */
    contentUriOf(level: number, x: number, y: number): string;
}

export interface IMetricsImplicitTilesetProviderOptions {
    /** Tile metrics describing the pyramid (EPSG3857 for MapZen, a WGS84 quadtree, a custom scheme, …). */
    metrics: ITileMetrics;
    /**
     * Builds the absolute content uri for a node. Typically wraps a
     * WebTileUrlBuilder, e.g. `(l, x, y) => MapZenDemUrlBuilder.Terrarium.buildUrl(x, y, l)`.
     */
    contentUri: (level: number, x: number, y: number) => string;
    /** Number of levels with tiles. Defaults to `metrics.maxLOD + 1`. */
    availableLevels?: number;
    /** Region min height in meters. Default 0. */
    minHeight?: number;
    /** Region max height in meters. Default 0. */
    maxHeight?: number;
    rootLevel?: number;
    rootX?: number;
    rootY?: number;
}

/**
 * Wraps any `ITileMetrics` (EPSG3857, a geographic quadtree, a custom scheme)
 * as an implicit 3D Tiles provider.
 *
 * The region of a node is computed FROM THE METRICS (its two opposite corners
 * via `getTileXYToLatLon`), not by linear subdivision of the parent region, so
 * non-linear schemes like Web Mercator are handled exactly: the implicit
 * STRUCTURE (quadtree, dense availability, template content) stays standard
 * while the region function stays faithful to the underlying pyramid.
 */
export class MetricsImplicitTilesetProvider implements IImplicitTilesetProvider {
    public readonly subdivisionScheme = "QUADTREE" as const;
    public readonly availableLevels: number;
    public readonly rootLevel: number;
    public readonly rootX: number;
    public readonly rootY: number;

    private readonly _metrics: ITileMetrics;
    private readonly _contentUri: (level: number, x: number, y: number) => string;
    private readonly _minHeight: number;
    private readonly _maxHeight: number;

    public constructor(options: IMetricsImplicitTilesetProviderOptions) {
        this._metrics = options.metrics;
        this._contentUri = options.contentUri;
        this.availableLevels = options.availableLevels ?? options.metrics.maxLOD + 1;
        this._minHeight = options.minHeight ?? 0;
        this._maxHeight = options.maxHeight ?? 0;
        this.rootLevel = options.rootLevel ?? 0;
        this.rootX = options.rootX ?? 0;
        this.rootY = options.rootY ?? 0;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public regionOf(level: number, x: number, y: number): RegionType {
        // y grows southward (XYZ slippy scheme): (x, y) is the north-west corner,
        // (x+1, y+1) the south-east corner.
        const nw = this._metrics.getTileXYToLatLon(x, y, level);
        const se = this._metrics.getTileXYToLatLon(x + 1, y + 1, level);
        const west = nw.lon * Scalar.DEG2RAD;
        const east = se.lon * Scalar.DEG2RAD;
        const north = nw.lat * Scalar.DEG2RAD;
        const south = se.lat * Scalar.DEG2RAD;
        return [west, south, east, north, this._minHeight, this._maxHeight];
    }

    public geometricErrorOf(level: number, _x: number, _y: number): number {
        // Same convention as TileAddress.GeometricError / TilePyramidStreamSource:
        // the tile's ground span at the equator for this level. Halves each level.
        return this._metrics.groundResolution(0, level) * this._metrics.tileSize;
    }

    public contentUriOf(level: number, x: number, y: number): string {
        return this._contentUri(level, x, y);
    }
}
