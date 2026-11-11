import { IQuaternion } from "./geometry.interfaces";

export class Quaternion implements IQuaternion {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    public constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    public clone(): Quaternion {
        return new Quaternion(this.x, this.y, this.z, this.w);
    }

    public set(x: number, y: number, z: number, w: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;

        return this;
    }

    public normalize(): this {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);

        if (len === 0) {
            this.x = 0;
            this.y = 0;
            this.z = 0;
            this.w = 1;

            return this;
        }

        const inv = 1 / len;

        this.x *= inv;
        this.y *= inv;
        this.z *= inv;
        this.w *= inv;

        return this;
    }

    public multiply(q: IQuaternion): Quaternion {
        return new Quaternion(
            this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
            this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
            this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
            this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z
        );
    }

    public static identity(): Quaternion {
        return new Quaternion(0, 0, 0, 1);
    }

    // roll  arround X
    // pitch arround Y
    // yaw   arround Z
    // X forward
    // Y right
    // Z up
    // Right-handed
    public static fromYawPitchRoll(yaw: number, pitch: number, roll: number): Quaternion {
        const cy = Math.cos(yaw * 0.5);
        const sy = Math.sin(yaw * 0.5);

        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);

        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);

        return new Quaternion(
            sr * cp * cy - cr * sp * sy, // x
            cr * sp * cy + sr * cp * sy, // y
            cr * cp * sy - sr * sp * cy, // z
            cr * cp * cy + sr * sp * sy // w
        );
    }
}
