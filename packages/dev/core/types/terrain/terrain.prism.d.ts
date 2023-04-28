import { ITileAddress } from "../tiles/tiles.interfaces";
import { Terrain } from "./terrain.surface";
import { Observable } from "../events/events.observable";
export declare abstract class AbstractTerrainPrism {
    _terrain: Terrain;
    _valid: boolean;
    _currentTiles: Array<ITileAddress>;
    _removeObservable: Observable<Array<ITileAddress>>;
    _addObservable: Observable<Array<ITileAddress>>;
    constructor(terrain: Terrain);
    get terrain(): Terrain;
    invalidate(): void;
    validate(): void;
    protected doValidate(): void;
    currentTileKeys(): IterableIterator<ITileAddress>;
    abstract validateTileKeys(): IterableIterator<ITileAddress>;
}
