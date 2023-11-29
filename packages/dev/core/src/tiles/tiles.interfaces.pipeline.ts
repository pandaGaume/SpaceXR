import { EventArgs } from "../events/events.args";
import { Observable } from "../events/events.observable";
import { Nullable } from "../types";
import { ITile, ITileAddress, ITileMetricsProvider, TileContent } from "./tiles.interfaces";

export class ContentUpdateEventArgs<T> extends EventArgs<ITileContentProvider<T>> {
    _address: ITileAddress;
    _content: TileContent<T>;

    public constructor(address: ITileAddress, content: TileContent<T>, sender: ITileContentProvider<T>) {
        super(sender);
        this._address = address;
        this._content = content;
    }

    public get address(): ITileAddress {
        return this._address;
    }

    public get content(): TileContent<T> {
        return this._content;
    }
}

export interface ITileContentProvider<T> extends ITileMetricsProvider {
    id?: string;
    contentUpdateObservable: Observable<ContentUpdateEventArgs<T>>;
    getTileContent(address: ITileAddress): Nullable<TileContent<T>>;
}

export interface ITileProvider<T> extends ITileMetricsProvider {
    getTile(address: ITileAddress): Nullable<ITile<T>>;
}
