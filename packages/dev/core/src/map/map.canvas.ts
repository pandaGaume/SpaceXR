import { Tile } from "../tiles/tiles";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileAddress, ITileDirectory, ITileMetrics, LookupData, TileDirectoryResult } from "../tiles/tiles.interfaces";
import { UpdateEvents, View2 } from "../tiles/tiles.view";
import { TileMetrics } from "../tiles/tiles.metrics";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";

export class CanvasTileMap {
    _canvas: HTMLCanvasElement; // the 2D target
    _view: View2<HTMLImageElement>; // the view logic
    _directory?: ITileDirectory<HTMLImageElement>; // the tiel data source
    _cache: Map<string, Tile<LookupData<HTMLImageElement>>>; // the list of activ tiles
    _bounds?: IRectangle; // this is a copy of the curent pixel bounds of the view
    _offset: Cartesian2; // optional offset, not used

    public constructor(canvas: HTMLCanvasElement, directory?: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number) {
        this._canvas = canvas;
        this._directory = directory;
        this._view = new View2(canvas.width, canvas.height, lat, lon, zoom, directory?.metrics);
        this._view.updateObservable.add(((e: UpdateEvents) => this.onUpdate(e)).bind(this));
        this._cache = new Map<string, Tile<LookupData<HTMLImageElement>>>();
        this._offset = Cartesian2.Zero();
        this._view.validate();
    }

    /// public API begin

    public get center(): IGeo2 {
        return this._view._center;
    }

    public invalidateSize(w?: number, h?: number) {
        this._view.resize(w || this._canvas.clientWidth, h || this._canvas.clientHeight).validate();
    }

    public setView(center: IGeo2, zoom?: number) {
        this._view.center(center.lat, center.lon);
        if (zoom) {
            this._view.levelOfDetail = zoom;
        }
        this._view.validate();
    }

    public setZoom(zoom: number) {
        this._view.levelOfDetail = zoom;
        this._view.validate();
    }

    public zoomIn(delta: number) {
        const d = Math.abs(delta);
        console.log("Zoom In :" + d);
        this._view.validate();
    }

    public zoomOut(delta: number) {
        const d = Math.abs(delta);
        console.log("Zoom out :" + d);
        this._view.validate();
    }

    public translate(tx: number, ty: number) {
        this._view.translate(tx, ty).validate();
    }

    /// public API End
    private get metrics(): ITileMetrics {
        return this._view.metrics;
    }

    private onUpdate(e: UpdateEvents) {
        if (!e) {
            return;
        }

        this._bounds = e.bounds;

        if (e.removed) {
            // this is the place to clean unactive tile
            // fast track
            if (!e.remain) {
                // we remove ALL
                this._cache.clear();
            } else {
                for (const c of e.removed) {
                    const binaryKey = TileMetrics.TileXYToQuadKey(c);
                    const key = binaryKey.join("");
                    this._cache.delete(key);
                }
            }
        }
        if (e.added) {
            // this is the place to add new tiles from the directory
            for (const c of e.added) {
                const tile = new Tile<LookupData<HTMLImageElement>>(c.x, c.y, c.levelOfDetail);
                if (this._directory) {
                    this._directory.lookupAsync(c, tile).then(
                        ((result: TileDirectoryResult<HTMLImageElement>) => {
                            tile.data = result.data;
                            if (tile.data) {
                                this.drawImage(tile, tile.data);
                            }
                        }).bind(this)
                    );
                }
                const binaryKey = TileMetrics.TileXYToQuadKey(c);
                const key = binaryKey.join("");
                this._cache.set(key, tile);
            }
        }
        this.draw();
    }

    private draw() {
        const ctx = this._canvas.getContext("2d");
        if (ctx) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = "red";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const offsetX = this._bounds?.x || 0;
            const offsetY = this._bounds?.y || 0;
            const metrics = this.metrics;
            const temp = Cartesian2.Zero();
            // const s = metrics.tileSize;
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
            ctx.save();
            ctx.translate(this._offset.x, this._offset.y);
            for (const entry of this._cache.entries()) {
                const t = entry[1];
                const pixelXY = metrics.getTileXYToPixelXY(t.x, t.y, t.levelOfDetail, temp);
                const x = pixelXY.x - offsetX;
                const y = pixelXY.y - offsetY;
                if (t.data) {
                    ctx.drawImage(t.data, x, y);
                    continue;
                }
                //ctx.strokeRect(x, y, s, s);
                //ctx.fillText(entry[0], x + s / 2, y + s / 2);
            }
            ctx.restore();
        }
    }

    private drawImage(a: ITileAddress, data: HTMLImageElement) {
        const ctx = this._canvas.getContext("2d");
        if (ctx) {
            ctx.save();
            ctx.translate(this._offset.x, this._offset.y);
            const offsetX = this._bounds?.x || 0;
            const offsetY = this._bounds?.y || 0;
            const metrics = this.metrics;
            const temp = Cartesian2.Zero();
            const pixelXY = metrics.getTileXYToPixelXY(a.x, a.y, a.levelOfDetail, temp);
            const x = pixelXY.x - offsetX;
            const y = pixelXY.y - offsetY;
            ctx.drawImage(data, x, y);
            ctx.restore();
        }
    }
}
