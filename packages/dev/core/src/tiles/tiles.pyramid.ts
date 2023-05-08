import { ITileAddress, ITileDatasource, ITileDirectory, ITileMetrics, TileDirectoryResult } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";
import { Tile } from "./tiles";

class TilePyramidNode<V extends object> extends Tile<WeakRef<V>> {
    _parent?: TilePyramidNode<V>;
    _childrens?: Array<TilePyramidNode<V>>;

    constructor(x: number, y: number, z: number, owner: TilePyramid<V>, parent?: TilePyramidNode<V>) {
        super(x, y, z, undefined, owner.metrics);
        this._parent = parent;
    }
}

class TilePyramidInfos {
    constructor(public depth: number = 0, public tileCount: number = 0) {}
}

export class TilePyramid<V extends object> implements ITileDirectory<V> {
    _root: TilePyramidNode<V>;
    _infos: TilePyramidInfos;

    public constructor(public metrics: ITileMetrics, public datasource: ITileDatasource<V, ITileAddress>) {
        this._infos = new TilePyramidInfos(0, 1);
        this._root = new TilePyramidNode<V>(0, 0, 0, this);
    }

    public get depth(): number {
        return this._infos.depth;
    }

    public get tileCount(): number {
        return this._infos.tileCount;
    }

    public lookupAsync(address: ITileAddress, args?: unknown): Promise<TileDirectoryResult<V>> {
        this.metrics.assertValidAddress(address);

        const n = this._lookup(address);
        let data = n._value?.deref();
        if (data) {
            return Promise.resolve(new TileDirectoryResult(address, data, args));
        }
        // data not present. Could be because it at not beeing initialized or garbage collected.
        const datasource = this.datasource;
        return new Promise((resolve, reject) => {
            if (datasource) {
                datasource
                    .fetchAsync(n)
                    .then((v) => {
                        n._value = v ? new WeakRef(v) : undefined;
                        resolve(new TileDirectoryResult(address, v, args));
                    })
                    .catch((e) => reject(e));
            }
        });
    }

    private _lookup(address: ITileAddress): TilePyramidNode<V> {
        const key = TileMetrics.TileXYToQuadKey(address);
        let lod = 0;
        let n = this._root;
        do {
            if (n._childrens === undefined) {
                const x = n.x << 1;
                const y = n.y << 1;
                const z = lod + 1;
                n._childrens = [
                    new TilePyramidNode<V>(x, y, z, this, n),
                    new TilePyramidNode<V>(x + 1, y, z, this, n),
                    new TilePyramidNode<V>(x, y + 1, z, this, n),
                    new TilePyramidNode<V>(x + 1, y + 1, z, this, n),
                ];
                this._infos.tileCount += 4;
                this._infos.depth = Math.max(this._infos.depth, z);
            }
            n = n._childrens[key[lod++]];
        } while (lod < key.length);
        return n;
    }
}
