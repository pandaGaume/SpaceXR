import { Quantity, Scalar, Unit } from "../math";
import { Bounds2 } from "./geometry.bounds";
import { ICartesian2, ICartesian3, ICartesian4, RegionCode } from "./geometry.interfaces";

export class Cartesian2 implements ICartesian2 {
    public static Flatten(values: Array<ICartesian3>, ref?: Float32Array | Array<number>): Float32Array | Array<number> {
        ref = ref ?? new Float32Array(values.length * 2);
        let i = 0;
        for (let j = 0; j < values.length; j++) {
            ref[i++] = values[j].x;
            ref[i++] = values[j].y;
        }
        return ref;
    }
    public static ComputeCode(point: ICartesian2, clipArea: Bounds2): RegionCode {
        // initialized as being inside
        let code = RegionCode.INSIDE;

        if (point.x < clipArea.xmin) {
            // to the left of rectangle
            code |= RegionCode.LEFT;
        } else if (point.x > clipArea.xmax) {
            // to the right of rectangle
            code |= RegionCode.RIGHT;
        }

        if (point.y < clipArea.ymin) {
            // below the rectangle
            code |= RegionCode.BOTTOM;
        } else if (point.y > clipArea.ymax) {
            // above the rectangle
            code |= RegionCode.TOP;
        }

        return code;
    }
    public static Dot(a: ICartesian2, b: ICartesian2): number {
        return a.x * b.y - a.y * b.x;
    }

    public static Cross(a: ICartesian2, b: ICartesian2): ICartesian2 {
        return new Cartesian2(a.x * b.y - a.y * b.x, a.y * b.x - a.x * b.y);
    }

    public static Subtract(a: ICartesian2, b: ICartesian2): ICartesian2 {
        return new Cartesian2(a.x - b.x, a.y - b.y);
    }

    public static ConvertInPlace(value: ICartesian2, from: Unit, to: Unit): ICartesian2 {
        return Cartesian2.ConvertToRef(value, from, to, value);
    }

    public static ConvertToRef(value: ICartesian2, from: Unit, to: Unit, ref?: ICartesian2): ICartesian2 {
        ref = ref ?? Cartesian2.Zero();
        ref.x = Quantity.Convert(value.x, from, to);
        ref.y = Quantity.Convert(value.y, from, to);
        return ref;
    }

    public static Zero(): ICartesian2 {
        return new Cartesian2(0, 0);
    }
    public static One(): ICartesian2 {
        return new Cartesian2(1, 1);
    }

    public static Infinity(): ICartesian2 {
        return new Cartesian2(Infinity, Infinity);
    }

    public constructor(public x: number, public y: number) {}

