import { ITile, ITileAddress, ITileAddressProcessor, ITileBuilder, ITileCollection, ITileContentProvider, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { Observable } from "../../events/events.observable";
import { IEnvelope } from "../../geography/geography.interfaces";
import { IRectangle } from "core/geometry/geometry.interfaces";
import { TileCollection } from "../tiles.collections";

export class TileProvider<T> implements ITileProvider<T> {
    _updatedObservable?: Observable<ITile<T>>;
    _enabledObservable?: Observable<ITileProvider<T>>;

    _addressProcessor?: ITileAddressProcessor | undefined;
    _contentProvider: ITileContentProvider<T>;
    _factory: ITileBuilder<T>;
    _activTiles?: TileCollection<T>;
    _enabled: boolean;

    public constructor(provider: ITileContentProvider<T>, factory: ITileBuilder<T>, addressProcessor?: ITileAddressProcessor, enabled = true) {
        this._addressProcessor = addressProcessor;
        this._contentProvider = provider;
        this._factory = factory;
        this._enabled = enabled;
    }

    public get bounds(): IEnvelope | undefined {
        return this._activTiles?.bounds;
    }

    public get rect(): IRectangle | undefined {
        return this._activTiles?.rect;
    }

    public get updatedObservable(): Observable<ITile<T>> {
        this._updatedObservable = this._updatedObservable || new Observable<ITile<T>>();
        return this._updatedObservable!;
    }

    public get enabledObservable(): Observable<ITileProvider<T>> {
        this._enabledObservable = this._enabledObservable || new Observable<ITileProvider<T>>();
        return this._enabledObservable!;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(v: boolean) {
        if (this._enabled !== v) {
            this._enabled = v;
            if (this._enabledObservable && this._enabledObservable.hasObservers()) {
                this._enabledObservable.notifyObservers(this, -1, this, this);
            }
        }
    }

    public get metrics(): ITileMetrics {
        return this._contentProvider.metrics;
    }

    public get name(): string {
        return this._contentProvider.name;
    }

    public get contentProvider(): ITileContentProvider<T> {
        return this._contentProvider;
    }

    public get factory(): ITileBuilder<T> {
        return this._factory;
    }

    public get addressProcessor(): ITileAddressProcessor | undefined {
        return this._addressProcessor;
    }

    public dispose() {
        this._activTiles?.clear();
    }

    public get activTiles(): ITileCollection<T> {
        return this._activTiles ?? (this._activTiles = new TileCollection<T>());
    }

    public activateTile(...address: Array<ITileAddress>): Array<ITile<T>> {
        const toActivate = address.length === 0 ? [...(this._activTiles ?? [])].map((t) => t.address) : address;
        const tiles = new Array<ITile<T>>();
        for (const a of toActivate ?? []) {
            const t = this._activTiles?.get(a);
            if (t) {
                tiles.push(t);
                continue;
            }
            const factory = this._factory.withNamespace(this._contentProvider.name).withAddress(a);
            try {
                const tile = factory.build();
                if (tile) {
                    this._contentProvider.fetchContentAsync(tile.address).then((content) => {
                        if (content) {
                            tile.content = content;
                            if (this.updatedObservable && this.updatedObservable.hasObservers()) {
                                this.updatedObservable.notifyObservers(tile, -1, this, this);
                            }
                        }
                    });
                }
                tiles.push(tile);
            } catch (e) {
                console.log(e);
            }
        }
        return tiles;
    }

    public deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>> {
        if (this._activTiles && this._activTiles.count) {
            const tiles = new Array<ITile<T>>();
            for (const a of address ?? []) {
                const t = this._activTiles?.get(a);
                if (t) {
                    tiles.push(t);
                    this._activTiles?.remove(a)!;
                }
            }
            return tiles;
        }
        return [];
    }
}
