import { Tile } from "./tiles";
import { ICompoundTile, ITile, ITileCollection } from "./tiles.interfaces";
export declare class CompoundTile<T> extends Tile<Array<ITileCollection<T>>> implements ICompoundTile<T> {
    constructor(x: number, y: number, levelOfDetail: number, ...children: Array<ITile<T>>);
    get childTiles(): Array<ITileCollection<T>>;
    addChildTiles(...children: Array<ITile<T>>): void;
    removeChildTiles(...children: Array<ITile<T>>): void;
    protected _addChild(child: ITile<T>): void;
    protected _removeChild(child: ITile<T>): void;
}
