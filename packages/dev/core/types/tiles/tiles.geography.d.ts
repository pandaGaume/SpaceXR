import { AbstractTileMetrics } from "./tiles.metrics";
import { ICartesian2, IGeo3 } from "../geography/geography.interfaces";
export declare class WebMercatorTileMetrics extends AbstractTileMetrics {
    private static D2R;
    static Shared: WebMercatorTileMetrics;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo3 | undefined): IGeo3;
}