    public toString() {
        return `x:${this.x}, y:${this.y}`;
    }
}
export class Cartesian3 extends Cartesian2 implements ICartesian3 {
    public static Dot(a: ICartesian3, b: ICartesian3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    public static Cross(a: ICartesian3, b: ICartesian3): ICartesian3 {
        return new Cartesian3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }

    public static Subtract(a: ICartesian3, b: ICartesian3): ICartesian3 {
        return new Cartesian3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    public static Normalize(a: ICartesian3): ICartesian3 {
        return Cartesian3.NormalizeToRef(a, Cartesian3.Zero());
    }

    public static NormalizeInPlace(a: ICartesian3): ICartesian3 {
        return Cartesian3.NormalizeToRef(a, a);
    }

    public static Normal(v0: ICartesian3, v1: ICartesian3, v2: ICartesian3): ICartesian3 {
        return Cartesian3.NormalizeInPlace(Cartesian3.Cross(Cartesian3.Subtract(v1, v0), Cartesian3.Subtract(v2, v0)));
    }

    public static NormalizeToRef(a: ICartesian3, ref: ICartesian3): ICartesian3 {
        const length = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        ref.x = a.x / length;
        ref.y = a.y / length;
        ref.z = a.z / length;
        return ref;
    }

    /// <summary>
    ///   Check if two points are coincident
    /// </summary>

    public static AreCoincident(a: ICartesian3, b: ICartesian3, epsilon?: number): boolean {
        const length = Cartesian3.Magnitude(Cartesian3.Subtract(a, b));
        return length <= (epsilon ?? Scalar.EPSILON);
    }

    /// <summary>
    ///   Check if three points are collinear
    /// </summary>
    public static AreCollinear(a: ICartesian3, b: ICartesian3, c: ICartesian3, epsilon?: number): boolean {
        const length = Cartesian3.Magnitude(Cartesian3.Cross(Cartesian3.Subtract(b, a), Cartesian3.Subtract(c, a)));
        return length <= (epsilon ?? Scalar.EPSILON);
    }

    static IsWithinTheBounds(a: ICartesian3, b: ICartesian3, p: ICartesian3): boolean {
        // Check for collinearity
        if (!Cartesian3.AreCollinear(a, b, p)) {
            return false;
        }

        // Compute vectors
        const ab = Cartesian3.Subtract(b, a);
        const ap = Cartesian3.Subtract(p, a);
        const bp = Cartesian3.Subtract(p, b);

        // Check if the dot product of AB and AP is non-negative (p is not behind a)
        if (Cartesian3.Dot(ab, ap) < 0) {
            return false;
        }

        // Check if the dot product of AB and BP is non-positive (p is not beyond b)
        if (Cartesian3.Dot(ab, bp) > 0) {
            return false;
        }

        return true;
    }

    /// <summary>
    ///   Check if four points are coplanar
    /// </summary>
    public static AreCoplanar(a: ICartesian3, b: ICartesian3, c: ICartesian3, d: ICartesian3, epsilon?: number): boolean {
        var n1 = Cartesian3.Cross(Cartesian3.Subtract(c, a), Cartesian3.Subtract(c, b));
        var n2 = Cartesian3.Cross(Cartesian3.Subtract(d, a), Cartesian3.Subtract(d, b));

        var m1 = Cartesian3.Magnitude(n1);
        var m2 = Cartesian3.Magnitude(n2);

        const EPSILON = epsilon ?? Scalar.EPSILON;

        return (
            m1 <= EPSILON ||
            m2 <= EPSILON ||
            Cartesian3.AreCollinear(Cartesian3.Zero(), Cartesian3.MultiplyByFloatInPlace(n1, 1.0 / m1), Cartesian3.MultiplyByFloatInPlace(n2, 1.0 / m2))
        );
    }

    public static Multiply(a: ICartesian3, b: ICartesian3): ICartesian3 {
        return Cartesian3.MultiplyToRef(a, b, Cartesian3.Zero());
    }

    public static MultiplyInPlace(a: ICartesian3, b: ICartesian3): ICartesian3 {
        return Cartesian3.MultiplyToRef(a, b, a);
    }

    public static MultiplyToRef(a: ICartesian3, b: ICartesian3, ref: ICartesian3): ICartesian3 {
        ref.x = a.x * b.x;
        ref.y = a.y * b.y;
        ref.z = a.z * b.z;
        return ref;
    }

    public static MultiplyByFloatInPlace(a: ICartesian3, n: number): ICartesian3 {
        return Cartesian3.MultiplyByFloatToRef(a, n, a);
    }

    public static MultiplyByFloatToRef(a: ICartesian3, n: number, ref: ICartesian3): ICartesian3 {
        ref.x = a.x * n;
        ref.y = a.y * n;
        ref.z = a.z * n;
        return ref;
    }

    public static Divide(a: ICartesian3, b: ICartesian3): ICartesian3 {
        return Cartesian3.DivideToRef(a, b, Cartesian3.Zero());
    }

    public static DivideInPlace(a: ICartesian3, b: ICartesian3): ICartesian3 {
        return Cartesian3.DivideToRef(a, b, a);
    }

    public static DivideToRef(a: ICartesian3, b: ICartesian3, ref: ICartesian3): ICartesian3 {
        ref.x = b.x ? a.x / b.x : Infinity;
        ref.y = b.y ? a.y / b.y : Infinity;
        ref.z = b.z ? a.z / b.z : Infinity;
        return ref;
    }

    public static DivideByFloatInPlace(a: ICartesian3, n: number): ICartesian3 {
        return Cartesian3.DivideByFloatToRef(a, n, a);
    }

    public static DivideByFloatToRef(a: ICartesian3, n: number, ref: ICartesian3): ICartesian3 {
        if (n === 0) {
            ref.x = ref.y = ref.z = Infinity;
        }
        ref.x = a.x / n;
        ref.y = a.y / n;
        ref.z = a.z / n;
        return ref;
    }

    public static Distance(a: ICartesian3, b: ICartesian3): number {
        return Cartesian3.Magnitude(Cartesian3.Subtract(b, a));
    }

    public static Magnitude(a: ICartesian3): number {
        return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    }

    public static ConvertInPlace(value: ICartesian3 | ICartesian4, from: Unit, to: Unit): ICartesian3 {
        return Cartesian3.ConvertToRef(value, from, to, value);
    }

    public static ConvertToRef(value: ICartesian3 | ICartesian4, from: Unit, to: Unit, ref?: ICartesian3): ICartesian3 {
        ref = ref ?? Cartesian3.Zero();
        ref.x = Quantity.Convert(value.x, from, to);
        ref.y = Quantity.Convert(value.y, from, to);
        ref.z = Quantity.Convert(value.z, from, to);
        return ref;
    }

    public static Centroid(values: Array<ICartesian3>, ref?: ICartesian3): ICartesian3 {
        let x = 0;
        let y = 0;
        let z = 0;

        for (let i = 0; i < values.length; i++) {
            x += values[i].x;
            y += values[i].y;
            z += values[i].z;
        }

        const count = values.length;
        ref = ref ?? Cartesian3.Zero();
        ref.x = x / count;
        ref.y = y / count;
        ref.z = z / count;
        return ref;
    }

    public static Zero(): ICartesian3 {
        return new Cartesian3(0, 0, 0);
    }

    public static One(): ICartesian3 {
        return new Cartesian3(1.0, 1.0, 1.0);
    }

    public static Infinity(): ICartesian3 {
        return new Cartesian3(Infinity, Infinity, Infinity);
    }

    public static FromArray(array: Float32Array | Array<number>, offset: number = 0, stride: number = 3): ICartesian3 {
        let i = 0;
        const x = array[offset + i];
        const y = i < stride ? array[offset + ++i] : 0;
        const z = i < stride ? array[offset + ++i] : 0;
        return new Cartesian3(x, y, z);
    }

    public static Flatten(values: Array<ICartesian3>, ref?: Float32Array | Array<number>): Float32Array | Array<number> {
        ref = ref ?? new Float32Array(values.length * 3);
        let i = 0;
        for (let j = 0; j < values.length; j++) {
            ref[i++] = values[j].x;
            ref[i++] = values[j].y;
            ref[i++] = values[j].z;
        }
        return ref;
    }

    public static Equals(a: ICartesian3, b: ICartesian3, epsilon?: number): boolean {
        epsilon = epsilon ?? Scalar.EPSILON;
        return Scalar.WithinEpsilon(a.x, b.x, epsilon) && Scalar.WithinEpsilon(a.y, b.y, epsilon) && Scalar.WithinEpsilon(a.z, b.z, epsilon);
    }

    public constructor(x: number, y: number, public z: number = 0.0) {
        super(x, y);
    }

    public toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}`;
    }
}

export class Cartesian4 extends Cartesian3 implements ICartesian4 {
    public static Zero() {
        return new Cartesian4(0, 0, 0);
    }
    public constructor(x: number, y: number, z: number, public w: number = 1.0) {
        super(x, y, z);
    }
    public toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}, w:${this.w}`;
    }
}
