import { ITile, ITileAddress, ITileBuilder, ITileCollection, ITileContentProvider, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { Observable } from "../../events/events.observable";
import { IEnvelope } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { TileCollection } from "../tiles.collections";
import { TileBuilder } from "../tiles.builder";

export abstract class AbstractTileProvider<T> implements ITileProvider<T> {
    _updatedObservable?: Observable<ITile<T>>;
    _enabledObservable?: Observable<ITileProvider<T>>;

    _factory: ITileBuilder<T>;
    _activTiles: TileCollection<T>;
    _enabled: boolean;

    // internal
    _callback: (t: ITile<T>) => void;

    public constructor(factory?: ITileBuilder<T>, enabled = true) {
        this._factory = factory ?? this._buildFactory();
        this._enabled = enabled;
        this._activTiles = new TileCollection<T>();
        this._callback = this._onContentFetched.bind(this);
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
        return this.factory.metrics;
    }

    public get namespace(): string {
        return this.factory.namespace;
    }

    public get factory(): ITileBuilder<T> {
        return this._factory;
    }

    public dispose() {
        this._activTiles?.clear();
    }

    public get activTiles(): ITileCollection<T> {
        return this._activTiles;
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
            const factory = this._factory.withAddress(a);
            try {
                let tile = factory.build();
                if (tile) {
                    // fetch content, possibiliy generate alterative content
                    // if underlying async operation are performed, then the callback will be messaged when the content
                    // is available.
                    tile = this._fetchContent(tile, this._callback);
                    // add to collection
                    this._activTiles?.add(tile);
                    // push to result
                    tiles.push(tile);
                }
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

    protected _onContentFetched(tile: ITile<T>): void {
        if (this.updatedObservable?.hasObservers()) {
            this.updatedObservable.notifyObservers(tile, -1, this, this);
        }
    }

    protected _buildFactory(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    public abstract _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
}

export class TileProvider<T> extends AbstractTileProvider<T> {
    _contentProvider: ITileContentProvider<T>;

    public constructor(provider: ITileContentProvider<T>, factory?: ITileBuilder<T>, enabled = true) {
        super(factory, enabled);
        this.factory.withMetrics(provider.metrics).withNamespace(provider.name); // ensure the factory has the right metrics and namespace to build bounds.
        this._contentProvider = provider;
    }

    public _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        return this._contentProvider.fetchContent(tile, callback);
    }
}
