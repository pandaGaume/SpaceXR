export interface IShapeDrawOptions {
    /// <summary>
    /// A boolean value that specifies whether to draw the shape stroke.
    /// Set it to false to disable border on polygons or circles.
    /// </summary>
    stroke: boolean;

    /// <summary>
    /// An Array of numbers that specify distances to alternately draw a line and a gap (in coordinate space units).
    /// If the number of elements in the array is odd, the elements of the array get copied and concatenated.
    /// For example, [5, 15, 25] will become [5, 15, 25, 5, 15, 25].
    /// If the array is empty, the line dash list is cleared and line strokes return to being solid.
    /// </summary>
    dashArray?: Array<number>;

    /// <summary>
    /// A string parsed as CSS <color> value.
    /// </summary>
    color?: string;
    opacity?: number;

    /// <summary>
    /// A number specifying the line width, in coordinate space units.
    /// Zero, negative, Infinity, and NaN values are ignored.
    /// This value is 1.0 by default.
    /// </summary>
    weight?: number;

    fill?: boolean;

    fillColor?: string;
    fillOpacity?: number;
}

export interface IDecoratedShape<T> {
    shape: T;
    options?: IShapeDrawOptions;
}

export function isDecoratedShape<T>(b: any): b is IDecoratedShape<T> {
    if (typeof b !== "object" || b === null) return false;
    return b.shape !== undefined && b.options !== undefined;
}

export class DecoratedShape<T> implements IDecoratedShape<T> {
    private _shape: T;
    private _options?: IShapeDrawOptions;

    public constructor(shape: T, options?: IShapeDrawOptions) {
        this._shape = shape;
        this._options = options;
    }

    public get shape(): T {
        return this._shape;
    }

    public get options(): IShapeDrawOptions | undefined {
        return this._options;
    }
}
