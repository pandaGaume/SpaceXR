import { ParametricValue, Scalar } from "./math";

export class RGBAColor {
    // css color module level 3
    static aliceblue: RGBAColor = new RGBAColor(240, 248, 255);
    static antiquewhite: RGBAColor = new RGBAColor(250, 235, 215);
    static aqua: RGBAColor = new RGBAColor(0, 255, 255);
    static aquamarine: RGBAColor = new RGBAColor(127, 255, 212);
    static azure: RGBAColor = new RGBAColor(240, 255, 255);
    static beige: RGBAColor = new RGBAColor(245, 245, 220);
    static bisque: RGBAColor = new RGBAColor(255, 228, 196);
    static black: RGBAColor = new RGBAColor(0, 0, 0);
    static blanchedalmond: RGBAColor = new RGBAColor(255, 235, 205);
    static blue: RGBAColor = new RGBAColor(0, 0, 255);
    static blueviolet: RGBAColor = new RGBAColor(138, 43, 226);
    static brown: RGBAColor = new RGBAColor(165, 42, 42);
    static burlywood: RGBAColor = new RGBAColor(222, 184, 135);
    static cadetblue: RGBAColor = new RGBAColor(95, 158, 160);
    static chartreuse: RGBAColor = new RGBAColor(127, 255, 0);
    static chocolate: RGBAColor = new RGBAColor(210, 105, 30);
    static coral: RGBAColor = new RGBAColor(255, 127, 80);
    static cornflowerblue: RGBAColor = new RGBAColor(100, 149, 237);
    static cornsilk: RGBAColor = new RGBAColor(255, 248, 220);
    static crimson: RGBAColor = new RGBAColor(220, 20, 60);
    static cyan: RGBAColor = new RGBAColor(0, 255, 255);
    static darkblue: RGBAColor = new RGBAColor(0, 0, 139);
    static darkcyan: RGBAColor = new RGBAColor(0, 139, 139);
    static darkgoldenrod: RGBAColor = new RGBAColor(184, 134, 11);
    static darkgray: RGBAColor = new RGBAColor(169, 169, 169);
    static darkgreen: RGBAColor = new RGBAColor(0, 100, 0);
    static darkgrey: RGBAColor = new RGBAColor(169, 169, 169);
    static darkkhaki: RGBAColor = new RGBAColor(189, 183, 107);
    static darkmagenta: RGBAColor = new RGBAColor(139, 0, 139);
    static darkolivegreen: RGBAColor = new RGBAColor(85, 107, 47);
    static darkorange: RGBAColor = new RGBAColor(255, 140, 0);
    static darkorchid: RGBAColor = new RGBAColor(153, 50, 204);
    static darkred: RGBAColor = new RGBAColor(139, 0, 0);
    static darksalmon: RGBAColor = new RGBAColor(233, 150, 122);
    static darkseagreen: RGBAColor = new RGBAColor(143, 188, 143);
    static darkslateblue: RGBAColor = new RGBAColor(72, 61, 139);
    static darkslategray: RGBAColor = new RGBAColor(47, 79, 79);
    static darkslategrey: RGBAColor = new RGBAColor(47, 79, 79);
    static darkturquoise: RGBAColor = new RGBAColor(0, 206, 209);
    static darkviolet: RGBAColor = new RGBAColor(148, 0, 211);
    static deeppink: RGBAColor = new RGBAColor(255, 20, 147);
    static deepskyblue: RGBAColor = new RGBAColor(0, 191, 255);
    static dimgray: RGBAColor = new RGBAColor(105, 105, 105);
    static dimgrey: RGBAColor = new RGBAColor(105, 105, 105);
    static dodgerblue: RGBAColor = new RGBAColor(30, 144, 255);
    static firebrick: RGBAColor = new RGBAColor(178, 34, 34);
    static floralwhite: RGBAColor = new RGBAColor(255, 250, 240);
    static forestgreen: RGBAColor = new RGBAColor(34, 139, 34);
    static fuchsia: RGBAColor = new RGBAColor(255, 0, 255);
    static gainsboro: RGBAColor = new RGBAColor(220, 220, 220);
    static ghostwhite: RGBAColor = new RGBAColor(248, 248, 255);
    static gold: RGBAColor = new RGBAColor(255, 215, 0);
    static goldenrod: RGBAColor = new RGBAColor(218, 165, 32);
    static gray: RGBAColor = new RGBAColor(128, 128, 128);
    static green: RGBAColor = new RGBAColor(0, 128, 0);
    static greenyellow: RGBAColor = new RGBAColor(173, 255, 47);
    static grey: RGBAColor = new RGBAColor(128, 128, 128);
    static honeydew: RGBAColor = new RGBAColor(240, 255, 240);
    static hotpink: RGBAColor = new RGBAColor(255, 105, 180);
    static indianred: RGBAColor = new RGBAColor(205, 92, 92);
    static indigo: RGBAColor = new RGBAColor(75, 0, 130);
    static ivory: RGBAColor = new RGBAColor(255, 255, 240);
    static khaki: RGBAColor = new RGBAColor(240, 230, 140);
    static lavender: RGBAColor = new RGBAColor(230, 230, 250);
    static lavenderblush: RGBAColor = new RGBAColor(255, 240, 245);
    static lawngreen: RGBAColor = new RGBAColor(124, 252, 0);
    static lemonchiffon: RGBAColor = new RGBAColor(255, 250, 205);
    static lightblue: RGBAColor = new RGBAColor(173, 216, 230);
    static lightcoral: RGBAColor = new RGBAColor(240, 128, 128);
    static lightcyan: RGBAColor = new RGBAColor(224, 255, 255);
    static lightgoldenrodyellow: RGBAColor = new RGBAColor(250, 250, 210);
    static lightgray: RGBAColor = new RGBAColor(211, 211, 211);
    static lightgreen: RGBAColor = new RGBAColor(144, 238, 144);
    static lightgrey: RGBAColor = new RGBAColor(211, 211, 211);
    static lightpink: RGBAColor = new RGBAColor(255, 182, 193);
    static lightsalmon: RGBAColor = new RGBAColor(255, 160, 122);
    static lightseagreen: RGBAColor = new RGBAColor(32, 178, 170);
    static lightskyblue: RGBAColor = new RGBAColor(135, 206, 250);
    static lightslategray: RGBAColor = new RGBAColor(119, 136, 153);
    static lightslategrey: RGBAColor = new RGBAColor(119, 136, 153);
    static lightsteelblue: RGBAColor = new RGBAColor(176, 196, 222);
    static lightyellow: RGBAColor = new RGBAColor(255, 255, 224);
    static lime: RGBAColor = new RGBAColor(0, 255, 0);
    static limegreen: RGBAColor = new RGBAColor(50, 205, 50);
    static linen: RGBAColor = new RGBAColor(250, 240, 230);
    static magenta: RGBAColor = new RGBAColor(255, 0, 255);
    static maroon: RGBAColor = new RGBAColor(128, 0, 0);
    static mediumaquamarine: RGBAColor = new RGBAColor(102, 205, 170);
    static mediumblue: RGBAColor = new RGBAColor(0, 0, 205);
    static mediumorchid: RGBAColor = new RGBAColor(186, 85, 211);
    static mediumpurple: RGBAColor = new RGBAColor(147, 112, 219);
    static mediumseagreen: RGBAColor = new RGBAColor(60, 179, 113);
    static mediumslateblue: RGBAColor = new RGBAColor(123, 104, 238);
    static mediumspringgreen: RGBAColor = new RGBAColor(0, 250, 154);
    static mediumturquoise: RGBAColor = new RGBAColor(72, 209, 204);
    static mediumvioletred: RGBAColor = new RGBAColor(199, 21, 133);
    static midnightblue: RGBAColor = new RGBAColor(25, 25, 112);
    static mintcream: RGBAColor = new RGBAColor(245, 255, 250);
    static mistyrose: RGBAColor = new RGBAColor(255, 228, 225);
    static moccasin: RGBAColor = new RGBAColor(255, 228, 181);
    static navajowhite: RGBAColor = new RGBAColor(255, 222, 173);
    static navy: RGBAColor = new RGBAColor(0, 0, 128);
    static oldlace: RGBAColor = new RGBAColor(253, 245, 230);
    static olive: RGBAColor = new RGBAColor(128, 128, 0);
    static olivedrab: RGBAColor = new RGBAColor(107, 142, 35);
    static orange: RGBAColor = new RGBAColor(255, 165, 0);
    static orangered: RGBAColor = new RGBAColor(255, 69, 0);
    static orchid: RGBAColor = new RGBAColor(218, 112, 214);
    static palegoldenrod: RGBAColor = new RGBAColor(238, 232, 170);
    static palegreen: RGBAColor = new RGBAColor(152, 251, 152);
    static paleturquoise: RGBAColor = new RGBAColor(175, 238, 238);
    static palevioletred: RGBAColor = new RGBAColor(219, 112, 147);
    static papayawhip: RGBAColor = new RGBAColor(255, 239, 213);
    static peachpuff: RGBAColor = new RGBAColor(255, 218, 185);
    static peru: RGBAColor = new RGBAColor(205, 133, 63);
    static pink: RGBAColor = new RGBAColor(255, 192, 203);
    static plum: RGBAColor = new RGBAColor(221, 160, 221);
    static powderblue: RGBAColor = new RGBAColor(176, 224, 230);
    static purple: RGBAColor = new RGBAColor(128, 0, 128);
    static red: RGBAColor = new RGBAColor(255, 0, 0);
    static rosybrown: RGBAColor = new RGBAColor(188, 143, 143);
    static royalblue: RGBAColor = new RGBAColor(65, 105, 225);
    static saddlebrown: RGBAColor = new RGBAColor(139, 69, 19);
    static salmon: RGBAColor = new RGBAColor(250, 128, 114);
    static sandybrown: RGBAColor = new RGBAColor(244, 164, 96);
    static seagreen: RGBAColor = new RGBAColor(46, 139, 87);
    static seashell: RGBAColor = new RGBAColor(255, 245, 238);
    static sienna: RGBAColor = new RGBAColor(160, 82, 45);
    static silver: RGBAColor = new RGBAColor(192, 192, 192);
    static skyblue: RGBAColor = new RGBAColor(135, 206, 235);
    static slateblue: RGBAColor = new RGBAColor(106, 90, 205);
    static slategray: RGBAColor = new RGBAColor(112, 128, 144);
    static slategrey: RGBAColor = new RGBAColor(112, 128, 144);
    static snow: RGBAColor = new RGBAColor(255, 250, 250);
    static springgreen: RGBAColor = new RGBAColor(0, 255, 127);
    static steelblue: RGBAColor = new RGBAColor(70, 130, 180);
    static tan: RGBAColor = new RGBAColor(210, 180, 140);
    static teal: RGBAColor = new RGBAColor(0, 128, 128);
    static thistle: RGBAColor = new RGBAColor(216, 191, 216);
    static tomato: RGBAColor = new RGBAColor(255, 99, 71);
    static turquoise: RGBAColor = new RGBAColor(64, 224, 208);
    static violet: RGBAColor = new RGBAColor(238, 130, 238);
    static wheat: RGBAColor = new RGBAColor(245, 222, 179);
    static white: RGBAColor = new RGBAColor(255, 255, 255);
    static whitesmoke: RGBAColor = new RGBAColor(245, 245, 245);
    static yellow: RGBAColor = new RGBAColor(255, 255, 0);
    static yellowgreen: RGBAColor = new RGBAColor(154, 205, 50);

