import { AbstractTileMapMetrics } from "./tiles.metrics";
import { ICartesian2, IGeo3 } from "../geography/geography.interfaces";
export declare class WebMercatorTileMetrics extends AbstractTileMapMetrics {
    private static D2R;
    static Shared: WebMercatorTileMetrics;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo3 | undefined): IGeo3;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2 | undefined): ICartesian2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3 | undefined): IGeo3;
    getTileXYToPixelXY(x: number, y: number, levelOfDetail: number, pixelXY?: ICartesian2 | undefined): ICartesian2;
    getPixelXYToTileXY(x: number, y: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): IGeo3;
}
