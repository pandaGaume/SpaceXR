import { Observable, PropertyChangedEventArgs } from "../../events";
import { IGeoCalculator } from "../../geodesy";
import { ISize2, ISize3 } from "../../geometry";
import { DisplayUnit, ITileDisplay } from "../map";
export declare class TileDisplay implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _w: number;
    _h: number;
    _unit: DisplayUnit;
    _geodesicCalculator?: IGeoCalculator;
    constructor(w?: number, h?: number, u?: DisplayUnit, _geodesicCalculator?: IGeoCalculator);
    dispose(): void;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    get displayWidth(): number;
    get displayHeight(): number;
    get displayUnit(): DisplayUnit;
    resize(w: number | ISize2 | ISize3, h?: number): ITileDisplay;
}
