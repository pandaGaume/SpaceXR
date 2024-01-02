import { AbstractTileMetrics } from "../tiles.metrics";
import { IGeo2 } from "../../geography/geography.interfaces";
import { ICartesian2 } from "../../geometry/geometry.interfaces";
import { Ellipsoid } from "../../geodesy/geodesy.ellipsoid";
import { ITileMetricsOptions } from "../tiles.interfaces";
export declare class EPSG3857 extends AbstractTileMetrics {
    static Shared: EPSG3857;
    _ellipsoid: Ellipsoid;
    constructor(options?: ITileMetricsOptions, ellipsoid?: Ellipsoid);
    groundResolution(latitude: number, levelOfDetail: number): number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo2): IGeo2;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToLatLon(pixelX: number, pixelY: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getTileXYToPixelXY(tileX: number, tileY: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToTileXY(pixelX: number, pixelY: number, tileXY?: ICartesian2): ICartesian2;
}
