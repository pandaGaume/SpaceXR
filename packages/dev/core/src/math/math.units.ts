import { AbstractRange } from "./math";

export interface IUnitConverter {
    accept(u: Unit): boolean;
    convert(v: number, u: Unit): number;
}

export class Unit {
    public constructor(public name: string, public symbol: string, public value: number = 0, public converter?: IUnitConverter) {}
}

const _defaultDecimalPrecision = 6;

export abstract class Quantity {
    public static Convert(value: number, from: Unit, to: Unit): number {
        if (!from || !to || from === to) {
            return value;
        }
        if (from.converter && from.converter.accept(to)) {
            return from.converter.convert(value, to);
        }
        return value * (from.value / to.value);
    }

    public _value: number;
    private _unit?: Unit;

    static round(value: number, decimalPrecision: number = _defaultDecimalPrecision): number {
        const dp: number = decimalPrecision || _defaultDecimalPrecision;
        return Math.round(value * Math.pow(10, dp)) / Math.pow(10, dp);
    }

    public constructor(value: number | Quantity, unit?: Unit) {
        if (value instanceof Quantity) {
            const q: Quantity = value;
            this._value = q.value;
            this._unit = q._unit;
        } else {
            this._value = value;
            this._unit = unit;
        }
    }

    public get unit(): Unit | undefined {
        return this._unit;
    }

    public set unit(target: Unit | undefined) {
        if (target && this._unit && this._unit !== target) {
            this.tryConvert(target);
        }
    }
    public get value(): number {
        return this._value;
    }

    public set value(value: number) {
        this._value = value;
    }

    public tryConvert(targetUnit: Unit): boolean {
        if (this._unit) {
            if (this._unit.converter) {
                if (this._unit.converter.accept(this._unit) === false) {
                    return false;
                }
                this.value = this._unit.converter.convert(this.value, targetUnit);
                this._unit = targetUnit;
                return true;
            }

            if (targetUnit.value && targetUnit.symbol !== this._unit.symbol) {
                this.value *= this._unit.value / targetUnit.value;
                this._unit = targetUnit;
                return true;
            }
        }
        return false;
    }

    public clone(unit?: Unit): Quantity {
        const n: Quantity = new (this.constructor(this._value, this._unit))();
        if (unit) {
            n.tryConvert(unit);
        }
        return n;
    }

    public getValue(unit?: Unit): number {
        if (!this._unit) {
            return this._value;
        }
        if (unit && unit !== this._unit) {
            if (this._unit.converter) {
                if (this._unit.converter.accept(unit)) {
                    return this._unit.converter.convert(this.value, unit);
                }
            }
            if (unit.value && unit.symbol !== this._unit.symbol) {
                return this.value * (this._unit.value / unit.value);
            }
        }
        return this.value;
    }

    public equals(v: Quantity): boolean {
        if (v._unit === this._unit) {
            return this.value === v.value;
        }
        return this.value === v.getValue(this._unit);
    }

    public subtract(v: Quantity): Quantity {
        const result = this.value - (v._unit === this._unit ? v.value : v.getValue(this._unit));
        return this.constructor(result, this._unit);
    }

    public add(v: Quantity): Quantity {
        const result = this.value + (v._unit === this._unit ? v.value : v.getValue(this._unit));
        return this.constructor(result, this._unit);
    }

    public tryParse(str: string): boolean {
        if (str) {
            const parts: string[] = str.split(" ");
            const v: number = parseFloat(str);
            if (Number.isNaN(v)) {
                return false;
            }
            this.value = v;
            if (parts.length > 1) {
                this._unit = this.unitForSymbol(parts[1]);
            } else {
                this._unit = undefined;
            }
            return true;
        }
        return false;
    }

    public abstract unitForSymbol(symbol: string): Unit | undefined;
}

export class QuantityRange<T extends Quantity> extends AbstractRange<T> {
    protected computeDelta(a: T, b: T): T {
        return b && a ? b.subtract(a) : a.constructor(0, a.unit);
    }
}

