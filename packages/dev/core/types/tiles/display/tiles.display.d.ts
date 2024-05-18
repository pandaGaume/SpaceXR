import { Observable, PropertyChangedEventArgs } from "../../events";
import { ISize2, ISize3 } from "../../geometry";
import { ITileDisplayBounds } from "../map";
export declare class TileDisplayBounds implements ITileDisplayBounds {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    _w: number;
    _h: number;
    constructor(w?: number | ISize2, h?: number);
    dispose(): void;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    get displayWidth(): number;
    get displayHeight(): number;
    get ratio(): number;
    resize(w: number | ISize2 | ISize3, h?: number): ITileDisplayBounds;
}
