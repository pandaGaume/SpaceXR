import { Nullable } from "@babylonjs/core";
export declare enum WeightUnits {
    KG = "kg",
    STONE = "stone"
}
export declare enum LengthUnits {
    METER = "meter",
    FURLONG = "furlong"
}
export interface IUnits {
    weight: WeightUnits;
    length: LengthUnits;
}
export interface IViewSkin {
    name?: string;
    styles: any;
    dictionary: any;
    images: any;
    units?: IUnits;
}
export declare class Skin implements IViewSkin {
    name?: string;
    styles: any;
    dictionary: any;
    images: any;
    units?: IUnits;
    constructor(p: Partial<IViewSkin>);
}
export declare class SkinBuilder<T extends Skin> {
    _url?: string;
    _units?: IUnits;
    _name?: string;
    _styles: any;
    _dictionary: any;
    _images: any;
    constructor(url?: string);
    withName(name: string): SkinBuilder<T>;
    withUnits(units: IUnits): SkinBuilder<T>;
    withStyles(styles: any): SkinBuilder<T>;
    withDictionary(dictionary: any): SkinBuilder<T>;
    withImages(images: any): SkinBuilder<T>;
    withUrl(url: string): SkinBuilder<T>;
    build(ctor: new (p: Partial<T>) => T): Promise<Nullable<T>>;
    protected _fetchJson(url: string): Promise<any>;
    protected _buildRawData(data: any): any;
}
