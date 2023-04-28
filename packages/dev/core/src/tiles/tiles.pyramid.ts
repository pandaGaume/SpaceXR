import { ITile, ITileAddress, ITileDatasource, ITileDirectory, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { TileMetrics } from "./tiles.metrics";


export type LOOKUP_RESULT<V> = V | Array<Nullable<V>> | undefined ;

class TilePyramidNode<V extends object> implements ITile<LOOKUP_RESULT<V>>, ITileAddress {
    _owner: TilePyramid<V>;
    _parent?: TilePyramidNode<V>;
    _childrens?: Array<TilePyramidNode<V>>;

    _x: number;
    _y: number;
    _z: number;
    _value?: WeakRef<V | Array<Nullable<V>>>;

    constructor(x: number, y: number, z: number, owner: TilePyramid<V>, parent?: TilePyramidNode<V>) {
        this._x = x;
        this._y = y;
        this._z = z;
        this._owner = owner;
        this._parent = parent;
    }

    public get address(): ITileAddress | undefined {
        return this;
    }

    public get data(): LOOKUP_RESULT<V> {
        return this._value?.deref();
    }

    public get x(): number {
        return this._x;
    }
    public get y(): number {
        return this._y;
    }
    public get levelOfDetail(): number {
        return this._z;
    }
}

class TilePyramidInfos {
    constructor(public depth: number = 0, public tileCount: number = 0) {}
}

export class TilePyramid<V extends object> implements ITileDirectory<V, ITileAddress> {
    _root: TilePyramidNode<V>;
    _infos: TilePyramidInfos;

    public constructor(public metrics: ITileMetrics, public datasources: ITileDatasource<V, ITileAddress> | Array<ITileDatasource<V, ITileAddress>>) {
        this._infos = new TilePyramidInfos(0, 1);
        this._root = new TilePyramidNode<V>(0, 0, 0, this);
    }

    public get depth(): number {
        return this._infos.depth;
    }

    public get tileCount(): number {
        return this._infos.tileCount;
    }

    public async lookupAsync(x: number, y: number, levelOfDetail: number): Promise<LOOKUP_RESULT<V>> {
        this.metrics.assertValidAddress(x, y, levelOfDetail);

        const n = this.lookup(x, y, levelOfDetail);
        let data: Nullable<V> | Nullable<V>[] | undefined = n._value?.deref();
        if (data) {
            return data;
        }
        // data not present. Could be because it at not beeing initialized or garbage collected.
        if (this.datasources) {
            try {
                if (this.datasources instanceof Array) {
                    if( this.datasources.length ){
                        data = await Promise.all(this.datasources.map(async (c, i) => c.fetchAsync(n)));
                    }
                } else {
                    data = await this.datasources.fetchAsync(n);
                }
            } catch (e) {
            } finally {
                if (data) {
                    n._value = new WeakRef(data);
                } else {
                    n._value = undefined;
                }
                return n.data;
            }
        }
        return undefined;
    }

    private lookup(tileX: number, tileY: number, levelOfDetail: number): TilePyramidNode<V> {
        const key = TileMetrics.TileXYToQuadKey(tileX, tileY, levelOfDetail);
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
