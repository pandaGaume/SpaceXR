import { ParametricValue, Scalar } from "./math";

export class RGBAColor {
    public static White(): RGBAColor {
        return new RGBAColor(255, 255, 255);
    }

    public static Black(): RGBAColor {
        return new RGBAColor(0, 0, 0);
    }

    public static LightGray(): RGBAColor {
        return new RGBAColor(211, 211, 211);
    }

    public static Gray(): RGBAColor {
        return new RGBAColor(128, 128, 128);
    }

    public static CoolSteelBlue(): RGBAColor {
        return new RGBAColor(70, 130, 180);
    }

    public static ElectricBlue(): RGBAColor {
        return new RGBAColor(0, 191, 255);
    }

    public static NeonBlue(): RGBAColor {
        return new RGBAColor(77, 77, 255);
    }

    public constructor(public r: number, public g: number, public b: number, public a: number = 1) {}

    public toHexString(): string {
        const intR = Math.round(this.r);
        const intG = Math.round(this.g);
        const intB = Math.round(this.b);
        return "#" + Scalar.ToHex(intR) + Scalar.ToHex(intG) + Scalar.ToHex(intB);
    }

    public toHSL(): HSLColor {
        const r = this.r / 255;
        const g = this.g / 255;
        const b = this.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h: number, s: number;
        const l: number = (max + min) / 2;

        if (max == min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
                default:
                    // to avoid compilation issue.
                    h = 0;
                    break;
            }
            h /= 6;
        }

        return new HSLColor(h, s, l);
    }

    public interpolate(color: RGBAColor, t: ParametricValue, keepAlpha = true): RGBAColor {
        t = t || 0.5;
        const r = Math.round(this.r + t * (color.r - this.r));
        const g = Math.round(this.g + t * (color.g - this.g));
        const b = Math.round(this.b + t * (color.b - this.b));
        const a = keepAlpha ? this.a : Math.round(this.a + t * (color.a - this.a));
        return new RGBAColor(r, g, b, a);
    }

    public interpolateInPlace(color: RGBAColor, t: ParametricValue, keepAlpha = true): RGBAColor {
        t = t || 0.5;
        this.r = Math.round(this.r + t * (color.r - this.r));
        this.g = Math.round(this.g + t * (color.g - this.g));
        this.b = Math.round(this.b + t * (color.b - this.b));
        this.a = keepAlpha ? this.a : Math.round(this.a + t * (color.a - this.a));
        return this;
    }

    public toString(): string {
        return `rgb(${this.r},${this.g},${this.b})`;
    }
}

export class HSLColor {
    private static hue2rgb(p: number, q: number, t: number): number {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }

    public constructor(public h: number, public s: number, public l: number) {}

    public toRGB(): RGBAColor {
        let l = this.l;
        if (this.s === 0) {
            l = Math.round(l * 255);
            return new RGBAColor(l, l, l);
        }
        const s = this.s;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = HSLColor.hue2rgb(p, q, this.h + 1 / 3);
        const g = HSLColor.hue2rgb(p, q, this.h);
        const b = HSLColor.hue2rgb(p, q, this.h - 1 / 3);
        return new RGBAColor(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    }
}
