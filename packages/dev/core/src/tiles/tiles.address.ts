import { Nullable } from "../types";
import { ICartesian3 } from "../geometry/geometry.interfaces";
import { Scalar } from "../math/math";
import { ITileAddress, ITileMetrics } from "./tiles.interfaces";

export class TileAddress implements ITileAddress {
    public static IsValidAddress(a: ITileAddress, metrics: ITileMetrics): boolean {
        if (!TileAddress.IsValidLod(a.levelOfDetail, metrics)) {
            return false;
        }
        const s = (0x01 << a.levelOfDetail) - 1;
        if (a.x < 0 || a.x > s) {
            return false;
        }
        if (a.y < 0 || a.y > s) {
            return false;
        }
        return true;
    }

    public static AssertValidAddress(a: ITileAddress, metrics: ITileMetrics): void {
        if (!TileAddress.IsValidLod(a.levelOfDetail, metrics)) {
            throw new Error(`Invalid levelOfDetail ${a.levelOfDetail}`);
        }
        const s = (0x01 << a.levelOfDetail) - 1;
        if (a.x < 0 || a.x > s) {
            throw new Error(`Invalid x ${a.x}, must be in [0,${s}] range.`);
        }
        if (a.y < 0 || a.y > s) {
            throw new Error(`Invalid y ${a.y}, must be in [0,${s}] range.`);
        }
    }

    public static IsValidLod(lod: number, metrics: ITileMetrics): boolean {
        return lod >= metrics.minLOD && lod <= metrics.maxLOD;
    }

    public static ClampLod(levelOfDetail: number, metrics: ITileMetrics): number {
        return Scalar.Clamp(levelOfDetail, metrics.minLOD, metrics.maxLOD);
    }

    public static GetLodScale(lod: number): number {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000; // Trick to avoid floating point error.
        // scale corresponding to the decimal part
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }

    public static ToParentKey(key: string): string {
        return key && key.length > 1 ? key.substring(0, key.length - 1) : key;
    }

    /// <summary>
    /// Returns the normalized section of the quadkey in the form of Vector3(x,y,z) where x,y,z are in [0,1] range
    /// and define the upper left corner of the section.
    /// </summary>
    public static ToNormalizedSection(key: string): Nullable<ICartesian3> {
        if (key === null || key === undefined || key.length <= 1) {
            return null;
        }
        const c = key.charAt(key.length - 1);
        let s: ICartesian3 = { x: 0, y: 0, z: 0.5 };
        switch (c) {
            case "1": {
                s.x = s.z;
                break;
            }
            case "2": {
                s.y = s.z;
                break;
            }
            case "3": {
                s.x = s.y = s.z;
                break;
            }
        }
        return s;
    }
    public static ToChildsKey(key: string): string[] {
        key = key || "";
        return [key.slice() + "0", key.slice() + "1", key.slice() + "2", key.slice() + "3"];
    }

    public static ToNeigborsKey(key: string): Nullable<string>[] {
        return TileAddress.ToNeigborsXY(TileAddress.QuadKeyToTileXY(key)).map((a) => (a ? TileAddress.TileXYToQuadKey(a) : null));
    }

    public static ToNeigborsXY(a: ITileAddress): Nullable<ITileAddress>[] {
        const max = Math.pow(2, a.levelOfDetail);
        const n = [
            new TileAddress(a.x - 1, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x + 1, a.y - 1, a.levelOfDetail),
            new TileAddress(a.x - 1, a.y, a.levelOfDetail),
            a,
            new TileAddress(a.x + 1, a.y, a.levelOfDetail),
            new TileAddress(a.x - 1, a.y + 1, a.levelOfDetail),
            new TileAddress(a.x, a.y + 1, a.levelOfDetail),
            new TileAddress(a.x + 1, a.y + 1, a.levelOfDetail),
        ];
        return n.map((ad) => (ad.x >= 0 && ad.y >= 0 && ad.x < max && ad.y < max ? ad : null));
    }

    public static TileXYToQuadKey(a: ITileAddress): string {
        let quadKey = "";
        for (let i = a.levelOfDetail; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((a.x & mask) != 0) {
                digit++;
            }
            if ((a.y & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey = quadKey + digit;
        }
        return quadKey;
    }

    public static QuadKeyToTileXY(quadKey: string): ITileAddress {
        let tileX = 0;
        let tileY = 0;
        const levelOfDetail = quadKey.length;
        for (let i = levelOfDetail; i > 0; i--) {
            const mask = 1 << (i - 1);
            switch (quadKey[levelOfDetail - i]) {
                case "0":
                    break;

                case "1":
                    tileX |= mask;
                    break;

                case "2":
                    tileY |= mask;
                    break;

                case "3":
                    tileX |= mask;
                    tileY |= mask;
                    break;

                default:
                    throw new Error("Invalid QuadKey digit sequence.");
            }
        }
        return <ITileAddress>{ x: tileX, y: tileY, levelOfDetail: levelOfDetail };
    }

    private _k?: string;
    private _x?: number;
    private _y?: number;
    private _lod?: number;

    public constructor(x: number, y: number, levelOfDetail: number) {
        this._x = x;
        this._y = y;
        this._lod = levelOfDetail;
    }

    public get x(): number {
        return this._x!;
    }

    public set x(value: number) {
        if (this._x !== value) {
            this._x = value;
            this._k = undefined;
        }
    }

    public get y(): number {
        return this._y!;
    }

    public set y(value: number) {
        if (this._y !== value) {
            this._y = value;
            this._k = undefined;
        }
    }

    public get levelOfDetail(): number {
        return this._lod!;
    }

    public set levelOfDetail(value: number) {
        if (this._lod !== value) {
            this._lod = value;
            this._k = undefined;
        }
    }

    public get quadkey(): string {
        if (!this._k) {
            this._k = TileAddress.TileXYToQuadKey(this);
        }
        return this._k;
    }

    public clone(): ITileAddress {
        return new TileAddress(this.x, this.y, this.levelOfDetail);
    }

    public toString(): string {
        return `x:${this.x}, y:${this.y}, lod:${this.levelOfDetail}, k:${this.quadkey}`;
    }
}
