import { AbstractRange } from "./math";

/**
 * Strategy a `Quantity` subclass can attach to a `Unit` to handle
 * conversions that are NOT a pure linear scale of the base unit
 * (Celsius ↔ Kelvin offset, Fahrenheit ↔ Celsius affine, etc.).
 *
 * The host `Quantity.Convert` static method consults `accept(target)`
 * first; when it returns true the converter is invoked, otherwise the
 * generic linear formula `value × (from.value / to.value)` applies.
 */
export interface IUnitConverter {
    accept(u: Unit): boolean;
    convert(v: number, u: Unit): number;
}

export class Unit {
    /**
     * @param name    Human-readable name, e.g. "millimeter per second".
     * @param symbol  Display symbol, e.g. "mm/s". For humans, not machines: it
     *                carries typographic characters ("\u00b5", "\u00b3", "\u00b7") that no
     *                interchange format accepts, and it collides across
     *                quantities ("g" is both gram and standard gravity).
     * @param value   Conversion factor to the quantity's base unit, as
     *                "1 <this> = value <base>".
     * @param ucum    Canonical machine identifier: the case-sensitive UCUM
     *                code. This is the repository's mandatory unit identity,
     *                the one every exposition derives from (QUDT, WoT, OPC UA,
     *                Sparkplug). Undefined only where UCUM genuinely has no
     *                code, which is documented at the declaration site; an
     *                approximate code would be worse than none, since it
     *                travels without signalling that it is approximate.
     * @param converter Non-linear conversion strategy, for affine scales.
     */
    public constructor(
        public name: string,
        public symbol: string,
        public value: number = 0,
        public ucum?: string,
        public converter?: IUnitConverter
    ) {}
}

/**
 * Serializable physical-unit tag carried by a signal/measurement tensor
 * (`ITensor.unit`). Plain JSON (strings + a number) so it survives
 * `.spikypanda` and metadata-sidecar round-trips; `resolveUnit()` maps it
 * back to the concrete `Unit` at runtime. See
 * docs/architecture/unit-tag-convention.md.
 */
export interface IUnitTag {
    /** Physical quantity kind = which Quantity subclass owns the unit
     *  vocabulary (e.g. "Acceleration", "Current", "Speed"). */
    quantity: string;
    /** Unit KEY within that quantity as `<Quantity>.unitForSymbol` expects
     *  (the `Units` map key, e.g. "g", "mps2", "amp", "mmps") — NOT the
     *  display symbol. */
    unit: string;
    /** Sampling rate (Hz) for a time-series tensor; needed by ISO/DSP nodes
     *  (band coverage, Nyquist). Separate from the unit, travels with it. */
    sampleRateHz?: number;
}

/**
 * A port's declared unit expectation (a wiring-time contract on
 * `IPortDescriptor.unit`). `unit` omitted = any unit of `quantity`
 * accepted; `requires: true` = the port refuses an untagged tensor.
 */
export interface IUnitExpectation {
    quantity: string;
    unit?: string;
    requires?: boolean;
}

const _defaultDecimalPrecision = 6;

/**
 * Base for every physical-quantity wrapper (Temperature, Pressure,
 * Length, ...). Stores a numeric `_value` interpreted in `_unit`. The
 * concrete subclasses populate a static `Units` map of named-unit
 * singletons; `getValue(unit)` and `tryConvert(unit)` route between
 * them.
 *
 * Conversion lookup:
 *   1. If both sides are the same Unit instance → identity.
 *   2. If `from.converter` accepts `to` → delegate (affine path).
 *   3. Otherwise linear: `value × (from.value / to.value)`.
 *      `from.value` MUST be the conversion factor "1 from = N base"
 *      where `base` is the subclass's reference unit.
 */
