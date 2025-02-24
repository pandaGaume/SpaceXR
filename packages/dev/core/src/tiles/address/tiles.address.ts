import { Nullable } from "../../types";
import { Scalar } from "../../math/math";
import { ITileAddress2, ITileMetrics } from "../tiles.interfaces";
import { Bounds, IBounds } from "../../geometry";

export enum NeighborsIndex {
    NW = 0,
    N = 1,
    NE = 2,
    W = 3,
    C = 4,
    E = 5,
    SW = 6,
    S = 7,
    SE = 8,
}

export class TileAddress implements ITileAddress2 {
    public static Split(a: ITileAddress2, metrics: ITileMetrics): Nullable<ITileAddress2[]> {
        if (a.levelOfDetail == metrics.maxLOD) {
            return null;
        }
        const baseX = a.x * 2;
        const baseY = a.y * 2;
        const childLod = a.levelOfDetail + 1;

        return [
            new TileAddress(baseX, baseY, childLod),
            new TileAddress(baseX + 1, baseY, childLod),
            new TileAddress(baseX, baseY + 1, childLod),
            new TileAddress(baseX + 1, baseY + 1, childLod),
        ];
    }

    public static ShiftMultiple(addresses: ITileAddress2[], N: number, metrics: ITileMetrics): ITileAddress2[] {
        const uniqueQuadKeys = new Set<string>();

        // Reuse the shift function and collect results
        addresses.forEach((address) => {
            const shifted = TileAddress.Shift(address, N, metrics);

            if (Array.isArray(shifted)) {
                // Add all child quadkeys to the set
                shifted.forEach((child) => {
                    uniqueQuadKeys.add(child.quadkey);
                });
            } else if (shifted) {
                // Add the single parent quadkey to the set
                uniqueQuadKeys.add(shifted.quadkey);
            }
        });

        // Convert unique quadkeys back to ITileAddress objects
        return Array.from(uniqueQuadKeys).map((key) => TileAddress.QuadKeyToTileXY(key));
    }

    public static Shift(a: ITileAddress2 | ITileAddress2[], N: number, metrics: ITileMetrics): Nullable<ITileAddress2 | ITileAddress2[]> {
        if (Array.isArray(a)) {
            return TileAddress.ShiftMultiple(a, N, metrics);
        }

        let currentKey = a.quadkey;
        let currentLod = a.levelOfDetail;

        if (N === 0) {
            return a; // Return the original address if N is 0
        }

        if (N > 0) {
            // Cap at maxLOD
            const maxShift = metrics.maxLOD - currentLod;
            const effectiveShift = Math.min(N, maxShift);

            // Generate child tiles up to the effectiveShift level
            let keys: string[] = [currentKey];

            for (let level = 0; level < effectiveShift; level++) {
                keys = keys.flatMap((key) => TileAddress.ToChildsKey(key));
            }

            // Convert quadkeys back to ITileAddress
            return keys.map((key) => TileAddress.QuadKeyToTileXY(key));
        }

        // Cap at minLOD
        const maxShift = currentLod - metrics.minLOD;
        const effectiveShift = Math.min(Math.abs(N), maxShift);

        // Move up to parent tile |effectiveShift| levels
        for (let level = 0; level < effectiveShift; level++) {
            currentKey = TileAddress.ToParentKey(currentKey);
            currentLod--;
        }

        // Convert the final parent key back to ITileAddress
        return TileAddress.QuadKeyToTileXY(currentKey);
    }

    public static ToBounds(a: ITileAddress2, metrics: ITileMetrics): IBounds {
        const points = [metrics.getTileXYToPointXY(a.x, a.y), metrics.getTileXYToPointXY(a.x + 1, a.y + 1)];
        return Bounds.FromPoints2(...points);
    }

    public static IsEquals(a: ITileAddress2, b: ITileAddress2): boolean {
        return a.x === b.x && a.y === b.y && a.levelOfDetail === b.levelOfDetail;
    }

    public static IsValidAddress(a: ITileAddress2, metrics: ITileMetrics): boolean {
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

    public static AssertValidAddress(a: ITileAddress2, metrics: ITileMetrics): void {
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

    public static ToParentKey(key: string): string {
        return key && key.length > 1 ? key.substring(0, key.length - 1) : key;
    }

    public static ToChildsKey(key: string): string[] {
        key = key || "";
        return [key.slice() + "0", key.slice() + "1", key.slice() + "2", key.slice() + "3"];
    }

    public static ToNeighborsKey(key: string): Nullable<string>[] {
        return TileAddress.ToNeighborsXY(TileAddress.QuadKeyToTileXY(key)).map((a) => (a ? TileAddress.TileXYToQuadKey(a.x, a.y, a.levelOfDetail) : null));
    }

    /// <summary>
    /// Returns the tile addresses of the neighbors of the specified tile.
    // layout of the returned array is as follows:
    /// 0, 1, 2
    /// 3, 4, 5
    /// 6, 7, 8
    /// with 4 being the specified tile.
    // you may use NeighborsAddress enum for the purpose of indexing the array.
    /// </summary>
    public static ToNeighborsXY(a: ITileAddress2): Nullable<ITileAddress2>[] {
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

    public static TileXYToQuadKey(x: number, y: number, levelOfDetail: number): string {
        let quadKey = "";
        for (let i = levelOfDetail; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) != 0) {
                digit++;
            }
            if ((y & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey = quadKey + digit;
        }
        return quadKey;
    }

    public static QuadKeyToTileXY(quadKey: string): ITileAddress2 {
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
        return <ITileAddress2>{ x: tileX, y: tileY, levelOfDetail: levelOfDetail };
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
            this._k = TileAddress.TileXYToQuadKey(this.x, this.y, this.levelOfDetail);
        }
        return this._k;
    }

    public clone(): ITileAddress2 {
        return new TileAddress(this.x, this.y, this.levelOfDetail);
    }

    public toString(): string {
        return `x:${this.x}, y:${this.y}, lod:${this.levelOfDetail}, k:${this.quadkey}`;
    }
}
