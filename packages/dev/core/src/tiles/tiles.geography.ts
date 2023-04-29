import { AbstractTileMapMetrics } from "./tiles.metrics";
import { ICartesian2, IGeo3 } from "../geography/geography.interfaces";
import { Scalar } from "../math/math";

export class WebMercatorTileMetrics extends AbstractTileMapMetrics {
    private static D2R = Math.PI / 180;

    public static Shared = new WebMercatorTileMetrics();

    public getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2 {
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * WebMercatorTileMetrics.D2R;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        if (tileXY) {
            tileXY.x = x;
            tileXY.y = y;
            return tileXY;
        }
        return <ICartesian2>{ x: x, y: y };
    }

    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo3 | undefined): IGeo3 {
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        if (loc) {
            loc.lat = lat;
            loc.lon = lon;
            return loc;
        }
        return <IGeo3>{ lat: lat, lon: lon };
    }

    public getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2 | undefined): ICartesian2 {
        throw new Error("Method not implemented.");
    }
    public getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3 | undefined): IGeo3 {
        throw new Error("Method not implemented.");
    }
    public getTileXYToPixelXY(x: number, y: number, levelOfDetail: number, pixelXY?: ICartesian2 | undefined): ICartesian2 {
        throw new Error("Method not implemented.");
    }
    public getPixelXYToTileXY(x: number, y: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): IGeo3 {
        throw new Error("Method not implemented.");
    }
}
