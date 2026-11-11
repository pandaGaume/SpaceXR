import { ICartesian2, ICartesian3, ICartesian4 } from "./geometry.interfaces";

export class Cartesian2 implements ICartesian2 {
    public static Zero(): ICartesian2 {
        return new Cartesian2(0, 0);
    }
    public static One(): ICartesian2 {
        return new Cartesian2(1, 1);
    }
    public static Infinity(): ICartesian2 {
        return new Cartesian2(Infinity, Infinity);
    }

    public constructor(
        public x: number = 0,
        public y: number = 0
    ) {}

    // Variadic helper: works for 2D/3D/4D without overriding
    protected newThis(...args: any[]): this {
        const C = this.constructor as new (...a: any[]) => this;
        return new C(...args);
    }

    public distance(b: ICartesian2): number {
        const dx = b.x - this.x,
            dy = b.y - this.y;
        return Math.hypot(dx, dy);
    }

    public distanceSquared(b: ICartesian2): number {
        const dx = b.x - this.x,
            dy = b.y - this.y;
        return dx * dx + dy * dy;
    }

    public subtract(b: ICartesian2): this {
        return this.newThis(this.x - b.x, this.y - b.y);
    }

    public add(b: ICartesian2): this {
        return this.newThis(this.x + b.x, this.y + b.y);
    }

    public addInPlace(b: ICartesian2): this {
        this.x += b.x;
        this.y += b.y;
        return this;
    }

    public multiplyByScalar(n: number): this {
        return this.newThis(this.x * n, this.y * n);
    }

    public divideByScalar(n: number): this {
        if (n === 0) throw new Error("Divide by zero");
        return this.newThis(this.x / n, this.y / n);
    }

    public magnitude(): number {
        return Math.hypot(this.x, this.y);
    }

    public clone(): this {
        return this.newThis(this.x, this.y);
    }

    public toString(): string {
        return `x:${this.x}, y:${this.y}`;
    }
}

export class Cartesian3 extends Cartesian2 implements ICartesian3 {
    public static Zero(): ICartesian3 {
        return new Cartesian3(0, 0, 0);
    }
    public static One(): ICartesian3 {
        return new Cartesian3(1, 1, 1);
    }
    public static Infinity(): ICartesian3 {
        return new Cartesian3(Infinity, Infinity, Infinity);
    }

    public constructor(
        x: number = 0,
        y: number = 0,
        public z: number = 0
    ) {
        super(x, y);
    }

    public override distance(b: ICartesian3): number {
        const dx = b.x - this.x,
            dy = b.y - this.y,
            dz = b.z - this.z;
        return Math.hypot(dx, dy, dz);
    }

    public override distanceSquared(b: ICartesian3): number {
        const dx = b.x - this.x,
            dy = b.y - this.y,
            dz = b.z - this.z;
        return dx * dx + dy * dy + dz * dz;
    }

    public subtract(b: ICartesian3): this {
        return this.newThis(this.x - b.x, this.y - b.y, this.z - b.z);
    }

    public add(b: ICartesian3): this {
        return this.newThis(this.x + b.x, this.y + b.y, this.z + b.z);
    }

    public override addInPlace(b: ICartesian3): this {
        this.x += b.x;
        this.y += b.y;
        this.z += b.z;
        return this;
    }

    public override multiplyByScalar(n: number): this {
        return this.newThis(this.x * n, this.y * n, this.z * n);
    }

    public override divideByScalar(n: number): this {
        if (n === 0) throw new Error("Divide by zero");
        return this.newThis(this.x / n, this.y / n, this.z / n);
    }

    public override magnitude(): number {
        return Math.hypot(this.x, this.y, this.z);
    }

    public override clone(): this {
        return this.newThis(this.x, this.y, this.z);
    }

    public override toString(): string {
        return `${super.toString()}, z:${this.z}`;
    }
}

export class Cartesian4 extends Cartesian3 implements ICartesian4 {
    public static Zero(): ICartesian4 {
        // Zero point by convention
        return new Cartesian4(0, 0, 0, 1);
    }
    public static One(): ICartesian4 {
        return new Cartesian4(1, 1, 1, 1);
    }
    public static Infinity(): ICartesian4 {
        // Not very meaningful for homogeneous, but keep API parity
        return new Cartesian4(Infinity, Infinity, Infinity, 1);
    }

    public constructor(
        x: number = 0,
        y: number = 0,
        z: number = 0,
        public w: number = 1
    ) {
        super(x, y, z);
        // Canonicalize: if a point has w != 0 and w != 1, divide through
        if (this.w !== 0 && this.w !== 1) {
            this.x /= this.w;
            this.y /= this.w;
            this.z /= this.w;
            this.w = 1;
        }
    }

