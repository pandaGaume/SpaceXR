import { AbstractTileMetrics } from "./tiles.metrics";
import { ICartesian2, IGeo2 } from "../geography/geography.interfaces";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
export declare class WebMercatorTileMetrics extends AbstractTileMetrics {
    static Shared: WebMercatorTileMetrics;
    _ellipsoid: Ellipsoid;
    constructor(ellipsoid?: Ellipsoid);
    mapScale(latitude: number, levelOfDetail: number, dpi: number): number;
    groundResolution(latitude: number, levelOfDetail: number): number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo2): IGeo2;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToLatLon(pixelX: number, pixelY: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getTileXYToPixelXY(tileX: number, tileY: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToTileXY(pixelX: number, pixelY: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
}
