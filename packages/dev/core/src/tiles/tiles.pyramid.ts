import { Observable } from "core/events/events.observable";
import { ITile, ITileAddress } from "./tiles.interfaces";
import { TileMetricsOptions } from "./tiles.metrics";

class TilePyramidNode<V, T extends ITile<V>> {
    owner: TilePyramid<V, T>;
    parent:TilePyramidNode<V,T>
    v?: T;
    childrens?: TilePyramidNode<V, T>[];

    constructor(owner: TilePyramid<V, T>, parent:TilePyramidNode<V,T>) {
        this.owner = owner;
        this.parent = parent;
    }

    fold(id: ITileAddress, keys: Array<number>, level: number) {
        if (this.childrens) {
            if (++level < keys.length) {
                for (const c of this.childrens) {
                    c?.fold(id, keys, level);
                }
            }
            this.childrens = undefined;
        }
    }

    unfold(id: ITileAddress, keys: Array<number>, level: number) {
        if (this.childrens === undefined) {
            this.childrens = Array.from({ length: 4 }, (v, k) => new TilePyramidNode<V, T>(this.owner, this));
        }
        if (++level < keys.length) {
            this.childrens[keys[level]].unfold(id, keys, level);
        }
    }

    lookup(id: ITileAddress, keys: Array<number>, level: number): TilePyramidNode<V, T> | undefined {
        if (this.childrens) {
            const n = this.childrens[keys[level++]];
            if (level < keys.length) {
                return n.lookup(id, keys, level);
            }
            return n;
        }
        return undefined;
    }
}

export class TilePyramidOptions {
    public static Shared: TilePyramidOptions = {
        maxDepth: TileMetricsOptions.DefaultMaxLOD,
    };

    maxDepth?: number;
}

export class TilePyramidOptionsBuilder {
    _maxDepth?: number;

    public withMaxDepth(depth: number): TilePyramidOptionsBuilder {
        this._maxDepth = depth;
        return this;
    }

    public build(): TilePyramidOptions {
        return <TilePyramidOptions>{ maxDepth: this._maxDepth };
    }
}

export class TilePyramid<V, T extends ITile<V>> {
    public static TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): number[] {
        const quadKey = [levelOfDetail];
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

    _o: TilePyramidOptions;
    _root?: TilePyramidNode<V, T>;
    _tilesObservable?: Observable<T>;

    public constructor(options: TilePyramidOptions) {
        this._o = { ...TilePyramidOptions.Shared, ...options };
    }

    public get tilesObservable(): Observable<T> {
        this._tilesObservable = this._tilesObservable || new Observable<T>();
        return this._tilesObservable;
    }

    public get maxDepth(): number {
        return this._o.maxDepth || TileMetricsOptions.DefaultMaxLOD;
    }

    public lookup(id: ITileAddress): T | undefined {
        return this.lookup0(id)?.v;
    }

    public unfold(id: ITileAddress) {
        if (id && id.levelOfDetail <= this.maxDepth) {
            const key = TilePyramid.TileXYToQuadKey(id.x, id.y, id.levelOfDetail);
            this._root?.unfold(id, key, 0);
        }
    }

    public fold(id: ITileAddress) {
        if (id && id.levelOfDetail <= this.maxDepth) {
            const key = TilePyramid.TileXYToQuadKey(id.x, id.y, id.levelOfDetail);
            this._root?.fold(id, key, 0);
        }
    }

    private lookup0(id: ITileAddress): TilePyramidNode<V, T> | undefined {
        if (id && id.levelOfDetail <= this.maxDepth) {
            const key = TilePyramid.TileXYToQuadKey(id.x, id.y, id.levelOfDetail);
            return this._root?.lookup(id, key, 0);
        }
        return undefined;
    }
}
