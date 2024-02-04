import { AbstractTileMetrics } from "../tiles.metrics";
import { IGeo2 } from "../../geography";
import { ICartesian2 } from "../../geometry";
import { Ellipsoid } from "../../geodesy/geodesy.ellipsoid";
import { ITileMetrics } from "../tiles.interfaces";
export declare class EPSG3857 extends AbstractTileMetrics {
    static Shared: EPSG3857;
    _ellipsoid: Ellipsoid;
    constructor(options?: Partial<ITileMetrics>, ellipsoid?: Ellipsoid);
    groundResolution(latitude: number, levelOfDetail: number): number;
    getLatLonToTileXYToRef(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): void;
    getTileXYToLatLonToRef(x: number, y: number, levelOfDetail: number, loc?: IGeo2): void;
    getLatLonToPixelXYToRef(latitude: number, longitude: number, levelOfDetail: number, pixelXY: ICartesian2): void;
    getPixelXYToLatLonToRef(pixelX: number, pixelY: number, levelOfDetail: number, latLon: IGeo2): void;
    getTileXYToPixelXYToRef(tileX: number, tileY: number, pixelXY: ICartesian2): void;
    getPixelXYToTileXYToRef(pixelX: number, pixelY: number, tileXY: ICartesian2): void;
}
