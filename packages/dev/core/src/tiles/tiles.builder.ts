import { ICompoundTile, ITile, ITileAddress, ITileBuilder, ITileMetrics, IsCompoundTile, TileContentType } from "./tiles.interfaces";
import { Tile } from "./tiles";
import { CompoundTile } from "./tiles.compound";

export class TileBuilder<T> implements ITileBuilder<T> {
    public static SharedBuilder<T>(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    _ns?: string;
    _a?: ITileAddress;
    _d?: TileContentType<T>;
    _m?: ITileMetrics;
    _t?: new (...args: any[]) => ITile<T>;
    _c?: Array<ITile<T>>;

    public withNamespace(namesapce: string): ITileBuilder<T> {
        this._ns = namesapce;
        return this;
    }

    public withAddress(a: ITileAddress): ITileBuilder<T> {
        this._a = a;
        return this;
    }

    public withData(d: TileContentType<T>): ITileBuilder<T> {
        this._d = d;
        return this;
    }

    public withMetrics(metrics: ITileMetrics): ITileBuilder<T> {
        this._m = metrics;
        return this;
    }

    public withType(type: new (...args: any[]) => ITile<T>): ITileBuilder<T> {
        this._t = type;
        return this;
    }

    /// <summary>
    /// Adds childrens to the tile. This is only valid for compound tiles type.
    /// </summary>
    public withChildren(...children: Array<ITile<T>>): ITileBuilder<T> {
        this._c = this._c ?? [];
        this._c.push(...children);
        return this;
    }

    /// <summary>
    /// Clears the childrens of the tile.
    /// </summary>
    public whithEmptyChildren(): ITileBuilder<T> {
        this._c = undefined;
        return this;
    }

    public build(): ITile<T> | ICompoundTile<T> {
        const type = this._t ?? (this._c ? CompoundTile<T> : Tile<T>);
        const t = new type(this._a?.x || 0, this._a?.y || 0, this._a?.levelOfDetail || this._m?.minLOD || 0, this._d || null);
        if (this._m) {
            t.bounds = Tile.BuildEnvelope(t.address, this._m);
            t.rect = Tile.BuildBounds(t.address, this._m);
        }
        // while we may have type defined, we ensure this is compoundTile before trying to set childrens.
        if (this._c && IsCompoundTile(t)) {
            t.addChildTiles(...this._c);
        }

        return t;
    }
}
