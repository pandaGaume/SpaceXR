import { EventState, Observable, Observer } from "../events/events.observable";
import { ITileAddress } from "./tiles.interfaces";
import { ITileView } from "./tiles.interfaces.pipeline";
import { TileAddress } from "./tiles.address";
import { ITileMapApi } from "./tiles.interfaces.api";
import { Nullable } from "../types";

export class TileView implements ITileView {
    _id?: string;
    _addressAddedObservable?: Observable<Array<ITileAddress>>;
    _addressRemovedObservable?: Observable<Array<ITileAddress>>;
    _activ: Map<string, ITileAddress>;
    _api: Nullable<ITileMapApi>;
    _observer: Nullable<Observer<ITileMapApi>>;

    public constructor(id: string, model?: ITileMapApi) {
        this._id = id;
        this._api = null;
        this._observer = null;
        this._activ = new Map<string, ITileAddress>();
        if (model) {
            this.api = model;
        }
    }

    public get api(): Nullable<ITileMapApi> {
        return this._api;
    }

    public set api(api: Nullable<ITileMapApi>) {
        if (this._api === api) return;

        if (this._api) {
            this._api?.viewChangedObservable.remove(this._observer);
            this._observer = null;
            this._doClearContext(this._api, true);
        }
        this._api = api;
        if (this._api) {
            this._observer = this._api.viewChangedObservable.add(this._onViewChanged.bind(this));
            this._doValidateContext(this._api, true); // force context to be validated if we change of api.
        }
    }

    public get id(): string | undefined {
        return this._id;
    }

    public dispose(): void {
        this._api = null;
        this._observer?.dispose();
        this._observer = null;
    }

    public get addressAddedObservable(): Observable<Array<ITileAddress>> {
        this._addressAddedObservable = this._addressAddedObservable || new Observable<Array<ITileAddress>>(this._onAddressAddedObserverAdded.bind(this));
        return this._addressAddedObservable!;
    }

    public get addressRemovedObservable(): Observable<Array<ITileAddress>> {
        this._addressRemovedObservable = this._addressRemovedObservable || new Observable<Array<ITileAddress>>(this._onAddressRemovedObserverAdded.bind(this));
        return this._addressRemovedObservable!;
    }

    // INTERNALS
    protected _onViewChanged(eventData: ITileMapApi, eventState: EventState) {
        this._doValidateContext(eventData, true);
    }

    protected _doValidateContext(api: ITileMapApi, dispatchEvent: boolean = true) {
        let rect = api.boundsXY;
        let metrics = api.metrics;
        let lod = api.levelOfDetail;
        // compute the bounds of tile xy
        let nwTileXY = metrics.getPixelXYToTileXY(rect.xmin, rect.ymin);
        let seTileXY = metrics.getPixelXYToTileXY(rect.xmax, rect.ymax);

        const maxIndex = metrics.mapSize(lod) / metrics.tileSize - 1;
        const x0 = Math.max(0, nwTileXY.x);
        const y0 = Math.max(0, nwTileXY.y);
        const x1 = Math.min(maxIndex, seTileXY.x);
        const y1 = Math.min(maxIndex, seTileXY.y);

        const remains = new Array<ITileAddress>();
        const added = new Array<ITileAddress>();

        const tmp = new TileAddress(0, 0, lod);
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
                this._addressAddedObservable.notifyObservers(added);
            }
            if (deleted.length && this._addressRemovedObservable?.hasObservers()) {
                this._addressRemovedObservable.notifyObservers(deleted);
            }
        }
    }

    protected _doClearContext(api: ITileMapApi, dispatchEvent: boolean = true) {
        let deleted = Array.from(this._activ.values());
        this._activ.clear();

        if (dispatchEvent) {
            if (deleted.length && this._addressRemovedObservable?.hasObservers()) {
                this._addressRemovedObservable.notifyObservers(deleted);
            }
        }
    }

    protected _onAddressAddedObserverAdded(observer: Observer<Array<ITileAddress>>): void {}
    protected _onAddressRemovedObserverAdded(observer: Observer<Array<ITileAddress>>): void {}
}
