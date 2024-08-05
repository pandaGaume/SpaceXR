import { Observable, PropertyChangedEventArgs } from "../../events";
import { ISize2, ISize3 } from "../../geometry";
import { IDisplay } from "../map";
export declare class Display implements IDisplay {
    private _propertyChangedObservable?;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<IDisplay, unknown>>;
    private _resolution;
    constructor(resolution: ISize2 | ISize3);
    get resolution(): ISize3;
    resize(width: number, height: number, thickness?: number): void;
    dispose(): void;
}
