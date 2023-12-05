import { ICartesian2, ICartesian4, ISize2 } from "../geometry/geometry.interfaces";
import { TileAddress } from "./tiles.address";
import { ITileAddress, ITileSection } from "./tiles.interfaces";

export class TileSection implements ITileSection {
    private static _ToNormalizedParentSection(key: string): ICartesian4 {
        const c = key.charAt(key.length - 1);
        let s: ICartesian4 = { x: 0, y: 0, z: 0.5, w: 0.5 };
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

    public static ToParentSection(key: string, n = 1): ITileSection {
        let currentKey = key;
        let section = new TileSection(TileAddress.QuadKeyToTileXY(currentKey), { x: 0, y: 0 }, { width: 1, height: 1 });
        for (let i = 0; i < n; i++) {
            const k = TileAddress.ToParentKey(currentKey);
            if (k === key) {
                break;
            }
            const ns = TileSection._ToNormalizedParentSection(key);
            section._a = TileAddress.QuadKeyToTileXY(k);
            section._o = { x: ns.x, y: ns.y };
            section._s = { width: ns.z * (section.size?.width ?? 1), height: ns.w * (section.size?.height ?? 1) };
        }
        return section;
    }

    private _k?: string;
    private _a: ITileAddress;
    private _o?: ICartesian2;
    private _s?: ISize2;

    constructor(address: ITileAddress, public offset?: ICartesian2, public size?: ISize2) {
        this._a = address;
    }

    public get address(): ITileAddress {
        return this._a!;
    }

    public get x(): number {
        return this._o?.x ?? 0;
    }

    public get y(): number {
        return this._o?.y ?? 0;
    }

    public get width(): number {
        return this._s?.width ?? 1;
    }

    public get height(): number {
        return this._s?.height ?? 1;
    }

    public get key(): string {
        if (!this._k) {
            this._k = `${this.address.quadkey}_${this.x}_${this.y}_${this.width}_${this.height}`;
        }
        return this._k;
    }
}
