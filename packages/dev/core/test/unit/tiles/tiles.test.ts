import { TileMetrics } from "../../../src/tiles/tiles.metrics";
import { TilePyramid } from "../../../src/tiles/tiles.pyramid";
import { WebMercatorTileMetrics } from "../../../src/tiles/tiles.geography";
import { WebTileUrlBuilder } from "../../../src/tiles/tiles.urlBuilder";
import { ITileDatasource, ITileAddress } from "../../../src/tiles/tiles.interfaces";
import { Nullable } from "../../../src/types";
import { TileClient, TileClientOptions } from "../../../src/tiles/tiles.client";
import { MapZenDemUrlBuilder } from "../../../src/tiles/tiles.mapzen";
import { BlobTileCodec } from "../../../src/tiles/tiles.codecs";

class DummyDataSource<T> implements ITileDatasource<T, ITileAddress> {
    _data: T;

    public constructor(data: T) {
        this._data = data;
    }

    public fetchAsync(request: ITileAddress): Promise<Nullable<T>> {
        return Promise.resolve(this._data);
    }
}

describe("Tiles", () => {
    test("QuadKey", () => {
        const x = 875;
        const y = 589;
        const lod = 13;
        const k = TileMetrics.TileXYToQuadKey(x, y, lod);
        const address = TileMetrics.QuadKeyToTileXY(k);
        expect(address).toEqual({ x: x, y: y, levelOfDetail: lod });
    });

    describe("Pyramid ", () => {
        test("Lookup - no datasource", async () => {
            const x = 2;
            const y = 2;
            const lod = 3;

            const index = new TilePyramid<Float32Array>(new WebMercatorTileMetrics(), []);

            const data = await index.lookupAsync(x, y, lod);
            expect(data).toBeUndefined();
            expect(index._infos).toEqual({ depth: 3, tileCount: lod * 4 + 1 });
        });
        test("Lookup - local datasource", async () => {
            const x = 2;
            const y = 2;
            const lod = 3;

            const dummyData = { body: "hello world" };
            const index = new TilePyramid<object>(new WebMercatorTileMetrics(), new DummyDataSource(dummyData));
            const data = await index.lookupAsync(x, y, lod);
            expect(data).toEqual(dummyData);
        });
        test("Lookup - web image datasource", async () => {
            // for this test we DO NOT use the image but a blod instead, because the Image does NOT exist in nodejs server side.
            const x = 531;
            const y = 364;
            const lod = 10;

            const options = new TileClientOptions(MapZenDemUrlBuilder.Terrarium, BlobTileCodec.Shared);
            const client = new TileClient<Blob, ITileAddress>(options);
            const index = new TilePyramid(new WebMercatorTileMetrics(), client);

            const result = await index.lookupAsync(x, y, lod);
            expect(result).not.toBeUndefined();
            let image: Nullable<Blob> = null;
            if (result) {
                if (result instanceof Array && result.length) {
                    image = result[0];
                } else {
                    image = <Blob>result;
                }
            }
            expect(image).not.toBeNull();
        });
    });

    test("Web Url Factory", () => {
        const x = 875;
        const y = 589;
        const lod = 13;

        let url = new WebTileUrlBuilder()
            .withSecure(true)
            .withHost("s3.amazonaws.com")
            .withPath("elevation-tiles-prod/terrarium/{z}/{x}/{y}.{extension}")
            .withExtension("png")
            .buildUrl(x, y, lod);
        expect(url).toEqual(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${lod}/${x}/${y}.png`);
    });
});