    static CSSMap: Map<string, RGBAColor> = new Map<string, RGBAColor>([
        ["aliceblue", RGBAColor.aliceblue],
        ["antiquewhite", RGBAColor.antiquewhite],
        ["aqua", RGBAColor.aqua],
        ["aquamarine", RGBAColor.aquamarine],
        ["azure", RGBAColor.azure],
        ["beige", RGBAColor.beige],
        ["bisque", RGBAColor.bisque],
        ["black", RGBAColor.black],
        ["blanchedalmond", RGBAColor.blanchedalmond],
        ["blue", RGBAColor.blue],
        ["blueviolet", RGBAColor.blueviolet],
        ["brown", RGBAColor.brown],
        ["burlywood", RGBAColor.burlywood],
        ["cadetblue", RGBAColor.cadetblue],
        ["chartreuse", RGBAColor.chartreuse],
        ["chocolate", RGBAColor.chocolate],
        ["coral", RGBAColor.coral],
        ["cornflowerblue", RGBAColor.cornflowerblue],
        ["cornsilk", RGBAColor.cornsilk],
        ["crimson", RGBAColor.crimson],
        ["cyan", RGBAColor.cyan],
        ["darkblue", RGBAColor.darkblue],
        ["darkcyan", RGBAColor.darkcyan],
        ["darkgoldenrod", RGBAColor.darkgoldenrod],
        ["darkgray", RGBAColor.darkgray],
        ["darkgreen", RGBAColor.darkgreen],
        ["darkgrey", RGBAColor.darkgrey],
        ["darkkhaki", RGBAColor.darkkhaki],
        ["darkmagenta", RGBAColor.darkmagenta],
        ["darkolivegreen", RGBAColor.darkolivegreen],
        ["darkorange", RGBAColor.darkorange],
        ["darkorchid", RGBAColor.darkorchid],
        ["darkred", RGBAColor.darkred],
        ["darksalmon", RGBAColor.darksalmon],
        ["darkseagreen", RGBAColor.darkseagreen],
        ["darkslateblue", RGBAColor.darkslateblue],
        ["darkslategray", RGBAColor.darkslategray],
        ["darkslategrey", RGBAColor.darkslategrey],
        ["darkturquoise", RGBAColor.darkturquoise],
        ["darkviolet", RGBAColor.darkviolet],
        ["deeppink", RGBAColor.deeppink],
        ["deepskyblue", RGBAColor.deepskyblue],
        ["dimgray", RGBAColor.dimgray],
        ["dimgrey", RGBAColor.dimgrey],
        ["dodgerblue", RGBAColor.dodgerblue],
        ["firebrick", RGBAColor.firebrick],
        ["floralwhite", RGBAColor.floralwhite],
        ["forestgreen", RGBAColor.forestgreen],
        ["fuchsia", RGBAColor.fuchsia],
        ["gainsboro", RGBAColor.gainsboro],
        ["ghostwhite", RGBAColor.ghostwhite],
        ["gold", RGBAColor.gold],
        ["goldenrod", RGBAColor.goldenrod],
        ["gray", RGBAColor.gray],
        ["green", RGBAColor.green],
        ["greenyellow", RGBAColor.greenyellow],
        ["grey", RGBAColor.grey],
        ["honeydew", RGBAColor.honeydew],
        ["hotpink", RGBAColor.hotpink],
        ["indianred", RGBAColor.indianred],
        ["indigo", RGBAColor.indigo],
        ["ivory", RGBAColor.ivory],
        ["khaki", RGBAColor.khaki],
        ["lavender", RGBAColor.lavender],
        ["lavenderblush", RGBAColor.lavenderblush],
        ["lawngreen", RGBAColor.lawngreen],
        ["lemonchiffon", RGBAColor.lemonchiffon],
        ["lightblue", RGBAColor.lightblue],
        ["lightcoral", RGBAColor.lightcoral],
        ["lightcyan", RGBAColor.lightcyan],
        ["lightgoldenrodyellow", RGBAColor.lightgoldenrodyellow],
        ["lightgray", RGBAColor.lightgray],
        ["lightgreen", RGBAColor.lightgreen],
        ["lightgrey", RGBAColor.lightgrey],
        ["lightpink", RGBAColor.lightpink],
        ["lightsalmon", RGBAColor.lightsalmon],
        ["lightseagreen", RGBAColor.lightseagreen],
        ["lightskyblue", RGBAColor.lightskyblue],
        ["lightslategray", RGBAColor.lightslategray],
        ["lightslategrey", RGBAColor.lightslategrey],
        ["lightsteelblue", RGBAColor.lightsteelblue],
        ["lightyellow", RGBAColor.lightyellow],
        ["lime", RGBAColor.lime],
        ["limegreen", RGBAColor.limegreen],
        ["linen", RGBAColor.linen],
        ["magenta", RGBAColor.magenta],
        ["maroon", RGBAColor.maroon],
        ["mediumaquamarine", RGBAColor.mediumaquamarine],
        ["mediumblue", RGBAColor.mediumblue],
        ["mediumorchid", RGBAColor.mediumorchid],
        ["mediumpurple", RGBAColor.mediumpurple],
        ["mediumseagreen", RGBAColor.mediumseagreen],
        ["mediumslateblue", RGBAColor.mediumslateblue],
        ["mediumspringgreen", RGBAColor.mediumspringgreen],
        ["mediumturquoise", RGBAColor.mediumturquoise],
        ["mediumvioletred", RGBAColor.mediumvioletred],
        ["midnightblue", RGBAColor.midnightblue],
        ["mintcream", RGBAColor.mintcream],
        ["mistyrose", RGBAColor.mistyrose],
        ["moccasin", RGBAColor.moccasin],
        ["navajowhite", RGBAColor.navajowhite],
        ["navy", RGBAColor.navy],
        ["oldlace", RGBAColor.oldlace],
        ["olive", RGBAColor.olive],
        ["olivedrab", RGBAColor.olivedrab],
        ["orange", RGBAColor.orange],
        ["orangered", RGBAColor.orangered],
        ["orchid", RGBAColor.orchid],
        ["palegoldenrod", RGBAColor.palegoldenrod],
        ["palegreen", RGBAColor.palegreen],
        ["paleturquoise", RGBAColor.paleturquoise],
        ["palevioletred", RGBAColor.palevioletred],
        ["papayawhip", RGBAColor.papayawhip],
        ["peachpuff", RGBAColor.peachpuff],
        ["peru", RGBAColor.peru],
        ["pink", RGBAColor.pink],
        ["plum", RGBAColor.plum],
        ["powderblue", RGBAColor.powderblue],
        ["purple", RGBAColor.purple],
        ["red", RGBAColor.red],
        ["rosybrown", RGBAColor.rosybrown],
        ["royalblue", RGBAColor.royalblue],
        ["saddlebrown", RGBAColor.saddlebrown],
        ["salmon", RGBAColor.salmon],
        ["sandybrown", RGBAColor.sandybrown],
        ["seagreen", RGBAColor.seagreen],
        ["seashell", RGBAColor.seashell],
        ["sienna", RGBAColor.sienna],
        ["silver", RGBAColor.silver],
        ["skyblue", RGBAColor.skyblue],
        ["slateblue", RGBAColor.slateblue],
        ["slategray", RGBAColor.slategray],
        ["slategrey", RGBAColor.slategrey],
        ["snow", RGBAColor.snow],
        ["springgreen", RGBAColor.springgreen],
        ["steelblue", RGBAColor.steelblue],
        ["tan", RGBAColor.tan],
        ["teal", RGBAColor.teal],
        ["thistle", RGBAColor.thistle],
        ["tomato", RGBAColor.tomato],
        ["turquoise", RGBAColor.turquoise],
        ["violet", RGBAColor.violet],
        ["wheat", RGBAColor.wheat],
        ["white", RGBAColor.white],
        ["whitesmoke", RGBAColor.whitesmoke],
        ["yellow", RGBAColor.yellow],
        ["yellowgreen", RGBAColor.yellowgreen],
    ]);

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

