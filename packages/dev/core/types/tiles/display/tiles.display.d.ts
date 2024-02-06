import { Observable, PropertyChangedEventArgs } from "../../events";
import { ISize2, ISize3 } from "../../geometry";
import { ITileDisplay } from "../map";
export declare class TileDisplay implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _w: number;
    _h: number;
    constructor(w?: number, h?: number);
    dispose(): void;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    get displayWidth(): number;
    get displayHeight(): number;
    get ratio(): number;
    resize(w: number | ISize2 | ISize3, h?: number): ITileDisplay;
}
