import { ITileContentProvider, ITileProvider } from "./tiles.pipeline.interfaces";
import { ITile, ITileAddress, ITileAddressProcessor, ITileBuilder, ITileMetrics } from "../tiles.interfaces";
import { Observable } from "../../events/events.observable";

export class TileProvider<T> implements ITileProvider<T> {
    _tileUpdatedObservable?: Observable<ITile<T>>;
    _enableObservable?: Observable<ITileProvider<T>>;

    _name: string;
    _addressProcessor?: ITileAddressProcessor | undefined;
    _contentProvider: ITileContentProvider<T>;
    _factory: ITileBuilder<T>;
    _activTiles?: Map<string, ITile<T>>;
    _enabled: boolean;

    public constructor(name: string, provider: ITileContentProvider<T>, factory: ITileBuilder<T>, addressProcessor?: ITileAddressProcessor, enabled = true) {
        this._name = name;
        this._addressProcessor = addressProcessor;
        this._contentProvider = provider;
        this._factory = factory;
        this._enabled = enabled;
    }

    public get tileUpdatedObservable(): Observable<ITile<T>> {
        this._tileUpdatedObservable = this._tileUpdatedObservable || new Observable<ITile<T>>();
        return this._tileUpdatedObservable!;
    }

    public get enableObservable(): Observable<ITileProvider<T>> {
        this._enableObservable = this._enableObservable || new Observable<ITileProvider<T>>();
        return this._enableObservable!;
    }

    public get zindex(): number {
        return this._contentProvider.zindex;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(v: boolean) {
        if (this._enabled !== v) {
            this._enabled = v;
            if (this._enableObservable && this._enableObservable.hasObservers()) {
                this._enableObservable.notifyObservers(this, -1, this, this);
            }
        }
    }

    public get metrics(): ITileMetrics {
        return this._contentProvider.metrics;
    }

    public get name(): string {
        return this._name;
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

    public *activTiles(): IterableIterator<ITile<T>> {
        return this._activTiles?.values() ?? [];
    }

    public activateTile(...address: Array<ITileAddress>): Array<ITile<T>> {
        const toActivate = address.length === 0 ? [...(this._activTiles?.values() ?? [])].map((t) => t.address) : address;
        const tiles = new Array<ITile<T>>();
        for (const a of toActivate ?? []) {
            if (this._activTiles?.has(a.quadkey)) {
                tiles.push(this._activTiles.get(a.quadkey)!);
                continue;
            }
            const factory = this._factory.withNamespace(this._contentProvider.name).withAddress(a);
            try {
                const tile = factory.build();
                if (tile) {
                    this._contentProvider.fetchContentAsync(tile.address).then((content) => {
                        if (content) {
                            tile.content = content;
                            if (this.tileUpdatedObservable && this.tileUpdatedObservable.hasObservers()) {
                                this.tileUpdatedObservable.notifyObservers(tile, -1, this, this);
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
        const toDeactivate = address.length === 0 ? this._activTiles?.keys() : address.map((a) => a.quadkey);
        const tiles = new Array<ITile<T>>();
        for (const k of toDeactivate ?? []) {
            if (this._activTiles?.has(k)) {
                tiles.push(this._activTiles.get(k)!);
                this._activTiles.delete(k)!;
            }
        }
        return tiles;
    }
}
