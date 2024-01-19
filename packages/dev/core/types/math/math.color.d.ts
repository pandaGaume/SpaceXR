import { ParametricValue } from "./math";
export declare class RGBAColor {
    r: number;
    g: number;
    b: number;
    a: number;
    static White(): RGBAColor;
    static Black(): RGBAColor;
    static NeonBlue(): RGBAColor;
    static LightGray(): RGBAColor;
    static Gray(): RGBAColor;
    constructor(r: number, g: number, b: number, a?: number);
    toHexString(): string;
    toHSL(): HSLColor;
    interpolate(color: RGBAColor, t: ParametricValue, keepAlpha?: boolean): RGBAColor;
    interpolateInPlace(color: RGBAColor, t: ParametricValue, keepAlpha?: boolean): RGBAColor;
    toString(): string;
}
export declare class HSLColor {
    h: number;
    s: number;
    l: number;
    private static hue2rgb;
    constructor(h: number, s: number, l: number);
    toRGB(): RGBAColor;
}
