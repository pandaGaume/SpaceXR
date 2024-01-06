import { IRectangle } from "../geometry/geometry.interfaces";
import { IEnvelope, IsEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileCollection } from "./tiles.interfaces";
import { TileAddress } from "./address/tiles.address";
import { Envelope } from "../geography/geography.envelope";
import { Rectangle } from "../geometry/geometry.rectangle";

export class TileCollection<T> implements ITileCollection<T> {
    private _index?: Map<string, ITile<T>>;
    private _items: Array<ITile<T>>;
    private _bounds?: IEnvelope;
    private _rect?: IRectangle;

    public constructor(...items: Array<ITile<T>>) {
        this._items = items;
    }

    public get count(): number {
        return this._items.length;
    }

    public get index(): Map<string, ITile<T>> {
        if (!this._index) {
            this._index = this._buildIndex();
        }
        return this._index;
    }

    public get bounds(): IEnvelope | undefined {
        if (!this._bounds) {
            this._bounds = this._buildBounds();
        }
        return this._bounds;
    }

    public get rect(): IRectangle | undefined {
        if (!this._rect) {
            this._rect = this._buildRect();
        }
        return this._rect;
    }

    public has(address: ITileAddress): boolean {
        return this.index.has(address.quadkey);
    }

    public get(address: ITileAddress): ITile<T> | undefined {
        return this.index.get(address.quadkey);
    }

    public getAll(...address: Array<ITileAddress>): Array<ITile<T> | undefined> {
        return address.map((a) => this.get(a));
    }

    public add(tile: ITile<T>): void {
        if (!this.has(tile.address)) {
            this._items.push(tile);
            this._index?.set(tile.quadkey, tile);
            const b = tile.bounds;
            if (b && this._bounds) {
                this._bounds.unionInPlace(b);
            }
            const r = tile.rect;
            if (r && this._rect) {
                this._rect.unionInPlace(r);
            }
        }
    }

    public addAll(...tiles: Array<ITile<T>>): void {
        for (const t of tiles) {
            this.add(t);
        }
    }

    public remove(address: ITileAddress): void {
        if (this.has(address)) {
            const index = this._items.findIndex((t) => TileAddress.IsEquals(t.address, address));
            this._items.splice(index, 1);
            this._bounds = undefined;
            this._rect = undefined;
            this._index?.delete(address.quadkey);
        }
    }

    public removeAll(...address: Array<ITileAddress>): void {
        for (const a of address) {
            this.remove(a);
        }
    }

    public clear(): void {
        this._items = [];
        this._bounds = undefined;
        this._rect = undefined;
    }

    public intersect(bounds?: IRectangle | IEnvelope): IterableIterator<ITile<T>> {
        if (!bounds) return this[Symbol.iterator]();

        let pointer = 0;
        let items = this._items;

        if (IsEnvelope(bounds)) {
            // this is an envelope
            if (this.bounds?.intersect(bounds)) {
                // with a valid intersection with the collection
                return {
                    next(): IteratorResult<ITile<T>> {
                        while (pointer < items.length) {
                            let item = items[pointer++];
                            let b = item.bounds;
                            if (!b || bounds.intersect(b)) {
                                return {
                                    done: false,
                                    value: item,
                                };
                            }
                        }
                        return {
                            done: true,
                            value: null as any,
                        };
                    },
                    [Symbol.iterator]() {
                        return this;
                    },
                };
            }
        } else {
            // this is a rectangle
            if (this.rect?.intersect(bounds)) {
                // with a valid intersection with the collection
                return {
                    next(): IteratorResult<ITile<T>> {
                        while (pointer < items.length) {
                            let item = items[pointer++];
                            let r = item.rect;
                            if (!r || bounds.intersect(r)) {
                                return {
                                    done: false,
                                    value: item,
                                };
                            }
                        }
                        return {
                            done: true,
                            value: null as any,
                        };
                    },
                    [Symbol.iterator]() {
                        return this;
                    },
                };
            }
        }
        // reach this point means there is no intersection with the collection
        // so we return an empty iterator
        return {
            next(): IteratorResult<ITile<T>> {
                return {
                    done: true,
                    value: null as any,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
    }

    public [Symbol.iterator](): IterableIterator<ITile<T>> {
        let pointer = 0;
        let items = this._items;

        const iterator: IterableIterator<ITile<T>> = {
            next(): IteratorResult<ITile<T>> {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++],
                    };
                }

                return {
                    done: true,
                    value: null as any,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }

    protected _buildIndex(): Map<string, ITile<T>> {
        const index = new Map<string, ITile<T>>();
        for (let i = 0; i < this._items.length; i++) {
            const t = this._items[i];
            index.set(t.quadkey, t);
        }
        return index;
    }

    protected _buildBounds(): IEnvelope | undefined {
        return Envelope.FromEnvelopes(...this._items);
    }

    protected _buildRect(): IRectangle | undefined {
        return Rectangle.FromRectangles(...this._items);
    }
}
