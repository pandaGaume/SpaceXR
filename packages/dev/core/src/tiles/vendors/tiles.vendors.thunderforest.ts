import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { ImageTileCodec } from "../tiles.codecs.image";
import { EPSG3857 } from "../tiles.geography";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";

export class ThunderForestStaticTilesUrlBuilder extends WebTileUrlBuilder {
    public constructor(styleId: string, token: string) {
        super();
        this.withHost("tile.thunderforest.com")
            .withSecure(true)
            .withQuery(`apikey=${token}`)
            .withPath(`${styleId}/{z}/{x}/{y}.png`);
    }
}

export class ThunderForest {
    public static MaxLevelOfDetail = 20;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withMaxLOD(ThunderForest.MaxLevelOfDetail).build();
    public static Metrics = new EPSG3857(ThunderForest.MetricsOptions);

    private static Client2d(styleId: string, options?: TileWebClientOptions) {
        const urlBuilder = new ThunderForestStaticTilesUrlBuilder(styleId, "601b62d767484bf89040ce5c0df10df0");
        return new TileWebClient(urlBuilder, new ImageTileCodec(), ThunderForest.Metrics, options);
    }

    public static Spinal(options?: TileWebClientOptions) {
        return ThunderForest.Client2d("spinal-map", options);
    }
}
