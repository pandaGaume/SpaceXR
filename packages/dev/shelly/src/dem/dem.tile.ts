import { TileClientOptions, WebTileUrlFactory, WebTileUrlFactoryOptions } from "../tiles";
import { ImageDecoderTileCodec } from "../tiles/tiles.codecs.image";
import { IRgbValueDecoder, ITileUrlFactory } from "../tiles/tiles.interfaces";
import { FloatArray } from "../types";

export class MapzenRgbValueDecoder implements IRgbValueDecoder {
    public static Shared = new MapzenRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): number {
        if (size < 3) {
            return 0;
        }
        return pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768;
    }
}

export class CommonRgbValueDecoder implements IRgbValueDecoder {
    public static Shared = new CommonRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): number {
        if (size < 3) {
            return 0;
        }
        return -10000.0 + (pixels[offset] * 65536 + pixels[offset + 1] * 256 + pixels[offset + 2]) * 0.1;
    }
}

export class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;

    public constructor(type: string, extension = "png") {
        super();
        this._type = type;
        this.host = "s3.amazonaws.com";
        this.path = "elevation-tiles-prod/" + type + "/{3}/{1}/{2}.{4}";
        this.isSecure = true;
        this.extension = extension;
    }
}

export class DemTileClientOptions extends TileClientOptions<FloatArray> {
    public static MapZenTerrarium = new DemTileClientOptions(
        new WebTileUrlFactory(new MapZenTerrainUrlFactoryOptions("terrarium")),
        new ImageDecoderTileCodec(MapzenRgbValueDecoder.Shared)
    );
    public static MapZenNormal = new DemTileClientOptions(
        new WebTileUrlFactory(new MapZenTerrainUrlFactoryOptions("normal")),
        new ImageDecoderTileCodec(MapzenRgbValueDecoder.Shared)
    );

    public constructor(urlFactory: ITileUrlFactory, codec: ImageDecoderTileCodec) {
        super(urlFactory, codec);
    }
}