export abstract class Quantity {
    /**
     * Convert a raw scalar from one Unit to another. Used by
     * `getValue` and `tryConvert` so all three call sites share one
     * code path.
     */
    public static Convert(value: number, from: Unit, to: Unit): number {
        if (!from || !to || from === to) {
            return value;
        }
        if (from.converter && from.converter.accept(to)) {
            return from.converter.convert(value, to);
        }
        if (to.value && from.value) {
            return value * (from.value / to.value);
        }
        return value;
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

    /**
     * Convert in place to `targetUnit`. Returns true on success, false
     * when no conversion path exists (both sides have no converter and
     * one of the linear factors is zero / unset). The previous
     * implementation asked the converter `accept(this._unit)` (the
     * source); the right question is whether it accepts the TARGET.
     */
    public tryConvert(targetUnit: Unit): boolean {
        if (!this._unit) return false;
        if (this._unit === targetUnit) return true;
        if (this._unit.converter && this._unit.converter.accept(targetUnit)) {
            this._value = this._unit.converter.convert(this._value, targetUnit);
            this._unit = targetUnit;
            return true;
        }
        if (this._unit.value && targetUnit.value && targetUnit.symbol !== this._unit.symbol) {
            this._value *= this._unit.value / targetUnit.value;
            this._unit = targetUnit;
            return true;
        }
        return false;
    }

    /**
     * Return a fresh instance of the concrete subclass carrying the
     * same value+unit. The previous implementation invoked
     * `this.constructor(...)` without `new`, which throws under
     * strict mode (classes refuse function-call invocation). We
     * forward through the Quantity-copy constructor signature so
     * any subclass works without bespoke clone overrides.
     */
    public clone(unit?: Unit): Quantity {
        const Ctor = this.constructor as new (v: number | Quantity, u?: Unit) => Quantity;
        const n = new Ctor(this);
        if (unit) {
            n.tryConvert(unit);
        }
        return n;
    }

    public getValue(unit?: Unit): number {
        if (!this._unit || !unit || unit === this._unit) {
            return this._value;
        }
        return Quantity.Convert(this._value, this._unit, unit);
    }

    public equals(v: Quantity): boolean {
        if (v._unit === this._unit) {
            return this._value === v._value;
        }
        return this._value === v.getValue(this._unit);
    }

    /**
     * Arithmetic: result keeps THIS quantity's unit; the other side
     * is converted in via `getValue`. The runtime type of the result
     * mirrors `this` (a `Temperature.subtract(otherTemp)` returns a
     * Temperature). The generic parameter `T` is purely for the
     * caller's typing convenience — there is no dimensional check at
     * compile time, so subtracting cross-quantity values is a runtime
     * mistake the caller owns.
     */
    public subtract<T extends Quantity>(v: T): T {
        const other = v._unit === this._unit ? v._value : v.getValue(this._unit);
        const result = this._value - other;
        const Ctor = this.constructor as new (val: number, u?: Unit) => T;
        return new Ctor(result, this._unit);
    }

    public add<T extends Quantity>(v: T): T {
        const other = v._unit === this._unit ? v._value : v.getValue(this._unit);
        const result = this._value + other;
        const Ctor = this.constructor as new (val: number, u?: Unit) => T;
        return new Ctor(result, this._unit);
    }

    public tryParse(str: string): boolean {
        if (str) {
            const parts: string[] = str.split(" ");
            const v: number = parseFloat(str);
            if (Number.isNaN(v)) {
                return false;
            }
            this._value = v;
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
        if (!a || !b) {
            // No defined endpoints → return a "zero" of the same
            // concrete type if we have at least one anchor.
            const Anchor = (a ?? b) as T | undefined;
            if (!Anchor) {
                return undefined as unknown as T;
            }
            const Ctor = Anchor.constructor as new (val: number, u?: Unit) => T;
            return new Ctor(0, Anchor.unit);
        }
        return b.subtract(a);
    }
}

/**
 * Timespan: base = second. SI prefix factors are `1eN`, not the
 * `10eN` pattern the original module used (which would have been
 * 10× off everywhere; e.g. `10e-3 = 0.01`, not `0.001`).
 */
export class Timespan extends Quantity {
    public static ForParameter(value: Timespan | number, defaultValue: number, defaultUnit: Unit): Timespan {
        return value ? new Timespan(value, defaultUnit) : new Timespan(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Time";

    public static Units: { [key: string]: Unit } = {
        ys: new Unit("yoctosecond", "ys", 1e-24, "ys"),
        zs: new Unit("zeptosecond", "zs", 1e-21, "zs"),
        as: new Unit("attosecond", "as", 1e-18, "as"),
        fs: new Unit("femtosecond", "fs", 1e-15, "fs"),
        ps: new Unit("picosecond", "ps", 1e-12, "ps"),
        ns: new Unit("nanosecond", "ns", 1e-9, "ns"),
        // "tick" is a UE5-flavoured 100 ns sample; symbol made
        // distinct from "ns" to remove the legacy collision.
        tick: new Unit("tick", "tk", 1e-7, "100.ns"),
        mis: new Unit("microsecond", "µs", 1e-6, "us"),
        ms: new Unit("millisecond", "ms", 1e-3, "ms"),
        s: new Unit("second", "s", 1, "s"),
        Min: new Unit("minute", "m", 60, "min"),
        Hour: new Unit("hour", "h", 3600, "h"),
        Day: new Unit("day", "d", 86400, "d"),
        Week: new Unit("week", "w", 86400 * 7, "wk"),
        Yr: new Unit("year", "y", 86400 * 365.25, "a_j"),
        Cy: new Unit("century", "c", 86400 * 36525, "100.a_j"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Timespan.Units[str] || undefined;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Temperature
//
// Temperature is the canonical affine quantity: the unit conversions
// have an offset (K ↔ C) plus a scale (C ↔ F), so the linear
// `value × (from.value / to.value)` cannot represent them. Each Unit
// declares an `IUnitConverter` that handles the conversion exactly,
// keyed off the literal 273.15 and the 1.8 scale.
//
// The `Unit.value` field is unused for the affine path; we set the
// reference unit (kelvin) to 1 so any code that bypasses the converter
// at least does not divide by zero. The previous module used -273.15
// on kelvin, with three converters all using the wrong sign (subtract
// when the formula said add and vice versa) — none of those
// conversions produced the correct result.
// ─────────────────────────────────────────────────────────────────────

class KConverter implements IUnitConverter {
    public accept(unit: Unit): boolean {
        return unit === Temperature.Units.c || unit === Temperature.Units.f;
    }
    public convert(value: number, unit: Unit): number {
        switch (unit) {
            case Temperature.Units.c:
                return value - 273.15;
            case Temperature.Units.f:
                return (value - 273.15) * 1.8 + 32;
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
                return value + 273.15;
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
                return (value - 32) / 1.8 + 273.15;
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

    public static QuantityKind = "Temperature";

    public static Units: { [key: string]: Unit } = {
        k: new Unit("kelvin", "K", 1, "K", new KConverter()),
        c: new Unit("celsius", "°C", 1, "Cel", new CConverter()),
        f: new Unit("fahrenheit", "°F", 1, "[degF]", new FConverter()),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Temperature.Units[str] || undefined;
    }
}

/**
 * Mass: base = kilogram. The legacy module labelled the milligram
 * row "microgram" (the value 1e-6 kg IS one milligram); fixed here.
 * `pm` retained as "planck mass" approximation; for a high-precision
 * value swap to 2.176434e-8 kg.
 */
export class Mass extends Quantity {
    public static ForParameter(value: Mass | number, defaultValue: number, defaultUnit: Unit): Mass {
        return value ? new Mass(value, defaultUnit) : new Mass(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Mass";

    public static Units: { [key: string]: Unit } = {
        u: new Unit("atomic mass unit", "u", 1.66053906660e-27, "u"),
        pm: new Unit("planck mass", "pm", 2.176434e-8, undefined),
        mug: new Unit("microgram", "µg", 1e-9, "ug"),
        mg: new Unit("milligram", "mg", 1e-6, "mg"),
        g: new Unit("gram", "g", 1e-3, "g"),
        pound: new Unit("pound", "lb", 0.45359237, "[lb_av]"),
        kg: new Unit("kilogram", "kg", 1, "kg"),
        T: new Unit("metric ton", "t", 1000, "t"),
        Sm: new Unit("solar mass", "M☉", 1.98855e30, undefined),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Mass.Units[str] || undefined;
    }
}

export class Power extends Quantity {
    public static ForParameter(value: Power | number, defaultValue: number, defaultUnit: Unit): Power {
        return value ? new Power(value, defaultUnit) : new Power(defaultValue, defaultUnit);
    }
    public static QuantityKind = "Power";

    public static Units: { [key: string]: Unit } = {
        watt: new Unit("watt", "W", 1, "W"),
        kwatt: new Unit("kilowatt", "kW", 1e3, "kW"),
        Mwatt: new Unit("megawatt", "MW", 1e6, "MW"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Power.Units[str] || undefined;
    }
}

export class Voltage extends Quantity {
    public static ForParameter(value: Voltage | number, defaultValue: number, defaultUnit: Unit): Voltage {
        return value ? new Voltage(value, defaultUnit) : new Voltage(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Voltage";

    public static Units: { [key: string]: Unit } = {
        volt: new Unit("volt", "V", 1, "V"),
        mvolt: new Unit("millivolt", "mV", 1e-3, "mV"),
        kvolt: new Unit("kilovolt", "kV", 1e3, "kV"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Voltage.Units[str] || undefined;
    }
}

export class Current extends Quantity {
    public static ForParameter(value: Current | number, defaultValue: number, defaultUnit: Unit): Current {
        return value ? new Current(value, defaultUnit) : new Current(defaultValue, defaultUnit);
    }

    public static QuantityKind = "ElectricCurrent";

    public static Units: { [key: string]: Unit } = {
        amp: new Unit("ampere", "A", 1, "A"),
        mamp: new Unit("milliampere", "mA", 1e-3, "mA"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Current.Units[str] || undefined;
    }
}

export class Luminosity extends Quantity {
    public static ForParameter(value: Luminosity | number, defaultValue: number, defaultUnit: Unit): Luminosity {
        return value ? new Luminosity(value, defaultUnit) : new Luminosity(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Power";

    public static Units: { [key: string]: Unit } = {
        watt: new Unit("watt", "W", 1, "W"),
        Lsun: new Unit("solar luminosity", "L☉", 3.846e26, undefined),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Luminosity.Units[str] || undefined;
    }
}

/**
 * Volume: base = cubic metre. The original file shipped only `m3`;
 * the litre and millilitre additions cover the cases SceneItem /
 * AtmosphereStateNode will need to type tank volumes and species
 * inventories.
 */
export class Volume extends Quantity {
    public static ForParameter(value: Volume | number, defaultValue: number, defaultUnit: Unit): Volume {
        return value ? new Volume(value, defaultUnit) : new Volume(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Volume";

    public static Units: { [key: string]: Unit } = {
        m3: new Unit("cubic meter", "m³", 1, "m3"),
        L: new Unit("litre", "L", 1e-3, "L"),
        mL: new Unit("millilitre", "mL", 1e-6, "mL"),
        cm3: new Unit("cubic centimeter", "cm³", 1e-6, "cm3"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Volume.Units[str] || undefined;
    }
}

/**
 * Area: base = square metre.
 *
 * Used by `AtmosphereGateNode` (P7) to type the open-passive throat
 * area. Conversion factors are derived from the corresponding Length
 * factors (a²) — kept inline here rather than computed lazily so the
 * `Quantity.Convert` linear path stays branch-free.
 */
export class Area extends Quantity {
    public static ForParameter(value: Area | number, defaultValue: number, defaultUnit: Unit): Area {
        return value ? new Area(value, defaultUnit) : new Area(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Area";

    public static Units: { [key: string]: Unit } = {
        m2: new Unit("square meter", "m²", 1, "m2"),
        cm2: new Unit("square centimeter", "cm²", 1e-4, "cm2"),
        mm2: new Unit("square millimeter", "mm²", 1e-6, "mm2"),
        km2: new Unit("square kilometer", "km²", 1e6, "km2"),
        in2: new Unit("square inch", "in²", 0.00064516, "[sin_i]"),
        ft2: new Unit("square foot", "ft²", 0.09290304, "[sft_i]"),
        ha: new Unit("hectare", "ha", 1e4, "har"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Area.Units[str] || undefined;
    }
}

/**
 * Volumetric flow rate: base = cubic metre per second.
 *
 * Used by `AtmosphereGateNode` (P7) to type the hvac-forced flow.
 * The catalog covers SI (m³/s, L/s, L/min, m³/h) plus the two
 * industrial-HVAC standards (cfm, US gpm) so the property panel can
 * render whatever the user thinks in.
 *
 *   1 L/s    = 1e-3 m³/s
 *   1 L/min  = 1e-3 / 60 m³/s
 *   1 m³/h   = 1/3600 m³/s
 *   1 cfm    = 0.3048³ × 0.02831685 / 60 ≈ 4.7194745e-4 m³/s
 *              (1 ft³ = 0.02831684659 m³, divided by 60 s/min)
 *   1 US gpm = 3.785411784 L / 60 s ≈ 6.30901964e-5 m³/s
 */
export class VolumetricFlow extends Quantity {
    public static ForParameter(value: VolumetricFlow | number, defaultValue: number, defaultUnit: Unit): VolumetricFlow {
        return value ? new VolumetricFlow(value, defaultUnit) : new VolumetricFlow(defaultValue, defaultUnit);
    }

    public static QuantityKind = "VolumeFlowRate";

    public static Units: { [key: string]: Unit } = {
        m3ps: new Unit("cubic meter per second", "m³/s", 1, "m3/s"),
        m3pmin: new Unit("cubic meter per minute", "m³/min", 1 / 60, "m3/min"),
        Lps: new Unit("litre per second", "L/s", 1e-3, "L/s"),
        Lpmin: new Unit("litre per minute", "L/min", 1e-3 / 60, "L/min"),
        mLpmin: new Unit("millilitre per minute", "mL/min", 1e-6 / 60, "mL/min"),
        m3ph: new Unit("cubic meter per hour", "m³/h", 1 / 3600, "m3/h"),
        cfm: new Unit("cubic feet per minute", "cfm", 0.02831684659 / 60, "[cft_i]/min"),
        gpm: new Unit("US gallon per minute", "gpm", 3.785411784e-3 / 60, "[gal_us]/min"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return VolumetricFlow.Units[str] || undefined;
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

    public static QuantityKind = "PlaneAngle";

    public static Units: { [key: string]: Unit } = {
        d: new Unit("degree", "°", 1, "deg"),
        r: new Unit("radian", "rad", Angle.RA2DE, "rad"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Angle.Units[str] || undefined;
    }
}

/**
 * Length: base = metre. All SI prefixes corrected to `1eN` (the old
 * module had a systematic `10eN` mistake that put every prefix
 * 10× off in the same direction). `Mi` and `Nmi` were carrying the
 * factor for km-base (1.609, 1.852) but used in metre-base context;
 * fixed to 1609.344 and 1852 respectively.
 */
export class Length extends Quantity {
    public static ForParameter(value: Length | number, defaultValue: number, defaultUnit: Unit): Length {
        return value ? new Length(value, defaultUnit) : new Length(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Length";

    public static Units: { [key: string]: Unit } = {
        ym: new Unit("yoctometer", "ym", 1e-24, "ym"),
        zm: new Unit("zeptometer", "zm", 1e-21, "zm"),
        am: new Unit("attometer", "am", 1e-18, "am"),
        fm: new Unit("femtometer", "fm", 1e-15, "fm"),
        pm: new Unit("picometer", "pm", 1e-12, "pm"),
        nm: new Unit("nanometer", "nm", 1e-9, "nm"),
        mim: new Unit("micrometer", "µm", 1e-6, "um"),
        mm: new Unit("millimeter", "mm", 1e-3, "mm"),
        cm: new Unit("centimeter", "cm", 1e-2, "cm"),
        in: new Unit("inch", "in", 0.0254, "[in_i]"),
        dm: new Unit("decimeter", "dm", 1e-1, "dm"),
        m: new Unit("meter", "m", 1, "m"),
        Mi: new Unit("mile", "mi", 1609.344, "[mi_i]"),
        Nmi: new Unit("nautical mile", "Nmi", 1852, "[nmi_i]"),
        Dam: new Unit("decameter", "dam", 10, "dam"),
        Hm: new Unit("hectometer", "hm", 100, "hm"),
        Km: new Unit("kilometer", "km", 1000, "km"),
        Sr: new Unit("solar radius", "R☉", 6.957e8, undefined),
        Mm: new Unit("megameter", "Mm", 1e6, "Mm"),
        Ls: new Unit("light second", "Ls", 299792458, "[c].s"),
        Gm: new Unit("gigameter", "Gm", 1e9, "Gm"),
        Au: new Unit("astronomical unit", "AU", 1.495978707e11, "AU"),
        Tm: new Unit("terameter", "Tm", 1e12, "Tm"),
        Pm: new Unit("petameter", "Pm", 1e15, "Pm"),
        Ly: new Unit("light year", "ly", 9.4607304725808e15, "[ly]"),
        Pc: new Unit("parsec", "pc", 3.0857e16, "pc"),
        Em: new Unit("exameter", "Em", 1e18, "Em"),
        Zm: new Unit("zettameter", "Zm", 1e21, "Zm"),
        Ym: new Unit("yottameter", "Ym", 1e24, "Ym"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Length.Units[str] || undefined;
    }
}

/**
 * Speed: base = metre per second. Now populated (the legacy module
 * shipped Speed with `Units = {}` and a `ForParameter` that returned
 * `Length`, both of which made the class unusable).
 */
export class Speed extends Quantity {
    public static ForParameter(value: Speed | number, defaultValue: number, defaultUnit: Unit): Speed {
        return value ? new Speed(value, defaultUnit) : new Speed(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Speed";

    public static Units: { [key: string]: Unit } = {
        mps: new Unit("meter per second", "m/s", 1, "m/s"),
        // mm/s is the ISO 20816-3 broadband velocity-RMS unit (severity node).
        mmps: new Unit("millimeter per second", "mm/s", 1e-3, "mm/s"),
        kph: new Unit("kilometer per hour", "km/h", 1000 / 3600, "km/h"),
        mph: new Unit("mile per hour", "mph", 1609.344 / 3600, "[mi_i]/h"),
        knot: new Unit("knot", "kn", 1852 / 3600, "[kn_i]"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Speed.Units[str] || undefined;
    }
}

export class Frequency extends Quantity {
    public static ForParameter(value: Frequency | number, defaultValue: number, defaultUnit: Unit): Frequency {
        return value ? new Frequency(value, defaultUnit) : new Frequency(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Frequency";

    public static Units: { [key: string]: Unit } = {
        Hz: new Unit("hertz", "Hz", 1, "Hz"),
        kHz: new Unit("kilohertz", "kHz", 1e3, "kHz"),
        MHz: new Unit("megahertz", "MHz", 1e6, "MHz"),
        GHz: new Unit("gigahertz", "GHz", 1e9, "GHz"),
        rps: new Unit("revolutions per second", "rps", 1, "{rev}/s"),
        rpm: new Unit("revolutions per minute", "rpm", 1 / 60, "{rev}/min"),
        // A slew rate expressed in whatever engineering unit the signal
        // carries, so only the "per second" is dimensioned. Same annotation
        // pattern as rps: the count is named, not measured.
        unitsps: new Unit("engineering units per second", "units/s", 1, "{units}/s"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Frequency.Units[str] || undefined;
    }
}

export class Acceleration extends Quantity {
    public static ForParameter(value: Acceleration | number, defaultValue: number, defaultUnit: Unit): Acceleration {
        return value ? new Acceleration(value, defaultUnit) : new Acceleration(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Acceleration";

    public static Units: { [key: string]: Unit } = {
        mps2: new Unit("meter per second squared", "m/s²", 1, "m/s2"),
        g: new Unit("standard gravity", "g", 9.80665, "[g]"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Acceleration.Units[str] || undefined;
    }
}

export class Pressure extends Quantity {
    public static ForParameter(value: Pressure | number, defaultValue: number, defaultUnit: Unit): Pressure {
        return value ? new Pressure(value, defaultUnit) : new Pressure(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Pressure";

    public static Units: { [key: string]: Unit } = {
        Pa: new Unit("pascal", "Pa", 1, "Pa"),
        hPa: new Unit("hectopascal", "hPa", 1e2, "hPa"),
        kPa: new Unit("kilopascal", "kPa", 1e3, "kPa"),
        MPa: new Unit("megapascal", "MPa", 1e6, "MPa"),
        bar: new Unit("bar", "bar", 1e5, "bar"),
        mbar: new Unit("millibar", "mbar", 1e2, "mbar"),
        atm: new Unit("atmosphere", "atm", 101325, "atm"),
        psi: new Unit("pound per square inch", "psi", 6894.757, "[psi]"),
        torr: new Unit("torr", "Torr", 133.322368, "mm[Hg]"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Pressure.Units[str] || undefined;
    }
}

export class Dimensionless extends Quantity {
    public static ForParameter(value: Dimensionless | number, defaultValue: number, defaultUnit: Unit): Dimensionless {
        return value ? new Dimensionless(value, defaultUnit) : new Dimensionless(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Dimensionless";

    public static Units: { [key: string]: Unit } = {
        none: new Unit("dimensionless", "", 1, "1"),
        ratio: new Unit("ratio", "ratio", 1, "1"),
        percent: new Unit("percent", "%", 0.01, "%"),
        ppm: new Unit("parts per million", "ppm", 1e-6, "[ppm]"),
        ppb: new Unit("parts per billion", "ppb", 1e-9, "[ppb]"),
        // A scale factor written as "2x". A pure ratio, kept apart from
        // `ratio` only so the panel can print the multiplication sign the
        // scene editor has always shown.
        times: new Unit("times", "×", 1, "1"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Dimensionless.Units[str] || undefined;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Chemistry quantities (P9.0)
//
// Used by `GasNode`, `PollutantNode` and `CompositionNode` in the
// chemistry plugin. Canonical SI bases throughout (kg/mol, kg/m³,
// J/(kg·K), W/(m·K), Pa·s); secondary units cover the conventions
// engineers actually write in: g/mol for molar mass, g/cm³ for
// density at STP, mg/m³ and μg/m³ for environmental concentrations,
// kJ/(kg·K) for specific heats, cP (centipoise = mPa·s) for fluid
// viscosity, μPa·s for low-pressure gas viscosity.
// ─────────────────────────────────────────────────────────────────────

/**
 * Molar mass: base = kilogram per mole. The g/mol unit is the
 * conventional one in chemistry tables, so the storage layer
 * (canonical SI) and the user-facing layer (g/mol) round-trip via
 * the Quantity API as usual.
 */
export class MolarMass extends Quantity {
    public static ForParameter(value: MolarMass | number, defaultValue: number, defaultUnit: Unit): MolarMass {
        return value ? new MolarMass(value, defaultUnit) : new MolarMass(defaultValue, defaultUnit);
    }

    public static QuantityKind = "MolarMass";

    public static Units: { [key: string]: Unit } = {
        kgpmol: new Unit("kilogram per mole", "kg/mol", 1, "kg/mol"),
        gpmol: new Unit("gram per mole", "g/mol", 1e-3, "g/mol"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MolarMass.Units[str] || undefined;
    }
}

/**
 * Mass density: base = kilogram per cubic metre. Used for gases at
 * STP / NTP, liquids, and particulate material densities. Distinct
 * from `MassConcentration` semantically (intrinsic property of a
 * substance vs. trace-species level) even though the dimensions
 * coincide — keeping the two type-distinct guards against accidental
 * mixing in formulas where context matters.
 */
export class Density extends Quantity {
    public static ForParameter(value: Density | number, defaultValue: number, defaultUnit: Unit): Density {
        return value ? new Density(value, defaultUnit) : new Density(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Density";

    public static Units: { [key: string]: Unit } = {
        kgpm3: new Unit("kilogram per cubic meter", "kg/m³", 1, "kg/m3"),
        gpcm3: new Unit("gram per cubic centimeter", "g/cm³", 1000, "g/cm3"),
        gpL: new Unit("gram per litre", "g/L", 1, "g/L"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Density.Units[str] || undefined;
    }
}

/**
 * Mass concentration of a trace species: base = kilogram per cubic
 * metre. Environmental measurement units (mg/m³, μg/m³) dominate at
 * call sites — TWA / STEL / IDLH limits, indoor-air-quality reports.
 * Dimensionally identical to `Density` but kept separate so the
 * Quantity type carries the semantic context.
 */
/**
 * Mass flow rate: base = kilogram per second.
 *
 * Added 2026-09-25 for the habitat's filters and scrubbers, whose loading
 * and transport are declared in kg/s by the register's descriptors, so a
 * request written in g/min or kg/h converts through the same table.
 */
export class MassFlow extends Quantity {
    public static ForParameter(value: MassFlow | number, defaultValue: number, defaultUnit: Unit): MassFlow {
        return value ? new MassFlow(value, defaultUnit) : new MassFlow(defaultValue, defaultUnit);
    }

    public static QuantityKind = "MassFlowRate";

    public static Units: { [key: string]: Unit } = {
        kgps: new Unit("kilogram per second", "kg/s", 1, "kg/s"),
        gps: new Unit("gram per second", "g/s", 1e-3, "g/s"),
        gpmin: new Unit("gram per minute", "g/min", 1e-3 / 60, "g/min"),
        kgpmin: new Unit("kilogram per minute", "kg/min", 1 / 60, "kg/min"),
        kgph: new Unit("kilogram per hour", "kg/h", 1 / 3600, "kg/h"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MassFlow.Units[str] || undefined;
    }
}

export class MassConcentration extends Quantity {
    public static ForParameter(value: MassConcentration | number, defaultValue: number, defaultUnit: Unit): MassConcentration {
        return value ? new MassConcentration(value, defaultUnit) : new MassConcentration(defaultValue, defaultUnit);
    }

    public static QuantityKind = "MassConcentration";

    public static Units: { [key: string]: Unit } = {
        kgpm3: new Unit("kilogram per cubic meter", "kg/m³", 1, "kg/m3"),
        mgpm3: new Unit("milligram per cubic meter", "mg/m³", 1e-6, "mg/m3"),
        ugpm3: new Unit("microgram per cubic meter", "µg/m³", 1e-9, "ug/m3"),
        mgpL: new Unit("milligram per litre", "mg/L", 1e-3, "mg/L"),
        ugpL: new Unit("microgram per litre", "µg/L", 1e-6, "ug/L"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MassConcentration.Units[str] || undefined;
    }
}

/**
 * Specific heat capacity at constant pressure (per unit mass): base
 * = joule per kilogram per kelvin. Engineering tables often quote
 * kJ/(kg·K) — water is ~4.184 kJ/(kg·K), air ~1.005 kJ/(kg·K).
 */
export class MassSpecificHeat extends Quantity {
    public static ForParameter(value: MassSpecificHeat | number, defaultValue: number, defaultUnit: Unit): MassSpecificHeat {
        return value ? new MassSpecificHeat(value, defaultUnit) : new MassSpecificHeat(defaultValue, defaultUnit);
    }

    public static QuantityKind = "SpecificHeatCapacity";

    public static Units: { [key: string]: Unit } = {
        JpkgK: new Unit("joule per kilogram per kelvin", "J/(kg·K)", 1, "J/(kg.K)"),
        kJpkgK: new Unit("kilojoule per kilogram per kelvin", "kJ/(kg·K)", 1e3, "kJ/(kg.K)"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MassSpecificHeat.Units[str] || undefined;
    }
}

/**
 * Thermal conductivity: base = watt per metre per kelvin. Air sits
 * around 0.026 W/(m·K) at room temperature; copper ~400 W/(m·K).
 * The mW/(m·K) form is the conventional one for gas tables.
 */
export class ThermalConductivity extends Quantity {
    public static ForParameter(value: ThermalConductivity | number, defaultValue: number, defaultUnit: Unit): ThermalConductivity {
        return value ? new ThermalConductivity(value, defaultUnit) : new ThermalConductivity(defaultValue, defaultUnit);
    }

    public static QuantityKind = "ThermalConductivity";

    public static Units: { [key: string]: Unit } = {
        WpmK: new Unit("watt per meter per kelvin", "W/(m·K)", 1, "W/(m.K)"),
        mWpmK: new Unit("milliwatt per meter per kelvin", "mW/(m·K)", 1e-3, "mW/(m.K)"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return ThermalConductivity.Units[str] || undefined;
    }
}

/**
 * Dynamic (shear) viscosity: base = pascal-second. The conventional
 * units are the centipoise (cP ≡ mPa·s, water at 20 °C ≈ 1 cP) and
 * the micropascal-second (μPa·s, air at 20 °C ≈ 18 μPa·s).
 */
export class DynamicViscosity extends Quantity {
    public static ForParameter(value: DynamicViscosity | number, defaultValue: number, defaultUnit: Unit): DynamicViscosity {
        return value ? new DynamicViscosity(value, defaultUnit) : new DynamicViscosity(defaultValue, defaultUnit);
    }

    public static QuantityKind = "DynamicViscosity";

    public static Units: { [key: string]: Unit } = {
        Pas: new Unit("pascal-second", "Pa·s", 1, "Pa.s"),
        cP: new Unit("centipoise", "cP", 1e-3, "cP"),
        mPas: new Unit("millipascal-second", "mPa·s", 1e-3, "mPa.s"),
        uPas: new Unit("micropascal-second", "µPa·s", 1e-6, "uPa.s"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return DynamicViscosity.Units[str] || undefined;
    }
}

/**
 * Force: base = newton. Declared eight times across the mechanical
 * plugins (bearing load, unbalance force, contact force) with no
 * quantity behind it until now.
 */
export class Force extends Quantity {
    public static ForParameter(value: Force | number, defaultValue: number, defaultUnit: Unit): Force {
        return value ? new Force(value, defaultUnit) : new Force(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Force";

    public static Units: { [key: string]: Unit } = {
        N: new Unit("newton", "N", 1, "N"),
        mN: new Unit("millinewton", "mN", 1e-3, "mN"),
        kN: new Unit("kilonewton", "kN", 1e3, "kN"),
        lbf: new Unit("pound-force", "lbf", 4.4482216152605, "[lbf_av]"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Force.Units[str] || undefined;
    }
}

/**
 * Translational stiffness: base = newton per metre. This is the
 * bearing stiffness `k` of the gravity-sag relation
 * `delta = m_rotor * g_radial / k_bearing`, so it is a load-bearing
 * quantity of the microgravity work rather than a convenience.
 */
export class Stiffness extends Quantity {
    public static ForParameter(value: Stiffness | number, defaultValue: number, defaultUnit: Unit): Stiffness {
        return value ? new Stiffness(value, defaultUnit) : new Stiffness(defaultValue, defaultUnit);
    }

    public static QuantityKind = "ForcePerLength";

    public static Units: { [key: string]: Unit } = {
        Npm: new Unit("newton per meter", "N/m", 1, "N/m"),
        kNpm: new Unit("kilonewton per meter", "kN/m", 1e3, "kN/m"),
        MNpm: new Unit("meganewton per meter", "MN/m", 1e6, "MN/m"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Stiffness.Units[str] || undefined;
    }
}

/**
 * Torque: base = newton-metre. Dimensionally an energy, kept apart
 * deliberately: a load torque and a joule are not interchangeable at a
 * port, and the separation is the only thing that says so.
 */
export class Torque extends Quantity {
    public static ForParameter(value: Torque | number, defaultValue: number, defaultUnit: Unit): Torque {
        return value ? new Torque(value, defaultUnit) : new Torque(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Torque";

    public static Units: { [key: string]: Unit } = {
        Nm: new Unit("newton meter", "N·m", 1, "N.m"),
        mNm: new Unit("millinewton meter", "mN·m", 1e-3, "mN.m"),
        kNm: new Unit("kilonewton meter", "kN·m", 1e3, "kN.m"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Torque.Units[str] || undefined;
    }
}

/**
 * Inductance: base = henry. The dq machine model declares Ld and Lq
 * in henries and millihenries.
 */
export class Inductance extends Quantity {
    public static ForParameter(value: Inductance | number, defaultValue: number, defaultUnit: Unit): Inductance {
        return value ? new Inductance(value, defaultUnit) : new Inductance(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Inductance";

    public static Units: { [key: string]: Unit } = {
        H: new Unit("henry", "H", 1, "H"),
        mH: new Unit("millihenry", "mH", 1e-3, "mH"),
        uH: new Unit("microhenry", "\u00b5H", 1e-6, "uH"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Inductance.Units[str] || undefined;
    }
}

/**
 * Magnetic flux: base = weber. Permanent-magnet flux linkage, the
 * term that turns rotor angle into back-EMF.
 */
export class MagneticFlux extends Quantity {
    public static ForParameter(value: MagneticFlux | number, defaultValue: number, defaultUnit: Unit): MagneticFlux {
        return value ? new MagneticFlux(value, defaultUnit) : new MagneticFlux(defaultValue, defaultUnit);
    }

    public static QuantityKind = "MagneticFlux";

    public static Units: { [key: string]: Unit } = {
        Wb: new Unit("weber", "Wb", 1, "Wb"),
        mWb: new Unit("milliweber", "mWb", 1e-3, "mWb"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MagneticFlux.Units[str] || undefined;
    }
}

/**
 * Electrical resistance: base = ohm. Stator winding resistance, and
 * the only quantity here whose UCUM code is spelled out rather than
 * symbolic, "Ohm" and not the greek letter.
 */
export class Resistance extends Quantity {
    public static ForParameter(value: Resistance | number, defaultValue: number, defaultUnit: Unit): Resistance {
        return value ? new Resistance(value, defaultUnit) : new Resistance(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Resistance";

    public static Units: { [key: string]: Unit } = {
        ohm: new Unit("ohm", "\u03a9", 1, "Ohm"),
        mohm: new Unit("milliohm", "m\u03a9", 1e-3, "mOhm"),
        kohm: new Unit("kiloohm", "k\u03a9", 1e3, "kOhm"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Resistance.Units[str] || undefined;
    }
}

/**
 * Apparent power: base = volt-ampere. Separate from `Power` because
 * the distinction between S, P and Q is the whole content of a power
 * factor, and a port that accepts watts must not silently accept VA.
 */
export class ApparentPower extends Quantity {
    public static ForParameter(value: ApparentPower | number, defaultValue: number, defaultUnit: Unit): ApparentPower {
        return value ? new ApparentPower(value, defaultUnit) : new ApparentPower(defaultValue, defaultUnit);
    }

    public static QuantityKind = "ApparentPower";

    public static Units: { [key: string]: Unit } = {
        VA: new Unit("volt-ampere", "VA", 1, "V.A"),
        kVA: new Unit("kilovolt-ampere", "kVA", 1e3, "kV.A"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return ApparentPower.Units[str] || undefined;
    }
}

/**
 * Reactive power: base = var.
 *
 * UCUM has no code for the var, and none is possible: it is
 * dimensionally identical to the watt and the volt-ampere, the three
 * being told apart by what they mean and not by what they measure.
 * "V.A" is therefore exact as a unit and insufficient as an identity,
 * which is precisely why the quantity kind travels alongside the code
 * rather than being derived from it.
 */
export class ReactivePower extends Quantity {
    public static ForParameter(value: ReactivePower | number, defaultValue: number, defaultUnit: Unit): ReactivePower {
        return value ? new ReactivePower(value, defaultUnit) : new ReactivePower(defaultValue, defaultUnit);
    }

    public static QuantityKind = "ReactivePower";

    public static Units: { [key: string]: Unit } = {
        var: new Unit("volt-ampere reactive", "var", 1, "V.A"),
        kvar: new Unit("kilovolt-ampere reactive", "kvar", 1e3, "kV.A"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return ReactivePower.Units[str] || undefined;
    }
}

/**
 * Energy: base = joule. Watt-hours included because consumption
 * budgets are stated in them and converting at the call site is how
 * factors of 3600 get lost.
 */
export class Energy extends Quantity {
    public static ForParameter(value: Energy | number, defaultValue: number, defaultUnit: Unit): Energy {
        return value ? new Energy(value, defaultUnit) : new Energy(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Energy";

    public static Units: { [key: string]: Unit } = {
        J: new Unit("joule", "J", 1, "J"),
        kJ: new Unit("kilojoule", "kJ", 1e3, "kJ"),
        Wh: new Unit("watt hour", "Wh", 3600, "W.h"),
        kWh: new Unit("kilowatt hour", "kWh", 3.6e6, "kW.h"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Energy.Units[str] || undefined;
    }
}

/**
 * Mass moment of inertia: base = kilogram square metre. The rotor
 * inertia J of the mechanical equation of motion.
 */
export class MomentOfInertia extends Quantity {
    public static ForParameter(value: MomentOfInertia | number, defaultValue: number, defaultUnit: Unit): MomentOfInertia {
        return value ? new MomentOfInertia(value, defaultUnit) : new MomentOfInertia(defaultValue, defaultUnit);
    }

    public static QuantityKind = "MomentOfInertia";

    public static Units: { [key: string]: Unit } = {
        kgm2: new Unit("kilogram square meter", "kg\u00b7m\u00b2", 1, "kg.m2"),
        gcm2: new Unit("gram square centimeter", "g\u00b7cm\u00b2", 1e-7, "g.cm2"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MomentOfInertia.Units[str] || undefined;
    }
}

/**
 * First moment of mass: base = kilogram-metre.
 *
 * This is static unbalance, `m * r`, the quantity a balancing machine
 * reports and the input of the unbalance fault. Balancing practice
 * states it in gram-millimetres, six orders of magnitude below the
 * base, which is exactly the kind of gap that must not be left to a
 * literal at the call site.
 */
export class MassMoment extends Quantity {
    public static ForParameter(value: MassMoment | number, defaultValue: number, defaultUnit: Unit): MassMoment {
        return value ? new MassMoment(value, defaultUnit) : new MassMoment(defaultValue, defaultUnit);
    }

    public static QuantityKind = "MassMoment";

    public static Units: { [key: string]: Unit } = {
        kgm: new Unit("kilogram meter", "kg\u00b7m", 1, "kg.m"),
        gmm: new Unit("gram millimeter", "g\u00b7mm", 1e-6, "g.mm"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return MassMoment.Units[str] || undefined;
    }
}

/**
 * Angular velocity: base = radian per second.
 *
 * Distinct from `Frequency` even though rpm appears in both. A shaft
 * turning at 3000 rpm has a mechanical frequency of 50 Hz and an
 * angular velocity of 314 rad/s; the factor of 2*pi between them is
 * the single most reliable source of error in rotating-machine code,
 * and it belongs in the unit system rather than in each formula.
 */
export class AngularVelocity extends Quantity {
    public static ForParameter(value: AngularVelocity | number, defaultValue: number, defaultUnit: Unit): AngularVelocity {
        return value ? new AngularVelocity(value, defaultUnit) : new AngularVelocity(defaultValue, defaultUnit);
    }

    public static QuantityKind = "AngularVelocity";

    public static Units: { [key: string]: Unit } = {
        radps: new Unit("radian per second", "rad/s", 1, "rad/s"),
        degps: new Unit("degree per second", "\u00b0/s", Math.PI / 180, "deg/s"),
        rpm: new Unit("revolutions per minute", "rpm", (2 * Math.PI) / 60, "{rev}/min"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return AngularVelocity.Units[str] || undefined;
    }
}

/**
 * Logarithmic level: base = decibel.
 *
 * Its own quantity, and not a member of `Dimensionless`, because the
 * generic linear conversion is meaningless on a logarithmic scale: a
 * class holding both dB and percent would let `Convert` turn one into
 * the other and produce a number that looks like an answer. Within
 * this class conversion is legitimate, one bel being ten decibels.
 */
export class Level extends Quantity {
    public static ForParameter(value: Level | number, defaultValue: number, defaultUnit: Unit): Level {
        return value ? new Level(value, defaultUnit) : new Level(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Level";

    public static Units: { [key: string]: Unit } = {
        dB: new Unit("decibel", "dB", 1, "dB"),
        B: new Unit("bel", "B", 10, "B"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Level.Units[str] || undefined;
    }
}

/**
 * A count of things: base = one, of whatever is being counted.
 *
 * Window lengths, FFT bins, filter coefficients, octave bands. All are
 * dimensionless, and writing them as such would be true and useless: the
 * panel would print nothing where it used to print "samples", and a port
 * expecting bins would accept frames.
 *
 * UCUM's answer is the annotation, a name in braces carrying no dimension:
 * "{samples}" is the number one, labelled. So the label survives into every
 * exposition instead of being a display string the unit system never saw.
 *
 * Separate from `Dimensionless` because conversion between members is
 * meaningless here: 8 bins is not 8 frames in any factor, whereas a ratio
 * really does convert to a percentage.
 */
export class Count extends Quantity {
    public static ForParameter(value: Count | number, defaultValue: number, defaultUnit: Unit): Count {
        return value ? new Count(value, defaultUnit) : new Count(defaultValue, defaultUnit);
    }

    public static QuantityKind = "Dimensionless";

    public static Units: { [key: string]: Unit } = {
        persons: new Unit("persons", "persons", 1, "{person}"),
        samples: new Unit("samples", "samples", 1, "{samples}"),
        bins: new Unit("bins", "bins", 1, "{bins}"),
        bands: new Unit("bands", "bands", 1, "{bands}"),
        coeffs: new Unit("coefficients", "coeffs", 1, "{coeffs}"),
        steps: new Unit("steps", "steps", 1, "{steps}"),
        rows: new Unit("rows", "rows", 1, "{rows}"),
        frames: new Unit("frames", "frames", 1, "{frames}"),
    };

    public unitForSymbol(str: string): Unit | undefined {
        return Count.Units[str] || undefined;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Unit-tag resolution
//
// QUANTITY_REGISTRY maps an IUnitTag.quantity string to the Quantity
// subclass that owns the `Units` vocabulary; resolveUnit() returns the
// concrete Unit (or undefined for an unknown quantity/unit key). Declared
// AFTER every class so the registry references initialized bindings.
// ─────────────────────────────────────────────────────────────────────

interface IQuantityClass {
    QuantityKind: string;
    Units: { [key: string]: Unit };
}

const QUANTITY_REGISTRY: { [quantity: string]: IQuantityClass } = {
    Timespan, Temperature, Mass, Power, Voltage, Current, Luminosity, Volume, Area,
    VolumetricFlow, Angle, Length, Speed, Frequency, Acceleration, Pressure, Dimensionless,
    MolarMass, Density, MassFlow, MassConcentration, MassSpecificHeat, ThermalConductivity, DynamicViscosity,
    Force, Stiffness, Torque, Inductance, MagneticFlux, Resistance, ApparentPower, ReactivePower,
    Energy, MomentOfInertia, MassMoment, AngularVelocity, Level, Count,
};

/** Every registered quantity name, for tooling that has to walk the system. */
export function quantityNames(): ReadonlyArray<string> {
    return Object.keys(QUANTITY_REGISTRY);
}

/** The `Units` map of one registered quantity, or undefined if unknown. */
export function quantityUnits(quantity: string): { [key: string]: Unit } | undefined {
    return QUANTITY_REGISTRY[quantity]?.Units;
}

/**
 * The semantic kind a quantity measures, e.g. "ElectricCurrent" for
 * `Current`.
 *
 * Declared on each class rather than derived from its name: the two coincide
 * often enough to make derivation tempting and not always, `Current` giving
 * `ElectricCurrent` and `Angle` giving `PlaneAngle`. It is the second half of
 * an identity whose first half is the UCUM code, and it is what carries the
 * distinctions UCUM cannot express, watt against volt-ampere against var.
 */
export function resolveQuantityKind(quantity: string): string | undefined {
    return QUANTITY_REGISTRY[quantity]?.QuantityKind;
}

/**
 * Resolve a serializable {@link IUnitTag} to the concrete {@link Unit}
 * instance, or `undefined` when the quantity or unit key is unknown.
 */
export function resolveUnit(tag: IUnitTag): Unit | undefined {
    const q = QUANTITY_REGISTRY[tag.quantity];
    return q ? q.Units[tag.unit] : undefined;
}

/**
 * The display symbol of a tagged unit, for a panel or a label.
 *
 * The one place a display string is legitimate is the last step before a
 * human reads it. Everywhere else the tag travels, so that the symbol's
 * typographic characters and its cross-quantity collisions ("g" is gram and
 * standard gravity) stay a rendering concern rather than an identity.
 */
export function unitSymbol(tag?: IUnitTag): string | undefined {
    return tag ? resolveUnit(tag)?.symbol : undefined;
}
