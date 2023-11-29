import { Observable, Observer } from "../events/events.observable";
import { IGeo2 } from "../geography/geography.interfaces";
import { ISize2 } from "../geometry/geometry.interfaces";
import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { ITileView, TilePipelineEventArgs } from "./tiles.interfaces.pipeline";
import { TileMapBase, TileMapContextMetrics } from "./tiles.tilemap";
import { TileAddress } from "./tiles.address";

export class TileView extends TileMapBase implements ITileView {
    _id?: string;
    _addressAddedObservable?: Observable<TilePipelineEventArgs>;
    _addressRemovedObservable?: Observable<TilePipelineEventArgs>;
    _activ: Map<string, ITileAddress>;

    public constructor(id: string, metrics: ITileMetrics, size?: ISize2, center?: IGeo2, lod?: number, azimuth?: number) {
        super(metrics, size, center, lod, azimuth);
        this._id = id;
        this._activ = new Map<string, ITileAddress>();
    }

    public get id(): string | undefined {
        return this._id;
    }

    public get addressAddedObservable(): Observable<TilePipelineEventArgs> {
        this._addressAddedObservable = this._addressAddedObservable || new Observable<TilePipelineEventArgs>(this._onAddressAddedObserverAdded.bind(this));
        return this._addressAddedObservable!;
    }

    public get addressRemovedObservable(): Observable<TilePipelineEventArgs> {
        this._addressRemovedObservable = this._addressRemovedObservable || new Observable<TilePipelineEventArgs>(this._onAddressRemovedObserverAdded.bind(this));
        return this._addressRemovedObservable!;
    }

    // INTERNALS
    protected _doValidate() {
        super._doValidate();
        // this is the place where we validate the view and compute the visible tile addresses
        const context = new TileMapContextMetrics(this._lod, this._scale, this._centerXY);
        this._doValidateContext(context);
    }

    protected _doValidateContext(context: TileMapContextMetrics, dispatchEvent: boolean = true) {
        let rect = this._boundsXY;
        // compute the bounds of tile xy
        let nwTileXY = this.metrics.getPixelXYToTileXY(rect.xmin, rect.ymin);
        let seTileXY = this.metrics.getPixelXYToTileXY(rect.xmax, rect.ymax);

        const maxIndex = this.metrics.mapSize(context.lod) / this.metrics.tileSize - 1;
        const x0 = Math.max(0, nwTileXY.x);
        const y0 = Math.max(0, nwTileXY.y);
        const x1 = Math.min(maxIndex, seTileXY.x);
        const y1 = Math.min(maxIndex, seTileXY.y);

        const remains = new Array<ITileAddress>();
        const added = new Array<ITileAddress>();

        const tmp = new TileAddress(0, 0, context.lod);
        for (tmp.y = y0; tmp.y <= y1; tmp.y++) {
            for (tmp.x = x0; tmp.x <= x1; tmp.x++) {
                const key = tmp.quadkey;
                const activ = this._activ.get(key);
                if (activ) {
                    remains.push(activ);
                    this._activ.delete(key);
                    continue;
                }
                added.push(tmp.clone());
            }
        }

        let deleted = Array.from(this._activ.values());
        this._activ.clear();

        for (const a of remains) {
            this._activ.set(a.quadkey, a);
        }

        for (const a of added) {
            this._activ.set(a.quadkey, a);
        }

        if (dispatchEvent) {
            if (added.length && this._addressAddedObservable?.hasObservers()) {
                const addEvent = new TilePipelineEventArgs(this, context, ...added);
                this._addressAddedObservable.notifyObservers(addEvent);
            }
            if (deleted.length && this._addressRemovedObservable?.hasObservers()) {
                const removeEvent = new TilePipelineEventArgs(this, context, ...deleted);
                this._addressRemovedObservable.notifyObservers(removeEvent);
            }
        }
    }

    protected _onAddressAddedObserverAdded(observer: Observer<TilePipelineEventArgs>): void {}
    protected _onAddressRemovedObserverAdded(observer: Observer<TilePipelineEventArgs>): void {}
}
