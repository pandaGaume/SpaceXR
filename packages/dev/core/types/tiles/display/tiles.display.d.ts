import { Observable } from "../../events/events.observable";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { ITileDisplay } from "../tiles.interfaces";
export declare class TileDisplay implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _w: number;
    _h: number;
    constructor(w?: number, h?: number);
    dispose(): void;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    get width(): number;
    get height(): number;
    resize(w: number, h: number): ITileDisplay;
}
