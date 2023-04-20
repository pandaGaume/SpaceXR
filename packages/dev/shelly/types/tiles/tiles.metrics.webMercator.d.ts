import { ILocation, IVector2 } from "./tiles.interfaces";
import { AbstractTileMetrics } from "./tiles.metrics";
export declare class WebMercatorTileMetrics extends AbstractTileMetrics {
    private static D2R;
    static Shared: WebMercatorTileMetrics;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2 | undefined): IVector2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: ILocation | undefined): ILocation;
}
