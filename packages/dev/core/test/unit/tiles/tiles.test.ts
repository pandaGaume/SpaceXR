import { TileMetrics } from "../../../src/tiles/tiles.metrics";
import { TilePyramid } from "../../../src/tiles/tiles.pyramid";
import { EPSG3857 } from "../../../src/tiles/tiles.geography";
import { WebTileUrlBuilder } from "../../../src/tiles/tiles.urlBuilder";
import { ITileDatasource, ITileAddress } from "../../../src/tiles/tiles.interfaces";
import { MapLayer } from "../../../src/tiles/map.prism";
import { Geo3 } from "../../../src/geography/geography.position";

class DummyDataSource<T> implements ITileDatasource<T, ITileAddress> {
    _data?: T;

    public constructor(data?: T) {
        this._data = data;
    }

    public fetchAsync(request: ITileAddress): Promise<T | undefined> {
        return Promise.resolve(this._data);
    }
}

describe("Tiles", () => {
    test("Web Mercator metrics", () => {
        const x = 875;
        const y = 589;
        const lod = 13;
        const metrics = new EPSG3857();
        const upperLeftLatLonA = metrics.getTileXYToLatLon(x, y, lod);
        const upperLeftPixelA = metrics.getTileXYToPixelXY(x, y, lod);
        const upperLeftLatLonB = metrics.getPixelXYToLatLon(upperLeftPixelA.x, upperLeftPixelA.y, lod);
        expect(upperLeftLatLonA).toEqual(upperLeftLatLonB);

        const upperLeftPixelC = metrics.getTileXYToPixelXY(x + 1, y + 1, lod);
        expect(upperLeftPixelC.x - upperLeftPixelA.x).toEqual(metrics.tileSize);
    });

    test("QuadKey", () => {
        const x = 875;
        const y = 589;
        const lod = 13;
        const k = TileMetrics.TileXYToQuadKey(x, y, lod);
        const address = TileMetrics.QuadKeyToTileXY(k);
        expect(address).toEqual({ x: x, y: y, levelOfDetail: lod });
    });

    describe("Pyramid ", () => {
        test("Lookup - fake datasource", async () => {
            const x = 2;
            const y = 2;
            const lod = 3;

            const index = new TilePyramid<Float32Array>(new EPSG3857(), []);

            const data = await index.lookupAsync(x, y, lod);
            expect(data).toBeUndefined();
            expect(index._infos).toEqual({ depth: 3, tileCount: lod * 4 + 1 });
        });
        test("Lookup - local datasource", async () => {
            const x = 2;
            const y = 2;
            const lod = 3;

            const dummyData = { body: "hello world" };
            const index = new TilePyramid<object>(new EPSG3857(), new DummyDataSource(dummyData));
            const data = await index.lookupAsync(x, y, lod);
            expect(data).toEqual(dummyData);
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

    describe("Web Mercator Map 2", () => {
        test("validate keys", () => {
            const metrics = EPSG3857.Shared;
            const pos = Geo3.Default;
            const lod = 13;
            // HD map
            const w = 1920;
            const h = 1080;

            const cache = MapLayer.ValidateTileKeys(pos.lat, pos.lon, lod, w, h, metrics);
            expect(cache).not.toBeUndefined();
        });
    });
});
