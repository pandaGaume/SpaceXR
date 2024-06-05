import { Observable, PropertyChangedEventArgs } from "../../events";
import { Size2, ISize2, ISize3 } from "../../geometry";
import { ITileDisplayBounds } from "../map";
export declare class TileDisplayBounds extends Size2 implements ITileDisplayBounds {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    constructor(w?: number | ISize2, h?: number);
    dispose(): void;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    get ratio(): number;
    resize(w: number | ISize2 | ISize3, h?: number): ITileDisplayBounds;
}
