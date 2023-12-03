import { Nullable } from "@babylonjs/core";

export enum WeightUnits {
    KG = "kg",
    STONE = "stone",
}

export enum LengthUnits {
    METER = "meter",
    FURLONG = "furlong",
}

export interface IUnits {
    weight: WeightUnits;
    length: LengthUnits;
}

export interface IViewSkin {
    // TODO : add Build Property Block to skin
    name?: string;
    styles: any;
    dictionary: any;
    images: any;
    units?: IUnits;
}

export class Skin implements IViewSkin {
    name?: string;
    styles: any;
    dictionary: any;
    images: any;
    units?: IUnits;

    public constructor(p: Partial<IViewSkin>) {
        Object.assign(this, p);
    }
}

export class SkinBuilder<T extends Skin> {
    public static readonly DefaultLang: string = "en";

    _url?: string;
    _units?: IUnits;
    _name?: string;
    _styles: any;
    _dictionary: any;
    _images: any;

    public constructor(url?: string) {
        this._url = url;
    }

    public withName(name: string): SkinBuilder<T> {
        this._url = name;
        return this;
    }

    public withUnits(units: IUnits): SkinBuilder<T> {
        this._units = units;
        return this;
    }

    public withStyles(styles: any): SkinBuilder<T> {
        this._styles = styles;
        return this;
    }

    public withDictionary(dictionary: any): SkinBuilder<T> {
        this._dictionary = dictionary;
        return this;
    }

    public withImages(images: any): SkinBuilder<T> {
        this._images = images;
        return this;
    }

    public withUrl(url: string): SkinBuilder<T> {
        this._url = url;
        return this;
    }

    public async buildAsync(ctor: new (p: Partial<T>) => T): Promise<Nullable<T>> {
        let rawData: any = null;
        if (this._url) {
            rawData = await this._fetchJson(this._url);
        } else {
            rawData = this._buildRawData({
                name: this._name,
                styles: this._styles,
                dictionary: this._dictionary,
                images: this._images,
                units: this._units,
            });
        }
        if (rawData) {
            const skin = new ctor(rawData);
            if (typeof skin.styles === "string") {
                skin.styles = await this._fetchJsonWithLang(skin.styles);
            }
            if (typeof skin.dictionary === "string") {
                skin.dictionary = await this._fetchJsonWithLang(skin.dictionary);
            }
            if (typeof skin.images === "string") {
                skin.images = await this._fetchJsonWithLang(skin.images);
            }
            return skin;
        }
        return null;
    }

    protected async _fetchJsonWithLang(url: string, lang?: string): Promise<any> {
        if (url) {
            // very basic language detection
            if (!lang) {
                const langage = navigator.language ?? SkinBuilder.DefaultLang;
                lang = langage.substring(0, 2);
            }
            let modifiedUrl = url.replace("{lang}", lang);

            let response = await fetch(modifiedUrl);
            if (response.ok) {
                return await response.json();
            } else {
                if (lang != SkinBuilder.DefaultLang) {
                    return await this._fetchJsonWithLang(url, SkinBuilder.DefaultLang);
                }
                console.log(`Failed to load ${url}: ${response.status}`);
            }
        }
        return null;
    }

    protected async _fetchJson(url: string): Promise<any> {
        if (url) {
            const response = await fetch(url);
            if (response.ok) {
                return await response.json();
            } else {
                console.log(`Failed to load ${url}: ${response.status}`);
            }
        }
        return null;
    }

    protected _buildRawData(data: any): any {
        return data;
    }
}