    public static h2r(hex: string): Array<number> | undefined {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : undefined;
    }

    public static r2h(rgb: Array<number>): string {
        return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
    }

    public static Parse(str: string): RGBAColor {
        // Web RGB color code (hex triplet)
        if (str[0] == "#") {
            var a = RGBAColor.h2r(str);
            if (a) {
                return new RGBAColor(a[0], a[1], a[2]);
            }
        }
        // CSS color name
        return new RGBAColor(RGBAColor.CSSMap.get(str) || RGBAColor.White());
    }

    private _r: number = 0;
    private _g: number = 0;
    private _b: number = 0;
    private _a: number = 255;

    public constructor(r: number | RGBAColor, g: number = 0, b: number = 0, a: number = 255) {
        if (r instanceof RGBAColor) {
            this.r = r.r;
            this.g = r.g;
            this.b = r.b;
            this.a = r.a;
        } else {
            this.r = r;
            this.g = g;
            this.b = b;
        }
        this._a = a;
    }

    public get r(): number {
        return this._r;
    }

    public get g(): number {
        return this._g;
    }

    public get b(): number {
        return this._b;
    }

    public get a(): number {
        return this._a;
    }
    public set r(value: number) {
        this._r = Scalar.Clamp(value, 0, 255);
    }
    public set g(value: number) {
        this._g = Scalar.Clamp(value, 0, 255);
    }
    public set b(value: number) {
        this._b = Scalar.Clamp(value, 0, 255);
    }
    public set a(value: number) {
        this._a = Scalar.Clamp(value, 0, 255);
    }

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
