import { GeodeticSystem } from "@spacexr/geodesy";

const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;

export enum CellCoordinateReference {
    Center = 0,
    NorthWest = 1,
    NorthEast = 2,
    SouthWest = 3,
    SouthEast = 4,
}

export interface ICartesian2 {
    x: number;
    y: number;
}

export interface IGeographic2 {
    latitude: number;
    longitude: number;
}

/**
 * Describes the addressing, resolution and valid LOD range of a tile source.
 *
 * This is the renderer-neutral counterpart of SpaceXR `ITileMetrics`. Angles
 * are expressed in degrees and sizes in pixels or metres as documented by
 * each method.
 */
export interface ITileMetrics {
    readonly minLOD: number;
    readonly maxLOD: number;
    readonly minLatitude: number;
    readonly maxLatitude: number;
    readonly minLongitude: number;
    readonly maxLongitude: number;
    readonly tileSize: number;
    readonly cellSize: number;
    readonly cellCoordinateReference: CellCoordinateReference;
    readonly overlap: number;

    mapSize(levelOfDetail: number): number;
    mapScale(latitudeDegrees: number, levelOfDetail: number, pixelsPerUnit: number): number;
    groundResolution(latitudeDegrees: number, levelOfDetail: number): number;

    getLatLonToTileXY(latitudeDegrees: number, longitudeDegrees: number, levelOfDetail: number): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number): IGeographic2;
    getLatLonToPointXY(latitudeDegrees: number, longitudeDegrees: number, levelOfDetail: number): ICartesian2;
    getPointXYToLatLon(x: number, y: number, levelOfDetail: number): IGeographic2;
    getTileXYToPointXY(x: number, y: number): ICartesian2;
    getPointXYToTileXY(x: number, y: number): ICartesian2;
}

export interface IWebMercatorTileMetricsOptions {
    minLOD: number;
    maxLOD: number;
    tileSize?: number;
    cellSize?: number;
    cellCoordinateReference?: CellCoordinateReference;
    overlap?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

/** Immutable EPSG:3857 tile metrics backed by a geodetic ellipsoid. */
export class WebMercatorTileMetrics implements ITileMetrics {
    public readonly minLatitude = -WEB_MERCATOR_MAX_LATITUDE;
    public readonly maxLatitude = WEB_MERCATOR_MAX_LATITUDE;
    public readonly minLongitude = -180;
    public readonly maxLongitude = 180;
    public readonly minLOD: number;
    public readonly maxLOD: number;
    public readonly tileSize: number;
    public readonly cellSize: number;
    public readonly cellCoordinateReference: CellCoordinateReference;
    public readonly overlap: number;

    public constructor(
        options: IWebMercatorTileMetricsOptions,
        private readonly geodeticSystem = GeodeticSystem.WGS84
    ) {
        if (!Number.isInteger(options.minLOD) || !Number.isInteger(options.maxLOD) || options.minLOD < 0 || options.maxLOD < options.minLOD)
            throw new RangeError("Tile metrics require integer LOD bounds with 0 <= minLOD <= maxLOD.");
        const tileSize = options.tileSize ?? 256;
        if (!Number.isFinite(tileSize) || tileSize <= 0) throw new RangeError("Tile size must be a positive finite number.");

        this.minLOD = options.minLOD;
        this.maxLOD = options.maxLOD;
        this.tileSize = tileSize;
        this.cellSize = options.cellSize ?? 1;
        this.cellCoordinateReference = options.cellCoordinateReference ?? CellCoordinateReference.Center;
        this.overlap = options.overlap ?? 0;
    }

    public mapSize(levelOfDetail: number): number {
        this.assertLOD(levelOfDetail);
        return this.tileSize * 2 ** levelOfDetail;
    }

    public mapScale(latitudeDegrees: number, levelOfDetail: number, pixelsPerUnit: number): number {
        if (pixelsPerUnit === 0) return Number.POSITIVE_INFINITY;
        const resolution = this.groundResolution(latitudeDegrees, levelOfDetail);
        return resolution === 0 ? Number.POSITIVE_INFINITY : 1 / (resolution * pixelsPerUnit);
    }

    public groundResolution(latitudeDegrees: number, levelOfDetail: number): number {
        const latitude = clamp(latitudeDegrees, this.minLatitude, this.maxLatitude);
        const circumference = 2 * Math.PI * this.geodeticSystem.ellipsoid.semiMajorAxis;
        return (Math.cos((latitude * Math.PI) / 180) * circumference) / this.mapSize(levelOfDetail);
    }

    public getLatLonToTileXY(latitudeDegrees: number, longitudeDegrees: number, levelOfDetail: number): ICartesian2 {
        const point = this.getLatLonToPointXY(latitudeDegrees, longitudeDegrees, levelOfDetail);
        const tile = this.getPointXYToTileXY(point.x, point.y);
        // The east and south map edges belong to the last tile, not to a tile beyond the pyramid.
        const lastTile = 2 ** levelOfDetail - 1;
        return { x: Math.min(tile.x, lastTile), y: Math.min(tile.y, lastTile) };
    }

    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number): IGeographic2 {
        const point = this.getTileXYToPointXY(x, y);
        return this.getPointXYToLatLon(point.x, point.y, levelOfDetail);
    }

    public getLatLonToPointXY(latitudeDegrees: number, longitudeDegrees: number, levelOfDetail: number): ICartesian2 {
        const latitude = clamp(latitudeDegrees, this.minLatitude, this.maxLatitude);
        const longitude = clamp(longitudeDegrees, this.minLongitude, this.maxLongitude);
        const normalizedX = (longitude + 180) / 360;
        const sineLatitude = Math.sin((latitude * Math.PI) / 180);
        const normalizedY = 0.5 - Math.log((1 + sineLatitude) / (1 - sineLatitude)) / (4 * Math.PI);
        const mapSize = this.mapSize(levelOfDetail);
        return {
            x: clamp(normalizedX * mapSize, 0, mapSize),
            y: clamp(normalizedY * mapSize, 0, mapSize),
        };
    }

    public getPointXYToLatLon(x: number, y: number, levelOfDetail: number): IGeographic2 {
        const mapSize = this.mapSize(levelOfDetail);
        const normalizedX = clamp(x, 0, mapSize) / mapSize - 0.5;
        const normalizedY = 0.5 - clamp(y, 0, mapSize) / mapSize;
        return {
            latitude: 90 - (360 * Math.atan(Math.exp(-normalizedY * 2 * Math.PI))) / Math.PI,
            longitude: 360 * normalizedX,
        };
    }

    public getTileXYToPointXY(x: number, y: number): ICartesian2 {
        return { x: x * this.tileSize, y: y * this.tileSize };
    }

    public getPointXYToTileXY(x: number, y: number): ICartesian2 {
        return {
            x: Math.floor(x / this.tileSize),
            y: Math.floor(y / this.tileSize),
        };
    }

    private assertLOD(levelOfDetail: number): void {
        if (!Number.isInteger(levelOfDetail) || levelOfDetail < this.minLOD || levelOfDetail > this.maxLOD)
            throw new RangeError(`LOD ${levelOfDetail} is outside [${this.minLOD}, ${this.maxLOD}].`);
    }
}
