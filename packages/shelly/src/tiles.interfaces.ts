export type Nullable<T> = T | null;

export interface IVector2 {
    x: number;
    y: number;
}

export interface ILocation {
    lat: number;
    lon: number;
    alt: number;
}

export interface ITileAddress extends IVector2 {
    levelOfDetail: number;
}

export interface ITileMetricsOptions {
    tileSize?: number;
    minLOD?: number;
    maxLOD?: number;
    minLatitude?: number;
    maxLatitude?: number;
    minLongitude?: number;
    maxLongitude?: number;
}

export interface ITileMetrics {
    options: ITileMetricsOptions;

    /**
     * determines the map width and height (in pixels) at a specified level of detail.
     * @param levelOfDetail - Level of detail, from lodRange.min (lowest detail) to lodRange.max (highest detail).
     * @return - The map width and height in pixels
     */
    getMapSize(levelOfDetail: number): number;

    /**
     * determines the ground resolution (in meters per pixel) at a specified latitude and level of detail.
     * @param latitude - Latitude (in degrees) at which to measure the ground resolution.
     * @param levelOfDetail - Level of detail, from lodRange.min (lowest detail) to lodRange.max (highest detail).
     * @param semiMajor - semi major axis radius of the ellipsoid.
     * @return - The ground resolution, in meters per pixel.
     */
    getGroundResolution(latitude: number, levelOfDetail: number, semiMajor: number): number;

    /**
     * determines the map scale at a specified latitude, level of detail, and screen resolution.
     * @param latitude -  Latitude (in degrees) at which to measure the map scale
     * @param levelOfDetail - Level of detail, from lodRange.min (lowest detail) to lodRange.max (highest detail).
     * @param  screenDpi - resolution of the screen, in dots per inch
     * @return - the map scale, expressed as the denominator N of the ratio 1 : N.
     */
    getMapScale(latitude: number, levelOfDetail: number, screenDpi: number, semiMajor: number): number;

    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: IVector2): IVector2;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2): IVector2;

    getPixelXYToTileXY(x: number, y: number, tileXY?: IVector2): IVector2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: ILocation): ILocation;

    getTileXYToPixelXY(x: number, y: number, pixelXY?: IVector2): IVector2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: ILocation): ILocation;
}

export interface ITileUrlFactory {
    buildUrl(request: ITileAddress, ...params: unknown[]): string;
}

export type ITileCodec<T> = (r: void | Response) => Promise<Awaited<T> | null>;

export interface ITileClientOptions<T> {
    urlFactory: ITileUrlFactory;
    codec: ITileCodec<T>;
}

export interface ITileClient<T, R extends ITileAddress> {
    options: ITileClientOptions<T>;
    fetchAsync(request: R): Promise<Awaited<T> | null>;
}
