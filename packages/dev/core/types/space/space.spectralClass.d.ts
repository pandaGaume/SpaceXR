import { Temperature, Length, Mass, Luminosity, QuantityRange as QR } from "../math/math.units";
export type MKMajor = "O" | "B" | "A" | "F" | "G" | "K" | "M";
export type MKMinor = number;
export type MKLuminosity = "Ia+" | "I" | "II" | "III" | "IV" | "V" | "sd" | "D";
export type MorganKeenanName = string;
export declare class MorganKeenanClass {
    private static pattern;
    static LuminosityNames: MKLuminosity[];
    static Parse(str: string): MorganKeenanClass | undefined;
    _major: MKMajor;
    _minor: MKMinor;
    _lum?: MKLuminosity;
    constructor(major: MKMajor, minor: MKMinor, luminosity?: MKLuminosity);
    get major(): MKMajor;
    get minor(): MKMinor;
    get luminosity(): MKLuminosity | undefined;
    get fullName(): string;
}
export declare class SpectralClass {
    name: MKMajor;
    effectiveTemperature: QR<Temperature>;
    VegaRelativeColorLabel: string;
    chromacityLabel: string;
    mass: QR<Mass>;
    radius: QR<Length>;
    luminosity: QR<Luminosity>;
    hydrogenLine: string;
    fractionOfStars: number;
    static O: SpectralClass;
    static B: SpectralClass;
    static A: SpectralClass;
    static F: SpectralClass;
    static G: SpectralClass;
    static K: SpectralClass;
    static M: SpectralClass;
    static HarwardClassificationIndex: {
        [k in MKMajor]: SpectralClass;
    };
    static HarwardClassification: SpectralClass[];
    static TemperatureRange: QR<Temperature>;
    static ClassFromTemperature(temperature: Temperature | number): SpectralClass | undefined;
    constructor(name: MKMajor, effectiveTemperature: QR<Temperature>, VegaRelativeColorLabel: string, chromacityLabel: string, mass: QR<Mass>, radius: QR<Length>, luminosity: QR<Luminosity>, hydrogenLine: string, fractionOfStars: number);
}
