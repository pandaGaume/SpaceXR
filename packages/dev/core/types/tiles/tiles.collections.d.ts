import { IRectangle } from "../geometry/geometry.interfaces";
import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileCollection } from "./tiles.interfaces";
export declare class TileCollection<T> implements ITileCollection<T> {
    static Empty<T>(): ITileCollection<T>;
    private _index?;
    private _items;
    private _bounds?;
    private _rect?;
    constructor(...items: Array<ITile<T>>);
    get count(): number;
    get index(): Map<string, ITile<T>>;
    get bounds(): IEnvelope | undefined;
    get rect(): IRectangle | undefined;
    has(address: ITileAddress): boolean;
    get(address: ITileAddress): ITile<T> | undefined;
    getAll(...address: Array<ITileAddress>): Array<ITile<T> | undefined>;
    add(tile: ITile<T>): void;
    addAll(...tiles: Array<ITile<T>>): void;
    remove(address: ITileAddress): void;
    removeAll(...address: Array<ITileAddress>): void;
    clear(): void;
    intersect(bounds?: IRectangle | IEnvelope): IterableIterator<ITile<T>>;
    [Symbol.iterator](): IterableIterator<ITile<T>>;
    protected _buildIndex(): Map<string, ITile<T>>;
    protected _buildBounds(): IEnvelope | undefined;
    protected _buildRect(): IRectangle | undefined;
}
