import { Nullable } from "../../types";
import { IDecoratedShape, IShapeDrawOptions } from "./tiles.vector.interfaces";


export class DecoratedShape<T> implements IDecoratedShape<T> {
    private _value: T;
    private _options: Nullable<IShapeDrawOptions>;

    public constructor(shape: T, options: Nullable<IShapeDrawOptions>) {
        this._value = shape;
        this._options = options ?? null;
    }

    public get value(): T {
        return this._value;
    }

    public get options(): Nullable<IShapeDrawOptions> {
        return this._options;
    }
}
