import { Observable, PropertyChangedEventArgs } from "../../events";
import { ITileProvider } from "../tiles.interfaces";
import { ITileMapLayer } from "./tiles.map.interfaces";
export declare class TileMapLayer<T> implements ITileMapLayer<T> {
    _propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>> | undefined;
    _name: string;
    _provider: ITileProvider<T>;
    _zindex: number;
    _alpha: number;
    _enabled: boolean;
    constructor(name: string, provider: ITileProvider<T>, zindex?: number, alpha?: number, enabled?: boolean);
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>>;
    get name(): string;
    set name(name: string);
    get provider(): ITileProvider<T>;
    get zindex(): number;
    set zindex(zindex: number);
    get alpha(): number;
    set alpha(alpha: number);
    get enabled(): boolean;
    set enabled(enabled: boolean);
}
