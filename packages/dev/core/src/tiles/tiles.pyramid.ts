import { Observable } from "core/events/events.observable";
import { ITile, ITileAddress, ITileSystem } from "./tiles.interfaces";
import { Nullable } from "core/types";

class TilePyramidNode<V, T extends ITile<V>> {
    _owner: TilePyramid<V, T>;
    _parent: TilePyramidNode<V, T>;
    _value?: WeakRef<T>;
    _childrens?: Array<TilePyramidNode<V, T>>;

    constructor(owner: TilePyramid<V, T>, parent: TilePyramidNode<V, T>) {
        this._owner = owner;
        this._parent = parent;
    }
}

export class TilePyramid<V, T extends ITile<V>> {
    public static TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): Uint8Array {
        const quadKey = new Uint8Array(levelOfDetail);
        let j = 0;
        for (let i = levelOfDetail; i > 0; i--) {
            let digit = 0;
            let mask = 1 << (i - 1);
            if ((tileX & mask) != 0) {
                digit++;
            }
            if ((tileY & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey[j++] = digit;
        }
        return quadKey;
    }

    _system: ITileSystem<V, T, ITileAddress>;
    _root?: TilePyramidNode<V, T>;
    _tilesObservable?: Observable<T>;

    public constructor(system: ITileSystem<V, T, ITileAddress>) {
        this._system = system;
    }

    public get tilesObservable(): Observable<T> {
        this._tilesObservable = this._tilesObservable || new Observable<T>();
        return this._tilesObservable;
    }

    public get maxDepth(): number {
        return this._system.metrics.maxLOD;
    }

    public async lookupAsync(id: ITileAddress): Promise<T | undefined> {
        const n = this.lookup(id);
        if (n) {
            if (n._value) {
                return n._value.deref();
            }
            let data;
            try {
                data = await Promise.all(this._system.client.map(async (c, i) => c.fetchAsync(id)));
            } catch (e) {
            } finally {
                if (data) {
                    const tile = <T>this._system.builder.build(data, id);
                    n._value = new WeakRef(tile);
                    return tile;
                }
            }
        }
        return undefined;
    }

    private lookup(id: ITileAddress): TilePyramidNode<V, T> | undefined {
        if (id && id.levelOfDetail <= this.maxDepth) {
            const key = TilePyramid.TileXYToQuadKey(id.x, id.y, id.levelOfDetail);
            let i = 0;
            if (i < key.length && this._root) {
                let n = this._root;
                do {
                    n._childrens = n._childrens || Array.from({ length: 4 }, (v, i) => new TilePyramidNode<V, T>(this, n));
                    n = n._childrens[key[i++]];
                } while (i < key.length);
                return n;
            }
        }
        return undefined;
    }
}
