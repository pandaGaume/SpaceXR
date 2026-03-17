import { TileWebClient } from "../tiles.client";
import { ImageTileClient } from "../tiles.client.image";
import { ImageTileCodec } from "../codecs/tiles.codecs.image";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { WebTileUrlBuilder } from "../tiles.url.web";
import { WebClientOptions } from "../../io";
import { SolarSystemBodies } from "../../space";

export class MoonUrlBuilder extends WebTileUrlBuilder {
    /** Carto CDN — supports CORS */
    public static Basemap = new MoonUrlBuilder("cartocdn-gusc.global.ssl.fastly.net", "opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.{extension}");
    /** Raw S3 — no CORS headers, TMS Y convention, must be loaded via <img> */
    public static HillshadeAlbedo = new MoonUrlBuilder("s3.amazonaws.com", "opmbuilder/301_moon/tiles/w/hillshaded-albedo/{z}/{x}/{y}.{extension}", true);

    public constructor(host: string, path: string, tms: boolean = false) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("png");
        if (tms) {
            this.withTMSY(true);
        }
    }
}

export class Moon {
    private static readonly KEY = "moon";

    public static MaxLevelOfDetail = 7;
    public static Metrics = new EPSG3857({ maxLOD: Moon.MaxLevelOfDetail }, SolarSystemBodies.Moon.ellipsoid);
    public static Attribution = "OpenPlanetary / USGS / NASA";

    public static BasemapClient(options?: WebClientOptions) {
        return new TileWebClient(`${Moon.KEY}_basemap`, MoonUrlBuilder.Basemap, new ImageTileCodec(), Moon.Metrics, options);
    }
    public static HillshadeClient(options?: WebClientOptions) {
        // Uses ImageTileClient (loads via <img>) because S3 does not serve CORS headers
        return new ImageTileClient(`${Moon.KEY}_hillshade`, MoonUrlBuilder.HillshadeAlbedo, Moon.Metrics, options);
    }
}
