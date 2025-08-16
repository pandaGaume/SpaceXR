import { ITileAddress2, ITileMetrics } from "../tiles.interfaces";
import { ITileSelectionContextOptions } from "../pipeline/tiles.pipeline.interfaces";
import { TileAddress } from "../address";
import { Nullable } from "../../types";
import { ICartesian2, IBounds, Cartesian2, Bounds } from "../../geometry";
import { ITileNavigationState } from "../navigation";

import { Bearing } from "../../geography";
import { IDisplay } from ".";
import { TileViewBase } from "./tiles.map.view.base";

export class TileView extends TileViewBase {
    _offset: number = 0;

    public constructor(offset: number = 0) {
        super();
        this._offset = offset;
    }

    public get offset(): number {
        return this._offset;
    }

    protected _doValidateContext(
        state: Nullable<ITileNavigationState>,
        display: Nullable<IDisplay>,
        metrics: ITileMetrics,
        activAddresses: Map<string, ITileAddress2>,
        options?: ITileSelectionContextOptions
    ) {
        if (state && display) {
            const offset = this._offset + (options?.zoomOffset ?? 0);
            const target = state.lod + offset;
            const lod = TileAddress.ClampLod(target, metrics);
            // TODO : we might adapt the scale depending the diff between lod and state.lod
            if (target != lod) {
                return;
            }
            let scale = state.transitionScale;

            const nwTileXY = Cartesian2.Zero();
            const seTileXY = Cartesian2.Zero();

            const pixelCenterXY = metrics.getLatLonToPointXY(state.center.lat, state.center.lon, lod);
            const r = offset == 0 ? 1.0 : offset > 0 ? Math.pow(2, offset) : 1.0 / Math.pow(2, -offset);
            let w = (display?.resolution.width ?? 0) * r;
            let h = (display?.resolution.height ?? 0) * r;

            let rect = this._getRectangle(pixelCenterXY, w, h, scale, state.azimuth);
            // if azimuth is set, then we need to keep reference of the original rectangle to optimize the tile selection.
            let testRect = state.azimuth?.value ? this._getRectangle(pixelCenterXY, w, h, scale) : null;

            // compute the bounds of tile xy
            metrics.getPointXYToTileXYToRef(rect.xmin, rect.ymin, nwTileXY);
            metrics.getPointXYToTileXYToRef(rect.xmax, rect.ymax, seTileXY);

            const maxIndex = metrics.mapSize(lod) / metrics.tileSize - 1;
            const x0 = Math.max(0, nwTileXY.x);
            const y0 = Math.max(0, nwTileXY.y);
            const x1 = Math.min(maxIndex, seTileXY.x);
            const y1 = Math.min(maxIndex, seTileXY.y);

            const remains = new Array<ITileAddress2>();
            const added = new Array<ITileAddress2>();

            const tmp = new TileAddress(0, 0, lod);
            for (tmp.y = y0; tmp.y <= y1; tmp.y++) {
                for (tmp.x = x0; tmp.x <= x1; tmp.x++) {
                    // if the azimuth is set, we test each address against the test rectangle, if it does not intersect, we skip the address.
                    // this save a huge amount of data to be processed.
                    if (testRect) {
                        const tileRect = this._getTileRectangle(tmp, metrics, pixelCenterXY, state.azimuth);
                        if (testRect.intersects(tileRect) == false) {
                            continue;
                        }
                    }
                    const key = tmp.quadkey;
                    const activ = activAddresses.get(key);
                    if (activ) {
                        remains.push(activ);
                        activAddresses.delete(key);
                        continue;
                    }
                    added.push(tmp.clone());
                }
            }

            let deleted = Array.from(activAddresses.values());
            activAddresses.clear();

            for (const a of remains) {
                activAddresses.set(a.quadkey, a);
            }

            for (const a of added) {
                activAddresses.set(a.quadkey, a);
            }

            if (options?.dispatchEvent ?? true) {
                if (deleted.length && this._removedObservable?.hasObservers()) {
                    this._removedObservable.notifyObservers(deleted, -1, this, this);
                }
                if (added.length && this._addedObservable?.hasObservers()) {
                    this._addedObservable.notifyObservers(added, -1, this, this);
                }
            }
        }
    }

    protected _getRectangle(center: ICartesian2, w: number, h: number, scale: number, azimuth?: Bearing): IBounds {
        w = (w / scale) * 1.5; // add border for caching
        h = (h / scale) * 1.5;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        const bounds = new Bounds(x0, y0, w, h);
        // bounds.points is returning a new set of points, so we need to rotate them if azimuth is non zero.
        return azimuth?.value ? Bounds.FromPoints2(...this._rotatePointsArround(center, azimuth, ...bounds.points())) : bounds;
    }

    protected _getTileRectangle(a: ITileAddress2, metrics: ITileMetrics, center: ICartesian2, azimuth: Bearing): IBounds {
        const points = [
            metrics.getTileXYToPointXY(a.x, a.y),
            metrics.getTileXYToPointXY(a.x + 1, a.y),
            metrics.getTileXYToPointXY(a.x + 1, a.y + 1),
            metrics.getTileXYToPointXY(a.x, a.y + 1),
        ];
        return Bounds.FromPoints2(...this._rotatePointsArround(center, azimuth, ...points));
    }

    protected *_rotatePointsArround(center: ICartesian2, azimuth: Bearing, ...points: ICartesian2[]): IterableIterator<ICartesian2> {
        for (const p of points) {
            yield this._rotatePointArround(p.x, p.y, center, azimuth, p);
        }
    }

    protected _rotatePointArround<R extends ICartesian2>(x: number, y: number, center: ICartesian2, azimuth: Bearing, target?: R): R {
        const r = target || Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        const cos = azimuth?.cos ?? 1;
        const sin = azimuth?.sin ?? 0;
        r.x = translatedX * cos - translatedY * sin + center.x;
        r.y = translatedX * sin + translatedY * cos + center.y;
        return <R>r;
    }
}
