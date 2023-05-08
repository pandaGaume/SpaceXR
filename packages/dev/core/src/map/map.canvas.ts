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
    _scale: Cartesian2; //

    public constructor(canvas: HTMLCanvasElement, directory?: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number) {
        this._canvas = canvas;
        this._directory = directory;
        this._view = new View2(canvas.width, canvas.height, lat, lon, zoom, directory?.metrics);
        this._view.updateObservable.add(((e: UpdateEvents) => this.onUpdate(e)).bind(this));
        this._cache = new Map<string, Tile<LookupData<HTMLImageElement>>>();
        this._scale = Cartesian2.One();
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
            this._view.setLevelOfDetail(zoom);
        }
        this._view.validate();
    }

    public setZoom(zoom: number) {
        this._view.setLevelOfDetail(zoom).validate();
    }

    public zoomIn(delta: number) {
        this.setZoom((this._view.levelOfDetail * View2.ZOOM_ACC + Math.abs(delta * View2.ZOOM_ACC)) / View2.ZOOM_ACC);
    }

    public zoomOut(delta: number) {
        this.setZoom((this._view.levelOfDetail * View2.ZOOM_ACC - Math.abs(delta * View2.ZOOM_ACC)) / View2.ZOOM_ACC);
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
        this._scale = e.scale;
        //console.log("Scale: x", this._scale.x, ", y", this._scale.y);

        if (e.removed && e.removed.length != 0) {
            // this is the place to clean unactive tile
            // fast track
            if (!e.remain || e.remain.length == 0) {
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
        if (e.added && e.added.length != 0) {
            // this is the place to add new tiles from the directory
            for (const c of e.added) {
                const tile = new Tile<LookupData<HTMLImageElement>>(c.x, c.y, c.levelOfDetail);
                if (this._directory) {
                    if (this.metrics.isValidAddress(c)) {
                        this._directory
                            .lookupAsync(c, tile)
                            .then(
                                ((result: TileDirectoryResult<HTMLImageElement>) => {
                                    tile.data = result.data;
                                    if (tile.data) {
                                        this.drawImage(tile, tile.data);
                                    }
                                }).bind(this)
                            )
                            .catch((e) => {
                                console.log("Error when lookup", c.toString(), e);
                            });
                    }
                }
                const binaryKey = TileMetrics.TileXYToQuadKey(c);
                const key = binaryKey.join("");
                this._cache.set(key, tile);
            }
        }
        this.draw();
    }

    private draw() {
        if (this._bounds) {
            const ctx = this._canvas.getContext("2d");
            if (ctx) {
                const center = this._bounds.center;
                const metrics = this.metrics;
                const temp = Cartesian2.Zero();

                ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
                ctx.save();
                ctx.translate(this._canvas.width / 2, this._canvas.height / 2);
                ctx.scale(this._scale.x, this._scale.y);
                for (const entry of this._cache.entries()) {
                    const t = entry[1];
                    if (t.data) {
                        const pixelXY = metrics.getTileXYToPixelXY(t.x, t.y, t.levelOfDetail, temp);
                        pixelXY.x -= center.x;
                        pixelXY.y -= center.y;
                        ctx.drawImage(t.data, pixelXY.x, pixelXY.y);
                        continue;
                    }
                }
                ctx.restore();
            }
        }
    }

    private drawImage(t: ITileAddress, data: HTMLImageElement) {
        if (this._bounds) {
            const ctx = this._canvas.getContext("2d");
            if (ctx) {
                const center = this._bounds.center;
                const metrics = this.metrics;
                const temp = Cartesian2.Zero();
                ctx.save();
                ctx.translate(this._canvas.width / 2, this._canvas.height / 2);
                ctx.scale(this._scale.x, this._scale.y);
                const pixelXY = metrics.getTileXYToPixelXY(t.x, t.y, t.levelOfDetail, temp);
                pixelXY.x -= center.x;
                pixelXY.y -= center.y;
                ctx.drawImage(data, pixelXY.x, pixelXY.y);
                ctx.restore();
            }
        }
    }
}
