import { Observable } from "../../events/events.observable";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { ISize2 } from "../../geometry/geometry.interfaces";
import { IValidable } from "../../types";
import { ITileDisplay } from "./tiles.pipeline.interfaces";
export declare class TileDisplay implements ITileDisplay, IValidable<TileDisplay> {
    _resizeObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>;
    _w: number;
    _h: number;
    _valid: boolean;
    constructor(w?: number, h?: number);
    dispose(): void;
    get isValid(): boolean;
    invalidate(): TileDisplay;
    validate(): TileDisplay;
    revalidate(): TileDisplay;
    get resizeObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>;
    get width(): number;
    get height(): number;
    setSize(w: number, h: number): ITileDisplay;
    protected _doValidateInternal(): void;
    protected _beforeValidate(): void;
    protected _doValidate(): void;
    protected _afterValidate(): void;
}
