import { SpectralClass, MKLuminosity, MorganKeenanName, MorganKeenanClass } from "./space.spectralClass";
import { Temperature } from "../math/math.units";
import { RGBAColor } from "../math/math.color";
export interface ColorInfoPair {
    key: MorganKeenanName;
    value: {
        x: number;
        y: number;
        r: number;
        g: number;
        b: number;
        color?: string;
    };
}
export declare class ColorValue {
    mk: MorganKeenanClass;
    sclass: SpectralClass;
    kelvin: number;
    color: RGBAColor;
    constructor(mk: MorganKeenanClass, sclass: SpectralClass, kelvin: number, color: RGBAColor);
}
export declare class StarColor {
    private static ColorTable;
    private static _buildIndex;
    private static _SelectByLuminosity;
    private static Matrix;
    private static _lookup;
    private static _lookupIndexes;
    static lookupRgb(luminosity: MKLuminosity, temperature: Temperature | number): RGBAColor;
}
