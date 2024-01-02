import { Observable } from "../../events/events.observable";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { ITileDisplay } from "../tiles.interfaces";
export declare class TileDisplay implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _x: number;
    _y: number;
    _w: number;
    _h: number;
    constructor(x?: number, y?: number, w?: number, h?: number);
    dispose(): void;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    get x(): number;
    get y(): number;
    get width(): number;
    get height(): number;
    translate(x: number, y: number): ITileDisplay;
    resize(w: number, h: number): ITileDisplay;
}