export class Timespan extends Quantity {
    public static ForParameter(value: Timespan | number, defaultValue: number, defaultUnit: Unit): Timespan {
        return value ? new Timespan(value, defaultUnit) : new Timespan(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        ys: new Unit("yoctosecond", "ys", 10e-24),
        zs: new Unit("zeptosecond", "zs", 10e-21),
        as: new Unit("attosecond", "as", 10e-18),
        fs: new Unit("femtosecond", "fs", 10e-15),
        ps: new Unit("picosecond", "ps", 10e-12),
        ns: new Unit("nanosecond", "ns", 10e-9),
        tick: new Unit("tick", "ns", 10e-7),
        mis: new Unit("microsecond", "mis", 10e-6),
        ms: new Unit("millisecond", "ms", 10e-3),
        s: new Unit("second", "s", 1),
        Min: new Unit("minute", "m", 60),
        Hour: new Unit("hour", "h", 3600),
        Day: new Unit("day", "d", 86400),
        Week: new Unit("week", "w", 86400 * 7),
        Yr: new Unit("year", "y", 86400 * 365.25),
        Cy: new Unit("century", "c", 86400 * 36525),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Timespan.Units[str] || undefined;
    }
}

// tslint:disable: no-use-before-declare
class KConverter implements IUnitConverter {
    public accept(unit: Unit): boolean {
        return unit === Temperature.Units.c || unit === Temperature.Units.f;
    }
    public convert(value: number, unit: Unit): number {
        switch (unit) {
            case Temperature.Units.c:
                return value - Temperature.Units.k.value;
            case Temperature.Units.f:
                return (value - Temperature.Units.k.value) * 1.8 + 32;
            default:
                return value;
        }
    }
}

class CConverter implements IUnitConverter {
    public accept(unit: Unit): boolean {
        return unit === Temperature.Units.k || unit === Temperature.Units.f;
    }
    public convert(value: number, unit: Unit): number {
        switch (unit) {
            case Temperature.Units.k:
                return value + Temperature.Units.k.value;
            case Temperature.Units.f:
                return value * 1.8 + 32;
            default:
                return value;
        }
    }
}

class FConverter implements IUnitConverter {
    public accept(unit: Unit): boolean {
        return unit === Temperature.Units.k || unit === Temperature.Units.c;
    }
    public convert(value: number, unit: Unit): number {
        switch (unit) {
            case Temperature.Units.k:
                return (value - 32) / 1.8 + Temperature.Units.k.value;
            case Temperature.Units.c:
                return (value - 32) / 1.8;
            default:
                return value;
        }
    }
}

export class Temperature extends Quantity {
    public static ForParameter(value: Temperature | number, defaultValue: number, defaultUnit: Unit): Temperature {
        return value ? new Temperature(value, defaultUnit) : new Temperature(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        k: new Unit("kelvin", "k", -273.15, new KConverter()),
        c: new Unit("celsius", "c", 1, new CConverter()),
        f: new Unit("fahrenheit", "f", 33.8, new FConverter()),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Temperature.Units[str] || undefined;
    }
}

export class Mass extends Quantity {
    public static ForParameter(value: Mass | number, defaultValue: number, defaultUnit: Unit): Mass {
        return value ? new Mass(value, defaultUnit) : new Mass(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        u: new Unit("atomic mass unit", "u", 1.66e-27),
        pm: new Unit("plank mass", "pm", 1e-8),
        mg: new Unit("microgram", "µg", 1e-6),
        g: new Unit("gram", "g", 1e-3),
        pound: new Unit("pound", "lb", 0.45359237),
        kg: new Unit("kilogram", "kg", 1),
        T: new Unit("Ton", "T", 1000),
        Sm: new Unit("solar mass", "Sm", 1.98855e30),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Mass.Units[str] || undefined;
    }
}

export class Power extends Quantity {
    public static ForParameter(value: Power | number, defaultValue: number, defaultUnit: Unit): Power {
        return value ? new Power(value, defaultUnit) : new Power(defaultValue, defaultUnit);
    }
    public static Units: { [key: string]: Unit } = {
        watt: new Unit("watt", "w", 1),
        Kwatt: new Unit("Kwatt", "kw", 1000),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Power.Units[str] || undefined;
    }
}

export class Voltage extends Quantity {
    public static ForParameter(value: Voltage | number, defaultValue: number, defaultUnit: Unit): Voltage {
        return value ? new Voltage(value, defaultUnit) : new Voltage(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        volt: new Unit("volt", "v", 1),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Voltage.Units[str] || undefined;
    }
}

export class Current extends Quantity {
    public static ForParameter(value: Current | number, defaultValue: number, defaultUnit: Unit): Current {
        return value ? new Current(value, defaultUnit) : new Current(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        amp: new Unit("amp", "a", 1),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Current.Units[str] || undefined;
    }
}

export class Luminosity extends Quantity {
    public static ForParameter(value: Luminosity | number, defaultValue: number, defaultUnit: Unit): Luminosity {
        return value ? new Luminosity(value, defaultUnit) : new Luminosity(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        watt: new Unit("watt", "w", 1),
        Lsun: new Unit("solar luminosity", "Lsun", 3.846e26),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Luminosity.Units[str] || undefined;
    }
}

export class Volume extends Quantity {
    public static ForParameter(value: Volume | number, defaultValue: number, defaultUnit: Unit): Volume {
        return value ? new Volume(value, defaultUnit) : new Volume(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        m3: new Unit("cubic meter", "m3", 1),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Volume.Units[str] || undefined;
    }
}

export class Angle extends Quantity {
    public static ForParameter(value: Angle | number, defaultValue: number, defaultUnit: Unit): Angle {
        return value ? new Angle(value, defaultUnit) : new Angle(defaultValue, defaultUnit);
    }

