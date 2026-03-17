import { TileWebClient } from "../tiles.client";
import { ImageTileCodec } from "../codecs/tiles.codecs.image";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { WebTileUrlBuilder } from "../tiles.url.web";
import { WebClientOptions } from "../../io";
import { SolarSystemBodies } from "../../space";

export class MercuryUrlBuilder extends WebTileUrlBuilder {
    public static Basemap = new MercuryUrlBuilder(
        "trek.nasa.gov",
        "tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0/default/default028mm/{z}/{y}/{x}.{extension}"
    );

    public constructor(host: string, path: string) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("jpg");
    }
}

export class Mercury {
    private static readonly KEY = "mercury";

    public static MaxLevelOfDetail = 7;
    public static Metrics = new EPSG3857({ maxLOD: Mercury.MaxLevelOfDetail }, SolarSystemBodies.Mercury.ellipsoid);
    public static Attribution = "NASA / USGS / MESSENGER";

    public static BasemapClient(options?: WebClientOptions) {
        return new TileWebClient(`${Mercury.KEY}_basemap`, MercuryUrlBuilder.Basemap, new ImageTileCodec(), Mercury.Metrics, options);
    }
}
