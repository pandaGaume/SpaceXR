import { ITileAddress } from "../tiles/tiles.interfaces";
import { Terrain } from "./terrain.surface";
import { Observable } from "../events/events.observable";

export abstract class AbstractTerrainPrism {
    _terrain: Terrain;
    _valid: boolean;
    _currentTiles: Array<ITileAddress>;
    _removeObservable: Observable<Array<ITileAddress>>;
    _addObservable: Observable<Array<ITileAddress>>;

    public constructor(terrain: Terrain) {
        this._terrain = terrain;
        this._valid = false;
        this._currentTiles = [];
        this._removeObservable = new Observable<Array<ITileAddress>>();
        this._addObservable = new Observable<Array<ITileAddress>>();
    }

    public get terrain(): Terrain {
        return this._terrain;
    }

    public invalidate(): void {
        this._valid = false;
    }

    public validate(): void {
        if (!this._valid) {
            this.doValidate();
            this._valid = true;
        }
    }

    protected doValidate(): void {
        const added = [];
        const remain = [];
        // this is where we might synchronize
        const clone: Array<ITileAddress | undefined> = this._currentTiles.map((x) => x);

        for (const k of this.validateTileKeys()) {
            for (let i = 0; i != clone.length; i++) {
                const a = clone[i];
                if (a && a.levelOfDetail == k.levelOfDetail && a.x == k.x && a.y == k.y) {
                    clone[i] = undefined;
                    remain.push(a);
                }
                added.push(k);
            }
        }

        this._currentTiles = remain.length ? remain.concat(added) : added;

        if (remain.length != clone.length && this._removeObservable.hasObservers()) {
            const deleted = <Array<ITileAddress>>clone.filter((a) => a != undefined);
            this._removeObservable.notifyObservers(deleted);
        }
        if (added.length && this._addObservable.hasObservers()) {
            this._addObservable.notifyObservers(added);
        }
    }

    public *currentTileKeys(): IterableIterator<ITileAddress> {
        return this._currentTiles;
    }

    public abstract validateTileKeys(): IterableIterator<ITileAddress>;
}