    public static PIBY2 = Math.PI / 2;
    public static PIBY4 = Math.PI / 4;
    public static DE2RA = Math.PI / 180;
    public static RA2DE = 180 / Math.PI;
    public static DE2RABY2 = Math.PI / 360;

    public static Units: { [key: string]: Unit } = {
        d: new Unit("degre", "d", 1),
        r: new Unit("radian", "r", Angle.RA2DE),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Angle.Units[str] || undefined;
    }
}

export class Length extends Quantity {
    public static ForParameter(value: Length | number, defaultValue: number, defaultUnit: Unit): Length {
        return value ? new Length(value, defaultUnit) : new Length(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {
        ym: new Unit("yoctometer", "ym", 10e-24),
        zm: new Unit("zeptometer", "zm", 10e-21),
        am: new Unit("attometer", "am", 10e-18),
        fm: new Unit("femtometer", "fm", 10e-15),
        pm: new Unit("picometer", "pm", 10e-12),
        nm: new Unit("nanometer", "nm", 10e-9),
        mim: new Unit("micrometer", "mim", 10e-6),
        mm: new Unit("millimeter", "mm", 10e-3),
        cm: new Unit("centimeter", "cm", 10e-2),
        in: new Unit("inch", "in", 0.0254),
        dm: new Unit("decimeter", "dm", 10e-1),
        m: new Unit("meter", "m", 1),
        Mi: new Unit("mile", "Mi", 1.609343502101154),
        Nmi: new Unit("nmile", "Nmi", 1.8519994270282407189),
        Dam: new Unit("decameter", "Dm", 10),
        Hm: new Unit("hectometer", "Hm", 100),
        Km: new Unit("kilometer", "Km", 1000),
        Sr: new Unit("solar radius", "Sr", 6957e5),
        Mm: new Unit("megameter", "Mn", 10e6),
        Ls: new Unit("light second", "Ls", 299792458),
        Gm: new Unit("gigameter", "Gm", 10e9),
        Au: new Unit("astronomical unit", "Au", 1.496e11),
        Tm: new Unit("terameter", "Tm", 10e12),
        Pm: new Unit("petameter", "Pm", 10e15),
        Ly: new Unit("light year", "Ly", 9.4607e15),
        Pc: new Unit("parsec", "Pc", 3.0857e16),
        Em: new Unit("exameter", "Em", 10e18),
        Zm: new Unit("zettameter", "Zm", 10e21),
        Ym: new Unit("yottameter", "Ym", 10e24),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Length.Units[str] || undefined;
    }
}

export class Speed extends Quantity {
    public static ForParameter(value: Length | number, defaultValue: number, defaultUnit: Unit): Length {
        return value ? new Length(value, defaultUnit) : new Length(defaultValue, defaultUnit);
    }

    public static Units: { [key: string]: Unit } = {};

    public unitForSymbol(str: string): Unit | undefined {
        return Speed.Units[str] || undefined;
    }
}
