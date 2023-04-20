import { IVector2, ILocation } from "shelly/src/tiles/tiles.interfaces";
import { AbstractTileMetrics } from "shelly/src/tiles/tiles.metrics";
export declare class DemTileMetrics extends AbstractTileMetrics {
    private static D2R;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2 | undefined): IVector2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: ILocation | undefined): ILocation;
}
