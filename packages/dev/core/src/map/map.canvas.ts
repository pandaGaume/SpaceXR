import { IGeo2 } from "../geography/geography.interfaces";
import { ITileDirectory } from "../tiles/tiles.interfaces";
import { View2 } from "../tiles/tiles.view";

export class CanvasMap {
    _canvas: HTMLCanvasElement;
    _view: View2<HTMLImageElement>;
    _directory: ITileDirectory<HTMLImageElement>;

    public constructor(canvas: HTMLCanvasElement, directory: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number) {
        this._canvas = canvas;
        this._directory = directory;
        this._view = new View2(canvas.width, canvas.height, lat, lon, zoom, directory.metrics);
    }

    /// public API begin
    public invalidateSize(w: number, h: number) {
        this._view.resize(w, h);
    }

    public setView(center: IGeo2, zoom?: number) {
        this._view.center(center.lat, center.lon);
        if (zoom) {
            this.setZoom(zoom);
        }
    }

    public setZoom(zoom: number) {
        this._view.levelOfDetail = zoom;
    }
    /// public API End
    private draw() {
        this._view.validate();
        const c = this._canvas.getContext("2d");
        if (c) {
            c.translate(this._view.bounds.x, this._view.bounds.y);
            const s = this._view.scaling;
            for (const t of this._view.tiles) {
                if (t.data) {
                    if (t.data instanceof Array) {
                        for (const d of t.data) {
                            if (d) {
                                c.drawImage(d, t.px * s, t.py * s);
                            }
                        }
                    } else {
                        c.drawImage(t.data, t.px * s, t.py * s);
                    }
                } else {
                    this._directory.lookupAsync(t.x, t.y, t.levelOfDetail, this).then((r) => {
                        const tiles = (<CanvasMap>r.args)._view.tiles
                        const c = tiles.find((t) => t.x == r.x && t.y == r.y && t.levelOfDetail == r.levelOfDetail);
                        if (c) {
                            c.data = r.data;
                        }
                    });
                }
            }
        }
    }
}
