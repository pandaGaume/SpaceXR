import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { ImageTileCodec } from "../tiles.codecs.image";
import { EPSG3857 } from "../tiles.geography";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";

export enum GoogleMap2DLayerCode {
    street = "m",
    satellite = "s",
    hybrid = "h",
    terrain = "p",
    roadmap = "r",
    aerial = "y",
    height = "t",
}

export class GoogleMap2DUrlBuilder extends WebTileUrlBuilder {
    public static Street = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.street);
    public static Satellite = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite);
    public static Hybrid = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.satellite, GoogleMap2DLayerCode.hybrid);
    public static Terrain = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.terrain);
    public static Roadmap = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.roadmap);
    public static Aerial = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.aerial);
    public static Height = new GoogleMap2DUrlBuilder(GoogleMap2DLayerCode.height);

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
    public static RoadmapClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_roadmap2d`, GoogleMap2DUrlBuilder.Roadmap, new ImageTileCodec(), Google.Metrics, options);
    }
    public static AerialClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_aerial2d`, GoogleMap2DUrlBuilder.Aerial, new ImageTileCodec(), Google.Metrics, options);
    }
    public static HeightClient2d(options?: TileWebClientOptions) {
        return new TileWebClient(`${Google.KEY}_height2d`, GoogleMap2DUrlBuilder.Height, new ImageTileCodec(), Google.Metrics, options);
    }
}