    // Convenience constructors
    public static Point(x: number, y: number, z: number): Cartesian4 {
        return new Cartesian4(x, y, z, 1);
    }
    public static Vector(x: number, y: number, z: number): Cartesian4 {
        return new Cartesian4(x, y, z, 0);
    }

    // Type guards
    public get isVector(): boolean {
        return this.w === 0;
    }
    public get isPoint(): boolean {
        return this.w !== 0;
    }

    // Ensure input is in canonical form for ops
    private static canon(b: ICartesian4): { x: number; y: number; z: number; w: number } {
        if (b.w === 0) return { x: b.x, y: b.y, z: b.z, w: 0 };
        if (b.w === 1) return { x: b.x, y: b.y, z: b.z, w: 1 };
        return { x: b.x / b.w, y: b.y / b.w, z: b.z / b.w, w: 1 };
    }

    public override distance(b: ICartesian4): number {
        const A = this.isVector ? { x: this.x, y: this.y, z: this.z, w: 0 } : { x: this.x, y: this.y, z: this.z, w: 1 };
        const B = Cartesian4.canon(b);
        if (A.w === 0 || B.w === 0) {
            throw new Error("distance is only defined between points (w != 0)");
        }
        const dx = B.x - A.x,
            dy = B.y - A.y,
            dz = B.z - A.z;
        return Math.hypot(dx, dy, dz);
    }

    public override distanceSquared(b: ICartesian4): number {
        const A = this.isVector ? { x: this.x, y: this.y, z: this.z, w: 0 } : { x: this.x, y: this.y, z: this.z, w: 1 };
        const B = Cartesian4.canon(b);
        if (A.w === 0 || B.w === 0) {
            throw new Error("distanceSquared is only defined between points (w != 0)");
        }
        const dx = B.x - A.x,
            dy = B.y - A.y,
            dz = B.z - A.z;
        return dx * dx + dy * dy + dz * dz;
    }

    public subtract(b: ICartesian4): this {
        const A = this.isVector ? { x: this.x, y: this.y, z: this.z, w: 0 } : { x: this.x, y: this.y, z: this.z, w: 1 };
        const B = Cartesian4.canon(b);

        // point - point -> vector
        if (A.w === 1 && B.w === 1) {
            return this.newThis(A.x - B.x, A.y - B.y, A.z - B.z, 0);
        }
        // point - vector -> point
        if (A.w === 1 && B.w === 0) {
            return this.newThis(A.x - B.x, A.y - B.y, A.z - B.z, 1);
        }
        // vector - vector -> vector
        if (A.w === 0 && B.w === 0) {
            return this.newThis(A.x - B.x, A.y - B.y, A.z - B.z, 0);
        }
        // vector - point undefined
        throw new Error("vector - point is undefined in homogeneous coordinates");
    }

    public add(b: ICartesian4): this {
        const A = this.isVector ? { x: this.x, y: this.y, z: this.z, w: 0 } : { x: this.x, y: this.y, z: this.z, w: 1 };
        const B = Cartesian4.canon(b);

        // point + vector -> point
        if (A.w === 1 && B.w === 0) {
            return this.newThis(A.x + B.x, A.y + B.y, A.z + B.z, 1);
        }
        // vector + point -> point
        if (A.w === 0 && B.w === 1) {
            return this.newThis(A.x + B.x, A.y + B.y, A.z + B.z, 1);
        }
        // vector + vector -> vector
        if (A.w === 0 && B.w === 0) {
            return this.newThis(A.x + B.x, A.y + B.y, A.z + B.z, 0);
        }
        // point + point undefined
        throw new Error("point + point is undefined in homogeneous coordinates");
    }

    public override addInPlace(b: ICartesian4): this {
        // Implement using add for correctness, then copy into this
        const r = this.add(b);
        this.x = r.x;
        this.y = r.y;
        this.z = r.z;
        this.w = (r as Cartesian4).w;
        return this;
    }

    public override multiplyByScalar(n: number): this {
        // Scale directions naturally; for points, scale position from origin
        if (this.isVector) {
            return this.newThis(this.x * n, this.y * n, this.z * n, 0);
        }
        return this.newThis(this.x * n, this.y * n, this.z * n, 1);
    }

    public override divideByScalar(n: number): this {
        if (n === 0) throw new Error("Divide by zero");
        if (this.isVector) {
            return this.newThis(this.x / n, this.y / n, this.z / n, 0);
        }
        return this.newThis(this.x / n, this.y / n, this.z / n, 1);
    }

    public override magnitude(): number {
        // Only meaningful for vectors
        if (!this.isVector) {
            throw new Error("magnitude is only defined for vectors (w = 0) in homogeneous coords");
        }
        return Math.hypot(this.x, this.y, this.z);
    }

    public override clone(): this {
        return this.newThis(this.x, this.y, this.z, this.w);
    }

    public override toString(): string {
        return `x:${this.x}, y:${this.y}, z:${this.z}, w:${this.w}`;
    }
}
