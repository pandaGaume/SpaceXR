import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { ImageTileCodec } from "../codecs/tiles.codecs.image";
import { EPSG3857 } from "../tiles.geography";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";

export enum GoogleMap2DLayerCode {
    street = "m",
    satellite = "s",
    hybrid = "h",
    terrain = "p",
}

export class GoogleMap2DUrlBuilder extends WebTileUrlBuilder {
    public static Street = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.street);
    public static Satellite = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite);
    public static Hybrid = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite, GoogleMap2DLayerCode.hybrid);
    public static Terrain = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.terrain);

    public constructor(...types: (GoogleMap2DLayerCode | string)[]) {
        super();
        this.withSubDomains(["mt0", "mt1", "mt2", "mt3"])
            .withHost("{s}.google.com")
            .withPath(`vt/lyrs=${types.join(",")}&x={x}&y={y}&z={z}`);
    }
}

export class Google {
    private static readonly KEY = "google";

    public static MaxLevelOfDetail = 20;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withMaxLOD(Google.MaxLevelOfDetail).build();
    public static Metrics = new EPSG3857(Google.MetricsOptions);

    public static Client2d(urlBuilder: GoogleMap2DUrlBuilder, options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_2d`, urlBuilder, new ImageTileCodec(), Google.Metrics, options);
    }
    public static StreetClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_street2d`, GoogleMap2DUrlBuilder.Street, new ImageTileCodec(), Google.Metrics, options);
    }
    public static SatelliteClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_sat2d`, GoogleMap2DUrlBuilder.Satellite, new ImageTileCodec(), Google.Metrics, options);
    }
    public static HybridClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_hybrid2d`, GoogleMap2DUrlBuilder.Hybrid, new ImageTileCodec(), Google.Metrics, options);
    }
    public static TerrainClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_terrain2d`, GoogleMap2DUrlBuilder.Terrain, new ImageTileCodec(), Google.Metrics, options);
    }
}
