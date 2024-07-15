import { IVectorTileStyle } from "./tiles.vector.interfaces";

export class VectorStyle implements IVectorTileStyle {
    public static DefaultStrokeStyle = "blue";
    public static DefaultFillStyle = "grey";
    public static DefaultOpacity = 1;
    public static DefaultWeight = 1;

    protected _dashArray?: Array<number>;
    protected _color?: string;
    protected _weight?: number;
    protected _stroke?: boolean;
    protected _opacity?: number;
    protected _fill?: boolean;
    protected _fillColor?: string;
    protected _fillOpacity?: number;

    public constructor(options?: Partial<IVectorTileStyle>) {
        this._dashArray = options?.dashArray;
        this._color = options?.color;
        this._weight = options?.weight;
        this._stroke = options?.stroke;
        this._opacity = options?.opacity;
        this._fill = options?.fill;
        this._fillColor = options?.fillColor;
        this._fillOpacity = options?.fillOpacity;
    }

    public get dashArray(): Array<number> | undefined {
        return this._dashArray;
    }

    public get color(): string | undefined {
        return this._color;
    }
    public get weight(): number | undefined {
        return this._weight;
    }
    public get stroke(): boolean | undefined {
        return this._stroke;
    }
    public get opacity(): number | undefined {
        return this._opacity;
    }
    public get fill(): boolean | undefined {
        return this._fill;
    }
    public get fillColor(): string | undefined {
        return this._fillColor;
    }
    public get fillOpacity(): number | undefined {
        return this._fillOpacity;
    }
}
