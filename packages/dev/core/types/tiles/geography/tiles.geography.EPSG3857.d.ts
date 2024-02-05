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
    getLatLonToPointXYToRef(latitude: number, longitude: number, levelOfDetail: number, pointXY: ICartesian2): void;
    getPointXYToLatLonToRef(pointX: number, pointY: number, levelOfDetail: number, latLon: IGeo2): void;
    getTileXYToPointXYToRef(tileX: number, tileY: number, pointXY: ICartesian2): void;
    getPointXYToTileXYToRef(pointX: number, pointY: number, tileXY: ICartesian2): void;
}
