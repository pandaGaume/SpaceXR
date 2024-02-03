import { Nullable } from "@babylonjs/core";
export interface IViewSkin {
    name?: string;
    styles: any;
    dictionary: any;
    images: any;
}
export declare class Skin implements IViewSkin {
    name?: string;
    styles: any;
    dictionary: any;
    images: any;
    constructor(p: Partial<IViewSkin>);
}
export declare class SkinBuilder<T extends Skin> {
    static readonly DefaultLang: string;
    _url?: string;
    _name?: string;
    _styles: any;
    _dictionary: any;
    _images: any;
    constructor(url?: string);
    withName(name: string): SkinBuilder<T>;
    withStyles(styles: any): SkinBuilder<T>;
    withDictionary(dictionary: any): SkinBuilder<T>;
    withImages(images: any): SkinBuilder<T>;
    withUrl(url: string): SkinBuilder<T>;
    buildAsync(ctor: new (p: Partial<T>) => T): Promise<Nullable<T>>;
    protected _fetchJsonWithLang(url: string, lang?: string): Promise<any>;
    protected _fetchJson(url: string): Promise<any>;
    protected _buildRawData(data: any): any;
}
