import { IFormatter, IXmlSerializerFormatOptions, NumberFormatter } from "../xml";
import type { I3mfRGBAColor } from "./3mf.types";

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * In the XSD, ST_Matrix3D is a whitespace separated list of numbers.
 * The official 3MF core spec uses a 3x4 matrix (12 numbers).
 */
export type ST_Matrix3D = [number, number, number, number, number, number, number, number, number, number, number, number];

/**
 *
 */
export class Matrix3d {
    /**
     *
     * @returns
     */
    public static Zero() {
        return new Matrix3d([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    /**
     *
     * @param values
     */
    public constructor(public values: ST_Matrix3D) {}

    /**
     *
     * @returns
     */
    public toString(): string {
        return this.values.join(" ");
    }
}

export class  MatrixFormatter implements IFormatter<Matrix3d> {
    
    _f:NumberFormatter;

    public constructor(public o:IXmlSerializerFormatOptions){
        this._f = new NumberFormatter(o);
    }

    public toString(x: Matrix3d): string {
        return x.values.map(v=>this._f.toString(v)).join(" ");
    }
}


/**
 *
 * @param c
 * @returns
 */
export function RgbaToHex(c: I3mfRGBAColor | { r: number; g: number; b: number; a?: number }): string {
    const toSRGB = (c: number) => Math.round(Math.min(255, Math.max(0, Math.pow(c, 1 / 2.2) * 255)));

    const r = toSRGB(c.r).toString(16).padStart(2, "0").toUpperCase();
    const g = toSRGB(c.g).toString(16).padStart(2, "0").toUpperCase();
    const b = toSRGB(c.b).toString(16).padStart(2, "0").toUpperCase();

    if (typeof (c as any).a === "number") {
        const a = Math.round(Math.min(255, Math.max(0, c.a! * 255)))
            .toString(16)
            .padStart(2, "0")
            .toUpperCase();
        return `#${r}${g}${b}${a}`;
    }

    return `#${r}${g}${b}`;
}
