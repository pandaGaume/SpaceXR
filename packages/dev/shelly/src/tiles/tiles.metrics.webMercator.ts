import { Utils } from "../utils";
import { ILocation, IVector2 } from "./tiles.interfaces";
import { AbstractTileMetrics } from "./tiles.metrics";

export class WebMercatorTileMetrics extends AbstractTileMetrics {
    private static D2R = Math.PI / 180;

    public static Shared = new WebMercatorTileMetrics();

    public getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2 | undefined): IVector2 {
        latitude = Utils.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Utils.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * WebMercatorTileMetrics.D2R;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        if (tileXY) {
            tileXY.x = x;
            tileXY.y = y;
            return tileXY;
        }
        return <IVector2>{ x: x, y: y };
    }

    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: ILocation | undefined): ILocation {
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        if (loc) {
            loc.lat = lat;
            loc.lon = lon;
            return loc;
        }
        return <ILocation>{ lat: lat, lon: lon };
    }
}
