import { Tile } from "./tiles";
import { TileCollection } from "./tiles.collections";
import { ICompoundTile, ITile, ITileCollection } from "./tiles.interfaces";

export class CompoundTile<T> extends Tile<Array<ITileCollection<T>>> implements ICompoundTile<T> {
    public constructor(x: number, y: number, levelOfDetail: number, ...children: Array<ITile<T>>) {
        super(x, y, levelOfDetail, new Array<ITileCollection<T>>());
        this.addChildTiles(...children);
    }

    public get childTiles(): Array<ITileCollection<T>> {
        return this.content as Array<ITileCollection<T>>;
    }

    public addChildTiles(...children: Array<ITile<T>>): void {
        for (let child of children) {
            this._addChild(child);
        }
    }

    public removeChildTiles(...children: Array<ITile<T>>): void {
        for (let child of children) {
            this._removeChild(child);
        }
    }

    protected _addChild(child: ITile<T>): void {
        const c = this.childTiles;
        let collection = c.find((c) => c.namespace === child.namespace);
        if (!collection) {
            collection = new TileCollection<T>();
            collection.namespace = child.namespace;
            c.push(collection);
        }
        collection.add(child);
    }

    protected _removeChild(child: ITile<T>): void {
        let collection = this.childTiles.find((c) => c.namespace === child.namespace);
        if (collection) {
            collection.remove(child.address);
        }
    }
}
